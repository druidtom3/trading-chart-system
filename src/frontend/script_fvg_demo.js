// 檔名：script_fvg_demo.js
// FVG 半透明修復演示專用版本

console.log('script_fvg_demo.js 開始載入...');

// 檢查必要依賴
if (typeof LightweightCharts === 'undefined') {
    console.error('LightweightCharts 未定義');
    alert('圖表庫載入失敗，請重新整理頁面');
}

if (typeof CandleAggregator === 'undefined') {
    console.error('CandleAggregator 未定義');
}

class FVGDemoApp {
    constructor() {
        console.log('FVGDemoApp 建構中...');
        this.chart = null;
        this.candlestickSeries = null;
        this.currentData = null;
        this.currentTimeframe = 'M15';

        // FVG 相關屬性
        this.fvgRectangles = [];
        this.showFVG = true;
        this.demoFVGs = [];  // 演示用的測試 FVG
        
        // FVG 渲染模式
        this.useFixedMode = false;  // false = 原版模式, true = 修復模式
        
        // 其他必要屬性
        this.candleAggregator = new CandleAggregator();
        this.dataCache = new Map();

        try {
            this.initializeChart();
            this.bindEvents();
            this.initializeDemoControls();

            // 延遲載入資料
            setTimeout(() => {
                console.log('延遲載入觸發 (FVG Demo)');
                this.loadRandomData();
            }, 1000);

        } catch (error) {
            console.error('初始化失敗:', error);
            alert(`初始化失敗: ${error.message}`);
        }
    }

