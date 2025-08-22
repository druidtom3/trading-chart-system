/**
 * FVG Safe Renderer - 安全版本，用於調試無限迴圈問題
 */

class FVGRendererSafe {
    constructor(chart, candlestickSeries) {
        this.chart = chart;
        this.candlestickSeries = candlestickSeries;
        this.priceLines = [];
        this.renderCount = 0;
        this.maxRenders = 3; // 最大渲染次數保護
        
        console.log('🔒 FVG Safe Renderer 初始化 - 調試模式');
    }
    
    /**
     * 安全渲染 - 有多重保護機制
     */
    render(fvgs, timeframe = 'M15') {
        // 防止無限渲染
        this.renderCount++;
        if (this.renderCount > this.maxRenders) {
            console.error(`🚨 達到最大渲染次數限制 (${this.maxRenders})，停止渲染`);
            return;
        }
        
        console.log(`🔒 Safe Render #${this.renderCount}: ${fvgs ? fvgs.length : 0} FVGs`);
        
        // 清除舊的渲染
        this.clear();
        
        if (!fvgs || fvgs.length === 0) {
            console.log('⚠️ 沒有FVG數據，跳過渲染');
            return;
        }
        
        // 只渲染前5個FVG，避免大量LineSeries
        const safeFvgs = fvgs.slice(0, 5);
        console.log(`🔒 安全模式：只渲染前 ${safeFvgs.length} 個FVG`);
        
        safeFvgs.forEach((fvg, index) => {
            try {
                this.renderSingleFVGSafe(fvg, index, timeframe);
            } catch (error) {
                console.error(`❌ FVG[${index}] 渲染失敗:`, error);
            }
        });
        
        console.log(`✅ Safe 渲染完成: ${this.priceLines.length} 個LineSeries`);
    }
    
    renderSingleFVGSafe(fvg, index, timeframe) {
        // 基本驗證
        if (!fvg.startTime || typeof fvg.startTime !== 'number') {
            console.error(`❌ FVG[${index}] 時間戳無效:`, fvg.startTime);
            return;
        }
        
        // 只創建一個LineSeries用於測試
        const testLineSeries = this.chart.addSeries(LightweightCharts.LineSeries, {
            color: fvg.type === 'bullish' ? '#00d68f' : '#ff3d71',
            lineWidth: 1,
            crosshairMarkerVisible: false,
            priceLineVisible: false,
            lastValueVisible: false,
        });
        
        // 簡單的線條數據
        const price = (fvg.topPrice + fvg.bottomPrice) / 2; // 中間價位
        const endTime = fvg.startTime + (15 * 60); // 固定15分鐘長度
        
        testLineSeries.setData([
            { time: fvg.startTime, value: price },
            { time: endTime, value: price }
        ]);
        
        this.priceLines.push(testLineSeries);
        
        console.log(`🔒 FVG[${index}] 安全渲染完成: time=${fvg.startTime}, price=${price}`);
    }
    
    clear() {
        console.log(`🗑️ 安全清除 ${this.priceLines.length} 個LineSeries`);
        
        this.priceLines.forEach((series, index) => {
            try {
                if (this.chart && this.chart.removeSeries) {
                    this.chart.removeSeries(series);
                }
            } catch (error) {
                console.error(`❌ 清除LineSeries[${index}]失敗:`, error);
            }
        });
        
        this.priceLines = [];
    }
    
    // 重置渲染計數器
    resetRenderCount() {
        this.renderCount = 0;
        console.log('🔄 渲染計數器已重置');
    }
    
    // 相容性方法
    setVisible(visible) {
        console.log(`👁️ 設置可見性: ${visible}`);
    }
    
    getStats() {
        return {
            totalFVGs: this.priceLines.length,
            renderCount: this.renderCount,
            maxRenders: this.maxRenders,
            renderMethod: 'Safe Mode'
        };
    }
}

// 導出給全域使用
if (typeof window !== 'undefined') {
    window.FVGRendererSafe = FVGRendererSafe;
}