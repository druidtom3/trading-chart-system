# 檔名：__init__.py

from .base_indicator import BaseIndicator, IndicatorManager
from .fvg_indicator import FVGIndicator

# 預設的指標管理器實例
default_manager = IndicatorManager()

# 註冊預設指標
default_manager.register_indicator(FVGIndicator())

__all__ = ['BaseIndicator', 'IndicatorManager', 'FVGIndicator', 'default_manager']