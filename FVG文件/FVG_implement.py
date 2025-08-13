# fvg_implement.py
# 2025-08-07 rev-2  (no body-ratio check)

import pandas as pd
from typing import List, Dict, Any


class FVGDetector:
    """
    Fair Value Gap (FVG) detector – body-ratio rule removed.

    DataFrame 欄位：open, high, low, close
    規則重點：
        • 三根結構：L.high < R.low → bull；L.low > R.high → bear
        • 方向連續性：預設 L 與 C 同方向（可關閉）
        • 跳空 FVG：gap-up 多頭實體、gap-down 空頭實體
        • 回補：實體完全覆蓋；影線不算
        • 壽命 max_age = 40 → 逾期標記 expired
    """

    def __init__(
        self,
        max_age: int = 40,
        require_dir_continuity: bool = True,
    ):
        self.max_age = max_age
        self.require_dir_continuity = require_dir_continuity

    # ────────────────────────────────────────────────────────
    @staticmethod
    def _candle_dir(row) -> int:
        if row["close"] > row["open"]:
            return 1
        if row["close"] < row["open"]:
            return -1
        return 0  # doji

    # ────────────────────────────────────────────────────────
    def detect(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        fvgs: List[Dict[str, Any]] = []

        for i in range(1, len(df) - 1):
            L, C, R = df.iloc[i - 1], df.iloc[i], df.iloc[i + 1]

            # a) 方向連續性：L、C 同色（第 3 根不要求）
            if self.require_dir_continuity and self._candle_dir(L) != self._candle_dir(C):
                continue

            # b) 三根結構 FVG
            if L["high"] < R["low"]:
                fvgs.append({"idx": i + 1, "type": "bull", "top": R["low"], "bot": L["high"]})
            elif L["low"] > R["high"]:
                fvgs.append({"idx": i + 1, "type": "bear", "top": L["low"], "bot": R["high"]})

            # c) 跳空 FVG（方向需一致）
            if C["open"] > L["high"] and C["close"] > C["open"]:
                fvgs.append({"idx": i, "type": "bull", "top": C["open"], "bot": L["high"]})
            if C["open"] < L["low"] and C["close"] < C["open"]:
                fvgs.append({"idx": i, "type": "bear", "top": L["low"], "bot": C["open"]})

        # ── 後處理：填補 / 逾期 ─────────────────────────────
        for fvg in fvgs:
            fvg.update(filled=False, expired=False)
            s = fvg["idx"]
            upper, lower = max(fvg["top"], fvg["bot"]), min(fvg["top"], fvg["bot"])
            last = min(len(df) - 1, s + self.max_age)

            for j in range(s, last + 1):
                row = df.iloc[j]
                body_high = max(row["open"], row["close"])
                body_low = min(row["open"], row["close"])
                if body_low <= lower and body_high >= upper:
                    fvg["filled"] = True
                    break

            if not fvg["filled"] and last == s + self.max_age:
                fvg["expired"] = True

        return fvgs
