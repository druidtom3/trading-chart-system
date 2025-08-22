# 檔名：data_processor.py

import pandas as pd
import numpy as np
import os
import random
import logging
from datetime import datetime, date, timedelta
from typing import Dict, List, Optional, Tuple, Any

from utils.config import (DATA_DIR, CSV_FILES, LOG_DIR, RANDOM_DATE_CONFIG,
                          FVG_CLEARING_WINDOW, CACHE_MAX_SIZE, 
                          MAX_RECORDS_LIMIT, MEMORY_OPTIMIZATION_THRESHOLD, 
                          FULL_DATA_LOADING, ANALYSIS_CANDLE_COUNT)
from utils.time_utils import datetime_to_timestamp, validate_timestamp
try:
    from utils.loading_config import LOADING_CONFIG, OPTIMIZED_DTYPES, MEMORY_CONFIG, FVG_PERFORMANCE_CONFIG
    USE_PERFORMANCE_OPTIMIZATION = True
except ImportError:
    USE_PERFORMANCE_OPTIMIZATION = False
    LOADING_CONFIG = {"use_vectorization": False, "enable_caching": False}
    OPTIMIZED_DTYPES = {}
    print("注意: 性能優化配置不可用，使用默認設置")
from backend.time_utils import TimeConverter
from backend.fvg_detector_simple import FVGDetectorSimple
from backend.us_holidays import holiday_detector
from backend.candle_continuity_checker_v2 import CandleContinuityCheckerV2

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
        self.fvg_detector_simple = FVGDetectorSimple(clearing_window=FVG_CLEARING_WINDOW)  # 簡化版本（無複雜時間轉換）
        self.vwap_available = {}  # 追蹤各時間框架是否有 VWAP 資料
        
        # 簡化緩存系統 - 只保留基本數據緩存
        self._cache_max_size = CACHE_MAX_SIZE  # 緩存最大條目數
        self._preload_days = 7  # 減少預載入天數 (從30降到7天)
        
        # 統一使用V2連續性檢查器，移除選擇邏輯
        print("使用V2優化連續性檢查器 (統一配置)")
        self.continuity_checker = CandleContinuityCheckerV2(
            optimization_mode='smart',  # 固定使用smart模式
            show_progress=False         # 後端不需要進度條
        )
            
        self.continuity_reports = {}  # 儲存連續性檢查報告
        
    def set_loading_callback(self, callback_func):
        """設置載入狀態回調函數"""
        self.loading_callback = callback_func
    
    def _convert_to_json_serializable(self, obj: Any) -> Any:
        """
        將包含numpy數據類型的對象轉換為JSON可序列化的格式
        
        Args:
            obj: 要轉換的對象
            
        Returns:
            JSON可序列化的對象
        """
        if isinstance(obj, np.integer):
            return int(obj)
        elif isinstance(obj, np.floating):
            return float(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        elif isinstance(obj, dict):
            return {k: self._convert_to_json_serializable(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self._convert_to_json_serializable(v) for v in obj]
        elif isinstance(obj, tuple):
            return tuple(self._convert_to_json_serializable(v) for v in obj)
        elif hasattr(obj, '__dict__'):  # 處理自定義對象
            return {k: self._convert_to_json_serializable(v) for k, v in obj.__dict__.items()}
        else:
            return obj
        
    def _update_loading_status(self, **kwargs):
        """更新載入狀態"""
        if hasattr(self, 'loading_callback') and self.loading_callback:
            self.loading_callback(**kwargs)
    
    def scan_date_ranges_only(self):
        """智能掃描：僅讀取時間欄位以獲得日期範圍，不載入完整資料"""
        import datetime
        start_time = datetime.datetime.now()
        
        print("=" * 60)
        print("交易圖表系統 - 智能掃描模式啟動")
        print("=" * 60)
        print("階段1: 快速掃描所有時間刻度的日期範圍...")
        
        date_ranges = {}
        total_files = len(CSV_FILES)
        current_file = 0
        
        for timeframe, filename in CSV_FILES.items():
            current_file += 1
            filepath = os.path.join(DATA_DIR, filename)
            
            print(f"\n[{current_file}/{total_files}] 掃描: {filename}")
            print(f"   路徑: {filepath}")
            
            try:
                # 只讀取前幾行來判斷格式
                sample_df = pd.read_csv(filepath, nrows=5)
                
                if 'Time' in sample_df.columns:
                    # M1, M5, M15, H1, H4 格式 - 使用超快速採樣策略
                    print(f"   使用採樣策略掃描大文件...")
                    
                    # 讀取頭部和尾部來獲得日期範圍
                    head_df = pd.read_csv(filepath, usecols=['Date', 'Time'], nrows=1000)
                    
                    # 使用文件大小快速估算行數（避免讀取整個文件）
                    import os
                    file_size = os.path.getsize(filepath)
                    estimated_lines = max(1000, file_size // 100)  # 粗略估算：每行約100字節
                    
                    # 讀取尾部
                    tail_df = pd.read_csv(filepath, usecols=['Date', 'Time'], 
                                        skiprows=range(1, max(1, estimated_lines - 1000)), 
                                        header=0)
                    
                    # 合併頭尾資料
                    df_dates = pd.concat([head_df, tail_df], ignore_index=True)
                    df_dates['DateTime'] = pd.to_datetime(df_dates['Date'] + ' ' + df_dates['Time'], 
                                                        format='%m/%d/%Y %H:%M')
                    
                    print(f"   採樣方式：頭部1000行 + 尾部1000行，估算文件約{estimated_lines:,}行")
                else:
                    # D1 格式 - 文件較小，直接讀取
                    df_dates = pd.read_csv(filepath, usecols=['Date'])
                    df_dates['DateTime'] = pd.to_datetime(df_dates['Date'], format='%m/%d/%Y')
                    estimated_lines = len(df_dates)
                
                df_dates['Date_Only'] = df_dates['DateTime'].dt.date
                
                # 獲取日期範圍（使用採樣數據估算）
                start_date = df_dates['Date_Only'].min()
                end_date = df_dates['Date_Only'].max()
                
                # 對於採樣的數據，估算完整的日期集合
                if 'Time' in sample_df.columns:
                    # 估算：從開始到結束日期之間的所有交易日
                    from datetime import timedelta
                    estimated_dates = set()
                    current_date = start_date
                    while current_date <= end_date:
                        # 假設週一到週五都是交易日（簡化估算）
                        if current_date.weekday() < 5:
                            estimated_dates.add(current_date)
                        current_date += timedelta(days=1)
                    unique_dates = estimated_dates
                    print(f"   使用估算策略：{len(unique_dates):,} 個估算交易日")
                else:
                    # D1 數據直接使用真實日期
                    unique_dates = set(df_dates['Date_Only'].unique())
                
                total_records = estimated_lines
                
                date_ranges[timeframe] = {
                    'start_date': start_date,
                    'end_date': end_date,
                    'unique_dates': unique_dates,
                    'total_records': total_records
                }
                
                print(f"   時間範圍: {start_date} ~ {end_date}")
                print(f"   交易日數: {len(unique_dates):,} 天")
                print(f"   總記錄數: {total_records:,} 筆")
                print(f"   {timeframe} 掃描完成！")
                
            except Exception as e:
                print(f"   掃描失敗: {str(e)}")
                continue
        
        # 計算所有時間刻度的交集
        print("\n階段2: 計算日期交集...")
        if date_ranges:
            all_dates = list(date_ranges.values())
            intersection_dates = all_dates[0]['unique_dates']
            
            for i, timeframe in enumerate(CSV_FILES.keys()):
                if timeframe in date_ranges:
                    dates = date_ranges[timeframe]['unique_dates']
                    old_count = len(intersection_dates)
                    intersection_dates &= dates
                    new_count = len(intersection_dates)
                    print(f"   {timeframe}: {old_count:,} -> {new_count:,} 天 (交集)")
            
            # 儲存結果
            self.available_dates = intersection_dates
            self.date_ranges = date_ranges
            
            # 顯示最終結果
            min_date = min(intersection_dates)
            max_date = max(intersection_dates)
            elapsed = datetime.datetime.now() - start_time
            
            print("\n" + "=" * 60)
            print("智能掃描完成！")
            print(f"掃描統計:")
            print(f"   時間刻度: {len(date_ranges)} 種")
            print(f"   可用交集日期: {len(intersection_dates):,} 天")
            print(f"   日期範圍: {min_date} ~ {max_date}")
            print(f"   掃描時間: {elapsed.total_seconds():.2f} 秒")
            print("=" * 60)
            
            return True
        else:
            print("掃描失敗：沒有找到任何可用的日期範圍")
            return False

    def load_all_data(self):
        """載入所有時間刻度的資料到記憶體"""
        import datetime
        start_time = datetime.datetime.now()
        
        print("=" * 60)
        print("交易圖表系統 - 資料載入程序啟動")
        print("=" * 60)
        
        total_files = len(CSV_FILES)
        current_file = 0
        
        # 初始化載入狀態
        self._update_loading_status(
            is_loading=True,
            progress=0,
            current_step='開始載入資料...',
            total_steps=total_files,
            completed_steps=0,
            start_time=start_time
        )
        
        for timeframe, filename in CSV_FILES.items():
            current_file += 1
            filepath = os.path.join(DATA_DIR, filename)
            
            # 統一載入模式
            loading_mode = "標準載入"
            
            # 更新載入狀態
            progress = (current_file - 1) / total_files * 100
            self._update_loading_status(
                progress=progress,
                current_step=f'正在載入 {timeframe} 時間框架資料...',
                current_file=filename,
                current_file_progress=0,
                completed_steps=current_file - 1,
                details=[f"處理檔案: {filename}", f"載入模式: {loading_mode}"]
            )
            
            print(f"\n[{current_file}/{total_files}] 正在處理: {filename}")
            print(f"   路徑: {filepath}")
            print(f"   載入模式: {loading_mode}")
            
            if not os.path.exists(filepath):
                logging.error(f"檔案不存在: {filepath}")
                print(f"   檔案不存在！")
                continue
            
            # 檢查檔案大小
            file_size = os.path.getsize(filepath) / (1024 * 1024)  # MB
            print(f"   檔案大小: {file_size:.1f} MB")
            
            try:
                print(f"   正在讀取 CSV...")
                
                # 統一載入策略：讀取數據並應用K線限制
                df = pd.read_csv(filepath)
                original_count = len(df)
                
                # 新邏輯：載入大量資料用於交集計算，但不是全部（避免記憶體問題）
                from utils.config import FULL_DATA_LOADING
                
                # 根據時間框架識別
                timeframe_key = None
                for tf in ['M1', 'M5', 'M15', 'H1', 'H4', 'D1']:
                    if tf in filepath:
                        timeframe_key = tf
                        break
                
                if timeframe_key:
                    data_limit = FULL_DATA_LOADING.get(timeframe_key, 10000)
                    if data_limit == -1:
                        # 載入全部
                        print(f"   [{timeframe_key}完整] 載入全部 {len(df):,} 筆記錄")
                    elif len(df) > data_limit:
                        # 載入最後N筆記錄
                        df = df.tail(data_limit)
                        print(f"   [{timeframe_key}大量] 從 {original_count:,} 筆中載入最後 {len(df):,} 筆記錄")
                    else:
                        print(f"   [{timeframe_key}全量] 載入全部 {len(df):,} 筆記錄")
                else:
                    print(f"   載入全部 {len(df):,} 筆記錄")
                
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
                
                # 應用固定起始日期配置
                if RANDOM_DATE_CONFIG['start_date']:
                    from datetime import datetime as dt
                    fixed_start_date = dt.strptime(RANDOM_DATE_CONFIG['start_date'], '%Y-%m-%d').date()
                    dates = {d for d in dates if d >= fixed_start_date}
                    print(f"   應用固定起始日期 {fixed_start_date}: 過濾後 {len(dates):,} 天")
                
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
                
                # 更新載入進度
                progress = current_file / total_files * 100
                self._update_loading_status(
                    progress=progress,
                    current_step=f'{timeframe} 載入完成',
                    completed_steps=current_file,
                    details=[f"載入完成: {filename}", f"記錄數: {len(df):,} 筆", f"記憶體: {memory_mb:.1f} MB"]
                )
                
            except Exception as e:
                logging.error(f"載入 {filepath} 失敗: {str(e)}")
                print(f"   載入失敗: {str(e)}")
                # 更新錯誤狀態
                self._update_loading_status(
                    current_step=f'{timeframe} 載入失敗: {str(e)}',
                    details=[f"錯誤: {filename}", f"原因: {str(e)}"]
                )
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
        print(f"\n[INFO] 執行K線連續性檢查...")
        self.perform_continuity_check()
        
        # 新增：預載入常用數據以提升響應速度
        print(f"\n正在預載入常用數據...")
        self._preload_common_data()
        
        print("=" * 60)
        print("系統準備就緒，等待用戶連線...")
        print()
    
    def check_data_range_consistency(self) -> Dict:
        """檢查各時間刻度資料範圍的一致性
        
        Returns:
            Dict: 包含詳細的一致性檢查報告
        """
        print("=== 檢查各時間刻度資料範圍一致性 ===")
        
        timeframe_info = {}
        all_timeframes = ['D1', 'H4', 'H1', 'M15', 'M5', 'M1']
        loaded_timeframes = []
        
        # 1. 檢查各時間刻度載入狀態和日期範圍
        for tf in all_timeframes:
            if tf in self.data_cache and not self.data_cache[tf].empty:
                df = self.data_cache[tf]
                dates = set(df['Date_Only'].unique())
                dates_list = sorted(list(dates))
                
                timeframe_info[tf] = {
                    'loaded': True,
                    'dates': dates,
                    'date_count': len(dates),
                    'min_date': dates_list[0],
                    'max_date': dates_list[-1],
                    'data_rows': len(df)
                }
                loaded_timeframes.append(tf)
                print(f"{tf}: {dates_list[0]} ~ {dates_list[-1]} ({len(dates)}天, {len(df)}筆資料)")
            else:
                timeframe_info[tf] = {
                    'loaded': False,
                    'dates': set(),
                    'date_count': 0,
                    'min_date': None,
                    'max_date': None,
                    'data_rows': 0
                }
                print(f"{tf}: 未載入")
        
        if not loaded_timeframes:
            print("[ERROR] 錯誤：沒有任何時間刻度載入成功")
            return {'error': 'no_data_loaded', 'timeframe_info': timeframe_info}
        
        # 2. 計算所有載入時間刻度的日期交集
        print("\n--- 計算日期交集 ---")
        intersection_dates = timeframe_info[loaded_timeframes[0]]['dates'].copy()
        
        for tf in loaded_timeframes[1:]:
            old_count = len(intersection_dates)
            intersection_dates &= timeframe_info[tf]['dates']
            new_count = len(intersection_dates)
            print(f"與 {tf} 交集後：{old_count} -> {new_count} 天")
        
        intersection_list = sorted(list(intersection_dates))
        
        # 3. 應用配置過濾
        filtered_dates = intersection_dates.copy()
        if RANDOM_DATE_CONFIG['start_date']:
            from datetime import datetime as dt
            fixed_start_date = dt.strptime(RANDOM_DATE_CONFIG['start_date'], '%Y-%m-%d').date()
            filtered_dates = {d for d in filtered_dates if d >= fixed_start_date}
            print(f"應用固定起始日期 {fixed_start_date}：{len(intersection_dates)} -> {len(filtered_dates)} 天")
        
        # 4. 檢查各時間刻度缺失的日期
        print("\n--- 各時間刻度缺失日期分析 ---")
        for tf in loaded_timeframes:
            missing_dates = intersection_dates - timeframe_info[tf]['dates']
            if missing_dates:
                missing_list = sorted(list(missing_dates))[:5]  # 只顯示前5個
                print(f"{tf} 缺失日期：{len(missing_dates)}天 (例如: {missing_list})")
            else:
                print(f"{tf} [PASS] 完整包含所有交集日期")
        
        # 5. 生成報告
        final_filtered_list = sorted(list(filtered_dates))
        
        report = {
            'timeframe_info': timeframe_info,
            'loaded_timeframes': loaded_timeframes,
            'intersection_dates': intersection_list,
            'filtered_dates': final_filtered_list,
            'intersection_count': len(intersection_list),
            'filtered_count': len(final_filtered_list),
            'consistency_issues': []
        }
        
        # 6. 檢查一致性問題
        if len(final_filtered_list) == 0:
            report['consistency_issues'].append('交集為空：沒有任何日期在所有時間刻度中都存在')
        elif len(final_filtered_list) < 10:
            report['consistency_issues'].append(f'交集過小：只有 {len(final_filtered_list)} 天可用')
        
        for tf in loaded_timeframes:
            missing_count = len(intersection_dates - timeframe_info[tf]['dates'])
            if missing_count > 0:
                report['consistency_issues'].append(f'{tf} 缺失 {missing_count} 天的交集日期')
        
        print(f"\n=== 檢查結果 ===")
        print(f"載入的時間刻度：{len(loaded_timeframes)}/{len(all_timeframes)}")
        print(f"原始交集：{len(intersection_list)} 天")
        print(f"配置過濾後：{len(final_filtered_list)} 天")
        if final_filtered_list:
            print(f"可用範圍：{final_filtered_list[0]} ~ {final_filtered_list[-1]}")
        
        if report['consistency_issues']:
            print("[WARN] 發現一致性問題：")
            for issue in report['consistency_issues']:
                print(f"   - {issue}")
        else:
            print("[PASS] 資料範圍一致性良好")
        
        return report

    def get_random_date(self) -> date:
        """從所有時間刻度的日期交集中隨機選擇一個交易日期
        
        新邏輯：
        1. 載入完整歷史資料
        2. 計算所有時間刻度的日期交集
        3. 顯示交集範圍給使用者
        4. 從交集中隨機選擇一個日期
        5. 之後再從該日期往前取400根K線
        """
        import random
        
        print("\n[INFO] Random date selection starting...")
        
        # 直接使用已載入的可用日期 (跳過詳細一致性檢查)
        if not self.available_dates:
            raise ValueError("No available dates loaded")
        
        filtered_dates = list(self.available_dates)
        
        # 隨機選擇日期
        selected_date = random.choice(filtered_dates)
        
        print(f"\n[INFO] Available date range: {len(filtered_dates)} days")
        print(f"[INFO] Selected date: {selected_date}")
        print(f"[INFO] Will extract 400 candles from this date")
        
        return selected_date
    
    def detect_fvgs(self, df: pd.DataFrame, timeframe: str) -> List[Dict]:
        """
        檢測 FVG (使用簡化檢測器)
        
        Args:
            df: DataFrame，包含 K 線資料
            timeframe: 時間刻度
            
        Returns:
            List[Dict]: FVG 列表
        """
        try:
            # 確保資料按時間排序
            df = df.sort_values('DateTime').reset_index(drop=True)
            
            print(f"   正在檢測 {timeframe} FVG (使用簡化檢測器)...")
            
            # 使用簡化檢測器 - 直接使用DataFrame，無複雜轉換
            fvgs = self.fvg_detector_simple.detect_fvgs(df, timeframe=timeframe)
            
            # 轉換為前端格式
            formatted_fvgs = self.fvg_detector_simple.convert_for_frontend(fvgs)
            
            # 獲取統計信息
            stats = self.fvg_detector_simple.get_statistics()
            
            print(f"   {timeframe} FVG 簡化檢測完成:")
            print(f"     - 總檢測: {stats['basic_stats']['total_detected']} 個")
            print(f"     - 多頭: {stats['basic_stats']['bullish_detected']} 個")
            print(f"     - 空頭: {stats['basic_stats']['bearish_detected']} 個") 
            print(f"     - 有效: {stats['basic_stats']['valid_count']} 個")
            print(f"     - 已清除: {stats['basic_stats']['cleared_count']} 個")
            print(f"     - 前端顯示: {len(formatted_fvgs)} 個")
            
            return formatted_fvgs
            
        except Exception as e:
            print(f"   FVG 檢測失敗: {str(e)}")
            logging.error(f"FVG detection failed for {timeframe}: {str(e)}")
            return []
    
    def load_specific_date_data(self, target_date: date, timeframe: str) -> Optional[pd.DataFrame]:
        """
        按需載入特定日期前的資料 (智能載入)
        
        Args:
            target_date: 目標日期
            timeframe: 時間刻度
            
        Returns:
            DataFrame: 包含目標日期前400根K線的資料
        """
        try:
            filename = CSV_FILES.get(timeframe)
            if not filename:
                print(f"錯誤：無效的時間刻度 {timeframe}")
                return None
            
            filepath = os.path.join(DATA_DIR, filename)
            print(f"按需載入 {timeframe} 資料於 {target_date}...")
            
            # 讀取檔案
            df = pd.read_csv(filepath)
            
            # 處理時間欄位
            if 'Time' in df.columns:
                df['DateTime'] = pd.to_datetime(df['Date'] + ' ' + df['Time'], 
                                              format='%m/%d/%Y %H:%M')
            else:
                df['DateTime'] = pd.to_datetime(df['Date'], format='%m/%d/%Y')
            
            df['Date_Only'] = df['DateTime'].dt.date
            df = df.sort_values('DateTime').reset_index(drop=True)
            
            # 找到目標日期的資料
            target_date_data = df[df['Date_Only'] == target_date]
            if target_date_data.empty:
                print(f"警告：{timeframe} 中找不到 {target_date} 的資料")
                return None
            
            # 從目標日期往前取400根K線
            target_end_index = target_date_data.index[-1]
            candle_count = ANALYSIS_CANDLE_COUNT
            start_index = max(0, target_end_index - candle_count + 1)
            result_data = df.iloc[start_index:target_end_index + 1].copy()
            
            print(f"   載入完成：{len(result_data)} 根K線 ({start_index}-{target_end_index})")
            return result_data
            
        except Exception as e:
            print(f"按需載入失敗: {str(e)}")
            return None

    def get_pre_market_data(self, target_date: date, timeframe: str = 'H4') -> Optional[Dict]:
        """
        取得指定日期開盤前的資料 (智能載入版本)
        
        Args:
            target_date: 目標日期
            timeframe: 時間刻度 (M1, M5, M15, H1, H4, D1)
            
        Returns:
            Dict: 包含圖表資料和相關資訊
        """
        # 智能載入：如果資料未在快取中，則按需載入
        if timeframe not in self.data_cache:
            print(f"時間刻度 {timeframe} 未載入，執行按需載入...")
            df = self.load_specific_date_data(target_date, timeframe)
            if df is None:
                logging.error(f"按需載入 {timeframe} 失敗")
                return None
        else:
            df = self.data_cache[timeframe]
        
        # 檢查該時間框架是否包含目標日期的數據
        timeframe_dates = set(df['Date_Only'].unique())
        if target_date not in timeframe_dates:
            # 使用交集策略後，這種情況不應該發生
            # 如果發生了，說明隨機日期選擇邏輯有問題
            available_range = f"{min(timeframe_dates)} ~ {max(timeframe_dates)}" if timeframe_dates else "空"
            error_msg = (f"資料一致性錯誤：日期 {target_date} 不存在於時間框架 {timeframe} 中 "
                        f"(可用範圍: {available_range})。這表示隨機日期選擇邏輯有問題，"
                        f"應該只從所有時間框架的交集中選擇日期。")
            logging.error(error_msg)
            return None
        
        try:
            print(f"開始處理 {timeframe} 時間刻度的資料 (目標日期: {target_date})")
            
            # 新邏輯：從目標日期往前取400根K線
            # 1. 找到目標日期在資料中的位置
            target_date_data = df[df['Date_Only'] == target_date]
            
            if target_date_data.empty:
                # 這種情況不應該發生，因為已經通過交集檢查
                logging.error(f"交集檢查通過但找不到目標日期 {target_date} 在 {timeframe} 中的資料")
                return None
            
            # 2. 找到目標日期的最後一筆資料的索引
            target_end_index = target_date_data.index[-1]
            
            # 3. 從該索引往前取N根K線用於分析
            from utils.config import ANALYSIS_CANDLE_COUNT
            candle_count = ANALYSIS_CANDLE_COUNT
            start_index = max(0, target_end_index - candle_count + 1)
            
            result_data = df.iloc[start_index:target_end_index + 1].copy()
            
            print(f"   從索引 {start_index} 到 {target_end_index}，共取得 {len(result_data)} 根K線")
            print(f"   時間範圍：{result_data['DateTime'].min()} ~ {result_data['DateTime'].max()}")
            print(f"   日期範圍：{result_data['Date_Only'].min()} ~ {result_data['Date_Only'].max()}")
            
            # 執行400根K線的連續性檢查
            try:
                continuity_result = self.continuity_checker.check_continuity(result_data, timeframe)
                continuity_percentage = continuity_result.get('summary', {}).get('continuity_percentage', 0)
                gap_count = continuity_result.get('summary', {}).get('gap_count', 0)
                
                if continuity_percentage < 95:  # 連續性低於95%時警告
                    print(f"   ⚠️  K線連續性警告: {continuity_percentage:.1f}% (發現 {gap_count} 個間隙)")
                else:
                    print(f"   ✓ K線連續性良好: {continuity_percentage:.1f}%")
                    
                # 將連續性資訊添加到結果中
                continuity_info = {
                    'continuity_percentage': continuity_percentage,
                    'gap_count': gap_count,
                    'check_status': 'good' if continuity_percentage >= 95 else 'warning'
                }
            except Exception as e:
                print(f"   ⚠️  連續性檢查失敗: {str(e)}")
                continuity_info = {
                    'continuity_percentage': -1,
                    'gap_count': -1,
                    'check_status': 'error',
                    'error': str(e)
                }
            
            # 檢測 FVG
            fvgs = self.detect_fvgs(result_data, timeframe)
            
            # 準備圖表資料格式
            chart_data = []
            for _, row in result_data.iterrows():
                data_point = {
                    'time': datetime_to_timestamp(row['DateTime']),
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
            
            # 計算盤前時間（開盤前30分鐘）
            pre_market_time = ny_open_taipei - timedelta(minutes=30)
            
            # 計算收盤時間（台北時間）- 紐約16:00
            ny_close_time = datetime.combine(target_date, datetime.min.time().replace(hour=16, minute=0))
            ny_close = self.time_converter.ny_tz.localize(ny_close_time)
            ny_close_taipei = ny_close.astimezone(self.time_converter.taipei_tz)
            
            # 檢查假日狀態
            holiday_status = holiday_detector.get_trading_status(target_date)
            
            # 構建響應數據
            result = {
                'date': target_date.strftime('%Y-%m-%d'),
                'timeframe': timeframe,
                'data': chart_data,
                'fvgs': fvgs,  # 新增 FVG 資料
                'pre_market_time': pre_market_time.strftime('%Y-%m-%d %H:%M:%S'),
                'ny_open_taipei': ny_open_taipei.strftime('%Y-%m-%d %H:%M:%S'),
                'ny_close_taipei': ny_close_taipei.strftime('%Y-%m-%d %H:%M:%S'),  # 修復Missing欄位
                'is_dst': is_dst,
                'candle_count': len(chart_data),
                # 新增假日資訊
                'holiday_info': holiday_status,
                # 新增K線連續性資訊
                'continuity_info': continuity_info,
                # 新增時區資訊
                'timezone_info': {
                    'is_dst': is_dst,
                    'ny_offset': -4 if is_dst else -5,
                    'taipei_offset': 8,
                    'ny_open_time': ny_open_taipei.strftime('%H:%M'),
                    'ny_close_time': ny_close_taipei.strftime('%H:%M'),  # 新增收盤時間
                    'pre_market_time': pre_market_time.strftime('%H:%M')
                }
            }
            
            # 轉換為JSON可序列化格式並直接返回
            return self._convert_to_json_serializable(result)
            
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
            
            # 限制數據量以提升性能：使用分析K線數量限制
            max_candles = ANALYSIS_CANDLE_COUNT
            
            if len(market_data) > max_candles:
                market_data = market_data.tail(max_candles)
                print(f"數據量限制: 從開盤後記錄中取最近 {len(market_data)} 筆")
            
            # 數據量驗證：最終確保不超過限制
            if len(market_data) > max_candles:
                market_data = market_data.tail(max_candles)
                print(f"[WARNING] 最終數據量驗證：截取最新 {len(market_data)} 根K線")
            
            # 檢測 FVG
            fvgs = self.detect_fvgs(market_data, timeframe)
            
            # 準備圖表資料格式
            chart_data = []
            for _, row in market_data.iterrows():
                data_point = {
                    'time': datetime_to_timestamp(row['DateTime']),
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
            
            result = {
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
            
            # 轉換為JSON可序列化格式
            return self._convert_to_json_serializable(result)
            
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
        
        # 根據數據量自動調整檢查策略
        timeframe_sizes = {}
        for timeframe in self.data_cache.keys():
            df = self.data_cache[timeframe]
            timeframe_sizes[timeframe] = len(df)
        
        # 按數據量排序，先檢查小的
        sorted_timeframes = sorted(timeframe_sizes.items(), key=lambda x: x[1])
        
        for timeframe, data_size in sorted_timeframes:
            try:
                df = self.data_cache[timeframe]
                
                # 智能檢查：根據數據量選擇策略
                if hasattr(self.continuity_checker, 'check_continuity'):
                    # V2 優化版本
                    if data_size > 100000:
                        print(f"   {timeframe:>3}: 大數據集({data_size:,}根) - 使用優化檢查...")
                    else:
                        print(f"   {timeframe:>3}: 檢查中... ({data_size:,}根)")
                        
                    result = self.continuity_checker.check_continuity(df, timeframe)
                    self.continuity_reports[timeframe] = result
                    
                    if result['status'] == 'completed':
                        summary = result['summary']
                        continuity_pct = summary['continuity_percentage']
                        data_gaps = summary.get('total_data_gaps', summary.get('total_gaps', 0))
                        missing_data = summary.get('total_missing_data', summary.get('total_missing_candles', 0))
                        trading_gaps = summary.get('total_trading_gaps', 0)
                        
                        # 性能信息
                        if 'performance' in result:
                            elapsed_time = result['performance']['elapsed_time']
                            speed = result['performance']['processing_speed']
                            print(f"        └─ 完成！用時: {elapsed_time}, 速度: {speed}")
                        
                        status_icon = "[OK]" if missing_data == 0 else "[WARN]" if missing_data < 100 else "[ERROR]"
                        
                        print(f"        └─ {status_icon} {continuity_pct:6.1f}% Continuity "
                              f"(Missing data: {missing_data:,} candles)")
                        
                        # 顯示正常停盤和真實缺失的分佈
                        if trading_gaps > 0:
                            print(f"        └─ Normal market closure: {trading_gaps} gaps")
                        if data_gaps > 0:
                            print(f"        └─ Data missing: {data_gaps} gaps")
                        
                        # 如果有嚴重問題，顯示詳細資訊
                        if missing_data > 1000:
                            print(f"        └─ Recommend checking data quality")
                
                else:
                    # 原版檢查器
                    if hasattr(self.continuity_checker, 'quick_check'):
                        status = self.continuity_checker.quick_check(df, timeframe)
                    
                    result = self.continuity_checker.check_continuity(df, timeframe)
                    self.continuity_reports[timeframe] = result
                    
                    if result['status'] == 'completed':
                        summary = result['summary']
                        continuity_pct = summary['continuity_percentage']
                        missing_data = summary.get('total_missing_data', summary.get('total_missing_candles', 0))
                        
                        status_icon = "[OK]" if missing_data == 0 else "[WARN]" if missing_data < 100 else "[ERROR]"
                        print(f"   {timeframe:>3}: {status_icon} {continuity_pct:6.1f}% Continuity")
                
            except Exception as e:
                print(f"   {timeframe:>3}: [ERROR] Check failed - {str(e)}")
                logging.error(f"Continuity check failed [{timeframe}]: {str(e)}")
                
                # 如果檢查失敗，但系統可以繼續運行
                df = self.data_cache[timeframe]
                print(f"        └─ 跳過檢查，數據可用 ({len(df):,} 根K線)")
                
                # 創建一個基本報告
                self.continuity_reports[timeframe] = {
                    'status': 'error',
                    'message': f'檢查失敗: {str(e)}',
                    'total_candles': len(df)
                }
    
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
    
    # 新增：性能優化方法
    def _preload_common_data(self):
        """預載入最近30天的常用時間框架數據以提升響應速度"""
        try:
            popular_timeframes = ['M15', 'H4']  # 減少預載入的時間框架以節省內存
            preload_count = 0
            
            for timeframe in popular_timeframes:
                if timeframe in self.data_cache:
                    # 預處理最近30天的數據
                    recent_data = self._get_recent_data(timeframe, days=self._preload_days)
                    if recent_data is not None and len(recent_data) > 0:
                        self._cache_processed_data(timeframe, recent_data)
                        preload_count += 1
                        print(f"   {timeframe}: 預載入 {len(recent_data):,} 筆最近數據")
            
            print(f"   預載入完成：{preload_count} 個時間框架")
            
        except Exception as e:
            print(f"   預載入警告: {str(e)}")
            logging.warning(f"數據預載入失敗: {str(e)}")
    
    def _get_recent_data(self, timeframe: str, days: int = 30) -> Optional[pd.DataFrame]:
        """獲取指定時間框架最近N天的數據"""
        try:
            if timeframe not in self.data_cache:
                return None
            
            df = self.data_cache[timeframe]
            if df.empty:
                return None
            
            # 計算截止日期
            cutoff_date = datetime.now().date() - timedelta(days=days)
            
            # 篩選最近的數據
            recent_data = df[df['Date_Only'] >= cutoff_date].copy()
            return recent_data if len(recent_data) > 0 else None
            
        except Exception as e:
            logging.error(f"獲取最近數據失敗 [{timeframe}]: {str(e)}")
            return None
    
    def _cache_processed_data(self, timeframe: str, data: pd.DataFrame):
        """緩存預處理的數據"""
        try:
            # 預處理常用格式的數據
            processed_data = {
                'raw_data': data,
                'date_range': (data['Date_Only'].min(), data['Date_Only'].max()),
                'record_count': len(data),
                'last_updated': datetime.now()
            }
            
            # 簡化版本：移除複雜的緩存機制
            
        except Exception as e:
            logging.error(f"數據處理失敗 [{timeframe}]: {str(e)}")