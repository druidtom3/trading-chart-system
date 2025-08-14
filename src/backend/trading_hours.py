# 檔名：trading_hours.py - 交易時間檢測器

from datetime import datetime, time, timedelta
from typing import Optional, Dict, Tuple
import pytz
from .us_holidays import USHolidayDetector

class TradingHoursDetector:
    """
    期貨交易時間檢測器
    
    檢測MNQ期貨的正常交易時間，排除：
    - 週末
    - 美國假日
    - 每日的正常停盤時間
    """
    
    def __init__(self):
        self.holiday_detector = USHolidayDetector()
        
        # MNQ期貨交易時間 (美國東部時間)
        # 週日-週五: 18:00 ET - 17:00 ET (次日)
        # 停盤時間: 週五 17:00 - 週日 18:00
        self.et_tz = pytz.timezone('America/New_York')
        
        # 每日停盤時間（美國東部時間）
        self.daily_close_time = time(17, 0)  # 17:00 ET
        self.daily_open_time = time(18, 0)   # 18:00 ET
        
        # 週末停盤：週五17:00 到 週日18:00
        
    def is_trading_time(self, dt: datetime) -> bool:
        """
        檢查指定時間是否為正常交易時間
        
        Args:
            dt: 要檢查的時間（UTC或帶時區信息）
            
        Returns:
            bool: True如果是交易時間，False如果是正常停盤時間
        """
        # 轉換為美國東部時間
        if dt.tzinfo is None:
            # 假設輸入是UTC時間
            dt = pytz.UTC.localize(dt)
        
        et_time = dt.astimezone(self.et_tz)
        
        # 檢查是否為假日
        if self.holiday_detector.is_market_holiday(et_time.date()):
            return False
        
        # 檢查縮短交易時間
        if self.holiday_detector.is_early_close(et_time.date()):
            # 假日前通常13:00就收盤
            early_close = time(13, 0)
            if et_time.time() >= early_close:
                return False
        
        # 檢查週末停盤
        weekday = et_time.weekday()  # 0=Monday, 6=Sunday
        
        if weekday == 5:  # 週六
            return False
        elif weekday == 6:  # 週日
            # 週日18:00之前不交易
            return et_time.time() >= self.daily_open_time
        elif weekday == 4:  # 週五
            # 週五17:00之後不交易
            return et_time.time() < self.daily_close_time
        else:
            # 週一到週四正常交易
            return True
    
    def get_next_trading_start(self, dt: datetime) -> datetime:
        """
        獲取下一個交易開始時間
        
        Args:
            dt: 當前時間
            
        Returns:
            datetime: 下一個交易開始時間
        """
        if dt.tzinfo is None:
            dt = pytz.UTC.localize(dt)
        
        et_time = dt.astimezone(self.et_tz)
        
        # 如果當前就是交易時間，返回當前時間
        if self.is_trading_time(dt):
            return dt
        
        # 尋找下一個交易開始時間
        check_time = et_time
        while not self.is_trading_time(check_time.astimezone(pytz.UTC)):
            check_time += timedelta(hours=1)
            
            # 防止無限循環
            if (check_time - et_time).days > 7:
                break
        
        return check_time.astimezone(pytz.UTC)
    
    def get_trading_gap_reason(self, start_dt: datetime, end_dt: datetime) -> str:
        """
        分析時間間隙的原因
        
        Args:
            start_dt: 間隙開始時間
            end_dt: 間隙結束時間
            
        Returns:
            str: 間隙原因描述
        """
        if start_dt.tzinfo is None:
            start_dt = pytz.UTC.localize(start_dt)
        if end_dt.tzinfo is None:
            end_dt = pytz.UTC.localize(end_dt)
        
        et_start = start_dt.astimezone(self.et_tz)
        et_end = end_dt.astimezone(self.et_tz)
        
        # 檢查是否跨越假日
        current_date = et_start.date()
        end_date = et_end.date()
        
        holiday_days = []
        while current_date <= end_date:
            if self.holiday_detector.is_market_holiday(current_date):
                # 獲取假日名稱（需要檢查USHolidayDetector是否有此方法）
                holiday_days.append(f"{current_date}(假日)")
            current_date += timedelta(days=1)
        
        if holiday_days:
            return f"假日停盤: {', '.join(holiday_days)}"
        
        # 檢查週末
        if et_start.weekday() == 4 and et_start.time() >= self.daily_close_time:
            if et_end.weekday() == 6 and et_end.time() <= self.daily_open_time:
                return "週末停盤"
        
        # 檢查每日停盤
        if (et_end - et_start).total_seconds() <= 24 * 3600:  # 24小時內
            if et_start.time() >= self.daily_close_time and et_end.time() <= self.daily_open_time:
                return "每日停盤"
        
        # 如果都不是，可能是數據缺失
        gap_hours = (end_dt - start_dt).total_seconds() / 3600
        return f"可能數據缺失 ({gap_hours:.1f}小時)"
    
    def should_ignore_gap(self, start_dt: datetime, end_dt: datetime) -> bool:
        """
        判斷是否應該忽略這個時間間隙（即是否為正常停盤）
        
        Args:
            start_dt: 間隙開始時間
            end_dt: 間隙結束時間
            
        Returns:
            bool: True如果應該忽略（正常停盤），False如果需要報告（數據缺失）
        """
        reason = self.get_trading_gap_reason(start_dt, end_dt)
        
        # 如果是假日、週末或每日停盤，則忽略
        return not reason.startswith("可能數據缺失")
    
    def get_expected_trading_candles(self, start_dt: datetime, end_dt: datetime, 
                                   timeframe_minutes: int) -> int:
        """
        計算指定時間範圍內應該有多少根交易K線
        
        Args:
            start_dt: 開始時間
            end_dt: 結束時間
            timeframe_minutes: 時間框架（分鐘）
            
        Returns:
            int: 預期的K線數量
        """
        if start_dt.tzinfo is None:
            start_dt = pytz.UTC.localize(start_dt)
        if end_dt.tzinfo is None:
            end_dt = pytz.UTC.localize(end_dt)
        
        expected_count = 0
        current_time = start_dt
        interval = timedelta(minutes=timeframe_minutes)
        
        while current_time < end_dt:
            if self.is_trading_time(current_time):
                expected_count += 1
            current_time += interval
        
        return expected_count