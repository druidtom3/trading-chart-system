// 檔名：script-v2.js - 改進的主程式（左側固定技術指標）

// 全局變數
let chart = null;
let currentTimeframe = 'M15';  // 預設時間刻度
window.currentTimeframe = currentTimeframe;  // 設為全域變數供FVG渲染器使用
let currentData = null;
let chartManager = null;
let dataManager = null;
let playbackManager = null;
let eventManager = null;

// 診斷函數 - 暴露到全域以便在控制台調用
window.runDiagnostics = function() {
    console.log('🔍 手動運行系統診斷...');
    if (window.errorMonitor) {
        return window.errorMonitor.generateDiagnosticReport();
    } else {
        console.error('ErrorMonitor 未載入');
        return null;
    }
};

window.validateCurrentData = function() {
    console.log('🔍 手動驗證當前數據...');
    if (window.dataValidator && currentData) {
        if (currentData.data) {
            window.dataValidator.validateCandleData(currentData.data, 'MANUAL_CHECK');
        }
        if (currentData.fvgs) {
            window.dataValidator.validateFVGData(currentData.fvgs, 'MANUAL_CHECK');
        }
        return window.dataValidator.getValidationReport();
    } else {
        console.error('DataValidator 未載入或無當前數據');
        return null;
    }
};

window.clearAllErrors = function() {
    console.log('🧹 清除所有錯誤記錄...');
    if (window.errorMonitor) {
        window.errorMonitor.clearErrors();
    }
    if (window.dataValidator) {
        window.dataValidator.clearHistory();
    }
    console.log('✅ 錯誤記錄已清除');
};

// DOM 元素快取
const elements = {
    chart: null,
    loading: null,
    currentDate: null,
    marketInfo: null,
    holidayInfo: null,
    refreshBtn: null,
    resetZoomBtn: null,
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
    panelToggle: null,
    // 新增進度相關元素
    backendLoading: null,
    progressBar: null,
    progressText: null,
    progressPercent: null,
    progressSteps: null
};

// 初始化函數
async function initializeSystem() {
    console.log('系統初始化中...');
    
    try {
        // 初始化 DOM 元素
        console.log('1. 初始化DOM元素...');
        initializeElements();
        
        // 暫時跳過後端載入檢查
        console.log('2. 跳過後端載入檢查');
        
        // 初始化管理器
        console.log('3. 初始化管理器...');
        await initializeManagers();
        
        // 設置事件監聽
        console.log('4. 設置事件監聽...');
        setupEventListeners();
        
        // 設置指標面板
        console.log('5. 設置指標面板...');
        setupIndicatorPanel();
        
        // 載入初始資料
        console.log('6. 載入初始資料...');
        await loadInitialData();
        
        // 延遲檢查FVG顯示（給渲染一些時間）
        console.log('7. 延遲檢查FVG顯示...');
        setTimeout(() => {
            ensureFVGDisplay();
        }, 1000);
        
        console.log('系統初始化完成！');
    } catch (error) {
        console.error('系統初始化失敗:', error);
        console.error('錯誤堆疊:', error.stack);
        alert('系統初始化失敗: ' + error.message);
    }
}

// 確保DOM已載入，然後初始化系統
if (document.readyState === 'loading') {
    // DOM還在載入中，等待DOMContentLoaded事件
    document.addEventListener('DOMContentLoaded', initializeSystem);
} else {
    // DOM已經載入完成，直接執行
    console.log('DOM已經載入完成，直接初始化系統');
    initializeSystem();
}

