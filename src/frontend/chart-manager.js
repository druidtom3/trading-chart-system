// 檔名：chart-manager.js - 圖表基本操作管理器 (v5完全兼容版本)

class ChartManager {
    constructor() {
        this.chart = null;
        this.candlestickSeries = null;
        this.fvgRenderer = null;
        this.manualLines = [];
        this.isDrawingLine = false;
        this.chartVersion = null;
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

        // 智能版本檢測與系列創建
        this.chartVersion = this.detectLightweightChartsVersion();
        console.log('檢測到 Lightweight Charts 版本:', this.chartVersion);
        
        this.candlestickSeries = this.createCandlestickSeries();
        
        // 初始化對應的FVG渲染器
        this.initializeFVGRenderer();

        // 綁定事件
        this.bindEvents();

        return this.chart;
    }

    /**
     * 檢測 Lightweight Charts 版本
     */
    detectLightweightChartsVersion() {
        try {
            console.log('開始版本檢測...');
            console.log('LightweightCharts 物件:', typeof LightweightCharts !== 'undefined' ? 'Available' : 'Unavailable');
            
            if (typeof LightweightCharts === 'undefined') {
                console.error('LightweightCharts 未載入！');
                return 'unknown';
            }
            
            // 檢查版本字符串（v5中可能是函數）
            let versionString = null;
            if (typeof LightweightCharts.version === 'string') {
                versionString = LightweightCharts.version;
            } else if (typeof LightweightCharts.version === 'function') {
                try {
                    versionString = LightweightCharts.version();
                } catch (e) {
                    console.warn('無法調用version()函數:', e);
                }
            }
            
            if (versionString) {
                console.log('檢測到版本字符串:', versionString);
                
                if (versionString.startsWith('5.')) {
                    console.log('根據版本字符串確認為 v5');
                    return 'v5';
                } else if (versionString.startsWith('4.')) {
                    console.log('根據版本字符串確認為 v4');
                    return 'v4';
                }
            }
            
            // 檢查 v5 特有的 API
            console.log('檢查 v5 API 特徵...');
            console.log('LightweightCharts.SeriesType:', typeof LightweightCharts.SeriesType);
            
            if (typeof LightweightCharts.SeriesType === 'object' && LightweightCharts.SeriesType) {
                console.log('SeriesType 物件:', Object.keys(LightweightCharts.SeriesType));
                if (LightweightCharts.SeriesType.Candlestick) {
                    console.log('確認為 Lightweight Charts v5.x (SeriesType.Candlestick 存在)');
                    return 'v5';
                }
            }
            
            // 檢查是否有 addSeries 方法（v5特徵）
            if (this.chart && typeof this.chart.addSeries === 'function') {
                console.log('確認為 Lightweight Charts v5.x (addSeries 方法存在)');
                return 'v5';
            }
            
            // 檢查 v4 的特徵
            console.log('檢查 v4 API 特徵...');
            if (this.chart && typeof this.chart.addCandlestickSeries === 'function') {
                console.log('檢測為 Lightweight Charts v4.x (addCandlestickSeries 存在)');
                return 'v4';
            }
            
            // 嘗試創建測試圖表來檢測版本
            try {
                const testContainer = document.createElement('div');
                testContainer.style.width = '100px';
                testContainer.style.height = '100px';
                testContainer.style.position = 'absolute';
                testContainer.style.left = '-1000px';
                document.body.appendChild(testContainer);
                
                const testChart = LightweightCharts.createChart(testContainer, {
                    width: 100,
                    height: 100
                });
                
                let detectedVersion = 'v4';
                
                // 檢查 v5 API
                if (typeof testChart.addSeries === 'function') {
                    console.log('測試圖表確認為 v5 (有 addSeries)');
                    detectedVersion = 'v5';
                } else if (typeof testChart.addCandlestickSeries === 'function') {
                    console.log('測試圖表確認為 v4 (有 addCandlestickSeries)');
                    detectedVersion = 'v4';
                }
                
                // 清理測試圖表
                testChart.remove();
                document.body.removeChild(testContainer);
                
                return detectedVersion;
                
            } catch (testError) {
                console.warn('測試圖表創建失敗:', testError);
            }
            
            console.warn('無法檢測 Lightweight Charts 版本，預設為 v4');
            return 'v4';
            
        } catch (error) {
            console.error('版本檢測過程中發生錯誤:', error);
            return 'v4';
        }
    }

