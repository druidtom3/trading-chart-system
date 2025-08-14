// 檔名：playback-manager.js - 播放功能管理器

class PlaybackManager {
    constructor(dataManager, chartManager) {
        this.dataManager = dataManager;
        this.chartManager = chartManager;
        
        // 播放狀態
        this.isPlaying = false;
        this.playbackIndex = 0;
        this.currentPlaybackTime = null;
        this.playbackTimer = null;
        this.countdownTimer = null;
        this.countdownValue = 0;
        
        // 播放數據
        this.m1PlaybackData = null;
        this.candleAggregator = new CandleAggregator();
        this.playbackCandles = [];
        this.playbackFVGs = [];
        
        // 當前時間框架
        this.currentTimeframe = 'M15';
        
        this.initializeElements();
    }

    /**
     * 初始化DOM元素
     */
    initializeElements() {
        this.elements = {
            playBtn: document.getElementById('play-btn'),
            pauseBtn: document.getElementById('pause-btn'),
            speedSelect: document.getElementById('speed-select'),
            playbackTime: document.getElementById('playback-time'),
            countdown: document.getElementById('countdown')
        };

        this.bindEvents();
    }

    /**
     * 綁定播放相關事件
     */
    bindEvents() {
        if (this.elements.playBtn) {
            this.elements.playBtn.addEventListener('click', () => {
                this.startPlayback();
            });
        }

        if (this.elements.pauseBtn) {
            this.elements.pauseBtn.addEventListener('click', () => {
                if (this.isPlaying) {
                    this.pausePlayback();
                } else {
                    this.resumePlayback();
                }
            });
        }

        if (this.elements.speedSelect) {
            this.elements.speedSelect.addEventListener('change', (e) => {
                this.countdownValue = parseInt(e.target.value);
                this.updateCountdown();

                if (this.isPlaying) {
                    this.stopTimers();
                    this.startTimers();
                }
            });
        }
    }

    /**
     * 開始播放
     */
    async startPlayback() {
        const currentData = this.dataManager.getCurrentData();
        if (!currentData) {
            alert('請先載入資料');
            return;
        }

        // 重置播放狀態
        this.resetPlaybackState();

        try {
            // 載入M1完整資料
            this.m1PlaybackData = await this.dataManager.loadM1PlaybackData(currentData.date);
            
            // 重置聚合器
            this.candleAggregator.reset();
            
            // 設置時區信息
            if (currentData.timezone_info) {
                this.candleAggregator.setTimezoneInfo(currentData.timezone_info);
            }

            // 預載所有時間框架
            await this.dataManager.preloadAllTimeframes(currentData.date);

            // 重置為開盤前狀態
            this.chartManager.updateData(currentData.data);

            // 開始播放
            this.isPlaying = true;
            this.playbackIndex = 0;
            
            if (this.m1PlaybackData.data.length > 0) {
                this.currentPlaybackTime = this.m1PlaybackData.data[0].time;
            }

            this.updatePlaybackButtons();
            this.startTimers();

        } catch (error) {
            alert('無法載入播放資料: ' + error.message);
        }
    }

    /**
     * 暫停播放
     */
    pausePlayback() {
        this.isPlaying = false;
        this.stopTimers();
        this.updatePlaybackButtons();

        if (this.elements.pauseBtn) {
            this.elements.pauseBtn.textContent = '繼續';
        }
    }

    /**
     * 繼續播放
     */
    resumePlayback() {
        this.isPlaying = true;
        this.startTimers();
        this.updatePlaybackButtons();

        if (this.elements.pauseBtn) {
            this.elements.pauseBtn.textContent = '暫停';
        }
    }

    /**
     * 停止播放
     */
    stopPlayback() {
        this.isPlaying = false;
        this.resetPlaybackState();
        this.stopTimers();
        this.updatePlaybackButtons();

        // 重置聚合器
        this.candleAggregator.reset();

        // 重置播放信息顯示
        if (this.elements.playbackTime) {
            this.elements.playbackTime.textContent = '播放時間: --';
        }
        if (this.elements.countdown) {
            this.elements.countdown.textContent = '下一根: --';
        }

        // 確保按鈕文字正確
        if (this.elements.pauseBtn) {
            this.elements.pauseBtn.textContent = '暫停';
        }
    }

    /**
     * 重置播放狀態
     */
    resetPlaybackState() {
        this.playbackIndex = 0;
        this.currentPlaybackTime = null;
        this.m1PlaybackData = null;
        this.playbackCandles = [];
        this.playbackFVGs = [];
    }

    /**
     * 開始計時器
     */
    startTimers() {
        const speed = parseInt(this.elements.speedSelect?.value || CONFIG.PLAYBACK.DEFAULT_SPEED) * 1000;

        // 倒數計時
        this.countdownValue = parseInt(this.elements.speedSelect?.value || CONFIG.PLAYBACK.DEFAULT_SPEED);
        this.updateCountdown();

        this.countdownTimer = setInterval(() => {
            this.countdownValue--;
            this.updateCountdown();

            if (this.countdownValue <= 0) {
                this.countdownValue = parseInt(this.elements.speedSelect?.value || CONFIG.PLAYBACK.DEFAULT_SPEED);
            }
        }, 1000);

        // 播放計時器
        this.playbackTimer = setInterval(() => {
            this.playNextCandle();
        }, speed);

        // 立即播放第一根
        this.playNextCandle();
    }

