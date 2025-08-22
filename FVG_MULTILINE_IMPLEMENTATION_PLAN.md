# FVG 多線條渲染實施計畫

## 專案概述

基於 `docs/FVG/FVG_Display_Implementation_Guide.md` 的半透明多線條FVG顯示方法，將現有複雜的v4/v5雙渲染器架構替換為更簡潔、穩定的多線條實現方式。

### 核心改變
- **移除**: 複雜的Custom Series渲染器和v4/v5版本兼容邏輯
- **採用**: 基於LineSeries的多線條半透明填充方法
- **效果**: 4-130條線創造適應性半透明FVG視覺效果

---

## Phase 1: FVG渲染器重構 (預計2-3小時)

### Sprint 1.1: 核心渲染器實現 (1.5小時)

#### Checkpoint 1.1.1: 創建新的FVG渲染器類
**文件**: `src/frontend/fvg-renderer-multiline.js`

```javascript
class FVGRendererMultiline {
    constructor(chart, candlestickSeries) {
        this.chart = chart;
        this.candlestickSeries = candlestickSeries;
        this.fvgPrimitives = [];
        this.fvgMarkers = [];
        this.settings = {
            showFVG: true,
            showFVGMarkers: false,
            showClearedFVGs: false,
            maxLines: 130,  // 性能限制
            minLines: 4
        };
    }
    
    // 適應性線條數量計算
    calculateLineCount(fvgGapSize) {
        if (fvgGapSize >= 100) return Math.min(130, this.settings.maxLines);
        if (fvgGapSize >= 80) return Math.min(100, this.settings.maxLines);
        if (fvgGapSize >= 50) return Math.min(60, this.settings.maxLines);
        if (fvgGapSize >= 30) return Math.min(20, this.settings.maxLines);
        if (fvgGapSize >= 15) return Math.min(10, this.settings.maxLines);
        if (fvgGapSize >= 5) return Math.min(6, this.settings.maxLines);
        return this.settings.minLines;
    }
    
    // 顏色配置
    getFillColor(type, isCleared) {
        if (isCleared) return 'rgba(128, 128, 128, 0.08)';
        return type === 'bullish' 
            ? 'rgba(0, 255, 140, 0.08)'    // 看漲FVG - 淡綠色
            : 'rgba(255, 61, 113, 0.08)';  // 看跌FVG - 淡紅色
    }
    
    getBorderColor(type, isCleared) {
        if (isCleared) return '#888888';
        return type === 'bullish' ? '#00d68f' : '#ff3d71';
    }
    
    // 主要渲染方法
    render(fvgs, currentTimeframe = 'M15') {
        this.clearFVGs();
        
        if (!fvgs || fvgs.length === 0 || !this.settings.showFVG) return;
        
        const validFVGs = fvgs.filter(fvg => fvg.status === 'valid');
        const clearedFVGs = fvgs.filter(fvg => fvg.status === 'cleared');
        
        // 渲染有效FVG
        validFVGs.forEach((fvg, index) => {
            this.renderSingleFVG(fvg, index, false);
        });
        
        // 渲染已清除FVG (可選)
        if (this.settings.showClearedFVGs) {
            clearedFVGs.forEach((fvg, index) => {
                this.renderSingleFVG(fvg, validFVGs.length + index, true);
            });
        }
        
        this.updateMarkers();
    }
    
    // 單個FVG渲染
    renderSingleFVG(fvg, index, isCleared) {
        try {
            const fvgGapSize = Math.abs(fvg.topPrice - fvg.bottomPrice);
            const numberOfFillLines = this.calculateLineCount(fvgGapSize);
            
            const fillColor = this.getFillColor(fvg.type, isCleared);
            const borderColor = this.getBorderColor(fvg.type, isCleared);
            
            // 1. 創建填充線條
            for (let i = 1; i < numberOfFillLines; i++) {
                const ratio = i / numberOfFillLines;
                const linePrice = fvg.bottomPrice + (fvg.topPrice - fvg.bottomPrice) * ratio;
                
                const fillLineSeries = this.chart.addLineSeries({
                    color: fillColor,
                    lineWidth: 1,
                    lineStyle: LightweightCharts.LineStyle.Solid,
                    priceScaleId: 'right',
                    lastValueVisible: false,
                    priceLineVisible: false,
                });
                
                const lineData = [
                    { time: fvg.startTime, value: linePrice },
                    { time: fvg.endTime, value: linePrice }
                ];
                
                fillLineSeries.setData(lineData);
                this.fvgPrimitives.push(fillLineSeries);
            }
            
            // 2. 創建邊界線
            const topBoundary = this.createBoundaryLine(
                fvg.topPrice, fvg.startTime, fvg.endTime, borderColor, isCleared
            );
            const bottomBoundary = this.createBoundaryLine(
                fvg.bottomPrice, fvg.startTime, fvg.endTime, borderColor, isCleared
            );
            
            this.fvgPrimitives.push(topBoundary, bottomBoundary);
            
            // 3. 準備標記
            if (this.settings.showFVGMarkers) {
                this.fvgMarkers.push({
                    time: fvg.startTime,
                    position: 'belowBar',
                    color: borderColor,
                    shape: 'circle',
                    text: `F${index + 1}`,
                    size: 1
                });
            }
            
        } catch (error) {
            console.warn('FVG渲染錯誤:', error);
        }
    }
    
    createBoundaryLine(price, startTime, endTime, color, isCleared) {
        const lineSeries = this.chart.addLineSeries({
            color: color,
            lineWidth: 0.5,
            lineStyle: isCleared ? LightweightCharts.LineStyle.Dashed : LightweightCharts.LineStyle.Solid,
            priceScaleId: 'right',
            lastValueVisible: false,
            priceLineVisible: false,
        });
        
        const lineData = [
            { time: startTime, value: price },
            { time: endTime, value: price }
        ];
        
        lineSeries.setData(lineData);
        return lineSeries;
    }
    
    // 清除方法
    clearFVGs() {
        this.fvgPrimitives.forEach(primitive => {
            try {
                this.chart.removeSeries(primitive);
            } catch (error) {
                // 忽略清除錯誤
            }
        });
        this.fvgPrimitives = [];
        this.fvgMarkers = [];
        this.candlestickSeries.setMarkers([]);
    }
    
    // 標記更新
    updateMarkers() {
        if (this.settings.showFVGMarkers && this.fvgMarkers.length > 0) {
            this.candlestickSeries.setMarkers(this.fvgMarkers);
        } else {
            this.candlestickSeries.setMarkers([]);
        }
    }
    
    // 控制方法
    toggle() {
        this.settings.showFVG = !this.settings.showFVG;
        return this.settings.showFVG;
    }
    
    toggleMarkers() {
        this.settings.showFVGMarkers = !this.settings.showFVGMarkers;
        return this.settings.showFVGMarkers;
    }
    
    toggleClearedFVGs() {
        this.settings.showClearedFVGs = !this.settings.showClearedFVGs;
        return this.settings.showClearedFVGs;
    }
    
    // 性能設置
    setMaxLines(maxLines) {
        this.settings.maxLines = Math.max(4, Math.min(200, maxLines));
    }
}

// 暴露到全局
window.FVGRendererMultiline = FVGRendererMultiline;
```

