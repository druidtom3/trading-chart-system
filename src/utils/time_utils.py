"""
時間戳標準化工具模組

統一處理前後端時間戳格式，確保一致性和可靠性。
標準：後端統一輸出Unix秒級時間戳，前端按需轉換為毫秒。
"""

import datetime
import time
from typing import Union, Optional
import pandas as pd


class TimestampError(Exception):
    """時間戳處理相關錯誤"""
    pass


def validate_timestamp(timestamp: Union[int, float, str, datetime.datetime, pd.Timestamp]) -> bool:
    """
    驗證時間戳是否有效
    
    Args:
        timestamp: 待驗證的時間戳（支持多種格式）
        
    Returns:
        bool: 時間戳是否有效
    """
    try:
        normalized = normalize_timestamp(timestamp)
        
        # 檢查是否在合理的時間範圍內 (1970-01-01 到 2050-01-01)
        min_timestamp = 0  # 1970-01-01
        max_timestamp = 2524608000  # 2050-01-01
        
        return min_timestamp <= normalized <= max_timestamp
        
    except (ValueError, TypeError, TimestampError):
        return False


def normalize_timestamp(timestamp: Union[int, float, str, datetime.datetime, pd.Timestamp]) -> int:
    """
    標準化時間戳為Unix秒級時間戳
    
    Args:
        timestamp: 輸入時間戳（支持多種格式）
        
    Returns:
        int: 標準化後的Unix秒級時間戳
        
    Raises:
        TimestampError: 時間戳格式無效或轉換失敗
    """
    try:
        # 處理None或空值
        if timestamp is None or timestamp == '' or timestamp == 0:
            raise TimestampError("時間戳不能為空或零")
        
        # 處理pandas Timestamp
        if isinstance(timestamp, pd.Timestamp):
            return int(timestamp.timestamp())
        
        # 處理datetime對象
        if isinstance(timestamp, datetime.datetime):
            return int(timestamp.timestamp())
        
        # 處理字符串
        if isinstance(timestamp, str):
            # 嘗試解析ISO格式
            try:
                dt = datetime.datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                return int(dt.timestamp())
            except ValueError:
                # 嘗試作為數字字符串處理
                timestamp = float(timestamp)
        
        # 處理數字類型
        if isinstance(timestamp, (int, float)):
            timestamp = float(timestamp)
            
            # 檢測微秒級時間戳（通常大於1000000000000000）
            if timestamp > 1000000000000000:
                # 轉換微秒為秒
                timestamp = timestamp / 1000000
            
            # 檢測毫秒級時間戳（通常大於1000000000000）
            elif timestamp > 1000000000000:
                # 轉換毫秒為秒
                timestamp = timestamp / 1000
            
            return int(timestamp)
        
        raise TimestampError(f"不支持的時間戳格式: {type(timestamp)}")
        
    except Exception as e:
        raise TimestampError(f"時間戳標準化失敗: {str(e)}")


def timestamp_to_datetime(timestamp: Union[int, float], timezone: Optional[str] = None) -> datetime.datetime:
    """
    將Unix時間戳轉換為datetime對象
    
    Args:
        timestamp: Unix秒級時間戳
        timezone: 時區字符串（可選，默認UTC）
        
    Returns:
        datetime.datetime: 轉換後的datetime對象
    """
    normalized_ts = normalize_timestamp(timestamp)
    
    # 預設使用UTC時間
    dt = datetime.datetime.utcfromtimestamp(normalized_ts)
    
    if timezone and timezone != 'UTC':
        try:
            import zoneinfo
            tz = zoneinfo.ZoneInfo(timezone)
            dt = dt.replace(tzinfo=datetime.timezone.utc).astimezone(tz)
        except ImportError:
            # Python < 3.9 fallback
            import pytz
            utc_dt = dt.replace(tzinfo=pytz.UTC)
            target_tz = pytz.timezone(timezone)
            dt = utc_dt.astimezone(target_tz)
    
    return dt


