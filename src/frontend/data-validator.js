// 檔名：data-validator.js - 數據驗證和診斷工具

class DataValidator {
    constructor() {
        this.errorCount = 0;
        this.validationHistory = [];
        this.enableLogging = true;
    }

    /**
     * 驗證 K線數據
     */
    validateCandleData(data, source = 'Unknown') {
        const checkPoint = `CHECKPOINT-CANDLE-${source}`;
        console.log(`🔍 ${checkPoint}: 開始驗證K線數據`);
        
        const validation = {
            source,
            timestamp: new Date().toISOString(),
            totalCount: 0,
            validCount: 0,
            errors: [],
            warnings: [],
            sample: null
        };

        if (!data) {
            validation.errors.push('數據為空或undefined');
            this.logValidation(checkPoint, validation);
            return validation;
        }

        if (!Array.isArray(data)) {
            validation.errors.push(`數據不是陣列，類型: ${typeof data}`);
            this.logValidation(checkPoint, validation);
            return validation;
        }

        validation.totalCount = data.length;
        console.log(`📊 ${checkPoint}: 總計 ${validation.totalCount} 筆數據`);

        // 檢查每一筆數據
        for (let i = 0; i < data.length; i++) {
            const candle = data[i];
            const candleErrors = this.validateSingleCandle(candle, i);
            
            if (candleErrors.length === 0) {
                validation.validCount++;
            } else {
                validation.errors.push(...candleErrors);
                
                // 記錄前5個錯誤詳情
                if (validation.errors.length <= 5) {
                    console.error(`❌ ${checkPoint}: 第${i}根K線錯誤:`, candleErrors, candle);
                }
            }
        }

        // 取樣本數據
        validation.sample = {
            first: data[0],
            last: data[data.length - 1],
            middle: data[Math.floor(data.length / 2)]
        };

        this.logValidation(checkPoint, validation);
        return validation;
    }

    /**
     * 驗證單根K線
     */
    validateSingleCandle(candle, index) {
        const errors = [];

        if (!candle) {
            errors.push(`第${index}根K線為null或undefined`);
            return errors;
        }

        // 檢查必要欄位
        const requiredFields = ['time', 'open', 'high', 'low', 'close'];
        const optionalFields = ['volume', 'vwap'];

        for (const field of requiredFields) {
            if (candle[field] === null || candle[field] === undefined) {
                errors.push(`第${index}根K線 ${field} 為 null/undefined`);
            } else if (field !== 'time' && (isNaN(candle[field]) || !isFinite(candle[field]))) {
                errors.push(`第${index}根K線 ${field} 不是有效數字: ${candle[field]}`);
            }
        }

        // 檢查時間格式
        if (candle.time !== null && candle.time !== undefined) {
            if (typeof candle.time !== 'number' || candle.time <= 0) {
                errors.push(`第${index}根K線時間格式錯誤: ${candle.time} (類型: ${typeof candle.time})`);
            }
        }

        // 檢查價格邏輯
        if (candle.high !== null && candle.low !== null && candle.high < candle.low) {
            errors.push(`第${index}根K線 high < low: ${candle.high} < ${candle.low}`);
        }

        return errors;
    }

    /**
     * 驗證 FVG 數據
     */
    validateFVGData(fvgs, source = 'Unknown') {
        const checkPoint = `CHECKPOINT-FVG-${source}`;
        console.log(`🔍 ${checkPoint}: 開始驗證FVG數據`);

        const validation = {
            source,
            timestamp: new Date().toISOString(),
            totalCount: 0,
            validCount: 0,
            errors: [],
            warnings: []
        };

        if (!fvgs) {
            validation.warnings.push('FVG數據為空');
            this.logValidation(checkPoint, validation);
            return validation;
        }

        if (!Array.isArray(fvgs)) {
            validation.errors.push(`FVG不是陣列，類型: ${typeof fvgs}`);
            this.logValidation(checkPoint, validation);
            return validation;
        }

        validation.totalCount = fvgs.length;

        for (let i = 0; i < fvgs.length; i++) {
            const fvg = fvgs[i];
            const fvgErrors = this.validateSingleFVG(fvg, i);
            
            if (fvgErrors.length === 0) {
                validation.validCount++;
            } else {
                validation.errors.push(...fvgErrors);
            }
        }

        this.logValidation(checkPoint, validation);
        return validation;
    }

