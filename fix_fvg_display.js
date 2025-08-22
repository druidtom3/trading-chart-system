// FVG顯示問題修復腳本
// 在瀏覽器控制台中運行此腳本來診斷和修復FVG顯示問題

console.group('🔧 FVG顯示修復腳本');

// 1. 診斷當前狀態
console.log('📊 第1步: 診斷當前狀態');
console.log('   - LightweightCharts可用:', typeof LightweightCharts !== 'undefined');
console.log('   - FVGRendererMultiline可用:', typeof window.FVGRendererMultiline !== 'undefined');
console.log('   - 應用初始化:', !!window.app);
console.log('   - 圖表管理器:', !!window.chartManager);
console.log('   - 數據管理器:', !!window.dataManager);
console.log('   - FVG渲染器:', !!window.chartManager?.fvgRenderer);
console.log('   - 當前數據:', !!window.currentData);
console.log('   - FVG數據:', window.currentData?.fvgs?.length || 0);

// 2. 檢查FVG複選框狀態
console.log('📊 第2步: 檢查控制項狀態');
const fvgCheckbox = document.getElementById('fvg-checkbox');
const fvgClearedCheckbox = document.getElementById('fvg-cleared-checkbox');
console.log('   - 主FVG複選框:', fvgCheckbox ? (fvgCheckbox.checked ? '✅勾選' : '❌未勾選') : '❌不存在');
console.log('   - 已清除FVG複選框:', fvgClearedCheckbox ? (fvgClearedCheckbox.checked ? '✅勾選' : '❌未勾選') : '❌不存在');

// 3. 嘗試修復
console.log('🔧 第3步: 嘗試修復');

// 修復1: 確保FVG複選框是勾選的
if (fvgCheckbox && !fvgCheckbox.checked) {
    console.log('修復1: 勾選FVG主複選框');
    fvgCheckbox.checked = true;
    fvgCheckbox.dispatchEvent(new Event('change'));
}

// 修復2: 確保已清除FVG複選框是勾選的（顯示更多FVG）
if (fvgClearedCheckbox && !fvgClearedCheckbox.checked) {
    console.log('修復2: 勾選已清除FVG複選框');
    fvgClearedCheckbox.checked = true;
    fvgClearedCheckbox.dispatchEvent(new Event('change'));
}

// 修復3: 重新初始化FVG渲染器（如果需要）
if (window.chartManager && !window.chartManager.fvgRenderer) {
    console.log('修復3: 重新初始化FVG渲染器');
    try {
        if (window.FVGRendererMultiline && window.chartManager.chart && window.chartManager.candlestickSeries) {
            window.chartManager.fvgRenderer = new FVGRendererMultiline(
                window.chartManager.chart, 
                window.chartManager.candlestickSeries
            );
            console.log('✅ FVG渲染器重新初始化成功');
        } else {
            console.log('❌ 無法重新初始化FVG渲染器，缺少必要組件');
        }
    } catch (error) {
        console.error('❌ FVG渲染器重新初始化失敗:', error);
    }
}

// 修復4: 強制重新載入和渲染FVG數據
if (window.currentData && window.currentData.fvgs && window.chartManager?.fvgRenderer) {
    console.log('修復4: 強制重新渲染FVG');
    try {
        // 清除現有FVG
        window.chartManager.fvgRenderer.clearFVGs();
        
        // 重新渲染
        window.chartManager.fvgRenderer.render(window.currentData.fvgs, window.currentTimeframe || 'M15');
        console.log('✅ FVG重新渲染完成');
        
        // 檢查渲染結果
        const stats = window.chartManager.fvgRenderer.getStats();
        console.log('渲染統計:', stats);
        
    } catch (error) {
        console.error('❌ FVG重新渲染失敗:', error);
    }
} else {
    console.log('❌ 無法重新渲染FVG，缺少數據或渲染器');
}

// 修復5: 如果沒有數據，嘗試重新載入
if (!window.currentData || !window.currentData.fvgs) {
    console.log('修復5: 嘗試重新載入數據');
    if (window.dataManager && typeof window.dataManager.loadRandomData === 'function') {
        console.log('正在重新載入隨機數據...');
        window.dataManager.loadRandomData('M15').then(data => {
            console.log('✅ 數據重新載入完成');
            console.log('   - FVG數量:', data.fvgs ? data.fvgs.length : 0);
            
            // 更新全局數據
            window.currentData = data;
            
            // 觸發圖表更新
            if (window.chartManager) {
                window.chartManager.updateChart(data);
            }
        }).catch(error => {
            console.error('❌ 數據重新載入失敗:', error);
        });
    } else {
        console.log('❌ DataManager不可用，無法重新載入數據');
    }
}

// 6. 提供手動診斷函數
console.log('📊 第4步: 註冊診斷函數');
window.diagnoseFVGIssue = function() {
    console.group('🔍 FVG問題診斷');
    
    console.log('系統狀態:');
    console.log('   - 應用:', !!window.app);
    console.log('   - 圖表管理器:', !!window.chartManager);
    console.log('   - FVG渲染器:', !!window.chartManager?.fvgRenderer);
    console.log('   - 渲染器類型:', window.chartManager?.fvgRenderer?.constructor.name);
    console.log('   - 當前數據:', !!window.currentData);
    console.log('   - FVG數據數量:', window.currentData?.fvgs?.length || 0);
    
    const fvgCheckbox = document.getElementById('fvg-checkbox');
    console.log('   - FVG複選框狀態:', fvgCheckbox?.checked);
    
    if (window.chartManager?.fvgRenderer) {
        console.log('FVG渲染器狀態:');
        const renderer = window.chartManager.fvgRenderer;
        console.log('   - 圖表引用:', !!renderer.chart);
        console.log('   - K線系列引用:', !!renderer.candlestickSeries);
        console.log('   - 設定:', renderer.settings);
        console.log('   - 圖元數量:', renderer.fvgPrimitives?.length || 0);
        console.log('   - 標記數量:', renderer.fvgMarkers?.length || 0);
        
        if (typeof renderer.runDiagnostics === 'function') {
            console.log('運行渲染器內部診斷...');
            const diag = renderer.runDiagnostics();
            console.log('內部診斷結果:', diag);
        }
    }
    
    console.groupEnd();
};

// 7. 提供手動修復函數
window.manualFixFVG = function() {
    console.log('🔧 執行手動FVG修復...');
    
    // 確保複選框勾選
    const fvgCheckbox = document.getElementById('fvg-checkbox');
    if (fvgCheckbox) fvgCheckbox.checked = true;
    
    const fvgClearedCheckbox = document.getElementById('fvg-cleared-checkbox');
    if (fvgClearedCheckbox) fvgClearedCheckbox.checked = true;
    
    // 如果有數據和渲染器，強制渲染
    if (window.currentData?.fvgs && window.chartManager?.fvgRenderer) {
        try {
            window.chartManager.fvgRenderer.clearFVGs();
            window.chartManager.fvgRenderer.render(window.currentData.fvgs, window.currentTimeframe || 'M15');
            console.log('✅ 手動FVG修復完成');
        } catch (error) {
            console.error('❌ 手動FVG修復失敗:', error);
        }
    } else {
        console.log('❌ 缺少數據或渲染器，無法修復');
    }
};

console.log('✅ 修復腳本執行完成');
console.log('📖 可用的診斷命令:');
console.log('   - diagnoseFVGIssue(): 診斷FVG問題');
console.log('   - manualFixFVG(): 手動修復FVG顯示');
console.log('   - window.runFullFVGDiagnostics(): 運行完整FVG診斷（如果可用）');

console.groupEnd();