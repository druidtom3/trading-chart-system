// 檔名：script-v2.js - 改進的主程式（左側固定技術指標）

// 全局變數
let chart = null;
let currentTimeframe = 'M15';  // 預設時間刻度
let currentData = null;
let chartManager = null;
let dataManager = null;
let playbackManager = null;
let eventManager = null;

// DOM 元素快取
const elements = {
    chart: null,
    loading: null,
    currentDate: null,
    marketInfo: null,
    holidayInfo: null,
    refreshBtn: null,
    resetZoomBtn: null,
    fvgToggleBtn: null,
    drawLineBtn: null,
    clearLinesBtn: null,
    playBtn: null,
    pauseBtn: null,
    speedSelect: null,
    playbackTime: null,
    countdown: null,
    candleCount: null,
    fvgCount: null,
    timeRange: null,
    dstStatus: null,
    hoverData: null,
    indicatorsPanel: null,
    panelToggle: null
};

// 初始化系統
document.addEventListener('DOMContentLoaded', async () => {
    console.log('系統初始化中...');
    
    // 初始化 DOM 元素
    initializeElements();
    
    // 初始化管理器
    await initializeManagers();
    
    // 設置事件監聽
    setupEventListeners();
    
    // 設置指標面板
    setupIndicatorPanel();
    
    // 載入初始資料
    await loadInitialData();
    
    console.log('系統初始化完成');
});

// 初始化 DOM 元素
function initializeElements() {
    elements.chart = document.getElementById('chart');
    elements.loading = document.getElementById('loading');
    elements.currentDate = document.getElementById('current-date');
    elements.marketInfo = document.getElementById('market-info');
    elements.holidayInfo = document.getElementById('holiday-info');
    elements.refreshBtn = document.getElementById('refresh-btn');
    elements.resetZoomBtn = document.getElementById('reset-zoom-btn');
    elements.fvgToggleBtn = document.getElementById('fvg-toggle-btn');
    elements.drawLineBtn = document.getElementById('draw-line-btn');
    elements.clearLinesBtn = document.getElementById('clear-lines-btn');
    elements.playBtn = document.getElementById('play-btn');
    elements.pauseBtn = document.getElementById('pause-btn');
    elements.speedSelect = document.getElementById('speed-select');
    elements.playbackTime = document.getElementById('playback-time');
    elements.countdown = document.getElementById('countdown');
    elements.candleCount = document.getElementById('candle-count');
    elements.fvgCount = document.getElementById('fvg-count');
    elements.timeRange = document.getElementById('time-range');
    elements.dstStatus = document.getElementById('dst-status');
    elements.hoverData = document.getElementById('hover-data');
    elements.indicatorsPanel = document.getElementById('indicators-panel');
    elements.panelToggle = document.getElementById('panel-toggle');
}

// 初始化管理器
async function initializeManagers() {
    try {
        // 創建圖表管理器
        chartManager = new ChartManager('chart');
        chart = chartManager.chart;
        
        // 創建資料管理器
        dataManager = new DataManager();
        
        // 創建播放管理器
        playbackManager = new PlaybackManager(dataManager, chartManager);
        
        // 創建事件管理器
        eventManager = new EventManager(chartManager, dataManager, playbackManager);
        
        console.log('所有管理器初始化完成');
    } catch (error) {
        console.error('管理器初始化失敗:', error);
        alert('系統初始化失敗，請重新整理頁面');
    }
}

// 設置指標面板
function setupIndicatorPanel() {
    // 面板收合/展開功能
    elements.panelToggle.addEventListener('click', () => {
        elements.indicatorsPanel.classList.toggle('collapsed');
        // 調整圖表大小
        if (chart) {
            setTimeout(() => {
                chart.resize(elements.chart.offsetWidth, elements.chart.offsetHeight);
            }, 300); // 等待動畫完成
        }
    });
    
    // 分類收合/展開
    const categoryHeaders = document.querySelectorAll('.indicator-category-header');
    categoryHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const category = header.parentElement;
            category.classList.toggle('expanded');
        });
    });
    
    // 指標勾選功能
    const checkboxes = document.querySelectorAll('.indicator-item input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const indicatorId = e.target.id.replace('-checkbox', '');
            handleIndicatorToggle(indicatorId, e.target.checked);
        });
    });
    
    // 設定按鈕功能
    const settingsBtns = document.querySelectorAll('.settings-btn');
    settingsBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            const indicator = btn.dataset.indicator;
            openIndicatorSettings(indicator);
        });
    });
}

