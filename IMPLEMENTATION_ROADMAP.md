# 交易圖表系統優化實作路線圖
## Trading Chart System Implementation Roadmap

> **版本**: v1.0  
> **創建日期**: 2025-08-17  
> **目標完成時間**: 2-3個工作日  
> **預期效果**: 系統性能提升5-20倍，用戶體驗大幅改善

---

## 量化改進目標

### 性能指標目標
| 指標 | 當前狀態 | 目標值 | 測量方法 |
|------|----------|--------|----------|
| 系統啟動時間 | 30-120秒 | ≤ 10秒 | 從app.py啟動到圖表顯示 |
| FVG渲染速度 | ~100 FVG/秒 | ≥ 1000 FVG/秒 | 渲染400根K線的FVG |
| 內存使用量 | ~150MB | ≤ 100MB | 載入完成後的內存占用 |
| 圖表響應延遲 | 100-300ms | ≤ 50ms | 縮放/平移操作響應時間 |
| Bundle大小 | ~52KB | ≤ 35KB | Lightweight Charts庫大小 |

### 功能完整性目標
- [x] FVG檢測準確率 ≥ 95%
- [ ] 技術指標覆蓋率 ≥ 80% (10個常用指標)
- [ ] 多時間框架同步 100%
- [ ] 錯誤處理覆蓋率 ≥ 90%
- [ ] 離線模式支持 100%

---

## Phase 1: 關鍵性能優化 (優先級: 最高)
**預估工時**: 2-3小時  
**完成條件**: 啟動時間 ≤ 10秒，系統穩定運行

### 任務 1.1: K線連續性檢查優化
**文件位置**: `src/utils/continuity_config.py`

**具體步驟**:
```python
# 1. 修改配置文件
CONTINUITY_CHECK_MODE = 'vectorized'  # 從 'basic' 改為 'vectorized'
USE_V2_CHECKER = True                 # 啟用V2優化器
FAST_STARTUP = True                   # 新增快速啟動選項
SHOW_PROGRESS = True                  # 保持進度顯示
```

**驗證標準**:
- 啟動時間從 30-120秒 降至 ≤ 10秒
- 連續性檢查速度達到 ≥ 10,000 K線/秒
- 所有時間框架檢查完成且無錯誤

**測試命令**:
```bash
# Windows
test_performance.bat
# 或
cd src\backend && python test_continuity_performance.py
```

### 任務 1.2: 後端API響應優化
**文件位置**: `src/backend/data_processor.py`

**具體修改**:
1. **數據預載入優化**:
```python
# 在 load_all_data() 方法中添加
def load_all_data(self):
    # 現有代碼...
    
    # 新增: 預載入常用數據到內存
    self._preload_common_data()
    
def _preload_common_data(self):
    """預載入最近30天的常用時間框架數據"""
    popular_timeframes = ['M15', 'H1', 'H4']
    for tf in popular_timeframes:
        if tf in self.data_cache:
            # 預處理最近30天數據
            recent_data = self._get_recent_data(tf, days=30)
            self._cache_processed_data(tf, recent_data)
```

2. **API響應緩存**:
```python
# 在 get_pre_market_data() 中添加緩存機制
def get_pre_market_data(self, target_date, timeframe='H4'):
    cache_key = f"{target_date}_{timeframe}"
    if cache_key in self._response_cache:
        return self._response_cache[cache_key]
    
    # 現有處理邏輯...
    result = # ... 現有代碼
    
    # 緩存結果 (最多緩存100個)
    if len(self._response_cache) < 100:
        self._response_cache[cache_key] = result
    
    return result
```

**驗證標準**:
- API響應時間 ≤ 200ms
- 重複請求響應時間 ≤ 50ms
- 內存增長 ≤ 20MB

### 任務 1.3: 前端載入優化
**文件位置**: `src/frontend/index-v2.html`