    /**
     * 停止計時器
     */
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

    /**
     * 播放下一根K線
     */
    playNextCandle() {
        if (!this.m1PlaybackData || this.playbackIndex >= this.m1PlaybackData.data.length) {
            return;
        }

        // 取得當前的M1 K線
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

        // 更新M1播放K線數據
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

        // 根據當前時間框架更新圖表
        this.updateChartForTimeframe(updates);

        // 更新播放時間顯示
        const playbackTime = new Date(m1Candle.time * 1000);
        if (this.elements.playbackTime) {
            this.elements.playbackTime.textContent = 
                `播放時間: ${this.formatDateTime(playbackTime)}`;
        }

        // 移動到下一根
        this.playbackIndex++;
    }

    /**
     * 更新圖表顯示
     */
    updateChartForTimeframe(updates) {
        if (this.currentTimeframe === 'M1') {
            // M1: 直接顯示新K線
            this.chartManager.candlestickSeries.update(updates.M1.candle);
        } else {
            // 其他時間框架: 更新對應的K線
            const update = updates[this.currentTimeframe];
            if (update) {
                this.chartManager.candlestickSeries.update(update.candle);
            }
        }

        // 更新FVG顯示（由於播放時FVG檢測已移至後端，這裡簡化處理）
        this.updatePlaybackFVGs();
    }

    /**
     * 更新播放時的FVG顯示
     */
    updatePlaybackFVGs() {
        // 播放時FVG檢測已由後端處理，前端只需要重新繪製
        const fvgRenderer = this.chartManager.getFVGRenderer();
        if (fvgRenderer.isVisible) {
            // 這裡可以根據需要實現播放時的FVG更新邏輯
            // 目前簡化為依賴後端檢測結果
        }
    }

    /**
     * 切換時間框架
     */
    switchTimeframe(timeframe) {
        this.currentTimeframe = timeframe;
        
        if (timeframe === 'M1' && this.isPlaying) {
            this.playbackCandles = [];
            const allCandles = this.candleAggregator.getAllCandles('M1');
            this.playbackCandles = allCandles.map(c => ({
                time: c.time,
                open: c.open,
                high: c.high,
                low: c.low,
                close: c.close
            }));
        }

        if (this.isPlaying) {
            this.redrawTimeframe(timeframe);
        }
    }

    /**
     * 重新繪製時間框架
     */
    async redrawTimeframe(timeframe) {
        await this.combineHistoricalAndPlaybackData(timeframe);
        
        // 調整視圖
        setTimeout(() => {
            this.chartManager.resetZoom();
        }, 100);
    }

    /**
     * 結合歷史和播放數據
     */
    async combineHistoricalAndPlaybackData(timeframe) {
        const currentData = this.dataManager.getCurrentData();
        if (!currentData) return;

        // 取得快取的歷史資料
        const cacheKey = `${currentData.date}-${timeframe}`;
        let historicalData = null;
        
        if (this.dataManager.hasCachedData(currentData.date, timeframe)) {
            // 這裡需要添加獲取快取數據的方法
            // historicalData = this.dataManager.getCachedData(currentData.date, timeframe);
        }

        // 取得播放產生的K線資料
        let playbackCandles = [];
        if (timeframe === 'M1') {
            playbackCandles = this.playbackCandles || [];
        } else {
            playbackCandles = this.candleAggregator.getAllCandles(timeframe);
        }

        // 更新圖表
        this.chartManager.updateData(playbackCandles);
    }

    /**
     * 更新倒數顯示
     */
    updateCountdown() {
        if (this.elements.countdown) {
            this.elements.countdown.textContent = `下一根: ${this.countdownValue}秒`;
        }
    }

    /**
     * 更新播放按鈕狀態
     */
    updatePlaybackButtons() {
        if (this.isPlaying) {
            if (this.elements.playBtn) this.elements.playBtn.disabled = true;
            if (this.elements.pauseBtn) this.elements.pauseBtn.disabled = false;
        } else if (this.m1PlaybackData && this.playbackIndex > 0) {
            // 暫停狀態
            if (this.elements.playBtn) this.elements.playBtn.disabled = true;
            if (this.elements.pauseBtn) this.elements.pauseBtn.disabled = false;
        } else {
            // 停止狀態
            if (this.elements.playBtn) this.elements.playBtn.disabled = false;
            if (this.elements.pauseBtn) this.elements.pauseBtn.disabled = true;
        }
    }

    /**
     * 格式化日期時間
     */
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

    /**
     * 獲取當前播放狀態
     */
    getPlaybackState() {
        return {
            isPlaying: this.isPlaying,
            playbackIndex: this.playbackIndex,
            currentPlaybackTime: this.currentPlaybackTime,
            totalCandles: this.m1PlaybackData?.data.length || 0
        };
    }
}

// 暴露到全局範圍
window.PlaybackManager = PlaybackManager;