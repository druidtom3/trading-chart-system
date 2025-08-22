/**
 * 載入管理器 v2.0 - 漸進式重構版本
 * 
 * 設計原則：
 * 1. 清晰的依賴關係定義
 * 2. 統一的狀態管理
 * 3. 智能的載入策略
 * 4. 完善的錯誤處理和重試機制
 */

class LoadingManagerV2 {
    constructor() {
        this.progressElement = null;
        this.statusElement = null;
        this.detailElement = null;
        this.currentProgress = 0;
        this.loadedModules = new Set();
        this.failedModules = new Set();
        
        // 模組依賴圖定義
        this.moduleGroups = {
            // 第一層：基礎工具 (必須按順序載入)
            foundation: {
                order: 'sequential',
                modules: [
                    'timestamp-utils.js',    // 時間戳工具 - 最基礎
                    'data-validator.js',     // 數據驗證
                    'error-monitor.js'       // 錯誤監控
                ],
                weight: 20  // 佔總進度的20%
            },
            
            // 第二層：配置和聚合器 (可並行載入)
            configuration: {
                order: 'parallel',
                modules: [
                    'config.js',
                    'candleAggregator.js'
                ],
                dependencies: ['foundation'],
                weight: 15
            },
            
            // 第三層：核心管理器 (可並行載入)
            managers: {
                order: 'parallel',
                modules: [
                    'chart-manager.js',
                    'data-manager.js',
                    'playback-manager.js',
                    'event-manager.js'
                ],
                dependencies: ['configuration'],
                weight: 35
            },
            
            // 第四層：FVG渲染器 (智能載入)
            renderers: {
                order: 'smart',  // 智能載入策略
                modules: {
                    production: ['fvg-renderer-optimized.js'],
                    debug: [
                        'fvg-renderer-optimized.js',
                        'fvg-renderer-ultra-minimal.js',
                        'fvg-renderer-safe.js'
                    ],
                    full: [
                        'fvg-renderer-optimized.js',
                        'fvg-renderer-multiline.js',
                        'fvg-renderer-ultra-minimal.js',
                        'fvg-renderer-safe.js',
                        'fvg-renderer-fixed.js',
                        'fvg-renderer-minimal.js'
                    ]
                },
                dependencies: ['managers'],
                weight: 20
            },
            
            // 第五層：主程式
            application: {
                order: 'sequential',
                modules: ['script-v2.js'],
                dependencies: ['renderers'],
                weight: 10
            }
        };
        
        // 載入模式配置
        this.loadingMode = this.detectLoadingMode();
        this.retryConfig = {
            maxRetries: 3,
            retryDelay: 1000,
            backoffFactor: 2
        };
    }
    
    /**
     * 檢測載入模式
     */
    detectLoadingMode() {
        // 檢查URL參數
        const urlParams = new URLSearchParams(window.location.search);
        const mode = urlParams.get('mode');
        
        if (mode && ['production', 'debug', 'full'].includes(mode)) {
            return mode;
        }
        
        // 檢查本地存儲
        const savedMode = localStorage.getItem('loadingMode');
        if (savedMode && ['production', 'debug', 'full'].includes(savedMode)) {
            return savedMode;
        }
        
        // 默認生產模式
        return 'production';
    }
    
    /**
     * 初始化進度條元素
     */
    initializeProgressElements() {
        this.progressElement = document.getElementById('progress-fill');
        this.statusElement = document.getElementById('status-text');
        this.detailElement = document.getElementById('detail-text');
        
        if (!this.progressElement) {
            console.warn('進度條元素未找到，將只輸出日誌');
        }
    }
    
    /**
     * 更新載入進度
     */
    updateProgress(progress, status, detail) {
        this.currentProgress = Math.max(this.currentProgress, progress);
        
        if (this.progressElement) {
            this.progressElement.style.width = `${this.currentProgress}%`;
        }
        
        if (this.statusElement && status) {
            this.statusElement.textContent = status;
        }
        
        if (this.detailElement && detail) {
            this.detailElement.textContent = detail;
        }
        
        console.log(`📊 載入進度: ${this.currentProgress}% - ${status} - ${detail}`);
    }
    
