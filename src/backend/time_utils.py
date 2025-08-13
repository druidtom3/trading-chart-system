# 檔名：time_utils.py

from datetime import datetime, timedelta
import pytz


class TimeConverter:
    def __init__(self):
        self.taipei_tz = pytz.timezone('Asia/Taipei')
        self.ny_tz = pytz.timezone('America/New_York')
    
    def is_dst_in_ny(self, date):
        """判斷該日期紐約是否為夏令時間"""
        # 將日期轉為紐約時間的午時來判斷
        dt = datetime.combine(date, datetime.min.time().replace(hour=12))
        dt_taipei = self.taipei_tz.localize(dt)
        dt_ny = dt_taipei.astimezone(self.ny_tz)
        return bool(dt_ny.dst())
    
    def get_ny_market_open_taipei_time(self, date):
        """
        取得某日期紐約開盤時間對應的台北時間
        紐約開盤：09:30
        """
        # 建立紐約開盤時間
        ny_open = datetime.combine(date, datetime.min.time().replace(hour=9, minute=30))
        ny_open = self.ny_tz.localize(ny_open)
        
        # 轉為台北時間
        taipei_open = ny_open.astimezone(self.taipei_tz)
        return taipei_open
    
    def get_pre_market_time(self, date, timeframe='M5'):
        """
        取得開盤前的目標時間（台北時間）
        預設取開盤前5分鐘
        """
        market_open = self.get_ny_market_open_taipei_time(date)
        pre_market = market_open - timedelta(minutes=5)
        return pre_market
    
    def taipei_str_to_datetime(self, date_str, time_str):
        """將台北時間字串轉為 datetime 物件"""
        dt_str = f"{date_str} {time_str}"
        dt = datetime.strptime(dt_str, "%m/%d/%Y %H:%M")
        return self.taipei_tz.localize(dt)