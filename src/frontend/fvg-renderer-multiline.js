// FVG 多線條渲染器 - 使用半透明多線條填充效果
// 基於 docs/FVG/FVG_Display_Implementation_Guide.md 實現

class FVGRendererMultiline {
    constructor(chart, candlestickSeries) {
        this.chart = chart;
        this.candlestickSeries = candlestickSeries;
        this.fvgPrimitives = [];
        this.fvgMarkers = [];
        this.seriesMetadata = new Map(); // 追蹤系列元數據
        this.settings = {
            showFVG: true,
            showFVGMarkers: false,
            showClearedFVGs: false,  // 📊 修正：預設不顯示已清除FVG，與配置保持一致
            maxLines: 130,  // 性能限制
            minLines: 4,
            performanceMode: false
        };
        
        // 圖表系列隔離配置
        this.seriesIsolation = {
            priceScaleId: 'fvg-scale',  // 獨立的價格刻度
            maxSeriesCount: 500,        // 最大系列數量限制
            currentSeriesCount: 0,      // 當前系列計數
            emergencyMode: false        // 緊急模式標記
        };
        
        // 錯誤隔離機制配置
        this.errorIsolation = {
            maxErrors: 10,              // 最大錯誤數量
            errorCount: 0,              // 當前錯誤計數
            criticalErrorThreshold: 5,  // 嚴重錯誤閾值
            lastErrorTime: 0,           // 最後錯誤時間
            errorCooldown: 5000,        // 錯誤冷卻時間（毫秒）
            disableOnCritical: true,    // 達到嚴重錯誤時是否禁用
            isDisabled: false           // 是否被禁用
        };
        
        // 播放優化配置
        this.playbackOptimization = {
            isPlaybackMode: false,      // 是否處於播放模式
            maxFVGsDuringPlayback: 20,  // 播放時最大FVG數量
            simplifiedRendering: true,   // 播放時使用簡化渲染
            reducedLineCount: true,     // 播放時減少線條數量
            autoHideClearedFVGs: true,  // 播放時自動隱藏已清除FVG
            playbackStartTime: 0,       // 播放開始時間
            lastPlaybackUpdate: 0       // 最後播放更新時間
        };
        
        // 記憶體管理配置
        this.memoryManagement = {
            maxTotalSeries: 1000,           // 總系列數量限制
            autoCleanupThreshold: 0.8,      // 自動清理閾值（80%）
            memoryCheckInterval: 30000,     // 記憶體檢查間隔（30秒）
            lastMemoryCheck: 0,             // 最後記憶體檢查時間
            forceCleanupThreshold: 0.95,    // 強制清理閾值（95%）
            seriesAgeLimit: 300000,         // 系列年齡限制（5分鐘）
            enableAutoCleanup: true,        // 啟用自動清理
            cleanupHistory: []              // 清理歷史記錄
        };
        
        // 初始化FVG專用價格刻度
        this.initializeFVGPriceScale();
        
        console.log('✅ FVG多線條渲染器初始化完成 (已啟用系列隔離)');
        console.log(`📊 Lightweight Charts版本檢查:`);
        console.log(`   - LightweightCharts可用: ${typeof LightweightCharts !== 'undefined'}`);
        console.log(`   - LineSeries: ${typeof LightweightCharts?.LineSeries}`);
        console.log(`   - AreaSeries: ${typeof LightweightCharts?.AreaSeries}`);
        console.log(`   - HistogramSeries: ${typeof LightweightCharts?.HistogramSeries}`);
        console.log(`   - 可用方法: ${Object.keys(LightweightCharts || {}).join(', ')}`);
        
        // 暴露診斷函數到全域
        if (typeof window !== 'undefined') {
            window.diagnoseFVGRenderer = () => this.runDiagnostics();
        }
    }
    
    /**
     * 獲取當前時間框架
     * @returns {string} 時間框架 (M1, M5, M15, H1, H4, D1)
     */
    getCurrentTimeframe() {
        // 從全域變數或當前活動標籤獲取時間框架
        if (window.currentTimeframe) {
            return window.currentTimeframe;
        }
        
        // 回退：從URL或活動標籤獲取
        const activeTab = document.querySelector('.timeframe-tabs .tab.active');
        if (activeTab) {
            return activeTab.textContent.trim();
        }
        
        // 預設為M15
        console.warn('⚠️ 無法獲取當前時間框架，使用預設M15');
        return 'M15';
    }
    
    /**
     * 獲取時間框架對應的分鐘間隔
     * @param {string} timeframe 時間框架
     * @returns {number} 分鐘間隔
     */
    getTimeframeInterval(timeframe) {
        const intervals = {
            'M1': 1,
            'M5': 5,
            'M15': 15,
            'M30': 30,
            'H1': 60,
            'H4': 240,
            'D1': 1440
        };
        return intervals[timeframe] || 15; // 預設15分鐘
    }

    /**
     * 適應性線條數量計算 - 根據FVG大小動態調整線條密度（考慮播放模式）
     * @param {number} fvgGapSize FVG間隔大小
     * @returns {number} 線條數量
     */
    calculateLineCount(fvgGapSize) {
        let baseCount;
        
        // 播放模式使用簡化線條數量
        if (this.playbackOptimization.isPlaybackMode && this.playbackOptimization.reducedLineCount) {
            if (fvgGapSize >= 50) baseCount = 8;      // 大間隔
            else if (fvgGapSize >= 20) baseCount = 6; // 中等間隔
            else if (fvgGapSize >= 10) baseCount = 4; // 小間隔
            else baseCount = 2;                       // 極小間隔
        } else {
            // 正常模式的線條數量
            if (fvgGapSize >= 100) baseCount = 130;      // 極大間隔
            else if (fvgGapSize >= 80) baseCount = 100;  // 大間隔  
            else if (fvgGapSize >= 50) baseCount = 60;   // 中大間隔
            else if (fvgGapSize >= 30) baseCount = 20;   // 中等間隔
            else if (fvgGapSize >= 15) baseCount = 10;   // 中小間隔
            else if (fvgGapSize >= 5) baseCount = 6;     // 小間隔
            else baseCount = 4;                          // 極小間隔
        }
        
        // 應用性能限制
        const maxLines = this.playbackOptimization.isPlaybackMode ? 
            Math.min(this.settings.maxLines, 20) :  // 播放模式限制更嚴格
            this.settings.maxLines;
        
        return Math.min(baseCount, maxLines);
    }
    
    /**
     * 獲取填充顏色 - 低透明度實現半透明疊加效果
     */
    getFillColor(type, isCleared) {
        if (isCleared) return 'rgba(128, 128, 128, 0.08)';
        
        // 使用配置或默認顏色
        const colors = window.CONFIG?.FVG?.COLORS || {
            BULLISH: { FILL: 'rgba(0, 255, 140, 0.08)' },
            BEARISH: { FILL: 'rgba(255, 61, 113, 0.08)' }
        };
        
        return type === 'bullish' ? colors.BULLISH.FILL : colors.BEARISH.FILL;
    }
    
    /**
     * 獲取邊界顏色
     */
    getBorderColor(type, isCleared) {
        if (isCleared) return '#888888';
        
        const colors = window.CONFIG?.FVG?.COLORS || {
            BULLISH: { BORDER: '#00d68f' },
            BEARISH: { BORDER: '#ff3d71' }
        };
        
        return type === 'bullish' ? colors.BULLISH.BORDER : colors.BEARISH.BORDER;
    }
    
    /**
     * 主要渲染方法 - 渲染所有FVG（帶錯誤隔離）
     */
    render(fvgs, currentTimeframe = 'M15') {
        // 錯誤隔離檢查
        if (!this.canRender()) {
            console.warn('⚠️ FVG渲染器已被禁用或錯誤冷卻中');
            return;
        }
        
        try {
            this._renderInternal(fvgs, currentTimeframe);
        } catch (error) {
            this.handleCriticalError('render', error);
        }
    }
    