    initializeChart() {
        console.log('開始初始化圖表... (FVG Demo)');

        const chartContainer = document.getElementById('chart');
        if (!chartContainer) {
            throw new Error('找不到圖表容器 #chart');
        }

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

        // 創建 K線系列
        this.candlestickSeries = this.chart.addCandlestickSeries({
            upColor: '#26a69a',
            downColor: '#ef5350',
            borderVisible: false,
            wickUpColor: '#26a69a',
            wickDownColor: '#ef5350',
        });

        // 滑鼠移動事件
        this.chart.subscribeCrosshairMove(this.handleCrosshairMove.bind(this));

        // 響應式調整
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                const { width, height } = entry.contentRect;
                this.chart.resize(width, height);
            }
        });
        resizeObserver.observe(chartContainer);

        console.log('圖表初始化完成 (FVG Demo)');
    }

    bindEvents() {
        console.log('綁定事件... (FVG Demo)');
        
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
                console.log('用戶點擊重置縮放');
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

        // 側邊欄相關事件
        this.bindSidebarEvents();
        
        console.log('事件綁定完成 (FVG Demo)');
    }

    initializeDemoControls() {
        console.log('初始化演示控制...');
        
        // 模式切換按鈕
        const toggleModeBtn = document.getElementById('toggle-mode-btn');
        if (toggleModeBtn) {
            toggleModeBtn.addEventListener('click', () => {
                this.toggleRenderMode();
            });
        }
        
        // 生成測試 FVG 按鈕
        const generateBtn = document.getElementById('generate-test-fvg');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => {
                this.generateTestFVGs();
            });
        }
        
        this.updateModeIndicator();
    }

    toggleRenderMode() {
        this.useFixedMode = !this.useFixedMode;
        console.log('切換渲染模式:', this.useFixedMode ? '修復模式' : '原版模式');
        
        this.updateModeIndicator();
        
        // 重新渲染 FVG
        if (this.showFVG) {
            this.drawFVGs();
        }
    }

    updateModeIndicator() {
        const indicator = document.getElementById('mode-indicator');
        const currentMode = document.getElementById('current-mode');
        
        if (this.useFixedMode) {
            indicator.textContent = '當前模式: 修復版 (像素感知)';
            indicator.className = 'mode-indicator mode-fixed';
            if (currentMode) currentMode.textContent = '修復版 (像素感知)';
        } else {
            indicator.textContent = '當前模式: 原版 (價格感知)';
            indicator.className = 'mode-indicator mode-original';
            if (currentMode) currentMode.textContent = '原版 (價格感知)';
        }
    }

    generateTestFVGs() {
        console.log('生成測試 FVG...');
        
        // 生成不同高度的測試 FVG 來展示透明度差異
        this.demoFVGs = [];
        const baseTime = Math.floor(Date.now() / 1000) - 7200; // 2小時前
        const basePrice = 120;
        
        // 創建不同高度的 FVG 來展示問題
        const fvgSizes = [
            { height: 0.5, label: '小 FVG' },    // 矮的 FVG
            { height: 1.5, label: '中 FVG' },    // 中等 FVG  
            { height: 3.0, label: '大 FVG' },    // 高的 FVG
            { height: 5.0, label: '特大 FVG' },  // 特別高的 FVG
        ];
        
        fvgSizes.forEach((size, index) => {
            const time = baseTime + (index * 1200); // 20分鐘間隔
            const centerPrice = basePrice + (index * 2);
            
            this.demoFVGs.push({
                time: time,
                top: centerPrice + size.height / 2,
                bot: centerPrice - size.height / 2,
                type: index % 2 === 0 ? 'bull' : 'bear',
                label: size.label
            });
        });
        
        // 更新當前數據中的 FVG
        if (this.currentData) {
            this.currentData.fvgs = this.demoFVGs;
        }
        
        console.log('生成了', this.demoFVGs.length, '個測試 FVG');
        
        // 重新繪製
        this.drawFVGs();
        this.updateDemoStats();
    }

    // FVG 繪製方法 - 包含原版和修復版對比
    drawFVGs() {
        this.clearFVGs();
        
        if (!this.showFVG) {
            return;
        }

        const fvgs = this.currentData?.fvgs || [];
        if (fvgs.length === 0) {
            console.log('沒有 FVG 數據');
            return;
        }

        console.log(`繪製 ${fvgs.length} 個 FVG (${this.useFixedMode ? '修復' : '原版'}模式)`);

        if (this.useFixedMode) {
            this.drawFVGsFixed(fvgs);
        } else {
            this.drawFVGsOriginal(fvgs);
        }
        
        this.updateDemoStats();
    }

    // 原版 FVG 繪製 - 展示問題
    drawFVGsOriginal(fvgs) {
        fvgs.forEach(fvg => {
            const upper = Math.max(fvg.top, fvg.bot);
            const lower = Math.min(fvg.top, fvg.bot);
            
            // 原版問題：基於價格高度計算線條數，導致密度不一致
            const height = upper - lower;
            const baseLineCount = Math.floor(height * 3);  // 根據價格高度
            const lineCount = Math.min(Math.max(baseLineCount, 5), 20);
            const priceStep = height / lineCount;
            const fixedOpacity = 0.25;

            console.log(`原版 FVG (高度: ${height.toFixed(2)}): ${lineCount} 條線`);

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
    }

    // 修復版 FVG 繪製 - 展示解決方案
    drawFVGsFixed(fvgs) {
        fvgs.forEach(fvg => {
            const upper = Math.max(fvg.top, fvg.bot);
            const lower = Math.min(fvg.top, fvg.bot);
            
            // 修復版：使用像素感知計算
            const height = upper - lower;
            const pxH = this.getFvgPixelHeight(upper, lower);
            
            // 固定覆蓋率：1px 線 + 1px gap => 大約 50% 覆蓋
            const lineWidthPx = 1;
            const gapPx = 1;
            const maxLines = 150;
            const fallbackLines = 30;
            
            const lineCountPx = pxH ? Math.floor(pxH / (lineWidthPx + gapPx)) : fallbackLines;
            const lineCount = Math.max(1, Math.min(lineCountPx, maxLines));
            const priceStep = height / lineCount;
            const fixedOpacity = 0.25;

            console.log(`修復版 FVG (高度: ${height.toFixed(2)}, 像素: ${pxH}): ${lineCount} 條線`);

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
    }

    // 取得 FVG 的像素高度
    getFvgPixelHeight(upper, lower) {
        if (!this.chart || !this.candlestickSeries) return null;
        
        try {
            const priceScale = this.chart.priceScale('right');
            if (!priceScale) {
                return null;
            }
            
            const yTop = priceScale.priceToCoordinate(upper);
            const yBot = priceScale.priceToCoordinate(lower);
            
            if (yTop === null || yBot === null || isNaN(yTop) || isNaN(yBot)) {
                return null;
            }
            
            const pixelHeight = Math.abs(yTop - yBot);
            
            if (pixelHeight > 0 && pixelHeight < 10000) {
                return pixelHeight;
            }
            
            return null;
        } catch (error) {
            return null;
        }
    }

    clearFVGs() {
        this.fvgRectangles.forEach(line => {
            this.chart.removeSeries(line);
        });
        this.fvgRectangles = [];
    }

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

        this.updateIndicatorItemState('fvg-checkbox', this.showFVG);
        this.updateDemoStats();
    }

    updateDemoStats() {
        const fvgCountEl = document.getElementById('demo-fvg-count');
        const seriesCountEl = document.getElementById('demo-series-count');
        
        if (fvgCountEl) {
            const fvgCount = this.currentData?.fvgs?.length || 0;
            fvgCountEl.textContent = fvgCount;
        }
        
        if (seriesCountEl) {
            seriesCountEl.textContent = this.fvgRectangles.length;
        }
    }

    // 其他必要方法 (簡化版)
    async loadRandomData() {
        console.log('載入隨機資料... (FVG Demo)');
        this.showLoading();
        
        try {
            const url = `/api/random-data?timeframe=${this.currentTimeframe}`;
            const response = await fetch(url);

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

    updateChart(data) {
        console.log('更新圖表，資料筆數:', data.data.length);
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
        }
    }

    updateUI(data) {
        // 更新K線數量
        const candleCount = document.getElementById('candle-count');
        if (candleCount) {
            candleCount.textContent = `K線數量: ${data.candle_count || data.data.length}`;
        }

        // 更新FVG數量
        const fvgCount = document.getElementById('fvg-count');
        if (fvgCount) {
            const count = data.fvgs ? data.fvgs.length : 0;
            fvgCount.textContent = `FVG數量: ${count}`;
        }

        // 更新日期資訊
        const currentDate = document.getElementById('current-date');
        if (currentDate && data.date) {
            currentDate.textContent = `日期: ${data.date}`;
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
            const time = new Date(param.time * 1000);
            hoverInfo.textContent = `時間: ${time.toLocaleString('zh-TW')} | 開: ${data.open} | 高: ${data.high} | 低: ${data.low} | 收: ${data.close}`;
        }
    }

    resetZoom() {
        if (this.chart) {
            this.chart.timeScale().fitContent();
        }
    }

    showLoading() {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = 'flex';
        }
    }

    hideLoading() {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = 'none';
        }
    }

    bindSidebarEvents() {
        // 漢堡選單按鈕
        const menuBtn = document.getElementById('indicators-menu-btn');
        if (menuBtn) {
            menuBtn.addEventListener('click', () => {
                this.openSidebar();
            });
        }

        // 關閉按鈕
        const closeBtn = document.getElementById('close-sidebar-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeSidebar();
            });
        }

        // 背景遮罩
        const overlay = document.getElementById('sidebar-overlay');
        if (overlay) {
            overlay.addEventListener('click', () => {
                this.closeSidebar();
            });
        }

        // FVG checkbox
        const fvgCheckbox = document.getElementById('fvg-checkbox');
        if (fvgCheckbox) {
            fvgCheckbox.addEventListener('change', () => {
                this.showFVG = fvgCheckbox.checked;
                const btn = document.getElementById('fvg-toggle-btn');
                
                this.updateIndicatorItemState('fvg-checkbox', this.showFVG);
                
                if (this.showFVG) {
                    this.drawFVGs();
                    if (btn) {
                        btn.textContent = 'FVG 開';
                        btn.classList.add('active');
                    }
                } else {
                    this.clearFVGs();
                    if (btn) {
                        btn.textContent = 'FVG 關';
                        btn.classList.remove('active');
                    }
                }
            });
        }
    }

    openSidebar() {
        const sidebar = document.getElementById('indicators-sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        
        if (sidebar) {
            sidebar.style.left = '0';
        }
        
        if (overlay) {
            overlay.classList.add('active');
        }
    }

    closeSidebar() {
        const sidebar = document.getElementById('indicators-sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        
        if (sidebar) {
            sidebar.style.left = '-350px';
        }
        
        if (overlay) {
            overlay.classList.remove('active');
        }
    }

    updateIndicatorItemState(checkboxId, enabled) {
        const checkbox = document.getElementById(checkboxId);
        if (checkbox) {
            checkbox.checked = enabled;
        }
    }
}

// 初始化應用
console.log('準備初始化 FVGDemoApp...');
const app = new FVGDemoApp();
console.log('FVGDemoApp 初始化完成');

// 將應用實例暴露到全域，供調試使用
window.fvgDemoApp = app;