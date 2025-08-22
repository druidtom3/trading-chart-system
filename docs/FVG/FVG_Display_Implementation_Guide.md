# FVG (Fair Value Gap) 顯示實作完整指南

## 概述

本文檔詳細說明了Fair Value Gap (FVG) 的半透明多線條顯示實作方法，該方法基於不同間隔大小使用不同數量的線條來創建半透明填充效果。

## 核心理念

### 1. 適應性線條密度
根據FVG間隔的大小動態調整線條數量，確保：
- 大間隔使用更多線條，提供更豐富的視覺效果
- 小間隔使用較少線條，避免視覺擁擠
- 保持性能最優化

### 2. 半透明視覺效果
通過多條細線的疊加效果實現半透明填充：
- 每條線使用低透明度
- 多條線疊加產生視覺上的半透明區域
- 邊界線突出顯示FVG範圍

## 技術實作

### 核心算法

```javascript
// 適應性線條數量計算
function calculateLineCount(fvgGapSize) {
    if (fvgGapSize >= 100) {
        return 130;  // 極大間隔
    } else if (fvgGapSize >= 80) {
        return 100;  // 大間隔  
    } else if (fvgGapSize >= 50) {
        return 60;   // 中大間隔
    } else if (fvgGapSize >= 30) {
        return 20;   // 中等間隔
    } else if (fvgGapSize >= 15) {
        return 10;   // 中小間隔
    } else if (fvgGapSize >= 5) {
        return 6;    // 小間隔
    } else {
        return 4;    // 極小間隔
    }
}
```

### 顏色配置

```javascript
// 填充顏色配置 (低透明度)
const fillColors = {
    bullish: {
        active: 'rgba(0, 255, 140, 0.08)',    // 看漲FVG - 綠色
        cleared: 'rgba(128, 128, 128, 0.08)'  // 已清除FVG - 灰色
    },
    bearish: {
        active: 'rgba(255, 61, 113, 0.08)',   // 看跌FVG - 紅色  
        cleared: 'rgba(128, 128, 128, 0.08)'  // 已清除FVG - 灰色
    }
};

// 邊界線顏色配置
const borderColors = {
    bullish: {
        active: '#00d68f',     // 看漲FVG邊界
        cleared: '#888888'     // 已清除FVG邊界
    },
    bearish: {
        active: '#ff3d71',     // 看跌FVG邊界
        cleared: '#888888'     // 已清除FVG邊界
    }
};
```

### 線條渲染邏輯

```javascript
function renderFVGWithMultipleLines(fvg, chart, isCleared = false) {
    const fvgGapSize = Math.abs(fvg.topPrice - fvg.bottomPrice);
    const numberOfFillLines = calculateLineCount(fvgGapSize);
    
    // 獲取顏色配置
    const fillColor = getFillColor(fvg.type, isCleared);
    const borderColor = getBorderColor(fvg.type, isCleared);
    
    const primitives = [];
    
    // 1. 創建填充線條
    for (let i = 1; i < numberOfFillLines; i++) {
        const ratio = i / numberOfFillLines;
        const linePrice = fvg.bottomPrice + (fvg.topPrice - fvg.bottomPrice) * ratio;
        
        const fillLineSeries = chart.addLineSeries({
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
        primitives.push(fillLineSeries);
    }
    
    // 2. 創建邊界線
    const topBoundary = createBoundaryLine(chart, fvg.topPrice, fvg.startTime, fvg.endTime, borderColor, isCleared);
    const bottomBoundary = createBoundaryLine(chart, fvg.bottomPrice, fvg.startTime, fvg.endTime, borderColor, isCleared);
    
    primitives.push(topBoundary, bottomBoundary);
    
    return primitives;
}

function createBoundaryLine(chart, price, startTime, endTime, color, isCleared) {
    const lineSeries = chart.addLineSeries({
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
```

## 完整實作示例

### FVG渲染器類

