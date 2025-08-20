// 檔名：error-monitor.js - 錯誤監控和報告系統

class ErrorMonitor {
    constructor() {
        this.errors = [];
        this.nullValueErrors = [];
        this.chartErrors = [];
        this.isEnabled = true;
        this.maxErrors = 100; // 最多保留100個錯誤記錄
        
        this.setupGlobalErrorHandlers();
        console.log('🔍 ErrorMonitor已初始化');
    }

    /**
     * 設置全域錯誤處理器
     */
    setupGlobalErrorHandlers() {
        // 捕獲未處理的JavaScript錯誤
        window.addEventListener('error', (event) => {
            this.logError('GLOBAL_ERROR', {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                error: event.error,
                stack: event.error ? event.error.stack : null
            });
        });

        // 捕獲未處理的Promise拒絕
        window.addEventListener('unhandledrejection', (event) => {
            this.logError('UNHANDLED_PROMISE', {
                reason: event.reason,
                promise: event.promise,
                stack: event.reason && event.reason.stack ? event.reason.stack : null
            });
        });

        // 重寫console.error以捕獲特定錯誤
        const originalConsoleError = console.error;
        console.error = (...args) => {
            // 檢查是否包含 "Value is null" 錯誤
            const errorText = args.join(' ');
            if (errorText.includes('Value is null')) {
                this.logNullValueError(errorText, args);
            }
            
            // 檢查是否是圖表相關錯誤
            if (errorText.includes('LightweightCharts') || errorText.includes('chart')) {
                this.logChartError(errorText, args);
            }

            // 調用原始的console.error
            originalConsoleError.apply(console, args);
        };
    }

    /**
     * 記錄一般錯誤
     */
    logError(type, details) {
        const errorRecord = {
            id: Date.now() + Math.random(),
            timestamp: new Date().toISOString(),
            type,
            details,
            url: window.location.href,
            userAgent: navigator.userAgent
        };

        this.errors.push(errorRecord);
        this.trimErrorList(this.errors);

        console.group(`🚨 ErrorMonitor - ${type}`);
        console.error('時間:', errorRecord.timestamp);
        console.error('詳情:', details);
        console.groupEnd();
    }

    /**
     * 記錄 "Value is null" 錯誤
     */
    logNullValueError(errorText, originalArgs) {
        const nullError = {
            id: Date.now() + Math.random(),
            timestamp: new Date().toISOString(),
            message: errorText,
            args: originalArgs,
            stackTrace: new Error().stack,
            context: this.getCurrentContext()
        };

        this.nullValueErrors.push(nullError);
        this.trimErrorList(this.nullValueErrors);

        console.group('🔴 NULL VALUE ERROR DETECTED');
        console.error('⚠️ 檢測到 "Value is null" 錯誤!');
        console.error('錯誤訊息:', errorText);
        console.error('發生時間:', nullError.timestamp);
        console.error('當前上下文:', nullError.context);
        console.error('堆疊追踪:', nullError.stackTrace);
        console.groupEnd();

        // 觸發詳細診斷
        this.triggerNullValueDiagnostics();
    }

    /**
     * 記錄圖表相關錯誤
     */
    logChartError(errorText, originalArgs) {
        const chartError = {
            id: Date.now() + Math.random(),
            timestamp: new Date().toISOString(),
            message: errorText,
            args: originalArgs,
            chartState: this.getChartState(),
            dataState: this.getDataState()
        };

        this.chartErrors.push(chartError);
        this.trimErrorList(this.chartErrors);

        console.group('📊 CHART ERROR DETECTED');
        console.error('圖表錯誤:', errorText);
        console.error('圖表狀態:', chartError.chartState);
        console.error('數據狀態:', chartError.dataState);
        console.groupEnd();
    }

