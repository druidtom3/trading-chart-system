// 檔名：fvg-renderer.js - FVG繪製管理器

class FVGRenderer {
    constructor(chart, candlestickSeries) {
        this.chart = chart;
        this.candlestickSeries = candlestickSeries;
        this.fvgSeries = [];  // 儲存FVG系列
        this.isVisible = true;
        
        // 初始化改進的自定義渲染器
        this.customRenderer = new FVGCustomRenderer(chart);
        this.customSeries = null;
    }

    /**
     * 清除所有FVG顯示
     */
    clearAll() {
        // 清除自定義系列
        if (this.customSeries) {
            try {
                this.chart.removeSeries(this.customSeries);
                this.customSeries = null;
            } catch (error) {
                console.warn('清除自定義FVG系列時發生錯誤:', error);
            }
        }
        
        // 清除傳統系列（回退方案用）
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

        // 嘗試使用改進的自定義渲染器
        try {
            if (window.CONFIG?.DEBUG) {
                console.log('嘗試使用改進的自定義FVG渲染器');
            }
            
            // 創建渲染器
            const renderer = this.customRenderer.createRenderer();
            
            // 使用插件API（如果可用）
            if (this.chart.addCustomSeries) {
                this.customSeries = this.chart.addCustomSeries(renderer);
                this.customRenderer.series = this.customSeries;
            } else {
                // 備用方案：直接創建插件系列
                this.customSeries = this.createPluginSeries(renderer);
                this.customRenderer.series = this.customSeries;
            }
            
            // 更新數據
            this.customRenderer.updateFVGs(filteredFvgs, currentTimeframe);
            
            if (window.CONFIG?.DEBUG) {
                console.log('改進的自定義FVG渲染器創建成功');
            }
            
        } catch (error) {
            console.warn('自定義FVG渲染器失敗，使用回退方案:', error);
            this.renderFallback(filteredFvgs, currentTimeframe);
        }
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
     * 使用單一粗線創建FVG矩形效果
     */
    createRectangleFVG(type, startTime, endTime, upper, lower, fvgId) {
        const height = upper - lower;
        
        // 調整透明度：加深顏色讓FVG更明顯
        let opacity;
        if (height > 20.0) {
            opacity = Math.min(0.25, 0.15 + ((height - 20.0) / 30.0) * 0.1);
        } else {
            opacity = 0.15;
        }
        
        // 使用一條極粗的線填充FVG區域
        const fvgLine = this.chart.addLineSeries({
            color: ConfigUtils.getFVGColor(type, opacity),
            lineWidth: Math.max(5, Math.min(100, height * 3)), // 線寬基於FVG高度
            lineStyle: LightweightCharts.LineStyle.Solid,
            priceScaleId: 'right',
            lastValueVisible: false,
            priceLineVisible: false,
            crosshairMarkerVisible: false,
        });
        
        // 線條位於FVG中心
        const centerPrice = (upper + lower) / 2;
        const lineData = [
            { time: startTime, value: centerPrice },
            { time: endTime, value: centerPrice }
        ];
        
        fvgLine.setData(lineData);
        
        // 只儲存一個系列
        this.fvgSeries.push({ 
            series: fvgLine, 
            type: 'single-line', 
            fvgId: fvgId 
        });
    }

    /**
     * 回退方案：使用多條線填充
     */
    renderFallback(fvgs, timeframe) {
        if (window.CONFIG?.DEBUG) {
            console.log('使用回退方案渲染', fvgs.length, '個FVG');
        }
        fvgs.forEach((fvg, index) => {
            this.renderSingle(fvg, index, timeframe);
        });
    }

    /**
     * 創建插件系列（備用方案）
     */
    createPluginSeries(renderer) {
        // 直接掛載到圖表的插件系統
        const plugin = {
            renderer: renderer,
            update: () => {
                if (this.chart && this.chart.applyOptions) {
                    this.chart.applyOptions({}); // 觸發重繪
                }
            }
        };
        
        // 註冊插件
        if (!this.chart._fvgPlugins) {
            this.chart._fvgPlugins = [];
            
            // 簡化版插件系統 - 使用定時重繪
            if (!this.chart._fvgRenderTimer) {
                this.chart._fvgRenderTimer = setInterval(() => {
                    if (this.chart._fvgPlugins && this.chart._fvgPlugins.length > 0) {
                        // 觸發重繪
                        this.chart.applyOptions({});
                    }
                }, 100); // 每100ms檢查一次
            }
        }
        
        this.chart._fvgPlugins.push(plugin);
        return plugin;
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