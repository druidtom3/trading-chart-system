# 🗂️ 交易圖表系統 - 核心檔案結構

## 📁 專案根目錄結構
```
trading_chart_system/
├── 📂 src/                    # 核心源代碼
│   ├── 📂 backend/            # 後端Python代碼
│   ├── 📂 frontend/           # 前端JavaScript代碼
│   └── 📂 utils/              # 工具和配置
├── 📂 data/                   # K線數據CSV檔案
├── 📂 logs/                   # 系統日誌
├── 📂 ref/                    # 參考專案（可刪除）
├── 📂 backup_*/               # 備份資料夾（可刪除）
├── 📂 misc/                   # 雜項文件（可刪除）
└── 📂 docs/                   # 文檔
```

---

## 🔥 核心檔案清單

### 一、後端核心檔案 (Python)

#### 1. **主程式入口**
```
src/backend/app.py
```
- Flask應用主程式
- API端點定義
- 載入狀態管理

#### 2. **數據處理器**
```
src/backend/data_processor.py
```
- K線數據載入和處理
- FVG檢測調用
- 緩存管理
- 隨機日期選擇

#### 3. **FVG檢測器（簡化版 - 主要使用）**
```
src/backend/fvg_detector_simple.py
```
- 簡化的FVG檢測邏輯
- 正確的時間戳處理
- 清除條件檢查

#### 4. **時間工具**
```
src/backend/time_utils.py
```
- 時區轉換
- 交易時間計算
- DST處理

#### 5. **美國假日檢測**
```
src/backend/us_holidays.py
```
- 美國市場假日判斷
- 交易狀態檢查

---

### 二、前端核心檔案 (JavaScript)

#### 1. **主頁面**
```
src/frontend/index-v2.html
```
- 主要HTML頁面
- UI佈局
- 控制面板

#### 2. **圖表管理器**
```
src/frontend/chart-manager.js
```
- LightweightCharts管理
- K線圖表創建
- FVG渲染器調用

#### 3. **數據管理器**
```
src/frontend/data-manager.js
```
- API請求處理
- 數據緩存
- 載入狀態管理

#### 4. **FVG渲染器（優化版）**
```
src/frontend/fvg-renderer-optimized.js
```
- FVG視覺渲染
- LineSeries實現
- 40根K線長度限制

#### 5. **事件管理器**
```
src/frontend/event-manager.js
```
- 時間框架切換
- 按鈕事件處理
- UI交互邏輯

#### 6. **主腳本**
```
src/frontend/script-v2.js
```
- 應用初始化
- 組件協調
- 全局狀態管理

#### 7. **樣式表**
```
src/frontend/style-v2.css
```
- UI樣式定義
- 響應式佈局
- 深色主題

#### 8. **配置文件**
```
src/frontend/config.js
```
- 前端配置常量
- API端點設定
- 圖表配置

---

### 三、配置檔案

#### 1. **Python配置**
```
src/utils/config.py
```
- Flask設定
- 數據路徑
- K線數量限制（DEFAULT_CANDLE_COUNT）

#### 2. **載入配置**
```
src/utils/loading_config.py
```
- 性能優化設定
- 內存管理
- FVG檢測配置

#### 3. **連續性配置**
```
src/utils/continuity_config.py
```
- K線連續性檢查設定
- V2檢查器配置

---

### 四、數據檔案
```
data/MNQ_M1_2019-2024.csv   # 1分鐘K線
data/MNQ_M5_2019-2024.csv   # 5分鐘K線
data/MNQ_M15_2019-2024.csv  # 15分鐘K線
data/MNQ_H1_2019-2024.csv   # 1小時K線
data/MNQ_H4_2019-2024.csv   # 4小時K線
data/MNQ_D1_2019-2024.csv   # 日K線
```

---

### 五、重要文檔
```
RECURRING_ISSUES_TRACKER.md  # 問題追蹤文檔
CORE_FILES_STRUCTURE.md      # 本文檔
.claude/settings.local.json  # Claude權限設定
```

---

## 🗑️ 可刪除的檔案

### 測試檔案
```
test_*.bat
test_*.py
test_*.html
debug_*.html
demo_*.html
quick_test_*.bat
```

### 備份檔案
```
backup_*/
*-backup.*
*-v4-backup.*
```

### 臨時檔案
```
*.pyc
__pycache__/
logs/*.log (保留資料夾)
```

### 舊版本檔案
```
src/frontend/index.html (使用index-v2.html)
src/frontend/script.js (使用script-v2.js)
src/frontend/index-simple.html
```

### 未使用的FVG檢測器
```
src/backend/fvg_detector.py (v1版本)
src/backend/fvg_detector_v3.py
src/backend/fvg_detector_v4.py (有bug的版本)
```

### 未使用的前端渲染器
```
src/frontend/fvg-renderer.js (舊版)
src/frontend/fvg-renderer-v4-backup.js
src/frontend/fvg-renderer-v5.js
src/frontend/fvg-renderer-simple.js
```

### 參考資料
```
ref/ (整個資料夾，參考專案)
misc/ (雜項文件)
```

---

## 📊 檔案重要性分級

### 🔴 關鍵檔案（不可刪除）
- app.py
- data_processor.py
- fvg_detector_simple.py
- index-v2.html
- chart-manager.js
- data-manager.js
- fvg-renderer-optimized.js
- config.py

### 🟡 重要檔案（謹慎修改）
- time_utils.py
- us_holidays.py
- event-manager.js
- script-v2.js
- style-v2.css

### 🟢 輔助檔案（可按需修改）
- loading_config.py
- continuity_config.py
- playback-manager.js
- candleAggregator.js

---

## 💾 建議保留結構
```
trading_chart_system/
├── src/
│   ├── backend/
│   │   ├── app.py
│   │   ├── data_processor.py
│   │   ├── fvg_detector_simple.py
│   │   ├── time_utils.py
│   │   └── us_holidays.py
│   ├── frontend/
│   │   ├── index-v2.html
│   │   ├── chart-manager.js
│   │   ├── data-manager.js
│   │   ├── fvg-renderer-optimized.js
│   │   ├── fvg-renderer-multiline.js (備用)
│   │   ├── event-manager.js
│   │   ├── script-v2.js
│   │   ├── style-v2.css
│   │   └── config.js
│   └── utils/
│       ├── config.py
│       ├── loading_config.py
│       └── continuity_config.py
├── data/
│   └── *.csv (6個時間框架檔案)
├── logs/
├── docs/
├── RECURRING_ISSUES_TRACKER.md
└── CORE_FILES_STRUCTURE.md
```

---

## 🚀 啟動指令
```bash
# 啟動後端
cd src/backend
python app.py

# 開啟前端
start "" "src/frontend/index-v2.html"
```