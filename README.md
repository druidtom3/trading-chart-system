# 交易圖表系統 - Trading Chart System

一個專為分析紐約開盤前市場行為而設計的交易圖表系統，具備 Fair Value Gap (FVG) 檢測、美國假日標示和多時間框架分析功能。

## 功能特色

### 核心功能
- **Fair Value Gap (FVG) 檢測**: 自動檢測並顯示價格空隙，支援三根結構和跳空模式
- **多時間框架支援**: M1, M5, M15, H1, H4, D1
- **美國假日檢測**: 自動標示美國市場假日和早收日
- **即時播放模式**: 模擬實時K線更新
- **互動式圖表**: 基於 Lightweight Charts 的高效能圖表

### FVG 檢測特色
- **IoU 去重技術**: 避免重複檢測相同區域的 FVG
- **雙模式檢測**: 支援三根結構和跳空檢測
- **可配置參數**: 檢測範圍、顯示長度、存活期限
- **視覺化優化**: 半透明顯示，像素級精確度

## 系統架構

```
trading_chart_system/
├── src/
│   ├── backend/           # Python Flask 後端
│   │   ├── app.py         # 主應用程式
│   │   ├── data_processor.py  # 資料處理器
│   │   ├── fvg_detector.py    # FVG 檢測器
│   │   └── us_holidays.py     # 美國假日檢測
│   └── frontend/          # JavaScript 前端
│       ├── index.html     # 主頁面
│       ├── script.js      # 主要邏輯
│       └── style.css      # 樣式表
├── data/                  # 市場資料 (CSV 格式)
├── docs/                  # 文檔
└── requirements.txt       # Python 依賴
```

## 安裝與設置

### 環境要求
- Python 3.8+
- 現代瀏覽器 (Chrome, Firefox, Safari, Edge)

### 安裝步驟

1. **克隆專案**
```bash
git clone https://github.com/your-username/trading_chart_system.git
cd trading_chart_system
```

2. **安裝 Python 依賴**
```bash
pip install -r requirements.txt
```

3. **準備資料**
   - 將市場資料 CSV 文件放置在 `data/` 目錄
   - 支援的格式: `Symbol_Timeframe_StartYear-EndYear.csv`

4. **啟動系統**

   **方法一: 使用批次檔 (Windows)**
   ```bash
   start.bat
   ```

   **方法二: 手動啟動**
   ```bash
   cd src/backend
   python app.py
   ```

5. **訪問應用**
   - 開啟瀏覽器訪問: `http://127.0.0.1:5000`

## 使用說明

### 基本操作
1. **時間框架切換**: 點擊上方的 M1, M5, M15, H1, H4, D1 標籤
2. **隨機日期**: 點擊「隨機日期」按鈕載入不同交易日資料
3. **FVG 開關**: 點擊「FVG 開」/「FVG 關」切換顯示
4. **播放控制**: 使用播放按鈕模擬實時K線更新

### 參數配置

#### 後端參數 (data_processor.py)
```python
detection_range_candles = 400  # FVG檢測範圍 (圖表顯示的K線數量)
```

#### FVG 檢測器參數 (fvg_detector.py)
```python
max_age = 400  # FVG存活期限 (多少根K線後過期)
require_dir_continuity = False  # 是否要求方向連續性
```

#### 前端參數 (script.js)
```javascript
const fvgDisplayLength = 40;  // FVG顯示長度 (40根K線)
```

## 技術細節

### FVG 檢測邏輯
1. **三根結構檢測**: 檢測左高 < 右低 (看多) 或 左低 > 右高 (看空) 的模式
2. **跳空檢測**: 檢測同方向實體的跳空缺口
3. **IoU 去重**: 使用 Intersection over Union 避免重複檢測
4. **回補檢測**: 單根K線實體完全覆蓋 FVG 即視為回補

### 資料格式
CSV 檔案需包含以下欄位:
- DateTime: 時間戳記
- Open: 開盤價
- High: 最高價  
- Low: 最低價
- Close: 收盤價
- Volume: 成交量

## 版本歷史

### v1.0.0 (2024-08-13)
- ✅ 基礎 FVG 檢測功能
- ✅ IoU 去重算法
- ✅ 美國假日檢測
- ✅ 多時間框架支援
- ✅ 互動式播放模式
- ✅ 參數優化和命名清理

## 開發團隊

本專案由 Claude (Anthropic) 協助開發，專注於金融市場分析工具的創新應用。

## 授權

本專案採用 MIT 授權條款。

## 貢獻

歡迎提交 Issue 和 Pull Request 來改善這個專案！

### 開發指引
- 遵循既有的代碼風格
- 添加適當的註釋和文檔
- 測試新功能確保不會破壞現有功能

## 聯絡方式

如有問題或建議，請透過 GitHub Issues 聯繫。