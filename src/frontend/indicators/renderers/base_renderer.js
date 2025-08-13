// 檔名：base_renderer.js

/**
 * 基礎渲染器類別
 * 所有指標渲染器的統一接口
 */
class BaseRenderer {
    constructor(chart) {
        this.chart = chart;
        this.series = new Map(); // 存儲各指標的系列對象
    }
    
    /**
     * 渲染指標 - 抽象方法，需由子類實現
     */
    render(indicatorName, data, config) {
        throw new Error('render method must be implemented by subclass');
    }
    
    /**
     * 清除指標顯示
     */
    clear(indicatorName) {
        const indicatorSeries = this.series.get(indicatorName);
        if (indicatorSeries) {
            if (Array.isArray(indicatorSeries)) {
                // 多個系列的情況
                indicatorSeries.forEach(series => {
                    this.chart.removeSeries(series);
                });
            } else {
                // 單個系列的情況
                this.chart.removeSeries(indicatorSeries);
            }
            this.series.delete(indicatorName);
        }
    }
    
    /**
     * 清除所有系列
     */
    clearAll() {
        for (const [name] of this.series) {
            this.clear(name);
        }
    }
    
    /**
     * 獲取指標的系列對象
     */
    getSeries(indicatorName) {
        return this.series.get(indicatorName);
    }
}

/**
 * 區域渲染器 - 用於 FVG 等區域類型指標
 */
class AreaRenderer extends BaseRenderer {
    constructor(chart) {
        super(chart);
    }
    
    // 取得 FVG 的像素高度
    getFvgPixelHeight(upper, lower) {
        if (!this.chart) return null;
        
        try {
            // 使用正確的 Lightweight Charts v4 API
            const priceScale = this.chart.priceScale('right');
            if (!priceScale) {
                return null;
            }
            
            // 確保圖表已完成初始化和布局
            const yTop = priceScale.priceToCoordinate(upper);
            const yBot = priceScale.priceToCoordinate(lower);
            
            if (yTop === null || yBot === null || isNaN(yTop) || isNaN(yBot)) {
                return null; // 尚未完成初次布局時的保險
            }
            
            const pixelHeight = Math.abs(yTop - yBot);
            
            // 只有當像素高度是合理數值時才返回
            if (pixelHeight > 0 && pixelHeight < 10000) {
                return pixelHeight;
            }
            
            return null;
        } catch (error) {
            // 靜默處理錯誤，使用 fallback
            return null;
        }
    }

    render(indicatorName, data, config) {
        // 先清除舊的渲染
        this.clear(indicatorName);
        
        const styles = config.styles || {};
        const seriesList = [];
        
        // 為每個區域創建多條線來模擬填充效果
        data.forEach((item, index) => {
            const { top, bot, fvg_type, time } = item.data;
            const style = styles[fvg_type] || styles.default || {
                color: fvg_type === 'bull' ? '#2ed573' : '#ff4757',
                opacity: 0.3
            };
            
            // 創建多條線來模擬區域填充 - 使用像素感知版本
            const pxH = this.getFvgPixelHeight(top, bot);
            
            // 固定覆蓋率：1px 線 + 1px gap => 大約 50% 覆蓋
            const lineWidthPx = 1;
            const gapPx = 1;
            const maxLines = 150;            // 安全上限，避免系列數過多
            const fallbackLines = 30;        // 布局尚未完成時的退路
            
            const lineCountPx = pxH ? Math.floor(pxH / (lineWidthPx + gapPx)) : fallbackLines;
            const lineCount = Math.max(1, Math.min(lineCountPx, maxLines));
            const step = (top - bot) / lineCount;
            
            for (let i = 0; i < lineCount; i++) {
                const lineValue = bot + (step * i);
                const opacity = style.opacity || 0.3;
                
                const lineSeries = this.chart.addLineSeries({
                    color: this.hexToRgba(style.color, opacity),
                    lineWidth: 1,
                    priceLineVisible: false,
                    lastValueVisible: false,
                    crosshairMarkerVisible: false
                });
                
                // 設置線條數據
                const startTime = time;
                const endTime = time + (20 * 60); // 假設延續20分鐘
                
                lineSeries.setData([
                    { time: startTime, value: lineValue },
                    { time: endTime, value: lineValue }
                ]);
                
                seriesList.push(lineSeries);
            }
        });
        
        // 存儲系列
        this.series.set(indicatorName, seriesList);
    }
    
    /**
     * 將 hex 顏色轉換為 rgba
     */
    hexToRgba(hex, alpha) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (result) {
            const r = parseInt(result[1], 16);
            const g = parseInt(result[2], 16);
            const b = parseInt(result[3], 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
        return hex;
    }
}

/**
 * 線條渲染器 - 用於移動平均線等線型指標
 */
class LineRenderer extends BaseRenderer {
    constructor(chart) {
        super(chart);
    }
    
    render(indicatorName, data, config) {
        this.clear(indicatorName);
        
        const style = config.style || {
            color: '#2196F3',
            lineWidth: 2
        };
        
        const lineSeries = this.chart.addLineSeries({
            color: style.color,
            lineWidth: style.lineWidth || 2,
            priceLineVisible: false,
            lastValueVisible: true,
            crosshairMarkerVisible: true
        });
        
        // 轉換數據格式
        const lineData = data.map(item => ({
            time: item.time,
            value: item.value
        }));
        
        lineSeries.setData(lineData);
        this.series.set(indicatorName, lineSeries);
    }
}

/**
 * 標記渲染器 - 用於信號點等標記類型指標
 */
class MarkerRenderer extends BaseRenderer {
    constructor(chart) {
        super(chart);
        this.markers = new Map(); // 存儲標記
    }
    
    render(indicatorName, data, config) {
        this.clear(indicatorName);
        
        const style = config.style || {
            shape: 'circle',
            color: '#FF5722'
        };
        
        // 轉換為 LightweightCharts 標記格式
        const markers = data.map(item => ({
            time: item.time,
            position: item.position || 'belowBar',
            color: item.color || style.color,
            shape: item.shape || style.shape,
            text: item.text || ''
        }));
        
        // 需要通過主要系列來設置標記
        // 這裡假設有一個主要的 candlestick 系列
        const mainSeries = this.chart.getCandlestickSeries ? 
                          this.chart.getCandlestickSeries() : 
                          null;
        
        if (mainSeries && markers.length > 0) {
            mainSeries.setMarkers(markers);
            this.markers.set(indicatorName, markers);
        }
    }
    
    clear(indicatorName) {
        this.markers.delete(indicatorName);
        // 標記的清除需要重新設置主系列的標記
        // 這裡需要根據實際的圖表實現來調整
    }
}