**具體修改**:
```html
<!-- 在 <head> 中添加預載入 -->
<link rel="preload" href="candleAggregator.js" as="script">
<link rel="preload" href="chart-manager.js" as="script">
<link rel="preload" href="config.js" as="script">

<!-- 優化CDN載入順序 -->
<script>
// 並行載入關鍵模組
const criticalModules = [
    'candleAggregator.js',
    'config.js', 
    'chart-manager.js'
];

Promise.all(criticalModules.map(loadModule))
    .then(() => loadSecondaryModules())
    .then(() => initializeApp());
</script>
```

**驗證標準**:
- 首次內容渲染 (FCP) ≤ 1.5秒
- 完全載入時間 ≤ 3秒
- 無JavaScript錯誤

---

## Phase 2: Lightweight Charts v5 完整遷移 (優先級: 高)
**預估工時**: 2-3小時  
**完成條件**: v5功能100%正常，性能提升10倍

### 任務 2.1: 自定義FVG系列實現
**文件位置**: `src/frontend/fvg-renderer-v5.js`

**具體實現**:
```javascript
// 創建完整的v5 FVG渲染器
class FVGRendererV5 {
    constructor(chart, candlestickSeries) {
        this.chart = chart;
        this.candlestickSeries = candlestickSeries;
        this.customSeries = null;
        this.fvgData = [];
        this.isVisible = true;
        
        this.initializeCustomSeries();
    }

    initializeCustomSeries() {
        // 使用v5 Custom Series API
        this.customSeries = this.chart.addCustomSeries(
            new FVGSeriesRenderer(), 
            {
                priceScaleId: 'right',
                // v5專用配置
                overlayEnabled: true,
                priceFormat: {
                    type: 'price',
                    precision: 2,
                    minMove: 0.01,
                }
            }
        );
    }

    render(fvgs, timeframe) {
        // 轉換FVG數據為v5格式
        const v5FvgData = this.convertToV5Format(fvgs, timeframe);
        this.customSeries.setData(v5FvgData);
        this.fvgData = fvgs;
    }

    convertToV5Format(fvgs, timeframe) {
        return fvgs.map(fvg => ({
            time: fvg.startTime,
            value: {
                top: fvg.startPrice,
                bottom: fvg.endPrice,
                type: fvg.type,
                duration: this.calculateDuration(timeframe)
            }
        }));
    }

    // 矩形繪製邏輯
    draw(renderingScope) {
        const ctx = renderingScope.context;
        const data = renderingScope.data;
        
        data.forEach(item => {
            const rect = this.calculateRect(item, renderingScope);
            this.drawFVGRect(ctx, rect, item.value.type);
        });
    }

    drawFVGRect(ctx, rect, type) {
        const alpha = 0.3;
        const color = type === 'bullish' 
            ? `rgba(76, 175, 80, ${alpha})`   // 綠色
            : `rgba(244, 67, 54, ${alpha})`;  // 紅色
        
        ctx.fillStyle = color;
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
        
        // 添加邊框
        ctx.strokeStyle = color.replace(alpha, '1');
        ctx.lineWidth = 1;
        ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    }
}
```

**驗證標準**:
- FVG顯示100%正確
- 渲染性能提升 ≥ 10倍
- 透明度一致性 100%
- 縮放響應 ≤ 16ms (60fps)

### 任務 2.2: API兼容性完善
**文件位置**: `src/frontend/chart-manager.js`

**具體修改**:
```javascript
// 增強版本檢測邏輯
detectLightweightChartsVersion() {
    // 更可靠的v5檢測
    if (LightweightCharts.version && LightweightCharts.version.startsWith('5.')) {
        return 'v5';
    }
    
    // 檢查v5特有API
    if (this.chart && typeof this.chart.addCustomSeries === 'function') {
        try {
            // 嘗試創建測試自定義系列
            const testSeries = this.chart.addCustomSeries(new TestRenderer());
            this.chart.removeSeries(testSeries);
            return 'v5';
        } catch (e) {
            console.warn('v5 API不完整:', e);
        }
    }
    
    return 'v4';
}

// 統一的系列創建方法
createCandlestickSeries() {
    const config = {
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderUpColor: '#26a69a',
        borderDownColor: '#ef5350',
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350'
    };

    if (this.chartVersion === 'v5') {
        return this.chart.addSeries(LightweightCharts.SeriesType.Candlestick, config);
    } else {
        return this.chart.addCandlestickSeries(config);
    }
}
```