    /**
     * 觸發 null 值診斷
     */
    triggerNullValueDiagnostics() {
        console.group('🔍 NULL VALUE 診斷開始');
        
        try {
            // 檢查全域變數狀態
            console.log('全域變數狀態:');
            console.log('- currentData:', window.currentData ? '存在' : '不存在');
            console.log('- chartManager:', window.chartManager ? '存在' : '不存在');
            console.log('- dataManager:', window.dataManager ? '存在' : '不存在');

            // 檢查當前數據
            if (window.currentData) {
                console.log('currentData詳情:');
                console.log('- date:', window.currentData.date);
                console.log('- data陣列長度:', window.currentData.data ? window.currentData.data.length : '不存在');
                console.log('- fvgs長度:', window.currentData.fvgs ? window.currentData.fvgs.length : '不存在');
                
                // 檢查前幾筆數據
                if (window.currentData.data && window.currentData.data.length > 0) {
                    const firstItem = window.currentData.data[0];
                    const hasNullFields = Object.entries(firstItem).filter(([key, value]) => value === null);
                    if (hasNullFields.length > 0) {
                        console.error('❌ 發現null字段:', hasNullFields);
                    } else {
                        console.log('✅ 第一筆數據看起來正常:', firstItem);
                    }
                }
            }

            // 檢查圖表狀態
            if (window.chartManager && window.chartManager.chart) {
                console.log('圖表狀態: 已初始化');
                console.log('K線系列:', window.chartManager.candlestickSeries ? '存在' : '不存在');
            }

            // 運行數據驗證器
            if (window.dataValidator) {
                console.log('🔧 運行完整數據驗證...');
                const report = window.dataValidator.getValidationReport();
                console.log('驗證報告:', report);
            }

        } catch (diagnosticError) {
            console.error('❌ 診斷過程中發生錯誤:', diagnosticError);
        }
        
        console.groupEnd();
    }

    /**
     * 獲取當前上下文資訊
     */
    getCurrentContext() {
        return {
            url: window.location.href,
            timestamp: new Date().toISOString(),
            hasCurrentData: !!window.currentData,
            hasChartManager: !!window.chartManager,
            hasDataManager: !!window.dataManager,
            chartInitialized: !!(window.chartManager && window.chartManager.chart),
            dataValidatorAvailable: !!window.dataValidator
        };
    }

    /**
     * 獲取圖表狀態
     */
    getChartState() {
        if (!window.chartManager) return { status: 'chartManager不存在' };
        
        return {
            hasChart: !!window.chartManager.chart,
            hasCandlestickSeries: !!window.chartManager.candlestickSeries,
            hasFvgRenderer: !!window.chartManager.fvgRenderer,
            chartVersion: window.chartManager.chartVersion || 'unknown'
        };
    }

    /**
     * 獲取數據狀態
     */
    getDataState() {
        if (!window.currentData) return { status: '無當前數據' };
        
        const data = window.currentData;
        return {
            hasData: !!data.data,
            dataLength: data.data ? data.data.length : 0,
            hasFvgs: !!data.fvgs,
            fvgLength: data.fvgs ? data.fvgs.length : 0,
            date: data.date,
            firstItemSample: data.data && data.data.length > 0 ? data.data[0] : null
        };
    }

    /**
     * 修剪錯誤列表以避免記憶體洩漏
     */
    trimErrorList(errorList) {
        if (errorList.length > this.maxErrors) {
            errorList.splice(0, errorList.length - this.maxErrors);
        }
    }

    /**
     * 獲取錯誤報告
     */
    getErrorReport() {
        return {
            summary: {
                totalErrors: this.errors.length,
                nullValueErrors: this.nullValueErrors.length,
                chartErrors: this.chartErrors.length,
                lastErrorTime: this.errors.length > 0 ? this.errors[this.errors.length - 1].timestamp : null
            },
            nullValueErrors: this.nullValueErrors.slice(-10), // 最近10個
            chartErrors: this.chartErrors.slice(-10),
            allErrors: this.errors.slice(-20) // 最近20個所有錯誤
        };
    }

    /**
     * 清除錯誤記錄
     */
    clearErrors() {
        this.errors = [];
        this.nullValueErrors = [];
        this.chartErrors = [];
        console.log('🧹 ErrorMonitor: 錯誤記錄已清除');
    }

    /**
     * 生成診斷報告
     */
    generateDiagnosticReport() {
        const report = {
            timestamp: new Date().toISOString(),
            context: this.getCurrentContext(),
            chartState: this.getChartState(),
            dataState: this.getDataState(),
            errorSummary: this.getErrorReport().summary,
            validationReport: window.dataValidator ? window.dataValidator.getValidationReport() : null
        };

        console.group('📋 系統診斷報告');
        console.table(report.context);
        console.table(report.chartState);
        console.table(report.dataState);
        console.log('錯誤統計:', report.errorSummary);
        if (report.validationReport) {
            console.log('數據驗證:', report.validationReport.summary);
        }
        console.groupEnd();

        return report;
    }
}

// 建立全域實例
window.errorMonitor = new ErrorMonitor();

// 暴露到全域範圍
window.ErrorMonitor = ErrorMonitor;