/**
 * 統一Logger系統 - 智能載入系統的一部分
 * 
 * 提供統一的日誌管理和輸出控制
 * 支持不同級別的日誌和載入模式適配
 */

class Logger {
    constructor() {
        this.level = this.detectLogLevel();
        this.enableTimestamp = true;
        this.enableGrouping = true;
        this.maxLogHistory = 1000;
        this.logHistory = [];
        
        // 日誌級別定義
        this.levels = {
            debug: 0,
            info: 1,
            warn: 2,
            error: 3,
            silent: 4
        };
        
        // 載入模式對應的日誌級別
        this.modeLogLevels = {
            production: 'warn',
            debug: 'debug',
            development: 'info'
        };
        
        // 顏色配置
        this.colors = {
            debug: '#888',
            info: '#4CAF50',
            warn: '#FF9800', 
            error: '#F44336',
            loading: '#2196F3',
            success: '#4CAF50',
            system: '#9C27B0'
        };
        
        this.init();
    }
    
    /**
     * 檢測日誌級別
     */
    detectLogLevel() {
        // 檢查URL參數
        const urlParams = new URLSearchParams(window.location.search);
        const debugParam = urlParams.get('debug');
        const logLevel = urlParams.get('log');
        
        if (logLevel && this.levels.hasOwnProperty(logLevel)) {
            return logLevel;
        }
        
        if (debugParam === 'true') {
            return 'debug';
        }
        
        // 根據載入模式決定
        const loadingMode = this.detectLoadingMode();
        return this.modeLogLevels[loadingMode] || 'info';
    }
    
    /**
     * 檢測載入模式 (複用邏輯)
     */
    detectLoadingMode() {
        const urlParams = new URLSearchParams(window.location.search);
        const urlMode = urlParams.get('mode');
        
        if (urlMode === 'debug') return 'debug';
        if (urlMode === 'dev' || urlMode === 'development') return 'development';
        if (urlMode === 'production') return 'production';
        
        const savedMode = localStorage.getItem('smartLoadingMode');
        if (savedMode && ['production', 'debug', 'development'].includes(savedMode)) {
            return savedMode;
        }
        
        return 'production';
    }
    
    /**
     * 初始化Logger
     */
    init() {
        const mode = this.detectLoadingMode();
        this.info(`📋 Logger初始化 (模式: ${mode}, 級別: ${this.level})`);
        
        // 在調試模式下顯示更多信息
        if (this.level === 'debug') {
            this.debug('Logger配置:', {
                level: this.level,
                loadingMode: mode,
                timestamp: this.enableTimestamp,
                grouping: this.enableGrouping,
                historyLimit: this.maxLogHistory
            });
        }
    }
    
    /**
     * 檢查是否應該輸出該級別的日誌
     */
    shouldLog(level) {
        return this.levels[level] >= this.levels[this.level];
    }
    
    /**
     * 格式化時間戳
     */
    formatTimestamp() {
        if (!this.enableTimestamp) return '';
        const now = new Date();
        return `[${now.toLocaleTimeString()}.${now.getMilliseconds().toString().padStart(3, '0')}]`;
    }
    
    /**
     * 記錄日誌到歷史
     */
    recordToHistory(level, message, data) {
        this.logHistory.push({
            timestamp: Date.now(),
            level,
            message,
            data
        });
        
        // 限制歷史記錄數量
        if (this.logHistory.length > this.maxLogHistory) {
            this.logHistory = this.logHistory.slice(-this.maxLogHistory);
        }
    }
    
    /**
     * 核心日誌輸出方法
     */
    log(level, message, data = null, style = '') {
        if (!this.shouldLog(level)) return;
        
        const timestamp = this.formatTimestamp();
        const color = this.colors[level] || '#fff';
        
        this.recordToHistory(level, message, data);
        
        const consoleMethod = level === 'warn' ? 'warn' : 
                            level === 'error' ? 'error' : 'log';
        
        if (data !== null) {
            console[consoleMethod](
                `%c${timestamp} ${message}`,
                `color: ${color}; ${style}`,
                data
            );
        } else {
            console[consoleMethod](
                `%c${timestamp} ${message}`,
                `color: ${color}; ${style}`
            );
        }
    }
    
    /**
     * 調試級別日誌
     */
    debug(message, data = null) {
        this.log('debug', `🔍 ${message}`, data);
    }
    
    /**
     * 信息級別日誌
     */
    info(message, data = null) {
        this.log('info', `ℹ️ ${message}`, data);
    }
    
    /**
     * 警告級別日誌
     */
    warn(message, data = null) {
        this.log('warn', `⚠️ ${message}`, data);
    }
    
    /**
     * 錯誤級別日誌
     */
    error(message, data = null) {
        this.log('error', `❌ ${message}`, data);
    }
    
