"""
時間戳工具單元測試
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

import unittest
import datetime
import pandas as pd
from utils.time_utils import (
    validate_timestamp,
    normalize_timestamp,
    timestamp_to_datetime,
    datetime_to_timestamp,
    timestamp_to_milliseconds,
    milliseconds_to_timestamp,
    format_timestamp,
    get_current_timestamp,
    is_same_trading_day,
    validate_timeframe_compatibility,
    TimestampError
)


class TestTimeUtils(unittest.TestCase):
    
    def setUp(self):
        """測試設置"""
        # 使用固定的測試時間戳: 2024-03-28 10:30:00 UTC
        self.test_timestamp = 1711621800  # 正確的UTC時間戳
        self.test_datetime = datetime.datetime(2024, 3, 28, 10, 30, 0, tzinfo=datetime.timezone.utc)
        
    def test_validate_timestamp(self):
        """測試時間戳驗證"""
        # 有效時間戳
        self.assertTrue(validate_timestamp(self.test_timestamp))
        self.assertTrue(validate_timestamp(self.test_timestamp * 1000))  # 毫秒
        self.assertTrue(validate_timestamp(str(self.test_timestamp)))
        self.assertTrue(validate_timestamp(self.test_datetime))
        
        # 無效時間戳
        self.assertFalse(validate_timestamp(None))
        self.assertFalse(validate_timestamp(""))
        self.assertFalse(validate_timestamp(0))
        self.assertFalse(validate_timestamp(-1))
        self.assertFalse(validate_timestamp("invalid"))
        self.assertFalse(validate_timestamp(9999999999999))  # 太大的數字
        
    def test_normalize_timestamp(self):
        """測試時間戳標準化"""
        # 秒級時間戳
        self.assertEqual(normalize_timestamp(self.test_timestamp), self.test_timestamp)
        
        # 毫秒級時間戳
        ms_timestamp = self.test_timestamp * 1000
        self.assertEqual(normalize_timestamp(ms_timestamp), self.test_timestamp)
        
        # 微秒級時間戳
        us_timestamp = self.test_timestamp * 1000000
        self.assertEqual(normalize_timestamp(us_timestamp), self.test_timestamp)
        
        # 字符串時間戳
        self.assertEqual(normalize_timestamp(str(self.test_timestamp)), self.test_timestamp)
        
        # datetime對象
        self.assertEqual(normalize_timestamp(self.test_datetime), self.test_timestamp)
        
        # pandas Timestamp
        pd_ts = pd.Timestamp(self.test_datetime)
        self.assertEqual(normalize_timestamp(pd_ts), self.test_timestamp)
        
        # 異常情況
        with self.assertRaises(TimestampError):
            normalize_timestamp(None)
        with self.assertRaises(TimestampError):
            normalize_timestamp("")
        with self.assertRaises(TimestampError):
            normalize_timestamp("invalid")
            
    def test_timestamp_conversions(self):
        """測試時間戳轉換"""
        # timestamp -> datetime -> timestamp
        dt = timestamp_to_datetime(self.test_timestamp)
        self.assertEqual(dt.year, 2024)
        self.assertEqual(dt.month, 3)
        self.assertEqual(dt.day, 28)
        
        ts = datetime_to_timestamp(dt)
        self.assertEqual(ts, self.test_timestamp)
        
        # timestamp -> milliseconds -> timestamp
        ms = timestamp_to_milliseconds(self.test_timestamp)
        self.assertEqual(ms, self.test_timestamp * 1000)
        
        ts_back = milliseconds_to_timestamp(ms)
        self.assertEqual(ts_back, self.test_timestamp)
        
    def test_format_timestamp(self):
        """測試時間戳格式化"""
        formatted = format_timestamp(self.test_timestamp, "%Y-%m-%d %H:%M:%S")
        self.assertEqual(formatted, "2024-03-28 10:30:00")
        
        formatted_date = format_timestamp(self.test_timestamp, "%Y-%m-%d")
        self.assertEqual(formatted_date, "2024-03-28")
        
    def test_current_timestamp(self):
        """測試獲取當前時間戳"""
        current = get_current_timestamp()
        self.assertIsInstance(current, int)
        self.assertTrue(validate_timestamp(current))
        
        # 檢查是否接近當前時間（誤差不超過10秒）
        import time
        actual_current = int(time.time())
        self.assertLess(abs(current - actual_current), 10)
        
    def test_same_trading_day(self):
        """測試交易日檢查"""
        # 同一天
        ts1 = self.test_timestamp  # 2024-03-28 10:30:00
        ts2 = self.test_timestamp + 3600  # 2024-03-28 11:30:00
        self.assertTrue(is_same_trading_day(ts1, ts2))
        
        # 不同天
        ts3 = self.test_timestamp + 86400  # 2024-03-29 10:30:00
        self.assertFalse(is_same_trading_day(ts1, ts3))
        
    def test_timeframe_compatibility(self):
        """測試時間框架兼容性"""
        # M15對齊的時間戳 (10:30:00 UTC)
        aligned_ts = self.test_timestamp  # 2024-03-28 10:30:00 UTC
        self.assertTrue(validate_timeframe_compatibility(aligned_ts, 'M15'))
        self.assertTrue(validate_timeframe_compatibility(aligned_ts, 'M30'))
        
        # M1對齊（任何時間都應該對齊M1）
        self.assertTrue(validate_timeframe_compatibility(aligned_ts, 'M1'))
        
        # H1對齊的時間戳 (10:00:00 UTC)
        h1_aligned_ts = 1711620000  # 2024-03-28 10:00:00 UTC
        self.assertTrue(validate_timeframe_compatibility(h1_aligned_ts, 'H1'))
        
        # 不對齊的時間戳 (10:37:00 UTC)
        unaligned_ts = aligned_ts + 420  # 加7分鐘
        self.assertFalse(validate_timeframe_compatibility(unaligned_ts, 'M15'))
        self.assertFalse(validate_timeframe_compatibility(unaligned_ts, 'M30'))
        
        # 午夜時間對D1對齊 (2024-03-28 00:00:00 UTC)
        midnight_ts = 1711584000  # 2024-03-28 00:00:00 UTC
        self.assertTrue(validate_timeframe_compatibility(midnight_ts, 'D1'))
        
        # 非午夜時間對D1不對齊
        self.assertFalse(validate_timeframe_compatibility(aligned_ts, 'D1'))
        
        # 無效時間框架
        self.assertFalse(validate_timeframe_compatibility(aligned_ts, 'INVALID'))


if __name__ == '__main__':
    print("執行時間戳工具單元測試...")
    unittest.main(verbosity=2)