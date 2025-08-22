# 📋 交易圖表系統 - 重複問題追蹤文檔

## 概述
本文檔記錄系統開發過程中**重複出現2次以上**的問題，包含問題描述、可能原因、相關檔案位置，以便後續除錯參考。

---

## 🔴 問題一：K線數量限制失效（出現5次以上）

### 問題描述
- 系統應該限制每個時間框架顯示400根K線
- 實際返回2000根K線
- 前端顯示 `candle_count: 2000`

### 可能原因
1. **後端硬編碼問題**
   - `detection_range_candles = 2000` 被硬編碼
   - 配置文件 `DEFAULT_CANDLE_COUNT` 未正確應用

2. **緩存未更新**
   - API響應被緩存，修改後未清除舊緩存
   - 緩存key版本未更新

### 相關檔案
```
src/backend/data_processor.py - Line 503: detection_range_candles 設定
src/utils/config.py - DEFAULT_CANDLE_COUNT 配置
src/frontend/data-manager.js - Line 63-67: 前端數據保護
```

### 檢查命令
```bash
# 檢查API返回的K線數量
curl -s "http://localhost:5001/api/random-data?timeframe=M15" | python -c "import json, sys; data = json.load(sys.stdin); print('Candle count:', data.get('candle_count'))"
```

---

## 🔴 問題二：FVG時間戳格式錯誤（出現4次以上）

### 問題描述
- FVG的 `startTime` 和 `endTime` 變成小數（如 1.706254）
- 應該是Unix秒級時間戳（如 1706254200）
- 導致前端無法正確渲染FVG

### 可能原因
1. **檢測器回退問題**
   - 簡化檢測器（fvg_detector_simple.py）執行失敗
   - 回退到v4檢測器，其 `_safe_timestamp` 方法返回索引值而非時間戳

2. **時間戳轉換錯誤**
   - v4檢測器的 Line 491: `return float(fallback_index)`
   - 當時間戳不在合理範圍時，返回索引值

### 相關檔案
```
src/backend/fvg_detector_simple.py - Line 121-123: 正確的時間戳處理
src/backend/fvg_detector_v4.py - Line 475-491: _safe_timestamp 方法
src/backend/data_processor.py - Line 417-431: 檢測器回退邏輯
```

### 檢查命令
```bash
# 檢查FVG時間格式
curl -s "http://localhost:5001/api/random-data?timeframe=M15" | python -c "import json, sys; data = json.load(sys.stdin); fvg = data['fvgs'][0] if data.get('fvgs') else {}; print('FVG startTime:', fvg.get('startTime', 'N/A'))"
```

---

## 🔴 問題三：緩存導致修改不生效（出現3次以上）

### 問題描述
- 修改代碼後，前端仍顯示舊數據
- FVG檢測條件修正後，結果未改變
- 重新整理頁面無效

### 可能原因
1. **多層緩存機制**
   - 後端API響應緩存 (`_response_cache`)
   - 後端處理數據緩存 (`_processed_data_cache`)
   - 前端數據緩存 (`dataCache`)

2. **緩存key未更新**
   - 緩存key版本號未遞增（v3→v4→v5→v6→v7）

### 相關檔案
```
src/backend/data_processor.py - Line 452: cache_key 定義
src/backend/data_processor.py - Line 902-920: 緩存方法
src/frontend/data-manager.js - Line 71-72: 前端緩存
src/backend/app.py - Line 309-318: /api/clear-cache 端點
```

### 清除緩存方法
```javascript
// 前端控制台執行
window.clearAllCache()

// 後端API調用
curl -X GET http://localhost:5001/api/clear-cache
```

---

## 🔴 問題四：FVG檢測條件錯誤（出現3次）

### 問題描述
- FVG檢測數量異常少
- 檢測條件使用錯誤的價格比較

### 錯誤條件 vs 正確條件
```python
# ❌ 錯誤（使用開盤價）
C['Open'] > L['High']  # 多頭
C['Open'] < L['Low']   # 空頭

# ✅ 正確（使用收盤價）
C['Close'] > L['High'] # 多頭
C['Close'] < L['Low']  # 空頭
```

### 相關檔案
```
src/backend/fvg_detector_simple.py - Line 69-86: FVG檢測條件
src/backend/fvg_detector_v4.py - Line 136-138: v4檢測條件（錯誤版本）
```

---

## 🔴 問題五：Maximum call stack size exceeded（出現2次）

### 問題描述
- 切換時間框架分頁時出現堆疊溢出
- Console過載無響應
- 頁面凍結

### 可能原因
1. **創建過多LineSeries**
   - 每個FVG創建2個LineSeries
   - FVG數量過多時（>100個）導致遞迴溢出

2. **過多console輸出**
   - 每個FVG都輸出詳細日誌
   - 在迴圈中大量使用console.log

3. **無限遞迴**
   - 時間戳格式錯誤導致無限循環
   - clear()方法可能觸發重新渲染

### 相關檔案
```
src/frontend/fvg-renderer-optimized.js - Line 25-30: FVG數量限制
src/frontend/fvg-renderer-optimized.js - Line 81-84: Console輸出控制
src/frontend/fvg-renderer-multiline.js - Line 1915-1916: 時間戳轉換
```

---

## 🔴 問題六：FVG線長度問題（出現3次）

### 問題描述
- FVG線橫跨整個圖表畫面
- 應該只延伸40根K線長度

### 原因
1. **使用錯誤的API**
   - `createPriceLine()` 創建無限長水平線
   - 應使用 `addLineSeries()` 創建有限長度線段

### 相關檔案
```
src/frontend/fvg-renderer-optimized.js - Line 137-182: LineSeries實現
src/frontend/fvg-renderer-optimized.js - Line 124-134: 40根K線長度計算
```

---

## 🟡 問題七：毫秒/秒級時間戳混淆（出現2次）

### 問題描述
- 前端自動將秒級時間戳轉為毫秒 `if (time < 1000000000000) time *= 1000`
- 導致時間計算錯誤

### 相關檔案
```
src/frontend/fvg-renderer-multiline.js - Line 1915-1916: 自動轉換邏輯（已移除）
src/backend/fvg_detector_v4.py - Line 409-410: 毫秒轉換（已修正）
```

---

## 🟡 問題八：多個後端實例運行（出現2次）

### 問題描述
- 多個Python進程同時運行
- 端口佔用問題
- 資源浪費

### 檢查命令
```bash
# 檢查Python進程
tasklist | grep -i python

# 檢查5001端口
powershell -Command "Get-NetTCPConnection -LocalPort 5001"

# 終止進程
taskkill /F /PID [進程ID]
```

---

## 🔧 通用除錯建議

### 1. 檢查數據流
```bash
# 後端API響應
curl -s http://localhost:5001/api/random-data?timeframe=M15 | python -m json.tool | head -50

# 檢查FVG數據
curl -s http://localhost:5001/api/random-data?timeframe=M15 | python -c "import json, sys; data = json.load(sys.stdin); print('FVGs:', len(data.get('fvgs', [])), 'Candles:', data.get('candle_count'))"
```

### 2. 清理環境
```bash
# 終止所有Python進程
taskkill /F /IM python.exe

# 清除日誌
del logs\*.log

# 重啟服務
cd src/backend && python app.py
```

### 3. 驗證修改
- 修改後端後，更新緩存key版本號
- 修改前端後，強制刷新瀏覽器（Ctrl+F5）
- 使用開發者工具的Network面板確認請求

---

## 📝 備註

- 更新日期：2024-08-21
- 建議定期更新此文檔，記錄新發現的重複問題
- 每個問題都應包含：出現次數、檢查方法、相關檔案位置