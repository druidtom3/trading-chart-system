// 檔名：data-manager.js - 數據管理器

class DataManager {
    constructor() {
        this.dataCache = new Map();
        this.currentData = null;
        this.loadingElement = null;
        this.refreshButton = null;
        this.tabButtons = [];
        
        this.initializeElements();
    }

    /**
     * 初始化DOM元素引用
     */
    initializeElements() {
        this.loadingElement = document.getElementById('loading');
        this.refreshButton = document.getElementById('refresh-btn');
        this.tabButtons = document.querySelectorAll('.tab-btn');
    }

    /**
     * 顯示載入動畫
     */
    showLoading() {
        if (this.loadingElement) this.loadingElement.classList.remove('hidden');
        if (this.refreshButton) this.refreshButton.disabled = true;
        this.tabButtons.forEach(btn => btn.disabled = true);
    }

    /**
     * 隱藏載入動畫
     */
    hideLoading() {
        if (this.loadingElement) this.loadingElement.classList.add('hidden');
        if (this.refreshButton) this.refreshButton.disabled = false;
        this.tabButtons.forEach(btn => btn.disabled = false);
    }

    /**
     * 載入隨機數據
     */
    async loadRandomData(timeframe = 'M15') {
        this.showLoading();

        try {
            const url = `/api/random-data?timeframe=${timeframe}`;
            
            const response = await fetch(url, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            
            // 快取數據
            const cacheKey = `${data.date}-${data.timeframe}`;
            this.dataCache.set(cacheKey, data);
            this.currentData = data;

            return data;

        } catch (error) {
            throw new Error(`載入資料失敗: ${error.message}`);
        } finally {
            this.hideLoading();
        }
    }

    /**
     * 載入特定日期和時間框架的數據
     */
    async loadSpecificData(date, timeframe) {
        // 檢查快取
        const cacheKey = `${date}-${timeframe}`;
        if (this.dataCache.has(cacheKey)) {
            const cachedData = this.dataCache.get(cacheKey);
            this.currentData = cachedData;
            return cachedData;
        }

        this.showLoading();

        try {
            const url = `/api/data/${date}/${timeframe}`;
            const response = await fetch(url);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            
            // 快取數據
            this.dataCache.set(cacheKey, data);
            this.currentData = data;

            return data;

        } catch (error) {
            throw new Error(`載入資料失敗: ${error.message}`);
        } finally {
            this.hideLoading();
        }
    }

    /**
     * 載入M1播放數據
     */
    async loadM1PlaybackData(date) {
        try {
            const url = `/api/m1-playback-data/${date}`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error('無法載入 M1 播放資料');
            }

            return await response.json();

        } catch (error) {
            throw new Error(`載入播放資料失敗: ${error.message}`);
        }
    }

    /**
     * 靜默載入數據（不顯示載入動畫）
     */
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

            return data;

        } catch (error) {
            console.warn(`載入 ${timeframe} 資料失敗:`, error);
            return null;
        }
    }

    /**
     * 預載所有時間框架數據
     */
    async preloadAllTimeframes(date) {
        const promises = CONFIG.PLAYBACK.PRELOAD_TIMEFRAMES.map(timeframe => 
            this.loadSpecificDataSilently(date, timeframe)
        );

        const results = await Promise.allSettled(promises);
        
        // 統計載入結果
        CONFIG.PLAYBACK.PRELOAD_TIMEFRAMES.forEach((timeframe, index) => {
            const result = results[index];
            if (result.status === 'fulfilled' && result.value) {
                const data = result.value;
                console.log(`✓ ${timeframe}: ${data.data.length} 根K線`);
            } else {
                console.warn(`✗ ${timeframe}: 載入失敗`);
            }
        });
    }

    /**
     * 更新UI顯示
     */
    updateUI(data) {
        const elements = {
            currentDate: document.getElementById('current-date'),
            marketInfo: document.getElementById('market-info'),
            candleCount: document.getElementById('candle-count'),
            timeRange: document.getElementById('time-range'),
            dstStatus: document.getElementById('dst-status'),
            fvgCount: document.getElementById('fvg-count'),
            holidayInfo: document.getElementById('holiday-info')
        };

        if (elements.currentDate) {
            elements.currentDate.textContent = `日期: ${data.date}`;
        }

        if (elements.marketInfo) {
            const nyTime = new Date(data.ny_open_taipei).toLocaleString('zh-TW');
            elements.marketInfo.textContent = `紐約開盤 (台北時間): ${nyTime}`;
        }

        if (elements.candleCount) {
            elements.candleCount.textContent = `K線數量: ${data.candle_count}`;
        }

        if (elements.dstStatus) {
            elements.dstStatus.textContent = `時區狀態: ${data.is_dst ? '夏令時間 (EDT)' : '冬令時間 (EST)'}`;
        }

        if (elements.fvgCount) {
            const count = data.fvgs ? data.fvgs.length : 0;
            elements.fvgCount.textContent = `FVG數量: ${count}`;
        }

        // 處理假日資訊
        if (elements.holidayInfo && data.holiday_info) {
            const { is_holiday, is_early_close, holiday_name, status } = data.holiday_info;
            
            if (is_holiday) {
                elements.holidayInfo.textContent = holiday_name ? `美國假日 - ${holiday_name}` : '美國假日';
                elements.holidayInfo.style.display = 'inline-block';
                elements.holidayInfo.title = `交易狀態: ${status}`;
            } else if (is_early_close) {
                elements.holidayInfo.textContent = '縮短交易時間';
                elements.holidayInfo.style.display = 'inline-block';
                elements.holidayInfo.style.background = 'linear-gradient(45deg, #f39c12, #d68910)';
                elements.holidayInfo.title = `交易狀態: ${status}`;
            } else {
                elements.holidayInfo.style.display = 'none';
            }
        }

        // 更新時間範圍
        this.updateTimeRange(data.data);
    }

    /**
     * 更新時間範圍顯示
     */
    updateTimeRange(candles) {
        const timeRange = document.getElementById('time-range');
        if (timeRange && candles && candles.length > 0) {
            const firstTime = new Date(candles[0].time * 1000);
            const lastTime = new Date(candles[candles.length - 1].time * 1000);
            
            const formatTime = (date) => date.toLocaleString('zh-TW', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
            
            timeRange.textContent = `時間範圍: ${formatTime(firstTime)} ~ ${formatTime(lastTime)}`;
        }
    }

    /**
     * 清除快取
     */
    clearCache() {
        this.dataCache.clear();
    }

    /**
     * 獲取當前數據
     */
    getCurrentData() {
        return this.currentData;
    }

    /**
     * 檢查是否有快取數據
     */
    hasCachedData(date, timeframe) {
        const cacheKey = `${date}-${timeframe}`;
        return this.dataCache.has(cacheKey);
    }

    /**
     * 獲取快取數據
     */
    getCachedData(date, timeframe) {
        const cacheKey = `${date}-${timeframe}`;
        return this.dataCache.get(cacheKey);
    }
}

// 暴露到全局範圍
window.DataManager = DataManager;