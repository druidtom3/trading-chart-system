# 檔名：fvg_detector.py

import pandas as pd
from typing import List, Dict, Any
import logging

class FVGDetector:
    """
    Fair Value Gap (FVG) 檢測器
    
    改進版本：
    1. 確保 top 永遠大於 bot
    2. 統一 FVG 建立邏輯
    3. 只回傳有效（未回補且未過期）的 FVG
    """

    def __init__(
        self,
        max_age: int = 400,  # FVG存活期限（多少根K線後過期）
        require_dir_continuity: bool = False,  # 是否要求方向連續性
    ):
        self.max_age = max_age
        self.require_dir_continuity = require_dir_continuity

    @staticmethod
    def _candle_dir(row) -> int:
        """判斷 K 線方向"""
        if row["Close"] > row["Open"]:
            return 1  # 看多
        if row["Close"] < row["Open"]:
            return -1  # 看空
        return 0  # 十字線

    def _create_fvg(self, idx: int, fvg_type: str, price1: float, price2: float, row) -> Dict[str, Any]:
        """
        建立 FVG 物件，確保 top > bot
        
        Args:
            idx: K線索引
            fvg_type: 'bull' 或 'bear'
            price1, price2: 兩個價格點
            row: DataFrame row，用於取得時間
        """
        # 確保 top 永遠大於 bot
        upper = max(float(price1), float(price2))
        lower = min(float(price1), float(price2))
        
        return {
            "idx": idx,
            "type": fvg_type,
            "top": upper,
            "bot": lower,
            "time": int(row["DateTime"].timestamp()) if "DateTime" in row.index else None,
            "filled": False,
            "expired": False
        }

    def detect(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """
        檢測 FVG
        
        Args:
            df: DataFrame，必須包含 Open, High, Low, Close 欄位
            
        Returns:
            List[Dict]: 有效的 FVG 列表（未回補且未過期）
        """
        if df.empty or len(df) < 3:
            return []
            
        fvgs: List[Dict[str, Any]] = []

        # 檢測 FVG
        for i in range(1, len(df) - 1):
            L, C, R = df.iloc[i - 1], df.iloc[i], df.iloc[i + 1]

            # a) 方向連續性：L、C 同色（第 3 根不要求）
            if self.require_dir_continuity and self._candle_dir(L) != self._candle_dir(C):
                continue

            # b) 三根結構 FVG
            if L["High"] < R["Low"]:
                # 看多 FVG：左高 < 右低
                fvg = self._create_fvg(i + 1, "bull", R["Low"], L["High"], R)
                fvg["origin"] = "three"  # 標記來源
                # 標記這是從左側開始的 FVG
                fvg["display_from_left"] = True
                fvg["left_time"] = int(L["DateTime"].timestamp()) if "DateTime" in L.index else None
                fvgs.append(fvg)
                
            elif L["Low"] > R["High"]:
                # 看空 FVG：左低 > 右高
                fvg = self._create_fvg(i + 1, "bear", L["Low"], R["High"], R)
                fvg["origin"] = "three"  # 標記來源
                # 標記這是從左側開始的 FVG
                fvg["display_from_left"] = True
                fvg["left_time"] = int(L["DateTime"].timestamp()) if "DateTime" in L.index else None
                fvgs.append(fvg)

            # c) 跳空 FVG（同向實體）
            if C["Open"] > L["High"] and C["Close"] > C["Open"]:
                # 向上跳空（綠K）
                fvg = self._create_fvg(i, "bull", C["Open"], L["High"], C)
                fvg["origin"] = "gap"  # 標記來源
                # 標記這是從左側開始的 FVG
                fvg["display_from_left"] = True
                fvg["left_time"] = int(L["DateTime"].timestamp()) if "DateTime" in L.index else None
                fvgs.append(fvg)
                
            if C["Open"] < L["Low"] and C["Close"] < C["Open"]:
                # 向下跳空（紅K）
                fvg = self._create_fvg(i, "bear", L["Low"], C["Open"], C)
                fvg["origin"] = "gap"  # 標記來源
                # 標記這是從左側開始的 FVG
                fvg["display_from_left"] = True
                fvg["left_time"] = int(L["DateTime"].timestamp()) if "DateTime" in L.index else None
                fvgs.append(fvg)

        # 先進行去重合併（避免重複FVG被誤判填補）
        fvgs = self._dedupe_merge(fvgs)
        
        # 後處理：檢查填補和過期
        for fvg in fvgs:
            self._check_fill_and_expire(fvg, df)

        # 只回傳有效的 FVG（未回補且未過期）
        active_fvgs = [fvg for fvg in fvgs if not fvg["filled"] and not fvg["expired"]]
        
        # 收尾再去重一次（清理殘留）
        active_fvgs = self._dedupe_merge(active_fvgs)
        
        logging.info(f"檢測到 {len(fvgs)} 個 FVG，去重後 {len(active_fvgs)} 個有效")
        
        return active_fvgs

    @staticmethod
    def _iou(a: Dict[str, Any], b: Dict[str, Any]) -> float:
        """
        計算兩個FVG的IoU (Intersection over Union)
        
        Args:
            a, b: FVG物件，包含 top 和 bot 屬性
            
        Returns:
            float: IoU值，範圍 [0, 1]
        """
        top = min(a["top"], b["top"])
        bot = max(a["bot"], b["bot"])
        inter = max(0.0, top - bot)
        union = (a["top"] - a["bot"]) + (b["top"] - b["bot"]) - inter
        return inter / union if union > 0 else 0.0

    def _dedupe_merge(self, fvgs: List[Dict[str, Any]], iou_thresh: float = 0.75) -> List[Dict[str, Any]]:
        """
        去重合併FVG
        
        規則：
        1) 同向 (type 相同) 且 IoU >= 0.75 視為重複
        2) 若其中一個 origin="gap"，保留 gap，捨棄 three
        3) 若兩者 origin 相同 → 保留「較寬」的；idx 取較早的 min(idx)
        4) 額外處理：同一根 gap（同 idx、同 type）只允許 1 個
        
        Args:
            fvgs: FVG列表
            iou_thresh: IoU閾值，預設0.75
            
        Returns:
            List[Dict]: 去重後的FVG列表
        """
        if not fvgs:
            return []
            
        fvgs = sorted(fvgs, key=lambda x: (x["type"], x["idx"]))
        kept = []
        seen_gap_key = set()   # (type, idx) 一個 gap 僅允許一個

        for f in fvgs:
            # 4) 同一根 gap 的唯一性
            if f.get("origin") == "gap":
                key = (f["type"], f["idx"])
                if key in seen_gap_key:
                    continue
                seen_gap_key.add(key)

            merged = False
            for k in kept:
                if f["type"] != k["type"]:
                    continue
                if self._iou(f, k) < iou_thresh:
                    continue

                # 2) gap 優先：保 gap、棄 three
                if f.get("origin") == "gap" and k.get("origin") == "three":
                    # 用gap的資訊更新已保留的項目
                    k.update({
                        "top": f["top"], 
                        "bot": f["bot"], 
                        "idx": min(k["idx"], f["idx"]), 
                        "origin": "gap",
                        "display_from_left": f.get("display_from_left", k.get("display_from_left")),
                        "left_time": f.get("left_time", k.get("left_time"))
                    })
                    merged = True
                    break
                if k.get("origin") == "gap" and f.get("origin") == "three":
                    merged = True  # 直接丟掉 f
                    break

                # 3) 同起源：保較寬者
                if (f["top"] - f["bot"]) > (k["top"] - k["bot"]):
                    k.update({
                        "top": f["top"], 
                        "bot": f["bot"], 
                        "idx": min(k["idx"], f["idx"]),
                        "display_from_left": f.get("display_from_left", k.get("display_from_left")),
                        "left_time": f.get("left_time", k.get("left_time"))
                    })
                else:
                    k["idx"] = min(k["idx"], f["idx"])  # 至少更新idx
                merged = True
                break

            if not merged:
                kept.append(f.copy())  # 複製一份避免後續修改影響

        return kept

    def _check_fill_and_expire(self, fvg: Dict[str, Any], df: pd.DataFrame):
        """
        檢查 FVG 是否已回補或過期
        
        支援多根 K 線累積回補：
        - 單根 K 線 body 完全覆蓋 FVG → 立即回補
        - 多根 K 線 body 累積覆蓋 FVG → 累積回補
        
        Args:
            fvg: FVG 物件  
            df: DataFrame
        """
        start_idx = fvg["idx"]
        end_idx = min(len(df) - 1, start_idx + self.max_age)
        
        # FVG 的上下邊界
        fvg_top = max(fvg["top"], fvg["bot"])
        fvg_bot = min(fvg["top"], fvg["bot"])
        
        # 檢查是否被回補（只使用單根K線完全覆蓋）
        for j in range(start_idx, end_idx + 1):
            row = df.iloc[j]
            body_high = max(row["Open"], row["Close"])
            body_low = min(row["Open"], row["Close"])
            
            # 單根 K 線完全覆蓋 FVG
            if body_low <= fvg_bot and body_high >= fvg_top:
                fvg["filled"] = True
                return  # 立即回補
        
        # 檢查是否過期
        if end_idx == start_idx + self.max_age:
            fvg["expired"] = True