# 檔名：data_processor.py

import pandas as pd
import os
import random
import logging
from datetime import datetime, date, timedelta
from typing import Dict, List, Optional, Tuple

from utils.config import DATA_DIR, CSV_FILES, DEFAULT_CANDLE_COUNT, LOG_DIR
from backend.time_utils import TimeConverter
from backend.fvg_detector import FVGDetector
from backend.fvg_detector_v3 import FVGDetectorV3
from backend.us_holidays import holiday_detector
from backend.candle_continuity_checker import CandleContinuityChecker

# 設定 logging
os.makedirs(LOG_DIR, exist_ok=True)
logging.basicConfig(
    filename=os.path.join(LOG_DIR, 'error.log'),
    level=logging.ERROR,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

class DataProcessor:
    def __init__(self):
        self.data_cache = {}  # {timeframe: DataFrame}
        self.time_converter = TimeConverter()
        self.available_dates = set()
        self.fvg_detector = FVGDetector()  # 舊版FVG檢測器
        self.fvg_detector_v3 = FVGDetectorV3()  # V3版FVG檢測器（簡化精準版）
        self.vwap_available = {}  # 追蹤各時間框架是否有 VWAP 資料
        self.continuity_checker = CandleContinuityChecker()  # K線連續性檢查器（從2019-05-20開始檢查）
        self.continuity_reports = {}  # 儲存連續性檢查報告
        
    def load_all_data(self):
        """載入所有時間刻度的資料到記憶體"""
        print("=" * 60)
        print("交易圖表系統 - 資料載入程序啟動")
        print("=" * 60)
        
        total_files = len(CSV_FILES)
        current_file = 0
        
        for timeframe, filename in CSV_FILES.items():
            current_file += 1
            filepath = os.path.join(DATA_DIR, filename)
            
            print(f"\n[{current_file}/{total_files}] 正在處理: {filename}")
            print(f"   路徑: {filepath}")
            
            if not os.path.exists(filepath):
                logging.error(f"檔案不存在: {filepath}")
                print(f"   檔案不存在！")
                continue
            
            # 檢查檔案大小
            file_size = os.path.getsize(filepath) / (1024 * 1024)  # MB
            print(f"   檔案大小: {file_size:.1f} MB")
            
            try:
                print(f"   正在讀取 CSV...")
                
                # 讀取 CSV 並顯示進度
                df = pd.read_csv(filepath)
                print(f"   CSV 讀取完成: {len(df):,} 筆原始記錄")
                
                # 動態檢查必要欄位（基於時間框架）
                base_columns = ['Date', 'Open', 'High', 'Low', 'Close', 'Volume']
                required_columns = base_columns.copy()
                
                # 對於分鐘級和小時級資料，需要 Time 欄位
                if timeframe in ['M1', 'M5', 'M15', 'H1', 'H4']:
                    required_columns.append('Time')
                
                missing_columns = [col for col in required_columns if col not in df.columns]
                if missing_columns:
                    raise ValueError(f"缺少必要欄位: {missing_columns}")
                
                # 檢查是否有 VWAP 欄位（可選）
                has_vwap = 'VWAP' in df.columns
                self.vwap_available[timeframe] = has_vwap
                
                print(f"   欄位驗證通過")
                if has_vwap:
                    print(f"   包含 VWAP 資料")
                else:
                    print(f"   不包含 VWAP 資料（將忽略）")
                
                # 資料清理與轉換
                print(f"   正在處理時間欄位...")
                
                if 'Time' in df.columns:
                    # 有 Time 欄位的情況（M1, M5, M15, H1, H4）
                    df['DateTime'] = pd.to_datetime(df['Date'] + ' ' + df['Time'], 
                                                  format='%m/%d/%Y %H:%M')
                else:
                    # 沒有 Time 欄位的情況（D1），假設為每日開盤時間
                    df['DateTime'] = pd.to_datetime(df['Date'], format='%m/%d/%Y')
                    
                df['Date_Only'] = df['DateTime'].dt.date
                
                # 排序
                print(f"   正在排序資料...")
                df = df.sort_values('DateTime').reset_index(drop=True)
                
                # 檢查資料範圍
                start_date = df['Date_Only'].min()
                end_date = df['Date_Only'].max()
                unique_dates = len(df['Date_Only'].unique())
                
                print(f"   時間範圍: {start_date} ~ {end_date}")
                print(f"   交易日數: {unique_dates:,} 天")
                
                # 儲存到快取
                self.data_cache[timeframe] = df
                
                # 收集可用日期
                dates = set(df['Date_Only'].unique())
                if not self.available_dates:
                    self.available_dates = dates
                    print(f"   初始化可用日期: {len(dates):,} 天")
                else:
                    old_count = len(self.available_dates)
                    self.available_dates &= dates  # 取交集
                    new_count = len(self.available_dates)
                    print(f"   更新可用日期: {old_count:,} -> {new_count:,} 天")
                
                # 記憶體使用估算
                memory_mb = df.memory_usage(deep=True).sum() / (1024 * 1024)
                print(f"   記憶體使用: {memory_mb:.1f} MB")
                print(f"   {timeframe} 時間刻度載入完成！")
                
            except Exception as e:
                logging.error(f"載入 {filepath} 失敗: {str(e)}")
                print(f"   載入失敗: {str(e)}")
                continue
        
        print("\n" + "=" * 60)
        if not self.available_dates:
            print("載入失敗：沒有找到任何可用的交易日期")
            raise ValueError("沒有找到任何可用的交易日期")
        
        # 統計資訊
        total_memory = sum(df.memory_usage(deep=True).sum() for df in self.data_cache.values()) / (1024 * 1024)
        total_records = sum(len(df) for df in self.data_cache.values())
        
        print(f"資料載入完成！")
        print(f"載入統計:")
        print(f"   時間刻度: {len(self.data_cache)} 種")
        print(f"   可用交易日: {len(self.available_dates):,} 天")
        print(f"   總記錄數: {total_records:,} 筆")
        print(f"   總記憶體: {total_memory:.1f} MB")
        
        # 顯示日期範圍
        min_date = min(self.available_dates)
        max_date = max(self.available_dates)
        print(f"   日期範圍: {min_date} ~ {max_date}")
        
        # 執行K線連續性檢查
        print(f"\n正在執行K線連續性檢查...")
        self.perform_continuity_check()
        
        print("=" * 60)
        print("系統準備就緒，等待用戶連線...")
        print()
    
    def get_random_date(self) -> date:
        """隨機選擇一個可用的交易日期"""
        if not self.available_dates:
            raise ValueError("沒有可用的交易日期")
        
        selected_date = random.choice(list(self.available_dates))
        print(f"隨機選擇日期: {selected_date}")
        return selected_date
    
    def detect_fvgs(self, df: pd.DataFrame, timeframe: str) -> List[Dict]:
        """
        檢測 FVG (使用V3檢測器)
        
        Args:
            df: DataFrame，包含 K 線資料
            timeframe: 時間刻度
            
        Returns:
            List[Dict]: FVG 列表
        """
        try:
            # 確保資料按時間排序
            df = df.sort_values('DateTime').reset_index(drop=True)
            
            # 為V3檢測器準備數據格式（需要time列而不是DateTime）
            df_v3 = df.copy()
            if 'DateTime' in df_v3.columns:
                df_v3['time'] = df_v3['DateTime'].astype('int64') // 10**9  # 轉換為Unix時間戳
            
            # 使用V3檢測器
            fvgs = self.fvg_detector_v3.detect_fvgs(df_v3)
            
            # 格式化為前端格式
            formatted_fvgs = self.fvg_detector_v3.format_fvgs_for_frontend(fvgs)
            
            print(f"   {timeframe} FVG V3檢測: 發現 {len(formatted_fvgs)} 個有效 FVG")
            
            return formatted_fvgs
            
        except Exception as e:
            logging.error(f"FVG 檢測失敗 ({timeframe}): {str(e)}")
            print(f"   FVG 檢測失敗: {str(e)}")
            return []
    
    def get_pre_market_data(self, target_date: date, timeframe: str = 'H4') -> Optional[Dict]:
        """
        取得指定日期開盤前的資料
        
        Args:
            target_date: 目標日期
            timeframe: 時間刻度 (M1, M5, M15, H1, H4, D1)
            
        Returns:
            Dict: 包含圖表資料和相關資訊
        """
        print(f"處理請求: {target_date} ({timeframe})")
        
        if timeframe not in self.data_cache:
            logging.error(f"時間刻度 {timeframe} 的資料未載入")
            print(f"時間刻度 {timeframe} 未載入")
            return None
        
        df = self.data_cache[timeframe]
        
        try:
            # 計算開盤前5分鐘的時間（台北時間）
            pre_market_time = self.time_converter.get_pre_market_time(target_date, timeframe)
            print(f"目標時間: {pre_market_time.strftime('%Y-%m-%d %H:%M:%S')} (台北時間)")
            
            # 取得開盤前5分鐘的所有資料（不限於當日）
            pre_market_data = df[df['DateTime'] <= pre_market_time.replace(tzinfo=None)].copy()
            
            if pre_market_data.empty:
                logging.error(f"日期 {target_date} 沒有開盤前資料")
                print(f"日期 {target_date} 沒有開盤前資料")
                return None
            
            print(f"總可用記錄: {len(pre_market_data)} 筆")
            
            # FVG檢測範圍：從開盤往回400根K線（圖表顯示範圍）
            detection_range_candles = 400
            
            # 如果資料不足，就取所有可用的
            actual_count = min(detection_range_candles, len(pre_market_data))
            result_data = pre_market_data.tail(actual_count)
            
            print(f"目標K線數: {detection_range_candles}，實際輸出: {len(result_data)} 根K線")
            
            # 檢測 FVG
            fvgs = self.detect_fvgs(result_data, timeframe)
            
            # 準備圖表資料格式
            chart_data = []
            for _, row in result_data.iterrows():
                data_point = {
                    'time': int(row['DateTime'].timestamp()),
                    'open': float(row['Open']),
                    'high': float(row['High']),
                    'low': float(row['Low']),
                    'close': float(row['Close']),
                    'volume': int(row['Volume'])
                }
                
                # 只有當該時間框架有 VWAP 資料時才包含
                if self.vwap_available.get(timeframe, False):
                    data_point['vwap'] = float(row['VWAP'])
                
                chart_data.append(data_point)
            
            # 計算紐約開盤時間資訊
            ny_open_taipei = self.time_converter.get_ny_market_open_taipei_time(target_date)
            is_dst = self.time_converter.is_dst_in_ny(target_date)
            
            print(f"資料處理完成")
            
            # 檢查假日狀態
            holiday_status = holiday_detector.get_trading_status(target_date)
            
            return {
                'date': target_date.strftime('%Y-%m-%d'),
                'timeframe': timeframe,
                'data': chart_data,
                'fvgs': fvgs,  # 新增 FVG 資料
                'pre_market_time': pre_market_time.strftime('%Y-%m-%d %H:%M:%S'),
                'ny_open_taipei': ny_open_taipei.strftime('%Y-%m-%d %H:%M:%S'),
                'is_dst': is_dst,
                'candle_count': len(chart_data),
                # 新增假日資訊
                'holiday_info': holiday_status,
                # 新增時區資訊
                'timezone_info': {
                    'is_dst': is_dst,
                    'ny_offset': -4 if is_dst else -5,
                    'taipei_offset': 8,
                    'ny_open_time': ny_open_taipei.strftime('%H:%M'),
                    'pre_market_time': pre_market_time.strftime('%H:%M')
                }
            }
            
        except Exception as e:
            logging.error(f"處理日期 {target_date} 資料時發生錯誤: {str(e)}")
            print(f"處理錯誤: {str(e)}")
            return None
    
    def get_market_hours_data(self, target_date: date, timeframe: str = 'H4') -> Optional[Dict]:
        """
        取得指定日期開盤後的完整資料（用於播放功能）
        
        Args:
            target_date: 目標日期
            timeframe: 時間刻度 (M1, M5, M15, H1, H4, D1)
            
        Returns:
            Dict: 包含完整交易日資料
        """
        print(f"處理播放資料請求: {target_date} ({timeframe})")
        
        if timeframe not in self.data_cache:
            logging.error(f"時間刻度 {timeframe} 的資料未載入")
            return None
        
        df = self.data_cache[timeframe]
        
        try:
            # 計算開盤時間（台北時間）
            ny_open = self.time_converter.get_ny_market_open_taipei_time(target_date)
            
            # 計算收盤時間（台北時間）- 紐約16:00
            ny_close_time = datetime.combine(target_date, datetime.min.time().replace(hour=16, minute=0))
            ny_close = self.time_converter.ny_tz.localize(ny_close_time)
            taipei_close = ny_close.astimezone(self.time_converter.taipei_tz)
            
            print(f"紐約開盤: {ny_open.strftime('%Y-%m-%d %H:%M')} (台北時間)")
            print(f"紐約收盤: {taipei_close.strftime('%Y-%m-%d %H:%M')} (台北時間)")
            
            # 取得開盤到收盤的所有資料（可能跨日）
            market_data = df[
                (df['DateTime'] >= ny_open.replace(tzinfo=None)) & 
                (df['DateTime'] <= taipei_close.replace(tzinfo=None))
            ].copy()
            
            if market_data.empty:
                # 如果沒有資料，嘗試放寬條件（只看日期部分）
                start_date = target_date
                end_date = target_date + timedelta(days=1)
                
                market_data = df[
                    (df['Date_Only'] >= start_date) & 
                    (df['Date_Only'] <= end_date)
                ].copy()
                
                # 再次篩選時間範圍
                if not market_data.empty:
                    market_data = market_data[
                        (market_data['DateTime'] >= ny_open.replace(tzinfo=None)) & 
                        (market_data['DateTime'] <= taipei_close.replace(tzinfo=None))
                    ]
            
            if market_data.empty:
                logging.error(f"日期 {target_date} 沒有交易資料")
                return None
            
            print(f"開盤後記錄: {len(market_data)} 筆")
            print(f"資料時間範圍: {market_data['DateTime'].min()} ~ {market_data['DateTime'].max()}")
            
            # 檢測 FVG
            fvgs = self.detect_fvgs(market_data, timeframe)
            
            # 準備圖表資料格式
            chart_data = []
            for _, row in market_data.iterrows():
                data_point = {
                    'time': int(row['DateTime'].timestamp()),
                    'open': float(row['Open']),
                    'high': float(row['High']),
                    'low': float(row['Low']),
                    'close': float(row['Close']),
                    'volume': int(row['Volume'])
                }
                
                # 只有當該時間框架有 VWAP 資料時才包含
                if self.vwap_available.get(timeframe, False):
                    data_point['vwap'] = float(row['VWAP'])
                
                chart_data.append(data_point)
            
            # 計算紐約開盤時間資訊
            is_dst = self.time_converter.is_dst_in_ny(target_date)
            
            # 檢查假日狀態
            holiday_status = holiday_detector.get_trading_status(target_date)
            
            return {
                'date': target_date.strftime('%Y-%m-%d'),
                'timeframe': timeframe,
                'data': chart_data,
                'fvgs': fvgs,  # 新增 FVG 資料
                'ny_open_taipei': ny_open.strftime('%Y-%m-%d %H:%M:%S'),
                'ny_close_taipei': taipei_close.strftime('%Y-%m-%d %H:%M:%S'),
                'is_dst': is_dst,
                'candle_count': len(chart_data),
                # 新增假日資訊
                'holiday_info': holiday_status
            }
            
        except Exception as e:
            logging.error(f"處理播放資料時發生錯誤: {str(e)}")
            print(f"錯誤詳情: {str(e)}")
            import traceback
            traceback.print_exc()
            return None

    def get_available_timeframes(self) -> List[str]:
        """取得可用的時間刻度"""
        return list(self.data_cache.keys())
    
    def perform_continuity_check(self):
        """對所有時間框架執行K線連續性檢查"""
        print("   連續性檢查:")
        
        for timeframe in self.data_cache.keys():
            try:
                df = self.data_cache[timeframe]
                status = self.continuity_checker.quick_check(df, timeframe)
                
                # 詳細檢查
                result = self.continuity_checker.check_continuity(df, timeframe)
                self.continuity_reports[timeframe] = result
                
                if result['status'] == 'completed':
                    summary = result['summary']
                    continuity_pct = summary['continuity_percentage']
                    data_gaps = summary.get('total_data_gaps', summary.get('total_gaps', 0))
                    missing_data = summary.get('total_missing_data', summary.get('total_missing_candles', 0))
                    trading_gaps = summary.get('total_trading_gaps', 0)
                    
                    status_icon = "[OK]" if missing_data == 0 else "[WARN]" if missing_data < 100 else "[ERROR]"
                    
                    print(f"   {timeframe:>3}: {status_icon} {continuity_pct:6.1f}% 連續性 "
                          f"(數據缺失: {missing_data:,} 根K線)")
                    
                    # 顯示正常停盤和真實缺失的分佈
                    if trading_gaps > 0:
                        print(f"        └─ 正常停盤: {trading_gaps} 個間隙")
                    if data_gaps > 0:
                        print(f"        └─ 數據缺失: {data_gaps} 個間隙")
                    
                    # 如果有嚴重問題，顯示詳細資訊
                    if missing_data > 1000:
                        print(f"        └─ 建議檢查數據質量")
                
            except Exception as e:
                print(f"   {timeframe:>3}: [ERROR] 檢查失敗 - {str(e)}")
                logging.error(f"連續性檢查失敗 [{timeframe}]: {str(e)}")
    
    def get_continuity_report(self, timeframe: str) -> Optional[Dict]:
        """取得特定時間框架的連續性報告"""
        return self.continuity_reports.get(timeframe)
    
    def check_date_continuity(self, target_date: date, timeframe: str) -> Dict:
        """檢查特定日期的K線連續性"""
        if timeframe not in self.data_cache:
            raise ValueError(f"不支援的時間框架: {timeframe}")
        
        df = self.data_cache[timeframe]
        date_str = target_date.strftime('%Y-%m-%d')
        
        return self.continuity_checker.check_continuity(df, timeframe, date_str)
    
    def get_continuity_summary(self) -> Dict:
        """取得所有時間框架的連續性摘要"""
        summary = {}
        
        for timeframe, report in self.continuity_reports.items():
            if report and report['status'] == 'completed':
                summary[timeframe] = {
                    'continuity_percentage': report['summary']['continuity_percentage'],
                    'total_gaps': report['summary']['total_gaps'],
                    'missing_candles': report['summary']['total_missing_candles'],
                    'status': self.continuity_checker.quick_check(self.data_cache[timeframe], timeframe)
                }
            else:
                summary[timeframe] = {'status': 'error'}
        
        return summary