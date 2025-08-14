// 檔名：script.js - 重構後的主類別

class TradingChartApp {
    constructor() {
        // 檢查必要的庫是否載入
        this.checkDependencies();
        
        // 初始化管理器
        this.initializeManagers();
        
        // 延遲載入初始資料
        setTimeout(() => {
            this.eventManager.loadRandomData();
        }, CONFIG.CHART.PLAYBACK_DELAY);
    }

    /**
     * 檢查依賴庫
     */
    checkDependencies() {
        const dependencies = [
            { name: 'LightweightCharts', obj: window.LightweightCharts },
            { name: 'CandleAggregator', obj: window.CandleAggregator },
            { name: 'CONFIG', obj: window.CONFIG },
            { name: 'ConfigUtils', obj: window.ConfigUtils },
            { name: 'ChartManager', obj: window.ChartManager },
            { name: 'DataManager', obj: window.DataManager },
            { name: 'PlaybackManager', obj: window.PlaybackManager },
            { name: 'EventManager', obj: window.EventManager },
            { name: 'FVGRenderer', obj: window.FVGRenderer }
        ];

        dependencies.forEach(dep => {
            if (typeof dep.obj === 'undefined') {
                console.error(`${dep.name} 未載入`);
                alert(`${dep.name} 載入失敗，請重新整理頁面`);
                throw new Error(`${dep.name} library not loaded`);
            } else {
                console.log(`✓ ${dep.name} 載入成功`);
            }
        });
    }

    /**
     * 初始化所有管理器
     */
    initializeManagers() {
        try {
            // 初始化圖表管理器
            this.chartManager = new ChartManager();
            this.chartManager.initialize('chart');
            
            // 初始化數據管理器
            this.dataManager = new DataManager();
            
            // 初始化播放管理器
            this.playbackManager = new PlaybackManager(this.dataManager, this.chartManager);
            
            // 初始化事件管理器
            this.eventManager = new EventManager(this.chartManager, this.dataManager, this.playbackManager);
            
        } catch (error) {
            alert(`管理器初始化失敗: ${error.message}`);
            throw error;
        }
    }

    /**
     * 獲取當前狀態
     */
    getCurrentState() {
        return {
            chart: this.chartManager,
            data: this.dataManager.getCurrentData(),
            playback: this.playbackManager.getPlaybackState(),
            events: this.eventManager.getCurrentState()
        };
    }

    /**
     * 選擇性提供舊版API支援（向後相容）
     */
    get chart() {
        return this.chartManager?.chart;
    }

    get candlestickSeries() {
        return this.chartManager?.candlestickSeries;
    }

    get currentData() {
        return this.dataManager?.getCurrentData();
    }

    get showFVG() {
        return this.eventManager?.showFVG;
    }

    // 以下方法為了向後相容而保留，建議使用對應的管理器方法
    
    resetZoom() {
        return this.chartManager?.resetZoom();
    }

    toggleFVG() {
        return this.eventManager?.toggleFVG();
    }

    loadRandomData() {
        return this.eventManager?.loadRandomData();
    }
}

// 初始化應用程式
(function initApp() {
    const start = () => {
        const chart = document.getElementById('chart');
        if (!chart) {
            alert('頁面載入錯誤：找不到圖表容器');
            return;
        }

        try {
            window.app = new TradingChartApp();
        } catch (error) {
            alert(`系統初始化失敗: ${error.message}`);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
        start();
    }
})();