**預計時間**: 45分鐘

#### Checkpoint 1.1.2: 整合新渲染器到ChartManager
**文件**: `src/frontend/chart-manager.js`

修改 `initializeFVGRenderer()` 方法:

```javascript
/**
 * 初始化FVG渲染器 - 使用新的多線條渲染器
 */
initializeFVGRenderer() {
    try {
        console.log('初始化 FVG 多線條渲染器');
        
        // 使用新的多線條渲染器替代復雜的版本檢測
        if (window.FVGRendererMultiline) {
            this.fvgRenderer = new FVGRendererMultiline(this.chart, this.candlestickSeries);
            console.log('✅ FVG多線條渲染器初始化成功');
        } else {
            console.error('❌ FVGRendererMultiline 未載入');
            this.fvgRenderer = null;
        }
    } catch (error) {
        console.error('FVG渲染器初始化失敗:', error);
        this.fvgRenderer = null;
    }
}

/**
 * 簡化版本信息API - 移除複雜的版本檢測
 */
getVersionInfo() {
    return {
        fvgRendererType: 'multiline',
        lightweightChartsVersion: LightweightCharts.version || 'unknown',
        renderingMethod: 'LineSeries-based multi-line'
    };
}
```

同時移除或簡化以下復雜方法:
- `detectLightweightChartsVersion()` (可保留但簡化)
- `createCandlestickSeries()` (簡化為單一方法)
- `isUsingV5Renderer()` (移除)

**預計時間**: 30分鐘

#### Checkpoint 1.1.3: 更新HTML載入序列
**文件**: `src/frontend/index-v2.html`

