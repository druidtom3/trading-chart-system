// 檔名：candleAggregator.js

class CandleAggregator {
    constructor() {
        // 儲存各時間刻度的未完成 K 線
        this.openCandles = {
            M5: null,
            M15: null,
            H1: null,
            H4: null,
            D1: null
        };
        
        // 儲存各時間刻度的完成 K 線
        this.completedCandles = {
            M1: [],
            M5: [],
            M15: [],
            H1: [],
            H4: [],
            D1: []
        };
        
        // 時區資訊（由後端提供）
        this.timezoneInfo = null;
        
        // 記錄最後處理的時間，用於跨日檢測
        this.lastProcessedTime = null;
    }
    
    /**
     * 重置所有資料
     */
    reset() {
        this.openCandles = {
            M5: null,
            M15: null,
            H1: null,
            H4: null,
            D1: null
        };
        
        this.completedCandles = {
            M1: [],
            M5: [],
            M15: [],
            H1: [],
            H4: [],
            D1: []
        };
        
        this.lastProcessedTime = null;
    }
    
    /**
     * 設定時區資訊
     * @param {Object} tzInfo - 後端提供的時區資訊
     */
    setTimezoneInfo(tzInfo) {
        this.timezoneInfo = tzInfo;
    }
    
    /**
     * 新增一根 M1 K 線並更新其他時間刻度
     * @param {Object} m1Candle - M1 K 線資料
     * @returns {Object} 各時間刻度的更新資訊
     */
    addM1Candle(m1Candle) {
        const updates = {
            M1: { type: 'new', candle: m1Candle },
            M5: null,
            M15: null,
            H1: null,
            H4: null,
            D1: null
        };
        
        // 儲存 M1
        this.completedCandles.M1.push(m1Candle);
        
        // 檢測是否跨日
        if (this.lastProcessedTime) {
            const lastDate = new Date(this.lastProcessedTime * 1000);
            const currentDate = new Date(m1Candle.time * 1000);
            
            if (lastDate.getDate() !== currentDate.getDate()) {
                console.log(`📅 檢測到跨日: ${lastDate.toLocaleDateString()} -> ${currentDate.toLocaleDateString()}`);
            }
        }
        
        // 更新最後處理時間
        this.lastProcessedTime = m1Candle.time;
        
        // 取得時間資訊
        const date = new Date(m1Candle.time * 1000);
        const minutes = date.getMinutes();
        const hours = date.getHours();
        
        // 更新 M5
        updates.M5 = this.updateTimeframe('M5', m1Candle, 
            () => this.shouldStartNewCandle('M5', m1Candle.time));
        
        // 更新 M15
        updates.M15 = this.updateTimeframe('M15', m1Candle, 
            () => this.shouldStartNewCandle('M15', m1Candle.time));
        
        // 更新 H1
        updates.H1 = this.updateTimeframe('H1', m1Candle, 
            () => this.shouldStartNewCandle('H1', m1Candle.time));
        
        // 更新 H4
        updates.H4 = this.updateTimeframe('H4', m1Candle, 
            () => this.shouldStartNewCandle('H4', m1Candle.time));
        
        // 更新 D1
        updates.D1 = this.updateTimeframe('D1', m1Candle, 
            () => this.isNewTradingDay(m1Candle.time));
        
        return updates;
    }
    
    /**
     * 檢查是否應該開始新的K線
     * @param {string} timeframe - 時間刻度
     * @param {number} currentTime - 當前時間戳
     * @returns {boolean}
     */
    shouldStartNewCandle(timeframe, currentTime) {
        const currentCandle = this.openCandles[timeframe];
        
        // 如果沒有當前K線，應該開始新的
        if (!currentCandle) {
            return true;
        }
        
        // 取得對齊的時間
        const alignedTime = this.getTimeframeTime(currentTime, timeframe);
        const candleTime = currentCandle.time;
        
        // 如果對齊時間不同，表示需要新K線
        if (alignedTime !== candleTime) {
            // 調試資訊
            if (timeframe === 'H1' || timeframe === 'H4') {
                const timeDiff = alignedTime - candleTime;
                const hoursDiff = timeDiff / 3600;
                console.log(`🕐 ${timeframe} 新K線: ${new Date(candleTime * 1000).toLocaleString()} -> ${new Date(alignedTime * 1000).toLocaleString()} (相差 ${hoursDiff} 小時)`);
            }
            return true;
        }
        
        return false;
    }
    
