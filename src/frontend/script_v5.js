// 檔名：script_v5.js
// Lightweight Charts v5.0 升級版本 - FVG 使用 Primitives API

console.log('script_v5.js 開始載入...');

// 檢查 Lightweight Charts v5.0 和 Primitives
if (typeof LightweightCharts === 'undefined') {
    console.error('LightweightCharts 未定義');
    alert('圖表庫載入失敗，請重新整理頁面');
}

// 檢查 Primitives 插件
if (typeof LightweightCharts.Primitives === 'undefined') {
    console.warn('Primitives 插件未載入，回退到 LineSeries 模式');
}

// 檢查 CandleAggregator
if (typeof CandleAggregator === 'undefined') {
    console.error('CandleAggregator 未定義');
}

class TradingChartAppV5 {
    constructor() {
        console.log('TradingChartAppV5 建構中...');
        this.chart = null;
        this.candlestickSeries = null;
        this.currentData = null;
        this.currentTimeframe = 'M15';

        // FVG 相關屬性 - v5.0 版本
        this.fvgSeries = null;  // 自定義 FVG 系列
        this.fvgRenderer = null;  // FVG 渲染器
        this.showFVG = true;
        this.playbackFVGs = [];
        this.playbackCandles = [];
        
        // 回退模式屬性（當 Primitives 不可用時）
        this.usePrimitives = typeof LightweightCharts.Primitives !== 'undefined';
        this.fvgRectangles = [];  // LineSeries 回退模式
        
        // 其他屬性保持不變
        this.horizontalLines = [];
        this.isDrawingLine = false;
        this.manualLines = [];
        this.candleAggregator = new CandleAggregator();
        this.m1PlaybackData = null;
        this.currentPlaybackTime = null;
        this.playbackIndex = 0;
        this.isPlaying = false;
        this.playbackTimer = null;
        this.countdownTimer = null;
        this.countdownValue = 0;
        this.dataCache = new Map();

        try {
            this.initializeChart();
            this.initializeFVG();
            this.bindEvents();

            setTimeout(() => {
                console.log('延遲載入觸發 (v5.0)');
                this.loadRandomData();
            }, 1000);

        } catch (error) {
            console.error('初始化失敗:', error);
            alert(`初始化失敗: ${error.message}`);
        }
    }

