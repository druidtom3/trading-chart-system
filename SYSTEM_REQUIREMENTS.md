# 交易圖表系統完整需求文件

## 系統概述

這是一個基於 Web 的交易圖表分析系統，主要用於美股期貨（MNQ）的技術分析，特別專注於紐約開盤前的 Fair Value Gap (FVG) 檢測和可視化。

## 核心功能需求

### 1. 數據處理引擎
- **多時間框架支持**: M1, M5, M15, H1, H4, D1
- **數據格式**: OHLCV (不包含VWAP)
- **數據來源**: CSV 文件 (MNQ_[timeframe]_2019-2024.csv)
- **數據範圍**: 2019-2024年完整數據
- **時區處理**: 
  - **原始數據時區**: UTC
  - **美國東部時間**: 冬令時EST (UTC-5)，夏令時EDT (UTC-4)
  - **台北時間**: UTC+8 (固定不變)
  - **轉換邏輯**: UTC → 美東時間 → 台北時間顯示
  - **夏令時切換**: 3月第二個週日 02:00 開始EDT，11月第一個週日 02:00 回到EST
  - **市場時間**: 美東 09:30-16:00 對應台北時間 21:30-04:00 (EDT) 或 22:30-05:00 (EST)
- **假日檢測**: 美國股市假日和縮短交易時間檢測

### 2. FVG 技術指標檢測
- **演算法版本**: FVG Detector V4 實施 FVG 規則 V3
- **多頭 FVG 定義**: C.Close > C.Open AND C.Open > L.High AND L.High < R.Low
- **空頭 FVG 定義**: C.Close < C.Open AND C.Open < L.Low AND L.Low > R.High
- **清除條件**: 
  - 多頭 FVG: 價格跌破 (40根K線內有任何一根Candle Close < L.High)
  - 空頭 FVG: 價格突破 (40根K線內有任何一根Candle Close > L.Low)
- **狀態追蹤**: valid, cleared
- **實時更新**: 支持播放模式下的動態狀態更新