def datetime_to_timestamp(dt: datetime.datetime) -> int:
    """
    將datetime對象轉換為Unix秒級時間戳
    
    Args:
        dt: datetime對象
        
    Returns:
        int: Unix秒級時間戳
    """
    # 如果datetime沒有時區信息，假設為UTC
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=datetime.timezone.utc)
    
    return int(dt.timestamp())


def timestamp_to_milliseconds(timestamp: Union[int, float]) -> int:
    """
    將Unix秒級時間戳轉換為毫秒級（用於前端）
    
    Args:
        timestamp: Unix秒級時間戳
        
    Returns:
        int: 毫秒級時間戳
    """
    normalized_ts = normalize_timestamp(timestamp)
    return normalized_ts * 1000


def milliseconds_to_timestamp(milliseconds: Union[int, float]) -> int:
    """
    將毫秒級時間戳轉換為Unix秒級時間戳
    
    Args:
        milliseconds: 毫秒級時間戳
        
    Returns:
        int: Unix秒級時間戳
    """
    return int(milliseconds / 1000)


def format_timestamp(timestamp: Union[int, float], format_str: str = "%Y-%m-%d %H:%M:%S") -> str:
    """
    格式化時間戳為可讀字符串（UTC時間）
    
    Args:
        timestamp: Unix秒級時間戳
        format_str: 格式化字符串
        
    Returns:
        str: 格式化後的時間字符串
    """
    normalized_ts = normalize_timestamp(timestamp)
    dt = datetime.datetime.utcfromtimestamp(normalized_ts)
    return dt.strftime(format_str)


def get_current_timestamp() -> int:
    """
    獲取當前時間的Unix秒級時間戳
    
    Returns:
        int: 當前時間的Unix秒級時間戳
    """
    return int(time.time())


def is_same_trading_day(timestamp1: Union[int, float], timestamp2: Union[int, float]) -> bool:
    """
    檢查兩個時間戳是否在同一個交易日
    
    Args:
        timestamp1: 第一個時間戳
        timestamp2: 第二個時間戳
        
    Returns:
        bool: 是否在同一交易日
    """
    ts1 = normalize_timestamp(timestamp1)
    ts2 = normalize_timestamp(timestamp2)
    
    dt1 = datetime.datetime.fromtimestamp(ts1)
    dt2 = datetime.datetime.fromtimestamp(ts2)
    
    return dt1.date() == dt2.date()


def validate_timeframe_compatibility(timestamp: Union[int, float], timeframe: str) -> bool:
    """
    驗證時間戳與時間框架的兼容性
    
    Args:
        timestamp: 時間戳
        timeframe: 時間框架（M1, M5, M15, M30, H1, H4, D1）
        
    Returns:
        bool: 時間戳是否與時間框架對齊
    """
    try:
        normalized_ts = normalize_timestamp(timestamp)
        # 使用UTC時間確保一致性
        dt = datetime.datetime.utcfromtimestamp(normalized_ts)
        
        # 檢查時間框架對齊
        timeframe_minutes = {
            'M1': 1,
            'M5': 5,
            'M15': 15,
            'M30': 30,
            'H1': 60,
            'H4': 240,
            'D1': 1440  # 一天
        }
        
        if timeframe not in timeframe_minutes:
            return False
        
        minutes = timeframe_minutes[timeframe]
        
        # 對於日線，只檢查是否為午夜
        if timeframe == 'D1':
            return dt.hour == 0 and dt.minute == 0 and dt.second == 0
        
        # 對於其他時間框架，檢查分鐘對齊
        total_minutes = dt.hour * 60 + dt.minute
        return total_minutes % minutes == 0 and dt.second == 0
        
    except Exception:
        return False


# 導出主要函數
__all__ = [
    'validate_timestamp',
    'normalize_timestamp',
    'timestamp_to_datetime',
    'datetime_to_timestamp',
    'timestamp_to_milliseconds',
    'milliseconds_to_timestamp',
    'format_timestamp',
    'get_current_timestamp',
    'is_same_trading_day',
    'validate_timeframe_compatibility',
    'TimestampError'
]