    /**
     * 內部渲染方法 - 實際的渲染邏輯
     */
    _renderInternal(fvgs, currentTimeframe = 'M15') {
        const startTime = performance.now();
        
        console.group('🎨 FVG渲染器 - 開始診斷和處理');
        console.log('📊 檢查點1 - 初始狀態檢查:');
        console.log('   - FVG數據存在:', !!fvgs);
        console.log('   - FVG數量:', fvgs ? fvgs.length : 0);
        console.log('   - showFVG設置:', this.settings.showFVG);
        console.log('   - showClearedFVGs設置:', this.settings.showClearedFVGs);
        console.log('   - 當前時間框架:', currentTimeframe);
        console.log('   - 圖表存在:', !!this.chart);
        console.log('   - K線系列存在:', !!this.candlestickSeries);
        console.log('   - 現有圖元數量:', this.fvgPrimitives.length);
        
        if (fvgs && fvgs.length > 0) {
            const sampleFvg = fvgs[0];
            console.log('   - FVG樣本數據:', sampleFvg);
            console.log('   - 樣本完整性檢查:');
            console.log('     * type:', sampleFvg.type);
            console.log('     * status:', sampleFvg.status);
            console.log('     * startTime:', sampleFvg.startTime, typeof sampleFvg.startTime);
            console.log('     * endTime:', sampleFvg.endTime, typeof sampleFvg.endTime);
            console.log('     * topPrice:', sampleFvg.topPrice, typeof sampleFvg.topPrice);
            console.log('     * bottomPrice:', sampleFvg.bottomPrice, typeof sampleFvg.bottomPrice);
        }
        
        console.log('📊 檢查點2 - 數據一致性檢查');
        const dataValidation = this.validateFVGDataConsistency(fvgs);
        if (!dataValidation.isValid) {
            console.error('❌ FVG數據一致性檢查失敗:', dataValidation.errors);
            console.groupEnd();
            return;
        }
        
        console.log('📊 檢查點2.1 - 清理現有FVG');
        this.clearFVGs();
        
        if (!fvgs || fvgs.length === 0) {
            console.warn('❌ 診斷結果: FVG渲染跳過 - 沒有FVG數據');
            console.groupEnd();
            return;
        }
        
        if (!this.settings.showFVG) {
            console.log('❌ 診斷結果: FVG渲染跳過 - 顯示已關閉');
            console.groupEnd();
            return;
        }
        
        console.log('📊 檢查點3 - FVG數據分類和性能保護');
        let validFVGs = fvgs.filter(fvg => fvg.status === 'valid');
        let clearedFVGs = fvgs.filter(fvg => fvg.status === 'cleared');
        
        // 性能保護：限制FVG總數避免堆棧溢出
        const maxFVGsPerType = 20; // 每種狀態最多20個FVG
        if (validFVGs.length > maxFVGsPerType) {
            console.warn(`⚠️ 有效FVG數量過多 (${validFVGs.length})，限制為最近${maxFVGsPerType}個`);
            validFVGs = validFVGs.slice(-maxFVGsPerType);
        }
        if (clearedFVGs.length > maxFVGsPerType) {
            console.warn(`⚠️ 已清除FVG數量過多 (${clearedFVGs.length})，限制為最近${maxFVGsPerType}個`);
            clearedFVGs = clearedFVGs.slice(-maxFVGsPerType);
        }
        
        // 播放模式優化：限制FVG數量
        if (this.playbackOptimization.isPlaybackMode) {
            console.log('🎬 播放模式優化啟用');
            
            // 限制有效FVG數量
            if (validFVGs.length > this.playbackOptimization.maxFVGsDuringPlayback) {
                // 保留最新的FVG
                validFVGs = validFVGs.slice(-this.playbackOptimization.maxFVGsDuringPlayback);
                console.log(`   - 播放模式限制有效FVG: ${validFVGs.length}/${fvgs.filter(f => f.status === 'valid').length}`);
            }
            
            // 播放模式下自動隱藏已清除FVG
            if (this.playbackOptimization.autoHideClearedFVGs) {
                clearedFVGs = [];
                console.log('   - 播放模式自動隱藏已清除FVG');
            }
        }
        
        console.log(`   - 有效FVG: ${validFVGs.length} 個`);
        console.log(`   - 已清除FVG: ${clearedFVGs.length} 個`);
        console.log(`   - showClearedFVGs設置: ${this.settings.showClearedFVGs}`);
        console.log(`   - 播放模式: ${this.playbackOptimization.isPlaybackMode}`);
        console.log(`   - 總計將渲染: ${validFVGs.length + (this.settings.showClearedFVGs ? clearedFVGs.length : 0)} 個FVG`);
        
        // 詳細列出每個FVG的狀態
        fvgs.forEach((fvg, i) => {
            console.log(`   - FVG[${i}]: type=${fvg.type}, status=${fvg.status}, startTime=${fvg.startTime}, endTime=${fvg.endTime}`);
        });
        
        if (validFVGs.length === 0 && clearedFVGs.length === 0) {
            console.warn('❌ 診斷結果: 沒有有效的FVG數據可渲染');
            console.groupEnd();
            return;
        }
        
        // 渲染有效FVG
        console.log('📊 檢查點4 - 渲染有效FVG');
        console.log(`🟢 開始渲染有效FVG: ${validFVGs.length} 個`);
        validFVGs.forEach((fvg, index) => {
            console.log(`   處理有效FVG ${index + 1}/${validFVGs.length}: ${fvg.type} (${fvg.topPrice} - ${fvg.bottomPrice})`);
            this.renderSingleFVG(fvg, index, false);
        });
        
        // 渲染已清除FVG (可選)
        console.log('📊 檢查點5 - 處理已清除FVG');
        if (this.settings.showClearedFVGs && clearedFVGs.length > 0) {
            console.log(`🔶 開始渲染已清除FVG: ${clearedFVGs.length} 個`);
            clearedFVGs.forEach((fvg, index) => {
                console.log(`   處理已清除FVG ${index + 1}/${clearedFVGs.length}: ${fvg.type} (${fvg.topPrice} - ${fvg.bottomPrice})`);
                this.renderSingleFVG(fvg, validFVGs.length + index, true);
            });
        } else if (!this.settings.showClearedFVGs) {
            console.log(`⚪ 跳過已清除FVG: ${clearedFVGs.length} 個 (showClearedFVGs=false)`);
        } else {
            console.log('⚪ 沒有已清除FVG需要渲染');
        }
        
        console.log('📊 檢查點6 - 更新標記和統計');
        this.updateMarkers();
        
        const endTime = performance.now();
        const totalPrimitives = this.fvgPrimitives.length;
        const totalMarkers = this.fvgMarkers.length;
        
        console.log('✅ FVG渲染完成 - 最終結果:');
        console.log(`   - 總圖元數量: ${totalPrimitives}`);
        console.log(`   - 總標記數量: ${totalMarkers}`);
        console.log(`   - 渲染耗時: ${(endTime - startTime).toFixed(2)}ms`);
        console.log(`   - 是否可見: ${this.isVisible}`);
        
        // 額外診斷：檢查圖元是否真的添加到圖表中
        if (totalPrimitives > 0) {
            console.log('🔍 圖元添加診斷:');
            console.log(`   - 第一個圖元類型: ${this.fvgPrimitives[0].constructor.name || 'unknown'}`);
            console.log(`   - 圖表參考: ${!!this.chart ? '存在' : '不存在'}`);
            
            // 嘗試檢查圖表中的系列數量
            try {
                const chartInfo = this.chart.options();
                console.log(`   - 圖表選項可訪問: 是`);
            } catch (e) {
                console.warn(`   - 圖表選項訪問失敗:`, e.message);
            }
        } else {
            console.warn('❌ 警告: 沒有圖元被創建！');
        }
        
        // 性能警告
        if (totalPrimitives > 500) {
            console.warn(`⚠️ 大量圖元渲染 (${totalPrimitives}個)，建議啟用性能模式`);
        }
        
        console.groupEnd();
    }
    
    /**
     * 單個FVG渲染 - 恢復原始複雜渲染
     */
    renderSingleFVG(fvg, index, isCleared) {
        // 直接調用原始的複雜渲染邏輯
        this.renderSingleFVG_Complex(fvg, index, isCleared);
    }