**驗證標準**:
- v4/v5自動檢測準確率 100%
- 所有圖表功能正常
- 無版本相關錯誤

### 任務 2.3: 性能基準測試
**文件位置**: `src/frontend/test-fvg-v5.js` (新建)

**測試實現**:
```javascript
// FVG性能測試套件
class FVGPerformanceTest {
    constructor() {
        this.testResults = {};
    }

    async runBenchmarks() {
        console.log('開始FVG性能基準測試...');
        
        // 測試1: 渲染速度
        await this.testRenderingSpeed();
        
        // 測試2: 內存使用
        await this.testMemoryUsage();
        
        // 測試3: 響應延遲
        await this.testResponseLatency();
        
        this.generateReport();
    }

    async testRenderingSpeed() {
        const fvgCounts = [10, 50, 100, 200, 400];
        
        for (const count of fvgCounts) {
            const fvgs = this.generateTestFVGs(count);
            
            const startTime = performance.now();
            this.fvgRenderer.render(fvgs, 'M15');
            const endTime = performance.now();
            
            const renderTime = endTime - startTime;
            const fvgsPerSecond = (count / renderTime) * 1000;
            
            this.testResults[`render_${count}_fvgs`] = {
                fvgCount: count,
                renderTime: renderTime,
                fvgsPerSecond: fvgsPerSecond
            };
        }
    }

    generateReport() {
        console.log('=== FVG性能測試報告 ===');
        
        Object.entries(this.testResults).forEach(([key, result]) => {
            console.log(`${key}: ${result.fvgsPerSecond.toFixed(0)} FVG/秒`);
        });
        
        // 判斷是否達到目標
        const targetFPS = 1000;
        const maxFvgTest = Math.max(...Object.values(this.testResults).map(r => r.fvgsPerSecond));
        
        console.log(`最高性能: ${maxFvgTest.toFixed(0)} FVG/秒`);
        console.log(`目標達成: ${maxFvgTest >= targetFPS ? '✅' : '❌'}`);
    }
}
```

**驗證標準**:
- FVG渲染速度 ≥ 1000 FVG/秒
- 內存增長 ≤ 5MB (400個FVG)
- 響應延遲 ≤ 50ms

---

## Phase 3: 功能增強與用戶體驗 (優先級: 中)
**預估工時**: 3-4小時  
**完成條件**: 新增5個核心功能，用戶體驗評分提升50%

### 任務 3.1: 技術指標系統擴展
**文件位置**: `src/frontend/indicators/` (新目錄結構)

**目標指標清單**:
1. **移動平均線** (SMA/EMA/WMA)
2. **相對強弱指數** (RSI)
3. **MACD** 
4. **布林通道** (Bollinger Bands)
5. **成交量加權平均價** (VWAP)

**實現框架**:
```javascript
// src/frontend/indicators/base_indicator.js
class BaseIndicator {
    constructor(name, parameters = {}) {
        this.name = name;
        this.parameters = parameters;
        this.series = null;
        this.enabled = false;
    }

    calculate(data) {
        throw new Error('Subclass must implement calculate method');
    }

    render(chart) {
        throw new Error('Subclass must implement render method');
    }

    updateParameters(newParams) {
        this.parameters = { ...this.parameters, ...newParams };
        this.recalculate();
    }
}

// src/frontend/indicators/sma_indicator.js
class SMAIndicator extends BaseIndicator {
    constructor(period = 20) {
        super('SMA', { period });
    }

    calculate(data) {
        const smaData = [];
        const period = this.parameters.period;
        
        for (let i = period - 1; i < data.length; i++) {
            const sum = data.slice(i - period + 1, i + 1)
                           .reduce((acc, item) => acc + item.close, 0);
            smaData.push({
                time: data[i].time,
                value: sum / period
            });
        }
        
        return smaData;
    }

    render(chart) {
        if (!this.series) {
            this.series = chart.addLineSeries({
                color: '#2196F3',
                lineWidth: 2,
                title: `SMA(${this.parameters.period})`
            });
        }
        
        const calculatedData = this.calculate(this.sourceData);
        this.series.setData(calculatedData);
    }
}
```

