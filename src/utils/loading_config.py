# 檔名：loading_config.py - 性能優化配置

import os

# 性能優化載入配置 - 基於參考專案的成功經驗
LOADING_CONFIG = {
    "batch_size": 10000,
    "max_file_rows": 200000,
    "use_vectorization": True,
    "enable_caching": True,
    "use_float32": True,  # 使用32位浮點數節省50%內存
    "optimize_dtypes": True,  # 優化數據類型
    "parallel_loading": False,  # 在單線程環境中保持False
    "chunk_size": 5000  # 數據塊大小
}

# 數據類型優化映射
OPTIMIZED_DTYPES = {
    'Open': 'float32',
    'High': 'float32', 
    'Low': 'float32',
    'Close': 'float32',
    'Volume': 'int32'  # 32位整數足夠處理交易量
}

# 內存優化設置
MEMORY_CONFIG = {
    "max_cache_size": 20,  # 減少緩存大小
    "preload_days": 7,     # 減少預載入天數
    "gc_frequency": 100,   # 垃圾回收頻率
    "clear_unused_data": True
}

# FVG渲染性能配置
FVG_PERFORMANCE_CONFIG = {
    "use_price_lines": True,  # 使用PriceLine而不是大量LineSeries
    "max_fvg_count": 50,     # 限制FVG數量
    "render_batch_size": 10, # 批量渲染大小
    "enable_render_throttle": True  # 啟用渲染節流
}

# 快速啟動模式配置
FAST_STARTUP_CONFIG = {
    "enable_fast_startup": True,
    "skip_continuity_check": False,  # 保持連續性檢查
    "reduce_initial_data": True,     # 減少初始載入數據量
    "defer_heavy_calculations": True  # 延遲重計算
}