    /**
     * 原版單個FVG渲染 - 創建多條線形成半透明填充效果（備用）
     */
    renderSingleFVG_Complex(fvg, index, isCleared) {
        console.group(`🔹 渲染單個FVG ${index + 1} ${isCleared ? '(已清除)' : '(有效)'}`);
        
        try {
            console.log('📊 單個FVG檢查點A - 數據適配和驗證');
            
            // 適配後端數據格式 - 正確映射價格字段
            let topPrice, bottomPrice;
            
            if (fvg.topPrice !== undefined && fvg.bottomPrice !== undefined) {
                // 前端格式：直接使用
                topPrice = fvg.topPrice;
                bottomPrice = fvg.bottomPrice;
            } else if (fvg.startPrice !== undefined && fvg.endPrice !== undefined) {
                // 後端格式：根據FVG類型正確映射
                if (fvg.type === 'bullish') {
                    // 多頭FVG：startPrice是低價，endPrice是高價
                    topPrice = fvg.endPrice;
                    bottomPrice = fvg.startPrice;
                } else if (fvg.type === 'bearish') {
                    // 空頭FVG：startPrice是高價，endPrice是低價
                    topPrice = fvg.startPrice;
                    bottomPrice = fvg.endPrice;
                } else {
                    // 類型未知，使用較大值作為topPrice
                    topPrice = Math.max(fvg.startPrice, fvg.endPrice);
                    bottomPrice = Math.min(fvg.startPrice, fvg.endPrice);
                }
            } else {
                console.error(`❌ FVG ${index + 1} 價格數據格式無法識別:`, fvg);
                console.groupEnd();
                return;
            }
            
            console.log(`   - 原始數據: topPrice=${fvg.topPrice}, bottomPrice=${fvg.bottomPrice}`);
            console.log(`   - 適配結果: topPrice=${topPrice}, bottomPrice=${bottomPrice}`);
            console.log(`   - 類型: ${fvg.type}, 狀態: ${fvg.status}`);
            
            // 確保價格數據存在
            if (topPrice === undefined || bottomPrice === undefined) {
                console.error(`❌ FVG ${index + 1} 價格數據缺失:`, fvg);
                console.groupEnd();
                return;
            }
            
            // 修復時間戳格式 - 處理異常小的時間戳值
            let startTime = fvg.startTime;
            let endTime = fvg.endTime;
            
            console.log(`   - 原始時間: startTime=${fvg.startTime} (${typeof fvg.startTime}), endTime=${fvg.endTime} (${typeof fvg.endTime})`);
            
            // 智能時間戳修復邏輯
            startTime = this.fixTimestamp(startTime, 'startTime');
            endTime = this.fixTimestamp(endTime, 'endTime');
            
            // 確保endTime在合理範圍內
            if (window.currentData?.data && window.currentData.data.length > 0) {
                const candleData = window.currentData.data;
                const lastCandleTime = candleData[candleData.length - 1].time; // 保持秒級
                
                // 如果endTime超出K線範圍，將其限制在K線範圍內
                if (endTime > lastCandleTime) {
                    endTime = lastCandleTime;
                    console.warn(`   - endTime超出K線範圍，限制為: ${endTime} (${new Date(endTime).toLocaleString()})`);
                }
                
                // 確保endTime >= startTime，但不超出K線範圍
                if (endTime <= startTime) {
                    // 計算合理的endTime，但不超過最後一根K線
                    const proposedEndTime = startTime + (40 * 15 * 60); // +40個15分鐘K線（秒）
                    endTime = Math.min(proposedEndTime, lastCandleTime);
                    console.warn(`   - endTime邏輯修復: ${endTime} (${new Date(endTime).toLocaleString()})`);
                }
            } else {
                // 沒有K線數據時的降級處理
                if (endTime <= startTime) {
                    endTime = startTime + (40 * 15 * 60); // +40個15分鐘K線（秒）
                    console.warn(`   - endTime邏輯修復（無K線數據）: ${endTime}`);
                }
            }
            
            // 確保時間戳是整數且有效
            startTime = Math.floor(startTime);
            endTime = Math.floor(endTime);
            
            // 最終驗證 - 確保時間戳在合理範圍內且不影響K線顯示
            const timestampValidation = this.validateTimestampSafety(startTime, endTime, index);
            if (!timestampValidation.isValid) {
                console.error(`❌ FVG時間戳驗證失敗: ${timestampValidation.reason}`);
                console.groupEnd();
                return; // 跳過這個異常的FVG以保護K線顯示
            }
            
            console.log(`   - 最終時間: startTime=${startTime}, endTime=${endTime}`);
            console.log(`   - 時間範圍: ${new Date(startTime).toLocaleString()} - ${new Date(endTime).toLocaleString()}`);
            
            // 詳細的時間戳對比分析
            if (window.currentData?.data && window.currentData.data.length > 0) {
                const candleData = window.currentData.data;
                const firstCandle = candleData[0];
                const lastCandle = candleData[candleData.length - 1];
                const firstCandleTime = firstCandle.time; // 保持秒級
                const lastCandleTime = lastCandle.time; // 保持秒級
                
                console.log(`📊 時間戳對比分析:`);
                console.log(`   - K線時間範圍: ${new Date(firstCandleTime).toLocaleString()} - ${new Date(lastCandleTime).toLocaleString()}`);
                console.log(`   - 第一根K線: time=${firstCandle.time} (${typeof firstCandle.time})`);
                console.log(`   - 最後一根K線: time=${lastCandle.time} (${typeof lastCandle.time})`);
                console.log(`   - FVG開始時間: ${startTime} (轉換為毫秒: ${startTime})`);
                console.log(`   - FVG結束時間: ${endTime} (轉換為毫秒: ${endTime})`);
                
                // 找最接近的K線
                const startTimeSeconds = startTime; // 已經是秒級
                const endTimeSeconds = endTime; // 已經是秒級
                
                const nearestStartCandle = candleData.find(candle => Math.abs(candle.time - startTimeSeconds) < 60);
                const nearestEndCandle = candleData.find(candle => Math.abs(candle.time - endTimeSeconds) < 60);
                
                console.log(`   - 最接近開始時間的K線: ${nearestStartCandle ? nearestStartCandle.time : '未找到'}`);
                console.log(`   - 最接近結束時間的K線: ${nearestEndCandle ? nearestEndCandle.time : '未找到'}`);
                
                if (startTime < firstCandleTime || startTime > lastCandleTime) {
                    console.warn(`⚠️ FVG開始時間超出K線範圍！startTime=${new Date(startTime).toLocaleString()}`);
                }
                if (endTime < firstCandleTime || endTime > lastCandleTime) {
                    console.warn(`⚠️ FVG結束時間超出K線範圍！endTime=${new Date(endTime).toLocaleString()}`);
                }
            }
            
            const fvgGapSize = Math.abs(topPrice - bottomPrice);
            const numberOfFillLines = this.calculateLineCount(fvgGapSize);
            
            console.log(`📊 單個FVG檢查點B - 渲染參數計算`);
            console.log(`   - 間隔大小: ${fvgGapSize.toFixed(2)}`);
            console.log(`   - 計算線條數量: ${numberOfFillLines}`);
            console.log(`   - 性能限制: maxLines=${this.settings.maxLines}`);
            
            const fillColor = this.getFillColor(fvg.type, isCleared);
            const borderColor = this.getBorderColor(fvg.type, isCleared);
            console.log(`   - 填充顏色: ${fillColor}`);
            console.log(`   - 邊界顏色: ${borderColor}`);
            
            console.log('📊 單個FVG檢查點C - 開始創建填充線條');
            let createdFillLines = 0;
            
            // 暫時回退到多線條填充方案，確保FVG可見性
            console.log(`🎨 使用多線條填充方案創建FVG`);
            try {
                // 暫時跳過AreaSeries實驗，直接使用穩定的多線條方案
                console.log(`📝 使用多線條方案渲染FVG`);
                
                // 多線條填充方案
                for (let i = 1; i < numberOfFillLines; i++) {
                    const ratio = i / numberOfFillLines;
                    const linePrice = bottomPrice + (topPrice - bottomPrice) * ratio;
                    
                    console.log(`   - 創建填充線 ${i}/${numberOfFillLines-1}: 價格=${linePrice.toFixed(2)}, 比例=${ratio.toFixed(3)}`);
                    
                    try {
                        const fillLineSeries = this.createIsolatedLineSeries({
                            color: fillColor,
                            lineWidth: 1,
                            lineStyle: LightweightCharts.LineStyle.Solid,
                        });
                        
                        if (!fillLineSeries) {
                            console.error(`❌ 填充線系列創建失敗，索引: ${i}`);
                            continue;
                        }
                        
                        const lineData = [
                            { time: startTime, value: linePrice }, // 已經是秒級
                            { time: endTime, value: linePrice } // 已經是秒級
                        ];
                        
                        fillLineSeries.setData(lineData);
                        this.fvgPrimitives.push(fillLineSeries);
                        createdFillLines++;
                        
                    } catch (lineError) {
                        console.error(`❌ 填充線 ${i} 創建失敗:`, lineError);
                    }
                }
                
            } catch (fillError) {
                console.error(`❌ 多線條填充創建失敗:`, fillError);
            }
            
            console.log(`📊 單個FVG檢查點D - 創建邊界線 (填充線已創建: ${createdFillLines})`);
            
            // 2. 創建邊界線 - 明確標示FVG範圍
            try {
                const topBoundary = this.createBoundaryLine(
                    topPrice, startTime, endTime, borderColor, isCleared // 已經是秒級
                );
                const bottomBoundary = this.createBoundaryLine(
                    bottomPrice, startTime, endTime, borderColor, isCleared // 已經是秒級
                );
                
                if (topBoundary && bottomBoundary) {
                    this.fvgPrimitives.push(topBoundary, bottomBoundary);
                    console.log(`   - 邊界線創建成功: 上邊界@${topPrice.toFixed(2)}, 下邊界@${bottomPrice.toFixed(2)}`);
                } else {
                    console.error('❌ 邊界線創建失敗: 一個或多個邊界線為null');
                }
            } catch (boundaryError) {
                console.error('❌ 邊界線創建異常:', boundaryError);
            }
            
            console.log('📊 單個FVG檢查點E - 處理標記');
            
            // 3. 準備標記數據
            if (this.settings.showFVGMarkers) {
                this.fvgMarkers.push({
                    time: startTime,
                    position: 'belowBar',
                    color: borderColor,
                    shape: 'circle',
                    text: `F${index + 1}`,
                    size: 1
                });
                console.log(`   - 標記已添加: F${index + 1} @ ${new Date(startTime).toLocaleString()}`);
            } else {
                console.log('   - 標記跳過 (showFVGMarkers=false)');
            }
            
            const totalLinesForThisFVG = createdFillLines + 2; // 填充線 + 2條邊界線
            console.log(`✅ FVG ${index + 1} 渲染完成 - 創建了 ${totalLinesForThisFVG} 條線`);
            console.groupEnd();
            
        } catch (error) {
            console.error(`❌ FVG渲染失敗 [${index}]:`, error);
            
            // 使用錯誤隔離機制處理錯誤
            this.handleError(`renderSingleFVG[${index}]`, error);
            
            // 降級處理：只顯示邊界線
            try {
                this.renderFallbackFVG(fvg, isCleared);
            } catch (fallbackError) {
                console.error('❌ FVG降級渲染也失敗:', fallbackError);
                this.handleError(`fallbackFVG[${index}]`, fallbackError);
            }
        }
    }
    
    /**
     * 創建LineSeries - v4/v5兼容
     */
    createLineSeries(options) {
        console.group('🔧 創建LineSeries');
        console.log('📊 檢查API兼容性:');
        console.log('   - chart存在:', !!this.chart);
        console.log('   - chart.addSeries方法:', typeof this.chart.addSeries);
        console.log('   - chart.addLineSeries方法:', typeof this.chart.addLineSeries);
        console.log('   - LightweightCharts.LineSeries:', typeof LightweightCharts.LineSeries);
        console.log('   - 傳入選項:', options);
        
        try {
            let lineSeries = null;
            
            // v5 API: addSeries(LineSeries, options)
            if (typeof this.chart.addSeries === 'function' && typeof LightweightCharts.LineSeries !== 'undefined') {
                console.log('✅ 嘗試使用v5 API: addSeries(LineSeries, options)');
                lineSeries = this.chart.addSeries(LightweightCharts.LineSeries, options);
                console.log('   - v5創建結果:', !!lineSeries ? '成功' : '失敗');
            }
            
            // v4 API fallback: addLineSeries(options)
            else if (typeof this.chart.addLineSeries === 'function') {
                console.log('✅ 嘗試使用v4 API: addLineSeries(options)');
                lineSeries = this.chart.addLineSeries(options);
                console.log('   - v4創建結果:', !!lineSeries ? '成功' : '失敗');
            }
            
            else {
                throw new Error('No line series creation method available');
            }
            
            if (lineSeries) {
                console.log('✅ LineSeries創建成功');
                console.log('   - 系列類型:', lineSeries.constructor.name);
                console.log('   - setData方法存在:', typeof lineSeries.setData === 'function');
            } else {
                console.error('❌ LineSeries創建失敗: 返回null');
            }
            
            console.groupEnd();
            return lineSeries;
            
        } catch (error) {
            console.error('❌ 創建LineSeries異常:', error);
            console.error('   - 錯誤堆棧:', error.stack);
            console.groupEnd();
            throw error;
        }
    }
    
