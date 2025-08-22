/**
 * 載入配置 - 模組依賴和載入策略定義
 * 
 * 這個檔案定義了所有模組的依賴關係、載入順序和策略
 * 通過修改這個配置檔案就可以調整載入行為，無需修改載入邏輯
 */

window.LoadingConfig = {
    // 載入模式定義
    modes: {
        production: {
            description: '生產模式 - 只載入必要模組',
            debugOutput: false,
            loadTimeout: 10000,
            retryCount: 3
        },
        debug: {
            description: '調試模式 - 包含調試工具',
            debugOutput: true,
            loadTimeout: 15000,
            retryCount: 5
        },
        development: {
            description: '開發模式 - 包含所有模組',
            debugOutput: true,
            loadTimeout: 20000,
            retryCount: 2
        }
    },
    
    // 模組群組定義
    groups: {
        // 基礎工具層
        foundation: {
            description: '基礎工具和標準化模組',
            loadOrder: 'sequential',  // 必須按順序載入
            critical: true,           // 載入失敗則整個系統失敗
            timeout: 5000,
            modules: {
                production: [
                    'timestamp-utils.js',
                    'data-validator.js', 
                    'error-monitor.js'
                ],
                debug: [
                    'timestamp-utils.js',
                    'data-validator.js',
                    'error-monitor.js'
                ],
                development: [
                    'timestamp-utils.js',
                    'data-validator.js',
                    'error-monitor.js'
                ]
            }
        },
        
        // 配置層
        configuration: {
            description: '系統配置和基礎聚合器',
            loadOrder: 'parallel',
            critical: true,
            dependencies: ['foundation'],
            timeout: 5000,
            modules: {
                production: [
                    'config.js',
                    'candleAggregator.js'
                ],
                debug: [
                    'config.js', 
                    'candleAggregator.js'
                ],
                development: [
                    'config.js',
                    'candleAggregator.js'
                ]
            }
        },
        
        // 核心管理器層
        managers: {
            description: '核心業務邏輯管理器',
            loadOrder: 'parallel',
            critical: true,
            dependencies: ['configuration'],
            timeout: 8000,
            modules: {
                production: [
                    'chart-manager.js',
                    'data-manager.js'
                ],
                debug: [
                    'chart-manager.js',
                    'data-manager.js',
                    'playback-manager.js',
                    'event-manager.js'
                ],
                development: [
                    'chart-manager.js',
                    'data-manager.js',
                    'playback-manager.js',
                    'event-manager.js'
                ]
            }
        },
        
        // FVG渲染器層 - 智能載入
        renderers: {
            description: 'FVG渲染引擎',
            loadOrder: 'smart',      // 智能載入策略
            critical: false,         // 非關鍵，載入失敗可降級
            dependencies: ['managers'],
            timeout: 10000,
            modules: {
                production: [
                    'fvg-renderer-optimized.js'  // 只載入優化版本
                ],
                debug: [
                    'fvg-renderer-optimized.js',
                    'fvg-renderer-ultra-minimal.js',  // 調試用極簡版本
                    'fvg-renderer-safe.js'            // 調試用安全版本
                ],
                development: [
                    'fvg-renderer-optimized.js',
                    'fvg-renderer-multiline.js',
                    'fvg-renderer-ultra-minimal.js',
                    'fvg-renderer-safe.js',
                    'fvg-renderer-fixed.js',
                    'fvg-renderer-minimal.js'
                ]
            },
            fallbackStrategy: {
                // 如果主要渲染器載入失敗的降級策略
                fallbackModules: ['fvg-renderer-minimal.js'],
                gracefulDegradation: true
            }
        },
        
        // 應用主程式
        application: {
            description: '主應用程式邏輯',
            loadOrder: 'sequential',
            critical: true,
            dependencies: ['renderers'],
            timeout: 5000,
            modules: {
                production: ['script-v2.js'],
                debug: ['script-v2.js'],
                development: ['script-v2.js']
            }
        }
    },
    
    // 載入進度權重分配 (總和應為100)
    progressWeights: {
        foundation: 15,
        configuration: 10,
        managers: 25,
        renderers: 35,
        application: 15
    },
    
    // 錯誤處理策略
    errorHandling: {
        maxRetries: 3,
        retryDelay: 1000,
        retryBackoff: 2,
        continueOnNonCritical: true,
        fallbackTimeout: 30000
    },
    
    // 性能優化設定
    performance: {
        enablePreload: true,          // 啟用模組預載入
        enableParallelism: true,      // 啟用並行載入
        enableCaching: true,          // 啟用載入結果緩存
        maxConcurrency: 4,            // 最大並行載入數
        enableResourceHints: true     // 啟用資源提示
    },
    
    // 調試和監控
    monitoring: {
        enableTimings: true,          // 啟用載入時間監控
        enableMemoryTracking: false,  // 啟用記憶體使用監控
        logLevel: 'info',            // 日誌等級: debug, info, warn, error
        enableMetrics: true          // 啟用載入指標收集
    },
    
    // 開發者工具
    devTools: {
        enableModeSwitch: true,      // 啟用載入模式切換
        enableLoadingStats: true,    // 啟用載入統計
        enableManualOverride: true,  // 允許手動覆蓋載入配置
        enableHotReload: false       // 熱重載 (實驗性)
    }
};

// 輔助函數：根據當前環境自動檢測建議的載入模式
window.LoadingConfig.detectRecommendedMode = function() {
    // 檢查是否為開發環境
    const isDev = window.location.hostname === 'localhost' || 
                  window.location.hostname === '127.0.0.1' ||
                  window.location.search.includes('dev=true');
    
    // 檢查是否有調試參數
    const hasDebugParam = window.location.search.includes('debug=true');
    
    // 檢查是否有性能問題
    const hasPerformanceConstraints = navigator.hardwareConcurrency < 4 || 
                                     navigator.deviceMemory < 4;
    
    if (hasDebugParam) return 'debug';
    if (isDev && !hasPerformanceConstraints) return 'development';
    return 'production';
};

// 輔助函數：驗證配置完整性
window.LoadingConfig.validate = function() {
    const errors = [];
    const groups = this.groups;
    
    // 檢查依賴關係
    for (const [groupName, groupConfig] of Object.entries(groups)) {
        if (groupConfig.dependencies) {
            for (const dep of groupConfig.dependencies) {
                if (!groups[dep]) {
                    errors.push(`群組 ${groupName} 依賴不存在的群組: ${dep}`);
                }
            }
        }
    }
    
    // 檢查進度權重總和
    const totalWeight = Object.values(this.progressWeights).reduce((sum, weight) => sum + weight, 0);
    if (Math.abs(totalWeight - 100) > 0.1) {
        errors.push(`進度權重總和不等於100: ${totalWeight}`);
    }
    
    if (errors.length > 0) {
        console.error('載入配置驗證失敗:', errors);
        return false;
    }
    
    console.log('✅ 載入配置驗證通過');
    return true;
};

// 載入配置時立即驗證
window.LoadingConfig.validate();