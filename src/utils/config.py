# 檔名：config.py

import os

# 專案根目錄
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# 資料檔案設定
DATA_DIR = os.path.join(PROJECT_ROOT, 'data')
LOG_DIR = os.path.join(PROJECT_ROOT, 'logs')

# CSV 檔案對應 - 新增 M15 和 D1
CSV_FILES = {
    'M1': 'MNQ_M1_2019-2024.csv',
    'M5': 'MNQ_M5_2019-2024.csv',
    'M15': 'MNQ_M15_2019-2024.csv',
    'H1': 'MNQ_H1_2019-2024.csv',
    'H4': 'MNQ_H4_2019-2024.csv',
    'D1': 'MNQ_D1_2019-2024.csv'
}

# 時間刻度對應的預設顯示K線數量 - 統一 400 根
DEFAULT_CANDLE_COUNT = {
    'M1': 400,
    'M5': 400,
    'M15': 400,
    'H1': 400,
    'H4': 400,
    'D1': 400
}

# 隨機日期範圍配置
RANDOM_DATE_CONFIG = {
    'start_date': None,  # 暫時停用固定起始日期，使用所有可用數據
    'strategy': 'intersection',  # intersection: 取交集, union: 取聯集, explicit: 明確範圍
    'exclude_weekends': False,   # 是否排除週末（D1已經自動排除了交易日外的日期）
    'description': '從2019-05-20開始，避免早期數據不完整問題'
}

# 預設時間刻度
DEFAULT_TIMEFRAME = 'M15'

# 紐約交易所開盤時間 (09:30)
NYSE_OPEN_HOUR = 9
NYSE_OPEN_MINUTE = 30

# FVG檢測配置
FVG_CLEARING_WINDOW = 40  # FVG清除窗口（K線數）

# 緩存配置
CACHE_MAX_SIZE = 20  # 緩存最大條目數
CACHE_VERSION = 'v8'  # 緩存版本號

# 數據處理配置
MAX_RECORDS_LIMIT = 10000  # 最大記錄數限制（非M1時間框架）
MEMORY_OPTIMIZATION_THRESHOLD = 400  # 內存優化閾值

# Flask 設定
FLASK_HOST = '127.0.0.1'
FLASK_PORT = 5001
FLASK_DEBUG = False  # 生產環境應該設為False