// 檔名：chart-manager.js - 圖表基本操作管理器 (v5完全兼容版)

class ChartManager {
    constructor() {
        this.chart = null;
        this.candlestickSeries = null;
        this.fvgRenderer = null;
        this.manualLines = [];
        this.isDrawingLine = false;
        this.isV5 = false; // v5檢測標記
    }

    /**
     * 檢測Lightweight Charts版本
     */
    detectVersion() {
        try {
            // 檢查v5特有的功能
            if (typeof LightweightCharts.version === 'string' && 
                LightweightCharts.version.startsWith('5.')) {
                this.isV5 = true;
                console.log('檢測到 Lightweight Charts v5.x');
                return 'v5';
            }
            
            // 檢查是否有v5的API
            const testChart = LightweightCharts.createChart(document.createElement('div'), {
                width: 100, height: 100
            });
            
            const hasAddSeries = typeof testChart.addSeries === 'function';
            const hasSeriesType = typeof LightweightCharts.SeriesType !== 'undefined';
            
            testChart.remove(); // 清理測試圖表
            
            if (hasAddSeries && hasSeriesType) {
                this.isV5 = true;
                console.log('檢測到 Lightweight Charts v5.x (API檢測)');
                return 'v5';
            } else {
                this.isV5 = false;
                console.log('檢測到 Lightweight Charts v4.x');
                return 'v4';
            }
        } catch (error) {
            console.warn('版本檢測失敗，預設使用v4:', error);
            this.isV5 = false;
            return 'v4';
        }
    }

    /**
     * 初始化圖表
     */
    initialize(containerId) {
        const chartContainer = document.getElementById(containerId);
        if (!chartContainer) {
            throw new Error(`找不到圖表容器 #${containerId}`);
        }

        // 檢測版本
        const version = this.detectVersion();
        console.log(`使用 Lightweight Charts ${version}`);

        this.chart = LightweightCharts.createChart(chartContainer, {
            width: chartContainer.clientWidth,
            height: chartContainer.clientHeight,
            layout: {
                background: { type: 'solid', color: CONFIG.COLORS.CHART.BACKGROUND },
                textColor: CONFIG.COLORS.CHART.TEXT,
            },
            grid: {
                vertLines: { color: CONFIG.COLORS.CHART.GRID },
                horzLines: { color: CONFIG.COLORS.CHART.GRID },
            },
            crosshair: {
                mode: LightweightCharts.CrosshairMode.Normal,
            },
            rightPriceScale: {
                borderColor: CONFIG.COLORS.CHART.BORDER,
                autoScale: true,
            },
            timeScale: {
                borderColor: CONFIG.COLORS.CHART.BORDER,
                timeVisible: true,
                secondsVisible: false,
                rightOffset: CONFIG.CHART.RIGHT_OFFSET,
                barSpacing: CONFIG.CHART.BAR_SPACING,
                minBarSpacing: CONFIG.CHART.MIN_BAR_SPACING,
                fixLeftEdge: false,
                fixRightEdge: false,
                lockVisibleTimeRangeOnResize: true,
                rightBarStaysOnScroll: true,
                borderVisible: false,
                visible: true,
                tickMarkFormatter: (time) => {
                    const date = new Date(time * 1000);
                    const hours = date.getHours().toString().padStart(2, '0');
                    const minutes = date.getMinutes().toString().padStart(2, '0');
                    return `${hours}:${minutes}`;
                },
            },
            handleScroll: {
                mouseWheel: true,
                pressedMouseMove: true,
                horzTouchDrag: true,
                vertTouchDrag: true,
            },
            handleScale: {
                axisPressedMouseMove: true,
                mouseWheel: true,
                pinch: true,
            },
        });

        // 創建K線系列 - v5/v4兼容
        try {
            this.candlestickSeries = this.createCandlestickSeries();
            console.log('K線系列創建成功');
        } catch (error) {
            console.error('K線系列創建失敗:', error);
            throw new Error(`圖表系列創建失敗: ${error.message}`);
        }

        // 初始化FVG渲染器 - 根據版本選擇
        try {
            if (this.isV5 && window.FVGRendererV5) {
                this.fvgRenderer = new FVGRendererV5(this.chart, this.candlestickSeries);
                console.log('使用 FVG Renderer V5');
            } else if (window.FVGRenderer) {
                this.fvgRenderer = new FVGRenderer(this.chart, this.candlestickSeries);
                console.log('使用 FVG Renderer V4');
            } else {
                console.warn('沒有可用的FVG渲染器');
            }
        } catch (error) {
            console.error('FVG渲染器初始化失敗:', error);
        }

        // 綁定事件
        this.bindEvents();

        return this.chart;
    }

    /**
     * 創建K線系列 - v5/v4兼容
     */
    createCandlestickSeries() {
        const seriesOptions = {
            upColor: CONFIG.COLORS.CANDLE.UP_COLOR,
            downColor: CONFIG.COLORS.CANDLE.DOWN_COLOR,
            borderDownColor: CONFIG.COLORS.CANDLE.BORDER_COLOR,
            borderUpColor: CONFIG.COLORS.CANDLE.BORDER_COLOR,
            wickDownColor: CONFIG.COLORS.CANDLE.WICK_COLOR,
            wickUpColor: CONFIG.COLORS.CANDLE.WICK_COLOR,
            priceScaleId: 'right',
        };

        if (this.isV5) {
            // v5 API
            if (typeof LightweightCharts.SeriesType !== 'undefined') {
                return this.chart.addSeries(LightweightCharts.SeriesType.Candlestick, seriesOptions);
            } else {
                // 回退到字符串格式
                return this.chart.addSeries('Candlestick', seriesOptions);
            }
        } else {
            // v4 API
            return this.chart.addCandlestickSeries(seriesOptions);
        }
    }

