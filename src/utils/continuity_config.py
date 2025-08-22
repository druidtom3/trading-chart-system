# 檔名：continuity_config.py - K線連續性檢查配置

"""
K線連續性檢查優化配置

可選優化模式：
- 'basic': 基礎版本，添加進度條和基本優化
- 'smart': 智能跳躍，跳過已知的正常停盤時段
- 'parallel': 並行處理，使用多線程加速
- 'vectorized': 向量化運算，使用NumPy/Pandas加速
- 'hybrid': 混合優化，結合向量化和智能跳躍

建議配置：
- 開發環境: 'smart' (平衡速度和可讀性)
- 生產環境（小數據）: 'smart' 或 'hybrid'
- 生產環境（大數據）: 'vectorized' 或 'parallel'
"""

import os

# 從環境變量讀取，默認使用 'vectorized' 模式（最高性能）
CONTINUITY_CHECK_MODE = os.getenv('CONTINUITY_CHECK_MODE', 'vectorized')

# 是否顯示進度條（生產環境建議關閉以減少輸出）
SHOW_PROGRESS = os.getenv('SHOW_PROGRESS', 'true').lower() == 'true'

# 是否使用V2優化版本（默認啟用）
USE_V2_CHECKER = os.getenv('USE_V2_CHECKER', 'true').lower() == 'true'

# 快速啟動模式（跳過詳細檢查以加速啟動）- 啟用以獲得最快啟動速度
FAST_STARTUP = os.getenv('FAST_STARTUP', 'true').lower() == 'true'

# 超快速啟動模式（跳過大數據文件載入）
ULTRA_FAST_STARTUP = os.getenv('ULTRA_FAST_STARTUP', 'false').lower() == 'true'

# 快速啟動時跳過的大數據文件（按大小排序）
SKIP_LARGE_FILES_IN_FAST_MODE = ['M1', 'M5']  # 跳過最大的兩個文件

# 性能目標設置
PERFORMANCE_TARGETS = {
    'M1': {
        'max_time_seconds': 30,  # M1數據最多30秒
        'min_speed_klines_per_sec': 50000  # 至少50K K線/秒
    },
    'M5': {
        'max_time_seconds': 10,  # M5數據最多10秒
        'min_speed_klines_per_sec': 40000
    },
    'M15': {
        'max_time_seconds': 5,  # M15數據最多5秒
        'min_speed_klines_per_sec': 30000
    },
    'H1': {
        'max_time_seconds': 2,  # H1數據最多2秒
        'min_speed_klines_per_sec': 20000
    },
    'H4': {
        'max_time_seconds': 1,  # H4數據最多1秒
        'min_speed_klines_per_sec': 10000
    },
    'D1': {
        'max_time_seconds': 1,  # D1數據最多1秒
        'min_speed_klines_per_sec': 5000
    }
}

# 自動選擇最佳模式
def get_optimal_mode(data_size: int, timeframe: str) -> str:
    """
    根據數據量和時間框架自動選擇最佳優化模式
    
    Args:
        data_size: K線數量
        timeframe: 時間框架
        
    Returns:
        最佳優化模式
    """
    if data_size < 10000:
        # 小數據集
        return 'smart'
    elif data_size < 100000:
        # 中數據集
        return 'hybrid'
    else:
        # 大數據集
        if timeframe in ['M1', 'M5']:
            # 高頻數據用向量化
            return 'vectorized'
        else:
            # 低頻數據用並行
            return 'parallel'

# Progress bar style configuration
PROGRESS_BAR_CONFIG = {
    'width': 50,  # Progress bar width
    'fill_char': '#',  # Fill character
    'empty_char': '.',  # Empty character
    'show_eta': True,  # Show estimated time remaining
    'show_speed': True,  # Show processing speed
    'update_interval': 0.1  # Update interval (seconds)
}