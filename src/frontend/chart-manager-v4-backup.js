// 檔名：chart-manager.js - 圖表基本操作管理器

class ChartManager {
    constructor() {
        this.chart = null;
        this.candlestickSeries = null;
        this.fvgRenderer = null;
        this.manualLines = [];
        this.isDrawingLine = false;
    }

    /**
     * 初始化圖表
     */
    initialize(containerId) {
        const chartContainer = document.getElementById(containerId);
        if (!chartContainer) {
            throw new Error(`找不到圖表容器 #${containerId}`);
        }

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

        // 創建K線系列
        this.candlestickSeries = this.chart.addCandlestickSeries({
            upColor: CONFIG.COLORS.CANDLE.UP_COLOR,
            downColor: CONFIG.COLORS.CANDLE.DOWN_COLOR,
            borderDownColor: CONFIG.COLORS.CANDLE.BORDER_COLOR,
            borderUpColor: CONFIG.COLORS.CANDLE.BORDER_COLOR,
            wickDownColor: CONFIG.COLORS.CANDLE.WICK_COLOR,
            wickUpColor: CONFIG.COLORS.CANDLE.WICK_COLOR,
            priceScaleId: 'right',
        });

        // 初始化FVG渲染器
        this.fvgRenderer = new FVGRenderer(this.chart, this.candlestickSeries);

        // 綁定事件
        this.bindEvents();

        return this.chart;
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
        }
    }

    /**
     * 切換FVG顯示狀態
     */
    toggleFVG() {
        if (this.fvgRenderer) {
            return this.fvgRenderer.toggle();
        }
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
        this.manualLines.forEach(line => {
            this.candlestickSeries.removePriceLine(line);
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
        
        const line = this.candlestickSeries.createPriceLine({
            price: price,
            color: CONFIG.COLORS.MANUAL_LINE || '#2196F3',
            lineWidth: 2,
            lineStyle: LightweightCharts.LineStyle.Solid,
            axisLabelVisible: true,
            title: `手動線 ${this.manualLines.length + 1}`
        });
        
        this.manualLines.push(line);
        console.log(`添加手動線於價格: ${price}`);
        
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
     * 添加水平線
     */
    addHorizontalLine(param) {
        const price = this.candlestickSeries.coordinateToPrice(param.point.y);
        if (price === null) return;

        const line = this.candlestickSeries.createPriceLine({
            price: price,
            color: CONFIG.COLORS.MANUAL_LINE,
            lineWidth: 2,
            lineStyle: LightweightCharts.LineStyle.Dashed,
            axisLabelVisible: true,
            title: `手動線 ${price.toFixed(2)}`,
        });

        this.manualLines.push({
            price: price,
            line: line,
            timestamp: Date.now()
        });

        // 結束畫線模式
        this.toggleDrawLineMode();
        return line;
    }

    /**
     * 清除手動線
     */
    clearManualLines() {
        this.manualLines.forEach(item => {
            this.candlestickSeries.removePriceLine(item.line);
        });
        this.manualLines = [];
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
            item.line = this.candlestickSeries.createPriceLine({
                price: item.price,
                color: CONFIG.COLORS.MANUAL_LINE,
                lineWidth: 2,
                lineStyle: LightweightCharts.LineStyle.Dashed,
                axisLabelVisible: true,
                title: `手動線 ${item.price.toFixed(2)}`,
            });
        });
    }

    /**
     * 獲取FVG渲染器
     */
    getFVGRenderer() {
        return this.fvgRenderer;
    }

    /**
     * 銷毀圖表
     */
    destroy() {
        if (this.chart) {
            this.chart.remove();
            this.chart = null;
        }
    }
}

// 暴露到全局範圍
window.ChartManager = ChartManager;