    /**
     * 更新指定時間刻度
     * @param {string} timeframe - 時間刻度
     * @param {Object} m1Candle - M1 K 線資料
     * @param {Function} shouldStartNew - 判斷是否開始新 K 線的函數
     * @returns {Object} 更新資訊
     */
    updateTimeframe(timeframe, m1Candle, shouldStartNew) {
        const currentCandle = this.openCandles[timeframe];
        const alignedTime = this.getTimeframeTime(m1Candle.time, timeframe);
        
        // 檢查是否需要開始新 K 線
        if (!currentCandle || shouldStartNew()) {
            // 如果有未完成的 K 線，先完成它
            if (currentCandle && currentCandle.time !== alignedTime) {
                this.completedCandles[timeframe].push(currentCandle);
                
                // 檢查是否有時間跳空
                if (timeframe === 'H1' || timeframe === 'H4') {
                    const expectedNext = this.getNextExpectedTime(currentCandle.time, timeframe);
                    if (alignedTime > expectedNext) {
                        const gapHours = (alignedTime - expectedNext) / 3600;
                        console.warn(`⚠️ ${timeframe} 跳空檢測: 預期 ${new Date(expectedNext * 1000).toLocaleString()}, 實際 ${new Date(alignedTime * 1000).toLocaleString()}, 跳空 ${gapHours} 小時`);
                        
                        // 檢查是否為週末跳空（不填補）
                        if (!this.isWeekendGap(currentCandle.time, alignedTime)) {
                            // 填補缺失的K線
                            this.fillMissingCandles(timeframe, expectedNext, alignedTime, currentCandle);
                        } else {
                            console.log(`📅 ${timeframe} 週末跳空，不填補: ${new Date(currentCandle.time * 1000).toLocaleString()} -> ${new Date(alignedTime * 1000).toLocaleString()}`);
                        }
                    }
                }
            }
            
            // 開始新 K 線
            this.openCandles[timeframe] = {
                time: alignedTime,
                open: m1Candle.open,
                high: m1Candle.high,
                low: m1Candle.low,
                close: m1Candle.close,
                volume: m1Candle.volume || 0
            };
            
            return {
                type: 'new',
                candle: this.openCandles[timeframe]
            };
        } else {
            // 確保是同一根K線（時間對齊）
            if (currentCandle.time === alignedTime) {
                // 更新現有 K 線
                currentCandle.high = Math.max(currentCandle.high, m1Candle.high);
                currentCandle.low = Math.min(currentCandle.low, m1Candle.low);
                currentCandle.close = m1Candle.close;
                currentCandle.volume += (m1Candle.volume || 0);
                
                return {
                    type: 'update',
                    candle: currentCandle
                };
            } else {
                // 時間不匹配，需要處理
                console.warn(`⚠️ ${timeframe} 時間不匹配: 當前=${new Date(currentCandle.time * 1000).toLocaleString()}, 新=${new Date(alignedTime * 1000).toLocaleString()}`);
                
                // 完成當前K線並開始新的
                this.completedCandles[timeframe].push(currentCandle);
                
                this.openCandles[timeframe] = {
                    time: alignedTime,
                    open: m1Candle.open,
                    high: m1Candle.high,
                    low: m1Candle.low,
                    close: m1Candle.close,
                    volume: m1Candle.volume || 0
                };
                
                return {
                    type: 'new',
                    candle: this.openCandles[timeframe]
                };
            }
        }
    }
    
    /**
     * 取得對齊的時間刻度時間
     * @param {number} timestamp - Unix 時間戳
     * @param {string} timeframe - 時間刻度
     * @returns {number} 對齊後的時間戳
     */
    getTimeframeTime(timestamp, timeframe) {
        const date = new Date(timestamp * 1000);
        
        switch (timeframe) {
            case 'M5':
                // M5: 對齊到 5 分鐘
                const m5Minutes = Math.floor(date.getMinutes() / 5) * 5;
                date.setMinutes(m5Minutes, 0, 0);
                break;
                
            case 'M15':
                // M15: 對齊到 15 分鐘
                const m15Minutes = Math.floor(date.getMinutes() / 15) * 15;
                date.setMinutes(m15Minutes, 0, 0);
                break;
                
            case 'H1':
                // H1: 對齊到整點
                date.setMinutes(0, 0, 0);
                break;
                
            case 'H4':
                // H4: 對齊到 0, 4, 8, 12, 16, 20
                const hours = date.getHours();
                const alignedHour = Math.floor(hours / 4) * 4;
                date.setHours(alignedHour, 0, 0, 0);
                break;
                
            case 'D1':
                // D1: 使用紐約時間判斷交易日（暫時保持原邏輯）
                const nyDate = this.toNYTime(date);
                nyDate.setHours(0, 0, 0, 0);
                return Math.floor(this.fromNYTime(nyDate).getTime() / 1000);
        }
        
        return Math.floor(date.getTime() / 1000);
    }
    
    /**
     * 取得下一個預期的時間
     * @param {number} currentTime - 當前時間戳
     * @param {string} timeframe - 時間刻度
     * @returns {number} 下一個時間戳
     */
    getNextExpectedTime(currentTime, timeframe) {
        const date = new Date(currentTime * 1000);
        
        switch (timeframe) {
            case 'H1':
                date.setHours(date.getHours() + 1);
                break;
            case 'H4':
                date.setHours(date.getHours() + 4);
                break;
            default:
                return currentTime;
        }
        
        return Math.floor(date.getTime() / 1000);
    }
    
