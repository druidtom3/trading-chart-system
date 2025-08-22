# 交易圖表系統問題排查手冊 - 2025/08/20

本文檔記錄了2025年8月20日在交易圖表系統開發過程中遇到的問題、診斷方法和解決方案，可作為日後排查類似問題的參考。

## 目錄
1. [FVG顯示問題](#1-fvg顯示問題)
2. [播放系統切換時間框架問題](#2-播放系統切換時間框架問題)
3. [Value is null錯誤診斷](#3-value-is-null錯誤診斷)
4. [H1時間框架跳空問題](#4-h1時間框架跳空問題)
5. [後端進程管理問題](#5-後端進程管理問題)
6. [系統診斷工具](#6-系統診斷工具)

---

## 1. FVG顯示問題

### 問題描述
- FVG複選框已勾選，但圖表上看不到半透明矩形
- 切換分頁時出現錯誤：`this.candlestickSeries.setMarkers is not a function`

### 根本原因
1. **API兼容性問題**：Lightweight Charts v5 API變更，`setMarkers` 方法不存在
2. **FVG渲染器缺失方法**：`setVisible()`, `getVisible()`, `clearAll()` 方法未實現
3. **數據格式不匹配**：FVG數據使用 `topPrice/bottomPrice`，但渲染器期望 `startPrice/endPrice`
4. **默認設置問題**：`showClearedFVGs` 默認為 `false`，隱藏了已清除的FVG

### 診斷方法
```javascript
// 1. 檢查FVG渲染器狀態
console.log('FVG渲染器存在:', !!window.chartManager.fvgRenderer);
console.log('FVG渲染器可見:', window.chartManager.fvgRenderer.getVisible());

// 2. 檢查FVG數據格式
console.log('FVG數據:', window.currentData.fvgs);

// 3. 檢查API兼容性
console.log('setMarkers方法存在:', typeof window.chartManager.candlestickSeries.setMarkers);
```

### 解決方案
```javascript
// 1. 添加v4/v5兼容性包裝器
setMarkers(markers) {
    if (this.candlestickSeries && typeof this.candlestickSeries.setMarkers === 'function') {
        this.candlestickSeries.setMarkers(markers);
    } else {
        console.warn('setMarkers方法不可用，可能是v5 API變更');
    }
}

// 2. 實現缺失的方法
setVisible(visible) {
    this.isVisible = visible;
    this.updateVisibility();
}

// 3. 修復數據格式適配
const adaptedFvg = {
    ...fvg,
    startPrice: fvg.topPrice,
    endPrice: fvg.bottomPrice
};
```

### 相關文件
- `src/frontend/fvg-renderer-multiline.js`
- `src/frontend/chart-manager.js`

---

## 2. 播放系統切換時間框架問題

### 問題描述
從M1播放切換到M15時，只看到一根動態K線，歷史K線全部消失

### 根本原因
1. **缺失方法**：`DataManager` 中沒有 `getCachedData()` 方法
2. **註釋代碼**：`combineHistoricalAndPlaybackData()` 中歷史數據獲取邏輯被註釋
3. **數據合併邏輯缺陷**：只顯示播放產生的K線，忽略歷史數據

### 診斷方法
```javascript
// 1. 檢查快取數據
console.log('有快取數據:', window.dataManager.hasCachedData('2024-01-01', 'M15'));
console.log('getCachedData方法存在:', typeof window.dataManager.getCachedData);

// 2. 檢查播放狀態
const playbackState = window.playbackManager.getPlaybackState();
console.log('播放狀態:', playbackState);

// 3. 檢查數據合併
console.log('歷史數據長度:', historicalData?.data?.length);
console.log('播放數據長度:', playbackCandles.length);
```

### 解決方案
```javascript
// 1. 添加缺失的getCachedData方法
getCachedData(date, timeframe) {
    const cacheKey = `${date}-${timeframe}`;
    return this.dataCache.get(cacheKey);
}

// 2. 修復數據合併邏輯
async combineHistoricalAndPlaybackData(timeframe) {
    // 獲取歷史數據
    let historicalData = null;
    if (this.dataManager.hasCachedData(currentData.date, timeframe)) {
        historicalData = this.dataManager.getCachedData(currentData.date, timeframe);
    }
    
    // 合併數據
    let combinedData = [];
    if (historicalData && historicalData.data) {
        combinedData = [...historicalData.data];
    }
    
    // 添加播放數據
    const newPlaybackCandles = playbackCandles.filter(candle => 
        candle.time > lastHistoricalTime
    );
    combinedData = combinedData.concat(newPlaybackCandles);
    
    this.chartManager.updateData(combinedData);
}
```

### 相關文件
- `src/frontend/playback-manager.js:347-410`
- `src/frontend/data-manager.js:278-284`

---

## 3. Value is null錯誤診斷

### 問題描述
間歇性出現 "Value is null" 錯誤，導致圖表渲染失敗

### 根本原因
1. **時間戳格式錯誤**：FVG數據中時間戳為小數格式（如1.706254）而非標準Unix時間戳
2. **數據驗證缺失**：沒有檢查數據完整性的機制
3. **錯誤追踪不足**：難以定位錯誤來源

### 診斷方法
```javascript
// 1. 檢查數據格式
const firstCandle = window.currentData.data[0];
console.log('第一根K線:', firstCandle);
Object.entries(firstCandle).forEach(([key, value]) => {
    if (value === null) console.error('發現null值:', key);
});

// 2. 運行數據驗證器
if (window.dataValidator) {
    const report = window.dataValidator.getValidationReport();
    console.log('驗證報告:', report);
}

// 3. 檢查錯誤監控
if (window.errorMonitor) {
    const errors = window.errorMonitor.getErrorReport();
    console.log('錯誤報告:', errors);
}
```

### 解決方案
```javascript
// 1. 時間戳格式驗證和轉換
validateAndFixTimestamp(timestamp) {
    if (timestamp < 1000000000) {
        // 看起來像小數格式，轉換為毫秒
        timestamp = Math.floor(timestamp * 1000);
    }
    return Math.floor(timestamp); // 確保是整數
}

// 2. 建立數據驗證器
class DataValidator {
    validateCandleData(data, source = 'Unknown') {
        const results = {
            source,
            totalItems: data.length,
            invalidItems: [],
            nullFields: {},
            valid: true
        };
        
        const requiredFields = ['time', 'open', 'high', 'low', 'close'];
        
        for (let i = 0; i < data.length; i++) {
            const item = data[i];
            const itemErrors = [];
            
            requiredFields.forEach(field => {
                if (item[field] === null || item[field] === undefined) {
                    itemErrors.push(`${field} is null/undefined`);
                    results.nullFields[field] = (results.nullFields[field] || 0) + 1;
                }
            });
            
            if (itemErrors.length > 0) {
                results.invalidItems.push({ index: i, errors: itemErrors, item });
                results.valid = false;
            }
        }
        
        return results;
    }
}

// 3. 建立錯誤監控器
class ErrorMonitor {
    logNullValueError(errorText, originalArgs) {
        const nullError = {
            timestamp: new Date().toISOString(),
            message: errorText,
            context: this.getCurrentContext(),
            stackTrace: new Error().stack
        };
        
        this.nullValueErrors.push(nullError);
        this.triggerNullValueDiagnostics();
    }
}
```

### 相關文件
- `src/frontend/data-validator.js`
- `src/frontend/error-monitor.js`
- `src/frontend/fvg-renderer-multiline.js:67-73`

---

## 4. H1時間框架跳空問題

### 問題描述
H1時間框架出現不合理的跳空，特別是在週末期間

### 根本原因
1. **週末跳空處理不當**：系統在週末休市期間填補了不必要的平盤K線
2. **跳空檢測過於簡化**：沒有區分正常的週末跳空和異常跳空
3. **交易時間判斷缺失**：沒有考慮市場休市時間

### 診斷方法
```javascript
// 1. 檢查跳空檢測日誌
// 在控制台查看類似信息：
// "⚠️ H1 跳空檢測: 預期 2024-01-05 22:00, 實際 2024-01-08 17:00, 跳空 67 小時"

// 2. 驗證週末跳空識別
function checkWeekendGap(lastTime, nextTime) {
    const lastDate = new Date(lastTime * 1000);
    const nextDate = new Date(nextTime * 1000);
    const lastDay = lastDate.getDay();
    const nextDay = nextDate.getDay();
    const gapHours = (nextTime - lastTime) / 3600;
    
    console.log(`跳空分析: ${lastDate.toLocaleString()} (${lastDay}) -> ${nextDate.toLocaleString()} (${nextDay})`);
    console.log(`跳空時間: ${gapHours} 小時`);
}

// 3. 檢查K線聚合器狀態
console.log('聚合器狀態:', window.playbackManager.candleAggregator.completedCandles);
```

### 解決方案
```javascript
// 1. 智能週末跳空識別
isWeekendGap(lastTime, nextTime) {
    const lastDate = new Date(lastTime * 1000);
    const nextDate = new Date(nextTime * 1000);
    const lastDay = lastDate.getDay();
    const nextDay = nextDate.getDay();
    
    // 檢查是否跨越週末 (週五->週一, 週五->週日, 週六->週一)
    if ((lastDay === 5 && (nextDay === 1 || nextDay === 0)) ||
        (lastDay === 6 && nextDay === 1)) {
        const gapHours = (nextTime - lastTime) / 3600;
        // 週末跳空通常是40-65小時
        if (gapHours >= 30 && gapHours <= 80) {
            return true;
        }
    }
    return false;
}

// 2. 改進的跳空處理
if (alignedTime > expectedNext) {
    const gapHours = (alignedTime - expectedNext) / 3600;
    console.warn(`跳空檢測: 跳空 ${gapHours} 小時`);
    
    // 檢查是否為週末跳空（不填補）
    if (!this.isWeekendGap(currentCandle.time, alignedTime)) {
        this.fillMissingCandles(timeframe, expectedNext, alignedTime, currentCandle);
    } else {
        console.log('週末跳空，不填補');
    }
}

// 3. 交易時間判斷
isTradingHour(timestamp) {
    const date = new Date(timestamp * 1000);
    const day = date.getDay();
    
    // 外匯市場週一到週五交易，避免週末時間
    if (day === 0 || day === 6) {
        return false;
    }
    return true;
}
```

### 相關文件
- `src/frontend/candleAggregator.js:307-392`
- `src/frontend/playback-manager.js:391-427`

---

## 5. 後端進程管理問題

### 問題描述
用戶停止CMD後端，但網頁仍能連接到服務，發現有多個Python進程在後台運行

### 根本原因
Claude在後台啟動了Python進程，即使用戶停止了自己的CMD，Claude的進程仍在運行

### 診斷方法
```bash
# 1. 檢查正在運行的Python進程
tasklist | findstr python

# 2. 檢查端口占用
netstat -ano | findstr :5000

# 3. 檢查特定進程
tasklist /FI "IMAGENAME eq python.exe" /FO TABLE
```

### 解決方案
```bash
# 1. 終止所有Python進程
taskkill /F /IM python.exe

# 2. 終止特定PID的進程
taskkill /F /PID <進程ID>

# 3. 檢查後台bash進程
# 使用Claude Code的BashOutput工具檢查運行中的bash進程
```

### 預防措施
1. 明確告知用戶有後台進程在運行
2. 提供進程管理指令
3. 在調試完成後主動清理後台進程

---

## 6. 系統診斷工具

### 全域診斷函數
```javascript
// 在瀏覽器控制台中可用的診斷函數

// 1. 系統健康檢查
window.runSystemDiagnostics = function() {
    console.group('🔍 系統診斷報告');
    
    // 檢查核心組件
    console.log('📊 核心組件狀態:');
    console.log('- chartManager:', !!window.chartManager);
    console.log('- dataManager:', !!window.dataManager);
    console.log('- playbackManager:', !!window.playbackManager);
    console.log('- errorMonitor:', !!window.errorMonitor);
    console.log('- dataValidator:', !!window.dataValidator);
    
    // 檢查數據狀態
    if (window.currentData) {
        console.log('📈 數據狀態:');
        console.log('- 當前日期:', window.currentData.date);
        console.log('- K線數量:', window.currentData.data?.length);
        console.log('- FVG數量:', window.currentData.fvgs?.length);
    }
    
    // 運行驗證器
    if (window.dataValidator && window.currentData) {
        const report = window.dataValidator.validateCandleData(window.currentData.data, 'CurrentData');
        console.log('✅ 數據驗證:', report.valid ? '通過' : '失敗');
        if (!report.valid) {
            console.warn('❌ 發現問題:', report.invalidItems.length, '項');
        }
    }
    
    // 檢查錯誤狀態
    if (window.errorMonitor) {
        const errors = window.errorMonitor.getErrorReport();
        console.log('🚨 錯誤統計:', errors.summary);
    }
    
    console.groupEnd();
};

// 2. 快速數據檢查
window.quickDataCheck = function() {
    if (!window.currentData) {
        console.error('❌ 沒有當前數據');
        return;
    }
    
    const data = window.currentData.data;
    if (!data || data.length === 0) {
        console.error('❌ K線數據為空');
        return;
    }
    
    console.log('✅ 數據基本信息:');
    console.log('- 總K線數:', data.length);
    console.log('- 第一根:', new Date(data[0].time * 1000).toLocaleString());
    console.log('- 最後一根:', new Date(data[data.length-1].time * 1000).toLocaleString());
    
    // 檢查null值
    const firstCandle = data[0];
    const nullFields = Object.entries(firstCandle).filter(([k,v]) => v === null);
    if (nullFields.length > 0) {
        console.warn('⚠️ 發現null字段:', nullFields);
    } else {
        console.log('✅ 數據格式正常');
    }
};

// 3. FVG診斷
window.diagnoseFVG = function() {
    console.group('🔍 FVG診斷');
    
    const fvgRenderer = window.chartManager?.getFVGRenderer();
    console.log('FVG渲染器:', !!fvgRenderer);
    
    if (fvgRenderer) {
        console.log('- 可見性:', fvgRenderer.getVisible?.());
        console.log('- 類型:', fvgRenderer.constructor.name);
    }
    
    if (window.currentData?.fvgs) {
        console.log('FVG數據:', window.currentData.fvgs.length, '個');
        const sample = window.currentData.fvgs[0];
        if (sample) {
            console.log('- 樣本:', sample);
        }
    }
    
    console.groupEnd();
};
```

### 常用檢查命令
```javascript
// 在控制台執行的快速檢查命令
window.runSystemDiagnostics();  // 完整系統診斷
window.quickDataCheck();        // 快速數據檢查  
window.diagnoseFVG();           // FVG專項診斷
window.errorMonitor.generateDiagnosticReport(); // 錯誤診斷報告
```

---

## 總結

本次排查過程中發現的主要問題模式：

1. **API兼容性**：升級Lightweight Charts v5後需要適配API變更
2. **數據驗證**：缺乏全面的數據驗證機制導致運行時錯誤
3. **時間處理**：時間戳格式和時區處理需要統一標準
4. **進程管理**：後台進程需要明確的生命週期管理
5. **錯誤追踪**：需要建立完善的錯誤監控和診斷體系

### 建議的最佳實踐

1. **建立完善的診斷工具鏈**：包含數據驗證器、錯誤監控器、系統診斷函數
2. **統一數據格式標準**：所有時間戳使用Unix秒級時間戳，價格數據避免null值
3. **加強API兼容性處理**：使用包裝器模式處理版本差異
4. **完善錯誤處理**：每個關鍵操作都要有錯誤邊界和回退機制
5. **詳細的日誌記錄**：關鍵操作都要有詳細的日誌輸出便於調試

這份文檔應該能幫助未來快速定位和解決類似問題。建議定期更新，記錄新發現的問題和解決方案。