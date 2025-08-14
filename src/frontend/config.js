// 檔名：config.js - 系統配置常數

const CONFIG = {
    // FVG 相關配置
    FVG: {
        DISPLAY_LENGTH: 40,        // FVG顯示長度（K線數量）
        DETECTION_RANGE: 400,      // FVG檢測範圍（K線數量）
        MAX_AGE: 400,              // FVG最大存活期限
        OPACITY: 0.25,             // 填充透明度
        MAX_LINES: 60,             // 最大填充線條數
        FALLBACK_LINES: 12,        // 退路線條數
        LINE_WIDTH: 1,             // 線條寬度
        GAP_WIDTH: 2,              // 線條間隔
        IOU_THRESHOLD: 0.8         // IoU去重閾值（依據規格v2調整）
    },

    // 圖表相關配置
    CHART: {
        DEFAULT_VISIBLE_CANDLES: 400,  // 預設顯示K線數量
        PLAYBACK_DELAY: 1000,          // 載入延遲（毫秒）
        LOADING_TIMEOUT: 120000,       // 載入超時（毫秒）
        MIN_BAR_SPACING: 0.5,          // 最小K線間距
        BAR_SPACING: 6,                // 預設K線間距
        RIGHT_OFFSET: 5                // 右側偏移
    },

    // 時間框架配置
    TIMEFRAMES: {
        M1: { seconds: 60, name: '1分鐘' },
        M5: { seconds: 300, name: '5分鐘' },
        M15: { seconds: 900, name: '15分鐘' },
        H1: { seconds: 3600, name: '1小時' },
        H4: { seconds: 14400, name: '4小時' },
        D1: { seconds: 86400, name: '1天' }
    },

    // 顏色配置
    COLORS: {
        CANDLE: {
            UP_COLOR: '#ffffff',        // 上漲K線顏色
            DOWN_COLOR: '#000000',      // 下跌K線顏色
            BORDER_COLOR: '#000000',    // 邊框顏色
            WICK_COLOR: '#000000'       // 影線顏色
        },
        FVG: {
            BULL: 'rgba(76, 175, 80, {opacity})',     // 看多FVG顏色
            BEAR: 'rgba(244, 67, 54, {opacity})'      // 看空FVG顏色
        },
        CHART: {
            BACKGROUND: '#ffffff',      // 背景顏色
            TEXT: '#333333',           // 文字顏色
            GRID: '#f0f0f0',          // 網格顏色
            BORDER: '#cccccc'         // 邊框顏色
        },
        MANUAL_LINE: '#2196F3'        // 手動線顏色
    },

    // API 配置
    API: {
        BASE_URL: '',                 // API 基礎URL
        ENDPOINTS: {
            RANDOM_DATA: '/api/random-data',
            SPECIFIC_DATA: '/api/data',
            M1_PLAYBACK: '/api/m1-playback-data',
            TIMEFRAMES: '/api/timeframes'
        }
    },

    // 播放相關配置
    PLAYBACK: {
        DEFAULT_SPEED: 1,             // 預設播放速度（秒）
        SPEED_OPTIONS: [0.5, 1, 2, 5, 10],  // 可選播放速度
        PRELOAD_TIMEFRAMES: ['M1', 'M5', 'M15', 'H1', 'H4', 'D1']
    }
};

// 工具函數
const ConfigUtils = {
    /**
     * 獲取時間框架的秒數
     */
    getTimeframeSeconds(timeframe) {
        return CONFIG.TIMEFRAMES[timeframe]?.seconds || 60;
    },

    /**
     * 生成FVG顏色
     */
    getFVGColor(type, opacity = CONFIG.FVG.OPACITY) {
        const colorTemplate = type === 'bull' ? CONFIG.COLORS.FVG.BULL : CONFIG.COLORS.FVG.BEAR;
        return colorTemplate.replace('{opacity}', opacity);
    },

    /**
     * 獲取API URL
     */
    getApiUrl(endpoint, params = {}) {
        let url = CONFIG.API.BASE_URL + CONFIG.API.ENDPOINTS[endpoint];
        
        // 添加查詢參數
        const searchParams = new URLSearchParams(params);
        if (searchParams.toString()) {
            url += '?' + searchParams.toString();
        }
        
        return url;
    }
};

// 將CONFIG和ConfigUtils暴露到全局範圍
window.CONFIG = CONFIG;
window.ConfigUtils = ConfigUtils;

// 如果在Node.js環境中，導出模組
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CONFIG, ConfigUtils };
}