/**
 * FVG Minimal Renderer - 最簡化版本，用於排除所有問題因素
 */

class FVGRendererMinimal {
    constructor(chart, candlestickSeries) {
        this.chart = chart;
        this.candlestickSeries = candlestickSeries;
        this.priceLines = [];
        this.renderCallCount = 0;
        
        console.log('🔬 FVG Minimal Renderer 初始化 - 極簡調試模式');
    }
    
    /**
     * 極簡渲染 - 完全跳過LineSeries創建，只測試邏輯
     */
    render(fvgs, timeframe = 'M15') {
        this.renderCallCount++;
        
        console.log(`🔬 Minimal Render Call #${this.renderCallCount}`);
        console.log(`   - FVG Count: ${fvgs ? fvgs.length : 0}`);
        console.log(`   - Chart exists: ${!!this.chart}`);
        console.log(`   - CandlestickSeries exists: ${!!this.candlestickSeries}`);
        
        // 防止過多調用
        if (this.renderCallCount > 5) {
            console.error(`🚨 Minimal Renderer - 超過5次調用，停止渲染`);
            return;
        }
        
        // 完全跳過LineSeries創建，只做邏輯測試
        if (!fvgs || fvgs.length === 0) {
            console.log('⚠️ 沒有FVG數據，跳過渲染');
            return;
        }
        
        // 只分析數據，不創建任何圖形元素
        console.log(`🔍 分析FVG數據（不創建LineSeries）:`);
        
        fvgs.slice(0, 2).forEach((fvg, index) => {
            console.log(`   FVG[${index}]:`, {
                type: fvg.type,
                startTime: fvg.startTime,
                topPrice: fvg.topPrice,
                bottomPrice: fvg.bottomPrice,
                timeValid: this.validateTime(fvg.startTime),
                priceValid: this.validatePrice(fvg.topPrice, fvg.bottomPrice)
            });
        });
        
        console.log('✅ Minimal 分析完成（未創建圖形）');
    }
    
    validateTime(timestamp) {
        if (typeof timestamp !== 'number') return false;
        if (timestamp < 1000000000) return false; // 小於2001年
        if (timestamp > 2000000000) return false; // 大於2033年
        return true;
    }
    
    validatePrice(topPrice, bottomPrice) {
        if (typeof topPrice !== 'number') return false;
        if (typeof bottomPrice !== 'number') return false;
        if (topPrice <= bottomPrice) return false;
        return true;
    }
    
    clear() {
        console.log('🗑️ Minimal Clear - 無操作（無LineSeries需清除）');
        this.priceLines = [];
    }
    
    // 重置調用計數
    resetCallCount() {
        this.renderCallCount = 0;
        console.log('🔄 Minimal Renderer - 調用計數已重置');
    }
    
    // 相容性方法
    setVisible(visible) {
        console.log(`👁️ Minimal SetVisible: ${visible}`);
    }
    
    getStats() {
        return {
            totalFVGs: 0,
            renderCallCount: this.renderCallCount,
            renderMethod: 'Minimal Test Mode (No Graphics)'
        };
    }
}

// 導出給全域使用
if (typeof window !== 'undefined') {
    window.FVGRendererMinimal = FVGRendererMinimal;
}