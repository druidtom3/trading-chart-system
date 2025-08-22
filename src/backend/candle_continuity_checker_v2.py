# 檔名：candle_continuity_checker_v2.py - K線連續性檢查工具（優化版）

import pandas as pd
import numpy as np
from datetime import datetime, timedelta, date
from typing import Dict, List, Optional, Tuple, Callable
import logging
import pytz
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
import multiprocessing as mp
from functools import partial
try:
    from .trading_hours import TradingHoursDetector
except ImportError:
    from trading_hours import TradingHoursDetector

class ProgressBar:
    """進度條工具類"""
    
    def __init__(self, total: int, desc: str = "", width: int = 50):
        self.total = total
        self.desc = desc
        self.width = width
        self.current = 0
        self.start_time = time.time()
        
    def update(self, n: int = 1):
        """更新進度"""
        self.current += n
        self._display()
        
    def _display(self):
        """顯示進度條"""
        if self.total == 0:
            return
            
        # 計算進度
        progress = self.current / self.total
        filled = int(self.width * progress)
        
        # 計算速度和剩餘時間
        elapsed = time.time() - self.start_time
        speed = self.current / elapsed if elapsed > 0 else 0
        eta = (self.total - self.current) / speed if speed > 0 else 0
        
        # 格式化時間
        eta_str = self._format_time(eta)
        elapsed_str = self._format_time(elapsed)
        
        # 構建進度條
        bar = '#' * filled + '.' * (self.width - filled)
        
        # 顯示
        print(f'\r{self.desc} |{bar}| {self.current}/{self.total} '
              f'[{progress*100:.1f}%] '
              f'速度: {speed:.0f} K線/秒 '
              f'已用: {elapsed_str} '
              f'剩餘: {eta_str}', end='', flush=True)
        
        if self.current >= self.total:
            print()  # 完成時換行
    
    def _format_time(self, seconds: float) -> str:
        """格式化時間顯示"""
        if seconds < 60:
            return f"{seconds:.0f}秒"
        elif seconds < 3600:
            return f"{seconds/60:.1f}分"
        else:
            return f"{seconds/3600:.1f}時"