// 處理指標切換
function handleIndicatorToggle(indicatorId, isChecked) {
    console.log(`切換指標: ${indicatorId}, 狀態: ${isChecked}`);
    
    // 這裡處理指標的顯示/隱藏邏輯
    switch(indicatorId) {
        case 'fvg':
            if (chartManager && chartManager.fvgRenderer) {
                chartManager.fvgRenderer.setVisible(isChecked);
                if (isChecked && currentData) {
                    chartManager.updateFVGs(currentData.fvgs);
                } else {
                    chartManager.fvgRenderer.clearAll();
                }
            }
            break;
        case 'sr':
            // 支撐阻力位邏輯
            console.log('支撐阻力位:', isChecked);
            break;
        case 'sma':
            // SMA邏輯
            console.log('SMA:', isChecked);
            break;
        case 'ema':
            // EMA邏輯
            console.log('EMA:', isChecked);
            break;
        case 'rsi':
            // RSI邏輯
            console.log('RSI:', isChecked);
            break;
        case 'macd':
            // MACD邏輯
            console.log('MACD:', isChecked);
            break;
        case 'volume':
            // 成交量邏輯
            console.log('成交量:', isChecked);
            break;
        // 可以添加更多指標處理
    }
}

// 開啟指標設定
function openIndicatorSettings(indicator) {
    console.log(`開啟 ${indicator} 設定`);
    // 這裡可以開啟一個模態框或設定面板
    // 暫時先用 alert 示意
    alert(`${indicator.toUpperCase()} 設定功能開發中...`);
}

// 設置事件監聽
function setupEventListeners() {
    // 刷新按鈕
    elements.refreshBtn.addEventListener('click', async () => {
        console.log('載入隨機日期資料...');
        showLoading();
        
        try {
            const data = await dataManager.loadRandomData(currentTimeframe);
            if (data) {
                currentData = data;
                updateUI(data);
                hideLoading();
            }
        } catch (error) {
            console.error('載入資料失敗:', error);
            alert('載入資料失敗，請重試');
            hideLoading();
        }
    });
    
    // 重置縮放按鈕
    elements.resetZoomBtn.addEventListener('click', () => {
        chartManager.resetZoom();
    });
    
    // FVG 切換按鈕
    elements.fvgToggleBtn.addEventListener('click', () => {
        const isVisible = chartManager.toggleFVG();
        elements.fvgToggleBtn.textContent = isVisible ? 'FVG 開' : 'FVG 關';
        elements.fvgToggleBtn.classList.toggle('active', isVisible);
        
        // 同步更新指標面板的勾選狀態
        const fvgCheckbox = document.getElementById('fvg-checkbox');
        if (fvgCheckbox) {
            fvgCheckbox.checked = isVisible;
        }
    });
    
    // 畫線按鈕
    elements.drawLineBtn.addEventListener('click', () => {
        chartManager.startDrawingMode();
        elements.drawLineBtn.classList.add('active');
    });
    
    // 清除線按鈕
    elements.clearLinesBtn.addEventListener('click', () => {
        chartManager.clearAllLines();
        elements.drawLineBtn.classList.remove('active');
    });
    
    // 時間刻度分頁
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            const timeframe = btn.dataset.timeframe;
            if (timeframe !== currentTimeframe) {
                // 更新 active 狀態
                tabButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // 切換時間刻度
                await switchTimeframe(timeframe);
            }
        });
    });
    
    // ESC 鍵退出畫線模式
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            chartManager.stopDrawingMode();
            elements.drawLineBtn.classList.remove('active');
        }
    });
}