    /**
     * 載入單個腳本
     */
    loadScript(src, retryCount = 0) {
        return new Promise((resolve, reject) => {
            if (this.loadedModules.has(src)) {
                console.log(`✅ 模組已載入: ${src}`);
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = src;
            
            script.onload = () => {
                this.loadedModules.add(src);
                this.failedModules.delete(src);
                console.log(`✅ 載入成功: ${src}`);
                resolve();
            };
            
            script.onerror = (error) => {
                console.error(`❌ 載入失敗: ${src}`, error);
                
                // 重試邏輯
                if (retryCount < this.retryConfig.maxRetries) {
                    const delay = this.retryConfig.retryDelay * Math.pow(this.retryConfig.backoffFactor, retryCount);
                    console.log(`🔄 重試載入 ${src} (${retryCount + 1}/${this.retryConfig.maxRetries})，${delay}ms後重試`);
                    
                    setTimeout(() => {
                        this.loadScript(src, retryCount + 1).then(resolve).catch(reject);
                    }, delay);
                } else {
                    this.failedModules.add(src);
                    reject(new Error(`載入失敗: ${src} (已重試${this.retryConfig.maxRetries}次)`));
                }
            };
            
            document.head.appendChild(script);
        });
    }
    
    /**
     * 載入模組群組
     */
    async loadGroup(groupName, groupConfig) {
        const startTime = Date.now();
        console.log(`📦 開始載入群組: ${groupName}`);
        
        let modules = groupConfig.modules;
        
        // 處理智能載入
        if (groupConfig.order === 'smart' && typeof modules === 'object') {
            modules = modules[this.loadingMode] || modules.production;
        }
        
        try {
            if (groupConfig.order === 'sequential') {
                // 序列載入
                for (const module of modules) {
                    await this.loadScript(module);
                }
            } else {
                // 並行載入
                await Promise.all(modules.map(module => this.loadScript(module)));
            }
            
            const duration = Date.now() - startTime;
            console.log(`✅ 群組 ${groupName} 載入完成 (${duration}ms, ${modules.length} 個模組)`);
            
        } catch (error) {
            console.error(`❌ 群組 ${groupName} 載入失敗:`, error);
            throw error;
        }
    }
    
    /**
     * 檢查依賴是否已載入
     */
    checkDependencies(dependencies) {
        if (!dependencies) return true;
        
        for (const dep of dependencies) {
            if (!this.loadedGroups.has(dep)) {
                return false;
            }
        }
        return true;
    }
    
    /**
     * 主載入流程
     */
    async loadAll() {
        console.log(`🚀 開始載入系統 (模式: ${this.loadingMode})`);
        this.initializeProgressElements();
        this.loadedGroups = new Set();
        
        let totalProgress = 0;
        const groupNames = Object.keys(this.moduleGroups);
        
        try {
            for (const groupName of groupNames) {
                const groupConfig = this.moduleGroups[groupName];
                
                // 檢查依賴
                if (!this.checkDependencies(groupConfig.dependencies)) {
                    throw new Error(`群組 ${groupName} 的依賴未滿足`);
                }
                
                // 更新進度
                const groupStartProgress = totalProgress;
                this.updateProgress(
                    groupStartProgress,
                    `載入 ${groupName}...`,
                    `正在載入${Array.isArray(groupConfig.modules) ? groupConfig.modules.length : Object.keys(groupConfig.modules).length}個模組`
                );
                
                // 載入群組
                await this.loadGroup(groupName, groupConfig);
                
                // 更新完成進度
                totalProgress += groupConfig.weight;
                this.loadedGroups.add(groupName);
                
                this.updateProgress(
                    totalProgress,
                    `${groupName} 載入完成`,
                    `已載入 ${this.loadedModules.size} 個模組`
                );
            }
            
            // 完成
            this.updateProgress(100, '系統載入完成', '所有模組載入成功');
            console.log(`🎉 系統載入完成！載入模式: ${this.loadingMode}, 總模組數: ${this.loadedModules.size}`);
            
            return {
                success: true,
                loadedModules: Array.from(this.loadedModules),
                failedModules: Array.from(this.failedModules),
                mode: this.loadingMode
            };
            
        } catch (error) {
            this.updateProgress(this.currentProgress, '載入失敗', error.message);
            console.error('💥 系統載入失敗:', error);
            
            return {
                success: false,
                error: error.message,
                loadedModules: Array.from(this.loadedModules),
                failedModules: Array.from(this.failedModules),
                mode: this.loadingMode
            };
        }
    }
    
    /**
     * 獲取載入統計
     */
    getStats() {
        return {
            mode: this.loadingMode,
            totalModules: this.loadedModules.size + this.failedModules.size,
            loadedModules: this.loadedModules.size,
            failedModules: this.failedModules.size,
            progress: this.currentProgress,
            loadedList: Array.from(this.loadedModules),
            failedList: Array.from(this.failedModules)
        };
    }
    
    /**
     * 切換載入模式 (用於調試)
     */
    setMode(mode) {
        if (['production', 'debug', 'full'].includes(mode)) {
            this.loadingMode = mode;
            localStorage.setItem('loadingMode', mode);
            console.log(`🔧 載入模式切換為: ${mode}`);
        }
    }
}

// 全域實例
window.LoadingManagerV2 = LoadingManagerV2;

// 便利函數
window.switchLoadingMode = function(mode) {
    if (window.loadingManager) {
        window.loadingManager.setMode(mode);
    }
    console.log(`下次載入將使用模式: ${mode}`);
};

// 調試函數
window.getLoadingStats = function() {
    if (window.loadingManager) {
        return window.loadingManager.getStats();
    }
    return null;
};