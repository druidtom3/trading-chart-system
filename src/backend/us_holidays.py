# 檔名：us_holidays.py

from datetime import datetime, date, timedelta
from typing import Union, Optional, Dict, Set
import calendar

class USHolidayDetector:
    """
    美國股市假日檢測器
    
    檢測美國股市休市日及縮短交易時間的日子
    使用內建邏輯，不依賴外部庫
    """
    
    def __init__(self):
        """初始化假日檢測器"""
        # 固定日期假日
        self.fixed_holidays = {
            (1, 1): "新年",
            (7, 4): "獨立日", 
            (12, 25): "聖誕節",
        }
        
        # 縮短交易時間的日子（通常在假日前一天）
        self.early_close_dates = self._get_early_close_dates()
    
    def _get_early_close_dates(self) -> set:
        """
        獲取縮短交易時間的日期
        通常包括：
        - 感恩節後的星期五（Black Friday）
        - 聖誕節前夕 
        - 新年前夕
        """
        # 返回一些常見的縮短交易日期
        return {
            (11, 29),  # 感恩節後的黑色星期五（示例）
            (12, 24),  # 聖誕節前夕
            (12, 31),  # 新年前夕
        }
    
    def _get_nth_weekday(self, year: int, month: int, weekday: int, n: int) -> date:
        """
        獲取指定年月的第n個星期幾
        
        Args:
            year: 年份
            month: 月份
            weekday: 星期幾 (0=Monday, 6=Sunday)
            n: 第幾個 (1=第一個, -1=最後一個)
        """
        if n > 0:
            # 第n個星期幾
            first_day = date(year, month, 1)
            first_weekday = first_day.weekday()
            
            # 計算第一個指定星期幾的日期
            days_ahead = weekday - first_weekday
            if days_ahead < 0:
                days_ahead += 7
            
            target_date = first_day + timedelta(days=days_ahead + (n-1) * 7)
            
            # 確保還在同一個月
            if target_date.month == month:
                return target_date
        else:
            # 最後一個星期幾
            last_day = date(year, month, calendar.monthrange(year, month)[1])
            last_weekday = last_day.weekday()
            
            # 計算最後一個指定星期幾的日期
            days_back = last_weekday - weekday
            if days_back < 0:
                days_back += 7
            
            return last_day - timedelta(days=days_back)
        
        return date(year, month, 1)  # 默認返回
    
    def _get_holidays_for_year(self, year: int) -> Dict[date, str]:
        """獲取指定年份的所有假日"""
        holidays = {}
        
        # 固定日期假日
        for (month, day), name in self.fixed_holidays.items():
            holiday_date = date(year, month, day)
            
            # 如果假日在週末，則順延
            if holiday_date.weekday() == 5:  # 星期六
                holiday_date += timedelta(days=2)  # 順延到星期一
            elif holiday_date.weekday() == 6:  # 星期日
                holiday_date += timedelta(days=1)  # 順延到星期一
            
            holidays[holiday_date] = name
        
        # 變動日期假日
        # 馬丁·路德·金紀念日 (1月第三個星期一)
        holidays[self._get_nth_weekday(year, 1, 0, 3)] = "馬丁路德金紀念日"
        
        # 總統日 (2月第三個星期一)  
        holidays[self._get_nth_weekday(year, 2, 0, 3)] = "總統日"
        
        # 復活節星期五（復活節前的星期五）
        easter_date = self._calculate_easter(year)
        good_friday = easter_date - timedelta(days=2)
        holidays[good_friday] = "復活節星期五"
        
        # 陣亡將士紀念日 (5月最後一個星期一)
        holidays[self._get_nth_weekday(year, 5, 0, -1)] = "陣亡將士紀念日"
        
        # 勞動節 (9月第一個星期一)
        holidays[self._get_nth_weekday(year, 9, 0, 1)] = "勞動節"
        
        # 感恩節 (11月第四個星期四)
        holidays[self._get_nth_weekday(year, 11, 3, 4)] = "感恩節"
        
        return holidays
    
    def _calculate_easter(self, year: int) -> date:
        """計算復活節日期（使用演算法）"""
        # 使用簡化的復活節計算
        # 這是一個簡化版本，對於大部分年份是準確的
        a = year % 19
        b = year // 100
        c = year % 100
        d = b // 4
        e = b % 4
        f = (b + 8) // 25
        g = (b - f + 1) // 3
        h = (19 * a + b - d - g + 15) % 30
        i = c // 4
        k = c % 4
        l = (32 + 2 * e + 2 * i - h - k) % 7
        m = (a + 11 * h + 22 * l) // 451
        month = (h + l - 7 * m + 114) // 31
        day = ((h + l - 7 * m + 114) % 31) + 1
        
        return date(year, month, day)
    
    def is_market_holiday(self, check_date: Union[str, datetime, date]) -> bool:
        """
        檢查是否為股市假日
        
        Args:
            check_date: 要檢查的日期，支持字符串、datetime或date對象
            
        Returns:
            bool: True表示是假日，False表示不是
        """
        if isinstance(check_date, str):
            # 支持多種日期格式
            try:
                if '-' in check_date:
                    check_date = datetime.strptime(check_date, '%Y-%m-%d').date()
                else:
                    check_date = datetime.strptime(check_date, '%Y%m%d').date()
            except ValueError:
                return False
        elif isinstance(check_date, datetime):
            check_date = check_date.date()
        
        # 獲取該年的所有假日
        year_holidays = self._get_holidays_for_year(check_date.year)
        return check_date in year_holidays
    
    def is_early_close(self, check_date: Union[str, datetime, date]) -> bool:
        """
        檢查是否為縮短交易時間日
        
        Args:
            check_date: 要檢查的日期
            
        Returns:
            bool: True表示是縮短交易日，False表示不是
        """
        if isinstance(check_date, str):
            try:
                if '-' in check_date:
                    check_date = datetime.strptime(check_date, '%Y-%m-%d').date()
                else:
                    check_date = datetime.strptime(check_date, '%Y%m%d').date()
            except ValueError:
                return False
        elif isinstance(check_date, datetime):
            check_date = check_date.date()
            
        # 檢查是否為縮短交易時間的月日組合
        return (check_date.month, check_date.day) in self.early_close_dates
    
    def get_holiday_name(self, check_date: Union[str, datetime, date]) -> Optional[str]:
        """
        獲取假日名稱
        
        Args:
            check_date: 要檢查的日期
            
        Returns:
            Optional[str]: 假日名稱，如果不是假日則返回None
        """
        if isinstance(check_date, str):
            try:
                if '-' in check_date:
                    check_date = datetime.strptime(check_date, '%Y-%m-%d').date()
                else:
                    check_date = datetime.strptime(check_date, '%Y%m%d').date()
            except ValueError:
                return None
        elif isinstance(check_date, datetime):
            check_date = check_date.date()
        
        # 獲取該年的所有假日
        year_holidays = self._get_holidays_for_year(check_date.year)
        return year_holidays.get(check_date)
    
    def get_trading_status(self, check_date: Union[str, datetime, date]) -> dict:
        """
        獲取交易狀態資訊
        
        Args:
            check_date: 要檢查的日期
            
        Returns:
            dict: 包含交易狀態的字典
                - is_holiday: 是否為假日
                - is_early_close: 是否為縮短交易日
                - holiday_name: 假日名稱（如果有）
                - status: 交易狀態描述
        """
        is_holiday = self.is_market_holiday(check_date)
        is_early_close = self.is_early_close(check_date)
        holiday_name = self.get_holiday_name(check_date)
        
        if is_holiday:
            status = f"休市 - {holiday_name}" if holiday_name else "休市"
        elif is_early_close:
            status = "縮短交易時間"
        else:
            status = "正常交易"
        
        return {
            "is_holiday": is_holiday,
            "is_early_close": is_early_close,
            "holiday_name": holiday_name,
            "status": status
        }

# 全域實例
holiday_detector = USHolidayDetector()