**指標管理器**:
```javascript
// src/frontend/indicators/indicator_manager.js
class IndicatorManager {
    constructor(chart) {
        this.chart = chart;
        this.indicators = new Map();
        this.sourceData = null;
    }

    addIndicator(indicatorClass, id, parameters = {}) {
        const indicator = new indicatorClass(parameters);
        indicator.sourceData = this.sourceData;
        this.indicators.set(id, indicator);
        
        if (indicator.enabled) {
            indicator.render(this.chart);
        }
        
        return indicator;
    }

    updateData(data) {
        this.sourceData = data;
        
        this.indicators.forEach(indicator => {
            if (indicator.enabled && indicator.series) {
                indicator.sourceData = data;
                indicator.render(this.chart);
            }
        });
    }

    toggleIndicator(id) {
        const indicator = this.indicators.get(id);
        if (!indicator) return false;
        
        indicator.enabled = !indicator.enabled;
        
        if (indicator.enabled) {
            indicator.render(this.chart);
        } else if (indicator.series) {
            this.chart.removeSeries(indicator.series);
            indicator.series = null;
        }
        
        return indicator.enabled;
    }
}
```

**驗證標準**:
- 5個指標100%正確計算
- 指標切換響應 ≤ 100ms
- 參數調整實時更新
- 無內存泄漏

### 任務 3.2: 響應式界面優化
**文件位置**: `src/frontend/style-v2.css`

**具體改進**:
```css
/* 響應式設計增強 */
@media (max-width: 1200px) {
    .indicators-panel {
        width: 200px; /* 從250px縮小 */
    }
    
    .main-content {
        margin-left: 200px;
    }
}

@media (max-width: 768px) {
    .indicators-panel {
        position: fixed;
        top: 0;
        left: -250px; /* 隱藏 */
        height: 100vh;
        z-index: 1000;
        transition: left 0.3s ease;
    }
    
    .indicators-panel.open {
        left: 0; /* 滑出 */
    }
    
    .main-content {
        margin-left: 0;
        width: 100%;
    }
    
    .chart-container {
        height: 60vh; /* 移動設備適配 */
    }
}

/* 觸摸設備優化 */
@media (pointer: coarse) {
    .btn {
        min-height: 44px; /* 觸摸目標大小 */
        padding: 12px 20px;
    }
    
    .tab-btn {
        min-width: 60px;
        padding: 15px;
    }
}

/* 高DPI屏幕優化 */
@media (-webkit-min-device-pixel-ratio: 2) {
    .chart-container {
        image-rendering: -webkit-optimize-contrast;
    }
}
```

**JavaScript觸摸支持**:
```javascript
// src/frontend/touch-handler.js
class TouchHandler {
    constructor(chartContainer) {
        this.container = chartContainer;
        this.lastTouchTime = 0;
        this.setupTouchEvents();
    }

    setupTouchEvents() {
        // 雙擊重置縮放
        this.container.addEventListener('touchend', (e) => {
            const currentTime = Date.now();
            const timeDiff = currentTime - this.lastTouchTime;
            
            if (timeDiff < 300 && timeDiff > 0) {
                // 雙擊
                window.app.chartManager.resetZoom();
                e.preventDefault();
            }
            
            this.lastTouchTime = currentTime;
        });

        // 長按顯示十字線
        let longPressTimer;
        this.container.addEventListener('touchstart', (e) => {
            longPressTimer = setTimeout(() => {
                // 啟用十字線模式
                this.enableCrosshair();
            }, 500);
        });

        this.container.addEventListener('touchend', () => {
            clearTimeout(longPressTimer);
        });
    }
}
```

