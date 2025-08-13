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

# 預設時間刻度
DEFAULT_TIMEFRAME = 'M15'

# 紐約交易所開盤時間 (09:30)
NYSE_OPEN_HOUR = 9
NYSE_OPEN_MINUTE = 30

# Flask 設定
FLASK_HOST = '127.0.0.1'
FLASK_PORT = 5000
FLASK_DEBUG = True