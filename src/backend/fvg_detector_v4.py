# 檔名：fvg_detector_v4.py
# FVG檢測器 V4 - 實施FVG規則V3

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
import logging

class FVGDetectorV4:
    """
    FVG檢測器 V4 - 符合FVG規則V3
    
    FVG規則V3定義：
    多頭FVG: C.Close > C.Open AND C.Open > L.High AND L.High < R.Low
    空頭FVG: C.Close < C.Open AND C.Open < L.Low AND L.Low > R.High
    
    清除條件：
    - 多頭FVG: 價格跌破 L.Low（40根K線內）
    - 空頭FVG: 價格突破 L.High（40根K線內）
    """
    
    def __init__(self, clearing_window: int = 40, enable_logging: bool = True):
        """
        初始化FVG檢測器
        
        Args:
            clearing_window: 清除窗口大小（K線數量）
            enable_logging: 是否啟用日誌記錄
        """
        self.clearing_window = clearing_window
        self.enable_logging = enable_logging
        
        # 交易品種配置
        self.instrument_config = {
            'min_time_unit': 1,     # 最小時間單位：1秒
            'min_price_tick': 0.25, # 最小價格刻度：0.25
            'symbol': 'MNQ'         # 交易品種：納斯達克期貨
        }
        
        if self.enable_logging:
            logging.basicConfig(level=logging.INFO)
            self.logger = logging.getLogger(__name__)
        else:
            self.logger = None
            
        self.stats = {
            'total_detected': 0,
            'bullish_detected': 0,
            'bearish_detected': 0,
            'cleared_count': 0,
            'valid_count': 0
        }
    
    def detect_fvgs(self, df: pd.DataFrame, enable_dynamic_clearing: bool = True) -> List[Dict[str, Any]]:
        """
        檢測所有FVG
        
        Args:
            df: K線數據DataFrame，必須包含 ['time', 'open', 'high', 'low', 'close'] 列
            enable_dynamic_clearing: 是否啟用動態清除機制
            
        Returns:
            FVG清單，每個FVG包含完整信息
        """
        if len(df) < 3:
            return []
            
        fvgs = []
        
        # 重置統計
        self.stats = {
            'total_detected': 0,
            'bullish_detected': 0,
            'bearish_detected': 0,
            'cleared_count': 0,
            'valid_count': 0
        }
        
        # 滑動窗口檢測FVG (需要至少3根K線: L, C, R)
        for i in range(1, len(df) - 1):
            # 提取三根K線
            L = df.iloc[i - 1]  # Left candle
            C = df.iloc[i]      # Center candle
            R = df.iloc[i + 1]  # Right candle
            
            # 檢查FVG模式
            fvg_result = self._check_fvg_pattern(L, C, R, i - 1, i, i + 1, df)
            
            if fvg_result:
                fvg_result['formation_index'] = i + 1  # FVG形成點為R的索引
                fvg_result['status'] = 'valid'
                fvg_result['cleared_at'] = None
                fvg_result['cleared_by_price'] = None
                
                # 如果啟用動態清除，檢查後續K線是否清除此FVG
                if enable_dynamic_clearing and i + 1 < len(df) - 1:
                    clearing_result = self._check_clearing(fvg_result, df, i + 1)
                    if clearing_result:
                        fvg_result.update(clearing_result)
                
                fvgs.append(fvg_result)
                
                # 更新統計
                self.stats['total_detected'] += 1
                if fvg_result['type'] == 'bullish':
                    self.stats['bullish_detected'] += 1
                else:
                    self.stats['bearish_detected'] += 1
                    
                if fvg_result['status'] == 'cleared':
                    self.stats['cleared_count'] += 1
                else:
                    self.stats['valid_count'] += 1
        
        if self.logger:
            self.logger.info(f"FVG檢測完成: 總計={self.stats['total_detected']}, "
                           f"多頭={self.stats['bullish_detected']}, 空頭={self.stats['bearish_detected']}, "
                           f"有效={self.stats['valid_count']}, 已清除={self.stats['cleared_count']}")
        
        return fvgs
    
    def _check_fvg_pattern(self, L: pd.Series, C: pd.Series, R: pd.Series, 
                          l_idx: int, c_idx: int, r_idx: int, df: pd.DataFrame = None) -> Optional[Dict[str, Any]]:
        """
        檢查單個FVG模式
        
        Args:
            L, C, R: 三根K線數據
            l_idx, c_idx, r_idx: 對應的索引
            
        Returns:
            如果檢測到FVG，返回FVG信息；否則返回None
        """
        # 多頭FVG檢查: C.Close > C.Open AND C.Open > L.High AND L.High < R.Low
        if (C['close'] > C['open'] and 
            C['open'] > L['high'] and 
            L['high'] < R['low']):
            
            return {
                'type': 'bullish',
                'start_price': L['high'],
                'end_price': R['low'],
                'start_time': self._safe_timestamp(L, 'time', l_idx),
                'end_time': self._calculate_fvg_end_time(L, l_idx, df),
                'formation_time': self._safe_timestamp(R, 'time', r_idx),
                'left_candle': {
                    'index': l_idx,
                    'time': L['time'] if 'time' in L.index else l_idx,
                    'open': float(L['open']),
                    'high': float(L['high']),
                    'low': float(L['low']),
                    'close': float(L['close'])
                },
                'center_candle': {
                    'index': c_idx,
                    'time': C['time'] if 'time' in C.index else c_idx,
                    'open': float(C['open']),
                    'high': float(C['high']),
                    'low': float(C['low']),
                    'close': float(C['close'])
                },
                'right_candle': {
                    'index': r_idx,
                    'time': R['time'] if 'time' in R.index else r_idx,
                    'open': float(R['open']),
                    'high': float(R['high']),
                    'low': float(R['low']),
                    'close': float(R['close'])
                },
                'gap_size': float(R['low'] - L['high']),
                'gap_percentage': float((R['low'] - L['high']) / L['high'] * 100),
                'clearing_trigger_price': float(L['low'])  # 多頭FVG清除條件
            }
        
        # 空頭FVG檢查: C.Close < C.Open AND C.Open < L.Low AND L.Low > R.High  
        elif (C['close'] < C['open'] and 
              C['open'] < L['low'] and 
              L['low'] > R['high']):
            
            return {
                'type': 'bearish',
                'start_price': R['high'],
                'end_price': L['low'],
                'start_time': self._safe_timestamp(L, 'time', l_idx),
                'end_time': self._calculate_fvg_end_time(L, l_idx, df),
                'formation_time': self._safe_timestamp(R, 'time', r_idx),
                'left_candle': {
                    'index': l_idx,
                    'time': L['time'] if 'time' in L.index else l_idx,
                    'open': float(L['open']),
                    'high': float(L['high']),
                    'low': float(L['low']),
                    'close': float(L['close'])
                },
                'center_candle': {
                    'index': c_idx,
                    'time': C['time'] if 'time' in C.index else c_idx,
                    'open': float(C['open']),
                    'high': float(C['high']),
                    'low': float(C['low']),
                    'close': float(C['close'])
                },
                'right_candle': {
                    'index': r_idx,
                    'time': R['time'] if 'time' in R.index else r_idx,
                    'open': float(R['open']),
                    'high': float(R['high']),
                    'low': float(R['low']),
                    'close': float(R['close'])
                },
                'gap_size': float(L['low'] - R['high']),
                'gap_percentage': float((L['low'] - R['high']) / R['high'] * 100),
                'clearing_trigger_price': float(L['high'])  # 空頭FVG清除條件
            }
        
        return None
    
    def _calculate_fvg_end_time(self, L: pd.Series, l_idx: int, df: pd.DataFrame, max_lookback: int = 40) -> float:
        """
        計算FVG的結束時間（L + 40根K線的時間）
        
        Args:
            L: Left candle (起始K線)
            l_idx: L candle的索引
            df: 完整的K線數據DataFrame
            max_lookback: 最大延伸K線數量（默認40根）
            
        Returns:
            結束時間的時間戳
        """
        try:
            # 計算目標索引（L + 40根K線）
            target_idx = l_idx + max_lookback
            
            # 如果目標索引超出數據範圍，使用最後一根K線
            if target_idx >= len(df):
                target_idx = len(df) - 1
            
            # 獲取目標K線的時間
            target_candle = df.iloc[target_idx]
            
            if 'time' in target_candle.index:
                return self._safe_timestamp(target_candle, 'time', target_idx)
            else:
                # 如果沒有時間字段，使用索引估算
                # 假設每根K線間隔相同，基於L candle時間推算
                if 'time' in L.index:
                    l_time = self._safe_timestamp(L, 'time', l_idx)
                    # 估算時間間隔（基於相鄰K線）
                    if l_idx > 0 and l_idx < len(df) - 1:
                        prev_candle = df.iloc[l_idx - 1]
                        next_candle = df.iloc[l_idx + 1]
                        if 'time' in prev_candle.index and 'time' in next_candle.index:
                            prev_time = self._safe_timestamp(prev_candle, 'time', l_idx - 1)
                            next_time = self._safe_timestamp(next_candle, 'time', l_idx + 1)
                            interval = (next_time - prev_time) / 2  # 平均間隔
                            result = l_time + (interval * max_lookback)
                            return float(int(result))  # 確保返回整數時間戳
                    
                    # 如果無法計算間隔，假設為分鐘級數據
                    result = l_time + (60 * max_lookback)  # 60秒 * 40 = 40分鐘
                    return float(int(result))  # 確保返回整數時間戳
                else:
                    # 完全沒有時間信息，返回索引值
                    return float(target_idx)
                    
        except Exception as e:
            if self.logger:
                self.logger.warning(f"計算FVG結束時間時發生錯誤: {e}")
            # 回退到原來的邏輯
            return float(l_idx + max_lookback)
    
    def _check_clearing(self, fvg: Dict[str, Any], df: pd.DataFrame, 
                       start_idx: int) -> Optional[Dict[str, Any]]:
        """
        檢查FVG是否被清除
        
        Args:
            fvg: FVG信息
            df: 完整的K線數據
            start_idx: 開始檢查的索引
            
        Returns:
            如果被清除，返回清除信息；否則返回None
        """
        end_idx = min(start_idx + self.clearing_window, len(df))
        clearing_price = fvg['clearing_trigger_price']
        
        for i in range(start_idx, end_idx):
            candle = df.iloc[i]
            
            # 檢查清除條件
            if fvg['type'] == 'bullish':
                # 多頭FVG: 價格跌破 L.Low
                if candle['close'] <= clearing_price or candle['low'] <= clearing_price:
                    cleared_time = self._safe_timestamp(candle, 'time', i)
                    return {
                        'status': 'cleared',
                        'cleared_at': cleared_time,
                        'cleared_by_price': float(candle['close']),
                        'cleared_at_index': i,
                        'end_time': cleared_time,  # 更新end_time為清除時間
                        'clearing_candle': {
                            'index': i,
                            'time': candle['time'] if 'time' in candle.index else i,
                            'open': float(candle['open']),
                            'high': float(candle['high']),
                            'low': float(candle['low']),
                            'close': float(candle['close'])
                        }
                    }
            else:  # bearish
                # 空頭FVG: 價格突破 L.High
                if candle['close'] >= clearing_price or candle['high'] >= clearing_price:
                    cleared_time = self._safe_timestamp(candle, 'time', i)
                    return {
                        'status': 'cleared',
                        'cleared_at': cleared_time,
                        'cleared_by_price': float(candle['close']),
                        'cleared_at_index': i,
                        'end_time': cleared_time,  # 更新end_time為清除時間
                        'clearing_candle': {
                            'index': i,
                            'time': candle['time'] if 'time' in candle.index else i,
                            'open': float(candle['open']),
                            'high': float(candle['high']),
                            'low': float(candle['low']),
                            'close': float(candle['close'])
                        }
                    }
        
        return None
    
    def update_fvg_status(self, fvgs: List[Dict[str, Any]], 
                         current_candle: pd.Series, current_time: Any) -> List[Dict[str, Any]]:
        """
        動態更新FVG狀態（用於實時播放）
        
        Args:
            fvgs: 現有FVG清單
            current_candle: 當前K線
            current_time: 當前時間
            
        Returns:
            更新後的FVG清單
        """
        updated_fvgs = []
        
        for fvg in fvgs:
            if fvg['status'] == 'cleared':
                # 已清除的FVG保持不變
                updated_fvgs.append(fvg.copy())
                continue
                
            # 檢查是否被當前K線清除
            clearing_price = fvg['clearing_trigger_price']
            is_cleared = False
            
            if fvg['type'] == 'bullish':
                # 多頭FVG: 價格跌破 L.Low
                if current_candle['close'] <= clearing_price or current_candle['low'] <= clearing_price:
                    is_cleared = True
            else:  # bearish
                # 空頭FVG: 價格突破 L.High
                if current_candle['close'] >= clearing_price or current_candle['high'] >= clearing_price:
                    is_cleared = True
            
            if is_cleared:
                updated_fvg = fvg.copy()
                updated_fvg.update({
                    'status': 'cleared',
                    'cleared_at': current_time,
                    'cleared_by_price': float(current_candle['close']),
                    'clearing_candle': {
                        'time': current_time,
                        'open': float(current_candle['open']),
                        'high': float(current_candle['high']),
                        'low': float(current_candle['low']),
                        'close': float(current_candle['close'])
                    }
                })
                updated_fvgs.append(updated_fvg)
                
                if self.logger:
                    self.logger.info(f"FVG已清除: {fvg['type']} FVG 在價格 {current_candle['close']:.2f}")
            else:
                updated_fvgs.append(fvg.copy())
        
        return updated_fvgs
    
    def convert_for_frontend(self, fvgs: List[Dict[str, Any]], 
                           display_limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        轉換FVG數據為前端渲染格式
        
        Args:
            fvgs: FVG清單
            display_limit: 顯示數量限制
            
        Returns:
            前端格式的FVG數據
        """
        if display_limit:
            # 優先顯示最新的有效FVG
            valid_fvgs = [fvg for fvg in fvgs if fvg['status'] == 'valid']
            cleared_fvgs = [fvg for fvg in fvgs if fvg['status'] == 'cleared']
            
            # 取最新的有效FVG和部分已清除的FVG
            display_fvgs = valid_fvgs[-display_limit:] + cleared_fvgs[-(display_limit//2):]
        else:
            display_fvgs = fvgs
        
        frontend_fvgs = []
        
        for fvg in display_fvgs:
            frontend_fvg = {
                'type': fvg['type'],
                'startTime': fvg['start_time'],
                'endTime': fvg['end_time'],
                'startPrice': fvg['start_price'],
                'endPrice': fvg['end_price'],
                'status': fvg['status'],
                'gapSize': fvg['gap_size'],
                'gapPercentage': fvg['gap_percentage'],
                'formationTime': fvg['formation_time'],
                'clearingTriggerPrice': fvg['clearing_trigger_price']
            }
            
            # 添加清除信息（如果有）
            if fvg['status'] == 'cleared':
                frontend_fvg.update({
                    'clearedAt': fvg['cleared_at'],
                    'clearedByPrice': fvg['cleared_by_price']
                })
            
            # 添加詳細的K線信息（用於調試）
            if self.enable_logging:
                frontend_fvg['debug'] = {
                    'leftCandle': fvg['left_candle'],
                    'centerCandle': fvg['center_candle'],
                    'rightCandle': fvg['right_candle']
                }
                if fvg['status'] == 'cleared':
                    frontend_fvg['debug']['clearingCandle'] = fvg.get('clearing_candle')
            
            frontend_fvgs.append(frontend_fvg)
        
        return frontend_fvgs
    
    def get_statistics(self) -> Dict[str, Any]:
        """
        獲取檢測統計信息
        
        Returns:
            統計信息字典
        """
        return {
            'detector_version': 'v4',
            'rules_version': 'v3',
            'clearing_window': self.clearing_window,
            'statistics': self.stats.copy(),
            'detection_rate': {
                'bullish_percentage': (self.stats['bullish_detected'] / max(1, self.stats['total_detected'])) * 100,
                'bearish_percentage': (self.stats['bearish_detected'] / max(1, self.stats['total_detected'])) * 100,
                'clearing_rate': (self.stats['cleared_count'] / max(1, self.stats['total_detected'])) * 100
            }
        }
    
    def _safe_timestamp(self, row, time_field, fallback_index):
        """
        安全的時間戳提取方法
        
        Args:
            row: 數據行
            time_field: 時間欄位名稱
            fallback_index: 當無法獲取時間戳時的回調索引
            
        Returns:
            時間戳（秒）
        """
        try:
            if time_field in row.index and row[time_field] is not None:
                time_value = row[time_field]
                
                # 如果已經是數字（Unix時間戳）
                if isinstance(time_value, (int, float)):
                    # 檢查是否是合理的時間戳值
                    if 1000000000 <= time_value <= 2000000000:  # 2001-2063年範圍
                        # 確保時間戳精度符合最小單位（1秒）
                        return float(int(time_value))
                    elif 1000000000000 <= time_value <= 2000000000000:  # 毫秒轉秒
                        # 毫秒轉秒，保持整數精度
                        return float(int(time_value / 1000))
                    else:
                        if self.logger:
                            self.logger.warning(f"異常時間戳值: {time_value}, 使用索引回調: {fallback_index}")
                        return float(fallback_index)
                
                # 嘗試轉換為日期時間
                try:
                    timestamp = pd.to_datetime(time_value).timestamp()
                    if 1000000000 <= timestamp <= 2000000000:
                        return timestamp
                    else:
                        if self.logger:
                            self.logger.warning(f"轉換後時間戳超出範圍: {timestamp}, 使用索引回調: {fallback_index}")
                        return float(fallback_index)
                except Exception as e:
                    if self.logger:
                        self.logger.warning(f"時間轉換失敗: {time_value}, 錯誤: {e}, 使用索引回調: {fallback_index}")
                    return float(fallback_index)
            else:
                # 沒有時間欄位，使用索引
                return float(fallback_index)
                
        except Exception as e:
            if self.logger:
                self.logger.error(f"時間戳提取異常: {e}, 使用索引回調: {fallback_index}")
            return float(fallback_index)
    
    def _normalize_price(self, price):
        """
        標準化價格到最小刻度
        
        Args:
            price: 原始價格
            
        Returns:
            標準化後的價格
        """
        try:
            if price is None:
                return None
            
            min_tick = self.instrument_config['min_price_tick']
            # 四捨五入到最小刻度
            normalized = round(float(price) / min_tick) * min_tick
            # 保持兩位小數精度
            return round(normalized, 2)
        except Exception as e:
            if self.logger:
                self.logger.warning(f"價格標準化失敗: {price}, 錯誤: {e}")
            return float(price) if price is not None else None

# 工廠函數，用於向後兼容
def create_fvg_detector(clearing_window: int = 40, enable_logging: bool = True) -> FVGDetectorV4:
    """
    創建FVG檢測器實例
    
    Args:
        clearing_window: 清除窗口大小
        enable_logging: 是否啟用日誌
        
    Returns:
        FVGDetectorV4實例
    """
    return FVGDetectorV4(clearing_window=clearing_window, enable_logging=enable_logging)

# 向後兼容的類別別名
FVGDetector = FVGDetectorV4