// 初始化 DOM 元素
function initializeElements() {
    elements.chart = document.getElementById('chart');
    elements.loading = document.getElementById('loading');
    elements.currentDate = document.getElementById('current-date');
    elements.marketInfo = document.getElementById('market-info');
    elements.holidayInfo = document.getElementById('holiday-info');
    elements.refreshBtn = document.getElementById('refresh-btn');
    elements.resetZoomBtn = document.getElementById('reset-zoom-btn');
    // fvgToggleBtn 已移除，改用左側面板控制
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
    // 進度相關元素
    elements.backendLoading = document.getElementById('backend-loading');
    elements.progressBar = document.getElementById('progress-bar');
    elements.progressText = document.getElementById('progress-text');
    elements.progressPercent = document.getElementById('progress-percent');
    elements.progressSteps = document.getElementById('progress-steps');
}

// 檢查後端載入狀態
async function checkBackendStatus() {
    if (!elements.backendLoading) {
        console.log('backendLoading元素不存在，跳過檢查');
        return;
    }
    
    let maxRetries = 10; // 最多等待20秒 (10次 x 2秒)
    let retryCount = 0;
    
    // 設置總超時 - 20秒後強制繼續
    const totalTimeout = setTimeout(() => {
        console.log('後端檢查總超時，強制繼續');
        hideBackendLoading();
    }, 20000);
    
    const checkStatus = async () => {
        try {
            console.log('檢查後端載入狀態...');
            const response = await fetch('http://127.0.0.1:5001/api/loading-status');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const status = await response.json();
            console.log('後端狀態:', status);
            
            // 更新進度顯示
            updateProgressDisplay(status);
            
            if (status.is_loading) {
                // 還在載入中，繼續檢查
                console.log('後端還在載入中，1秒後再次檢查');
                setTimeout(checkStatus, 1000);
            } else if (status.error) {
                // 載入出錯
                console.error('後端載入出錯:', status.error);
                showProgressError(status.error);
            } else {
                // 載入完成
                console.log('後端載入完成，隱藏進度畫面');
                clearTimeout(totalTimeout);
                hideBackendLoading();
            }
            
        } catch (error) {
            console.error('檢查後端狀態失敗:', error);
            retryCount++;
            if (retryCount < maxRetries) {
                // 後端可能還沒啟動，繼續嘗試
                console.log(`連接後端重試 ${retryCount}/${maxRetries}`);
                elements.progressText.textContent = `連接後端中... (${retryCount}/${maxRetries})`;
                elements.progressPercent.textContent = `${Math.round((retryCount / maxRetries) * 30)}%`;
                setTimeout(checkStatus, 2000);
            } else {
                // 超時
                console.error('連接後端超時');
                clearTimeout(totalTimeout);
                showProgressError('無法連接到後端服務器，請檢查服務器是否正常運行');
            }
        }
    };
    
    // 顯示進度載入
    elements.backendLoading.classList.remove('hidden');
    await checkStatus();
}

// 更新進度顯示
function updateProgressDisplay(status) {
    console.log('更新進度顯示:', status);
    if (!elements.progressBar) {
        console.error('progressBar元素不存在');
        return;
    }
    
    elements.progressBar.style.width = `${status.progress}%`;
    elements.progressText.textContent = status.current_step;
    elements.progressPercent.textContent = `${status.progress}%`;
    
    // 更新步驟顯示
    if (elements.progressSteps) {
        const stepText = `步驟 ${status.completed_steps}/${status.total_steps}: ${status.current_step}`;
        elements.progressSteps.innerHTML = `<div class="step active">${stepText}</div>`;
    }
    
    console.log(`進度更新完成: ${status.progress}%, ${status.current_step}`);
}

// 顯示進度錯誤
function showProgressError(error) {
    if (!elements.progressText) return;
    
    elements.progressText.textContent = '載入失敗';
    elements.progressPercent.textContent = 'ERROR';
    elements.progressBar.style.background = 'linear-gradient(135deg, #e74c3c, #c0392b)';
    
    if (elements.progressSteps) {
        elements.progressSteps.innerHTML = `<div class="step error">錯誤: ${error}</div>`;
    }
}

// 隱藏後端載入畫面
function hideBackendLoading() {
    if (elements.backendLoading) {
        setTimeout(() => {
            elements.backendLoading.classList.add('hidden');
        }, 500); // 小延遲讓用戶看到完成狀態
    }
}