```html
<!-- 載入新的FVG渲染器 -->
<script src="fvg-renderer-multiline.js"></script>

<!-- 簡化CDN載入 - 優先使用穩定版本 -->
<script>
const simpleCdnList = [
    'https://cdn.jsdelivr.net/npm/lightweight-charts@4.1.3/dist/lightweight-charts.standalone.production.js',
    'https://unpkg.com/lightweight-charts@4.1.3/dist/lightweight-charts.standalone.production.js',
    // v5 作為備選
    'https://unpkg.com/lightweight-charts@5.0.0/dist/lightweight-charts.standalone.production.js'
];
</script>
```

**預計時間**: 15分鐘

### Sprint 1.2: 性能優化與配置 (1小時)

#### Checkpoint 1.2.1: 添加性能配置選項
**文件**: `src/frontend/config.js`

```javascript
// 在CONFIG對象中添加FVG配置
CONFIG.FVG = {
    // 性能設置
    MAX_LINES_PER_FVG: 130,
    MIN_LINES_PER_FVG: 4,
    PERFORMANCE_MODE: false,  // 啟用時限制線條數量
    
    // 顏色設置
    COLORS: {
        BULLISH: {
            FILL: 'rgba(0, 255, 140, 0.08)',
            BORDER: '#00d68f'
        },
        BEARISH: {
            FILL: 'rgba(255, 61, 113, 0.08)',
            BORDER: '#ff3d71'
        },
        CLEARED: {
            FILL: 'rgba(128, 128, 128, 0.08)',
            BORDER: '#888888'
        }
    },
    
    // 顯示設置
    DEFAULT_SHOW_FVG: true,
    DEFAULT_SHOW_MARKERS: false,
    DEFAULT_SHOW_CLEARED: false
};
```

#### Checkpoint 1.2.2: 實現性能監控
**文件**: `src/frontend/fvg-renderer-multiline.js` (添加到現有類中)

```javascript
// 在 FVGRendererMultiline 類中添加
renderWithPerformanceTracking(fvgs, currentTimeframe) {
    const startTime = performance.now();
    const totalLines = fvgs.reduce((sum, fvg) => {
        const gapSize = Math.abs(fvg.topPrice - fvg.bottomPrice);
        return sum + this.calculateLineCount(gapSize);
    }, 0);
    
    console.log(`開始渲染 ${fvgs.length} 個FVG，預計 ${totalLines} 條線`);
    
    this.render(fvgs, currentTimeframe);
    
    const endTime = performance.now();
    console.log(`FVG渲染完成，耗時: ${(endTime - startTime).toFixed(2)}ms`);
    
    // 性能警告
    if (totalLines > 500) {
        console.warn(`⚠️ 大量線條渲染 (${totalLines}條)，建議啟用性能模式`);
    }
}

// 性能模式切換
enablePerformanceMode(enabled) {
    if (enabled) {
        this.settings.maxLines = 50;  // 限制最大線條數
        console.log('🚀 啟用FVG性能模式 (最大50條線/FVG)');
    } else {
        this.settings.maxLines = 130;
        console.log('🎨 停用FVG性能模式 (最大130條線/FVG)');
    }
}
```

**預計時間**: 45分鐘

#### Checkpoint 1.2.3: 添加使用者控制界面
**文件**: 更新左側控制面板

```javascript
// 在 populateLeftPanel 中添加FVG控制
function createFVGControls() {
    return `
    <div class="control-group">
        <h3>FVG 顯示設置</h3>
        
        <label class="checkbox-container">
            <input type="checkbox" id="fvgToggle" checked> 顯示 FVG
        </label>
        
        <label class="checkbox-container">
            <input type="checkbox" id="fvgMarkersToggle"> 顯示 FVG 標記
        </label>
        
        <label class="checkbox-container">
            <input type="checkbox" id="clearedFVGToggle"> 顯示已清除 FVG
        </label>
        
        <div class="control-item">
            <label for="fvgPerformanceMode">性能模式:</label>
            <select id="fvgPerformanceMode">
                <option value="high">高質量 (最多130線)</option>
                <option value="balanced">平衡 (最多60線)</option>
                <option value="performance">性能優先 (最多20線)</option>
            </select>
        </div>
    </div>`;
}

// 事件綁定
function bindFVGControls() {
    document.getElementById('fvgToggle')?.addEventListener('change', (e) => {
        if (chartManager?.fvgRenderer) {
            chartManager.fvgRenderer.settings.showFVG = e.target.checked;
            refreshFVGDisplay();
        }
    });
    
    document.getElementById('fvgPerformanceMode')?.addEventListener('change', (e) => {
        if (chartManager?.fvgRenderer) {
            const modes = { high: 130, balanced: 60, performance: 20 };
            chartManager.fvgRenderer.setMaxLines(modes[e.target.value]);
            refreshFVGDisplay();
        }
    });
}
```