    initializeChart() {
        console.log('開始初始化圖表... (v5.0)');

        const chartContainer = document.getElementById('chart');
        if (!chartContainer) {
            throw new Error('找不到圖表容器 #chart');
        }

        // 與 v4.1.3 相同的圖表初始化
        this.chart = LightweightCharts.createChart(chartContainer, {
            width: chartContainer.clientWidth,
            height: chartContainer.clientHeight,
            layout: {
                background: { type: 'solid', color: '#ffffff' },
                textColor: '#333333',
            },
            grid: {
                vertLines: { color: '#f0f0f0' },
                horzLines: { color: '#f0f0f0' },
            },
            crosshair: {
                mode: LightweightCharts.CrosshairMode.Normal,
            },
            rightPriceScale: {
                borderColor: '#cccccc',
                autoScale: true,
            },
            timeScale: {
                borderColor: '#cccccc',
                rightOffset: 20,
                barSpacing: 10,
                minBarSpacing: 5,
                visible: true,
                timeVisible: true,
                secondsVisible: false,
            },
        });

        // 創建 K線系列 - v5.0 API
        try {
            // 嘗試 v5.0 新 API
            this.candlestickSeries = this.chart.addSeries(LightweightCharts.CandlestickSeries, {
                upColor: '#26a69a',
                downColor: '#ef5350',
                borderVisible: false,
                wickUpColor: '#26a69a',
                wickDownColor: '#ef5350',
            });
        } catch (error) {
            console.warn('v5.0 API 失敗，嘗試 v4.1.3 API:', error);
            // 回退到 v4.1.3 API
            this.candlestickSeries = this.chart.addCandlestickSeries({
                upColor: '#26a69a',
                downColor: '#ef5350',
                borderVisible: false,
                wickUpColor: '#26a69a',
                wickDownColor: '#ef5350',
            });
        }

        // 圖表事件處理
        this.chart.subscribeCrosshairMove(param => {
            this.handleCrosshairMove(param);
        });

        // 響應式調整
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                const { width, height } = entry.contentRect;
                this.chart.resize(width, height);
            }
        });
        resizeObserver.observe(chartContainer);

        console.log('圖表初始化完成 (v5.0)');
    }

    // v5.0 新方法：初始化 FVG 系列
    initializeFVG() {
        console.log('初始化 FVG 系列...');
        
        // 檢查是否有 FVGRenderer 類別
        const hasFVGRenderer = typeof FVGRenderer !== 'undefined';
        console.log('FVGRenderer 可用:', hasFVGRenderer);

        if (hasFVGRenderer) {
            try {
                this.fvgRenderer = new FVGRenderer();
                
                // 檢查渲染器是否支持自定義系列
                const supportsCustomSeries = this.fvgRenderer.supportsCustomSeries();
                console.log('支持自定義系列:', supportsCustomSeries);
                
                if (supportsCustomSeries && typeof this.chart.addCustomSeries === 'function') {
                    // 嘗試使用自定義系列
                    this.fvgSeries = this.chart.addCustomSeries(this.fvgRenderer, {
                        title: 'Fair Value Gap',
                        visible: true
                    });
                    this.usePrimitives = true;
                    console.log('FVG 自定義系列創建成功');
                } else {
                    console.log('自定義系列不可用，回退到 LineSeries');
                    this.usePrimitives = false;
                    this.fvgRectangles = [];
                }
            } catch (error) {
                console.warn('FVG 系列創建失敗，回退到 LineSeries:', error);
                this.usePrimitives = false;
                this.fvgRectangles = [];
            }
        } else {
            // 沒有 FVGRenderer，直接使用 LineSeries
            console.log('FVGRenderer 不可用，使用 LineSeries 模式');
            this.usePrimitives = false;
            this.fvgRectangles = [];
        }
        
        console.log('最終使用模式:', this.usePrimitives ? 'Primitives' : 'LineSeries');
    }

    // v5.0 優化版 drawFVGs
    drawFVGs() {
        if (!this.showFVG) {
            this.clearFVGs();
            return;
        }

        const fvgs = this.currentData?.fvgs || [];
        if (fvgs.length === 0) {
            console.log('沒有 FVG 數據');
            return;
        }

        console.log(`繪製 ${fvgs.length} 個 FVG (v5.0 ${this.usePrimitives ? 'Primitives' : 'LineSeries'})`);

        if (this.usePrimitives) {
            // 使用 Primitives API
            this.drawFVGsWithPrimitives(fvgs);
        } else {
            // 回退到 LineSeries
            this.drawFVGsWithLineSeries(fvgs);
        }
    }

    // Primitives 版本的 FVG 繪製
    drawFVGsWithPrimitives(fvgs) {
        if (!this.fvgRenderer) return;

        // 準備 FVG 數據
        const fvgData = fvgs.map(fvg => {
            const startTime = fvg.time;
            const endTime = startTime + (20 * 60); // 20分鐘持續時間
            
            return {
                startTime: startTime,
                endTime: endTime,
                top: Math.max(fvg.top, fvg.bot),
                bottom: Math.min(fvg.top, fvg.bot),
                type: fvg.type,
                showBorder: true
            };
        });

        // 設置數據到自定義系列
        this.fvgRenderer.setData(fvgData);
        
        console.log(`使用 Primitives 繪製 ${fvgData.length} 個 FVG`);
    }

    // LineSeries 回退版本的 FVG 繪製
    drawFVGsWithLineSeries(fvgs) {
        this.clearFVGs();

        fvgs.forEach(fvg => {
            const upper = Math.max(fvg.top, fvg.bot);
            const lower = Math.min(fvg.top, fvg.bot);
            
            // 使用簡化的線條數量（回退模式性能考慮）
            const height = upper - lower;
            const lineCount = Math.min(Math.max(Math.floor(height * 10), 5), 30);
            const priceStep = height / lineCount;
            const fixedOpacity = 0.25;

            for (let j = 0; j < lineCount; j++) {
                const price = lower + (priceStep * j);
                
                const startTime = fvg.time;
                const endTime = startTime + (20 * 60);
                
                const fillLine = this.chart.addLineSeries({
                    color: fvg.type === 'bull' 
                        ? `rgba(76, 175, 80, ${fixedOpacity})`
                        : `rgba(244, 67, 54, ${fixedOpacity})`,
                    lineWidth: 1,
                    priceLineVisible: false,
                    lastValueVisible: false,
                    crosshairMarkerVisible: false,
                });

                fillLine.setData([
                    { time: startTime, value: price },
                    { time: endTime, value: price }
                ]);

                this.fvgRectangles.push(fillLine);
            }
        });

        console.log(`使用 LineSeries 回退模式繪製 ${fvgs.length} 個 FVG`);
    }

    // 清除 FVG
    clearFVGs() {
        if (this.usePrimitives && this.fvgRenderer) {
            // Primitives 版本清除
            this.fvgRenderer.clearData();
        } else {
            // LineSeries 版本清除
            this.fvgRectangles.forEach(line => {
                this.chart.removeSeries(line);
            });
            this.fvgRectangles = [];
        }
    }

    // 切換 FVG 顯示
    toggleFVG() {
        this.showFVG = !this.showFVG;
        const btn = document.getElementById('fvg-toggle-btn');
        
        if (this.showFVG) {
            btn.textContent = 'FVG 開';
            btn.classList.add('active');
            this.drawFVGs();
        } else {
            btn.textContent = 'FVG 關';
            btn.classList.remove('active');
            this.clearFVGs();
        }

        console.log(`FVG 顯示: ${this.showFVG ? '開啟' : '關閉'} (v5.0)`);
    }

    // 性能監控方法
    getPerformanceStats() {
        const stats = {
            version: 'v5.0',
            usePrimitives: this.usePrimitives,
            fvgCount: this.currentData?.fvgs?.length || 0,
            seriesCount: this.usePrimitives ? 1 : this.fvgRectangles.length,
            memoryEstimate: this.usePrimitives ? 
                `~${Math.ceil(this.currentData?.fvgs?.length * 0.1)}KB` : 
                `~${Math.ceil(this.fvgRectangles.length * 2)}KB`
        };

        console.log('v5.0 性能統計:', stats);
        return stats;
    }

    // 綁定事件
    bindEvents() {
        console.log('🔗 綁定事件... (v5.0)');
        
        // 隨機資料按鈕
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                console.log('用戶點擊隨機日期');
                this.loadRandomData();
            });
        }
        
        // 重置縮放按鈕
        const resetBtn = document.getElementById('reset-zoom-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                console.log('🔍 用戶點擊重置縮放');
                this.resetZoom();
            });
        }
        
        // FVG 切換按鈕
        const fvgBtn = document.getElementById('fvg-toggle-btn');
        if (fvgBtn) {
            fvgBtn.addEventListener('click', () => {
                this.toggleFVG();
            });
        }

        // 性能測試按鈕
        const perfBtn = document.getElementById('performance-test-btn');
        if (perfBtn) {
            perfBtn.addEventListener('click', () => {
                this.runPerformanceTest();
            });
        }
        
        console.log('事件綁定完成 (v5.0)');
    }

    // 處理滑鼠移動
    handleCrosshairMove(param) {
        const hoverInfo = document.getElementById('hover-data');
        if (!hoverInfo) return;
        
        if (param.point === undefined || !param.time || param.point.x < 0 || param.point.y < 0) {
            hoverInfo.textContent = '將滑鼠移至圖表查看詳細資料';
            return;
        }
        
        const data = param.seriesData.get(this.candlestickSeries);
        
        if (data) {
            const time = new Date(param.time * 1000);
            hoverInfo.textContent = `時間: ${time.toLocaleString('zh-TW')} | 開: ${data.open} | 高: ${data.high} | 低: ${data.low} | 收: ${data.close}`;
        }
    }

    // 載入隨機資料
    async loadRandomData() {
        console.log('📡 開始載入隨機資料... (v5.0)');
        this.showLoading();
        
        try {
            const url = `/api/random-data?timeframe=${this.currentTimeframe}`;
            console.log('🌐 發送 API 請求到:', url);
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            console.log('收到資料:', data);
            
            this.updateChart(data);

        } catch (error) {
            console.error('載入失敗:', error);
            alert(`載入資料失敗: ${error.message}`);
        } finally {
            this.hideLoading();
        }
    }

    // 更新圖表
    updateChart(data) {
        console.log('更新圖表，資料筆數:', data.data.length, '(v5.0)');
        this.currentData = data;

        try {
            // 準備 K 線資料
            const candleData = data.data.map(item => ({
                time: item.time,
                open: item.open,
                high: item.high,
                low: item.low,
                close: item.close,
            }));

            // 設定新資料
            this.candlestickSeries.setData(candleData);
            
            // 繪製 FVG
            this.drawFVGs();

            // 重置縮放
            setTimeout(() => {
                this.resetZoom();
            }, 100);

            // 更新UI資訊
            this.updateUI(data);

        } catch (error) {
            console.error('更新圖表失敗:', error);
            alert(`更新圖表失敗: ${error.message}`);
        }
    }

    // 更新UI資訊
    updateUI(data) {
        // 更新K線數量
        const candleCount = document.getElementById('candle-count');
        if (candleCount) {
            candleCount.textContent = `K線數量: ${data.candle_count || data.data.length}`;
        }

        // 更新FVG數量
        const fvgCount = document.getElementById('fvg-count-display');
        if (fvgCount) {
            const count = data.fvgs ? data.fvgs.length : 0;
            fvgCount.textContent = `FVG數量: ${count}`;
        }

        // 更新日期資訊
        const currentDate = document.getElementById('current-date');
        if (currentDate && data.date) {
            currentDate.textContent = `日期: ${data.date}`;
        }
        
        console.log('UI 更新完成 (v5.0)');
    }

    // 顯示載入動畫
    showLoading() {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = 'flex';
        }
    }

    // 隱藏載入動畫
    hideLoading() {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = 'none';
        }
    }

    // 重置縮放
    resetZoom() {
        if (this.chart) {
            this.chart.timeScale().fitContent();
        }
    }

    // 性能測試
    runPerformanceTest() {
        if (!this.currentData) {
            alert('請先載入資料');
            return;
        }

        const startTime = performance.now();
        
        // 執行 FVG 重繪測試
        for (let i = 0; i < 5; i++) {
            this.clearFVGs();
            this.drawFVGs();
        }
        
        const endTime = performance.now();
        const duration = (endTime - startTime).toFixed(2);
        
        const stats = this.getPerformanceStats();
        const message = `性能測試完成 (v5.0)\\n` +
                       `5次重繪耗時: ${duration}ms\\n` +
                       `平均: ${(duration/5).toFixed(2)}ms\\n` +
                       `渲染模式: ${stats.usePrimitives ? 'Primitives' : 'LineSeries'}\\n` +
                       `系列數量: ${stats.seriesCount}\\n` +
                       `估計記憶體: ${stats.memoryEstimate}`;
        
        alert(message);
    }
}

// 檢測並使用合適的版本
if (typeof TradingChartApp === 'undefined') {
    window.TradingChartApp = TradingChartAppV5;
    console.log('使用 v5.0 版本');
} else {
    window.TradingChartAppV5 = TradingChartAppV5;
    console.log('v5.0 版本已註冊為 TradingChartAppV5');
}