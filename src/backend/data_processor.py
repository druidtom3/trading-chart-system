# 檔名：data_processor.py

import pandas as pd
import numpy as np
import os
import random
import logging
from datetime import datetime, date, timedelta
from typing import Dict, List, Optional, Tuple, Any

from utils.config import (DATA_DIR, CSV_FILES, DEFAULT_CANDLE_COUNT, LOG_DIR, RANDOM_DATE_CONFIG,
                          FVG_CLEARING_WINDOW, CACHE_MAX_SIZE, CACHE_VERSION, 
                          MAX_RECORDS_LIMIT, MEMORY_OPTIMIZATION_THRESHOLD)
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
from backend.candle_continuity_checker import CandleContinuityChecker
try:
    from backend.candle_continuity_checker_v2 import CandleContinuityCheckerV2
    from utils.continuity_config import USE_V2_CHECKER, CONTINUITY_CHECK_MODE, SHOW_PROGRESS, ULTRA_FAST_STARTUP, SKIP_LARGE_FILES_IN_FAST_MODE
except ImportError:
    USE_V2_CHECKER = False
    ULTRA_FAST_STARTUP = False
    SKIP_LARGE_FILES_IN_FAST_MODE = []
    print("注意: V2優化版本不可用，使用原版連續性檢查器")

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
        
        # 新增：性能優化相關緩存 (優化內存使用)
        self._response_cache = {}  # API響應緩存: {cache_key: result}
        self._processed_data_cache = {}  # 預處理數據緩存: {timeframe: recent_data}
        self._cache_max_size = CACHE_MAX_SIZE  # 緩存最大條目數
        self._preload_days = 7  # 減少預載入天數 (從30降到7天)
        
        # 選擇連續性檢查器版本
        if USE_V2_CHECKER:
            print(f"使用V2優化連續性檢查器 (模式: {CONTINUITY_CHECK_MODE})")
            try:
                from utils.continuity_config import FAST_STARTUP
                fast_mode = FAST_STARTUP
            except:
                fast_mode = False
                
            if fast_mode:
                print("啟用快速啟動模式")
                
            self.continuity_checker = CandleContinuityCheckerV2(
                optimization_mode=CONTINUITY_CHECK_MODE,
                show_progress=SHOW_PROGRESS
            )
            self.fast_startup = fast_mode
        else:
            print("使用原版連續性檢查器")
            self.continuity_checker = CandleContinuityChecker()
            self.fast_startup = False
            
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
            
            # 聰明載入模式：大文件採用優化策略而不是跳過
            is_large_file = timeframe in SKIP_LARGE_FILES_IN_FAST_MODE
            loading_mode = "優化載入" if (self.fast_startup and is_large_file) else "完整載入"
            
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
                
                # 針對大文件使用優化載入策略
                if self.fast_startup and is_large_file:
                    print(f"   [優化模式] 採用分塊載入以減少記憶體使用")
                    # 讀取最近的數據（更有用）而不是跳過整個文件
                    df = pd.read_csv(filepath)
                    original_count = len(df)
                    # 使用配置中的400根K線限制，避免堆棧溢出
                    from utils.config import DEFAULT_CANDLE_COUNT
                    
                    # 根據時間框架獲取對應的K線數量
                    timeframe_key = None
                    for tf in ['M1', 'M5', 'M15', 'H1', 'H4', 'D1']:
                        if tf in filepath:
                            timeframe_key = tf
                            break
                    
                    if timeframe_key:
                        candle_limit = DEFAULT_CANDLE_COUNT.get(timeframe_key, 400)
                        if len(df) > candle_limit:
                            df = df.tail(candle_limit)
                            print(f"   [{timeframe_key}優化] 從 {original_count:,} 筆記錄中保留最近 {len(df):,} 筆（配置: {candle_limit}根）")
                        else:
                            print(f"   [{timeframe_key}] 數據量適中，載入全部 {len(df):,} 筆記錄")
                    elif len(df) > MAX_RECORDS_LIMIT:  # 其他時間框架
                        df = df.tail(MAX_RECORDS_LIMIT)  # 保留最近記錄
                        print(f"   [優化] 從 {original_count:,} 筆記錄中保留最近 {len(df):,} 筆")
                    else:
                        print(f"   數據量適中，載入全部 {len(df):,} 筆記錄")
                else:
                    # 完整載入，但仍需限制K線數量
                    df = pd.read_csv(filepath)
                    original_count = len(df)
                    print(f"   CSV 讀取完成: {original_count:,} 筆原始記錄")
                    
                    # 確保所有時間刻度都限制在400根K線以內
                    from utils.config import DEFAULT_CANDLE_COUNT
                    
                    # 根據時間框架獲取對應的K線數量
                    timeframe_key = None
                    for tf in ['M1', 'M5', 'M15', 'H1', 'H4', 'D1']:
                        if tf in filepath:
                            timeframe_key = tf
                            break
                    
                    if timeframe_key:
                        candle_limit = DEFAULT_CANDLE_COUNT.get(timeframe_key, 400)
                        if len(df) > candle_limit:
                            df = df.tail(candle_limit)
                            print(f"   [{timeframe_key}限制] 從 {original_count:,} 筆記錄中保留最近 {len(df):,} 筆（配置: {candle_limit}根）")
                        else:
                            print(f"   [{timeframe_key}] 數據量適中，載入全部 {len(df):,} 筆記錄")
                    else:
                        # 未知時間框架，默認限制400根
                        if len(df) > MEMORY_OPTIMIZATION_THRESHOLD:
                            df = df.tail(MEMORY_OPTIMIZATION_THRESHOLD)
                            print(f"   [默認限制] 從 {original_count:,} 筆記錄中保留最近 {len(df):,} 筆")
                        else:
                            print(f"   數據量適中，載入全部 {len(df):,} 筆記錄")
                
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
        print(f"\n正在執行K線連續性檢查...")
        self.perform_continuity_check()
        
        # 新增：預載入常用數據以提升響應速度
        print(f"\n正在預載入常用數據...")
        self._preload_common_data()
        
        print("=" * 60)
        print("系統準備就緒，等待用戶連線...")
        print()
    
    def get_random_date(self) -> date:
        """隨機選擇一個可用的交易日期"""
        if not self.available_dates:
            raise ValueError("沒有可用的交易日期")
        
        dates_list = sorted(list(self.available_dates))
        selected_date = random.choice(dates_list)
        
        # 提供詳細的日誌信息
        min_date = dates_list[0]
        max_date = dates_list[-1]
        total_days = len(dates_list)
        print(f"隨機選擇日期: {selected_date}")
        print(f"可用範圍: {min_date} ~ {max_date} (共 {total_days} 天)")
        print(f"固定起始日期: {RANDOM_DATE_CONFIG['start_date']} (配置)")
        
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
    
    def get_pre_market_data(self, target_date: date, timeframe: str = 'H4') -> Optional[Dict]:
        """
        取得指定日期開盤前的資料 (優化版本，支持緩存)
        
        Args:
            target_date: 目標日期
            timeframe: 時間刻度 (M1, M5, M15, H1, H4, D1)
            
        Returns:
            Dict: 包含圖表資料和相關資訊
        """
        # 生成緩存鍵（v3：修復FVG檢測條件版本）
        from utils.config import DEFAULT_CANDLE_COUNT
        max_candles = DEFAULT_CANDLE_COUNT.get(timeframe, 400)
        cache_key = f"pre_market_{target_date}_{timeframe}_{CACHE_VERSION}_{max_candles}"
        
        # 檢查是否有緩存的響應
        cached_response = self._get_cached_response(cache_key)
        if cached_response is not None:
            print(f"處理請求 (緩存): {target_date} ({timeframe})")
            return cached_response
        
        print(f"處理請求: {target_date} ({timeframe})")
        
        # 檢查日期是否在可用範圍內
        try:
            if target_date not in self.available_dates:
                available_range = f"{min(self.available_dates)} ~ {max(self.available_dates)}"
                logging.error(f"日期 {target_date} 不在可用範圍內 ({available_range})")
                print(f"❌ 日期 {target_date} 超出資料範圍")
                print(f"   可用日期範圍: {available_range}")
                print(f"   target_date 類型: {type(target_date)}")
                print(f"   available_dates 示例: {list(self.available_dates)[:5]}")
                return None
        except Exception as date_check_error:
            print(f"❌ 日期檢查發生錯誤: {date_check_error}")
            print(f"   target_date: {target_date} (類型: {type(target_date)})")
            print(f"   available_dates 大小: {len(self.available_dates)}")
            # 跳過日期檢查，讓後續邏輯處理
            pass
        
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
            
            # FVG檢測範圍：使用配置的K線數量限制
            from utils.config import DEFAULT_CANDLE_COUNT
            detection_range_candles = DEFAULT_CANDLE_COUNT.get(timeframe, 400)
            
            # 如果資料不足，就取所有可用的，但不超過配置限制
            actual_count = min(detection_range_candles, len(pre_market_data))
            result_data = pre_market_data.tail(actual_count)
            
            print(f"目標K線數: {detection_range_candles}，實際輸出: {len(result_data)} 根K線")
            
            # 數據量驗證：確保不超過配置限制
            if len(result_data) > detection_range_candles:
                result_data = result_data.tail(detection_range_candles)
                print(f"⚠️ 數據量驗證：截取最新 {len(result_data)} 根K線")
            
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
            
            # 計算收盤時間（台北時間）- 紐約16:00
            ny_close_time = datetime.combine(target_date, datetime.min.time().replace(hour=16, minute=0))
            ny_close = self.time_converter.ny_tz.localize(ny_close_time)
            ny_close_taipei = ny_close.astimezone(self.time_converter.taipei_tz)
            
            print(f"資料處理完成")
            
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
            
            # 轉換為JSON可序列化格式
            serializable_result = self._convert_to_json_serializable(result)
            
            # 緩存響應（僅緩存成功的響應）
            self._cache_response(cache_key, serializable_result.copy())
            
            return serializable_result
            
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
            
            # 限制數據量以提升性能：使用配置的K線數量限制
            from utils.config import DEFAULT_CANDLE_COUNT
            max_candles = DEFAULT_CANDLE_COUNT.get(timeframe, 400)
            
            if len(market_data) > max_candles:
                market_data = market_data.tail(max_candles)
                print(f"數據量限制: 從開盤後記錄中取最近 {len(market_data)} 筆")
            
            # 數據量驗證：最終確保不超過限制
            if len(market_data) > max_candles:
                market_data = market_data.tail(max_candles)
                print(f"⚠️ 最終數據量驗證：截取最新 {len(market_data)} 根K線")
            
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
        if self.fast_startup:
            print("   連續性檢查: [快速模式] 跳過詳細檢查以加速啟動")
            # 快速模式：只做基本統計，不做詳細檢查
            for timeframe in self.data_cache.keys():
                df = self.data_cache[timeframe]
                candle_count = len(df)
                print(f"   {timeframe:>3}: [SKIP] {candle_count:,} 根K線 (快速啟動)")
            return
            
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
                        
                        print(f"        └─ {status_icon} {continuity_pct:6.1f}% 連續性 "
                              f"(數據缺失: {missing_data:,} 根K線)")
                        
                        # 顯示正常停盤和真實缺失的分佈
                        if trading_gaps > 0:
                            print(f"        └─ 正常停盤: {trading_gaps} 個間隙")
                        if data_gaps > 0:
                            print(f"        └─ 數據缺失: {data_gaps} 個間隙")
                        
                        # 如果有嚴重問題，顯示詳細資訊
                        if missing_data > 1000:
                            print(f"        └─ 建議檢查數據質量")
                
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
                        print(f"   {timeframe:>3}: {status_icon} {continuity_pct:6.1f}% 連續性")
                
            except Exception as e:
                print(f"   {timeframe:>3}: [ERROR] 檢查失敗 - {str(e)}")
                logging.error(f"連續性檢查失敗 [{timeframe}]: {str(e)}")
                
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
            
            self._processed_data_cache[timeframe] = processed_data
            
        except Exception as e:
            logging.error(f"緩存預處理數據失敗 [{timeframe}]: {str(e)}")
    
    def _get_cached_response(self, cache_key: str) -> Optional[Dict]:
        """獲取緩存的API響應"""
        return self._response_cache.get(cache_key)
    
    def _cache_response(self, cache_key: str, response_data: Dict):
        """緩存API響應，限制緩存大小"""
        try:
            # 如果緩存已滿，移除最舊的條目
            if len(self._response_cache) >= self._cache_max_size:
                # 移除最舊的條目（簡單FIFO策略）
                oldest_key = next(iter(self._response_cache))
                del self._response_cache[oldest_key]
            
            # 添加時間戳
            response_data['cached_at'] = datetime.now().isoformat()
            self._response_cache[cache_key] = response_data
            
        except Exception as e:
            logging.error(f"緩存響應失敗 [{cache_key}]: {str(e)}")
    
    def _clear_old_cache(self, max_age_minutes: int = 30):
        """清除過期的緩存條目"""
        try:
            current_time = datetime.now()
            expired_keys = []
            
            for key, data in self._response_cache.items():
                if 'cached_at' in data:
                    cached_time = datetime.fromisoformat(data['cached_at'])
                    age_minutes = (current_time - cached_time).total_seconds() / 60
                    
                    if age_minutes > max_age_minutes:
                        expired_keys.append(key)
            
            # 移除過期條目
            for key in expired_keys:
                del self._response_cache[key]
            
            if expired_keys:
                print(f"清除 {len(expired_keys)} 個過期緩存條目")
                
        except Exception as e:
            logging.error(f"清除過期緩存失敗: {str(e)}")