    /**
     * 判斷是否為週末跳空
     * @param {number} lastTime - 最後一根K線時間
     * @param {number} nextTime - 下一根K線時間
     * @returns {boolean}
     */
    isWeekendGap(lastTime, nextTime) {
        const lastDate = new Date(lastTime * 1000);
        const nextDate = new Date(nextTime * 1000);
        
        // 獲取星期幾 (0=Sunday, 1=Monday, ..., 6=Saturday)
        const lastDay = lastDate.getDay();
        const nextDay = nextDate.getDay();
        
        // 檢查是否跨越週末
        // 情況1: 週五到週一 (5 -> 1)
        // 情況2: 週五到週日 (5 -> 0)  
        // 情況3: 週六到週一 (6 -> 1)
        if ((lastDay === 5 && (nextDay === 1 || nextDay === 0)) ||
            (lastDay === 6 && nextDay === 1)) {
            
            const gapHours = (nextTime - lastTime) / 3600;
            // 週末跳空通常是40-65小時 (週五22:00到週一17:00)
            if (gapHours >= 30 && gapHours <= 80) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * 填補缺失的K線
     * @param {string} timeframe - 時間刻度
     * @param {number} startTime - 開始時間
     * @param {number} endTime - 結束時間
     * @param {Object} lastCandle - 最後一根K線（用作參考）
     */
    fillMissingCandles(timeframe, startTime, endTime, lastCandle) {
        let currentTime = startTime;
        const increment = timeframe === 'H1' ? 3600 : 14400; // H1: 1小時, H4: 4小時
        let filledCount = 0;
        
        while (currentTime < endTime) {
            // 檢查這個時間是否在交易時間內
            if (this.isTradingHour(currentTime)) {
                // 建立一根平盤K線
                const missingCandle = {
                    time: currentTime,
                    open: lastCandle.close,
                    high: lastCandle.close,
                    low: lastCandle.close,
                    close: lastCandle.close,
                    volume: 0
                };
                
                this.completedCandles[timeframe].push(missingCandle);
                console.log(`🔧 ${timeframe} 填補缺失K線: ${new Date(currentTime * 1000).toLocaleString()}`);
                filledCount++;
            }
            
            currentTime += increment;
        }
        
        if (filledCount > 0) {
            console.log(`✅ ${timeframe} 總共填補了 ${filledCount} 根缺失K線`);
        }
    }

    /**
     * 判斷指定時間是否在交易時間內
     * @param {number} timestamp - Unix時間戳
     * @returns {boolean}
     */
    isTradingHour(timestamp) {
        const date = new Date(timestamp * 1000);
        const day = date.getDay(); // 0=Sunday, 6=Saturday
        
        // 外匯市場週一到週五交易
        // 簡化判斷：避免週末時間
        if (day === 0 || day === 6) {
            return false; // 週末不交易
        }
        
        return true; // 工作日都認為是交易時間
    }
    
    /**
     * 判斷是否為新的交易日（基於紐約時間）
     * @param {number} timestamp - Unix 時間戳
     * @returns {boolean}
     */
    isNewTradingDay(timestamp) {
        if (this.completedCandles.D1.length === 0) {
            return true;
        }
        
        const lastD1 = this.completedCandles.D1[this.completedCandles.D1.length - 1];
        const lastDate = this.toNYTime(new Date(lastD1.time * 1000));
        const currentDate = this.toNYTime(new Date(timestamp * 1000));
        
        return lastDate.getDate() !== currentDate.getDate();
    }
    
    /**
     * 轉換為紐約時間
     * @param {Date} date - 日期物件
     * @returns {Date}
     */
    toNYTime(date) {
        // 簡化處理：假設 UTC-5（冬令時）或 UTC-4（夏令時）
        const utcTime = date.getTime() + date.getTimezoneOffset() * 60000;
        const nyOffset = this.timezoneInfo?.ny_offset || -5;
        return new Date(utcTime + nyOffset * 3600000);
    }
    
    /**
     * 從紐約時間轉回
     * @param {Date} nyDate - 紐約時間
     * @returns {Date}
     */
    fromNYTime(nyDate) {
        const nyOffset = this.timezoneInfo?.ny_offset || -5;
        const utcTime = nyDate.getTime() - nyOffset * 3600000;
        return new Date(utcTime - new Date().getTimezoneOffset() * 60000);
    }
    
    /**
     * 取得指定時間刻度的所有 K 線（包含未完成的）
     * @param {string} timeframe - 時間刻度
     * @returns {Array} K 線陣列
     */
    getAllCandles(timeframe) {
        const completed = [...this.completedCandles[timeframe]];
        
        if (timeframe !== 'M1' && this.openCandles[timeframe]) {
            completed.push(this.openCandles[timeframe]);
        }
        
        return completed;
    }
}

// 確保可以在 script.js 中使用
window.CandleAggregator = CandleAggregator;