    /**
     * 創建邊界線 - 使用隔離系列
     */
    createBoundaryLine(price, startTime, endTime, color, isCleared) {
        const lineSeries = this.createIsolatedLineSeries({
            color: color,
            lineWidth: 0.5,
            lineStyle: isCleared ? LightweightCharts.LineStyle.Dashed : LightweightCharts.LineStyle.Solid,
        });
        
        if (!lineSeries) {
            console.error('❌ 邊界線系列創建失敗');
            return null;
        }
        
        const lineData = [
            { time: startTime, value: price },
            { time: endTime, value: price }
        ];
        
        lineSeries.setData(lineData);
        return lineSeries;
    }
    
    /**
     * 簡化FVG渲染 - 只顯示4條邊界線（上下左右）
     */
    renderFallbackFVG(fvg, isCleared) {
        console.log(`🔧 簡化渲染FVG: type=${fvg.type}, startTime=${fvg.startTime}, endTime=${fvg.endTime}`);
        
        // 適配後端數據格式 - 正確映射價格字段
        let topPrice, bottomPrice;
        
        if (fvg.topPrice !== undefined && fvg.bottomPrice !== undefined) {
            topPrice = fvg.topPrice;
            bottomPrice = fvg.bottomPrice;
        } else if (fvg.startPrice !== undefined && fvg.endPrice !== undefined) {
            if (fvg.type === 'bullish') {
                topPrice = fvg.endPrice;
                bottomPrice = fvg.startPrice;
            } else if (fvg.type === 'bearish') {
                topPrice = fvg.startPrice;
                bottomPrice = fvg.endPrice;
            } else {
                topPrice = Math.max(fvg.startPrice, fvg.endPrice);
                bottomPrice = Math.min(fvg.startPrice, fvg.endPrice);
            }
        } else {
            console.error('❌ 降級渲染失敗 - 價格數據格式無法識別');
            return;
        }
        
        if (topPrice === undefined || bottomPrice === undefined) {
            console.error('❌ 降級渲染失敗 - 價格數據缺失');
            return;
        }
        
        console.log(`   價格範圍: ${bottomPrice} ~ ${topPrice}`);
        
        const borderColor = this.getBorderColor(fvg.type, isCleared);
        
        // 修復時間戳格式 - 使用智能修復邏輯
        let startTime = this.fixTimestamp(fvg.startTime, 'fallback-startTime');
        let endTime = this.fixTimestamp(fvg.endTime, 'fallback-endTime');
        
        // 確保時間邏輯正確
        if (endTime <= startTime) {
            endTime = startTime + (40 * 15 * 60 * 1000); // +40個15分鐘K線
        }

        console.log(`   時間範圍: ${new Date(startTime).toLocaleString()} ~ ${new Date(endTime).toLocaleString()}`);
        console.log(`   時間跨度: ${((endTime - startTime) / (1000 * 60)).toFixed(1)}分鐘`);

        try {
            // 創建4條邊界線：上、下、左、右
            const lines = [];
            
            // 1. 上邊界線（水平）
            const topLine = this.createBoundaryLine(
                topPrice, startTime, endTime, borderColor, isCleared
            );
            if (topLine) lines.push(topLine);
            
            // 2. 下邊界線（水平）  
            const bottomLine = this.createBoundaryLine(
                bottomPrice, startTime, endTime, borderColor, isCleared
            );
            if (bottomLine) lines.push(bottomLine);
            
            // 3. 左邊界線（垂直） - 從底部到頂部
            const leftLine = this.createVerticalLine(
                startTime, bottomPrice, topPrice, borderColor, isCleared
            );
            if (leftLine) lines.push(leftLine);
            
            // 4. 右邊界線（垂直） - 從底部到頂部
            const rightLine = this.createVerticalLine(
                endTime, bottomPrice, topPrice, borderColor, isCleared
            );
            if (rightLine) lines.push(rightLine);
            
            if (lines.length === 4) {
                this.fvgPrimitives.push(...lines);
                console.log('✅ 簡化渲染FVG完成 (4條邊界線)');
            } else {
                console.warn(`⚠️ 部分邊界線創建失敗，成功: ${lines.length}/4`);
                this.fvgPrimitives.push(...lines); // 推送成功創建的線條
            }
            
        } catch (error) {
            console.error('❌ 簡化渲染FVG失敗:', error);
        }
    }
    
    /**
     * 創建垂直邊界線
     */
    createVerticalLine(time, bottomPrice, topPrice, color, isCleared) {
        try {
            const lineSeries = this.createIsolatedLineSeries({
                color: color,
                lineWidth: 1,
                lineStyle: isCleared ? LightweightCharts.LineStyle.Dashed : LightweightCharts.LineStyle.Solid,
            });
            
            if (!lineSeries) {
                console.error('❌ 垂直邊界線系列創建失敗');
                return null;
            }
            
            // 創建垂直線：在同一時間點放置兩個價格點
            const lineData = [
                { time: time, value: bottomPrice },
                { time: time, value: topPrice }
            ];
            
            lineSeries.setData(lineData);
            return lineSeries;
            
        } catch (error) {
            console.error('❌ 創建垂直線失敗:', error);
            return null;
        }
    }
    
    /**
     * 清除所有FVG圖元 - 使用安全移除方法
     */
    clearFVGs() {
        this.fvgPrimitives.forEach(primitive => {
            this.safeRemoveSeries(primitive);
        });
        this.fvgPrimitives = [];
        this.fvgMarkers = [];
        
        // 重置系列計數器
        this.seriesIsolation.currentSeriesCount = 0;
        
        // 清除標記 - v4/v5兼容
        this.clearMarkers();
        
        console.log('🧹 FVG清除完成，系列計數器已重置');
    }
    
    /**
     * 更新標記顯示 - v4/v5兼容
     */
    updateMarkers() {
        if (this.settings.showFVGMarkers && this.fvgMarkers.length > 0) {
            this.setMarkers(this.fvgMarkers);
        } else {
            this.clearMarkers();
        }
    }
    
    /**
     * 設置標記 - v4/v5兼容性處理
     */
    setMarkers(markers) {
        if (!this.candlestickSeries) {
            console.warn('⚠️ candlestickSeries 不存在，無法設置標記');
            return;
        }
        
        try {
            // v4 API
            if (typeof this.candlestickSeries.setMarkers === 'function') {
                this.candlestickSeries.setMarkers(markers);
                console.log('✅ 使用v4 setMarkers API');
                return;
            }
            
            // v5 可能的替代方案
            if (typeof this.candlestickSeries.applyOptions === 'function') {
                console.warn('⚠️ v5環境中setMarkers不可用，嘗試替代方案');
                // v5中標記可能需要通過其他方式設置，暫時跳過
                return;
            }
            
            console.warn('⚠️ 找不到支持的標記API');
            
        } catch (error) {
            console.error('❌ 設置標記失敗:', error);
        }
    }
    
    /**
     * 清除標記 - v4/v5兼容性處理  
     */
    clearMarkers() {
        this.setMarkers([]);
    }
    
    // === 控制方法 ===
    
    /**
     * 切換FVG顯示
     */
    toggle() {
        this.settings.showFVG = !this.settings.showFVG;
        console.log(`🎛️ FVG顯示: ${this.settings.showFVG ? '開啟' : '關閉'}`);
        
        // 如果關閉顯示，清除所有FVG
        if (!this.settings.showFVG) {
            this.clearFVGs();
        }
        
        return this.settings.showFVG;
    }
    
    /**
     * 設置顯示狀態 - 兼容舊API
     */
    setVisible(visible) {
        console.log(`🎛️ setVisible調用: ${visible}`);
        this.settings.showFVG = visible;
        
        // 如果關閉顯示，清除所有FVG
        if (!visible) {
            console.log('🧹 清除所有FVG (setVisible=false)');
            this.clearFVGs();
        }
        
        return this.settings.showFVG;
    }
    
    /**
     * 獲取顯示狀態
     */
    getVisible() {
        return this.settings.showFVG;
    }
    
    /**
     * 清除所有FVG - 兼容舊API (別名方法)
     */
    clearAll() {
        console.log('🧹 clearAll調用 - 清除所有FVG');
        this.clearFVGs();
    }
    
    /**
     * 切換標記顯示
     */
    toggleMarkers() {
        this.settings.showFVGMarkers = !this.settings.showFVGMarkers;
        console.log(`🏷️ FVG標記: ${this.settings.showFVGMarkers ? '開啟' : '關閉'}`);
        return this.settings.showFVGMarkers;
    }
    
    /**
     * 切換已清除FVG顯示
     */
    toggleClearedFVGs() {
        this.settings.showClearedFVGs = !this.settings.showClearedFVGs;
        console.log(`👻 已清除FVG: ${this.settings.showClearedFVGs ? '開啟' : '關閉'}`);
        return this.settings.showClearedFVGs;
    }
    
    // === 性能方法 ===
    
    /**
     * 設置最大線條數
     */
    setMaxLines(maxLines) {
        const newMax = Math.max(4, Math.min(200, maxLines));
        const oldMax = this.settings.maxLines;
        this.settings.maxLines = newMax;
        console.log(`⚙️ 最大線條數: ${oldMax} → ${newMax}`);
    }
    
    /**
     * 啟用/停用性能模式
     */
    enablePerformanceMode(enabled) {
        this.settings.performanceMode = enabled;
        if (enabled) {
            this.setMaxLines(50);  // 性能模式限制
            console.log('🚀 啟用FVG性能模式 (最大50條線/FVG)');
        } else {
            this.setMaxLines(130); // 恢復高質量模式
            console.log('🎨 停用FVG性能模式 (最大130條線/FVG)');
        }
    }
    
    /**
     * 獲取渲染統計信息
     */
    getStats() {
        return {
            totalPrimitives: this.fvgPrimitives.length,
            totalMarkers: this.fvgMarkers.length,
            settings: { ...this.settings },
            rendererType: 'multiline'
        };
    }
    
