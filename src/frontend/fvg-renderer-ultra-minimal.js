/**
 * FVG Ultra Minimal Renderer - 最極簡版本，逐步排除問題
 */

class FVGRendererUltraMinimal {
    constructor(chart, candlestickSeries) {
        this.chart = chart;
        this.candlestickSeries = candlestickSeries;
        this.priceLines = [];
        this.testPhase = 1;
        
        console.log('🧪 FVG Ultra Minimal Renderer 初始化 - 逐步排除問題');
    }
    
    /**
     * 階段性測試渲染
     */
    render(fvgs, timeframe = 'M15') {
        console.log(`🧪 Phase ${this.testPhase} Test: LineSeries creation only`);
        
        this.clear();
        
        if (this.testPhase === 1) {
            // 階段1：只創建LineSeries，不設置數據
            this.testPhase1();
        } else if (this.testPhase === 2) {
            // 階段2：設置固定安全數據
            this.testPhase2();
        } else if (this.testPhase === 3) {
            // 階段3：使用最簡配置
            this.testPhase3();
        }
        
        console.log(`✅ Phase ${this.testPhase} 完成，LineSeries數量: ${this.priceLines.length}`);
    }
    
    testPhase1() {
        console.log('🧪 Phase 1: 只創建LineSeries，不設置數據');
        
        console.log('🔍 CHECKPOINT-P1-START: 開始創建LineSeries');
        console.log('🔍 CHECKPOINT-P1-CHART: chart物件檢查', {
            chartExists: !!this.chart,
            chartType: typeof this.chart,
            chartConstructor: this.chart?.constructor?.name
        });
        
        try {
            console.log('🔍 CHECKPOINT-P1-BEFORE-ADD: 準備調用addLineSeries');
            console.log('🔍 CHECKPOINT-P1-CONFIG: LineSeries配置', {
                color: '#ff0000',
                lineWidth: 1
            });
            
            // 使用v5 API正確方法: addSeries with LineSeries class
            console.log('🔍 CHECKPOINT-P1-V5-API: 使用v5 addSeries方法');
            console.log('🔍 CHECKPOINT-P1-LINESERIES: LineSeries類檢查', {
                exists: !!LightweightCharts.LineSeries,
                type: typeof LightweightCharts.LineSeries
            });
            
            const lineSeries = this.chart.addSeries(LightweightCharts.LineSeries, {
                color: '#ff0000',
                lineWidth: 1
                // 只使用最必要的屬性
            });
            
            console.log('🔍 CHECKPOINT-P1-AFTER-ADD: addLineSeries調用成功');
            console.log('🔍 CHECKPOINT-P1-SERIES: LineSeries物件檢查', {
                seriesExists: !!lineSeries,
                seriesType: typeof lineSeries,
                seriesConstructor: lineSeries?.constructor?.name
            });
            
            // 不調用 setData，只測試創建
            this.priceLines.push(lineSeries);
            console.log('✅ CHECKPOINT-P1-SUCCESS: Phase 1完全成功');
            
        } catch (error) {
            console.error('❌ CHECKPOINT-P1-ERROR: LineSeries創建失敗');
            console.error('❌ CHECKPOINT-P1-ERROR-DETAILS:', {
                message: error.message,
                name: error.name,
                stack: error.stack
            });
        }
        
        console.log('🔍 CHECKPOINT-P1-END: Phase 1測試結束');
    }
    
    testPhase2() {
        console.log('🧪 Phase 2: 創建LineSeries + 設置固定數據');
        
        try {
            const lineSeries = this.chart.addSeries(LightweightCharts.LineSeries, {
                color: '#00ff00',
                lineWidth: 1
            });
            
            // 使用固定的安全時間和價格
            lineSeries.setData([
                { time: 1609459200, value: 100 },  // 2021-01-01 00:00:00 UTC
                { time: 1609462800, value: 100 }   // 2021-01-01 01:00:00 UTC
            ]);
            
            this.priceLines.push(lineSeries);
            console.log('✅ Phase 2: 固定數據設置成功');
            
        } catch (error) {
            console.error('❌ Phase 2: 固定數據設置失敗:', error);
        }
    }
    
    testPhase3() {
        console.log('🧪 Phase 3: 最簡配置測試');
        
        try {
            // 使用LightweightCharts默認配置
            const lineSeries = this.chart.addSeries(LightweightCharts.LineSeries);
            
            // 最簡數據
            lineSeries.setData([
                { time: 1609459200, value: 50 }
            ]);
            
            this.priceLines.push(lineSeries);
            console.log('✅ Phase 3: 默認配置成功');
            
        } catch (error) {
            console.error('❌ Phase 3: 默認配置失敗:', error);
        }
    }
    
    // 進入下一階段測試
    nextPhase() {
        this.testPhase = Math.min(this.testPhase + 1, 3);
        console.log(`🔄 切換到 Phase ${this.testPhase}`);
    }
    
    // 重置到第一階段
    resetPhase() {
        this.testPhase = 1;
        console.log('🔄 重置到 Phase 1');
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
    
    // 相容性方法
    setChartTimeRange(chartData) {
        console.log('📅 時間範圍設置（跳過）');
    }
    
    setVisible(visible) {
        console.log(`👁️ 設置可見性: ${visible}`);
    }
    
    getStats() {
        return {
            totalFVGs: this.priceLines.length,
            currentPhase: this.testPhase,
            renderMethod: `Ultra Minimal Phase ${this.testPhase}`
        };
    }
}

// 導出給全域使用
if (typeof window !== 'undefined') {
    window.FVGRendererUltraMinimal = FVGRendererUltraMinimal;
}