```javascript
class FVGRenderer {
    constructor(chart, candlestickSeries) {
        this.chart = chart;
        this.candlestickSeries = candlestickSeries;
        this.fvgPrimitives = [];
        this.fvgMarkers = [];
        this.settings = {
            showFVG: true,
            showFVGMarkers: false,
            showClearedFVGs: false
        };
    }
    
    renderFVGs(fvgs) {
        this.clearFVGs();
        
        if (!fvgs || fvgs.length === 0) return;
        
        const validFVGs = fvgs.filter(fvg => fvg.status === 'valid');
        const clearedFVGs = fvgs.filter(fvg => fvg.status === 'cleared');
        
        // 渲染有效FVG
        if (this.settings.showFVG) {
            validFVGs.forEach((fvg, index) => {
                this.renderSingleFVG(fvg, index, false);
            });
        }
        
        // 渲染已清除FVG
        if (this.settings.showClearedFVGs) {
            clearedFVGs.forEach((fvg, index) => {
                this.renderSingleFVG(fvg, validFVGs.length + index, true);
            });
        }
        
        // 更新標記
        this.updateMarkers();
    }
    
    renderSingleFVG(fvg, index, isCleared) {
        try {
            const fvgGapSize = Math.abs(fvg.topPrice - fvg.bottomPrice);
            const numberOfFillLines = this.calculateLineCount(fvgGapSize);
            
            const fillColor = this.getFillColor(fvg.type, isCleared);
            const borderColor = this.getBorderColor(fvg.type, isCleared);
            
            // 創建填充線條
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
                
                const fillLineData = [
                    { time: fvg.startTime, value: linePrice },
                    { time: fvg.endTime, value: linePrice }
                ];
                
                fillLineSeries.setData(fillLineData);
                this.fvgPrimitives.push(fillLineSeries);
            }
            
            // 創建邊界線
            const topLineSeries = this.chart.addLineSeries({
                color: borderColor,
                lineWidth: 0.5,
                lineStyle: isCleared ? LightweightCharts.LineStyle.Dashed : LightweightCharts.LineStyle.Solid,
                priceScaleId: 'right',
                lastValueVisible: false,
                priceLineVisible: false,
            });
            
            const bottomLineSeries = this.chart.addLineSeries({
                color: borderColor,
                lineWidth: 0.5,
                lineStyle: isCleared ? LightweightCharts.LineStyle.Dashed : LightweightCharts.LineStyle.Solid,
                priceScaleId: 'right',
                lastValueVisible: false,
                priceLineVisible: false,
            });
            
            const topLineData = [
                { time: fvg.startTime, value: fvg.topPrice },
                { time: fvg.endTime, value: fvg.topPrice }
            ];
            
            const bottomLineData = [
                { time: fvg.startTime, value: fvg.bottomPrice },
                { time: fvg.endTime, value: fvg.bottomPrice }
            ];
            
            topLineSeries.setData(topLineData);
            bottomLineSeries.setData(bottomLineData);
            
            this.fvgPrimitives.push(topLineSeries, bottomLineSeries);
            
            // 準備標記
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
    
    calculateLineCount(fvgGapSize) {
        if (fvgGapSize >= 100) return 130;
        if (fvgGapSize >= 80) return 100;
        if (fvgGapSize >= 50) return 60;
        if (fvgGapSize >= 30) return 20;
        if (fvgGapSize >= 15) return 10;
        if (fvgGapSize >= 5) return 6;
        return 4;
    }
    
    getFillColor(type, isCleared) {
        if (isCleared) return 'rgba(128, 128, 128, 0.08)';
        return type === 'bullish' 
            ? 'rgba(0, 255, 140, 0.08)' 
            : 'rgba(255, 61, 113, 0.08)';
    }
    
    getBorderColor(type, isCleared) {
        if (isCleared) return '#888888';
        return type === 'bullish' ? '#00d68f' : '#ff3d71';
    }
    
    updateMarkers() {
        if (this.settings.showFVGMarkers && this.fvgMarkers.length > 0) {
            this.candlestickSeries.setMarkers(this.fvgMarkers);
        } else {
            this.candlestickSeries.setMarkers([]);
        }
    }
    
    clearFVGs() {
        this.fvgPrimitives.forEach(primitive => {
            try {
                this.chart.removeSeries(primitive);
            } catch (error) {
                // 忽略錯誤
            }
        });
        this.fvgPrimitives = [];
        this.fvgMarkers = [];
        this.candlestickSeries.setMarkers([]);
    }
    
    // 設置方法
    toggleFVG(show) {
        this.settings.showFVG = show;
    }
    
    toggleFVGMarkers(show) {
        this.settings.showFVGMarkers = show;
    }
    
    toggleClearedFVGs(show) {
        this.settings.showClearedFVGs = show;
    }
}
```