    /**
     * 創建K線系列（智能版本適配）
     */
    createCandlestickSeries() {
        console.log('開始創建K線系列...');
        console.log('當前檢測版本:', this.chartVersion);
        console.log('圖表物件存在:', !!this.chart);
        
        const seriesConfig = {
            priceScaleId: 'right',
            lastValueVisible: false,
            priceLineVisible: false,
            upColor: '#26a69a',
            downColor: '#ef5350',
            borderDownColor: '#ef5350',
            borderUpColor: '#26a69a',
            wickDownColor: '#ef5350',
            wickUpColor: '#26a69a',
        };

        // v5 API修復 - 使用正確的參數格式
        const methods = [
            {
                name: 'v5_addSeries_CandlestickSeries',
                test: () => typeof this.chart.addSeries === 'function' && typeof LightweightCharts.CandlestickSeries !== 'undefined',
                execute: () => {
                    // v5正確的API格式: addSeries(CandlestickSeries, options)
                    console.log('使用 v5 API: addSeries(CandlestickSeries, options)');
                    return this.chart.addSeries(LightweightCharts.CandlestickSeries, seriesConfig);
                }
            },
            {
                name: 'v5_addSeries_string_type',
                test: () => typeof this.chart.addSeries === 'function',
                execute: () => {
                    // v5備選格式: addSeries('Candlestick', options)
                    console.log('使用 v5 API: addSeries("Candlestick", options)');
                    return this.chart.addSeries('Candlestick', seriesConfig);
                }
            },
            {
                name: 'v4_addCandlestickSeries',
                test: () => typeof this.chart.addCandlestickSeries === 'function',
                execute: () => {
                    // v4 API格式: addCandlestickSeries(options)
                    console.log('使用 v4 API: addCandlestickSeries(options)');
                    return this.chart.addCandlestickSeries(seriesConfig);
                }
            },
            {
                name: 'fallback_basic',
                test: () => true, // 最後回退方案
                execute: () => {
                    // 最基本的創建方式
                    if (typeof this.chart.addCandlestickSeries === 'function') {
                        console.log('使用基本回退: addCandlestickSeries()');
                        return this.chart.addCandlestickSeries({
                            upColor: '#26a69a',
                            downColor: '#ef5350'
                        });
                    }
                    throw new Error('No candlestick series creation method available');
                }
            }
        ];

        let lastError = null;
        
        for (const method of methods) {
            try {
                console.log(`嘗試方法: ${method.name}`);
                console.log(`條件檢查:`, method.test());
                
                if (method.test()) {
                    console.log(`執行方法: ${method.name}`);
                    const series = method.execute();
                    console.log(`成功! 使用方法: ${method.name}`);
                    console.log('創建的系列:', series);
                    return series;
                }
            } catch (error) {
                console.warn(`方法 ${method.name} 失敗:`, error.message);
                lastError = error;
            }
        }
        
        // 所有方法都失敗
        console.error('所有創建方法都失敗');
        console.error('最後錯誤:', lastError);
        
        // 詳細診斷
        console.log('=== 詳細診斷 ===');
        console.log('LightweightCharts:', typeof LightweightCharts);
        console.log('LightweightCharts.version:', LightweightCharts?.version);
        console.log('LightweightCharts.SeriesType:', typeof LightweightCharts?.SeriesType);
        if (LightweightCharts?.SeriesType) {
            console.log('SeriesType keys:', Object.keys(LightweightCharts.SeriesType));
        }
        console.log('chart.addSeries:', typeof this.chart?.addSeries);
        console.log('chart.addCandlestickSeries:', typeof this.chart?.addCandlestickSeries);
        console.log('chart methods:', this.chart ? Object.getOwnPropertyNames(this.chart).filter(name => name.includes('add')) : []);
        
        throw new Error(`無法創建K線系列。最後錯誤: ${lastError?.message || '未知錯誤'}`);
    }