// 初始化管理器
async function initializeManagers() {
    try {
        console.log('開始創建圖表管理器...');
        // 創建圖表管理器
        chartManager = new ChartManager();
        chartManager.initialize('chart');  // 需要調用initialize方法
        chart = chartManager.chart;
        console.log('圖表管理器創建成功，chart物件:', chart ? '存在' : '不存在');
        
        console.log('開始創建資料管理器...');
        // 創建資料管理器
        dataManager = new DataManager();
        console.log('資料管理器創建成功');
        
        console.log('開始創建播放管理器...');
        // 創建播放管理器
        playbackManager = new PlaybackManager(dataManager, chartManager);
        console.log('播放管理器創建成功');
        
        console.log('開始創建事件管理器...');
        // 創建事件管理器
        eventManager = new EventManager(chartManager, dataManager, playbackManager);
        console.log('事件管理器創建成功');
        
        console.log('所有管理器初始化完成');
        
        // 創建全局app對象供進度監控使用
        window.app = {
            chart: chart,
            chartManager: chartManager,
            dataManager: dataManager,
            playbackManager: playbackManager,
            eventManager: eventManager,
            currentTimeframe: currentTimeframe
        };
        console.log('window.app 對象已創建:', window.app);
        
    } catch (error) {
        console.error('管理器初始化失敗:', error);
        console.error('錯誤詳情:', error.message);
        console.error('錯誤堆疊:', error.stack);
        
        // 即使失敗也要創建app對象，但標記為錯誤狀態
        window.app = {
            error: true,
            errorMessage: error.message,
            chart: null,
            chartManager: null
        };
        
        alert('系統初始化失敗: ' + error.message);
        throw error; // 重新拋出錯誤以便上層捕獲
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
                console.log(`🎛️ 切換FVG顯示: ${isChecked}`);
                chartManager.fvgRenderer.setVisible(isChecked);
                if (isChecked && currentData && currentData.fvgs) {
                    console.log(`🎨 重新渲染 ${currentData.fvgs.length} 個FVG`);
                    chartManager.updateFVGs(currentData.fvgs, currentTimeframe);
                } else if (!isChecked) {
                    console.log('🧹 隱藏FVG - 已由setVisible處理');
                } else {
                    console.log('⚠️ 無FVG數據可顯示');
                }
            } else {
                console.error('❌ FVG渲染器不可用');
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
                window.currentData = data; // 確保全域可訪問
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
    
    // FVG 切換按鈕已移除，使用左側面板控制
    
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
    window.currentTimeframe = timeframe;  // 同步更新全域變數
    
    if (playbackManager.isPlaying) {
        playbackManager.switchTimeframe(timeframe);
    } else if (currentData) {
        showLoading();
        
        try {
            const data = await dataManager.loadSpecificData(currentData.date, timeframe);
            if (data) {
                currentData = data;
                window.currentData = data; // 確保全域可訪問
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
        console.log('🔍 CHECKPOINT-LOAD-START: 開始載入初始數據');
        const data = await dataManager.loadRandomData(currentTimeframe);
        
        if (data) {
            console.log('🔍 CHECKPOINT-LOAD-RECEIVED: 收到後端數據', {
                date: data.date,
                candleCount: data.data ? data.data.length : 0,
                fvgCount: data.fvgs ? data.fvgs.length : 0,
                hasData: !!data.data,
                hasFvgs: !!data.fvgs
            });

            // 驗證 K線數據
            if (window.dataValidator && data.data) {
                window.dataValidator.validateCandleData(data.data, 'INITIAL_LOAD');
            }

            // 驗證 FVG 數據  
            if (window.dataValidator && data.fvgs) {
                window.dataValidator.validateFVGData(data.fvgs, 'INITIAL_LOAD');
            }

            currentData = data;
            window.currentData = data; // 確保全域可訪問
            updateUI(data);
            hideLoading();
        } else {
            console.error('🔍 CHECKPOINT-LOAD-FAILED: 未收到數據');
            alert('未能載入數據，請檢查後端連接');
            hideLoading();
        }
    } catch (error) {
        console.error('🔍 CHECKPOINT-LOAD-ERROR: 載入初始資料失敗:', error);
        console.error('錯誤堆疊:', error.stack);
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
    console.log('🔍 CHECKPOINT-CHART-UPDATE: 準備更新圖表數據');
    if (window.dataValidator && data.data) {
        window.dataValidator.validateCandleData(data.data, 'CHART_UPDATE');
    }
    
    try {
        chartManager.updateData(data.data);
        console.log('✅ CHECKPOINT-CHART-SUCCESS: 圖表更新成功');
    } catch (chartError) {
        console.error('❌ CHECKPOINT-CHART-FAILED: 圖表更新失敗', chartError);
        console.error('圖表錯誤堆疊:', chartError.stack);
        throw chartError; // 重新拋出錯誤以便上層處理
    }
    
    // 更新 FVG - 檢查複選框狀態和數據
    const fvgCheckbox = document.getElementById('fvg-checkbox');
    const isFVGEnabled = fvgCheckbox && fvgCheckbox.checked;
    
    if (data.fvgs && chartManager.fvgRenderer) {
        console.log('📊 準備更新FVG數據:', data.fvgs.length, '個');
        console.log('📊 FVG複選框狀態:', isFVGEnabled ? '✅勾選' : '❌未勾選');
        
        if (isFVGEnabled) {
            // 確保渲染器顯示狀態正確
            chartManager.fvgRenderer.setVisible(true);
            chartManager.updateFVGs(data.fvgs, currentTimeframe);
            console.log('✅ FVG數據已更新並顯示');
        } else {
            console.log('⏭️ FVG已關閉，跳過渲染');
        }
    } else if (!data.fvgs) {
        console.warn('⚠️ 後端回傳無FVG數據');
    } else if (!chartManager.fvgRenderer) {
        console.warn('⚠️ FVG渲染器未初始化');
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

// 確保FVG正確顯示
function ensureFVGDisplay() {
    console.group('🔧 FVG顯示檢查');
    
    const fvgCheckbox = document.getElementById('fvg-checkbox');
    const isFVGChecked = fvgCheckbox && fvgCheckbox.checked;
    const hasData = currentData && currentData.fvgs && currentData.fvgs.length > 0;
    const hasRenderer = chartManager && chartManager.fvgRenderer;
    
    console.log('FVG顯示狀態檢查:');
    console.log('   - FVG複選框勾選:', isFVGChecked);
    console.log('   - 有FVG數據:', hasData);
    console.log('   - 有FVG渲染器:', hasRenderer);
    
    if (isFVGChecked && hasData && hasRenderer) {
        console.log('🎯 所有條件滿足，確保FVG顯示');
        try {
            // 確保渲染器設為可見
            chartManager.fvgRenderer.setVisible(true);
            
            // 暫時禁用強制重新渲染以避免無限迴圈
            // chartManager.updateFVGs(currentData.fvgs, currentTimeframe);
            
            // 檢查渲染結果
            const stats = chartManager.fvgRenderer.getStats ? chartManager.fvgRenderer.getStats() : null;
            console.log('FVG渲染統計:', stats);
            
            console.log('✅ FVG顯示檢查完成');
        } catch (error) {
            console.error('❌ FVG顯示檢查失敗:', error);
        }
    } else {
        console.log('⏭️ 跳過FVG顯示（條件不滿足）');
        if (!isFVGChecked) console.log('   原因: FVG複選框未勾選');
        if (!hasData) console.log('   原因: 無FVG數據');
        if (!hasRenderer) console.log('   原因: FVG渲染器未初始化');
    }
    
    console.groupEnd();
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