### 3. 圖表渲染系統
- **圖表庫**: Lightweight Charts v5 (直接使用最新版本)
- **K線顯示**: 傳統 OHLC 蠟燭圖
- **FVG 可視化**: 矩形覆蓋層顯示 gap 區域
- **顏色配置**:
  - 上漲 K線: 白色 (#FFFFFF)
  - 下跌 K線: 黑色 (#000000)
  - K線邊框: 黑色 (#000000)
  - K線燈芯: 黑色 (#000000)
  - FVG 矩形: 半透明覆蓋
- **交互功能**: 縮放、平移、十字線、手動畫線(手動畫線的顯示必須橫跨所有時間刻度分頁)

### 4. 時間分析功能
- **開盤前分析**: 紐約開盤前 5 分鐘數據截取
- **市場時段**: 9:30 AM - 4:00 PM EST
- **夏令時處理**: 自動 EDT/EST 切換
- **數據範圍**: 預設顯示 400 根 K線
- **時間格式**: Unix timestamp 轉換

### 5. 性能優化需求
- **向量化計算**: 使用 pandas 向量化操作和 numpy 批量計算提升數據處理速度
- **並行處理**: 多線程/多進程處理大量數據文件
- **內存優化**: 
  - 分批讀取大文件避免內存溢出
  - 智能數據截取 (大文件保留最近數據)
  - 及時釋放不需要的數據框
- **I/O 優化**:
  - CSV 讀取優化 (指定 dtype, 使用 engine='c')
  - 數據緩存機制減少重複計算
  - 預載入熱門時間框架數據
- **算法優化**: FVG 檢測使用向量化條件判斷取代循環

## 技術架構

### 後端 (Flask)
```
src/backend/
├── app.py                    # Flask 主應用
├── data_processor.py         # 數據處理核心
├── fvg_detector_v4.py       # FVG 檢測演算法
├── time_utils.py            # 時間轉換工具
├── us_holidays.py           # 美國假日檢測
└── candle_continuity_checker.py  # K線連續性檢查
```

### 前端 (HTML/JS)
```
src/frontend/
├── index-simple.html        # 簡化版界面
├── chart-manager.js         # 圖表管理器
├── data-manager.js          # 數據管理器
├── script-v2.js            # 主要邏輯
└── style-v2.css            # 樣式表
```

### 配置系統
```
src/utils/
├── config.py               # 基礎配置
└── continuity_config.py    # 性能優化配置
```

### 6. Debug 和維護系統
- **日誌記錄**: 
  - 多層級日誌 (DEBUG, INFO, WARNING, ERROR)
  - 數據處理過程詳細記錄
  - 性能監控和時間測量
  - API 調用追蹤
- **錯誤處理**:
  - 異常捕獲和詳細錯誤信息
  - 數據驗證和邊界檢查
  - 優雅降級機制
- **開發工具**:
  - 詳細的 console.log 輸出
  - 數據結構檢查和驗證
  - 性能分析工具集成

### 7. 載入進度系統
- **後端進度追蹤**:
  - 文件載入進度 (當前文件/總文件數)
  - 數據處理進度 (百分比顯示)
  - 預估剩餘時間計算
  - 詳細狀態信息 (當前處理步驟)
- **前端進度顯示**:
  - 視覺化進度條 (動畫效果)
  - 實時狀態更新
  - 載入過程詳細信息
  - 錯誤狀態指示

## API 端點規格

### 核心 API
```
GET /api/health              # 系統健康檢查
GET /api/loading-status      # 載入進度狀態
GET /api/random-data?timeframe=M15  # 隨機日期數據
GET /api/data/{date}/{timeframe}    # 指定日期數據
GET /api/timeframes          # 可用時間框架
```

### 響應格式
```json
{
  "date": "2024-03-28",
  "timeframe": "M15",
  "data": [
    {
      "time": 1711114200,
      "open": 18577.25,
      "high": 18585.5,
      "low": 18573.5,
      "close": 18580.0,
      "volume": 3349
    }
  ],
  "fvgs": [
    {
      "type": "bullish",
      "startPrice": 18570.0,
      "endPrice": 18575.0,
      "startTime": 1711114200,
      "endTime": 1711115100,
      "status": "valid"
    }
  ],
  "candle_count": 400,
  "ny_open_taipei": "2024-03-28 21:30:00",
  "ny_close_taipei": "2024-03-29 04:00:00",
  "is_dst": true,
  "holiday_info": {
    "is_holiday": false,
    "is_early_close": false,
    "status": "normal_trading"
  }
}
```

## 用戶界面需求

### 主要功能區域
1. **左側技術指標面板**
   - FVG 開關控制
   - 指標參數設置
   - 可收合展開

2. **頂部控制面板**
   - 時間框架選擇 (M1, M5, M15, H1, H4, D1)
   - 日期選擇器
   - 載入/刷新按鈕
   - 圖表版本顯示

3. **主圖表區域**
   - K線圖顯示
   - FVG 矩形覆蓋
   - 十字線價格顯示
   - 縮放和平移控制

4. **狀態信息區**
   - 當前日期
   - K線數量
   - FVG 數量
   - 市場開盤時間
   - 假日狀態

### 載入進度系統
- **視覺化進度條**: 顯示百分比和步驟
- **實時狀態**: 當前處理文件和進度
- **時間估算**: 剩餘載入時間
- **錯誤處理**: 載入失敗提示

## 性能指標

### 啟動性能目標
- 系統啟動: ≤ 10 秒
- 首次數據載入: ≤ 5 秒
- API 響應時間: ≤ 200ms
- 內存使用: ≤ 150MB
- 前端渲染: ≤ 2 秒

### 優化策略
1. **快速啟動模式**: 跳過大文件完整載入
2. **智能截取**: 大文件保留最近 200k 記錄
3. **向量化計算**: K線連續性檢查優化
4. **響應緩存**: API 結果緩存機制
5. **數據預載**: 熱門時間框架預處理

## 關鍵技術細節

### JSON 序列化處理
所有 numpy 數據類型必須轉換為原生 Python 類型：
```python
def _convert_to_json_serializable(self, obj):
    if isinstance(obj, np.integer): return int(obj)
    elif isinstance(obj, np.floating): return float(obj)
    elif isinstance(obj, np.ndarray): return obj.tolist()
    # ... 遞歸處理複雜對象
```

### 圖表配置
Lightweight Charts v5 配置：
```javascript
// v5 統一使用新 API
const series = chart.addSeries(LightweightCharts.SeriesType.Candlestick, {
    upColor: '#FFFFFF',        // 上漲白色
    downColor: '#000000',      // 下跌黑色
    borderUpColor: '#000000',  // 上漲邊框黑色
    borderDownColor: '#000000', // 下跌邊框黑色
    wickUpColor: '#000000',    // 上漲燈芯黑色
    wickDownColor: '#000000'   // 下跌燈芯黑色
});
```

### 時區轉換精度
```python
import pytz
from datetime import datetime

# 時區設定
utc_tz = pytz.UTC
taipei_tz = pytz.timezone('Asia/Taipei')      # UTC+8 固定
ny_tz = pytz.timezone('America/New_York')     # 自動處理 EDT/EST

# 轉換示例
def convert_market_time(utc_timestamp):
    """UTC → 美東時間 → 台北時間顯示"""
    # 1. UTC 時間
    utc_time = datetime.fromtimestamp(utc_timestamp, tz=utc_tz)
    
    # 2. 轉換為美東時間 (自動處理夏令時)
    ny_time = utc_time.astimezone(ny_tz)
    
    # 3. 轉換為台北時間顯示
    taipei_time = utc_time.astimezone(taipei_tz)
    
    return {
        'ny_time': ny_time,           # 美東時間 (含夏令時)
        'taipei_time': taipei_time,   # 台北時間
        'is_dst': ny_time.dst() != timedelta(0)  # 是否夏令時
    }

# 市場開盤時間計算
def get_market_open_taipei(date):
    """獲取指定日期市場開盤時間 (台北時間)"""
    # 美東 09:30
    ny_open = ny_tz.localize(datetime.combine(date, time(9, 30)))
    # 轉為台北時間
    taipei_open = ny_open.astimezone(taipei_tz)
    return taipei_open  # 夏令時 21:30, 冬令時 22:30
```

## 部署需求

### 系統依賴
```
Python >= 3.8
Flask >= 2.0
pandas >= 1.3
numpy >= 1.21
pytz >= 2021.1
```

### 啟動命令
```bash
python src/backend/app.py
# 訪問: http://127.0.0.1:5001/simple
```

### 目錄結構
```
trading_chart_system/
├── data/                    # CSV 數據文件
├── src/
│   ├── backend/            # 後端 Python 代碼
│   ├── frontend/           # 前端 HTML/JS/CSS
│   └── utils/              # 配置和工具
├── SYSTEM_REQUIREMENTS.md  # 本文件
└── README.md               # 使用說明
```

## 測試和驗證

### 功能測試檢查清單
- [ ] 載入進度條顯示正確百分比和狀態
- [ ] API 返回正確 JSON 格式 (無 VWAP 欄位)
- [ ] FVG 檢測準確性驗證
- [ ] 多時間框架切換正常
- [ ] 圖表渲染無錯誤 (白色上漲/黑色下跌)
- [ ] 時區轉換準確 (美東→台北時間)
- [ ] 假日狀態檢測
- [ ] Debug 日誌輸出完整
- [ ] 錯誤處理和異常捕獲
- [ ] 向量化計算性能提升

### 性能測試
- 向量化操作效能監控
- 內存使用和洩漏檢測
- API 響應時間測量
- 前端渲染性能分析
- 大數據量處理能力測試
- 載入進度準確性驗證

## 未來擴展建議

### 短期改進
1. 增加更多技術指標 (RSI, MACD, MA)
2. 支持多品種數據
3. 歷史回測功能
4. 數據導出功能

### 長期規劃
1. 實時數據接入
2. 移動端適配
3. 用戶個人化設置
4. 高級圖表分析工具
5. 機器學習預測模型

## 重建指南

若需要重新開發此系統，建議：

1. **優先考慮**: 微服務架構，獨立的數據處理服務
2. **技術選型**: FastAPI + React/Vue + WebSocket
3. **數據庫**: TimescaleDB 或 InfluxDB 用於時序數據
4. **前端圖表**: TradingView Charting Library 或 D3.js
5. **性能**: Redis 緩存 + CDN 加速
6. **部署**: Docker 容器化 + Kubernetes

---

**文件創建日期**: 2025-08-17  
**系統版本**: v1.0  
**最後測試**: 2025-08-17  
**狀態**: 功能完整，性能已優化