    /**
     * 初始化FVG渲染器 - 統一使用優化版本
     */
    initializeFVGRenderer() {
        try {
            // 使用Logger系統進行日誌輸出
            const log = window.log || { 
                loading: (msg) => console.log(`📦 ${msg}`),
                success: (msg) => console.log(`✅ ${msg}`),
                error: (msg) => console.error(`❌ ${msg}`)
            };
            
            log.loading('初始化 FVG 渲染器');
            
            // 檢查必要組件
            if (!this.chart) {
                throw new Error('圖表實例未創建');
            }
            if (!this.candlestickSeries) {
                throw new Error('K線系列未創建');
            }
            
            // 統一使用優化版本，移除其他選擇邏輯
            if (window.FVGRendererOptimized) {
                this.fvgRenderer = new FVGRendererOptimized(this.chart, this.candlestickSeries);
                log.success('FVG優化渲染器初始化成功');
            } else {
                throw new Error('FVG渲染器未載入');
            }
            
            // 基本功能檢查
            if (typeof this.fvgRenderer.render !== 'function') {
                throw new Error('FVG渲染器缺少render方法');
            }
            if (typeof this.fvgRenderer.setVisible !== 'function') {
                throw new Error('FVG渲染器缺少setVisible方法');
            }
            
            log.success('FVG渲染器功能檢查通過');
            
        } catch (error) {
            const log = window.log || { 
                error: (msg, data) => console.error(`❌ ${msg}`, data || '')
            };
            
            log.error('FVG渲染器初始化失敗', error.message);
            this.fvgRenderer = null;
            
            // 簡化的故障排除信息
            if (window.log && window.log.debug) {
                window.log.debug('FVG渲染器故障排除', {
                    optimizedRenderer: !!window.FVGRendererOptimized,
                    chart: !!this.chart,
                    candlestickSeries: !!this.candlestickSeries,
                    error: error.message
                });
            }
        }
    }

    /**
     * 獲取版本信息API - 簡化版本信息
     */
    getVersionInfo() {
        return {
            fvgRendererType: 'multiline',
            lightweightChartsVersion: LightweightCharts.version || 'unknown',
            renderingMethod: 'LineSeries-based multi-line',
            rendererStatus: this.fvgRenderer ? 'loaded' : 'failed',
            stats: this.fvgRenderer ? this.fvgRenderer.getStats() : null
        };
    }

    /**
     * 獲取當前使用的圖表版本
     */
    getChartVersion() {
        return this.chartVersion || 'unknown';
    }

    /**
     * 檢查是否使用優化渲染器
     */
    isUsingOptimizedRenderer() {
        return this.fvgRenderer instanceof window.FVGRendererOptimized;
    }

    /**
     * 綁定圖表事件
     */
    bindEvents() {
        // 響應式調整
        window.addEventListener('resize', () => this.handleResize());

        // 圖表點擊事件（畫線用）- 暫時禁用測試細線問題
        /*
        this.chart.subscribeClick((param) => {
            if (this.isDrawingLine && param.point) {
                this.addHorizontalLine(param);
            }
        });
        */
    }