**驗證標準**:
- 移動設備操作響應 ≤ 100ms
- 觸摸目標大小 ≥ 44px
- 各種屏幕尺寸正常顯示
- 手勢操作準確率 ≥ 95%

### 任務 3.3: 錯誤處理與離線支持
**文件位置**: `src/frontend/error-handler.js` (新建)

**錯誤處理系統**:
```javascript
class ErrorHandler {
    constructor() {
        this.errorLog = [];
        this.isOnline = navigator.onLine;
        this.setupGlobalErrorHandling();
        this.setupNetworkMonitoring();
    }

    setupGlobalErrorHandling() {
        // JavaScript錯誤
        window.addEventListener('error', (event) => {
            this.logError({
                type: 'javascript',
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                stack: event.error?.stack,
                timestamp: new Date().toISOString()
            });
        });

        // Promise拒絕
        window.addEventListener('unhandledrejection', (event) => {
            this.logError({
                type: 'promise',
                reason: event.reason,
                timestamp: new Date().toISOString()
            });
        });

        // API錯誤
        this.setupAPIErrorHandling();
    }

    setupAPIErrorHandling() {
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            try {
                const response = await originalFetch(...args);
                
                if (!response.ok) {
                    this.logError({
                        type: 'api',
                        url: args[0],
                        status: response.status,
                        statusText: response.statusText,
                        timestamp: new Date().toISOString()
                    });
                    
                    // 嘗試離線模式
                    if (response.status >= 500) {
                        return this.handleOfflineMode(args[0]);
                    }
                }
                
                return response;
            } catch (error) {
                this.logError({
                    type: 'network',
                    url: args[0],
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
                
                return this.handleOfflineMode(args[0]);
            }
        };
    }

    setupNetworkMonitoring() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.showNotification('網路連線已恢復', 'success');
            this.retryFailedRequests();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.showNotification('網路連線中斷，切換至離線模式', 'warning');
        });
    }

    handleOfflineMode(url) {
        // 返回緩存數據或模擬數據
        if (url.includes('/api/random-data')) {
            return this.getMockData();
        }
        
        throw new Error('網路不可用，且無離線數據');
    }

    showNotification(message, type = 'info', duration = 5000) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, duration);
    }

    getUserFriendlyError(error) {
        const errorMessages = {
            'network': '網路連線問題，請檢查您的網路設定',
            'api': '服務暫時不可用，請稍後再試',
            'javascript': '系統發生錯誤，請重新整理頁面',
            'promise': '數據載入失敗，請重試'
        };
        
        return errorMessages[error.type] || '發生未知錯誤，請聯繫技術支援';
    }
}
```

**驗證標準**:
- 錯誤捕獲率 ≥ 95%
- 用戶友好錯誤訊息覆蓋率 100%
- 離線模式基本功能可用
- 網路恢復自動重連

---

## Phase 4: 品質保證與測試 (優先級: 中)
**預估工時**: 1-2小時  
**完成條件**: 所有功能通過測試，零致命錯誤

### 任務 4.1: 自動化測試套件
**文件位置**: `tests/` (新目錄)

**測試結構**:
```
tests/
├── unit/
│   ├── test_fvg_detector.py      # FVG檢測單元測試
│   ├── test_data_processor.py    # 數據處理測試
│   └── test_indicators.js        # 指標計算測試
├── integration/
│   ├── test_api_endpoints.py     # API集成測試
│   └── test_chart_rendering.js   # 圖表渲染測試
├── performance/
│   ├── test_startup_time.py      # 啟動性能測試
│   └── test_rendering_speed.js   # 渲染性能測試
└── e2e/
    └── test_user_workflows.js    # 端到端用戶流程測試
```

