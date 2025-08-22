// FVG修復測試腳本
// 在瀏覽器控制台運行此腳本來測試修復是否成功

console.group('🧪 FVG修復測試');

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function testFVGFix() {
    console.log('開始FVG修復測試...');
    
    // 等待頁面完全載入
    if (!window.chartManager || !window.dataManager) {
        console.log('等待頁面完全載入...');
        await delay(2000);
    }
    
    // 1. 測試後端數據
    console.log('1. 測試後端數據載入');
    try {
        const response = await fetch('/api/random-data?timeframe=M15');
        const data = await response.json();
        console.log('✅ 後端數據載入成功');
        console.log(`   - FVG數量: ${data.fvgs ? data.fvgs.length : 0}`);
        
        if (!data.fvgs || data.fvgs.length === 0) {
            console.warn('⚠️ 後端沒有返回FVG數據，嘗試重新載入...');
            // 嘗試重新載入一次
            const response2 = await fetch('/api/random-data?timeframe=M15');
            const data2 = await response2.json();
            console.log(`   - 重新載入FVG數量: ${data2.fvgs ? data2.fvgs.length : 0}`);
        }
    } catch (error) {
        console.error('❌ 後端數據載入失敗:', error);
        return;
    }
    
    // 2. 測試FVG渲染器
    console.log('2. 測試FVG渲染器狀態');
    if (!window.chartManager || !window.chartManager.fvgRenderer) {
        console.error('❌ FVG渲染器未初始化');
        return;
    }
    console.log('✅ FVG渲染器已初始化');
    
    // 3. 測試複選框狀態
    console.log('3. 測試FVG複選框狀態');
    const fvgCheckbox = document.getElementById('fvg-checkbox');
    if (!fvgCheckbox) {
        console.error('❌ FVG複選框不存在');
        return;
    }
    console.log(`   - FVG複選框狀態: ${fvgCheckbox.checked ? '✅勾選' : '❌未勾選'}`);
    
    if (!fvgCheckbox.checked) {
        console.log('修正: 勾選FVG複選框');
        fvgCheckbox.checked = true;
        fvgCheckbox.dispatchEvent(new Event('change'));
        await delay(500);
    }
    
    // 4. 測試手動觸發FVG顯示
    console.log('4. 測試手動觸發FVG顯示');
    if (window.currentData && window.currentData.fvgs) {
        console.log(`   - 當前數據FVG數量: ${window.currentData.fvgs.length}`);
        
        try {
            window.chartManager.fvgRenderer.setVisible(true);
            window.chartManager.updateFVGs(window.currentData.fvgs, 'M15');
            console.log('✅ 手動觸發FVG渲染成功');
            
            // 檢查渲染統計
            await delay(500);
            if (window.chartManager.fvgRenderer.getStats) {
                const stats = window.chartManager.fvgRenderer.getStats();
                console.log('   - 渲染統計:', stats);
            }
        } catch (error) {
            console.error('❌ 手動觸發FVG渲染失敗:', error);
        }
    } else {
        console.warn('⚠️ 無當前FVG數據');
    }
    
    // 5. 測試切換功能
    console.log('5. 測試FVG切換功能');
    try {
        // 關閉FVG
        console.log('   - 關閉FVG');
        fvgCheckbox.checked = false;
        fvgCheckbox.dispatchEvent(new Event('change'));
        await delay(500);
        
        // 重新開啟FVG
        console.log('   - 重新開啟FVG');
        fvgCheckbox.checked = true;
        fvgCheckbox.dispatchEvent(new Event('change'));
        await delay(500);
        
        console.log('✅ FVG切換功能測試完成');
    } catch (error) {
        console.error('❌ FVG切換功能測試失敗:', error);
    }
    
    // 6. 最終狀態檢查
    console.log('6. 最終狀態檢查');
    console.log('   - 圖表管理器:', !!window.chartManager);
    console.log('   - FVG渲染器:', !!window.chartManager?.fvgRenderer);
    console.log('   - 當前數據:', !!window.currentData);
    console.log('   - FVG數據:', window.currentData?.fvgs?.length || 0);
    console.log('   - FVG複選框:', document.getElementById('fvg-checkbox')?.checked);
    
    if (window.chartManager?.fvgRenderer) {
        const renderer = window.chartManager.fvgRenderer;
        console.log('   - 渲染器設定:', renderer.settings);
        console.log('   - FVG圖元數量:', renderer.fvgPrimitives?.length || 0);
        console.log('   - FVG標記數量:', renderer.fvgMarkers?.length || 0);
        
        // 運行內部診斷（如果可用）
        if (typeof renderer.runDiagnostics === 'function') {
            const diagnostics = renderer.runDiagnostics();
            console.log('   - 內部診斷:', diagnostics);
        }
    }
    
    console.log('✅ FVG修復測試完成');
}

// 註冊全域函數
window.testFVGFix = testFVGFix;

// 自動運行測試
if (document.readyState === 'complete') {
    console.log('頁面已載入完成，2秒後開始測試...');
    setTimeout(testFVGFix, 2000);
} else {
    console.log('等待頁面載入完成...');
    window.addEventListener('load', () => {
        setTimeout(testFVGFix, 2000);
    });
}

console.groupEnd();

// 使用說明
console.log('📖 使用說明:');
console.log('- 運行 testFVGFix() 來測試FVG修復');
console.log('- 檢查瀏覽器開發者工具的控制台輸出');
console.log('- 確認圖表上是否顯示了FVG矩形');