/**
 * 前端時間戳標準化工具
 * 
 * 統一處理前端時間戳格式，確保與後端的一致性。
 * 標準：後端輸出Unix秒級時間戳，前端接收後轉換為毫秒用於JavaScript Date。
 */

class TimestampUtils {
    /**
     * 驗證時間戳是否有效
     * @param {number|string} timestamp - 待驗證的時間戳
     * @returns {boolean} 時間戳是否有效
     */
    static validateTimestamp(timestamp) {
        try {
            const normalized = this.normalizeTimestamp(timestamp);
            
            // 檢查是否在合理的時間範圍內 (1970-01-01 到 2050-01-01)
            const minTimestamp = 0;  // 1970-01-01
            const maxTimestamp = 2524608000;  // 2050-01-01
            
            return normalized >= minTimestamp && normalized <= maxTimestamp;
            
        } catch (error) {
            return false;
        }
    }
    
    /**
     * 標準化時間戳為Unix秒級時間戳
     * @param {number|string|Date} timestamp - 輸入時間戳
     * @returns {number} 標準化後的Unix秒級時間戳
     */
    static normalizeTimestamp(timestamp) {
        if (timestamp === null || timestamp === undefined || timestamp === '' || timestamp === 0) {
            throw new Error("時間戳不能為空或零");
        }
        
        // 處理Date對象
        if (timestamp instanceof Date) {
            return Math.floor(timestamp.getTime() / 1000);
        }
        
        // 處理字符串
        if (typeof timestamp === 'string') {
            // 嘗試解析ISO格式
            try {
                const date = new Date(timestamp);
                if (!isNaN(date.getTime())) {
                    return Math.floor(date.getTime() / 1000);
                }
            } catch (e) {
                // 嘗試作為數字字符串處理
                timestamp = parseFloat(timestamp);
            }
        }
        
        // 處理數字類型
        if (typeof timestamp === 'number') {
            // 檢測微秒級時間戳（通常大於1000000000000000）
            if (timestamp > 1000000000000000) {
                // 轉換微秒為秒
                timestamp = timestamp / 1000000;
            }
            // 檢測毫秒級時間戳（通常大於1000000000000）
            else if (timestamp > 1000000000000) {
                // 轉換毫秒為秒
                timestamp = timestamp / 1000;
            }
            
            return Math.floor(timestamp);
        }
        
        throw new Error(`不支持的時間戳格式: ${typeof timestamp}`);
    }
    
    /**
     * 將Unix秒級時間戳轉換為毫秒級（用於JavaScript Date）
     * @param {number|string} timestamp - Unix秒級時間戳
     * @returns {number} 毫秒級時間戳
     */
    static toMilliseconds(timestamp) {
        const normalized = this.normalizeTimestamp(timestamp);
        return normalized * 1000;
    }
    
    /**
     * 將毫秒級時間戳轉換為Unix秒級時間戳
     * @param {number} milliseconds - 毫秒級時間戳
     * @returns {number} Unix秒級時間戳
     */
    static fromMilliseconds(milliseconds) {
        return Math.floor(milliseconds / 1000);
    }
    
    /**
     * 格式化時間戳為可讀字符串
     * @param {number|string} timestamp - Unix秒級時間戳
     * @param {Object} options - 格式化選項
     * @returns {string} 格式化後的時間字符串
     */
    static formatTimestamp(timestamp, options = {}) {
        const normalized = this.normalizeTimestamp(timestamp);
        const date = new Date(normalized * 1000);
        
        const defaultOptions = {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZone: 'UTC'
        };
        
        const formatOptions = { ...defaultOptions, ...options };
        return date.toLocaleString('zh-TW', formatOptions);
    }
    
    /**
     * 獲取當前時間的Unix秒級時間戳
     * @returns {number} 當前時間的Unix秒級時間戳
     */
    static getCurrentTimestamp() {
        return Math.floor(Date.now() / 1000);
    }
    
    /**
     * 檢查兩個時間戳是否在同一個交易日
     * @param {number|string} timestamp1 - 第一個時間戳
     * @param {number|string} timestamp2 - 第二個時間戳
     * @returns {boolean} 是否在同一交易日
     */
    static isSameTradingDay(timestamp1, timestamp2) {
        const ts1 = this.normalizeTimestamp(timestamp1);
        const ts2 = this.normalizeTimestamp(timestamp2);
        
        const date1 = new Date(ts1 * 1000);
        const date2 = new Date(ts2 * 1000);
        
        return date1.toDateString() === date2.toDateString();
    }
    
    /**
     * 驗證時間戳與時間框架的兼容性
     * @param {number|string} timestamp - 時間戳
     * @param {string} timeframe - 時間框架（M1, M5, M15, M30, H1, H4, D1）
     * @returns {boolean} 時間戳是否與時間框架對齊
     */
    static validateTimeframeCompatibility(timestamp, timeframe) {
        try {
            const normalized = this.normalizeTimestamp(timestamp);
            const date = new Date(normalized * 1000);
            
            // 檢查時間框架對齊
            const timeframeMinutes = {
                'M1': 1,
                'M5': 5,
                'M15': 15,
                'M30': 30,
                'H1': 60,
                'H4': 240,
                'D1': 1440  // 一天
            };
            
            if (!(timeframe in timeframeMinutes)) {
                return false;
            }
            
            const minutes = timeframeMinutes[timeframe];
            
            // 對於日線，只檢查是否為午夜（UTC）
            if (timeframe === 'D1') {
                return date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0;
            }
            
            // 對於其他時間框架，檢查分鐘對齊
            const totalMinutes = date.getUTCHours() * 60 + date.getUTCMinutes();
            return totalMinutes % minutes === 0 && date.getUTCSeconds() === 0;
            
        } catch (error) {
            return false;
        }
    }
    
    /**
     * 安全地創建Date對象（從後端時間戳）
     * @param {number|string} timestamp - 後端返回的時間戳
     * @returns {Date} JavaScript Date對象
     */
    static createDate(timestamp) {
        const normalized = this.normalizeTimestamp(timestamp);
        return new Date(normalized * 1000);
    }
    
    /**
     * 記錄時間戳轉換信息（用於調試）
     * @param {any} originalTimestamp - 原始時間戳
     * @param {string} context - 上下文信息
     */
    static logTimestampInfo(originalTimestamp, context = '') {
        try {
            const normalized = this.normalizeTimestamp(originalTimestamp);
            const formatted = this.formatTimestamp(normalized);
            
            console.log(`🕐 [${context}] 時間戳轉換:`, {
                original: originalTimestamp,
                normalized: normalized,
                formatted: formatted,
                type: typeof originalTimestamp
            });
        } catch (error) {
            console.error(`❌ [${context}] 時間戳轉換失敗:`, {
                original: originalTimestamp,
                error: error.message
            });
        }
    }
}

// 全域可用
if (typeof window !== 'undefined') {
    window.TimestampUtils = TimestampUtils;
}

// 導出（如果支持模組系統）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TimestampUtils;
}