## 使用方式

### 基本使用

```javascript
// 1. 初始化圖表
const chart = LightweightCharts.createChart(container, chartOptions);
const candlestickSeries = chart.addCandlestickSeries();

// 2. 創建FVG渲染器
const fvgRenderer = new FVGRenderer(chart, candlestickSeries);

// 3. 渲染FVG數據
const fvgData = [
    {
        type: 'bullish',
        status: 'valid',
        topPrice: 1.2500,
        bottomPrice: 1.2450,
        startTime: '2024-01-01T10:00:00Z',
        endTime: '2024-01-01T16:00:00Z'
    },
    // 更多FVG數據...
];

fvgRenderer.renderFVGs(fvgData);
```

### 動態配置

```javascript
// 顯示/隱藏FVG
fvgRenderer.toggleFVG(true);

// 顯示/隱藏標記
fvgRenderer.toggleFVGMarkers(true);

// 顯示/隱藏已清除的FVG
fvgRenderer.toggleClearedFVGs(false);

// 重新渲染
fvgRenderer.renderFVGs(fvgData);
```

## 性能優化建議

### 1. 線條數量控制
```javascript
// 為極大間隔設置最大線條限制
const MAX_LINES = 150;

function calculateLineCount(fvgGapSize) {
    let count = Math.min(fvgGapSize * 1.3, MAX_LINES);
    return Math.max(4, Math.floor(count));
}
```

### 2. 批量操作
```javascript
// 批量創建和清除線條
function batchCreateLines(lines) {
    const primitives = [];
    lines.forEach(lineConfig => {
        const series = chart.addLineSeries(lineConfig.options);
        series.setData(lineConfig.data);
        primitives.push(series);
    });
    return primitives;
}
```

### 3. 內存管理
```javascript
// 定期清理未使用的系列
function cleanupUnusedSeries() {
    this.fvgPrimitives = this.fvgPrimitives.filter(primitive => {
        try {
            // 檢查系列是否仍然有效
            primitive.options();
            return true;
        } catch {
            return false;
        }
    });
}
```

## 自定義配置

### 顏色主題
```javascript
const colorThemes = {
    default: {
        bullish: { fill: 'rgba(0, 255, 140, 0.08)', border: '#00d68f' },
        bearish: { fill: 'rgba(255, 61, 113, 0.08)', border: '#ff3d71' }
    },
    dark: {
        bullish: { fill: 'rgba(0, 200, 100, 0.1)', border: '#00c472' },
        bearish: { fill: 'rgba(255, 80, 120, 0.1)', border: '#ff507a' }
    },
    light: {
        bullish: { fill: 'rgba(0, 150, 80, 0.06)', border: '#009650' },
        bearish: { fill: 'rgba(200, 50, 90, 0.06)', border: '#c8325a' }
    }
};
```

### 線條密度設置
```javascript
const densitySettings = {
    low: {
        multiplier: 0.5,
        minLines: 2,
        maxLines: 50
    },
    medium: {
        multiplier: 1.0,
        minLines: 4,
        maxLines: 100
    },
    high: {
        multiplier: 1.5,
        minLines: 6,
        maxLines: 150
    }
};
```

## 故障排除

### 常見問題

1. **線條過多導致性能問題**
   - 降低線條密度設置
   - 增加最大線條限制
   - 使用節流渲染

2. **顏色顯示不正確**
   - 檢查RGBA透明度值
   - 確認圖表主題兼容性
   - 驗證顏色格式

3. **FVG不顯示**
   - 檢查數據格式
   - 確認時間範圍
   - 驗證價格範圍

### 調試技巧

```javascript
// 啟用調試模式
const DEBUG_MODE = true;

function debugFVGRender(fvg, lineCount) {
    if (DEBUG_MODE) {
        console.log(`渲染FVG: ${fvg.type}, 間隔: ${Math.abs(fvg.topPrice - fvg.bottomPrice)}, 線條數: ${lineCount}`);
    }
}
```

## 總結

這個FVG顯示實作提供了：
- 適應性線條密度算法
- 高質量半透明視覺效果  
- 靈活的配置選項
- 良好的性能表現
- 完整的錯誤處理

通過這個實作方法，可以在任何使用LightweightCharts的項目中實現專業級的FVG顯示效果。