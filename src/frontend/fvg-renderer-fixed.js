/**
 * FVG Fixed Renderer - 修復時間範圍問題的版本
 */

class FVGRendererFixed {
    constructor(chart, candlestickSeries) {
        this.chart = chart;
        this.candlestickSeries = candlestickSeries;
        this.priceLines = [];
        this.renderCount = 0;
        this.chartTimeRange = null; // 儲存K線時間範圍
        
        console.log('🔧 FVG Fixed Renderer 初始化 - 時間範圍修復版本');
    }
    
    /**
     * 設置圖表時間範圍（從K線數據中獲取）
     */
    setChartTimeRange(chartData) {
        if (!chartData || chartData.length === 0) return;
        
        const times = chartData.map(candle => candle.time).sort((a, b) => a - b);
        this.chartTimeRange = {
            min: times[0],
            max: times[times.length - 1]
        };
        
        console.log(`📅 設置圖表時間範圍: ${this.chartTimeRange.min} ~ ${this.chartTimeRange.max}`);
    }
    
    /**
     * 修復版本渲染 - 解決時間範圍問題
     */
    render(fvgs, timeframe = 'M15') {
        this.renderCount++;
        
        console.log(`🔧 Fixed Render #${this.renderCount}: ${fvgs ? fvgs.length : 0} FVGs`);
        
        // 防止過多渲染
        if (this.renderCount > 3) {
            console.error(`🚨 達到最大渲染次數 (3)，停止渲染`);
            return;
        }
        
        this.clear();
        
        if (!fvgs || fvgs.length === 0) {
            console.log('⚠️ 沒有FVG數據');
            return;
        }
        
        if (!this.chartTimeRange) {
            console.error('❌ 圖表時間範圍未設置，無法渲染FVG');
            return;
        }
        
        // 只渲染前5個FVG進行測試
        const testFVGs = fvgs.slice(0, 5);
        console.log(`🔧 測試模式：渲染前 ${testFVGs.length} 個FVG`);
        
        let successCount = 0;
        
        testFVGs.forEach((fvg, index) => {
            try {
                if (this.renderSingleFVGFixed(fvg, index, timeframe)) {
                    successCount++;
                }
            } catch (error) {
                console.error(`❌ FVG[${index}] 渲染失敗:`, error);
            }
        });
        
        console.log(`✅ Fixed 渲染完成: ${successCount}/${testFVGs.length} 成功, ${this.priceLines.length} LineSeries`);
    }
    
    renderSingleFVGFixed(fvg, index, timeframe) {
        // 1. 基本驗證
        if (!this.validateFVGData(fvg)) {
            console.warn(`⚠️ FVG[${index}] 數據無效，跳過`);
            return false;
        }
        
        // 2. 修復時間範圍問題
        const fixedTimes = this.fixFVGTimeRange(fvg, timeframe);
        if (!fixedTimes) {
            console.warn(`⚠️ FVG[${index}] 時間範圍無法修復，跳過`);
            return false;
        }
        
        console.log(`🔧 FVG[${index}] 時間修復: ${fvg.startTime} -> ${fixedTimes.startTime}, ${fvg.endTime || 'null'} -> ${fixedTimes.endTime}`);
        
        // 3. 創建LineSeries（只創建一條線進行測試）
        const color = fvg.type === 'bullish' ? '#00d68f' : '#ff3d71';
        const price = (fvg.topPrice + fvg.bottomPrice) / 2; // 使用中間價格
        
        const lineSeries = this.chart.addSeries(LightweightCharts.LineSeries, {
            color: color,
            lineWidth: 1,
            crosshairMarkerVisible: false,
        });
        
        // 4. 設置修復後的時間數據
        lineSeries.setData([
            { time: fixedTimes.startTime, value: price },
            { time: fixedTimes.endTime, value: price }
        ]);
        
        this.priceLines.push(lineSeries);
        
        console.log(`✅ FVG[${index}] 修復渲染成功`);
        return true;
    }
    
    validateFVGData(fvg) {
        if (!fvg.startTime || typeof fvg.startTime !== 'number') return false;
        if (!fvg.topPrice || typeof fvg.topPrice !== 'number') return false;
        if (!fvg.bottomPrice || typeof fvg.bottomPrice !== 'number') return false;
        if (fvg.topPrice <= fvg.bottomPrice) return false;
        return true;
    }
    
    fixFVGTimeRange(fvg, timeframe) {
        if (!this.chartTimeRange) return null;
        
        let startTime = fvg.startTime;
        let endTime = fvg.endTime;
        
        console.log(`🔧 修復前: startTime=${startTime}, endTime=${endTime}, chartRange=${this.chartTimeRange.min}~${this.chartTimeRange.max}`);
        
        // 強制調整startTime到圖表範圍內
        if (startTime < this.chartTimeRange.min || startTime > this.chartTimeRange.max) {
            // 如果完全超出範圍，使用圖表中間位置
            startTime = this.chartTimeRange.min + (this.chartTimeRange.max - this.chartTimeRange.min) * 0.3;
            console.log(`⚠️ startTime超出範圍，強制調整為: ${startTime}`);
        }
        
        // 強制重新計算endTime，確保在範圍內
        const timeframeSeconds = {
            'M1': 60, 'M5': 300, 'M15': 900, 
            'M30': 1800, 'H1': 3600, 'H4': 14400
        }[timeframe] || 900;
        
        // 計算一個很保守的endTime（最多5根K線）
        const conservativeExtension = Math.min(
            5 * timeframeSeconds,  // 只延伸5根K線
            (this.chartTimeRange.max - startTime) * 0.1  // 或圖表範圍的10%
        );
        
        endTime = startTime + Math.max(conservativeExtension, timeframeSeconds); // 至少一根K線
        
        // 最終強制檢查
        if (endTime > this.chartTimeRange.max) {
            endTime = this.chartTimeRange.max - timeframeSeconds; // 比圖表結束早一個時間框架
        }
        
        console.log(`🔧 修復後: startTime=${startTime}, endTime=${endTime}`);
        
        return { startTime, endTime };
    }
    
    clear() {
        console.log(`🗑️ 清除 ${this.priceLines.length} 個LineSeries`);
        
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
    
    // 重置渲染計數
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
            chartTimeRange: this.chartTimeRange,
            renderMethod: 'Fixed Time Range Version'
        };
    }
}

// 導出給全域使用
if (typeof window !== 'undefined') {
    window.FVGRendererFixed = FVGRendererFixed;
}