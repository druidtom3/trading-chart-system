// 檔名：script.js

console.log('script.js 開始載入...');

// 檢查 Lightweight Charts 是否可用
if (typeof LightweightCharts === 'undefined') {
    console.error('LightweightCharts 未定義');
    alert('圖表庫載入失敗，請重新整理頁面');
} else {
    console.log('LightweightCharts 可用:', typeof LightweightCharts);
}

// 檢查 CandleAggregator 是否可用
if (typeof CandleAggregator === 'undefined') {
    console.error('CandleAggregator 未定義');
    alert('聚合器載入失敗，請重新整理頁面');
} else {
    console.log('CandleAggregator 可用:', typeof CandleAggregator);
}

class TradingChartApp {
    constructor() {
        console.log('TradingChartApp 建構中...');
        this.chart = null;
        this.candlestickSeries = null;
        this.currentData = null;
        this.currentTimeframe = 'M15'; // 預設 M15

        // FVG 相關屬性
        this.fvgRectangles = [];  // 儲存 FVG 矩形標記
        this.showFVG = true;  // FVG 顯示開關
        this.playbackFVGs = [];  // 播放時檢測到的FVG
        this.playbackCandles = [];  // 播放時的K線數據（用於FVG檢測）
        
        // 水平線相關屬性
        this.horizontalLines = [];  // 儲存水平線
        this.isDrawingLine = false;  // 是否正在畫線
        this.manualLines = [];  // 手動畫的線（跨時間刻度共享）

        

        // 播放相關屬性
        this.candleAggregator = new CandleAggregator();
        this.m1PlaybackData = null;  // M1 原始資料
        this.currentPlaybackTime = null;  // 當前播放時間
        this.playbackIndex = 0;
        this.isPlaying = false;
        this.playbackTimer = null;
        this.countdownTimer = null;
        this.countdownValue = 0;

        // 資料快取（key: "date-timeframe"）
        this.dataCache = new Map();

        try {
            this.initializeChart();
            this.bindEvents();

            // 延遲載入資料
            setTimeout(() => {
                console.log('延遲載入觸發');
                this.loadRandomData();
            }, 1000);

        } catch (error) {
            console.error('初始化失敗:', error);
            alert(`初始化失敗: ${error.message}`);
        }
    }

    initializeChart() {
        console.log('開始初始化圖表...');

        const chartContainer = document.getElementById('chart');
        if (!chartContainer) {
            throw new Error('找不到圖表容器 #chart');
        }

        console.log('容器尺寸:', chartContainer.clientWidth, 'x', chartContainer.clientHeight);

        try {
            this.chart = LightweightCharts.createChart(chartContainer, {
                width: chartContainer.clientWidth,
                height: chartContainer.clientHeight,
                layout: {
                    background: { type: 'solid', color: '#ffffff' },  // 白色背景
                    textColor: '#333333',  // 深灰色文字
                },
                grid: {
                    vertLines: { color: '#f0f0f0' },  // 淺灰色網格線
                    horzLines: { color: '#f0f0f0' },  // 淺灰色網格線
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
                    timeVisible: true,
                    secondsVisible: false,
                    rightOffset: 5,
                    barSpacing: 6,
                    minBarSpacing: 0.5,
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

            console.log('基礎圖表建立成功');

            // 建立 K 線圖系列
            this.candlestickSeries = this.chart.addCandlestickSeries({
                upColor: '#ffffff',        // 上漲實體：白色
                downColor: '#000000',      // 下跌實體：黑色
                borderDownColor: '#000000', // 下跌邊框：黑色
                borderUpColor: '#000000',  // 上漲邊框：黑色
                wickDownColor: '#000000',  // 下跌影線：黑色
                wickUpColor: '#000000',    // 上漲影線：黑色
                priceScaleId: 'right',
            });

            console.log('K線系列建立成功');

            // 響應式處理
            window.addEventListener('resize', () => this.handleResize());

            // 滑鼠移動事件
            this.chart.subscribeCrosshairMove(this.handleCrosshairMove.bind(this));

            // 圖表點擊事件（畫線用）
            this.chart.subscribeClick((param) => {
                if (this.isDrawingLine && param.point) {
                    this.addHorizontalLine(param);
                }
            });

            console.log('圖表初始化完成');

        } catch (error) {
            console.error('圖表初始化失敗:', error);
            throw error;
        }
    }

    bindEvents() {
        console.log('🔗 綁定事件...');

        // 隨機資料按鈕
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                console.log('用戶點擊隨機日期');
                this.stopPlayback(); // 停止播放
                this.dataCache.clear(); // 清除快取
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


        // 指標選單按鈕
        const indicatorsMenuBtn = document.getElementById('indicators-menu-btn');
        if (indicatorsMenuBtn) {
            indicatorsMenuBtn.addEventListener('click', () => {
                this.openIndicatorsSidebar();
            });
        }

        // 關閉側邊欄按鈕
        const closeSidebarBtn = document.getElementById('close-sidebar-btn');
        if (closeSidebarBtn) {
            closeSidebarBtn.addEventListener('click', () => {
                this.closeIndicatorsSidebar();
            });
        }

        // 背景遮罩點擊關閉
        const sidebarOverlay = document.getElementById('sidebar-overlay');
        if (sidebarOverlay) {
            sidebarOverlay.addEventListener('click', () => {
                this.closeIndicatorsSidebar();
            });
        }

        // 綁定所有指標勾選框事件
        this.bindIndicatorCheckboxes();

        // FVG 開關按鈕 (暫時保留，將來會被側邊欄取代)
        const fvgToggleBtn = document.getElementById('fvg-toggle-btn');
        if (fvgToggleBtn) {
            fvgToggleBtn.addEventListener('click', () => {
                this.toggleFVG();
            });
        }

        // 畫線按鈕
        const drawLineBtn = document.getElementById('draw-line-btn');
        if (drawLineBtn) {
            drawLineBtn.addEventListener('click', () => {
                this.toggleDrawLineMode();
            });
        }

        // 清除線按鈕
        const clearLinesBtn = document.getElementById('clear-lines-btn');
        if (clearLinesBtn) {
            clearLinesBtn.addEventListener('click', () => {
                if (this.manualLines.length > 0) {
                    if (confirm(`確定要清除 ${this.manualLines.length} 條手動線嗎？`)) {
                        this.clearManualLines();
                    }
                } else {
                    alert('沒有手動線可以清除');
                }
            });
        }

        // 時間刻度分頁
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const timeframe = e.target.dataset.timeframe;
                console.log('📑 切換分頁:', timeframe);
                this.switchTimeframe(timeframe);
            });
        });

        // 播放按鈕
        const playBtn = document.getElementById('play-btn');
        if (playBtn) {
            playBtn.addEventListener('click', () => {
                console.log('用戶點擊開始播放');
                this.startPlayback();
            });
        }

