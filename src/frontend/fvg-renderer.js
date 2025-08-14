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
    render(fvgs, currentTimeframe = 'M15', playbackMode = false) {
        // 調試模式下顯示渲染信息
        if (window.CONFIG?.DEBUG) {
            console.log('FVGRenderer.render - 收到', fvgs?.length || 0, '個FVG');
            console.log('當前時間刻度:', currentTimeframe);
            console.log('顯示狀態:', this.isVisible);
        }
        
        this.clearAll();
        
        if (!this.isVisible || !fvgs || fvgs.length === 0) {
            if (window.CONFIG?.DEBUG) {
                console.log('跳過FVG渲染 - 不可見或無數據');
            }
            return;
        }

        // 過濾掉太小的FVG（高度小於1點的）
        const filteredFvgs = fvgs.filter(fvg => {
            const height = Math.abs(fvg.top - fvg.bot);
            return height >= 1.0; // 最小高度過濾器
        });

        if (window.CONFIG?.DEBUG) {
            console.log('過濾後FVG數量:', filteredFvgs.length, '(原:', fvgs.length, ')');
        }

        // 確保時間刻度正確
        if (!currentTimeframe) {
            console.warn('FVG渲染: 未提供時間刻度，使用預設M15');
            currentTimeframe = 'M15';
        }

        if (window.CONFIG?.DEBUG) {
            console.log('開始渲染', filteredFvgs.length, '個FVG，時間刻度:', currentTimeframe);
        }
        filteredFvgs.forEach((fvg, index) => {
            if (window.CONFIG?.DEBUG) {
                console.log(`渲染FVG ${index}:`, fvg);
            }
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
        
        // 使用矩形方式繪製FVG
        this.createRectangleFVG(fvg.type, startTime, maxExtendTime, upper, lower, fvg.id);
    }

    /**
     * 使用單一線系列創建FVG矩形效果
     */
    createRectangleFVG(type, startTime, endTime, upper, lower, fvgId) {
        const height = upper - lower;
        
        // 調整透明度：加深顏色讓FVG更明顯
        let opacity;
        if (height > 20.0) {
            opacity = Math.min(0.25, 0.15 + ((height - 20.0) / 30.0) * 0.1); // >20點: 0.15到0.25
        } else {
            opacity = 0.12; // <=20點: 統一0.12 (比原來的0.08深)
        }
        
        // 創建單一線系列，用加粗的線寬模擬矩形填充
        const fvgLine = this.chart.addLineSeries({
            color: ConfigUtils.getFVGColor(type, opacity),
            lineWidth: Math.max(2, Math.min(20, Math.floor(height * 0.8))), // 動態線寬，但有最大值限制
            lineStyle: LightweightCharts.LineStyle.Solid,
            priceScaleId: 'right',
            lastValueVisible: false,
            priceLineVisible: false,
            crosshairMarkerVisible: false,
        });
        
        // 使用FVG中心位置繪製線條，讓線寬覆蓋整個FVG區域
        const centerPrice = (upper + lower) / 2;
        const lineData = [
            { time: startTime, value: centerPrice },
            { time: endTime, value: centerPrice }
        ];
        
        fvgLine.setData(lineData);
        
        // 另外添加邊框線條以明確區域邊界
        const topBorder = this.chart.addLineSeries({
            color: ConfigUtils.getFVGColor(type, opacity * 1.5), // 邊框稍深
            lineWidth: 1,
            lineStyle: LightweightCharts.LineStyle.Solid,
            priceScaleId: 'right',
            lastValueVisible: false,
            priceLineVisible: false,
            crosshairMarkerVisible: false,
        });
        
        const bottomBorder = this.chart.addLineSeries({
            color: ConfigUtils.getFVGColor(type, opacity * 1.5), // 邊框稍深
            lineWidth: 1,
            lineStyle: LightweightCharts.LineStyle.Solid,
            priceScaleId: 'right',
            lastValueVisible: false,
            priceLineVisible: false,
            crosshairMarkerVisible: false,
        });
        
        const topData = [
            { time: startTime, value: upper },
            { time: endTime, value: upper }
        ];
        
        const bottomData = [
            { time: startTime, value: lower },
            { time: endTime, value: lower }
        ];
        
        topBorder.setData(topData);
        bottomBorder.setData(bottomData);
        
        // 儲存所有系列以便之後清除
        this.fvgSeries.push({ series: fvgLine, type: 'rectangle-fill', fvgId: fvgId });
        this.fvgSeries.push({ series: topBorder, type: 'rectangle-top-border', fvgId: fvgId });
        this.fvgSeries.push({ series: bottomBorder, type: 'rectangle-bottom-border', fvgId: fvgId });
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