    /**
     * 更新圖表數據
     */
    updateData(data) {
        console.log('🔍 CHECKPOINT-CHARTMGR-INPUT: ChartManager收到數據', {
            dataType: typeof data,
            isArray: Array.isArray(data),
            length: data ? data.length : 0,
            sample: data && data.length > 0 ? data[0] : null
        });

        if (!data || !Array.isArray(data)) {
            const error = new Error(`ChartManager.updateData: 無效數據類型 ${typeof data}`);
            console.error('❌ CHECKPOINT-CHARTMGR-INVALID:', error.message);
            throw error;
        }

        if (data.length === 0) {
            console.warn('⚠️ CHECKPOINT-CHARTMGR-EMPTY: 收到空數據陣列');
            return [];
        }

        // 驗證並轉換數據
        const candleData = [];
        const invalidItems = [];

        for (let i = 0; i < data.length; i++) {
            const item = data[i];
            
            // 檢查每個數據項
            if (!item) {
                invalidItems.push(`第${i}項為null/undefined`);
                continue;
            }

            // 檢查必要字段
            const requiredFields = ['time', 'open', 'high', 'low', 'close'];
            const missingFields = requiredFields.filter(field => 
                item[field] === null || item[field] === undefined || 
                (field !== 'time' && (isNaN(item[field]) || !isFinite(item[field])))
            );

            if (missingFields.length > 0) {
                invalidItems.push(`第${i}項缺少有效字段: ${missingFields.join(', ')} (值: ${JSON.stringify(item)})`);
                continue;
            }

            // 轉換為圖表格式 - 加強數據驗證
            const open = parseFloat(item.open);
            const high = parseFloat(item.high);
            const low = parseFloat(item.low);
            const close = parseFloat(item.close);
            const time = parseInt(item.time);
            
            // 二次驗證：確保所有數字都是有效的
            if (!isFinite(open) || !isFinite(high) || !isFinite(low) || !isFinite(close) || !isFinite(time)) {
                invalidItems.push(`第${i}項數字轉換失敗: time=${time}, OHLC=[${open},${high},${low},${close}]`);
                continue;
            }
            
            // 邏輯驗證：高價不能低於低價
            if (high < low) {
                invalidItems.push(`第${i}項邏輯錯誤: high(${high}) < low(${low})`);
                continue;
            }
            
            candleData.push({
                time: time,
                open: open,
                high: high,
                low: low,
                close: close,
            });
        }

        // 報告驗證結果
        if (invalidItems.length > 0) {
            console.error('❌ CHECKPOINT-CHARTMGR-VALIDATION: 發現無效數據項:', {
                totalCount: data.length,
                validCount: candleData.length,
                invalidCount: invalidItems.length,
                invalidItems: invalidItems.slice(0, 5) // 只顯示前5個
            });
            
            if (candleData.length === 0) {
                throw new Error('ChartManager.updateData: 所有數據都無效');
            }
        }

        console.log('✅ CHECKPOINT-CHARTMGR-VALIDATED: 數據驗證完成', {
            originalCount: data.length,
            validCount: candleData.length,
            firstCandle: candleData[0],
            lastCandle: candleData[candleData.length - 1]
        });

        // 檢查candlestickSeries是否存在
        if (!this.candlestickSeries) {
            const error = new Error('ChartManager.updateData: candlestickSeries未初始化');
            console.error('❌ CHECKPOINT-CHARTMGR-NO-SERIES:', error.message);
            console.error('嘗試重新初始化K線系列...');
            
            try {
                this.candlestickSeries = this.createCandlestickSeries();
                if (!this.candlestickSeries) {
                    throw new Error('K線系列重新初始化失敗');
                }
                console.log('✅ K線系列重新初始化成功');
            } catch (reinitError) {
                console.error('❌ K線系列重新初始化失敗:', reinitError);
                throw new Error(`candlestickSeries未初始化且無法重新創建: ${reinitError.message}`);
            }
        }

        // 最終安全檢查
        if (!this.candlestickSeries || typeof this.candlestickSeries.setData !== 'function') {
            throw new Error('candlestickSeries不存在或setData方法不可用');
        }
        
        // 數據最終驗證
        if (!candleData || !Array.isArray(candleData) || candleData.length === 0) {
            throw new Error('經過驗證的candleData無效或為空');
        }
        
        try {
            this.candlestickSeries.setData(candleData);
            console.log('✅ CHECKPOINT-CHARTMGR-SUCCESS: 圖表數據設置成功');
        } catch (setDataError) {
            console.error('❌ CHECKPOINT-CHARTMGR-SETDATA-FAILED:', setDataError);
            console.error('setDataError詳情:', {
                message: setDataError.message,
                stack: setDataError.stack,
                candlestickSeries: !!this.candlestickSeries,
                chart: !!this.chart,
                dataLength: candleData.length,
                sampleData: candleData.slice(0, 3)
            });
            throw new Error(`ChartManager.setData 失敗: ${setDataError.message}`);
        }

        // 設置FVG渲染器的時間範圍（修復版本需要）
        if (this.fvgRenderer && typeof this.fvgRenderer.setChartTimeRange === 'function') {
            this.fvgRenderer.setChartTimeRange(candleData);
            console.log('📅 已設置FVG渲染器時間範圍');
        }
        
        return candleData;
    }

    /**
     * 重置縮放
     */
    resetZoom() {
        if (!this.chart || !this.candlestickSeries) {
            console.warn('resetZoom: 圖表或K線系列不存在');
            return;
        }

        try {
            // 檢查timeScale方法是否存在
            if (!this.chart.timeScale || typeof this.chart.timeScale !== 'function') {
                console.error('resetZoom: timeScale方法不存在');
                return;
            }

            // 嘗試獲取K線數據
            let candleData = null;
            
            if (typeof this.candlestickSeries.data === 'function') {
                try {
                    candleData = this.candlestickSeries.data();
                } catch (dataError) {
                    console.warn('resetZoom: 無法獲取K線數據:', dataError);
                }
            }
            
            if (candleData && Array.isArray(candleData) && candleData.length > 0) {
                const defaultVisibleBars = (window.CONFIG?.CHART?.DEFAULT_VISIBLE_CANDLES) || 400;
                const visibleBars = Math.min(defaultVisibleBars, candleData.length);
                const lastIndex = candleData.length - 1;
                const firstIndex = Math.max(0, lastIndex - visibleBars + 1);

                // 驗證數據項是否有time屬性
                const firstTime = candleData[firstIndex]?.time;
                const lastTime = candleData[lastIndex]?.time;
                
                if (firstTime && lastTime) {
                    this.chart.timeScale().setVisibleRange({
                        from: firstTime,
                        to: lastTime
                    });
                } else {
                    console.warn('resetZoom: K線數據缺少time屬性，使用fitContent');
                    this.chart.timeScale().fitContent();
                }
            } else {
                // 如果無法獲取數據，進行基本的縮放重置
                console.log('resetZoom: 無K線數據，使用fitContent');
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
        // 簡單返回，避免遞迴初始化導致堆棧溢出
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