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

        // 使用安全的配置值（防止CONFIG未載入）
        const safeConfig = {
            colors: {
                background: '#ffffff',
                text: '#333333',
                grid: '#f0f0f0',
                border: '#cccccc'
            },
            chart: {
                rightOffset: 5,
                barSpacing: 6,
                minBarSpacing: 0.5
            }
        };

        // 如果CONFIG可用，使用CONFIG的值
        if (typeof window.CONFIG !== 'undefined') {
            safeConfig.colors.background = window.CONFIG.COLORS.CHART.BACKGROUND;
            safeConfig.colors.text = window.CONFIG.COLORS.CHART.TEXT;
            safeConfig.colors.grid = window.CONFIG.COLORS.CHART.GRID;
            safeConfig.colors.border = window.CONFIG.COLORS.CHART.BORDER;
            safeConfig.chart.rightOffset = window.CONFIG.CHART.RIGHT_OFFSET;
            safeConfig.chart.barSpacing = window.CONFIG.CHART.BAR_SPACING;
            safeConfig.chart.minBarSpacing = window.CONFIG.CHART.MIN_BAR_SPACING;
        }

        this.chart = LightweightCharts.createChart(chartContainer, {
            width: chartContainer.clientWidth,
            height: chartContainer.clientHeight,
            layout: {
                background: { type: 'solid', color: safeConfig.colors.background },
                textColor: safeConfig.colors.text,
            },
            grid: {
                vertLines: { color: safeConfig.colors.grid },
                horzLines: { color: safeConfig.colors.grid },
            },
            crosshair: {
                mode: LightweightCharts.CrosshairMode.Normal,
            },
            rightPriceScale: {
                borderColor: safeConfig.colors.border,
                autoScale: true,
            },
            timeScale: {
                borderColor: safeConfig.colors.border,
                timeVisible: true,
                secondsVisible: false,
                rightOffset: safeConfig.chart.rightOffset,
                barSpacing: safeConfig.chart.barSpacing,
                minBarSpacing: safeConfig.chart.minBarSpacing,
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

        // 創建K線系列 - 簡化並強化錯誤處理
        console.log('開始創建K線系列...');
        console.log('chart對象存在:', !!this.chart);
        console.log('LightweightCharts可用:', typeof LightweightCharts !== 'undefined');
        
        // 檢查基本前提條件
        if (!this.chart) {
            throw new Error('圖表對象未正確創建');
        }
        
        if (typeof LightweightCharts === 'undefined') {
            throw new Error('LightweightCharts 未載入');
        }
        
        // 檢查版本信息
        if (typeof LightweightCharts.version === 'string') {
            console.log('LightweightCharts版本:', LightweightCharts.version);
        }
        
        try {
            // 優先嘗試標準的addCandlestickSeries
            console.log('嘗試創建K線系列...');
            
            // 準備通用的系列配置
            const baseSeriesConfig = {
                priceScaleId: 'right',
                lastValueVisible: false,
                priceLineVisible: false,
            };
            
            // v5 API 檢查和診斷
            console.log('檢查 v5 API...');
            const allMethods = Object.getOwnPropertyNames(this.chart);
            console.log('chart 物件的所有方法:', allMethods);
            
            // 檢查 prototype 方法
            const prototypeMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(this.chart));
            console.log('chart prototype 方法:', prototypeMethods);
            
            let seriesCreated = false;
            
            // 嘗試所有可能的系列創建方法
            const possibleMethods = [
                // v5 可能的方法
                { name: 'addCandlestickSeries', type: 'function', params: [] },
                { name: 'addLineSeries', type: 'function', params: [] },
                { name: 'addSeries', type: 'function', params: ['Candlestick'] },
                { name: 'createSeries', type: 'function', params: ['Candlestick'] },
                { name: 'addBarSeries', type: 'function', params: [] },
                { name: 'addAreaSeries', type: 'function', params: [] }
            ];
            
            for (const method of possibleMethods) {
                if (typeof this.chart[method.name] === 'function') {
                    console.log(`嘗試使用: ${method.name}`);
                    try {
                        const seriesConfig = {
                            ...baseSeriesConfig,
                            upColor: '#26a69a',
                            downColor: '#ef5350',
                            borderDownColor: '#ef5350',
                            borderUpColor: '#26a69a',
                            wickDownColor: '#ef5350',
                            wickUpColor: '#26a69a',
                            color: '#26a69a', // 為線條系列準備
                            lineWidth: 2
                        };
                        
                        if (method.name === 'addSeries') {
                            // v5 addSeries 需要使用 LightweightCharts.SeriesType
                            console.log('嘗試 v5 addSeries 與 LightweightCharts.SeriesType');
                            
                            // 檢查可用的系列類型
                            console.log('可用的 LightweightCharts 屬性:', Object.keys(LightweightCharts));
                            
                            // 嘗試不同的系列類型格式
                            const seriesTypes = [
                                LightweightCharts.CandlestickSeries,
                                'Candlestick',
                                'candlestick',
                                LightweightCharts.SeriesType?.Candlestick,
                                LightweightCharts.LineSeries,
                                'Line',
                                'line'
                            ];
                            
                            let foundType = null;
                            for (const seriesType of seriesTypes) {
                                if (seriesType !== undefined) {
                                    console.log(`嘗試系列類型:`, seriesType);
                                    try {
                                        this.candlestickSeries = this.chart.addSeries(seriesType, seriesConfig);
                                        foundType = seriesType;
                                        console.log(`成功使用系列類型:`, seriesType);
                                        break;
                                    } catch (typeError) {
                                        console.warn(`系列類型 ${seriesType} 失敗:`, typeError.message);
                                    }
                                }
                            }
                            
                            if (!foundType) {
                                throw new Error('所有系列類型都失敗');
                            }
                        } else if (method.params.length > 0) {
                            // 需要參數的方法
                            this.candlestickSeries = this.chart[method.name](...method.params, seriesConfig);
                        } else {
                            // 不需要參數的方法
                            this.candlestickSeries = this.chart[method.name](seriesConfig);
                        }
                        
                        console.log(`${method.name} 創建成功!`);
                        console.log('創建的系列對象:', this.candlestickSeries);
                        seriesCreated = true;
                        break;
                    } catch (error) {
                        console.error(`${method.name} 失敗:`, error);
                    }
                }
            }
            
            // 如果還是失敗，最後診斷
            if (!seriesCreated) {
                // 檢查是否是 API 版本問題
                console.error('=== 完整診斷信息 ===');
                console.log('LightweightCharts 版本:', LightweightCharts.version || '未知');
                console.log('LightweightCharts 物件:', LightweightCharts);
                console.log('chart 實例:', this.chart);
                console.log('chart 構造函數:', this.chart.constructor.name);
                
                // 嘗試訪問內部 API
                if (this.chart._private) {
                    console.log('chart._private:', Object.keys(this.chart._private));
                }
                
                // 檢查是否有 addSeries 的任何變體
                const seriesRelatedMethods = [...allMethods, ...prototypeMethods].filter(name =>
                    name.toLowerCase().includes('series') || 
                    name.toLowerCase().includes('add') ||
                    name.toLowerCase().includes('create')
                );
                console.log('所有與系列相關的方法:', seriesRelatedMethods);
                
                throw new Error(`v5 API 不兼容: 無法找到任何系列創建方法。可用方法: ${seriesRelatedMethods.join(', ')}`);
            }
            
            // 驗證系列是否成功創建
            if (!this.candlestickSeries) {
                throw new Error('系列對象為null或undefined');
            }
            
            console.log('圖表系列創建並驗證成功');
            
        } catch (error) {
            console.error('系列創建失敗:', error.message);
            console.error('錯誤詳情:', error);
            
            // 提供更詳細的錯誤信息
            const errorDetails = {
                chartExists: !!this.chart,
                lightweightChartsExists: typeof LightweightCharts !== 'undefined',
                addCandlestickSeriesExists: typeof this.chart?.addCandlestickSeries === 'function',
                addLineSeriesExists: typeof this.chart?.addLineSeries === 'function',
                chartType: typeof this.chart,
                availableMethods: this.chart ? Object.getOwnPropertyNames(this.chart).filter(n => n.includes('add')) : []
            };
            
            console.error('錯誤診斷信息:', errorDetails);
            throw new Error(`無法創建圖表系列: ${error.message} | 診斷: ${JSON.stringify(errorDetails)}`);
        }

        // 檢測 Lightweight Charts 版本並初始化對應的FVG渲染器
        const chartVersion = this.detectLightweightChartsVersion();
        console.log('檢測到 Lightweight Charts 版本:', chartVersion);
        
        if (chartVersion >= 5 && window.FVGRendererV5) {
            console.log('使用 v5 FVG 渲染器');
            this.fvgRenderer = new FVGRendererV5(this.chart, this.candlestickSeries);
            this.chartVersion = 'v5';
        } else if (window.FVGRenderer) {
            console.log('使用 v4 兼容 FVG 渲染器');
            this.fvgRenderer = new FVGRenderer(this.chart, this.candlestickSeries);
            this.chartVersion = 'v4';
        } else {
            console.error('沒有可用的FVG渲染器');
            this.chartVersion = 'unknown';
        }

        // 綁定事件
        this.bindEvents();

        return this.chart;
    }

    /**
     * 檢測 Lightweight Charts 版本
     */
    detectLightweightChartsVersion() {
        try {
            // 檢查v5專有的API
            if (typeof this.chart.addCustomSeries === 'function') {
                console.log('確認為 Lightweight Charts v5.x');
                return 5;
            }
            
            // 檢查v4的特徵
            if (typeof LightweightCharts.createChart === 'function') {
                console.log('檢測為 Lightweight Charts v4.x');
                return 4;
            }
            
            // 未知版本
            console.warn('無法檢測 Lightweight Charts 版本');
            return 0;
            
        } catch (error) {
            console.error('版本檢測過程中發生錯誤:', error);
            return 0;
        }
    }

    /**
     * 獲取當前使用的圖表版本
     */
    getChartVersion() {
        return this.chartVersion || 'unknown';
    }

    /**
     * 檢查是否使用v5渲染器
     */
    isUsingV5Renderer() {
        return this.fvgRenderer && typeof this.fvgRenderer.isUsingV5Renderer === 'function' 
            ? this.fvgRenderer.isUsingV5Renderer() 
            : false;
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
        if (!this.chart || !this.candlestickSeries) return;

        try {
            // 嘗試獲取K線數據
            let candleData = null;
            
            if (typeof this.candlestickSeries.data === 'function') {
                candleData = this.candlestickSeries.data();
            }
            
            if (candleData && candleData.length > 0) {
                const defaultVisibleBars = (window.CONFIG?.CHART?.DEFAULT_VISIBLE_CANDLES) || 400;
                const visibleBars = Math.min(defaultVisibleBars, candleData.length);
                const lastIndex = candleData.length - 1;
                const firstIndex = Math.max(0, lastIndex - visibleBars + 1);

                this.chart.timeScale().setVisibleRange({
                    from: candleData[firstIndex].time,
                    to: candleData[lastIndex].time
                });
            } else {
                // 如果無法獲取數據，進行基本的縮放重置
                this.chart.timeScale().fitContent();
            }

            this.chart.priceScale('right').applyOptions({
                autoScale: true
            });
        } catch (error) {
            console.warn('重置縮放時發生錯誤:', error);
            // 降級處理：只進行自動縮放
            try {
                this.chart.priceScale('right').applyOptions({
                    autoScale: true
                });
            } catch (fallbackError) {
                console.error('降級縮放重置也失敗:', fallbackError);
            }
        }
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
        if (!param || !param.point || !this.candlestickSeries) return;
        
        try {
            const price = this.candlestickSeries.coordinateToPrice(param.point.y);
            if (price === null || isNaN(price)) return;

            const manualLineColor = (window.CONFIG?.COLORS?.MANUAL_LINE) || '#2196F3';
            
            const line = this.candlestickSeries.createPriceLine({
                price: price,
                color: manualLineColor,
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

            console.log(`添加手動線於價格: ${price.toFixed(2)}`);

            // 結束畫線模式
            this.toggleDrawLineMode();
            return line;
        } catch (error) {
            console.error('添加手動線失敗:', error);
            return null;
        }
    }

    /**
     * 清除手動線
     */
    clearManualLines() {
        if (!this.candlestickSeries) return;
        
        this.manualLines.forEach(item => {
            try {
                if (item.line) {
                    this.candlestickSeries.removePriceLine(item.line);
                }
            } catch (error) {
                console.warn('清除手動線時發生錯誤:', error);
            }
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

        const manualLineColor = (window.CONFIG?.COLORS?.MANUAL_LINE) || '#2196F3';

        // 移除舊線
        this.manualLines.forEach(item => {
            if (item.line) {
                try {
                    this.candlestickSeries.removePriceLine(item.line);
                } catch (e) {
                    console.warn('移除舊手動線時發生錯誤:', e);
                }
            }
        });

        // 重新創建線
        this.manualLines.forEach(item => {
            try {
                item.line = this.candlestickSeries.createPriceLine({
                    price: item.price,
                    color: manualLineColor,
                    lineWidth: 2,
                    lineStyle: LightweightCharts.LineStyle.Dashed,
                    axisLabelVisible: true,
                    title: `手動線 ${item.price.toFixed(2)}`,
                });
            } catch (error) {
                console.warn('重新創建手動線時發生錯誤:', error);
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