// 切換時間刻度
async function switchTimeframe(timeframe) {
    console.log(`切換到 ${timeframe} 時間刻度`);
    currentTimeframe = timeframe;
    
    if (playbackManager.isPlaying) {
        playbackManager.switchTimeframe(timeframe);
    } else if (currentData) {
        showLoading();
        
        try {
            const data = await dataManager.loadSpecificData(currentData.date, timeframe);
            if (data) {
                currentData = data;
                updateUI(data);
                hideLoading();
            }
        } catch (error) {
            console.error('切換時間刻度失敗:', error);
            hideLoading();
        }
    }
}

// 載入初始資料
async function loadInitialData() {
    showLoading();
    
    try {
        const data = await dataManager.loadRandomData(currentTimeframe);
        if (data) {
            currentData = data;
            updateUI(data);
            hideLoading();
        }
    } catch (error) {
        console.error('載入初始資料失敗:', error);
        alert('載入資料失敗，請重新整理頁面');
        hideLoading();
    }
}

// 更新 UI
function updateUI(data) {
    // 更新日期資訊
    elements.currentDate.textContent = `日期: ${data.date}`;
    
    // 更新市場資訊
    const marketOpen = new Date(data.ny_open_taipei);
    const marketClose = new Date(data.ny_close_taipei);
    elements.marketInfo.textContent = `紐約開盤: ${formatTime(marketOpen)} - ${formatTime(marketClose)} (台北時間)`;
    
    // 更新假日資訊
    if (data.holiday_info && data.holiday_info.is_holiday) {
        elements.holidayInfo.textContent = data.holiday_info.holiday_name;
        elements.holidayInfo.style.display = 'inline-block';
    } else {
        elements.holidayInfo.style.display = 'none';
    }
    
    // 更新圖表
    chartManager.updateData(data.data);
    
    // 更新 FVG
    if (data.fvgs && chartManager.fvgRenderer.isVisible) {
        chartManager.updateFVGs(data.fvgs);
    }
    
    // 更新狀態列
    elements.candleCount.textContent = `K線數量: ${data.candle_count}`;
    elements.fvgCount.textContent = `FVG數量: ${data.fvgs ? data.fvgs.length : 0}`;
    
    // 更新時區狀態
    elements.dstStatus.textContent = data.is_dst ? '時區狀態: 夏令時間' : '時區狀態: 標準時間';
    
    // 更新時間範圍
    if (data.data && data.data.length > 0) {
        const startTime = new Date(data.data[0].time * 1000);
        const endTime = new Date(data.data[data.data.length - 1].time * 1000);
        elements.timeRange.textContent = `時間範圍: ${formatDateTime(startTime)} - ${formatDateTime(endTime)}`;
    }
}

// 顯示載入動畫
function showLoading() {
    elements.loading.classList.add('active');
}

// 隱藏載入動畫
function hideLoading() {
    elements.loading.classList.remove('active');
}

// 格式化時間
function formatTime(date) {
    return date.toLocaleTimeString('zh-TW', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
    });
}

// 格式化日期時間
function formatDateTime(date) {
    return date.toLocaleString('zh-TW', { 
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
    });
}

// 處理圖表 hover
function handleChartHover(param) {
    if (param.point && param.seriesPrices) {
        const date = new Date(param.time * 1000);
        const price = param.seriesPrices.get(chartManager.candlestickSeries);
        
        if (price) {
            const text = `時間: ${formatDateTime(date)} | ` +
                       `開: ${price.open.toFixed(2)} | ` +
                       `高: ${price.high.toFixed(2)} | ` +
                       `低: ${price.low.toFixed(2)} | ` +
                       `收: ${price.close.toFixed(2)}`;
            elements.hoverData.textContent = text;
        }
    } else {
        elements.hoverData.textContent = '將滑鼠移至圖表查看詳細資料';
    }
}

// 設置圖表交叉線移動事件
if (chart) {
    chart.subscribeCrosshairMove(handleChartHover);
}

// 視窗調整大小時重新調整圖表
window.addEventListener('resize', () => {
    if (chart) {
        chart.resize(elements.chart.offsetWidth, elements.chart.offsetHeight);
    }
});