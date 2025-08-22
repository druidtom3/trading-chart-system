// 快速驗證修復腳本 - 在瀏覽器控制台運行

console.log('🔧 開始驗證修復...');

// 1. 檢查API連接
async function checkAPI() {
    try {
        console.log('1. 測試API連接...');
        const response = await fetch('http://127.0.0.1:5001/api/health');
        const data = await response.json();
        console.log('✅ API連接成功:', data.service, data.status);
        return true;
    } catch (error) {
        console.error('❌ API連接失敗:', error);
        return false;
    }
}

// 2. 檢查數據載入
async function checkDataLoad() {
    try {
        console.log('2. 測試數據載入...');
        const response = await fetch('http://127.0.0.1:5001/api/random-data?timeframe=M15');
        const data = await response.json();
        console.log('✅ 數據載入成功');
        console.log(`   - K線數量: ${data.data ? data.data.length : 0}`);
        console.log(`   - FVG數量: ${data.fvgs ? data.fvgs.length : 0}`);
        return data;
    } catch (error) {
        console.error('❌ 數據載入失敗:', error);
        return null;
    }
}

// 3. 檢查前端狀態
function checkFrontend() {
    console.log('3. 檢查前端狀態...');
    console.log('   - ChartManager:', !!window.chartManager);
    console.log('   - DataManager:', !!window.dataManager);
    console.log('   - FVG渲染器:', !!window.chartManager?.fvgRenderer);
    console.log('   - 當前數據:', !!window.currentData);
    
    if (window.currentData) {
        console.log(`   - 當前數據K線: ${window.currentData.data ? window.currentData.data.length : 0}`);
        console.log(`   - 當前數據FVG: ${window.currentData.fvgs ? window.currentData.fvgs.length : 0}`);
    }
}

// 4. 完整驗證
async function fullVerify() {
    console.group('🧪 完整驗證');
    
    const apiOK = await checkAPI();
    if (!apiOK) {
        console.error('❌ API檢查失敗，停止驗證');
        return;
    }
    
    const data = await checkDataLoad();
    if (!data) {
        console.error('❌ 數據載入失敗，停止驗證');
        return;
    }
    
    checkFrontend();
    
    // 如果有數據但前端沒有，嘗試手動載入
    if (data.fvgs && data.fvgs.length > 0) {
        if (!window.currentData || !window.currentData.fvgs) {
            console.log('4. 嘗試手動更新前端數據...');
            window.currentData = data;
            if (window.chartManager) {
                try {
                    window.chartManager.updateData(data.data);
                    if (window.chartManager.fvgRenderer) {
                        window.chartManager.updateFVGs(data.fvgs, 'M15');
                    }
                    console.log('✅ 手動更新成功');
                } catch (error) {
                    console.error('❌ 手動更新失敗:', error);
                }
            }
        }
        
        // 確保FVG複選框勾選
        const fvgCheckbox = document.getElementById('fvg-checkbox');
        if (fvgCheckbox && !fvgCheckbox.checked) {
            console.log('5. 勾選FVG複選框...');
            fvgCheckbox.checked = true;
            fvgCheckbox.dispatchEvent(new Event('change'));
        }
    }
    
    console.log('🎯 驗證完成！');
    console.log('請檢查圖表是否顯示K線和FVG');
    
    console.groupEnd();
}

// 自動運行
if (document.readyState === 'complete') {
    setTimeout(fullVerify, 1000);
} else {
    window.addEventListener('load', () => setTimeout(fullVerify, 1000));
}

// 也註冊為全域函數
window.verifyFix = fullVerify;