    /**
     * 驗證單個 FVG
     */
    validateSingleFVG(fvg, index) {
        const errors = [];

        if (!fvg) {
            errors.push(`第${index}個FVG為null或undefined`);
            return errors;
        }

        // 檢查必要欄位
        const requiredFields = ['startTime', 'endTime'];
        for (const field of requiredFields) {
            if (fvg[field] === null || fvg[field] === undefined) {
                errors.push(`第${index}個FVG ${field} 為 null/undefined`);
            }
        }

        // 檢查價格欄位 (可能有不同的命名)
        const priceFields = ['topPrice', 'bottomPrice', 'startPrice', 'endPrice'];
        let hasPriceField = false;
        for (const field of priceFields) {
            if (fvg[field] !== null && fvg[field] !== undefined) {
                hasPriceField = true;
                if (isNaN(fvg[field]) || !isFinite(fvg[field])) {
                    errors.push(`第${index}個FVG ${field} 不是有效數字: ${fvg[field]}`);
                }
            }
        }

        if (!hasPriceField) {
            errors.push(`第${index}個FVG 缺少價格欄位 (${priceFields.join(', ')})`);
        }

        return errors;
    }

    /**
     * 記錄驗證結果
     */
    logValidation(checkPoint, validation) {
        this.validationHistory.push(validation);
        
        const hasErrors = validation.errors.length > 0;
        const status = hasErrors ? '❌ 失敗' : '✅ 通過';
        
        console.log(`📋 ${checkPoint} ${status}`);
        console.log(`   總數: ${validation.totalCount}, 有效: ${validation.validCount}, 錯誤: ${validation.errors.length}`);
        
        if (hasErrors) {
            this.errorCount++;
            console.group(`🔴 ${checkPoint} 錯誤詳情:`);
            validation.errors.forEach((error, i) => {
                if (i < 10) { // 只顯示前10個錯誤
                    console.error(`${i + 1}. ${error}`);
                }
            });
            if (validation.errors.length > 10) {
                console.error(`... 還有 ${validation.errors.length - 10} 個錯誤`);
            }
            console.groupEnd();
        }
    }

    /**
     * 獲取驗證報告
     */
    getValidationReport() {
        return {
            totalValidations: this.validationHistory.length,
            errorCount: this.errorCount,
            validationHistory: this.validationHistory,
            summary: this.generateSummary()
        };
    }

    /**
     * 生成摘要
     */
    generateSummary() {
        const summary = {
            candleValidations: 0,
            fvgValidations: 0,
            totalErrors: 0,
            commonErrors: {}
        };

        this.validationHistory.forEach(v => {
            if (v.source.includes('CANDLE')) {
                summary.candleValidations++;
            } else if (v.source.includes('FVG')) {
                summary.fvgValidations++;
            }

            summary.totalErrors += v.errors.length;

            // 統計常見錯誤
            v.errors.forEach(error => {
                const errorType = this.categorizeError(error);
                summary.commonErrors[errorType] = (summary.commonErrors[errorType] || 0) + 1;
            });
        });

        return summary;
    }

    /**
     * 錯誤分類
     */
    categorizeError(error) {
        if (error.includes('null/undefined')) return 'NULL_VALUES';
        if (error.includes('不是有效數字')) return 'INVALID_NUMBERS';
        if (error.includes('時間格式錯誤')) return 'TIME_FORMAT';
        if (error.includes('high < low')) return 'PRICE_LOGIC';
        if (error.includes('不是陣列')) return 'ARRAY_TYPE';
        return 'OTHER';
    }

    /**
     * 清除歷史記錄
     */
    clearHistory() {
        this.validationHistory = [];
        this.errorCount = 0;
    }
}

// 建立全域實例
window.dataValidator = new DataValidator();

// 暴露到全域範圍
window.DataValidator = DataValidator;