    /**
     * 性能追蹤渲染
     */
    renderWithPerformanceTracking(fvgs, currentTimeframe) {
        const startTime = performance.now();
        const totalLines = fvgs.reduce((sum, fvg) => {
            const gapSize = Math.abs(fvg.topPrice - fvg.bottomPrice);
            return sum + this.calculateLineCount(gapSize);
        }, 0);
        
        console.log(`📊 開始渲染 ${fvgs.length} 個FVG，預計 ${totalLines} 條線`);
        
        this.render(fvgs, currentTimeframe);
        
        const endTime = performance.now();
        console.log(`⏱️ FVG渲染性能追蹤: ${(endTime - startTime).toFixed(2)}ms`);
        
        // 性能警告
        if (totalLines > 500) {
            console.warn(`⚠️ 大量線條渲染 (${totalLines}條)，建議啟用性能模式`);
        }
        
        return {
            renderTime: endTime - startTime,
            totalLines: totalLines,
            fvgCount: fvgs.length
        };
    }
    
    /**
     * 運行FVG渲染器完整診斷
     */
    runDiagnostics() {
        console.group('🔍 FVG渲染器完整診斷');
        
        console.log('📊 基本狀態檢查:');
        console.log('   - 渲染器初始化:', !!this);
        console.log('   - 圖表引用:', !!this.chart);
        console.log('   - K線系列引用:', !!this.candlestickSeries);
        console.log('   - 當前設置:', this.settings);
        console.log('   - 圖元數量:', this.fvgPrimitives.length);
        console.log('   - 標記數量:', this.fvgMarkers.length);
        
        console.log('📊 圖表狀態檢查:');
        if (this.chart) {
            try {
                console.log('   - 圖表類型:', this.chart.constructor.name);
                console.log('   - addSeries方法:', typeof this.chart.addSeries);
                console.log('   - addLineSeries方法:', typeof this.chart.addLineSeries);
                
                // 嘗試獲取圖表尺寸
                const chartElement = this.chart.chartElement?.();
                console.log('   - 圖表元素:', !!chartElement);
                if (chartElement) {
                    console.log('   - 圖表尺寸:', chartElement.clientWidth + 'x' + chartElement.clientHeight);
                }
            } catch (e) {
                console.warn('   - 圖表狀態檢查部分失敗:', e.message);
            }
        }
        
        console.log('📊 數據檢查:');
        
        // 檢查多個數據源
        const appData = window.app?.dataManager?.currentData;
        const globalData = window.currentData;
        const data = appData || globalData;
        
        console.log('   - app.dataManager.currentData:', !!appData);
        console.log('   - window.currentData:', !!globalData);
        console.log('   - 選用數據源:', data === appData ? 'app.dataManager' : (data === globalData ? 'window.currentData' : '無'));
        
        if (data) {
            console.log('   - 當前數據存在:', !!data);
            console.log('   - FVG數據存在:', !!data.fvgs);
            console.log('   - FVG數量:', data.fvgs ? data.fvgs.length : 0);
            
            if (data.fvgs && data.fvgs.length > 0) {
                const validFvgs = data.fvgs.filter(f => f.status === 'valid');
                const clearedFvgs = data.fvgs.filter(f => f.status === 'cleared');
                console.log('   - 有效FVG:', validFvgs.length);
                console.log('   - 已清除FVG:', clearedFvgs.length);
                
                // 檢查第一個FVG的數據完整性
                const sampleFvg = data.fvgs[0];
                console.log('   - 樣本FVG:', sampleFvg);
                console.log('   - 必需字段檢查:');
                console.log('     * type:', sampleFvg.type);
                console.log('     * status:', sampleFvg.status);
                console.log('     * topPrice:', sampleFvg.topPrice);
                console.log('     * bottomPrice:', sampleFvg.bottomPrice);
                console.log('     * startTime:', sampleFvg.startTime);
                console.log('     * endTime:', sampleFvg.endTime);
            }
        } else {
            console.warn('   - 沒有可用的數據源');
        }
        
        console.log('📊 渲染測試:');
        console.log('   - LightweightCharts可用:', typeof LightweightCharts !== 'undefined');
        console.log('   - LineSeries可用:', typeof LightweightCharts?.LineSeries !== 'undefined');
        
        // 測試線條創建
        if (this.chart) {
            console.log('   - 進行線條創建測試...');
            try {
                const testOptions = {
                    color: 'rgba(255, 0, 0, 0.5)',
                    lineWidth: 1,
                    priceScaleId: 'right',
                    lastValueVisible: false,
                    priceLineVisible: false,
                };
                
                const testSeries = this.createLineSeries(testOptions);
                if (testSeries) {
                    console.log('   ✅ 測試線條創建成功');
                    // 立即移除測試線條
                    this.chart.removeSeries(testSeries);
                } else {
                    console.error('   ❌ 測試線條創建失敗: 返回null');
                }
            } catch (e) {
                console.error('   ❌ 測試線條創建異常:', e);
            }
        }
        
        console.log('📊 建議修復措施:');
        if (!this.chart) {
            console.warn('   - 圖表引用丟失，需要重新初始化渲染器');
        }
        if (!window.currentData?.fvgs) {
            console.warn('   - 缺少FVG數據，需要載入數據');
        }
        if (!this.settings.showFVG) {
            console.warn('   - FVG顯示被關閉，需要啟用顯示');
        }
        if (this.fvgPrimitives.length === 0) {
            console.warn('   - 沒有渲染圖元，可能需要重新渲染');
        }
        
        console.groupEnd();
        
        return {
            chart: !!this.chart,
            hasData: !!(window.currentData?.fvgs),
            dataCount: window.currentData?.fvgs?.length || 0,
            primitiveCount: this.fvgPrimitives.length,
            markerCount: this.fvgMarkers.length,
            settings: this.settings
        };
    }
    
    /**
     * 初始化FVG專用價格刻度 - 實現系列隔離
     */
    initializeFVGPriceScale() {
        try {
            // 配置FVG專用價格刻度
            this.chart.applyOptions({
                rightPriceScale: {
                    visible: true,
                    scaleMargins: {
                        top: 0.1,
                        bottom: 0.1,
                    },
                },
            });
            
            console.log(`🔒 FVG價格刻度隔離已初始化: ${this.seriesIsolation.priceScaleId}`);
            
        } catch (error) {
            console.error('❌ FVG價格刻度初始化失敗:', error);
            // 緊急模式：使用默認刻度
            this.seriesIsolation.priceScaleId = 'right';
            this.seriesIsolation.emergencyMode = true;
        }
    }
    
    /**
     * 安全創建線條系列 - 實現系列隔離和限制
     */
    createIsolatedLineSeries(options) {
        try {
            // 檢查系列數量限制
            if (this.seriesIsolation.currentSeriesCount >= this.seriesIsolation.maxSeriesCount) {
                console.warn(`⚠️ 達到最大系列數量限制: ${this.seriesIsolation.maxSeriesCount}`);
                return null;
            }
            
            // 應用系列隔離配置
            const isolatedOptions = {
                ...options,
                priceScaleId: this.seriesIsolation.priceScaleId,
                lastValueVisible: false,
                priceLineVisible: false,
            };
            
            let series = null;
            
            // v5 API: addSeries(LineSeries, options)
            if (typeof this.chart.addSeries === 'function' && typeof LightweightCharts.LineSeries !== 'undefined') {
                series = this.chart.addSeries(LightweightCharts.LineSeries, isolatedOptions);
            }
            // v4 API fallback: addLineSeries(options)
            else if (typeof this.chart.addLineSeries === 'function') {
                series = this.chart.addLineSeries(isolatedOptions);
            }
            else {
                throw new Error('No line series creation method available');
            }
            
            if (series) {
                this.seriesIsolation.currentSeriesCount++;
                
                // 記憶體追蹤：記錄系列元數據
                this.seriesMetadata.set(series, {
                    createdAt: Date.now(),
                    type: 'fvg-line',
                    options: isolatedOptions
                });
                
                console.log(`📊 FVG系列已創建 (${this.seriesIsolation.currentSeriesCount}/${this.seriesIsolation.maxSeriesCount})`);
                
                // 檢查是否需要記憶體清理
                this.checkMemoryUsage();
            }
            
            return series;
            
        } catch (error) {
            console.error('❌ FVG系列創建失敗:', error);
            
            // 如果達到緊急狀態，啟用緊急模式
            if (this.seriesIsolation.currentSeriesCount > this.seriesIsolation.maxSeriesCount * 0.9) {
                this.seriesIsolation.emergencyMode = true;
                console.warn('🚨 啟用FVG緊急模式：系列數量接近限制');
            }
            
            return null;
        }
    }
    
    /**
     * 安全移除系列 - 更新計數器和記憶體追蹤
     */
    safeRemoveSeries(series) {
        try {
            if (series) {
                this.chart.removeSeries(series);
                
                // 更新系列計數器
                if (this.seriesIsolation.currentSeriesCount > 0) {
                    this.seriesIsolation.currentSeriesCount--;
                }
                
                // 移除記憶體追蹤
                if (this.seriesMetadata.has(series)) {
                    this.seriesMetadata.delete(series);
                }
            }
        } catch (error) {
            console.error('❌ 移除FVG系列失敗:', error);
        }
    }
    
