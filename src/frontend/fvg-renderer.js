// 檔名：fvg-renderer.js - FVG繪製管理器

class FVGRenderer {
    constructor(chart, candlestickSeries) {
        this.chart = chart;
        this.candlestickSeries = candlestickSeries;
        this.fvgSeries = [];  // 儲存FVG系列
        this.isVisible = true;
    }

    /**
     * 清除所有FVG顯示
     */
    clearAll() {
        this.fvgSeries.forEach(item => {
            try {
                if (item.series) {
                    this.chart.removeSeries(item.series);
                }
            } catch (error) {
                console.warn('清除FVG時發生錯誤:', error);
            }
        });
        this.fvgSeries = [];
    }

    /**
     * 繪製FVG列表
     */
    render(fvgs, currentTimeframe, playbackMode = false) {
        console.log('FVGRenderer.render - 收到', fvgs?.length || 0, '個FVG');
        console.log('顯示狀態:', this.isVisible);
        
        this.clearAll();
        
        if (!this.isVisible || !fvgs || fvgs.length === 0) {
            console.log('跳過FVG渲染 - 不可見或無數據');
            return;
        }

        console.log('開始渲染', fvgs.length, '個FVG');
        fvgs.forEach((fvg, index) => {
            console.log(`渲染FVG ${index}:`, fvg);
            this.renderSingle(fvg, index, currentTimeframe);
        });
    }

    /**
     * 繪製單個FVG
     */
    renderSingle(fvg, index, currentTimeframe) {
        const upper = Math.max(fvg.top, fvg.bot);
        const lower = Math.min(fvg.top, fvg.bot);
        
        // 計算時間範圍
        const startTime = fvg.left_time || fvg.time;
        const timeStep = ConfigUtils.getTimeframeSeconds(currentTimeframe);
        const maxExtendTime = startTime + (CONFIG.FVG.DISPLAY_LENGTH * timeStep);
        
        // 使用簡化的LineSeries方式繪製FVG填充
        this.createSimpleFVGFill(fvg.type, startTime, maxExtendTime, upper, lower, fvg.id);
    }

    /**
     * 創建簡化的FVG填充
     */
    createSimpleFVGFill(type, startTime, endTime, upper, lower, fvgId) {
        const height = upper - lower;
        const lineCount = Math.min(CONFIG.FVG.MAX_LINES, Math.max(CONFIG.FVG.FALLBACK_LINES, Math.floor(height / 0.25))); // 每0.25點一條線
        
        const timeData = [
            { time: startTime, value: 0 },
            { time: endTime, value: 0 }
        ];

        // 創建多條水平線模擬填充
        for (let i = 0; i <= lineCount; i++) {
            const price = lower + (height * i / lineCount);
            
            const fillLineData = timeData.map(point => ({
                time: point.time,
                value: price
            }));
            
            const fillLine = this.chart.addLineSeries({
                color: ConfigUtils.getFVGColor(type),
                lineWidth: CONFIG.FVG.LINE_WIDTH,
                lineStyle: LightweightCharts.LineStyle.Solid,
                priceScaleId: 'right',
                lastValueVisible: false,
                priceLineVisible: false,
            });
            
            fillLine.setData(fillLineData);
            this.fvgSeries.push({ series: fillLine, type: 'fill', fvgId: fvgId });
        }
    }

    /**
     * 切換顯示狀態
     */
    toggle() {
        this.isVisible = !this.isVisible;
        if (!this.isVisible) {
            this.clearAll();
        }
        return this.isVisible;
    }

    /**
     * 設置顯示狀態
     */
    setVisible(visible) {
        this.isVisible = visible;
        if (!visible) {
            this.clearAll();
        }
    }

    /**
     * 獲取像素高度（用於複雜渲染）
     */
    getPixelHeight(upper, lower) {
        try {
            const priceScale = this.chart.priceScale('right');
            if (!priceScale) return null;
            
            const yTop = priceScale.priceToCoordinate(upper);
            const yBot = priceScale.priceToCoordinate(lower);
            
            if (yTop === null || yBot === null) return null;
            
            const pixelHeight = Math.abs(yTop - yBot);
            return (pixelHeight > 0 && pixelHeight < 10000) ? pixelHeight : null;
        } catch (error) {
            return null;
        }
    }
}

// 暴露到全局範圍
window.FVGRenderer = FVGRenderer;