**預計時間**: 15分鐘

---

## Phase 2: 測試與優化 (預計1小時)

### Sprint 2.1: 功能測試 (30分鐘)

#### Checkpoint 2.1.1: 基礎功能測試
**測試場景**:
- [ ] 載入包含10-20個FVG的數據集
- [ ] 驗證不同大小FVG的線條數量正確 (4, 6, 10, 20, 60, 100, 130)
- [ ] 測試FVG顯示/隱藏切換
- [ ] 測試標記顯示/隱藏
- [ ] 測試已清除FVG顯示

#### Checkpoint 2.1.2: 性能壓力測試
**測試場景**:
- [ ] 載入50+個FVG同時顯示
- [ ] 測試快速時間框架切換 (M1→M5→M15→H1)
- [ ] 測試極限縮放操作
- [ ] 監控記憶體使用量和渲染時間

### Sprint 2.2: 錯誤處理與降級 (30分鐘)

#### Checkpoint 2.2.1: 錯誤恢復機制
```javascript
// 在 FVGRendererMultiline 中添加
renderSingleFVG(fvg, index, isCleared) {
    try {
        // 現有渲染邏輯...
    } catch (error) {
        console.error(`FVG渲染失敗 [${index}]:`, error);
        
        // 降級處理：只顯示邊界線
        try {
            this.renderFallbackFVG(fvg, isCleared);
        } catch (fallbackError) {
            console.error('FVG降級渲染也失敗:', fallbackError);
        }
    }
}

renderFallbackFVG(fvg, isCleared) {
    const borderColor = this.getBorderColor(fvg.type, isCleared);
    
    const topBoundary = this.createBoundaryLine(
        fvg.topPrice, fvg.startTime, fvg.endTime, borderColor, isCleared
    );
    const bottomBoundary = this.createBoundaryLine(
        fvg.bottomPrice, fvg.startTime, fvg.endTime, borderColor, isCleared
    );
    
    this.fvgPrimitives.push(topBoundary, bottomBoundary);
}
```

---

## Phase 3: 部署與清理 (預計30分鐘)

### Sprint 3.1: 舊代碼清理

#### Checkpoint 3.1.1: 移除舊渲染器文件
**要清理的文件**:
- `src/frontend/fvg-renderer-v5.js` (如果存在)
- `src/frontend/fvg-custom-series.js` (如果存在)
- 複雜的版本檢測邏輯

#### Checkpoint 3.1.2: 更新文檔
**更新文件**:
- `README.md` - 說明新的FVG渲染方式
- 添加性能配置說明
- 更新API文檔

---

## 驗收標準

### 功能驗收
- ✅ FVG顯示正確，半透明效果佳
- ✅ 不同大小FVG使用適當線條數量
- ✅ 所有控制開關正常工作
- ✅ 性能模式有效降低線條數量
- ✅ 錯誤處理和降級機制正常

### 性能驗收
- ✅ 50個FVG渲染時間 < 500ms
- ✅ 記憶體使用相比現有方案無顯著增加
- ✅ 無明顯的UI卡頓或延遲

### 代碼品質驗收
- ✅ 代碼結構清晰，易於維護
- ✅ 錯誤處理完善
- ✅ 性能監控和調試功能完整

---

## 回滾計劃

如果新實現出現問題，可以快速回滾：

1. **立即回滾** (2分鐘):
   ```bash
   git checkout HEAD~1 -- src/frontend/chart-manager.js
   git checkout HEAD~1 -- src/frontend/index-v2.html
   ```

2. **完全回滾** (5分鐘):
   ```bash
   rm src/frontend/fvg-renderer-multiline.js
   git restore src/frontend/  # 恢復所有前端文件
   ```

---

## 預期效益

### 技術效益
- **架構簡化**: 移除複雜的v4/v5兼容邏輯 (~300行代碼)
- **穩定性提升**: 使用標準LineSeries API，無版本兼容問題
- **維護便利**: 單一渲染器，故障排除簡單

### 視覺效益  
- **更佳效果**: 適應性線條密度提供專業視覺體驗
- **一致性**: 所有FVG使用統一的半透明效果
- **可定制性**: 豐富的顏色和密度配置選項

### 性能效益
- **記憶體效率**: 小FVG使用更少線條 (4-6條 vs 10-20條)
- **渲染穩定**: 避免Canvas操作的复雜性
- **可控性**: 性能模式允許根據需求調整

---

**準備開始實作！** 🚀

總預計時間: **3.5-4小時**
風險等級: **低** (使用標準API，容易回滾)
預期完成後: **更簡潔、穩定、美觀的FVG顯示系統**