**關鍵測試用例**:
```python
# tests/unit/test_fvg_detector.py
import unittest
from src.backend.fvg_detector_v4 import FVGDetectorV4

class TestFVGDetectorV4(unittest.TestCase):
    def setUp(self):
        self.detector = FVGDetectorV4(clearing_window=40)
        
    def test_bullish_fvg_detection(self):
        # 測試多頭FVG檢測
        test_data = self.generate_bullish_fvg_data()
        fvgs = self.detector.detect_fvgs(test_data)
        
        self.assertGreater(len(fvgs), 0, "應該檢測到多頭FVG")
        self.assertEqual(fvgs[0]['type'], 'bullish')
        self.assertAlmostEqual(fvgs[0]['gap_size'], 0.5, places=2)
        
    def test_fvg_clearing_mechanism(self):
        # 測試FVG清除機制
        test_data = self.generate_fvg_with_clearing()
        fvgs = self.detector.detect_fvgs(test_data, enable_dynamic_clearing=True)
        
        cleared_fvgs = [fvg for fvg in fvgs if fvg['status'] == 'cleared']
        self.assertGreater(len(cleared_fvgs), 0, "應該有FVG被清除")
        
    def test_performance_benchmark(self):
        # 性能基準測試
        large_dataset = self.generate_large_dataset(10000)
        
        start_time = time.time()
        fvgs = self.detector.detect_fvgs(large_dataset)
        end_time = time.time()
        
        processing_speed = len(large_dataset) / (end_time - start_time)
        self.assertGreater(processing_speed, 5000, "處理速度應該 > 5000 K線/秒")
```

**前端測試**:
```javascript
// tests/unit/test_indicators.js
describe('Technical Indicators', () => {
    let indicatorManager;
    
    beforeEach(() => {
        const mockChart = createMockChart();
        indicatorManager = new IndicatorManager(mockChart);
    });
    
    test('SMA calculation accuracy', () => {
        const testData = generateTestCandleData();
        const smaIndicator = indicatorManager.addIndicator(SMAIndicator, 'sma20', {period: 20});
        
        const calculatedSMA = smaIndicator.calculate(testData);
        const expectedSMA = calculateExpectedSMA(testData, 20);
        
        expect(calculatedSMA).toHaveLength(expectedSMA.length);
        
        calculatedSMA.forEach((point, index) => {
            expect(point.value).toBeCloseTo(expectedSMA[index], 6);
        });
    });
    
    test('Indicator rendering performance', async () => {
        const largeDataset = generateLargeCandleData(5000);
        
        const startTime = performance.now();
        indicatorManager.updateData(largeDataset);
        const endTime = performance.now();
        
        const renderTime = endTime - startTime;
        expect(renderTime).toBeLessThan(100); // 100ms內完成
    });
});
```

### 任務 4.2: 性能監控儀表板
**文件位置**: `src/frontend/performance-monitor.js` (新建)