        // 暫停/繼續按鈕
        const pauseBtn = document.getElementById('pause-btn');
        if (pauseBtn) {
            pauseBtn.addEventListener('click', () => {
                if (this.isPlaying) {
                    console.log('用戶點擊暫停');
                    this.pausePlayback();
                } else {
                    console.log('用戶點擊繼續');
                    this.resumePlayback();
                }
            });
        }

        // 播放速度選擇
        const speedSelect = document.getElementById('speed-select');
        if (speedSelect) {
            speedSelect.addEventListener('change', (e) => {
                console.log('播放速度變更:', e.target.value);

                // 重設倒數值為新的速度值
                this.countdownValue = parseInt(e.target.value);
                this.updateCountdown();

                if (this.isPlaying) {
                    // 重新啟動計時器以應用新速度
                    this.stopTimers();
                    this.startTimers();
                }
            });
        }

        console.log('事件綁定完成');
    }

    // FVG 相關方法
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
        
        console.log(`FVG 顯示: ${this.showFVG ? '開啟' : '關閉'}`);
    }

    clearFVGs() {
        // 移除所有 FVG 系列
        this.fvgRectangles.forEach(item => {
            try {
                if (item.series) {
                    // 如果是系列對象
                    this.chart.removeSeries(item.series);
                } else {
                    // 如果是價格線（向後兼容）
                    this.candlestickSeries.removePriceLine(item);
                }
            } catch (error) {
                console.warn('⚠️ 清除 FVG 時發生錯誤:', error);
            }
        });
        this.fvgRectangles = [];
    }

    // 在 drawFVGs 方法中
    drawFVGs() {
        this.clearFVGs();
        
        if (!this.showFVG) {
            console.log('FVG顯示已關閉');
            return;
        }
        
        console.log('開始繪製FVG, 播放中:', this.isPlaying);
        
        // 如果正在播放，需要同時顯示歷史FVG和播放FVG
        if (this.isPlaying) {
            // 先繪製歷史FVG（開盤前的）
            if (this.currentData && this.currentData.fvgs) {
                const playbackStartTime = this.m1PlaybackData && this.m1PlaybackData.data.length > 0
                    ? this.m1PlaybackData.data[0].time
                    : null;
                
                // 只顯示播放開始前的歷史FVG
                const historicalFVGs = this.currentData.fvgs.filter(fvg => 
                    !playbackStartTime || fvg.time < playbackStartTime
                );
                
                historicalFVGs.forEach((fvg, index) => {
                    this.drawSingleFVG(fvg, index);
                });
                
                console.log(`繪製 ${historicalFVGs.length} 個歷史FVG`);
            }
            
            // 再繪製播放時的動態FVG
            this.playbackFVGs.forEach((fvg, index) => {
                this.drawSingleFVG(fvg, index + 1000); // 加1000避免index衝突
            });
            
            console.log(`繪製 ${this.playbackFVGs.length} 個播放FVG`);
            return;
        }
        
        // 否則使用預載入的FVG
        if (!this.currentData || !this.currentData.fvgs) {
            return;
        }
        
        const fvgs = this.currentData.fvgs;
        console.log(`繪製 ${fvgs.length} 個 FVG`);
        console.log('FVG 資料範例:', fvgs.slice(0, 2)); // 顯示前兩個 FVG
        
        fvgs.forEach((fvg, index) => {
            console.log(`處理 FVG ${index + 1}:`, fvg);
            
            // 確保 top > bot
            const upper = Math.max(fvg.top, fvg.bot);
            const lower = Math.min(fvg.top, fvg.bot);
            
            // 計算 FVG 的時間範圍
            // 如果有 left_time，使用它作為起始時間，否則使用原時間
            const startTime = fvg.left_time || fvg.time; // FVG 開始時間
            
            // 計算結束時間：FVG顯示40根K線長度，但最多到開盤時間
            const fvgDisplayLength = 40;
            const timeStepSeconds = this.getTimeStepByTimeframe(this.currentTimeframe);
            const maxExtendTime = startTime + (fvgDisplayLength * timeStepSeconds);
            
            // 取得開盤時間 (數據的最後時間點)
            const dataEndTime = this.currentData.data.length > 0 
                ? this.currentData.data[this.currentData.data.length - 1].time
                : startTime + timeStepSeconds;
            
            // FVG顯示到開盤時間，但不超過40根K線的長度
            const lastDataTime = Math.min(maxExtendTime, dataEndTime);
            
            // 使用固定的時間步長，與當前時間框架對齊
            const timeStep = this.getTimeStepByTimeframe(this.currentTimeframe);
            
            // 創建時間範圍內的數據點，只使用起始和結束時間
            const areaData = [
                {
                    time: startTime,
                    value: upper
                },
                {
                    time: lastDataTime,
                    value: upper
                }
            ];
            
            console.log(`FVG ${index + 1} 時間範圍: ${new Date(startTime * 1000).toLocaleString()} ~ ${new Date(lastDataTime * 1000).toLocaleString()}`);
            console.log(`生成 ${areaData.length} 個數據點，時間步長: ${timeStep}秒`);
            
            // 使用多條 Line 系列模擬矩形填充（在正確的時間範圍內）
            const height = upper - lower;
            
            // 像素感知計算，確保一致的視覺密度
            const pxH = this.getFvgPixelHeight(upper, lower);
            
            // 較淺色覆蓋率：1px 線 + 2px gap => 大約 33% 覆蓋
            const lineWidthPx = 1;
            const gapPx = 2;
            const maxLines = 60;             // 降低上限，避免過密
            const fallbackLines = 12;        // 降低退路線條數
            
            const lineCountPx = pxH ? Math.floor(pxH / (lineWidthPx + gapPx)) : fallbackLines;
            const lineCount = Math.max(1, Math.min(lineCountPx, maxLines));
            
            // 調試信息（第一個FVG）
            if (index === 0) {
                console.log(`FVG渲染: height=${height.toFixed(2)}, pixels=${pxH || 'null'}, lines=${lineCount}`);
            }
            const priceStep = height / lineCount;
            
            // 使用固定透明度，確保所有FVG顏色一致
            const fixedOpacity = 0.25;
            
            // 創建填充線條
            for (let i = 0; i <= lineCount; i++) {
                const price = lower + (priceStep * i);
                
                const fillLineData = areaData.map(point => ({
                    time: point.time,
                    value: price
                }));
                
                const fillLine = this.chart.addLineSeries({
                    color: fvg.type === 'bull' 
                        ? `rgba(76, 175, 80, ${fixedOpacity})`
                        : `rgba(244, 67, 54, ${fixedOpacity})`,
                    lineWidth: 1, // 固定線寬避免影響圖表
                    lineStyle: LightweightCharts.LineStyle.Solid,
                    priceScaleId: 'right',
                    lastValueVisible: false,
                    priceLineVisible: false,
                });
                
                fillLine.setData(fillLineData);
                
                // 保存填充線系列
                this.fvgRectangles.push({ series: fillLine, type: 'fill' });
            }
            
            console.log(`FVG ${index + 1} 填充: ${lineCount + 1} 條線，透明度: ${fixedOpacity}`);
            
            // 移除邊框線條 - 只保留透明長方形填充
            
            console.log(`FVG ${index + 1} 已創建: ${areaData.length} 個數據點`);
        });
    }

    // 根據時間框架獲取合適的時間步長（秒）
    getTimeStepByTimeframe(timeframe) {
        const timeSteps = {
            'M1': 60,        // 1分鐘
            'M5': 300,       // 5分鐘  
            'M15': 900,      // 15分鐘
            'H1': 3600,      // 1小時
            'H4': 14400,     // 4小時
            'D1': 86400      // 1天
        };
        
        // 返回對應的時間步長，如果沒找到就用 1 分鐘
        return timeSteps[timeframe] || 60;
    }

    switchTimeframe(timeframe) {
        if (timeframe === this.currentTimeframe) {
            console.log('📑 已在當前分頁');
            return;
        }

        // 更新分頁狀態
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.timeframe === timeframe);
        });

        this.currentTimeframe = timeframe;
        
        // 如果是M1，重置播放K線數據
        if (timeframe === 'M1' && this.isPlaying) {
            this.playbackCandles = [];
            // 從聚合器獲取已播放的M1數據
            const allCandles = this.candleAggregator.getAllCandles('M1');
            this.playbackCandles = allCandles.map(c => ({
                time: c.time,
                open: c.open,
                high: c.high,
                low: c.low,
                close: c.close
            }));
        }

        // 如果正在播放，重新繪製當前時間刻度的圖表
        if (this.isPlaying && this.candleAggregator) {
            this.redrawTimeframe(timeframe);
            // 更新播放中的FVG
            this.updatePlaybackFVGs();
        } else {
            // 沒有播放時，載入該時間刻度的資料
            if (this.currentData) {
                this.loadSpecificData(this.currentData.date, timeframe);
            }
        }

        // 重新繪製手動線
        setTimeout(() => {
            this.redrawManualLines();
        }, 100);
    }

    handleResize() {
        const chartContainer = document.getElementById('chart');
        if (this.chart && chartContainer) {
            this.chart.applyOptions({
                width: chartContainer.clientWidth,
                height: chartContainer.clientHeight,
            });
        }
    }

    handleCrosshairMove(param) {
        const hoverInfo = document.getElementById('hover-data');
        if (!hoverInfo) return;
        
        if (param.point === undefined || !param.time || param.point.x < 0 || param.point.y < 0) {
            hoverInfo.textContent = '將滑鼠移至圖表查看詳細資料';
            return;
        }
        
        const data = param.seriesData.get(this.candlestickSeries);
        
        if (data) {
            const date = new Date(param.time * 1000);
            const timeStr = this.formatDateTime(date);
            
            hoverInfo.textContent = 
                `時間: ${timeStr} | O: ${data.open.toFixed(2)} | H: ${data.high.toFixed(2)} | ` +
                `L: ${data.low.toFixed(2)} | C: ${data.close.toFixed(2)}`;
        }
    }

    showLoading() {
        console.log('🔄 顯示載入動畫');
        const loading = document.getElementById('loading');
        const refreshBtn = document.getElementById('refresh-btn');
        const tabButtons = document.querySelectorAll('.tab-btn');

        if (loading) loading.classList.remove('hidden');
        if (refreshBtn) refreshBtn.disabled = true;
        tabButtons.forEach(btn => btn.disabled = true);
    }

    hideLoading() {
        console.log('隱藏載入動畫');
        const loading = document.getElementById('loading');
        const refreshBtn = document.getElementById('refresh-btn');
        const tabButtons = document.querySelectorAll('.tab-btn');

        if (loading) loading.classList.add('hidden');
        if (refreshBtn) refreshBtn.disabled = false;
        tabButtons.forEach(btn => btn.disabled = false);
    }

    resetZoom() {
        console.log('🔍 重置圖表縮放');
        if (this.chart) {
            const candleData = this.candlestickSeries.data();
            if (candleData && candleData.length > 0) {
                // 使用設定的預設顯示K線數量，而非寫死100
                const defaultCount = 400;  // 統一使用 400 根
                const visibleBars = Math.min(defaultCount, candleData.length);
                const lastIndex = candleData.length - 1;
                const firstIndex = Math.max(0, lastIndex - visibleBars + 1);

                this.chart.timeScale().setVisibleRange({
                    from: candleData[firstIndex].time,
                    to: candleData[lastIndex].time
                });
            }

            // 重置價格軸
            this.chart.priceScale('right').applyOptions({
                autoScale: true
            });

            console.log('縮放已重置');
        }
    }

    async loadRandomData() {
        console.log('📡 開始載入隨機資料...');
        console.log('使用當前時間刻度:', this.currentTimeframe);
        this.showLoading();

        try {
            const url = `/api/random-data?timeframe=${this.currentTimeframe}`;
            console.log('🌐 發送 API 請求到:', url);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            console.log('📨 收到回應:', response.status, response.statusText);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            console.log('收到資料:', data);
            console.log('K線數量:', data.candle_count);
            console.log('FVG數量:', data.fvgs ? data.fvgs.length : 0);

            // 快取資料
            const cacheKey = `${data.date}-${data.timeframe}`;
            this.dataCache.set(cacheKey, data);

            this.updateChart(data);

        } catch (error) {
            console.error('載入失敗:', error);
            alert(`載入資料失敗: ${error.message}`);
        } finally {
            this.hideLoading();
        }
    }

    async loadSpecificData(date, timeframe) {
        console.log(`📡 載入特定資料: ${date} (${timeframe})`);

        // 檢查快取
        const cacheKey = `${date}-${timeframe}`;
        if (this.dataCache.has(cacheKey)) {
            console.log('💾 使用快取資料');
            this.updateChart(this.dataCache.get(cacheKey));
            return;
        }

        this.showLoading();

        try {
            const url = `/api/data/${date}/${timeframe}`;
            console.log('🌐 發送 API 請求到:', url);

            const response = await fetch(url);
            console.log('📨 收到回應:', response.status, response.statusText);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            console.log('收到資料:', data);
            console.log('K線數量:', data.candle_count);
            console.log('FVG數量:', data.fvgs ? data.fvgs.length : 0);

            // 快取資料
            this.dataCache.set(cacheKey, data);

            this.updateChart(data);

        } catch (error) {
            console.error('載入特定資料失敗:', error);
            alert(`載入資料失敗: ${error.message}`);
        } finally {
            this.hideLoading();
        }
    }

    updateChart(data) {
        console.log('更新圖表，資料筆數:', data.data.length);
        this.currentData = data;
        
        // 設定時區資訊給聚合器
        if (data.timezone_info && this.candleAggregator) {
            this.candleAggregator.setTimezoneInfo(data.timezone_info);
            console.log('🌐 時區資訊已更新:', data.timezone_info);
        }

        try {
            // 準備 K 線資料
            const candleData = data.data.map(item => ({
                time: item.time,
                open: item.open,
                high: item.high,
                low: item.low,
                close: item.close,
            }));

            console.log('K線資料範例:', candleData.slice(0, 1));

            // 先清除舊資料
            this.candlestickSeries.setData([]);

            // 設定新資料
            this.candlestickSeries.setData(candleData);
            
            // 更新時間範圍顯示
            this.updateTimeRange(candleData);

            // 繪製 FVG (無論開關狀態，讓 drawFVGs 內部處理)
            this.drawFVGs();

            // 等待一下讓圖表處理新資料，然後重置縮放
            setTimeout(() => {
                this.resetZoom();
            }, 100);

            // 更新UI資訊
            this.updateUI(data);

            // 更新分頁狀態
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.timeframe === data.timeframe);
            });

            this.currentTimeframe = data.timeframe;

            console.log('圖表更新完成');

        } catch (error) {
            console.error('圖表更新失敗:', error);
            throw error;
        }
    }

    updateUI(data) {
        console.log('更新 UI 資訊');

        const currentDate = document.getElementById('current-date');
        const marketInfo = document.getElementById('market-info');
        const candleCount = document.getElementById('candle-count');
        const timeRange = document.getElementById('time-range');
        const dstStatus = document.getElementById('dst-status');
        const holidayInfo = document.getElementById('holiday-info');

        if (currentDate) {
            currentDate.textContent = `日期: ${data.date}`;
        }

        if (marketInfo) {
            const nyTime = new Date(data.ny_open_taipei).toLocaleString('zh-TW');
            marketInfo.textContent = `紐約開盤 (台北時間): ${nyTime}`;
        }

        if (candleCount) {
            candleCount.textContent = `K線數量: ${data.candle_count}`;
        }

        // 更新時間範圍
        this.updateTimeRange(data.data);

        if (dstStatus) {
            dstStatus.textContent = `時區狀態: ${data.is_dst ? '夏令時間 (EDT)' : '冬令時間 (EST)'}`;
        }

        // 新增 FVG 數量顯示
        const fvgCount = document.getElementById('fvg-count');
        if (fvgCount) {
            const count = data.fvgs ? data.fvgs.length : 0;
            fvgCount.textContent = `FVG數量: ${count}`;
        }

        // 處理假日資訊顯示
        if (holidayInfo && data.holiday_info) {
            const { is_holiday, is_early_close, holiday_name, status } = data.holiday_info;
            
            if (is_holiday) {
                holidayInfo.textContent = holiday_name ? `美國假日 - ${holiday_name}` : '美國假日';
                holidayInfo.style.display = 'inline-block';
                holidayInfo.title = `交易狀態: ${status}`;
                console.log(`檢測到假日: ${status}`);
            } else if (is_early_close) {
                holidayInfo.textContent = '縮短交易時間';
                holidayInfo.style.display = 'inline-block';
                holidayInfo.style.background = 'linear-gradient(45deg, #f39c12, #d68910)';
                holidayInfo.title = `交易狀態: ${status}`;
                console.log(`檢測到縮短交易時間: ${status}`);
            } else {
                holidayInfo.style.display = 'none';
            }
        }

        console.log('UI 更新完成');
    }

    // 播放功能相關方法保持不變...
    async startPlayback() {
        if (!this.currentData) {
            alert('請先載入資料');
            return;
        }

        console.log('開始播放功能（第二階段）');
        
        // 重置播放FVG數據
        this.playbackFVGs = [];
        this.playbackCandles = [];

        // 載入 M1 完整資料作為播放基礎
        try {
            const url = `/api/m1-playback-data/${this.currentData.date}`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error('無法載入 M1 播放資料');
            }

            this.m1PlaybackData = await response.json();
            console.log('載入 M1 播放資料:', this.m1PlaybackData.candle_count, '根K線');

            // 重置聚合器
            this.candleAggregator.reset();

            // 確保所有時間刻度的歷史資料都在快取中
            await this.preloadAllTimeframes();

            // 重置為開盤前狀態
            this.updateChart(this.currentData);

            // 設定播放起始點
            this.playbackIndex = 0;
            this.isPlaying = true;

            // 設定初始播放時間
            if (this.m1PlaybackData.data.length > 0) {
                this.currentPlaybackTime = this.m1PlaybackData.data[0].time;
            }

            // 更新按鈕狀態
            this.updatePlaybackButtons();

            // 開始播放
            this.startTimers();

        } catch (error) {
            console.error('M1 播放資料載入失敗:', error);
            alert('無法載入播放資料');
        }
    }

    async preloadAllTimeframes() {
        console.log('預載所有時間刻度資料...');

        const timeframes = ['M1', 'M5', 'M15', 'H1', 'H4', 'D1'];
        const promises = [];

        for (const tf of timeframes) {
            const cacheKey = `${this.currentData.date}-${tf}`;

            // 強制重新載入所有時間框架（即使已有cache）
            console.log(`載入 ${tf} 資料...`);
            promises.push(this.loadSpecificDataSilently(this.currentData.date, tf));
        }

        if (promises.length > 0) {
            await Promise.all(promises);
            console.log('所有時間刻度資料載入完成');
            
            // 顯示載入統計
            for (const tf of timeframes) {
                const cacheKey = `${this.currentData.date}-${tf}`;
                const data = this.dataCache.get(cacheKey);
                if (data && data.data) {
                    console.log(`  ✓ ${tf}: ${data.data.length} 根K線`);
                }
            }
        }
    }

    async loadSpecificDataSilently(date, timeframe) {
        try {
            const url = `/api/data/${date}/${timeframe}`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`無法載入 ${timeframe} 資料`);
            }

            const data = await response.json();
            const cacheKey = `${date}-${timeframe}`;
            this.dataCache.set(cacheKey, data);

            console.log(`${timeframe} 資料已快取`);

        } catch (error) {
            console.error(`載入 ${timeframe} 資料失敗:`, error);
        }
    }

    pausePlayback() {
        console.log('暫停播放');
        this.isPlaying = false;
        this.stopTimers();
        this.updatePlaybackButtons();

        const pauseBtn = document.getElementById('pause-btn');
        if (pauseBtn) {
            pauseBtn.textContent = '繼續';
        }
    }

    resumePlayback() {
        console.log('繼續播放');
        this.isPlaying = true;
        this.startTimers();
        this.updatePlaybackButtons();

        const pauseBtn = document.getElementById('pause-btn');
        if (pauseBtn) {
            pauseBtn.textContent = '暫停';
        }
    }

    stopPlayback() {
        console.log('停止播放');
        this.isPlaying = false;
        this.playbackIndex = 0;
        this.m1PlaybackData = null;
        this.currentPlaybackTime = null;
        this.stopTimers();
        this.updatePlaybackButtons();

        // 重置聚合器
        this.candleAggregator.reset();
        
        // 重置播放FVG數據
        this.playbackFVGs = [];
        this.playbackCandles = [];
        
        // 清除FVG顯示
        this.clearFVGs();

        // 重置播放資訊
        document.getElementById('playback-time').textContent = '播放時間: --';
        document.getElementById('countdown').textContent = '下一根: --';

        // 確保按鈕文字正確
        const pauseBtn = document.getElementById('pause-btn');
        if (pauseBtn) {
            pauseBtn.textContent = '暫停';
        }
    }

    startTimers() {
        const speedSelect = document.getElementById('speed-select');
        const speed = parseInt(speedSelect.value) * 1000; // 轉換為毫秒

        // 倒數計時
        this.countdownValue = parseInt(speedSelect.value);
        this.updateCountdown();

        this.countdownTimer = setInterval(() => {
            this.countdownValue--;
            this.updateCountdown();

            if (this.countdownValue <= 0) {
                this.countdownValue = parseInt(speedSelect.value);
            }
        }, 1000);

        // 播放計時器
        this.playbackTimer = setInterval(() => {
            this.playNextCandle();
        }, speed);

        // 立即播放第一根
        this.playNextCandle();
    }

    stopTimers() {
        if (this.playbackTimer) {
            clearInterval(this.playbackTimer);
            this.playbackTimer = null;
        }

        if (this.countdownTimer) {
            clearInterval(this.countdownTimer);
            this.countdownTimer = null;
        }
    }

    // FVG檢測邏輯（前端版本）
    detectFVGsFromCandles(candles) {
        const fvgs = [];
        
        // 需要至少2根K線才能檢測跳空FVG
        if (candles.length < 2) return fvgs;
        
        // 檢測跳空FVG（特別重要於開盤時）
        for (let i = 1; i < candles.length; i++) {
            const L = candles[i - 1];  // 左邊K線
            const C = candles[i];      // 當前K線
            
            // 向上跳空FVG：當前開盤 > 前一根最高，且當前是上漲K線 (暫時恢復原邏輯)
            if (C.open > L.high && C.close > C.open) {
                fvgs.push({
                    type: 'bull',
                    top: C.open,
                    bot: L.high,
                    time: C.time,
                    startIndex: i,
                    filled: false,
                    isGap: true  // 標記為跳空FVG
                });
                console.log(`檢測到向上跳空FVG: ${new Date(C.time * 1000).toLocaleString()}`);
            }
            
            // 向下跳空FVG：當前開盤 < 前一根最低，且當前是下跌K線 (暫時恢復原邏輯)
            if (C.open < L.low && C.close < C.open) {
                fvgs.push({
                    type: 'bear',
                    top: L.low,
                    bot: C.open,
                    time: C.time,
                    startIndex: i,
                    filled: false,
                    isGap: true  // 標記為跳空FVG
                });
                console.log(`檢測到向下跳空FVG: ${new Date(C.time * 1000).toLocaleString()}`);
            }
        }
        
        // 需要至少3根K線才能檢測三根結構FVG
        if (candles.length >= 3) {
            for (let i = 1; i < candles.length - 1; i++) {
                const L = candles[i - 1];  // 左邊K線
                const C = candles[i];      // 中間K線
                const R = candles[i + 1];  // 右邊K線
                
                // 三根結構FVG檢測 (暫時恢復原邏輯)
                if (L.high < R.low) {
                    // 看多FVG：左高 < 右低
                    fvgs.push({
                        type: 'bull',
                        top: Math.max(R.low, L.high),
                        bot: Math.min(R.low, L.high),
                        time: R.time,
                        startIndex: i + 1,
                        filled: false,
                        isGap: false
                    });
                } else if (L.low > R.high) {
                    // 看空FVG：左低 > 右高
                    fvgs.push({
                        type: 'bear',
                        top: Math.max(L.low, R.high),
                        bot: Math.min(L.low, R.high),
                        time: R.time,
                        startIndex: i + 1,
                        filled: false,
                        isGap: false
                    });
                }
            }
        }
        
        return fvgs;
    }
    
    // 檢查FVG是否被回補
    checkFVGFilled(fvg, candles, startIdx) {
        const fvgTop = fvg.top;
        const fvgBot = fvg.bot;
        
        // 從FVG產生後的K線開始檢查
        for (let i = startIdx; i < candles.length; i++) {
            const candle = candles[i];
            const bodyHigh = Math.max(candle.open, candle.close);
            const bodyLow = Math.min(candle.open, candle.close);
            
            // 單根K線body完全覆蓋FVG則回補
            if (bodyLow <= fvgBot && bodyHigh >= fvgTop) {
                return true;
            }
        }
        
        return false;
    }
    
    // 更新播放時的FVG
    updatePlaybackFVGs() {
        // 根據當前時間框架獲取K線數據
        let candles = [];
        
        if (this.currentTimeframe === 'M1') {
            candles = this.playbackCandles;
        } else {
            candles = this.candleAggregator.getAllCandles(this.currentTimeframe);
        }
        
        // 如果有歷史資料，加入開盤前最後一根K線來檢測開盤跳空
        if (this.currentData && this.currentData.data && this.currentData.data.length > 0 && candles.length > 0) {
            const playbackStartTime = this.m1PlaybackData && this.m1PlaybackData.data.length > 0
                ? this.m1PlaybackData.data[0].time
                : candles[0].time;
            
            // 找到開盤前最後一根K線
            let lastPreMarketCandle = null;
            for (let i = this.currentData.data.length - 1; i >= 0; i--) {
                if (this.currentData.data[i].time < playbackStartTime) {
                    lastPreMarketCandle = this.currentData.data[i];
                    break;
                }
            }
            
            // 如果找到開盤前K線，將它加到candles開頭來檢測開盤跳空
            if (lastPreMarketCandle) {
                const fullCandles = [lastPreMarketCandle, ...candles];
                
                // 檢測所有FVG（包括開盤跳空）
                const allFVGs = this.detectFVGsFromCandles(fullCandles);
                
                // 調整索引（因為加了一根開盤前K線）
                allFVGs.forEach(fvg => {
                    if (fvg.startIndex > 0) {
                        fvg.startIndex -= 1;
                    }
                });
                
                // 檢查每個FVG是否被回補
                this.playbackFVGs = allFVGs.filter(fvg => {
                    const filled = this.checkFVGFilled(fvg, candles, Math.max(0, fvg.startIndex));
                    fvg.filled = filled;
                    return !filled;  // 只保留未回補的FVG
                });
            } else {
                // 沒有開盤前K線，正常檢測
                const allFVGs = this.detectFVGsFromCandles(candles);
                
                this.playbackFVGs = allFVGs.filter(fvg => {
                    const filled = this.checkFVGFilled(fvg, candles, fvg.startIndex);
                    fvg.filled = filled;
                    return !filled;
                });
            }
        } else {
            // 正常檢測FVG
            const allFVGs = this.detectFVGsFromCandles(candles);
            
            this.playbackFVGs = allFVGs.filter(fvg => {
                const filled = this.checkFVGFilled(fvg, candles, fvg.startIndex);
                fvg.filled = filled;
                return !filled;
            });
        }
        
        console.log(`播放FVG檢測: ${this.playbackFVGs.length} 個未回補FVG`);
        this.playbackFVGs.forEach(fvg => {
            if (fvg.isGap) {
                console.log(`  ${fvg.type === 'bull' ? '🔺' : '🔻'} 跳空FVG @ ${new Date(fvg.time * 1000).toLocaleString()}`);
            }
        });
        
        // 如果FVG顯示開啟，重新繪製所有FVG（包括歷史的）
        if (this.showFVG) {
            this.drawFVGs();  // 使用drawFVGs而不是drawPlaybackFVGs，這樣會包含歷史FVG
        }
    }
    
    // 繪製播放時的FVG
    drawPlaybackFVGs() {
        // 清除現有FVG顯示
        this.clearFVGs();
        
        // 繪製所有未回補的FVG
        this.playbackFVGs.forEach((fvg, index) => {
            this.drawSingleFVG(fvg, index);
        });
    }
    
    // 繪製單個FVG
    drawSingleFVG(fvg, index) {
        const upper = Math.max(fvg.top, fvg.bot);
        const lower = Math.min(fvg.top, fvg.bot);
        
        // 計算FVG的時間範圍（顯示40根K線長度，最多到開盤時間）
        // 如果有 left_time，使用它作為起始時間，否則使用原時間
        const startTime = fvg.left_time || fvg.time;
        const fvgDisplayLength = 40;  // FVG顯示長度（40根K線）
        const timeStepSeconds = this.getTimeStepByTimeframe(this.currentTimeframe);
        const maxExtendTime = startTime + (fvgDisplayLength * timeStepSeconds);
        
        // 取得當前最後一根K線的時間
        const candles = this.currentTimeframe === 'M1' 
            ? this.playbackCandles 
            : this.candleAggregator.getAllCandles(this.currentTimeframe);
        const dataEndTime = candles.length > 0 
            ? candles[candles.length - 1].time
            : startTime + timeStepSeconds;
        
        const endTime = Math.min(maxExtendTime, dataEndTime);
        
        // 創建數據點
        const areaData = [
            { time: startTime, value: upper },
            { time: endTime, value: upper }
        ];
        
        // 使用固定透明度
        const fixedOpacity = 0.25;
        
        // 計算填充線條
        const height = upper - lower;
        
        // 像素感知計算，確保一致的視覺密度
        const pxH = this.getFvgPixelHeight(upper, lower);
        
        // 較淺色覆蓋率：1px 線 + 2px gap => 大約 33% 覆蓋
        const lineWidthPx = 1;
        const gapPx = 2;
        const maxLines = 60;             // 降低上限，避免過密
        const fallbackLines = 12;        // 降低退路線條數
        
        const lineCountPx = pxH ? Math.floor(pxH / (lineWidthPx + gapPx)) : fallbackLines;
        const lineCount = Math.max(1, Math.min(lineCountPx, maxLines));
        const priceStep = height / lineCount;
        
        // 創建填充線條
        for (let i = 0; i <= lineCount; i++) {
            const price = lower + (priceStep * i);
            
            const fillLineData = areaData.map(point => ({
                time: point.time,
                value: price
            }));
            
            const fillLine = this.chart.addLineSeries({
                color: fvg.type === 'bull' 
                    ? `rgba(76, 175, 80, ${fixedOpacity})`
                    : `rgba(244, 67, 54, ${fixedOpacity})`,
                lineWidth: 1,
                lineStyle: LightweightCharts.LineStyle.Solid,
                priceScaleId: 'right',
                lastValueVisible: false,
                priceLineVisible: false,
            });
            
            fillLine.setData(fillLineData);
            this.fvgRectangles.push({ series: fillLine, type: 'fill' });
        }
    }
    
    playNextCandle() {
        if (!this.m1PlaybackData || this.playbackIndex >= this.m1PlaybackData.data.length) {
            console.log('播放結束或無資料');
            return;
        }

        // 取得當前的 M1 K線
        const m1Candle = this.m1PlaybackData.data[this.playbackIndex];

        // 透過聚合器處理
        const updates = this.candleAggregator.addM1Candle({
            time: m1Candle.time,
            open: m1Candle.open,
            high: m1Candle.high,
            low: m1Candle.low,
            close: m1Candle.close,
            volume: m1Candle.volume
        });
        
        // 更新M1播放K線數據（用於FVG檢測）
        if (this.currentTimeframe === 'M1') {
            this.playbackCandles.push({
                time: m1Candle.time,
                open: m1Candle.open,
                high: m1Candle.high,
                low: m1Candle.low,
                close: m1Candle.close
            });
        }

        // 更新當前播放時間
        this.currentPlaybackTime = m1Candle.time;

        // 根據當前分頁更新圖表
        if (this.currentTimeframe === 'M1') {
            // M1 分頁：直接顯示新K線
            this.candlestickSeries.update(updates.M1.candle);
        } else {
            // 其他分頁：更新對應的K線
            const update = updates[this.currentTimeframe];
            if (update) {
                this.updateChartForTimeframe(this.currentTimeframe, update);
            }
        }
        
        // 更新FVG檢測（每次新K線都檢測）
        this.updatePlaybackFVGs();

        // 更新播放時間顯示
        const playbackTime = new Date(m1Candle.time * 1000);
        document.getElementById('playback-time').textContent =
            `播放時間: ${this.formatDateTime(playbackTime)}`;

        // 移動到下一根
        this.playbackIndex++;

        console.log(`播放進度: ${this.playbackIndex}/${this.m1PlaybackData.data.length}`);
    }

    updateChartForTimeframe(timeframe, update) {
        if (!update) return;

        // 所有時間刻度都使用相同的更新邏輯
        if (update.type === 'new') {
            // 新 K 線
            this.candlestickSeries.update(update.candle);
        } else if (update.type === 'update') {
            // 更新現有 K 線
            this.candlestickSeries.update(update.candle);
        }
    }

    async redrawTimeframe(timeframe) {
        console.log(`重新繪製 ${timeframe} 圖表`);

        // 所有時間刻度都使用相同的邏輯：結合歷史資料和播放資料
        await this.combineHistoricalAndPlaybackData(timeframe);

        // 調整視圖
        setTimeout(() => {
            this.resetZoom();
        }, 100);
    }

    async combineHistoricalAndPlaybackData(timeframe) {
        console.log(`結合歷史資料和播放資料: ${timeframe}`);

        // 取得快取的歷史資料
        const cacheKey = `${this.currentData.date}-${timeframe}`;
        let historicalData = this.dataCache.get(cacheKey);

        if (!historicalData) {
            console.log('⏳ 無快取資料，載入歷史資料...');
            // 如果沒有快取，先載入歷史資料
            try {
                const url = `/api/data/${this.currentData.date}/${timeframe}`;
                const response = await fetch(url);
                if (response.ok) {
                    historicalData = await response.json();
                    this.dataCache.set(cacheKey, historicalData);
                    console.log(`已載入 ${timeframe} 歷史資料`);
                }
            } catch (error) {
                console.error(`載入歷史資料失敗: ${error}`);
            }
            
            // 如果還是沒有歷史資料，只使用聚合器的資料
            if (!historicalData) {
                console.log('無法載入歷史資料，只顯示播放資料');
                const candles = this.candleAggregator.getAllCandles(timeframe);
                this.candlestickSeries.setData(candles);
                this.updateTimeRange(candles);
                return;
            }
        }

        // 找出當前播放時間（用於判斷要顯示到哪裡）
        const currentPlayTime = this.currentPlaybackTime || 
            (this.m1PlaybackData && this.playbackIndex > 0 && this.playbackIndex < this.m1PlaybackData.data.length
                ? this.m1PlaybackData.data[this.playbackIndex - 1].time
                : null);

        // 使用 Map 來合併資料，以時間為鍵值
        const candleMap = new Map();

        // 先加入所有歷史資料（但只顯示到當前播放時間）
        for (const item of historicalData.data) {
            // 如果有播放時間限制，只顯示到當前播放時間
            if (!currentPlayTime || item.time <= currentPlayTime) {
                candleMap.set(item.time, {
                    time: item.time,
                    open: item.open,
                    high: item.high,
                    low: item.low,
                    close: item.close
                });
            }
        }

        // 取得播放產生的K線資料
        let playbackCandles = [];
        if (timeframe === 'M1') {
            // M1：從已保存的播放K線數據中取得
            playbackCandles = this.playbackCandles || [];
        } else {
            // 其他時間刻度：從聚合器取得
            playbackCandles = this.candleAggregator.getAllCandles(timeframe);
        }

        // 用播放資料更新或覆蓋歷史資料
        for (const candle of playbackCandles) {
            // 播放資料優先（會覆蓋同時間的歷史資料）
            candleMap.set(candle.time, candle);
        }

        // 轉回陣列並排序
        const allCandles = Array.from(candleMap.values()).sort((a, b) => a.time - b.time);
        
        // 檢查是否有時間斷層（特別是H1和H4）
        if ((timeframe === 'H1' || timeframe === 'H4') && allCandles.length > 1) {
            const expectedInterval = timeframe === 'H1' ? 3600 : 14400;
            for (let i = 1; i < allCandles.length; i++) {
                const timeDiff = allCandles[i].time - allCandles[i-1].time;
                if (timeDiff > expectedInterval * 1.5) {
                    console.warn(`⚠️ ${timeframe} 時間斷層: ${new Date(allCandles[i-1].time * 1000).toLocaleString()} -> ${new Date(allCandles[i].time * 1000).toLocaleString()}`);
                }
            }
        }

        console.log(`${timeframe} 合併後K線: ${allCandles.length} 根 (歷史: ${candleMap.size - playbackCandles.length}, 播放: ${playbackCandles.length})`);
        
        if (allCandles.length > 0) {
            console.log(`  • 第一根: ${new Date(allCandles[0].time * 1000).toLocaleString()}`);
            console.log(`  • 最後根: ${new Date(allCandles[allCandles.length-1].time * 1000).toLocaleString()}`);
        }

        // 清除並重新設定資料
        this.candlestickSeries.setData([]);

        // 設定資料
        this.candlestickSeries.setData(allCandles);
        
        // 更新時間範圍顯示
        this.updateTimeRange(allCandles);
    }

    updateCountdown() {
        const countdown = document.getElementById('countdown');
        if (countdown) {
            countdown.textContent = `下一根: ${this.countdownValue}秒`;
        }
    }

    updatePlaybackButtons() {
        const playBtn = document.getElementById('play-btn');
        const pauseBtn = document.getElementById('pause-btn');

        if (this.isPlaying) {
            playBtn.disabled = true;
            pauseBtn.disabled = false;
        } else if (this.m1PlaybackData && this.playbackIndex > 0) {
            // 暫停狀態
            playBtn.disabled = true;
            pauseBtn.disabled = false;
        } else {
            // 停止狀態
            playBtn.disabled = false;
            pauseBtn.disabled = true;
        }
    }

    // 取得 FVG 的像素高度
    getFvgPixelHeight(upper, lower) {
        if (!this.chart || !this.candlestickSeries) return null;
        
        try {
            // 使用正確的 Lightweight Charts v4 API
            const priceScale = this.chart.priceScale('right');
            if (!priceScale) {
                return null;
            }
            
            // 確保圖表已完成初始化和布局
            const yTop = priceScale.priceToCoordinate(upper);
            const yBot = priceScale.priceToCoordinate(lower);
            
            if (yTop === null || yBot === null || isNaN(yTop) || isNaN(yBot)) {
                return null; // 尚未完成初次布局時的保險
            }
            
            const pixelHeight = Math.abs(yTop - yBot);
            
            // 只有當像素高度是合理數值時才返回
            if (pixelHeight > 0 && pixelHeight < 10000) {
                return pixelHeight;
            }
            
            return null;
        } catch (error) {
            // 靜默處理錯誤，使用 fallback
            return null;
        }
    }

    formatDateTime(date) {
        return date.toLocaleString('zh-TW', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    }

    formatTime(date) {
        return date.toLocaleString('zh-TW', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    }

    updateTimeRange(candles) {
        const timeRange = document.getElementById('time-range');
        if (timeRange && candles && candles.length > 0) {
            const firstTime = new Date(candles[0].time * 1000);
            const lastTime = new Date(candles[candles.length - 1].time * 1000);
            timeRange.textContent = `時間範圍: ${this.formatTime(firstTime)} ~ ${this.formatTime(lastTime)}`;
        }
    }

    // 手動線功能方法
    toggleDrawLineMode() {
        this.isDrawingLine = !this.isDrawingLine;
        const btn = document.getElementById('draw-line-btn');
        
        if (this.isDrawingLine) {
            btn.textContent = '✏️ 畫線中';
            btn.classList.add('active');
            // 改變滑鼠游標
            document.getElementById('chart').style.cursor = 'crosshair';
        } else {
            btn.textContent = '畫線';
            btn.classList.remove('active');
            document.getElementById('chart').style.cursor = 'default';
        }
    }

    addHorizontalLine(param) {
        // 取得點擊位置的價格
        const price = this.candlestickSeries.coordinateToPrice(param.point.y);
        
        if (price === null) return;
        
        // 建立水平線
        const line = this.candlestickSeries.createPriceLine({
            price: price,
            color: '#2196F3',
            lineWidth: 2,
            lineStyle: LightweightCharts.LineStyle.Dashed,
            axisLabelVisible: true,
            title: `手動線 ${price.toFixed(2)}`,
        });
        
        // 儲存線的資訊（跨時間刻度共享）
        this.manualLines.push({
            price: price,
            line: line,
            timestamp: Date.now()
        });
        
        console.log(`新增水平線: ${price.toFixed(2)}`);
        
        // 結束畫線模式
        this.toggleDrawLineMode();
    }

    clearManualLines() {
        this.manualLines.forEach(item => {
            this.candlestickSeries.removePriceLine(item.line);
        });
        this.manualLines = [];
        console.log('🗑️ 清除所有手動線');
    }

    // 在切換時間刻度時重新繪製手動線
    redrawManualLines() {
        if (!this.candlestickSeries || this.manualLines.length === 0) {
            return;
        }

        // 先移除舊的線物件（但保留資料）
        this.manualLines.forEach(item => {
            if (item.line) {
                try {
                    this.candlestickSeries.removePriceLine(item.line);
                } catch (e) {
                    // 忽略錯誤
                }
            }
        });
        
        // 重新建立線
        this.manualLines.forEach(item => {
            item.line = this.candlestickSeries.createPriceLine({
                price: item.price,
                color: '#2196F3',
                lineWidth: 2,
                lineStyle: LightweightCharts.LineStyle.Dashed,
                axisLabelVisible: true,
                title: `手動線 ${item.price.toFixed(2)}`,
            });
        });
    }

    // 指標側邊欄控制方法
    openIndicatorsSidebar() {
        const sidebar = document.getElementById('indicators-sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        
        if (sidebar && overlay) {
            sidebar.classList.add('open');
            overlay.classList.add('show');
        }
    }
    
    closeIndicatorsSidebar() {
        const sidebar = document.getElementById('indicators-sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        
        if (sidebar && overlay) {
            sidebar.classList.remove('open');
            overlay.classList.remove('show');
        }
    }
    
    // 綁定指標勾選框事件
    bindIndicatorCheckboxes() {
        // FVG 勾選框
        const fvgCheckbox = document.getElementById('fvg-checkbox');
        if (fvgCheckbox) {
            // 設定初始狀態
            fvgCheckbox.checked = this.showFVG;
            this.updateIndicatorItemState('fvg-checkbox', this.showFVG);
            
            fvgCheckbox.addEventListener('change', (e) => {
                this.showFVG = e.target.checked;
                this.updateIndicatorItemState('fvg-checkbox', this.showFVG);
                
                if (this.showFVG) {
                    this.drawFVGs();
                } else {
                    this.clearFVGs();
                }
                
                console.log(`FVG 指標: ${this.showFVG ? '開啟' : '關閉'}`);
            });
        }
        
        // 其他指標的勾選框（暫時只是示例，實際功能需要後續實現）
        const indicators = ['sr', 'sma', 'ema', 'rsi', 'macd'];
        indicators.forEach(indicator => {
            const checkbox = document.getElementById(`${indicator}-checkbox`);
            if (checkbox) {
                checkbox.addEventListener('change', (e) => {
                    this.updateIndicatorItemState(`${indicator}-checkbox`, e.target.checked);
                    console.log(`${indicator.toUpperCase()} 指標: ${e.target.checked ? '開啟' : '關閉'}`);
                    
                    // 這裡將來會調用對應的指標管理器方法
                    // this.indicatorManager.toggleIndicator(indicator.toUpperCase());
                });
            }
        });
        
        // 綁定設定按鈕事件
        const settingsBtns = document.querySelectorAll('.settings-btn');
        settingsBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // 防止觸發label的點擊事件
                const indicator = btn.dataset.indicator;
                this.openIndicatorSettings(indicator);
            });
        });
    }
    
    // 更新指標項目的視覺狀態
    updateIndicatorItemState(checkboxId, isChecked) {
        const checkbox = document.getElementById(checkboxId);
        if (checkbox) {
            const indicatorItem = checkbox.closest('.indicator-item');
            if (indicatorItem) {
                if (isChecked) {
                    indicatorItem.classList.add('checked');
                } else {
                    indicatorItem.classList.remove('checked');
                }
            }
        }
    }
    
    // 打開指標設定面板（暫時只是示例）
    openIndicatorSettings(indicator) {
        console.log(`打開 ${indicator.toUpperCase()} 指標設定面板`);
        
        // 這裡可以顯示一個模態框或彈出窗口來設定指標參數
        // 暫時用 alert 來示例
        switch(indicator) {
            case 'fvg':
                alert('FVG 設定功能開發中\n將來可以調整:\n- 最大存活期\n- 方向連續性要求');
                break;
            case 'sma':
                alert('SMA 設定功能開發中\n將來可以調整:\n- 週期長度\n- 線條顏色\n- 線條寬度');
                break;
            default:
                alert(`${indicator.toUpperCase()} 設定功能開發中`);
        }
    }
    
    // 修改原有的 toggleFVG 方法，使其與側邊欄同步
    toggleFVG() {
        this.showFVG = !this.showFVG;
        
        // 同步更新側邊欄的勾選框
        const fvgCheckbox = document.getElementById('fvg-checkbox');
        if (fvgCheckbox) {
            fvgCheckbox.checked = this.showFVG;
            this.updateIndicatorItemState('fvg-checkbox', this.showFVG);
        }
        
        // 原有的按鈕邏輯
        const btn = document.getElementById('fvg-toggle-btn');
        if (btn) {
            if (this.showFVG) {
                btn.textContent = 'FVG 開';
                btn.classList.add('active');
                this.drawFVGs();
            } else {
                btn.textContent = 'FVG 關';
                btn.classList.remove('active');
                this.clearFVGs();
            }
        }
        
        console.log(`FVG 顯示: ${this.showFVG ? '開啟' : '關閉'}`);
    }

}

// 初始化應用程式
(function initApp() {
    const start = () => {
        console.log('DOM 已準備好，初始化應用程式');

        const chart = document.getElementById('chart');
        if (!chart) {
            console.error('找不到圖表容器');
            alert('頁面載入錯誤：找不到圖表容器');
            return;
        }

        try {
            window.app = new TradingChartApp();
            console.log('應用程式初始化完成');
        } catch (error) {
            console.error('應用程式初始化失敗:', error);
            alert(`系統初始化失敗: ${error.message}`);
        }
    };

    if (document.readyState === 'loading') {
        console.log('DOM 尚未完成，等待 DOMContentLoaded');
        document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
        console.log('DOM 已經完成，直接啟動');
        start();
    }
})();

console.log('script.js 載入完成');