    /**
     * 綁定圖表事件
     */
    bindEvents() {
        // 響應式調整
        window.addEventListener('resize', () => this.handleResize());

        // 圖表點擊事件（畫線用）
        this.chart.subscribeClick((param) => {
            if (this.isDrawingLine && param.point) {
                this.addHorizontalLine(param);
            }
        });
    }

    /**
     * 更新圖表數據
     */
    updateData(data) {
        const candleData = data.map(item => ({
            time: item.time,
            open: item.open,
            high: item.high,
            low: item.low,
            close: item.close,
        }));

        this.candlestickSeries.setData(candleData);
        return candleData;
    }

    /**
     * 重置縮放
     */
    resetZoom() {
        if (!this.chart) return;

        const candleData = this.candlestickSeries.data();
        if (candleData && candleData.length > 0) {
            const visibleBars = Math.min(CONFIG.CHART.DEFAULT_VISIBLE_CANDLES, candleData.length);
            const lastIndex = candleData.length - 1;
            const firstIndex = Math.max(0, lastIndex - visibleBars + 1);

            this.chart.timeScale().setVisibleRange({
                from: candleData[firstIndex].time,
                to: candleData[lastIndex].time
            });
        }

        this.chart.priceScale('right').applyOptions({
            autoScale: true
        });
    }

    /**
     * 更新FVG顯示
     */
    updateFVGs(fvgs, currentTimeframe = 'M15') {
        if (this.fvgRenderer) {
            this.fvgRenderer.render(fvgs, currentTimeframe);
        } else {
            console.warn('FVG渲染器未初始化');
        }
    }

    /**
     * 切換FVG顯示狀態
     */
    toggleFVG() {
        if (this.fvgRenderer) {
            return this.fvgRenderer.toggle();
        }
        console.warn('FVG渲染器未初始化');
        return false;
    }

    /**
     * 開始畫線模式
     */
    startDrawingMode() {
        this.isDrawingLine = true;
        console.log('進入畫線模式');
    }

    /**
     * 停止畫線模式
     */
    stopDrawingMode() {
        this.isDrawingLine = false;
        console.log('退出畫線模式');
    }

    /**
     * 清除所有手動線
     */
    clearAllLines() {
        this.manualLines.forEach(item => {
            try {
                if (item.line) {
                    this.candlestickSeries.removePriceLine(item.line);
                }
            } catch (error) {
                console.warn('清除線條時發生錯誤:', error);
            }
        });
        this.manualLines = [];
        console.log('清除所有手動線');
    }

    /**
     * 添加水平線
     */
    addHorizontalLine(param) {
        if (!param.point) return;
        
        const price = this.candlestickSeries.coordinateToPrice(param.point.y);
        if (price === null) return;
        
        try {
            const line = this.candlestickSeries.createPriceLine({
                price: price,
                color: CONFIG.COLORS.MANUAL_LINE || '#2196F3',
                lineWidth: 2,
                lineStyle: LightweightCharts.LineStyle.Solid,
                axisLabelVisible: true,
                title: `手動線 ${price.toFixed(2)}`
            });
            
            this.manualLines.push({
                price: price,
                line: line,
                timestamp: Date.now()
            });
            
            console.log(`添加手動線於價格: ${price}`);
        } catch (error) {
            console.error('添加水平線失敗:', error);
        }
        
        // 自動退出畫線模式
        this.stopDrawingMode();
    }

    /**
     * 處理響應式調整
     */
    handleResize() {
        const chartContainer = document.getElementById('chart');
        if (this.chart && chartContainer) {
            this.chart.applyOptions({
                width: chartContainer.clientWidth,
                height: chartContainer.clientHeight,
            });
        }
    }

    /**
     * 切換畫線模式
     */
    toggleDrawLineMode() {
        this.isDrawingLine = !this.isDrawingLine;
        const chartContainer = document.getElementById('chart');
        if (chartContainer) {
            chartContainer.style.cursor = this.isDrawingLine ? 'crosshair' : 'default';
        }
        return this.isDrawingLine;
    }

    /**
     * 重新繪製手動線
     */
    redrawManualLines() {
        if (!this.candlestickSeries || this.manualLines.length === 0) {
            return;
        }

        // 移除舊線
        this.manualLines.forEach(item => {
            if (item.line) {
                try {
                    this.candlestickSeries.removePriceLine(item.line);
                } catch (e) {
                    // 忽略錯誤
                }
            }
        });

        // 重新創建線
        this.manualLines.forEach(item => {
            try {
                item.line = this.candlestickSeries.createPriceLine({
                    price: item.price,
                    color: CONFIG.COLORS.MANUAL_LINE || '#2196F3',
                    lineWidth: 2,
                    lineStyle: LightweightCharts.LineStyle.Dashed,
                    axisLabelVisible: true,
                    title: `手動線 ${item.price.toFixed(2)}`,
                });
            } catch (error) {
                console.warn('重新創建線條失敗:', error);
            }
        });
    }

    /**
     * 獲取FVG渲染器
     */
    getFVGRenderer() {
        return this.fvgRenderer;
    }

    /**
     * 獲取版本信息
     */
    getVersionInfo() {
        return {
            isV5: this.isV5,
            version: this.isV5 ? 'v5.x' : 'v4.x',
            hasRenderer: !!this.fvgRenderer,
            rendererType: this.fvgRenderer?.constructor?.name || 'None'
        };
    }

    /**
     * 銷毀圖表
     */
    destroy() {
        if (this.chart) {
            this.chart.remove();
            this.chart = null;
            this.candlestickSeries = null;
            this.fvgRenderer = null;
        }
    }
}

// 暴露到全局範圍
window.ChartManager = ChartManager;