    /**
     * 時間戳安全驗證 - 確保FVG時間戳不會影響K線顯示
     */
    validateTimestampSafety(startTime, endTime, fvgIndex) {
        try {
            // 1. 基本時間戳格式檢查
            if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) {
                return {
                    isValid: false,
                    reason: `時間戳格式無效: start=${startTime}, end=${endTime}`
                };
            }
            
            // 2. 時間邏輯檢查
            if (startTime >= endTime) {
                return {
                    isValid: false,
                    reason: `時間邏輯錯誤: startTime(${startTime}) >= endTime(${endTime})`
                };
            }
            
            // 3. 合理範圍檢查（過去5年到未來1年）
            const currentTime = Math.floor(Date.now() / 1000); // 當前時間（秒）
            const fiveYearsAgo = currentTime - (5 * 365 * 24 * 60 * 60); // 5年（秒）
            const oneYearLater = currentTime + (365 * 24 * 60 * 60); // 1年（秒）
            
            if (startTime < fiveYearsAgo || startTime > oneYearLater) {
                return {
                    isValid: false,
                    reason: `startTime超出合理範圍: ${new Date(startTime).toISOString()}`
                };
            }
            
            if (endTime < fiveYearsAgo || endTime > oneYearLater) {
                return {
                    isValid: false,
                    reason: `endTime超出合理範圍: ${new Date(endTime).toISOString()}`
                };
            }
            
            // 4. K線數據範圍對齊檢查
            if (window.currentData?.data && window.currentData.data.length > 0) {
                const candleData = window.currentData.data;
                const firstCandleTime = candleData[0].time; // 保持秒級
                const lastCandleTime = candleData[candleData.length - 1].time; // 保持秒級
                
                // FVG時間戳應該在K線數據範圍的合理擴展內
                const timeBuffer = 24 * 60 * 60; // 1天緩衝（秒）
                const minAllowedTime = firstCandleTime - timeBuffer;
                const maxAllowedTime = lastCandleTime + (40 * 24 * 60 * 60); // 40天擴展（秒）
                
                if (startTime < minAllowedTime || startTime > maxAllowedTime) {
                    return {
                        isValid: false,
                        reason: `startTime超出K線數據範圍: ${new Date(startTime).toISOString()}`
                    };
                }
                
                if (endTime < minAllowedTime || endTime > maxAllowedTime) {
                    return {
                        isValid: false,
                        reason: `endTime超出K線數據範圍: ${new Date(endTime).toISOString()}`
                    };
                }
            }
            
            // 5. 時間跨度合理性檢查
            const timeSpan = endTime - startTime;
            const maxReasonableSpan = 60 * 24 * 60 * 60; // 60天（秒）
            
            if (timeSpan > maxReasonableSpan) {
                return {
                    isValid: false,
                    reason: `FVG時間跨度過大: ${Math.round(timeSpan / (24 * 60 * 60 * 1000))}天`
                };
            }
            
            // 通過所有檢查
            return {
                isValid: true,
                reason: 'timestamp validation passed',
                startTime,
                endTime,
                timeSpan: Math.round(timeSpan / (60 * 60 * 1000)) // 小時數
            };
            
        } catch (error) {
            return {
                isValid: false,
                reason: `時間戳驗證異常: ${error.message}`
            };
        }
    }
    
    /**
     * 錯誤隔離機制 - 檢查是否可以渲染
     */
    canRender() {
        // 檢查是否被禁用
        if (this.errorIsolation.isDisabled) {
            return false;
        }
        
        // 檢查錯誤冷卻時間
        const now = Date.now();
        if (now - this.errorIsolation.lastErrorTime < this.errorIsolation.errorCooldown) {
            return false;
        }
        
        return true;
    }
    
    /**
     * 處理非關鍵錯誤
     */
    handleError(context, error) {
        this.errorIsolation.errorCount++;
        this.errorIsolation.lastErrorTime = Date.now();
        
        console.warn(`⚠️ FVG渲染錯誤 [${context}]:`, error.message);
        console.warn(`   錯誤計數: ${this.errorIsolation.errorCount}/${this.errorIsolation.maxErrors}`);
        
        // 檢查是否達到臨界點
        if (this.errorIsolation.errorCount >= this.errorIsolation.criticalErrorThreshold) {
            console.warn(`🚨 FVG錯誤計數達到臨界值: ${this.errorIsolation.criticalErrorThreshold}`);
            
            if (this.errorIsolation.disableOnCritical) {
                this.disableRenderer('達到臨界錯誤數量');
            }
        }
        
        return false;
    }
    
    /**
     * 處理關鍵錯誤
     */
    handleCriticalError(context, error) {
        this.errorIsolation.errorCount += 3; // 關鍵錯誤權重更高
        this.errorIsolation.lastErrorTime = Date.now();
        
        console.error(`❌ FVG關鍵錯誤 [${context}]:`, error);
        console.error(`   錯誤計數: ${this.errorIsolation.errorCount}/${this.errorIsolation.maxErrors}`);
        
        // 立即禁用以保護圖表
        if (this.errorIsolation.disableOnCritical) {
            this.disableRenderer(`關鍵錯誤: ${error.message}`);
        }
        
        // 清除已創建的FVG以避免問題擴散
        try {
            this.clearFVGs();
        } catch (clearError) {
            console.error('❌ 清除FVG時發生錯誤:', clearError);
        }
        
        return false;
    }
    
    /**
     * 禁用渲染器
     */
    disableRenderer(reason) {
        this.errorIsolation.isDisabled = true;
        console.error(`🚫 FVG渲染器已禁用: ${reason}`);
        console.error('   如需重新啟用，請調用 enableRenderer() 方法');
        
        // 發送禁用事件（如果需要）
        if (typeof window !== 'undefined' && window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('fvgRendererDisabled', {
                detail: { reason, errorCount: this.errorIsolation.errorCount }
            }));
        }
    }
    
    /**
     * 重新啟用渲染器
     */
    enableRenderer() {
        this.errorIsolation.isDisabled = false;
        this.errorIsolation.errorCount = 0;
        this.errorIsolation.lastErrorTime = 0;
        
        console.log('✅ FVG渲染器已重新啟用');
        
        // 發送啟用事件（如果需要）
        if (typeof window !== 'undefined' && window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('fvgRendererEnabled'));
        }
    }
    
    /**
     * 獲取錯誤狀態
     */
    getErrorStatus() {
        return {
            isDisabled: this.errorIsolation.isDisabled,
            errorCount: this.errorIsolation.errorCount,
            maxErrors: this.errorIsolation.maxErrors,
            lastErrorTime: this.errorIsolation.lastErrorTime,
            canRender: this.canRender(),
            inCooldown: (Date.now() - this.errorIsolation.lastErrorTime) < this.errorIsolation.errorCooldown
        };
    }
    
    /**
     * 播放模式控制 - 啟用播放優化
     */
    enablePlaybackMode() {
        this.playbackOptimization.isPlaybackMode = true;
        this.playbackOptimization.playbackStartTime = Date.now();
        
        console.log('🎬 FVG播放模式已啟用');
        console.log('   - 簡化渲染: 啟用');
        console.log('   - 線條數量限制: 加強');
        console.log('   - 自動隱藏已清除FVG: 啟用');
        console.log(`   - 最大FVG數量: ${this.playbackOptimization.maxFVGsDuringPlayback}`);
        
        return true;
    }
    
    /**
     * 播放模式控制 - 禁用播放優化
     */
    disablePlaybackMode() {
        this.playbackOptimization.isPlaybackMode = false;
        this.playbackOptimization.playbackStartTime = 0;
        
        console.log('⏸️ FVG播放模式已禁用，恢復正常渲染');
        
        return false;
    }
    
    /**
     * 檢查播放模式狀態
     */
    isPlaybackMode() {
        return this.playbackOptimization.isPlaybackMode;
    }
    
    /**
     * 更新播放優化設置
     */
    setPlaybackSettings(settings) {
        const oldSettings = { ...this.playbackOptimization };
        
        if (settings.maxFVGsDuringPlayback !== undefined) {
            this.playbackOptimization.maxFVGsDuringPlayback = Math.max(5, Math.min(50, settings.maxFVGsDuringPlayback));
        }
        
        if (settings.simplifiedRendering !== undefined) {
            this.playbackOptimization.simplifiedRendering = settings.simplifiedRendering;
        }
        
        if (settings.reducedLineCount !== undefined) {
            this.playbackOptimization.reducedLineCount = settings.reducedLineCount;
        }
        
        if (settings.autoHideClearedFVGs !== undefined) {
            this.playbackOptimization.autoHideClearedFVGs = settings.autoHideClearedFVGs;
        }
        
        console.log('⚙️ 播放優化設置已更新:');
        console.log('   - 最大FVG數量:', this.playbackOptimization.maxFVGsDuringPlayback);
        console.log('   - 簡化渲染:', this.playbackOptimization.simplifiedRendering);
        console.log('   - 減少線條數量:', this.playbackOptimization.reducedLineCount);
        console.log('   - 自動隱藏已清除FVG:', this.playbackOptimization.autoHideClearedFVGs);
        
        return this.playbackOptimization;
    }
    
    /**
     * 獲取播放狀態
     */
    getPlaybackStatus() {
        return {
            isPlaybackMode: this.playbackOptimization.isPlaybackMode,
            maxFVGsDuringPlayback: this.playbackOptimization.maxFVGsDuringPlayback,
            simplifiedRendering: this.playbackOptimization.simplifiedRendering,
            reducedLineCount: this.playbackOptimization.reducedLineCount,
            autoHideClearedFVGs: this.playbackOptimization.autoHideClearedFVGs,
            playbackStartTime: this.playbackOptimization.playbackStartTime,
            playbackDuration: this.playbackOptimization.playbackStartTime > 0 ? 
                Date.now() - this.playbackOptimization.playbackStartTime : 0
        };
    }
    
    /**
     * 記憶體使用檢查
     */
    checkMemoryUsage() {
        const now = Date.now();
        
        // 檢查是否需要進行記憶體檢查
        if (now - this.memoryManagement.lastMemoryCheck < this.memoryManagement.memoryCheckInterval) {
            return;
        }
        
        this.memoryManagement.lastMemoryCheck = now;
        
        const currentSeriesCount = this.seriesIsolation.currentSeriesCount;
        const maxSeries = this.memoryManagement.maxTotalSeries;
        const usageRatio = currentSeriesCount / maxSeries;
        
        console.log(`🧠 記憶體使用檢查: ${currentSeriesCount}/${maxSeries} (${(usageRatio * 100).toFixed(1)}%)`);
        
        // 自動清理檢查
        if (this.memoryManagement.enableAutoCleanup) {
            if (usageRatio >= this.memoryManagement.forceCleanupThreshold) {
                console.warn(`🚨 記憶體使用超過強制清理閾值: ${(usageRatio * 100).toFixed(1)}%`);
                this.forceMemoryCleanup();
            } else if (usageRatio >= this.memoryManagement.autoCleanupThreshold) {
                console.warn(`⚠️ 記憶體使用超過自動清理閾值: ${(usageRatio * 100).toFixed(1)}%`);
                this.performMemoryCleanup();
            }
        }
        
        // 檢查老舊系列
        this.cleanupOldSeries();
    }
    
    /**
     * 執行記憶體清理
     */
    performMemoryCleanup() {
        const startTime = performance.now();
        const initialCount = this.seriesIsolation.currentSeriesCount;
        
        console.log('🧹 開始執行記憶體清理...');
        
        // 清理策略：移除一半的FVG
        const targetRemovalCount = Math.floor(this.fvgPrimitives.length / 2);
        const removedPrimitives = this.fvgPrimitives.splice(0, targetRemovalCount);
        
        removedPrimitives.forEach(primitive => {
            this.safeRemoveSeries(primitive);
        });
        
        const endTime = performance.now();
        const finalCount = this.seriesIsolation.currentSeriesCount;
        const cleanupRecord = {
            timestamp: Date.now(),
            type: 'auto',
            removed: initialCount - finalCount,
            duration: endTime - startTime,
            reason: '超過自動清理閾值'
        };
        
        this.memoryManagement.cleanupHistory.push(cleanupRecord);
        
        // 保持清理歷史記錄不超過10條
        if (this.memoryManagement.cleanupHistory.length > 10) {
            this.memoryManagement.cleanupHistory.shift();
        }
        
        console.log(`✅ 記憶體清理完成: 移除 ${cleanupRecord.removed} 個系列，耗時 ${cleanupRecord.duration.toFixed(2)}ms`);
    }
    
    /**
     * 強制記憶體清理
     */
    forceMemoryCleanup() {
        const startTime = performance.now();
        const initialCount = this.seriesIsolation.currentSeriesCount;
        
        console.warn('🚨 執行強制記憶體清理...');
        
        // 強制清理：移除所有FVG
        this.clearFVGs();
        
        const endTime = performance.now();
        const finalCount = this.seriesIsolation.currentSeriesCount;
        const cleanupRecord = {
            timestamp: Date.now(),
            type: 'force',
            removed: initialCount - finalCount,
            duration: endTime - startTime,
            reason: '超過強制清理閾值'
        };
        
        this.memoryManagement.cleanupHistory.push(cleanupRecord);
        
        console.warn(`⚡ 強制記憶體清理完成: 移除 ${cleanupRecord.removed} 個系列，耗時 ${cleanupRecord.duration.toFixed(2)}ms`);
    }
    
    /**
     * 清理老舊系列
     */
    cleanupOldSeries() {
        const now = Date.now();
        const ageLimit = this.memoryManagement.seriesAgeLimit;
        let removedCount = 0;
        
        // 檢查並移除超過年齡限制的系列
        for (const [series, metadata] of this.seriesMetadata.entries()) {
            if (now - metadata.createdAt > ageLimit) {
                // 找到並移除這個系列
                const index = this.fvgPrimitives.indexOf(series);
                if (index > -1) {
                    this.fvgPrimitives.splice(index, 1);
                    this.safeRemoveSeries(series);
                    removedCount++;
                }
            }
        }
        
        if (removedCount > 0) {
            console.log(`⏰ 清理老舊系列: 移除 ${removedCount} 個超過 ${ageLimit / 1000} 秒的系列`);
        }
    }
    
    /**
     * 獲取記憶體狀態
     */
    getMemoryStatus() {
        const currentSeriesCount = this.seriesIsolation.currentSeriesCount;
        const maxSeries = this.memoryManagement.maxTotalSeries;
        const usageRatio = currentSeriesCount / maxSeries;
        
        return {
            currentSeriesCount,
            maxSeries,
            usageRatio,
            usagePercentage: (usageRatio * 100).toFixed(1),
            metadataCount: this.seriesMetadata.size,
            primitiveCount: this.fvgPrimitives.length,
            enableAutoCleanup: this.memoryManagement.enableAutoCleanup,
            autoCleanupThreshold: this.memoryManagement.autoCleanupThreshold,
            forceCleanupThreshold: this.memoryManagement.forceCleanupThreshold,
            lastMemoryCheck: this.memoryManagement.lastMemoryCheck,
            cleanupHistory: [...this.memoryManagement.cleanupHistory]
        };
    }
    
    /**
     * 設置記憶體管理選項
     */
    setMemorySettings(settings) {
        if (settings.maxTotalSeries !== undefined) {
            this.memoryManagement.maxTotalSeries = Math.max(100, Math.min(5000, settings.maxTotalSeries));
        }
        
        if (settings.autoCleanupThreshold !== undefined) {
            this.memoryManagement.autoCleanupThreshold = Math.max(0.5, Math.min(0.95, settings.autoCleanupThreshold));
        }
        
        if (settings.forceCleanupThreshold !== undefined) {
            this.memoryManagement.forceCleanupThreshold = Math.max(0.8, Math.min(1.0, settings.forceCleanupThreshold));
        }
        
        if (settings.enableAutoCleanup !== undefined) {
            this.memoryManagement.enableAutoCleanup = settings.enableAutoCleanup;
        }
        
        if (settings.seriesAgeLimit !== undefined) {
            this.memoryManagement.seriesAgeLimit = Math.max(60000, Math.min(3600000, settings.seriesAgeLimit));
        }
        
        console.log('⚙️ 記憶體管理設置已更新:', {
            maxTotalSeries: this.memoryManagement.maxTotalSeries,
            autoCleanupThreshold: this.memoryManagement.autoCleanupThreshold,
            forceCleanupThreshold: this.memoryManagement.forceCleanupThreshold,
            enableAutoCleanup: this.memoryManagement.enableAutoCleanup,
            seriesAgeLimit: this.memoryManagement.seriesAgeLimit
        });
        
        return this.getMemoryStatus();
    }
    
    /**
     * 驗證FVG數據一致性
     */
    validateFVGDataConsistency(fvgs) {
        const errors = [];
        const warnings = [];
        
        if (!Array.isArray(fvgs)) {
            errors.push('FVG數據不是陣列格式');
            return { isValid: false, errors, warnings };
        }
        
        console.log(`🔍 開始檢查 ${fvgs.length} 個FVG的數據一致性`);
        
        // 調試：顯示第一個FVG的完整數據結構
        if (fvgs.length > 0) {
            console.log('🔍 第一個FVG數據結構調試:', fvgs[0]);
        }
        
        // 調試：檢查K線數據的時間格式
        if (window.currentData?.data && window.currentData.data.length > 0) {
            const firstCandle = window.currentData.data[0];
            const lastCandle = window.currentData.data[window.currentData.data.length - 1];
            console.log('📅 K線時間格式調試:');
            console.log('   - 第一根K線:', firstCandle);
            console.log('   - 最後一根K線:', lastCandle);
            console.log('   - 第一根K線時間戳:', firstCandle.time, typeof firstCandle.time);
            console.log('   - 最後一根K線時間戳:', lastCandle.time, typeof lastCandle.time);
            console.log('   - 第一根K線日期:', new Date(firstCandle.time * 1000).toLocaleString());
            console.log('   - 最後一根K線日期:', new Date(lastCandle.time * 1000).toLocaleString());
        }
        
        // 統計數據
        const stats = {
            totalFVGs: fvgs.length,
            validFVGs: 0,
            clearedFVGs: 0,
            invalidFVGs: 0,
            bullishFVGs: 0,
            bearishFVGs: 0,
            missingData: 0,
            timeErrors: 0,
            priceErrors: 0
        };
        
        fvgs.forEach((fvg, index) => {
            // 1. 基本字段檢查
            const requiredFields = ['type', 'status', 'startTime', 'endTime'];
            const missingFields = requiredFields.filter(field => fvg[field] === undefined || fvg[field] === null);
            
            if (missingFields.length > 0) {
                errors.push(`FVG[${index}] 缺少必需字段: ${missingFields.join(', ')}`);
                stats.missingData++;
                return;
            }
            
            // 2. 類型驗證
            if (!['bullish', 'bearish'].includes(fvg.type)) {
                errors.push(`FVG[${index}] 類型無效: ${fvg.type}`);
                stats.invalidFVGs++;
                return;
            }
            
            // 3. 狀態驗證
            if (!['valid', 'cleared'].includes(fvg.status)) {
                errors.push(`FVG[${index}] 狀態無效: ${fvg.status}`);
                stats.invalidFVGs++;
                return;
            }
            
            // 4. 價格字段檢查 - 兼容多種格式
            const priceFields = ['topPrice', 'bottomPrice', 'startPrice', 'endPrice'];
            const hasPrice = priceFields.some(field => 
                fvg[field] !== undefined && fvg[field] !== null && typeof fvg[field] === 'number'
            );
            
            // 後端格式適配檢查
            const hasBackendFormat = (fvg.startPrice !== undefined && fvg.endPrice !== undefined);
            const hasFrontendFormat = (fvg.topPrice !== undefined && fvg.bottomPrice !== undefined);
            
            if (!hasPrice && !hasBackendFormat && !hasFrontendFormat) {
                errors.push(`FVG[${index}] 缺少有效的價格數據`);
                stats.priceErrors++;
                return;
            }
            
            // 5. 時間戳驗證 - 使用智能修復後驗證
            const fixedStartTime = this.fixTimestamp(fvg.startTime, `FVG[${index}].startTime`);
            const fixedEndTime = this.fixTimestamp(fvg.endTime, `FVG[${index}].endTime`);
            
            const timeValidation = this.validateSingleFVGTime({
                ...fvg,
                startTime: fixedStartTime,
                endTime: fixedEndTime
            }, index);
            
            if (!timeValidation.isValid) {
                // 時間修復後仍然無效，記錄警告但不阻止渲染
                warnings.push(`FVG[${index}] 時間驗證警告: ${timeValidation.reason}`);
                // 不增加timeErrors計數，允許繼續處理
            }
            
            // 6. 價格邏輯驗證 - 適配後端格式
            let checkTopPrice, checkBottomPrice;
            
            if (fvg.topPrice !== undefined && fvg.bottomPrice !== undefined) {
                checkTopPrice = fvg.topPrice;
                checkBottomPrice = fvg.bottomPrice;
            } else if (fvg.startPrice !== undefined && fvg.endPrice !== undefined) {
                if (fvg.type === 'bullish') {
                    checkTopPrice = fvg.endPrice;
                    checkBottomPrice = fvg.startPrice;
                } else if (fvg.type === 'bearish') {
                    checkTopPrice = fvg.startPrice;
                    checkBottomPrice = fvg.endPrice;
                } else {
                    checkTopPrice = Math.max(fvg.startPrice, fvg.endPrice);
                    checkBottomPrice = Math.min(fvg.startPrice, fvg.endPrice);
                }
            }
            
            if (checkTopPrice !== undefined && checkBottomPrice !== undefined) {
                if (checkTopPrice <= checkBottomPrice) {
                    warnings.push(`FVG[${index}] 價格邏輯異常: topPrice (${checkTopPrice}) <= bottomPrice (${checkBottomPrice})`);
                    stats.priceErrors++;
                }
            }
            
            // 統計有效FVG
            if (fvg.status === 'valid') stats.validFVGs++;
            else if (fvg.status === 'cleared') stats.clearedFVGs++;
            
            if (fvg.type === 'bullish') stats.bullishFVGs++;
            else if (fvg.type === 'bearish') stats.bearishFVGs++;
        });
        
        // 7. 數據合理性檢查
        if (stats.validFVGs === 0 && stats.clearedFVGs === 0) {
            warnings.push('沒有有效的FVG數據可渲染');
        }
        
        if (stats.invalidFVGs > stats.totalFVGs * 0.5) {
            errors.push(`無效FVG數量過多: ${stats.invalidFVGs}/${stats.totalFVGs}`);
        }
        
        // 8. 性能檢查
        if (stats.totalFVGs > 1000) {
            warnings.push(`FVG數量過多: ${stats.totalFVGs}，可能影響性能`);
        }
        
        // 9. 時間範圍檢查（使用修復後的時間戳）
        const fvgsWithFixedTime = fvgs.map(fvg => ({
            ...fvg,
            startTime: this.fixTimestamp(fvg.startTime, 'range-check-start'),
            endTime: this.fixTimestamp(fvg.endTime, 'range-check-end')
        }));
        this.validateFVGTimeRange(fvgsWithFixedTime, errors, warnings);
        
        console.log('📊 FVG數據一致性檢查統計:', stats);
        
        if (warnings.length > 0) {
            console.warn('⚠️ FVG數據一致性警告:', warnings);
        }
        
        const isValid = errors.length === 0;
        
        return {
            isValid,
            errors,
            warnings,
            stats
        };
    }
    
    /**
     * 驗證單個FVG的時間數據
     */
    validateSingleFVGTime(fvg, index) {
        try {
            // 檢查時間戳類型
            if (typeof fvg.startTime !== 'number' || typeof fvg.endTime !== 'number') {
                return {
                    isValid: false,
                    reason: `時間戳類型錯誤: startTime=${typeof fvg.startTime}, endTime=${typeof fvg.endTime}`
                };
            }
            
            // 檢查時間戳範圍
            const minTime = new Date('2019-01-01').getTime();
            const maxTime = new Date('2030-01-01').getTime();
            
            // 處理可能的秒轉毫秒
            // 直接使用秒級時間戳，不做任何轉換
            let startTime = fvg.startTime;
            let endTime = fvg.endTime;
            
            if (startTime < minTime || startTime > maxTime) {
                return {
                    isValid: false,
                    reason: `startTime超出合理範圍: ${new Date(startTime).toISOString()}`
                };
            }
            
            if (endTime < minTime || endTime > maxTime) {
                return {
                    isValid: false,
                    reason: `endTime超出合理範圍: ${new Date(endTime).toISOString()}`
                };
            }
            
            // 檢查時間邏輯
            if (startTime >= endTime) {
                return {
                    isValid: false,
                    reason: `時間邏輯錯誤: startTime >= endTime`
                };
            }
            
            // 檢查時間跨度
            const timeSpan = endTime - startTime;
            const maxReasonableSpan = 60 * 24 * 60 * 60; // 60天（秒）
            
            if (timeSpan > maxReasonableSpan) {
                return {
                    isValid: false,
                    reason: `時間跨度過大: ${Math.round(timeSpan / (24 * 60 * 60 * 1000))}天`
                };
            }
            
            return { isValid: true };
            
        } catch (error) {
            return {
                isValid: false,
                reason: `時間驗證異常: ${error.message}`
            };
        }
    }
    
    /**
     * 驗證FVG時間範圍與K線數據的一致性
     */
    validateFVGTimeRange(fvgs, errors, warnings) {
        // 檢查是否有K線數據作為參考
        if (!window.currentData?.data || window.currentData.data.length === 0) {
            warnings.push('缺少K線數據，無法驗證時間範圍一致性');
            return;
        }
        
        const candleData = window.currentData.data;
        const firstCandleTime = candleData[0].time * 1000;
        const lastCandleTime = candleData[candleData.length - 1].time * 1000;
        
        let outOfRangeCount = 0;
        
        fvgs.forEach((fvg, index) => {
            let startTime = fvg.startTime;
            let endTime = fvg.endTime;
            
            // 處理時間戳格式
            // 直接使用秒級時間戳，不做任何轉換
            // startTime 和 endTime 應該已經是秒級時間戳
            
            // 檢查是否在K線數據範圍內（允許更大的合理擴展）
            const timeBuffer = 30 * 24 * 60 * 60 * 1000; // 30天緩衝
            const minAllowedTime = firstCandleTime - timeBuffer;
            const maxAllowedTime = lastCandleTime + (120 * 24 * 60 * 60 * 1000); // 120天擴展（L+40根K線可能很遠）
            
            if (startTime < minAllowedTime || endTime > maxAllowedTime) {
                outOfRangeCount++;
            }
        });
        
        if (outOfRangeCount > 0) {
            if (outOfRangeCount > fvgs.length * 0.5) {
                errors.push(`大量FVG時間範圍超出K線數據範圍: ${outOfRangeCount}/${fvgs.length}`);
            } else {
                warnings.push(`部分FVG時間範圍超出K線數據範圍: ${outOfRangeCount}/${fvgs.length}`);
            }
        }
    }
    
    /**
     * 獲取數據一致性狀態
     */
    getDataConsistencyStatus() {
        // 檢查當前數據
        const currentData = window.currentData || window.app?.dataManager?.currentData;
        
        if (!currentData) {
            return {
                hasData: false,
                error: '沒有可用的數據源'
            };
        }
        
        const fvgs = currentData.fvgs || [];
        const validation = this.validateFVGDataConsistency(fvgs);
        
        return {
            hasData: true,
            fvgCount: fvgs.length,
            validation,
            lastCheck: Date.now()
        };
    }
    
    /**
     * 智能時間戳修復 - 處理各種異常時間戳格式
     */
    fixTimestamp(timestamp, field = 'timestamp') {
        if (typeof timestamp !== 'number') {
            console.warn(`⚠️ ${field}不是數字: ${timestamp}, 使用當前時間`);
            return Date.now();
        }
        
        // 正常的Unix時間戳(秒) - 轉換為毫秒
        if (timestamp > 1000000000 && timestamp < 2000000000) {
            const result = Math.floor(timestamp * 1000);
            console.log(`✅ ${field}正常轉換(秒->毫秒): ${timestamp} -> ${result}`);
            return result;
        }
        
        // 已經是毫秒時間戳
        if (timestamp > 1000000000000 && timestamp < 2000000000000) {
            const result = Math.floor(timestamp);
            console.log(`✅ ${field}已是毫秒: ${result}`);
            return result;
        }
        
        // 異常小的時間戳 - 可能是相對時間或索引
        if (timestamp > 0 && timestamp < 1000000) {
            console.warn(`⚠️ 檢測到異常小的${field}: ${timestamp}`);
            
            // 嘗試基於K線數據時間範圍進行修復
            if (window.currentData?.data && window.currentData.data.length > 0) {
                const candleData = window.currentData.data;
                const firstCandleTime = candleData[0].time * 1000;
                const lastCandleTime = candleData[candleData.length - 1].time; // 保持秒級
                
                // 改進時間戳映射邏輯 - 基於整數部分作為索引
                const candleCount = candleData.length;
                let estimatedTime;
                
                // 改進的索引映射邏輯
                // timestamp值像 1.704521 可能表示相對位置
                const ratio = timestamp % 1; // 取小數部分 0.704521
                
                if (ratio > 0) {
                    // 使用小數部分作為在K線範圍內的比例位置
                    const timeRange = lastCandleTime - firstCandleTime;
                    estimatedTime = firstCandleTime + (timeRange * ratio);
                    console.warn(`🔧 ${field}比例映射: ${timestamp} -> ratio=${ratio.toFixed(6)} -> ${estimatedTime}`);
                } else {
                    // 如果是整數，可能是索引
                    const index = Math.floor(timestamp);
                    const clampedIndex = Math.max(0, Math.min(index, candleCount - 1));
                    estimatedTime = candleData[clampedIndex].time * 1000;
                    console.warn(`🔧 ${field}索引映射: ${timestamp} -> index=${clampedIndex} -> ${estimatedTime}`);
                }
                
                return Math.floor(estimatedTime);
            }
            
            // 如果沒有K線數據，使用最近的時間
            const fallbackTime = Date.now() - (Math.random() * 30 * 24 * 60 * 60 * 1000); // 最近30天內隨機時間
            console.warn(`🔧 ${field}降級修復: ${timestamp} -> ${fallbackTime} (隨機最近時間)`);
            return Math.floor(fallbackTime);
        }
        
        // 其他異常情況
        console.error(`❌ ${field}完全異常: ${timestamp}, 使用當前時間`);
        return Date.now();
    }
}

// 暴露到全局範圍
window.FVGRendererMultiline = FVGRendererMultiline;

console.log('📦 FVGRendererMultiline 模組載入完成');