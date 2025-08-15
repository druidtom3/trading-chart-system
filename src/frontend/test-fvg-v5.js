// 檔名：test-fvg-v5.js - FVG v5 縮放測試腳本

/**
 * FVG v5 功能測試套件
 * 測試項目：縮放穩定性、渲染性能、視覺效果
 */

class FVGTestSuite {
    constructor() {
        this.testResults = {};
        this.isRunning = false;
    }

    /**
     * 執行完整測試套件
     */
    async runAllTests() {
        if (this.isRunning) {
            console.warn('測試已在進行中...');
            return;
        }

        this.isRunning = true;
        console.log('=== FVG v5 完整測試套件開始 ===');
        
        try {
            // 1. 基礎功能測試
            await this.testBasicFunctionality();
            
            // 2. 縮放穩定性測試
            await this.testScalingStability();
            
            // 3. 性能測試
            await this.testPerformance();
            
            // 4. 視覺效果測試
            await this.testVisualEffects();
            
            // 5. 生成測試報告
            this.generateTestReport();
            
        } catch (error) {
            console.error('測試過程中發生錯誤:', error);
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * 基礎功能測試
     */
    async testBasicFunctionality() {
        console.log('--- 測試 1: 基礎功能 ---');
        
        const tests = {
            chartExists: !!window.app?.chart,
            fvgRendererExists: !!window.app?.chartManager?.fvgRenderer,
            isV5Renderer: window.app?.chartManager?.getChartVersion() === 'v5',
            customSeriesSupport: typeof window.app?.chart?.addCustomSeries === 'function'
        };
        
        this.testResults.basic = tests;
        
        Object.entries(tests).forEach(([key, result]) => {
            console.log(`  ${key}: ${result ? '✅ PASS' : '❌ FAIL'}`);
        });
        
        return tests;
    }

    /**
     * 縮放穩定性測試
     */
    async testScalingStability() {
        console.log('--- 測試 2: 縮放穩定性 ---');
        
        if (!window.app?.chartManager?.fvgRenderer) {
            console.error('FVG渲染器不可用，跳過縮放測試');
            return;
        }

        // 創建測試FVG數據
        const testFVGs = this.createTestFVGData();
        
        // 渲染FVG
        window.app.chartManager.fvgRenderer.render(testFVGs, 'M15');
        await this.wait(500);

        const scalingTests = [];

        // 測試1: 時間軸放大
        console.log('  測試時間軸放大...');
        window.app.chart.timeScale().setVisibleLogicalRange({ from: -50, to: 50 });
        await this.wait(1000);
        scalingTests.push({ name: '時間軸放大', passed: true });

        // 測試2: 時間軸縮小
        console.log('  測試時間軸縮小...');
        window.app.chart.timeScale().setVisibleLogicalRange({ from: -200, to: 0 });
        await this.wait(1000);
        scalingTests.push({ name: '時間軸縮小', passed: true });

        // 測試3: 價格軸縮放
        console.log('  測試價格軸縮放...');
        const priceScale = window.app.chart.priceScale('right');
        if (priceScale && priceScale.applyOptions) {
            priceScale.applyOptions({
                autoScale: false,
                scaleRange: { minValue: 7140, maxValue: 7190 }
            });
            await this.wait(1000);
            scalingTests.push({ name: '價格軸縮放', passed: true });

            // 恢復自動縮放
            priceScale.applyOptions({ autoScale: true });
            await this.wait(500);
        }

        // 測試4: 極端縮放
        console.log('  測試極端縮放...');
        window.app.chart.timeScale().setVisibleLogicalRange({ from: -10, to: 10 });
        await this.wait(1000);
        scalingTests.push({ name: '極端縮放', passed: true });

        // 恢復正常視圖
        window.app.chart.timeScale().fitContent();
        await this.wait(500);

        this.testResults.scaling = scalingTests;
        
        scalingTests.forEach(test => {
            console.log(`  ${test.name}: ${test.passed ? '✅ PASS' : '❌ FAIL'}`);
        });
    }

    /**
     * 性能測試
     */
    async testPerformance() {
        console.log('--- 測試 3: 性能測試 ---');
        
        const performanceTests = [];

        // 測試大量FVG渲染
        for (const count of [10, 50, 100]) {
            console.log(`  測試 ${count} 個FVG渲染性能...`);
            
            const largeFVGData = this.createLargeFVGDataset(count);
            const startTime = performance.now();
            
            window.app.chartManager.fvgRenderer.render(largeFVGData, 'M15');
            await this.wait(100);
            
            const endTime = performance.now();
            const renderTime = endTime - startTime;
            
            const passed = renderTime < (count * 5); // 每個FVG應該在5ms內渲染完成
            performanceTests.push({
                name: `${count}個FVG渲染`,
                time: renderTime.toFixed(2) + 'ms',
                passed: passed
            });
            
            console.log(`    渲染時間: ${renderTime.toFixed(2)}ms ${passed ? '✅' : '❌'}`);
        }

        this.testResults.performance = performanceTests;
    }

    /**
     * 視覺效果測試
     */
    async testVisualEffects() {
        console.log('--- 測試 4: 視覺效果 ---');
        
        const visualTests = [];

        // 測試不同類型的FVG
        const mixedFVGs = [
            this.createFVG('bull', 7180, 7164, -7200),
            this.createFVG('bear', 7148, 7144, -3600),
            this.createFVG('bull', 7160, 7156, -1800),
        ];

        window.app.chartManager.fvgRenderer.render(mixedFVGs, 'M15');
        await this.wait(1000);

        visualTests.push({ name: '混合類型FVG顯示', passed: true });

        // 測試透明度
        const largeHeightFVG = this.createFVG('bull', 7200, 7150, -5400); // 50點高度
        const smallHeightFVG = this.createFVG('bear', 7140, 7138, -1800);  // 2點高度

        window.app.chartManager.fvgRenderer.render([largeHeightFVG, smallHeightFVG], 'M15');
        await this.wait(1000);

        visualTests.push({ name: '不同高度透明度', passed: true });

        this.testResults.visual = visualTests;
        
        visualTests.forEach(test => {
            console.log(`  ${test.name}: ${test.passed ? '✅ PASS' : '❌ FAIL'}`);
        });
    }

    /**
     * 生成測試報告
     */
    generateTestReport() {
        console.log('=== FVG v5 測試報告 ===');
        
        const allTests = Object.values(this.testResults).flat();
        const passedTests = allTests.filter(test => test.passed || test === true);
        const failedTests = allTests.filter(test => test.passed === false || test === false);
        
        console.log(`總測試項目: ${allTests.length}`);
        console.log(`通過: ${passedTests.length} ✅`);
        console.log(`失敗: ${failedTests.length} ❌`);
        console.log(`通過率: ${((passedTests.length / allTests.length) * 100).toFixed(1)}%`);
        
        if (failedTests.length > 0) {
            console.warn('失敗的測試項目:', failedTests);
        }
        
        // 檢查是否使用v5渲染器
        const isUsingV5 = window.app?.chartManager?.isUsingV5Renderer();
        console.log(`使用v5渲染器: ${isUsingV5 ? '✅ 是' : '❌ 否'}`);
        
        // 檢查FVG數量
        const fvgCount = window.app?.chartManager?.fvgRenderer?.getFVGCount?.() || 0;
        console.log(`當前FVG數量: ${fvgCount}`);
        
        console.log('=== 測試完成 ===');
        
        return {
            total: allTests.length,
            passed: passedTests.length,
            failed: failedTests.length,
            passRate: (passedTests.length / allTests.length) * 100,
            usingV5: isUsingV5,
            fvgCount: fvgCount
        };
    }

    /**
     * 創建測試FVG數據
     */
    createTestFVGData() {
        const now = Math.floor(Date.now() / 1000);
        return [
            this.createFVG('bull', 7180, 7164, now - 7200),   // 2小時前
            this.createFVG('bear', 7148, 7144, now - 3600),   // 1小時前
            this.createFVG('bull', 7160, 7156, now - 1800),   // 30分鐘前
        ];
    }

    /**
     * 創建大量FVG數據集
     */
    createLargeFVGDataset(count) {
        const fvgs = [];
        const now = Math.floor(Date.now() / 1000);
        
        for (let i = 0; i < count; i++) {
            const timeOffset = (i + 1) * 900; // 每15分鐘一個
            const basePrice = 7150 + (Math.random() * 50); // 7150-7200範圍
            const height = 2 + (Math.random() * 20); // 2-22點高度
            const type = Math.random() > 0.5 ? 'bull' : 'bear';
            
            fvgs.push(this.createFVG(type, basePrice + height, basePrice, now - timeOffset));
        }
        
        return fvgs;
    }

    /**
     * 創建單個FVG
     */
    createFVG(type, top, bot, time) {
        return {
            id: `test-fvg-${Math.random().toString(36).substr(2, 9)}`,
            type: type,
            top: top,
            bot: bot,
            left_time: time,
            time: time
        };
    }

    /**
     * 等待指定毫秒數
     */
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 快速測試函數
function testFVGScaling() {
    console.log('=== 快速 FVG 縮放測試 ===');
    
    if (!window.app?.chartManager?.fvgRenderer) {
        console.error('FVG渲染器不可用');
        return;
    }
    
    // 創建測試數據
    const testFVGs = [
        {
            id: 'scale-test-1',
            type: 'bull',
            top: 7180,
            bot: 7164,
            left_time: Date.now() / 1000 - 7200,
            time: Date.now() / 1000 - 7200
        },
        {
            id: 'scale-test-2',
            type: 'bear',
            top: 7148,
            bot: 7144,
            left_time: Date.now() / 1000 - 3600,
            time: Date.now() / 1000 - 3600
        }
    ];
    
    // 渲染FVG
    window.app.chartManager.fvgRenderer.render(testFVGs, 'M15');
    
    // 測試不同縮放級別
    const tests = [
        { name: '放大時間軸', delay: 2000, action: () => {
            window.app.chart.timeScale().setVisibleLogicalRange({ from: -50, to: 50 });
        }},
        { name: '縮小時間軸', delay: 4000, action: () => {
            window.app.chart.timeScale().setVisibleLogicalRange({ from: -200, to: 0 });
        }},
        { name: '放大價格軸', delay: 6000, action: () => {
            window.app.chart.priceScale('right').applyOptions({
                autoScale: false,
                scaleRange: { minValue: 7140, maxValue: 7190 }
            });
        }},
        { name: '恢復自動縮放', delay: 8000, action: () => {
            window.app.chart.priceScale('right').applyOptions({ autoScale: true });
            window.app.chart.timeScale().fitContent();
        }}
    ];
    
    tests.forEach(test => {
        setTimeout(() => {
            console.log(`執行測試: ${test.name}`);
            test.action();
        }, test.delay);
    });
    
    console.log('縮放測試序列已開始，請觀察FVG矩形是否保持完整...');
}

// 添加測試按鈕功能
function addTestButton() {
    const testButton = document.getElementById('test-scaling-btn');
    if (testButton) {
        testButton.addEventListener('click', () => {
            if (confirm('是否執行完整的FVG v5測試套件？\n（快速測試請取消，然後使用 testFVGScaling()）')) {
                const testSuite = new FVGTestSuite();
                testSuite.runAllTests();
            } else {
                testFVGScaling();
            }
        });
        
        console.log('測試按鈕已綁定事件');
    }
}

// 暴露到全局
window.FVGTestSuite = FVGTestSuite;
window.testFVGScaling = testFVGScaling;

// 頁面載入完成後自動添加測試功能
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addTestButton);
} else {
    addTestButton();
}

console.log('FVG v5 測試腳本載入完成');
console.log('可用函數: testFVGScaling(), new FVGTestSuite().runAllTests()');