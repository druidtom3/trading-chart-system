# 檔名：candle_continuity_checker.py - K線連續性檢查工具

import pandas as pd
from datetime import datetime, timedelta, date
from typing import Dict, List, Optional, Tuple
import logging
import pytz
from .trading_hours import TradingHoursDetector

class CandleContinuityChecker:
    """
    K線連續性檢查器
    用於檢測K線數據中的時間間隔異常和缺失K線
    """
    
    def __init__(self, start_date: Optional[date] = None):
        # 各時間框架的預期間隔（分鐘）
        self.timeframe_intervals = {
            'M1': 1,      # 1分鐘
            'M5': 5,      # 5分鐘
            'M15': 15,    # 15分鐘
            'H1': 60,     # 1小時
            'H4': 240,    # 4小時
            'D1': 1440    # 1天（24小時）
        }
        
        # 數據分析起始日期（排除早期不穩定數據）
        self.start_date = start_date or date(2019, 5, 20)
        
        # 交易時間檢測器
        self.trading_detector = TradingHoursDetector()
    
    def check_continuity(self, df: pd.DataFrame, timeframe: str, date_filter: Optional[str] = None) -> Dict:
        """
        檢查K線數據的連續性
        
        Args:
            df: K線數據DataFrame，必須包含DateTime欄位
            timeframe: 時間框架 (M1, M5, M15, H1, H4, D1)
            date_filter: 可選的日期過濾 ('YYYY-MM-DD')
            
        Returns:
            Dict: 包含檢查結果的字典
        """
        if timeframe not in self.timeframe_intervals:
            raise ValueError(f"不支援的時間框架: {timeframe}")
        
        if 'DateTime' not in df.columns:
            raise ValueError("DataFrame必須包含DateTime欄位")
        
        # 複製並排序數據
        data = df.copy()
        data = data.sort_values('DateTime').reset_index(drop=True)
        
        # 過濾早期不穩定數據
        data = data[data['DateTime'].dt.date >= self.start_date].copy()
        
        # 日期過濾
        if date_filter:
            target_date = pd.to_datetime(date_filter).date()
            data = data[data['DateTime'].dt.date == target_date].copy()
        
        if len(data) < 2:
            return {
                'status': 'insufficient_data',
                'message': '數據不足，無法進行連續性檢查',
                'total_candles': len(data)
            }
        
        expected_interval = timedelta(minutes=self.timeframe_intervals[timeframe])
        
        # 檢查時間間隔
        gaps = []
        duplicates = []
        trading_gaps = []  # 正常交易停盤
        data_gaps = []     # 真正的數據缺失
        
        for i in range(1, len(data)):
            current_time = data.iloc[i]['DateTime']
            previous_time = data.iloc[i-1]['DateTime']
            
            actual_interval = current_time - previous_time
            
            # 檢查重複時間
            if actual_interval == timedelta(0):
                duplicates.append({
                    'index': i,
                    'time': current_time,
                    'previous_index': i-1
                })
            
            # 檢查間隔異常（超過預期間隔）
            elif actual_interval > expected_interval:
                # 計算缺失的K線數量（基於實際交易時間）
                expected_candles = self.trading_detector.get_expected_trading_candles(
                    previous_time, current_time, self.timeframe_intervals[timeframe]
                )
                missing_count = expected_candles - 1  # 減去1因為不包括起點
                
                # 判斷是否為正常停盤
                is_normal_gap = self.trading_detector.should_ignore_gap(previous_time, current_time)
                gap_reason = self.trading_detector.get_trading_gap_reason(previous_time, current_time)
                
                gap_info = {
                    'start_time': previous_time,
                    'end_time': current_time,
                    'actual_interval': str(actual_interval),
                    'expected_interval': str(expected_interval),
                    'missing_candles': missing_count,
                    'gap_minutes': actual_interval.total_seconds() / 60,
                    'start_index': i-1,
                    'end_index': i,
                    'is_normal_gap': is_normal_gap,
                    'reason': gap_reason
                }
                
                if is_normal_gap:
                    trading_gaps.append(gap_info)
                else:
                    data_gaps.append(gap_info)
                    gaps.append(gap_info)  # 保持原有接口兼容性
        
        # 生成連續性報告
        total_candles = len(data)
        total_data_gaps = len(data_gaps)
        total_trading_gaps = len(trading_gaps)
        total_missing_data = sum(gap['missing_candles'] for gap in data_gaps)
        total_missing_trading = sum(gap['missing_candles'] for gap in trading_gaps)
        total_duplicates = len(duplicates)
        
        # 計算真實連續性百分比（只考慮數據缺失，不考慮正常停盤）
        expected_total = total_candles + total_missing_data
        continuity_percentage = (total_candles / expected_total * 100) if expected_total > 0 else 0
        
        return {
            'status': 'completed',
            'timeframe': timeframe,
            'date_filter': date_filter,
            'start_date_filter': str(self.start_date),
            'summary': {
                'total_candles': total_candles,
                'total_data_gaps': total_data_gaps,
                'total_trading_gaps': total_trading_gaps,
                'total_missing_data': total_missing_data,
                'total_missing_trading': total_missing_trading,
                'total_duplicates': total_duplicates,
                'continuity_percentage': round(continuity_percentage, 2),
                'time_range': {
                    'start': str(data['DateTime'].min()),
                    'end': str(data['DateTime'].max())
                }
            },
            'data_gaps': data_gaps,
            'trading_gaps': trading_gaps,
            'gaps': gaps,  # 保持兼容性
            'duplicates': duplicates,
            'recommendations': self._generate_smart_recommendations(data_gaps, trading_gaps, duplicates, timeframe)
        }
    
    def _generate_recommendations(self, gaps: List, duplicates: List, timeframe: str) -> List[str]:
        """生成修復建議"""
        recommendations = []
        
        if gaps:
            recommendations.append(f"發現 {len(gaps)} 個時間間隔，總共缺失 {sum(gap['missing_candles'] for gap in gaps)} 根K線")
            
            # 分析間隔模式
            large_gaps = [gap for gap in gaps if gap['missing_candles'] > 10]
            if large_gaps:
                recommendations.append(f"有 {len(large_gaps)} 個大型間隔（>10根K線），可能是交易暫停或數據收集問題")
            
            # 針對不同時間框架的建議
            if timeframe in ['M1', 'M5']:
                recommendations.append("分鐘級數據缺失可能影響短期分析，建議檢查數據來源")
            elif timeframe in ['H1', 'H4']:
                recommendations.append("小時級數據缺失可能是正常的市場關閉時間")
        
        if duplicates:
            recommendations.append(f"發現 {len(duplicates)} 個重複時間戳，建議去重處理")
        
        if not gaps and not duplicates:
            recommendations.append("K線數據連續性良好，無需修復")
        
        return recommendations
    
    def _generate_smart_recommendations(self, data_gaps: List, trading_gaps: List, 
                                      duplicates: List, timeframe: str) -> List[str]:
        """生成智能修復建議（區分正常停盤和數據缺失）"""
        recommendations = []
        
        if data_gaps:
            total_missing = sum(gap['missing_candles'] for gap in data_gaps)
            recommendations.append(f"發現 {len(data_gaps)} 個真實數據缺失，總共缺失 {total_missing} 根K線")
            
            # 分析缺失原因
            severe_gaps = [gap for gap in data_gaps if gap['missing_candles'] > 50]
            if severe_gaps:
                recommendations.append(f"有 {len(severe_gaps)} 個嚴重缺失（>50根K線），建議檢查數據提供商")
                
            # 顯示前3個最嚴重的缺失
            if data_gaps:
                sorted_gaps = sorted(data_gaps, key=lambda x: x['missing_candles'], reverse=True)[:3]
                recommendations.append("最嚴重的數據缺失:")
                for i, gap in enumerate(sorted_gaps):
                    recommendations.append(f"  {i+1}. {gap['start_time']} ~ {gap['end_time']} ({gap['reason']})")
        
        if trading_gaps:
            total_trading_missing = sum(gap['missing_candles'] for gap in trading_gaps)
            recommendations.append(f"正常停盤時間: {len(trading_gaps)} 個間隙，{total_trading_missing} 根K線（這是正常的）")
            
            # 統計停盤原因
            reasons = {}
            for gap in trading_gaps:
                reason = gap['reason'].split(':')[0] if ':' in gap['reason'] else gap['reason']
                reasons[reason] = reasons.get(reason, 0) + 1
            
            if reasons:
                recommendations.append("停盤原因分佈: " + ", ".join([f"{k}({v}次)" for k, v in reasons.items()]))
        
        if duplicates:
            recommendations.append(f"發現 {len(duplicates)} 個重複時間戳，建議去重處理")
        
        if not data_gaps and not duplicates:
            if trading_gaps:
                recommendations.append("除了正常停盤時間外，K線數據連續性良好")
            else:
                recommendations.append("K線數據連續性完美，無任何問題")
        
        return recommendations
    
    def generate_missing_candles(self, df: pd.DataFrame, timeframe: str, 
                                fill_method: str = 'forward') -> pd.DataFrame:
        """
        生成缺失的K線（用前一根K線的收盤價填充）
        
        Args:
            df: 原始K線數據
            timeframe: 時間框架
            fill_method: 填充方法 ('forward', 'interpolate', 'zero_volume')
            
        Returns:
            補全後的DataFrame
        """
        if timeframe not in self.timeframe_intervals:
            raise ValueError(f"不支援的時間框架: {timeframe}")
        
        data = df.copy().sort_values('DateTime').reset_index(drop=True)
        expected_interval = timedelta(minutes=self.timeframe_intervals[timeframe])
        
        # 創建完整的時間序列
        start_time = data['DateTime'].min()
        end_time = data['DateTime'].max()
        
        # 生成完整的時間範圍
        full_time_range = pd.date_range(start=start_time, end=end_time, 
                                       freq=f'{self.timeframe_intervals[timeframe]}min')
        
        # 創建完整的DataFrame框架
        full_df = pd.DataFrame({'DateTime': full_time_range})
        
        # 合併原始數據
        result = pd.merge(full_df, data, on='DateTime', how='left')
        
        # 填充缺失值
        if fill_method == 'forward':
            # 前向填充：用前一根K線的收盤價作為OHLC
            result['Open'] = result['Open'].ffill()
            result['High'] = result['High'].ffill()
            result['Low'] = result['Low'].ffill()
            result['Close'] = result['Close'].ffill()
            result['Volume'] = result['Volume'].fillna(0)  # 缺失時間的成交量設為0
            
        elif fill_method == 'zero_volume':
            # 用前一根收盤價，但成交量為0
            close_price = result['Close'].ffill()
            result['Open'] = result['Open'].fillna(close_price)
            result['High'] = result['High'].fillna(close_price)
            result['Low'] = result['Low'].fillna(close_price)
            result['Close'] = result['Close'].fillna(close_price)
            result['Volume'] = result['Volume'].fillna(0)
        
        # 添加標記欄位，標示哪些是補全的K線
        result['is_filled'] = result['Open'].isna()
        
        return result
    
    def quick_check(self, df: pd.DataFrame, timeframe: str) -> str:
        """
        快速檢查，返回簡單的狀態信息
        
        Returns:
            字符串狀態：'perfect', 'minor_gaps', 'major_gaps', 'duplicates', 'error'
        """
        try:
            result = self.check_continuity(df, timeframe)
            
            if result['status'] != 'completed':
                return 'error'
            
            summary = result['summary']
            
            if summary['total_duplicates'] > 0:
                return 'duplicates'
            elif summary['total_missing_candles'] == 0:
                return 'perfect'
            elif summary['total_missing_candles'] <= 5:
                return 'minor_gaps'
            else:
                return 'major_gaps'
                
        except Exception as e:
            logging.error(f"K線連續性快速檢查失敗: {str(e)}")
            return 'error'
    
    def get_gap_summary_by_date(self, df: pd.DataFrame, timeframe: str) -> Dict:
        """
        按日期統計間隙情況
        
        Returns:
            按日期分組的間隙統計
        """
        data = df.copy()
        data['Date'] = data['DateTime'].dt.date
        
        daily_summary = {}
        
        for date in data['Date'].unique():
            daily_data = data[data['Date'] == date]
            check_result = self.check_continuity(daily_data, timeframe)
            
            if check_result['status'] == 'completed':
                daily_summary[str(date)] = {
                    'candles': check_result['summary']['total_candles'],
                    'gaps': check_result['summary']['total_gaps'],
                    'missing': check_result['summary']['total_missing_candles'],
                    'continuity': check_result['summary']['continuity_percentage']
                }
        
        return daily_summary