class CandleContinuityCheckerV2:
    """
    K線連續性檢查器V2 - 優化版本
    支持多種加速策略和進度顯示
    """
    
    def __init__(self, start_date: Optional[date] = None, 
                 optimization_mode: str = 'smart',
                 show_progress: bool = True):
        """
        Args:
            start_date: 數據分析起始日期
            optimization_mode: 優化模式 ('basic', 'smart', 'parallel', 'vectorized', 'hybrid')
            show_progress: 是否顯示進度條
        """
        self.timeframe_intervals = {
            'M1': 1, 'M5': 5, 'M15': 15, 
            'H1': 60, 'H4': 240, 'D1': 1440
        }
        
        self.start_date = start_date or date(2019, 5, 20)
        self.trading_detector = TradingHoursDetector()
        self.optimization_mode = optimization_mode
        self.show_progress = show_progress
        
        # 預先計算的假日集合（加速查詢）
        self._precompute_holidays()
        
    def _precompute_holidays(self):
        """預先計算假日集合以加速查詢"""
        from datetime import date, timedelta
        self.holiday_set = set()
        
        # 預計算5年的假日
        start = date(2019, 1, 1)
        end = date(2025, 12, 31)
        current = start
        
        while current <= end:
            if current.weekday() >= 5:  # 週末
                self.holiday_set.add(current)
            current += timedelta(days=1)
        
        # 添加美國主要假日（簡化版）
        us_holidays = [
            # 新年
            date(2019, 1, 1), date(2020, 1, 1), date(2021, 1, 1),
            date(2022, 1, 1), date(2023, 1, 1), date(2024, 1, 1), date(2025, 1, 1),
            # 聖誕節
            date(2019, 12, 25), date(2020, 12, 25), date(2021, 12, 25),
            date(2022, 12, 25), date(2023, 12, 25), date(2024, 12, 25), date(2025, 12, 25),
            # 獨立日
            date(2019, 7, 4), date(2020, 7, 4), date(2021, 7, 4),
            date(2022, 7, 4), date(2023, 7, 4), date(2024, 7, 4), date(2025, 7, 4),
        ]
        self.holiday_set.update(us_holidays)
    
    def check_continuity(self, df: pd.DataFrame, timeframe: str) -> Dict:
        """主要檢查入口，根據優化模式選擇不同算法"""
        
        print(f"\n使用優化模式: {self.optimization_mode}")
        
        if self.optimization_mode == 'basic':
            return self._check_basic(df, timeframe)
        elif self.optimization_mode == 'smart':
            return self._check_smart(df, timeframe)
        elif self.optimization_mode == 'parallel':
            return self._check_parallel(df, timeframe)
        elif self.optimization_mode == 'vectorized':
            return self._check_vectorized(df, timeframe)
        elif self.optimization_mode == 'hybrid':
            return self._check_hybrid(df, timeframe)
        else:
            return self._check_basic(df, timeframe)
    
    def _check_basic(self, df: pd.DataFrame, timeframe: str) -> Dict:
        """
        方案1: 基礎優化版本
        - 添加進度條
        - 基本的性能優化
        """
        start_time = time.time()
        
        # 數據準備
        data = self._prepare_data(df, timeframe)
        if len(data) < 2:
            return self._insufficient_data_response(len(data))
        
        expected_interval = timedelta(minutes=self.timeframe_intervals[timeframe])
        total_rows = len(data) - 1
        
        # 初始化進度條
        progress = ProgressBar(total_rows, f"檢查 {timeframe} 連續性") if self.show_progress else None
        
        gaps = []
        duplicates = []
        trading_gaps = []
        data_gaps = []
        
        # 逐行檢查
        for i in range(1, len(data)):
            current_time = data.iloc[i]['DateTime']
            previous_time = data.iloc[i-1]['DateTime']
            actual_interval = current_time - previous_time
            
            # 檢查異常
            if actual_interval == timedelta(0):
                duplicates.append(self._create_duplicate_info(i, current_time))
            elif actual_interval > expected_interval:
                gap_info = self._analyze_gap(
                    previous_time, current_time, actual_interval, 
                    expected_interval, i, timeframe
                )
                if gap_info['is_normal_gap']:
                    trading_gaps.append(gap_info)
                else:
                    data_gaps.append(gap_info)
                    gaps.append(gap_info)
            
            if progress:
                progress.update(1)
        
        elapsed = time.time() - start_time
        return self._generate_report(data, gaps, duplicates, trading_gaps, 
                                   data_gaps, timeframe, elapsed)
    
    def _check_smart(self, df: pd.DataFrame, timeframe: str) -> Dict:
        """
        方案2: 智能跳躍檢查
        - 跳過已知的正常停盤時段
        - 批量處理連續正常區間
        """
        start_time = time.time()
        
        data = self._prepare_data(df, timeframe)
        if len(data) < 2:
            return self._insufficient_data_response(len(data))
        
        expected_interval = timedelta(minutes=self.timeframe_intervals[timeframe])
        
        # 智能分段：識別連續交易時段
        segments = self._identify_trading_segments(data, timeframe)
        total_checks = sum(len(seg) - 1 for seg in segments if len(seg) > 1)
        
        progress = ProgressBar(total_checks, f"智能檢查 {timeframe}") if self.show_progress else None
        
        gaps = []
        duplicates = []
        trading_gaps = []
        data_gaps = []
        
        # 只檢查每個交易時段內部的連續性
        for segment in segments:
            if len(segment) < 2:
                continue
                
            for i in range(1, len(segment)):
                current_time = segment.iloc[i]['DateTime']
                previous_time = segment.iloc[i-1]['DateTime']
                actual_interval = current_time - previous_time
                
                if actual_interval == timedelta(0):
                    duplicates.append(self._create_duplicate_info(i, current_time))
                elif actual_interval > expected_interval:
                    # 段內異常才是真正的數據缺失
                    gap_info = self._analyze_gap(
                        previous_time, current_time, actual_interval,
                        expected_interval, i, timeframe
                    )
                    data_gaps.append(gap_info)
                    gaps.append(gap_info)
                
                if progress:
                    progress.update(1)
        
        # 段間間隔都是正常停盤
        for i in range(1, len(segments)):
            if len(segments[i-1]) > 0 and len(segments[i]) > 0:
                gap_info = self._analyze_gap(
                    segments[i-1].iloc[-1]['DateTime'],
                    segments[i].iloc[0]['DateTime'],
                    segments[i].iloc[0]['DateTime'] - segments[i-1].iloc[-1]['DateTime'],
                    expected_interval, 0, timeframe
                )
                gap_info['is_normal_gap'] = True
                gap_info['reason'] = '交易時段間隔'
                trading_gaps.append(gap_info)
        
        elapsed = time.time() - start_time
        return self._generate_report(data, gaps, duplicates, trading_gaps,
                                   data_gaps, timeframe, elapsed)
    
    def _check_parallel(self, df: pd.DataFrame, timeframe: str) -> Dict:
        """
        方案3: 並行處理
        - 使用多線程加速檢查
        - 適合大數據集
        """
        start_time = time.time()
        
        data = self._prepare_data(df, timeframe)
        if len(data) < 2:
            return self._insufficient_data_response(len(data))
        
        expected_interval = timedelta(minutes=self.timeframe_intervals[timeframe])
        
        # 分割數據為多個批次
        num_workers = min(mp.cpu_count(), 8)
        chunk_size = max(1000, len(data) // num_workers)
        chunks = [data[i:i+chunk_size+1] for i in range(0, len(data), chunk_size)]
        
        progress = ProgressBar(len(data)-1, f"並行檢查 {timeframe}") if self.show_progress else None
        
        all_results = []
        
        # 並行處理
        with ThreadPoolExecutor(max_workers=num_workers) as executor:
            futures = []
            for chunk in chunks:
                future = executor.submit(
                    self._check_chunk, chunk, expected_interval, timeframe
                )
                futures.append(future)
            
            # 收集結果
            for future in as_completed(futures):
                result = future.result()
                all_results.append(result)
                if progress:
                    progress.update(result['processed'])
        
        # 合併結果
        gaps = []
        duplicates = []
        trading_gaps = []
        data_gaps = []
        
        for result in all_results:
            gaps.extend(result['gaps'])
            duplicates.extend(result['duplicates'])
            trading_gaps.extend(result['trading_gaps'])
            data_gaps.extend(result['data_gaps'])
        
        elapsed = time.time() - start_time
        return self._generate_report(data, gaps, duplicates, trading_gaps,
                                   data_gaps, timeframe, elapsed)
    
    def _check_vectorized(self, df: pd.DataFrame, timeframe: str) -> Dict:
        """
        方案4: 向量化運算
        - 使用NumPy/Pandas向量化操作
        - 最快的純Python方案
        """
        start_time = time.time()
        
        data = self._prepare_data(df, timeframe)
        if len(data) < 2:
            return self._insufficient_data_response(len(data))
        
        if self.show_progress:
            print(f"向量化檢查 {timeframe} ({len(data)} 根K線)...")
        
        expected_minutes = self.timeframe_intervals[timeframe]
        
        # 向量化計算時間差（以分鐘為單位）
        time_diffs = data['DateTime'].diff().dt.total_seconds() / 60
        time_diffs = time_diffs.fillna(0)
        
        # 快速識別異常
        duplicates_mask = time_diffs == 0
        gaps_mask = time_diffs > expected_minutes
        
        # 提取異常索引
        duplicate_indices = data.index[duplicates_mask].tolist()[1:]  # 排除第一個NaN
        gap_indices = data.index[gaps_mask].tolist()
        
        # 批量判斷是否為正常停盤
        if self.show_progress:
            print(f"  - 發現 {len(gap_indices)} 個潛在間隔")
            print(f"  - 發現 {len(duplicate_indices)} 個重複時間戳")
        
        # 向量化判斷正常停盤
        gaps = []
        trading_gaps = []
        data_gaps = []
        
        if gap_indices:
            # 批量處理所有間隔
            for idx in gap_indices:
                if idx == 0:
                    continue
                    
                current_time = data.loc[idx, 'DateTime']
                previous_time = data.loc[idx-1, 'DateTime']
                
                # 快速判斷是否為週末或假日
                is_weekend = current_time.weekday() >= 5 or previous_time.weekday() >= 5
                is_holiday = (current_time.date() in self.holiday_set or 
                            previous_time.date() in self.holiday_set)
                
                # 快速判斷是否跨越收盤時間
                is_close_time = (previous_time.hour >= 17 and current_time.hour < 17)
                
                is_normal = is_weekend or is_holiday or is_close_time
                
                gap_info = {
                    'start_time': previous_time,
                    'end_time': current_time,
                    'gap_minutes': time_diffs[idx],
                    'is_normal_gap': is_normal,
                    'reason': self._get_gap_reason(is_weekend, is_holiday, is_close_time)
                }
                
                if is_normal:
                    trading_gaps.append(gap_info)
                else:
                    data_gaps.append(gap_info)
                    gaps.append(gap_info)
        
        # 處理重複
        duplicates = [
            {'index': idx, 'time': data.loc[idx, 'DateTime']}
            for idx in duplicate_indices
        ]
        
        elapsed = time.time() - start_time
        
        if self.show_progress:
            print(f"  ✓ 完成！用時: {elapsed:.2f}秒")
        
        return self._generate_report(data, gaps, duplicates, trading_gaps,
                                   data_gaps, timeframe, elapsed)
    
    def _check_hybrid(self, df: pd.DataFrame, timeframe: str) -> Dict:
        """
        方案5: 混合優化
        - 結合向量化和智能跳躍
        - 平衡速度和準確性
        """
        start_time = time.time()
        
        data = self._prepare_data(df, timeframe)
        if len(data) < 2:
            return self._insufficient_data_response(len(data))
        
        if self.show_progress:
            print(f"混合檢查 {timeframe} ({len(data)} 根K線)...")
            print("  階段1: 向量化掃描...")
        
        expected_minutes = self.timeframe_intervals[timeframe]
        
        # 階段1: 向量化快速掃描
        time_diffs = data['DateTime'].diff().dt.total_seconds() / 60
        anomaly_mask = (time_diffs != expected_minutes) & (time_diffs > 0)
        anomaly_indices = data.index[anomaly_mask].tolist()
        
        if self.show_progress:
            print(f"  階段2: 詳細分析 {len(anomaly_indices)} 個異常...")
            progress = ProgressBar(len(anomaly_indices), "    分析異常")
        else:
            progress = None
        
        # 階段2: 詳細分析異常
        gaps = []
        duplicates = []
        trading_gaps = []
        data_gaps = []
        
        for idx in anomaly_indices:
            current_time = data.loc[idx, 'DateTime']
            previous_time = data.loc[idx-1, 'DateTime']
            actual_interval = current_time - previous_time
            
            if actual_interval == timedelta(0):
                duplicates.append(self._create_duplicate_info(idx, current_time))
            else:
                # 使用緩存的假日集合快速判斷
                gap_info = self._analyze_gap_fast(
                    previous_time, current_time, time_diffs[idx],
                    expected_minutes, idx, timeframe
                )
                
                if gap_info['is_normal_gap']:
                    trading_gaps.append(gap_info)
                else:
                    data_gaps.append(gap_info)
                    gaps.append(gap_info)
            
            if progress:
                progress.update(1)
        
        elapsed = time.time() - start_time
        
        if self.show_progress:
            print(f"  ✓ 完成！總用時: {elapsed:.2f}秒")
        
        return self._generate_report(data, gaps, duplicates, trading_gaps,
                                   data_gaps, timeframe, elapsed)
    
    # ===== 輔助方法 =====
    
    def _prepare_data(self, df: pd.DataFrame, timeframe: str) -> pd.DataFrame:
        """準備數據"""
        if timeframe not in self.timeframe_intervals:
            raise ValueError(f"不支援的時間框架: {timeframe}")
        
        if 'DateTime' not in df.columns:
            raise ValueError("DataFrame必須包含DateTime欄位")
        
        data = df.copy()
        data = data.sort_values('DateTime').reset_index(drop=True)
        data = data[data['DateTime'].dt.date >= self.start_date].copy()
        
        return data
    
    def _insufficient_data_response(self, count: int) -> Dict:
        """數據不足的響應"""
        return {
            'status': 'insufficient_data',
            'message': '數據不足，無法進行連續性檢查',
            'total_candles': count
        }
    
    def _create_duplicate_info(self, index: int, time: datetime) -> Dict:
        """創建重複信息"""
        return {
            'index': index,
            'time': time,
            'previous_index': index - 1
        }
    
    def _analyze_gap(self, prev_time: datetime, curr_time: datetime,
                    actual_interval: timedelta, expected_interval: timedelta,
                    index: int, timeframe: str) -> Dict:
        """分析間隔"""
        is_normal = self.trading_detector.should_ignore_gap(prev_time, curr_time)
        reason = self.trading_detector.get_trading_gap_reason(prev_time, curr_time)
        
        expected_candles = self.trading_detector.get_expected_trading_candles(
            prev_time, curr_time, self.timeframe_intervals[timeframe]
        )
        
        return {
            'start_time': prev_time,
            'end_time': curr_time,
            'actual_interval': str(actual_interval),
            'expected_interval': str(expected_interval),
            'missing_candles': expected_candles - 1,
            'gap_minutes': actual_interval.total_seconds() / 60,
            'start_index': index - 1,
            'end_index': index,
            'is_normal_gap': is_normal,
            'reason': reason
        }
    
    def _analyze_gap_fast(self, prev_time: datetime, curr_time: datetime,
                         gap_minutes: float, expected_minutes: int,
                         index: int, timeframe: str) -> Dict:
        """快速分析間隔（使用緩存）"""
        # 快速判斷
        is_weekend = curr_time.weekday() >= 5 or prev_time.weekday() >= 5
        is_holiday = (curr_time.date() in self.holiday_set or 
                     prev_time.date() in self.holiday_set)
        is_close_time = (prev_time.hour >= 17 and curr_time.hour < 17)
        
        is_normal = is_weekend or is_holiday or is_close_time
        
        return {
            'start_time': prev_time,
            'end_time': curr_time,
            'gap_minutes': gap_minutes,
            'missing_candles': int(gap_minutes / expected_minutes) - 1,
            'is_normal_gap': is_normal,
            'reason': self._get_gap_reason(is_weekend, is_holiday, is_close_time),
            'start_index': index - 1,
            'end_index': index
        }
    
    def _get_gap_reason(self, is_weekend: bool, is_holiday: bool, is_close_time: bool) -> str:
        """獲取間隔原因"""
        if is_weekend:
            return '週末'
        elif is_holiday:
            return '假日'
        elif is_close_time:
            return '收盤時間'
        else:
            return '數據缺失'
    
    def _identify_trading_segments(self, data: pd.DataFrame, timeframe: str) -> List[pd.DataFrame]:
        """識別連續交易時段"""
        segments = []
        current_segment = []
        
        for i, row in data.iterrows():
            dt = row['DateTime']
            
            # 判斷是否在交易時間
            is_trading_time = (
                dt.weekday() < 5 and  # 非週末
                dt.date() not in self.holiday_set and  # 非假日
                not (dt.hour == 17 and dt.minute >= 0)  # 非收盤時間
            )
            
            if is_trading_time:
                current_segment.append(row)
            else:
                if current_segment:
                    segments.append(pd.DataFrame(current_segment))
                    current_segment = []
        
        if current_segment:
            segments.append(pd.DataFrame(current_segment))
        
        return segments
    
    def _check_chunk(self, chunk: pd.DataFrame, expected_interval: timedelta, 
                    timeframe: str) -> Dict:
        """檢查數據塊（用於並行處理）"""
        gaps = []
        duplicates = []
        trading_gaps = []
        data_gaps = []
        processed = 0
        
        for i in range(1, len(chunk)):
            current_time = chunk.iloc[i]['DateTime']
            previous_time = chunk.iloc[i-1]['DateTime']
            actual_interval = current_time - previous_time
            
            if actual_interval == timedelta(0):
                duplicates.append(self._create_duplicate_info(i, current_time))
            elif actual_interval > expected_interval:
                gap_info = self._analyze_gap(
                    previous_time, current_time, actual_interval,
                    expected_interval, i, timeframe
                )
                if gap_info['is_normal_gap']:
                    trading_gaps.append(gap_info)
                else:
                    data_gaps.append(gap_info)
                    gaps.append(gap_info)
            
            processed += 1
        
        return {
            'gaps': gaps,
            'duplicates': duplicates,
            'trading_gaps': trading_gaps,
            'data_gaps': data_gaps,
            'processed': processed
        }
    
    def _generate_report(self, data: pd.DataFrame, gaps: List, duplicates: List,
                        trading_gaps: List, data_gaps: List, timeframe: str,
                        elapsed_time: float) -> Dict:
        """生成報告"""
        total_candles = len(data)
        total_data_gaps = len(data_gaps)
        total_trading_gaps = len(trading_gaps)
        total_missing_data = sum(gap.get('missing_candles', 0) for gap in data_gaps)
        total_duplicates = len(duplicates)
        
        expected_total = total_candles + total_missing_data
        continuity_percentage = (total_candles / expected_total * 100) if expected_total > 0 else 0
        
        # 性能統計
        candles_per_second = total_candles / elapsed_time if elapsed_time > 0 else 0
        
        return {
            'status': 'completed',
            'timeframe': timeframe,
            'optimization_mode': self.optimization_mode,
            'performance': {
                'elapsed_time': f"{elapsed_time:.2f}秒",
                'processing_speed': f"{candles_per_second:.0f} K線/秒",
                'total_processed': total_candles
            },
            'summary': {
                'total_candles': total_candles,
                'total_data_gaps': total_data_gaps,
                'total_trading_gaps': total_trading_gaps,
                'total_missing_data': total_missing_data,
                'total_duplicates': total_duplicates,
                'continuity_percentage': round(continuity_percentage, 2),
                'time_range': {
                    'start': str(data['DateTime'].min()),
                    'end': str(data['DateTime'].max())
                }
            },
            'data_gaps': data_gaps[:10],  # 只返回前10個以減少數據量
            'trading_gaps': trading_gaps[:10],
            'duplicates': duplicates[:10],
            'recommendations': self._generate_recommendations(data_gaps, duplicates, timeframe)
        }
    
    def _generate_recommendations(self, data_gaps: List, duplicates: List, timeframe: str) -> List[str]:
        """生成建議"""
        recommendations = []
        
        if data_gaps:
            total_missing = sum(gap.get('missing_candles', 0) for gap in data_gaps)
            recommendations.append(f"發現 {len(data_gaps)} 個數據缺失，共 {total_missing} 根K線")
            
            severe_gaps = [gap for gap in data_gaps if gap.get('missing_candles', 0) > 50]
            if severe_gaps:
                recommendations.append(f"有 {len(severe_gaps)} 個嚴重缺失（>50根K線）")
        
        if duplicates:
            recommendations.append(f"發現 {len(duplicates)} 個重複時間戳")
        
        if not data_gaps and not duplicates:
            recommendations.append("數據連續性良好")
        
        return recommendations


# 性能測試工具
def benchmark_continuity_checkers(df: pd.DataFrame, timeframe: str = 'M15'):
    """
    測試不同優化方案的性能
    """
    modes = ['basic', 'smart', 'parallel', 'vectorized', 'hybrid']
    results = {}
    
    print("\n" + "="*60)
    print("K線連續性檢查 - 性能基準測試")
    print("="*60)
    print(f"測試數據: {len(df)} 根K線, 時間框架: {timeframe}")
    print("-"*60)
    
    for mode in modes:
        print(f"\n測試模式: {mode.upper()}")
        print("-"*30)
        
        checker = CandleContinuityCheckerV2(
            optimization_mode=mode,
            show_progress=True
        )
        
        start = time.time()
        result = checker.check_continuity(df, timeframe)
        elapsed = time.time() - start
        
        results[mode] = {
            'elapsed': elapsed,
            'speed': len(df) / elapsed,
            'result': result
        }
        
        print(f"✓ 完成 - 用時: {elapsed:.2f}秒, 速度: {len(df)/elapsed:.0f} K線/秒")
    
    # 顯示比較結果
    print("\n" + "="*60)
    print("性能比較結果")
    print("="*60)
    
    # 按速度排序
    sorted_results = sorted(results.items(), key=lambda x: x[1]['speed'], reverse=True)
    
    print(f"{'模式':<15} {'用時':<10} {'速度(K線/秒)':<15} {'相對速度'}")
    print("-"*60)
    
    base_speed = results['basic']['speed']
    for mode, data in sorted_results:
        relative = data['speed'] / base_speed
        print(f"{mode:<15} {data['elapsed']:<10.2f} {data['speed']:<15.0f} {relative:.1f}x")
    
    print("\n推薦方案:")
    fastest = sorted_results[0]
    print(f"  最快: {fastest[0]} ({fastest[1]['speed']:.0f} K線/秒)")
    
    if len(df) < 10000:
        print(f"  小數據集(<10K): 建議使用 'smart' 模式（智能跳躍）")
    elif len(df) < 100000:
        print(f"  中數據集(10K-100K): 建議使用 'hybrid' 模式（混合優化）")
    else:
        print(f"  大數據集(>100K): 建議使用 'vectorized' 模式（向量化）")
    
    return results