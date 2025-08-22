# 檔名：fvg_detector_simple.py
# 簡化版FVG檢測器 - 去除複雜時間轉換

import pandas as pd
import numpy as np
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import sys
import os

# 添加utils路徑
current_dir = os.path.dirname(os.path.abspath(__file__))
utils_dir = os.path.join(os.path.dirname(current_dir), 'utils')
sys.path.insert(0, utils_dir)

from time_utils import normalize_timestamp, validate_timestamp, datetime_to_timestamp

class FVGDetectorSimple:
    """
    簡化版FVG檢測器
    - 直接使用DataFrame的DateTime欄位
    - 簡單的時間範圍計算
    - 去除複雜的時間戳轉換
    """
    
    def __init__(self, clearing_window: int = 40):
        self.clearing_window = clearing_window
        
        # 時間框架間隔映射（分鐘）
        self.timeframe_intervals = {
            'M1': 1,
            'M5': 5,
            'M15': 15,
            'M30': 30,
            'H1': 60,
            'H4': 240,
            'D1': 1440
        }
        
        self.stats = {
            'total_detected': 0,
            'bullish_detected': 0,
            'bearish_detected': 0,
            'cleared_count': 0,
            'valid_count': 0
        }
    
    def detect_fvgs(self, df: pd.DataFrame, timeframe: str = 'M15') -> List[Dict[str, Any]]:
        """
        檢測所有FVG - 簡化版本
        
        Args:
            df: K線數據，必須包含 ['DateTime', 'Open', 'High', 'Low', 'Close'] 列
            timeframe: 時間框架（用於計算延伸時間）
            
        Returns:
            FVG清單
        """
        if len(df) < 3:
            return []
        
        # 防止堆棧溢出：限制數據量
        if len(df) > 1000:
            print(f"   [FVG檢測] 數據量過大 ({len(df)} 根K線)，限制為最近1000根")
            df = df.tail(1000).copy()
        
        # 確保數據按時間排序
        df = df.sort_values('DateTime').reset_index(drop=True)
        
        fvgs = []
        
        # 滑動窗口檢測FVG (需要至少3根K線: L, C, R)
        # 正確順序：i-2(左), i-1(中), i(右) - 因為FVG是在右邊K線形成時才確認
        for i in range(2, len(df)):
            L = df.iloc[i - 2]  # Left candle (i-2)
            C = df.iloc[i - 1]  # Center candle (i-1)
            R = df.iloc[i]      # Right candle (i) - 當前K線
            
            # 檢查多頭FVG: C.Close > C.Open AND C.Close > L.High AND L.High < R.Low
            if (C['Close'] > C['Open'] and 
                C['Close'] > L['High'] and 
                L['High'] < R['Low']):
                
                fvg = self._create_fvg(
                    fvg_type='bullish',
                    L=L, C=C, R=R,
                    l_idx=i-2, c_idx=i-1, r_idx=i,
                    timeframe=timeframe
                )
                fvgs.append(fvg)
                self.stats['bullish_detected'] += 1
            
            # 檢查空頭FVG: C.Close < C.Open AND C.Close < L.Low AND L.Low > R.High
            elif (C['Close'] < C['Open'] and 
                  C['Close'] < L['Low'] and 
                  L['Low'] > R['High']):
                
                fvg = self._create_fvg(
                    fvg_type='bearish', 
                    L=L, C=C, R=R,
                    l_idx=i-2, c_idx=i-1, r_idx=i,
                    timeframe=timeframe
                )
                fvgs.append(fvg)
                self.stats['bearish_detected'] += 1
        
        self.stats['total_detected'] = len(fvgs)
        self.stats['valid_count'] = len(fvgs)
        
        # 檢查清除條件
        fvgs = self._check_all_clearing(fvgs, df)
        
        return fvgs
    
    def _create_fvg(self, fvg_type: str, L, C, R, l_idx: int, c_idx: int, r_idx: int, timeframe: str) -> Dict[str, Any]:
        """
        創建FVG記錄 - 簡化版本
        """
        # 計算開始和結束時間 - 直接使用DateTime
        start_time = L['DateTime']
        
        # 修正：計算結束時間應該是 L時間 + (40根K線 × 時間間隔)
        # 這樣M1時間框架的FVG延伸為40根K線，不是40分鐘
        interval_minutes = self.timeframe_intervals.get(timeframe, 15)  # 預設15分鐘
        end_time = start_time + timedelta(minutes=interval_minutes * self.clearing_window)
        
        if fvg_type == 'bullish':
            return {
                'type': 'bullish',
                'start_time': datetime_to_timestamp(start_time),
                'end_time': datetime_to_timestamp(end_time),
                'formation_time': datetime_to_timestamp(R['DateTime']),
                'start_price': float(L['High']),  # 多頭FVG的下邊界
                'end_price': float(R['Low']),    # 多頭FVG的上邊界
                'gap_size': float(R['Low'] - L['High']),
                'gap_percentage': float((R['Low'] - L['High']) / L['High'] * 100),
                'clearing_trigger_price': float(L['Low']),  # 多頭FVG清除條件
                'status': 'valid',
                'left_candle': {
                    'index': l_idx,
                    'datetime': start_time.isoformat(),
                    'open': float(L['Open']),
                    'high': float(L['High']),
                    'low': float(L['Low']),
                    'close': float(L['Close'])
                },
                'center_candle': {
                    'index': c_idx,
                    'datetime': C['DateTime'].isoformat(),
                    'open': float(C['Open']),
                    'high': float(C['High']),
                    'low': float(C['Low']),
                    'close': float(C['Close'])
                },
                'right_candle': {
                    'index': r_idx,
                    'datetime': R['DateTime'].isoformat(),
                    'open': float(R['Open']),
                    'high': float(R['High']),
                    'low': float(R['Low']),
                    'close': float(R['Close'])
                }
            }
        else:  # bearish
            return {
                'type': 'bearish',
                'start_time': datetime_to_timestamp(start_time),
                'end_time': datetime_to_timestamp(end_time),
                'formation_time': datetime_to_timestamp(R['DateTime']),
                'start_price': float(R['High']),  # 空頭FVG的上邊界
                'end_price': float(L['Low']),    # 空頭FVG的下邊界
                'gap_size': float(L['Low'] - R['High']),
                'gap_percentage': float((L['Low'] - R['High']) / R['High'] * 100),
                'clearing_trigger_price': float(L['High']),  # 空頭FVG清除條件
                'status': 'valid',
                'left_candle': {
                    'index': l_idx,
                    'datetime': start_time.isoformat(),
                    'open': float(L['Open']),
                    'high': float(L['High']),
                    'low': float(L['Low']),
                    'close': float(L['Close'])
                },
                'center_candle': {
                    'index': c_idx,
                    'datetime': C['DateTime'].isoformat(),
                    'open': float(C['Open']),
                    'high': float(C['High']),
                    'low': float(C['Low']),
                    'close': float(C['Close'])
                },
                'right_candle': {
                    'index': r_idx,
                    'datetime': R['DateTime'].isoformat(),
                    'open': float(R['Open']),
                    'high': float(R['High']),
                    'low': float(R['Low']),
                    'close': float(R['Close'])
                }
            }
    
    def _check_all_clearing(self, fvgs: List[Dict[str, Any]], df: pd.DataFrame) -> List[Dict[str, Any]]:
        """
        檢查所有FVG的清除狀態 - 簡化版本
        """
        for fvg in fvgs:
            formation_idx = fvg['right_candle']['index']
            
            # 檢查後續K線是否清除此FVG
            for i in range(formation_idx + 1, min(formation_idx + 1 + self.clearing_window, len(df))):
                candle = df.iloc[i]
                
                if fvg['type'] == 'bullish':
                    # 多頭FVG: 收盤價跌破 L.Low (只檢查收盤價)
                    if candle['Close'] <= fvg['clearing_trigger_price']:
                        fvg['status'] = 'cleared'
                        fvg['cleared_at'] = datetime_to_timestamp(candle['DateTime'])
                        fvg['cleared_by_price'] = float(candle['Close'])
                        fvg['cleared_at_index'] = i
                        self.stats['cleared_count'] += 1
                        break
                else:  # bearish
                    # 空頭FVG: 收盤價突破 L.High (只檢查收盤價)
                    if candle['Close'] >= fvg['clearing_trigger_price']:
                        fvg['status'] = 'cleared'
                        fvg['cleared_at'] = datetime_to_timestamp(candle['DateTime'])
                        fvg['cleared_by_price'] = float(candle['Close'])
                        fvg['cleared_at_index'] = i
                        self.stats['cleared_count'] += 1
                        break
        
        return fvgs
    
    def convert_for_frontend(self, fvgs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        轉換為前端格式 - 簡化版本
        """
        frontend_fvgs = []
        
        for fvg in fvgs:
            frontend_fvg = {
                'type': fvg['type'],
                'startTime': fvg['start_time'],      # 已經是Unix時間戳（秒）
                'endTime': fvg['end_time'],          # 已經是Unix時間戳（秒）  
                'formationTime': fvg['formation_time'],
                'startPrice': fvg['start_price'],
                'endPrice': fvg['end_price'],
                # 同時提供v5兼容格式
                'topPrice': max(fvg['start_price'], fvg['end_price']),
                'bottomPrice': min(fvg['start_price'], fvg['end_price']),
                'status': fvg['status'],
                'gapSize': fvg['gap_size'],
                'gapPercentage': fvg['gap_percentage'],
                'clearingTriggerPrice': fvg['clearing_trigger_price']
            }
            
            # 添加清除信息（如果有）
            if fvg['status'] == 'cleared':
                frontend_fvg.update({
                    'clearedAt': fvg['cleared_at'],
                    'clearedByPrice': fvg['cleared_by_price']
                })
            
            frontend_fvgs.append(frontend_fvg)
        
        return frontend_fvgs
    
    def get_statistics(self) -> Dict[str, Any]:
        """獲取統計信息"""
        return {
            'basic_stats': self.stats,
            'detection_summary': {
                'total_detected': self.stats['total_detected'],
                'bullish_count': self.stats['bullish_detected'],
                'bearish_count': self.stats['bearish_detected'],
                'valid_count': self.stats['valid_count'],
                'cleared_count': self.stats['cleared_count'],
                'bullish_percentage': (self.stats['bullish_detected'] / max(1, self.stats['total_detected'])) * 100,
                'bearish_percentage': (self.stats['bearish_detected'] / max(1, self.stats['total_detected'])) * 100,
                'clearing_rate': (self.stats['cleared_count'] / max(1, self.stats['total_detected'])) * 100
            }
        }