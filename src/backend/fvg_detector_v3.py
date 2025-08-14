# 檔名：fvg_detector_v3.py - FVG檢測器 V3版本 (簡化精準版)

import pandas as pd
import numpy as np
from typing import List, Dict, Optional, Tuple
from datetime import datetime

class FVGDetectorV3:
    """
    Fair Value Gap 檢測器 V3版本
    
    基於FVG規則V3.txt實現：
    - 簡化檢測邏輯
    - 移除不必要的參數（IoU、tick_eps等）
    - 精確的清除條件
    """
    
    def __init__(self, max_display_length: int = 40):
        """
        初始化FVG檢測器V3
        
        Args:
            max_display_length: 最大顯示長度（也是清除檢測範圍）
        """
        self.max_display_length = max_display_length
        
    def detect_fvgs(self, df: pd.DataFrame, target_time: Optional[datetime] = None) -> List[Dict]:
        """
        檢測FVG根據V3規則
        
        Args:
            df: K線數據，必須包含time, open, high, low, close欄位
            target_time: 目標時間點（開盤時間），用於限制檢測範圍
            
        Returns:
            List[Dict]: FVG列表，每個包含id, type, bot, top, left_time, time等
        """
        if len(df) < 3:
            return []
        
        # 確保數據按時間排序
        df = df.sort_values('time').reset_index(drop=True)
        
        # 如果指定了target_time，只檢測該時間點之前的數據
        if target_time:
            target_timestamp = int(target_time.timestamp())
            df = df[df['time'] <= target_timestamp].copy()
        
        if len(df) < 3:
            return []
        
        fvgs = []
        fvg_id = 1
        
        # 檢測所有可能的三根K線組合 (L-C-R)
        for i in range(len(df) - 2):
            L = df.iloc[i]      # 左邊K線
            C = df.iloc[i + 1]  # 中間K線 
            R = df.iloc[i + 2]  # 右邊K線
            
            fvg = self._check_fvg_pattern(L, C, R, i + 2, fvg_id)  # 形成點為R的index
            if fvg:
                fvgs.append(fvg)
                fvg_id += 1
        
        # 應用清除邏輯
        active_fvgs = self._apply_clearing_logic(df, fvgs)
        
        return active_fvgs
    
    def _check_fvg_pattern(self, L: pd.Series, C: pd.Series, R: pd.Series, 
                          formation_idx: int, fvg_id: int) -> Optional[Dict]:
        """
        檢查三根K線是否形成FVG模式（V3規則）
        
        Args:
            L: 左邊K線
            C: 中間K線
            R: 右邊K線
            formation_idx: 形成點索引（R的位置）
            fvg_id: FVG ID
            
        Returns:
            Dict or None: FVG字典或None
        """
        # 多頭FVG檢測
        if (C['close'] > C['open'] and           # 中間K線為陽線
            C['open'] > L['high'] and            # C.Open > L.High
            L['high'] < R['low']):               # L.High < R.Low
            
            return {
                'id': fvg_id,
                'type': 'bull',
                'bot': L['high'],                # 下邊界 = L.High
                'top': R['low'],                 # 上邊界 = R.Low
                'left_time': int(L['time']),     # 左界時間（L的時間）
                'time': int(R['time']),          # 形成時間（R的時間）
                'formation_idx': formation_idx,   # 形成點索引
                'left_idx': formation_idx - 2,   # L的索引
                'cleared': False,
                'clear_time': None,
                'clear_idx': None
            }
        
        # 空頭FVG檢測  
        elif (C['close'] < C['open'] and         # 中間K線為陰線
              C['open'] < L['low'] and           # C.Open < L.Low
              L['low'] > R['high']):             # L.Low > R.High
            
            return {
                'id': fvg_id,
                'type': 'bear',
                'bot': R['high'],                # 下邊界 = R.High
                'top': L['low'],                 # 上邊界 = L.Low
                'left_time': int(L['time']),     # 左界時間（L的時間）
                'time': int(R['time']),          # 形成時間（R的時間）
                'formation_idx': formation_idx,   # 形成點索引
                'left_idx': formation_idx - 2,   # L的索引
                'cleared': False,
                'clear_time': None,
                'clear_idx': None
            }
        
        return None
    
    def _apply_clearing_logic(self, df: pd.DataFrame, fvgs: List[Dict]) -> List[Dict]:
        """
        應用FVG清除邏輯（V3規則）
        
        對每個FVG，檢查其形成後40個K線內是否有收盤價觸及遠端邊界
        
        Args:
            df: 完整K線數據
            fvgs: 檢測到的FVG列表
            
        Returns:
            List[Dict]: 經過清除檢查的FVG列表（只返回未被清除的）
        """
        active_fvgs = []
        
        for fvg in fvgs:
            formation_idx = fvg['formation_idx']
            
            # 檢查清除條件：從形成點R開始往後40個K線
            is_cleared = False
            clear_time = None
            clear_idx = None
            
            # 檢查範圍：R+1 到 R+40（最多40個K線）
            end_idx = min(len(df), formation_idx + 1 + self.max_display_length)
            
            for j in range(formation_idx + 1, end_idx):
                candle = df.iloc[j]
                close_price = candle['close']
                
                # V3清除條件（根據修正後的規則）
                if fvg['type'] == 'bear' and close_price >= self._get_l_high(df, fvg):      # 空頭：Close >= L.High
                    is_cleared = True
                    clear_time = int(candle['time'])
                    clear_idx = j
                    break
                elif fvg['type'] == 'bull' and close_price <= self._get_l_low(df, fvg):     # 多頭：Close <= L.Low
                    is_cleared = True
                    clear_time = int(candle['time'])
                    clear_idx = j
                    break
            
            # 更新FVG狀態
            fvg['cleared'] = is_cleared
            fvg['clear_time'] = clear_time
            fvg['clear_idx'] = clear_idx
            
            # V3顯示邏輯：只顯示未被清除的FVG
            if not is_cleared:
                active_fvgs.append(fvg)
        
        return active_fvgs
    
    def get_dynamic_fvgs(self, df: pd.DataFrame, current_idx: int) -> List[Dict]:
        """
        獲取動態FVG（用於播放模式）
        
        檢測到current_idx為止的所有FVG，適用於逐根K線播放
        
        Args:
            df: K線數據
            current_idx: 當前播放到的K線索引
            
        Returns:
            List[Dict]: 當前時刻的活躍FVG列表
        """
        if current_idx < 2:
            return []
        
        # 只使用到current_idx的數據
        current_df = df.iloc[:current_idx + 1].copy()
        
        # 檢測FVG
        return self.detect_fvgs(current_df)
    
    def format_fvgs_for_frontend(self, fvgs: List[Dict]) -> List[Dict]:
        """
        格式化FVG數據供前端使用
        
        Args:
            fvgs: FVG列表
            
        Returns:
            List[Dict]: 格式化後的FVG列表
        """
        formatted = []
        
        for fvg in fvgs:
            formatted_fvg = {
                'id': fvg['id'],
                'type': fvg['type'],
                'bot': float(fvg['bot']),
                'top': float(fvg['top']),
                'left_time': fvg['left_time'],
                'time': fvg['time'],
                'cleared': fvg['cleared']
            }
            
            # 添加清除信息（如果有）
            if fvg['cleared']:
                formatted_fvg['clear_time'] = fvg['clear_time']
            
            formatted.append(formatted_fvg)
        
        return formatted
    
    def get_statistics(self, fvgs: List[Dict]) -> Dict:
        """
        獲取FVG統計信息
        
        Args:
            fvgs: FVG列表
            
        Returns:
            Dict: 統計信息
        """
        if not fvgs:
            return {
                'total_count': 0,
                'bull_count': 0,
                'bear_count': 0,
                'active_count': 0,
                'cleared_count': 0
            }
        
        bull_count = sum(1 for fvg in fvgs if fvg['type'] == 'bull')
        bear_count = sum(1 for fvg in fvgs if fvg['type'] == 'bear')
        active_count = sum(1 for fvg in fvgs if not fvg['cleared'])
        cleared_count = sum(1 for fvg in fvgs if fvg['cleared'])
        
        return {
            'total_count': len(fvgs),
            'bull_count': bull_count,
            'bear_count': bear_count,
            'active_count': active_count,
            'cleared_count': cleared_count
        }
    
    def _get_l_high(self, df: pd.DataFrame, fvg: Dict) -> float:
        """獲取FVG對應的L.High值"""
        l_idx = fvg['left_idx']
        return df.iloc[l_idx]['high']
    
    def _get_l_low(self, df: pd.DataFrame, fvg: Dict) -> float:
        """獲取FVG對應的L.Low值"""
        l_idx = fvg['left_idx'] 
        return df.iloc[l_idx]['low']