**監控實現**:
```javascript
class PerformanceMonitor {
    constructor() {
        this.metrics = {
            startupTime: 0,
            renderingFPS: 0,
            memoryUsage: 0,
            apiResponseTimes: [],
            errorCount: 0
        };
        
        this.setupMonitoring();
    }

    setupMonitoring() {
        // 監控FPS
        this.monitorFPS();
        
        // 監控內存使用
        setInterval(() => {
            this.updateMemoryUsage();
        }, 5000);
        
        // 監控API響應時間
        this.monitorAPIResponses();
    }

    monitorFPS() {
        let lastTime = performance.now();
        let frameCount = 0;
        
        const measureFPS = (currentTime) => {
            frameCount++;
            
            if (currentTime - lastTime >= 1000) {
                this.metrics.renderingFPS = frameCount;
                frameCount = 0;
                lastTime = currentTime;
                
                this.updateDashboard();
            }
            
            requestAnimationFrame(measureFPS);
        };
        
        requestAnimationFrame(measureFPS);
    }

    updateMemoryUsage() {
        if (performance.memory) {
            this.metrics.memoryUsage = {
                used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
            };
        }
    }

    createDashboard() {
        const dashboard = document.createElement('div');
        dashboard.id = 'performance-dashboard';
        dashboard.innerHTML = `
            <div class="perf-header">性能監控</div>
            <div class="perf-metric">
                <span>FPS:</span>
                <span id="fps-value">--</span>
            </div>
            <div class="perf-metric">
                <span>內存:</span>
                <span id="memory-value">-- MB</span>
            </div>
            <div class="perf-metric">
                <span>API延遲:</span>
                <span id="api-latency">-- ms</span>
            </div>
            <div class="perf-metric">
                <span>錯誤數:</span>
                <span id="error-count">0</span>
            </div>
        `;
        
        // 添加CSS樣式
        dashboard.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 10px;
            border-radius: 5px;
            font-family: monospace;
            font-size: 12px;
            z-index: 9999;
            min-width: 150px;
        `;
        
        document.body.appendChild(dashboard);
    }

    updateDashboard() {
        document.getElementById('fps-value').textContent = this.metrics.renderingFPS;
        
        if (this.metrics.memoryUsage) {
            document.getElementById('memory-value').textContent = 
                `${this.metrics.memoryUsage.used} MB`;
        }
        
        const avgLatency = this.calculateAverageLatency();
        document.getElementById('api-latency').textContent = `${avgLatency} ms`;
        
        document.getElementById('error-count').textContent = this.metrics.errorCount;
        
        // 性能警告
        this.checkPerformanceThresholds();
    }

    checkPerformanceThresholds() {
        const warnings = [];
        
        if (this.metrics.renderingFPS < 30) {
            warnings.push('FPS過低');
        }
        
        if (this.metrics.memoryUsage && this.metrics.memoryUsage.used > 200) {
            warnings.push('內存使用過高');
        }
        
        const avgLatency = this.calculateAverageLatency();
        if (avgLatency > 500) {
            warnings.push('API響應緩慢');
        }
        
        if (warnings.length > 0) {
            console.warn('性能警告:', warnings.join(', '));
        }
    }
}
```

**驗證標準**:
- 實時性能監控準確性 ≥ 95%
- 性能警告及時性 ≤ 5秒
- 監控開銷 ≤ 5% CPU使用率

---

## 實施檢查清單

### 開始前準備
- [ ] 備份當前系統代碼
- [ ] 確保開發環境正常
- [ ] 安裝必要的依賴包
- [ ] 準備測試數據

### Phase 1 檢查點
- [ ] K線連續性檢查優化完成
- [ ] 啟動時間 ≤ 10秒
- [ ] 後端API響應 ≤ 200ms
- [ ] 前端載入 ≤ 3秒
- [ ] 無致命錯誤

### Phase 2 檢查點
- [ ] FVG v5渲染器實現
- [ ] 性能提升 ≥ 10倍
- [ ] API兼容性100%
- [ ] 基準測試通過

### Phase 3 檢查點
- [ ] 5個技術指標正常工作
- [ ] 響應式設計完善
- [ ] 錯誤處理系統運行
- [ ] 離線模式可用

### Phase 4 檢查點
- [ ] 所有測試用例通過
- [ ] 性能監控正常
- [ ] 零致命錯誤
- [ ] 用戶體驗驗收

### 最終驗收
- [ ] 所有量化目標達成
- [ ] 功能完整性100%
- [ ] 性能提升確認
- [ ] 文檔更新完成

---

## 支援與協助

### 問題回報格式
```
問題描述: [簡短描述]
重現步驟: [1. 2. 3.]
預期結果: [期望發生什麼]
實際結果: [實際發生什麼]
環境信息: [瀏覽器、系統版本等]
錯誤日誌: [Console錯誤訊息]
```

### 性能問題診斷
```bash
# 快速性能檢查
cd src\backend
python test_continuity_performance.py

# 前端性能檢查
# 在瀏覽器Console執行
console.time('FVG_Render_Test');
// 執行FVG渲染
console.timeEnd('FVG_Render_Test');
```

### 聯繫方式
- GitHub Issues: [項目地址]/issues
- 緊急問題: 立即回報並提供詳細信息
- 建議改進: 歡迎提出優化建議

---

**文件版本**: v1.0  
**最後更新**: 2025-08-17  
**下次審查**: 實施完成後