    /**
     * 載入專用日誌
     */
    loading(message, data = null) {
        this.log('info', `📦 ${message}`, data, 'font-weight: bold;');
    }
    
    /**
     * 成功專用日誌
     */
    success(message, data = null) {
        this.log('info', `✅ ${message}`, data, 'font-weight: bold;');
    }
    
    /**
     * 系統專用日誌
     */
    system(message, data = null) {
        this.log('info', `🔧 ${message}`, data, 'font-weight: bold;');
    }
    
    /**
     * 性能測量開始
     */
    timeStart(label) {
        if (this.shouldLog('debug')) {
            console.time(label);
            this.debug(`⏱️ 開始測量: ${label}`);
        }
    }
    
    /**
     * 性能測量結束
     */
    timeEnd(label) {
        if (this.shouldLog('debug')) {
            console.timeEnd(label);
            this.debug(`⏱️ 結束測量: ${label}`);
        }
    }
    
    /**
     * 分組開始
     */
    groupStart(label, collapsed = false) {
        if (this.shouldLog('debug') && this.enableGrouping) {
            if (collapsed) {
                console.groupCollapsed(`📁 ${label}`);
            } else {
                console.group(`📁 ${label}`);
            }
        }
    }
    
    /**
     * 分組結束
     */
    groupEnd() {
        if (this.shouldLog('debug') && this.enableGrouping) {
            console.groupEnd();
        }
    }
    
    /**
     * 清空控制台
     */
    clear() {
        console.clear();
        this.info('控制台已清空');
    }
    
    /**
     * 獲取日誌歷史
     */
    getHistory(levelFilter = null, limit = 100) {
        let history = this.logHistory;
        
        if (levelFilter) {
            history = history.filter(log => log.level === levelFilter);
        }
        
        return history.slice(-limit);
    }
    
    /**
     * 導出日誌
     */
    exportLogs() {
        const logs = this.getHistory(null, this.maxLogHistory);
        const logText = logs.map(log => {
            const timestamp = new Date(log.timestamp).toISOString();
            const dataStr = log.data ? ` | ${JSON.stringify(log.data)}` : '';
            return `${timestamp} [${log.level.toUpperCase()}] ${log.message}${dataStr}`;
        }).join('\n');
        
        const blob = new Blob([logText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `trading-system-logs-${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.info('日誌已導出');
    }
    
    /**
     * 設置日誌級別
     */
    setLevel(level) {
        if (this.levels.hasOwnProperty(level)) {
            this.level = level;
            this.info(`日誌級別已變更為: ${level}`);
        } else {
            this.warn(`無效的日誌級別: ${level}`);
        }
    }
    
    /**
     * 獲取統計信息
     */
    getStats() {
        const levelCounts = {};
        this.logHistory.forEach(log => {
            levelCounts[log.level] = (levelCounts[log.level] || 0) + 1;
        });
        
        return {
            totalLogs: this.logHistory.length,
            currentLevel: this.level,
            levelCounts,
            loadingMode: this.detectLoadingMode()
        };
    }
}

// 創建全域Logger實例
window.Logger = new Logger();

// 便利函數
window.log = {
    debug: (msg, data) => window.Logger.debug(msg, data),
    info: (msg, data) => window.Logger.info(msg, data),
    warn: (msg, data) => window.Logger.warn(msg, data),
    error: (msg, data) => window.Logger.error(msg, data),
    loading: (msg, data) => window.Logger.loading(msg, data),
    success: (msg, data) => window.Logger.success(msg, data),
    system: (msg, data) => window.Logger.system(msg, data),
    
    // 性能測量
    time: (label) => window.Logger.timeStart(label),
    timeEnd: (label) => window.Logger.timeEnd(label),
    
    // 分組
    group: (label, collapsed) => window.Logger.groupStart(label, collapsed),
    groupEnd: () => window.Logger.groupEnd(),
    
    // 工具
    clear: () => window.Logger.clear(),
    export: () => window.Logger.exportLogs(),
    stats: () => window.Logger.getStats(),
    setLevel: (level) => window.Logger.setLevel(level)
};

// 替換現有的console.log (可選)
if (window.Logger.detectLoadingMode() === 'debug') {
    const originalConsole = {
        log: console.log,
        info: console.info,
        warn: console.warn,
        error: console.error
    };
    
    console.log = (...args) => window.Logger.info(args.join(' '));
    console.info = (...args) => window.Logger.info(args.join(' '));
    console.warn = (...args) => window.Logger.warn(args.join(' '));
    console.error = (...args) => window.Logger.error(args.join(' '));
    
    // 提供恢復原始console的方法
    window.restoreConsole = () => {
        Object.assign(console, originalConsole);
        window.Logger.info('原始console已恢復');
    };
}

window.Logger.success('Logger系統載入完成！');