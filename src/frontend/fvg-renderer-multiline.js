// FVG 多線條渲染器 - 使用半透明多線條填充效果
// 基於 docs/FVG/FVG_Display_Implementation_Guide.md 實現

class FVGRendererMultiline {
    constructor(chart, candlestickSeries) {
        this.chart = chart;
        this.candlestickSeries = candlestickSeries;
        this.fvgPrimitives = [];
        this.fvgMarkers = [];
        this.settings = {
            showFVG: true,
            showFVGMarkers: false,
            showClearedFVGs: true,  // 📊 默認顯示已清除FVG
            maxLines: 130,  // 性能限制
            minLines: 4,
            performanceMode: false
        };
        
        console.log('✅ FVG多線條渲染器初始化完成');
    }
    
    /**
     * 適應性線條數量計算 - 根據FVG大小動態調整線條密度
     * @param {number} fvgGapSize FVG間隔大小
     * @returns {number} 線條數量
     */
    calculateLineCount(fvgGapSize) {
        let baseCount;
        
        if (fvgGapSize >= 100) baseCount = 130;      // 極大間隔
        else if (fvgGapSize >= 80) baseCount = 100;  // 大間隔  
        else if (fvgGapSize >= 50) baseCount = 60;   // 中大間隔
        else if (fvgGapSize >= 30) baseCount = 20;   // 中等間隔
        else if (fvgGapSize >= 15) baseCount = 10;   // 中小間隔
        else if (fvgGapSize >= 5) baseCount = 6;     // 小間隔
        else baseCount = 4;                          // 極小間隔
        
        // 應用性能限制
        return Math.min(baseCount, this.settings.maxLines);
    }
    
    /**
     * 獲取填充顏色 - 低透明度實現半透明疊加效果
     */
    getFillColor(type, isCleared) {
        if (isCleared) return 'rgba(128, 128, 128, 0.08)';
        
        // 使用配置或默認顏色
        const colors = window.CONFIG?.FVG?.COLORS || {
            BULLISH: { FILL: 'rgba(0, 255, 140, 0.08)' },
            BEARISH: { FILL: 'rgba(255, 61, 113, 0.08)' }
        };
        
        return type === 'bullish' ? colors.BULLISH.FILL : colors.BEARISH.FILL;
    }
    
    /**
     * 獲取邊界顏色
     */
    getBorderColor(type, isCleared) {
        if (isCleared) return '#888888';
        
        const colors = window.CONFIG?.FVG?.COLORS || {
            BULLISH: { BORDER: '#00d68f' },
            BEARISH: { BORDER: '#ff3d71' }
        };
        
        return type === 'bullish' ? colors.BULLISH.BORDER : colors.BEARISH.BORDER;
    }
    
    /**
     * 主要渲染方法 - 渲染所有FVG
     */
    render(fvgs, currentTimeframe = 'M15') {
        const startTime = performance.now();
        
        console.log('🎨 FVG渲染器調用 - 開始處理');
        console.log('   - FVG數據:', fvgs ? fvgs.length : 0, '個');
        console.log('   - showFVG設置:', this.settings.showFVG);
        console.log('   - 當前時間框架:', currentTimeframe);
        
        this.clearFVGs();
        
        if (!fvgs || fvgs.length === 0) {
            console.warn('⚠️ FVG渲染跳過 - 沒有FVG數據');
            return;
        }
        
        if (!this.settings.showFVG) {
            console.log('📊 FVG渲染跳過 - 顯示已關閉');
            return;
        }
        
        const validFVGs = fvgs.filter(fvg => fvg.status === 'valid');
        const clearedFVGs = fvgs.filter(fvg => fvg.status === 'cleared');
        
        console.log(`📊 開始渲染FVG - 有效:${validFVGs.length}, 已清除:${clearedFVGs.length}`);
        console.log(`   設置: showClearedFVGs=${this.settings.showClearedFVGs}`);
        
        // 渲染有效FVG
        console.log(`🟢 渲染有效FVG: ${validFVGs.length} 個`);
        validFVGs.forEach((fvg, index) => {
            this.renderSingleFVG(fvg, index, false);
        });
        
        // 渲染已清除FVG (可選)
        if (this.settings.showClearedFVGs) {
            console.log(`🔶 渲染已清除FVG: ${clearedFVGs.length} 個`);
            clearedFVGs.forEach((fvg, index) => {
                this.renderSingleFVG(fvg, validFVGs.length + index, true);
            });
        } else {
            console.log(`⚪ 跳過已清除FVG: ${clearedFVGs.length} 個 (showClearedFVGs=false)`);
        }
        
        this.updateMarkers();
        
        const endTime = performance.now();
        const totalPrimitives = this.fvgPrimitives.length;
        console.log(`✅ FVG渲染完成 - ${totalPrimitives}個圖元，耗時:${(endTime - startTime).toFixed(2)}ms`);
        
        // 性能警告
        if (totalPrimitives > 500) {
            console.warn(`⚠️ 大量圖元渲染 (${totalPrimitives}個)，建議啟用性能模式`);
        }
    }
    
    /**
     * 單個FVG渲染 - 創建多條線形成半透明填充效果
     */
    renderSingleFVG(fvg, index, isCleared) {
        try {
            // 適配後端數據格式 - 兼容不同的價格字段
            const topPrice = fvg.topPrice || fvg.endPrice || fvg.startPrice;
            const bottomPrice = fvg.bottomPrice || fvg.startPrice || fvg.endPrice;
            
            // 確保價格數據存在
            if (topPrice === undefined || bottomPrice === undefined) {
                console.error(`❌ FVG ${index + 1} 價格數據缺失:`, fvg);
                return;
            }
            
            // 修復時間戳格式 - 確保是正確的Unix時間戳
            let startTime = fvg.startTime;
            let endTime = fvg.endTime;
            
            // 檢查時間戳是否需要轉換（如果小於10位數，可能是秒為單位需要轉換）
            if (startTime < 1000000000) {
                startTime = Math.floor(startTime * 1000); // 轉換為毫秒
            }
            if (endTime < 1000000000) {
                endTime = Math.floor(endTime * 1000); // 轉換為毫秒
            }
            
            // 確保時間戳是整數且有效
            startTime = Math.floor(startTime);
            endTime = Math.floor(endTime);
            
            console.log(`🔹 渲染FVG ${index + 1}: ${fvg.type} (${topPrice.toFixed(2)} - ${bottomPrice.toFixed(2)})`);
            console.log(`   startTime: ${startTime} (原始: ${fvg.startTime}), endTime: ${endTime} (原始: ${fvg.endTime}), isCleared: ${isCleared}`);
            console.log(`   原始FVG數據:`, fvg);
            
            const fvgGapSize = Math.abs(topPrice - bottomPrice);
            const numberOfFillLines = this.calculateLineCount(fvgGapSize);
            
            console.log(`   線條數量: ${numberOfFillLines}, 間隔大小: ${fvgGapSize.toFixed(2)}`);
            
            const fillColor = this.getFillColor(fvg.type, isCleared);
            const borderColor = this.getBorderColor(fvg.type, isCleared);
            console.log(`   顏色: fillColor=${fillColor}, borderColor=${borderColor}`);
            
            // 1. 創建填充線條 - 在上下邊界之間均勻分佈
            for (let i = 1; i < numberOfFillLines; i++) {
                const ratio = i / numberOfFillLines;
                const linePrice = bottomPrice + (topPrice - bottomPrice) * ratio;
                
                const fillLineSeries = this.createLineSeries({
                    color: fillColor,
                    lineWidth: 1,
                    lineStyle: LightweightCharts.LineStyle.Solid,
                    priceScaleId: 'right',
                    lastValueVisible: false,
                    priceLineVisible: false,
                });
                
                const lineData = [
                    { time: startTime, value: linePrice },
                    { time: endTime, value: linePrice }
                ];
                
                fillLineSeries.setData(lineData);
                this.fvgPrimitives.push(fillLineSeries);
            }
            
            // 2. 創建邊界線 - 明確標示FVG範圍
            const topBoundary = this.createBoundaryLine(
                topPrice, startTime, endTime, borderColor, isCleared
            );
            const bottomBoundary = this.createBoundaryLine(
                bottomPrice, startTime, endTime, borderColor, isCleared
            );
            
            this.fvgPrimitives.push(topBoundary, bottomBoundary);
            
            // 3. 準備標記數據
            if (this.settings.showFVGMarkers) {
                this.fvgMarkers.push({
                    time: startTime,
                    position: 'belowBar',
                    color: borderColor,
                    shape: 'circle',
                    text: `F${index + 1}`,
                    size: 1
                });
            }
            
        } catch (error) {
            console.error(`❌ FVG渲染失敗 [${index}]:`, error);
            
            // 降級處理：只顯示邊界線
            try {
                this.renderFallbackFVG(fvg, isCleared);
            } catch (fallbackError) {
                console.error('❌ FVG降級渲染也失敗:', fallbackError);
            }
        }
    }
    
    /**
     * 創建LineSeries - v4/v5兼容
     */
    createLineSeries(options) {
        try {
            // v5 API: addSeries(LineSeries, options)
            if (typeof this.chart.addSeries === 'function' && typeof LightweightCharts.LineSeries !== 'undefined') {
                console.log('✅ 使用v5 API: addSeries(LineSeries, options)');
                return this.chart.addSeries(LightweightCharts.LineSeries, options);
            }
            
            // v4 API fallback: addLineSeries(options)
            if (typeof this.chart.addLineSeries === 'function') {
                console.log('✅ 使用v4 API: addLineSeries(options)');
                return this.chart.addLineSeries(options);
            }
            
            throw new Error('No line series creation method available');
            
        } catch (error) {
            console.error('❌ 創建LineSeries失敗:', error);
            throw error;
        }
    }
    
    /**
     * 創建邊界線
     */
    createBoundaryLine(price, startTime, endTime, color, isCleared) {
        const lineSeries = this.createLineSeries({
            color: color,
            lineWidth: 0.5,
            lineStyle: isCleared ? LightweightCharts.LineStyle.Dashed : LightweightCharts.LineStyle.Solid,
            priceScaleId: 'right',
            lastValueVisible: false,
            priceLineVisible: false,
        });
        
        const lineData = [
            { time: startTime, value: price },
            { time: endTime, value: price }
        ];
        
        lineSeries.setData(lineData);
        return lineSeries;
    }
    
    /**
     * 降級FVG渲染 - 只顯示邊界線
     */
    renderFallbackFVG(fvg, isCleared) {
        // 適配後端數據格式
        const topPrice = fvg.topPrice || fvg.endPrice || fvg.startPrice;
        const bottomPrice = fvg.bottomPrice || fvg.startPrice || fvg.endPrice;
        
        if (topPrice === undefined || bottomPrice === undefined) {
            console.error('❌ 降級渲染失敗 - 價格數據缺失');
            return;
        }
        
        const borderColor = this.getBorderColor(fvg.type, isCleared);
        
        // 修復時間戳格式 - 確保是正確的Unix時間戳
        let startTime = fvg.startTime;
        let endTime = fvg.endTime;
        
        // 檢查時間戳是否需要轉換
        if (startTime < 1000000000) {
            startTime = Math.floor(startTime * 1000);
        }
        if (endTime < 1000000000) {
            endTime = Math.floor(endTime * 1000);
        }
        
        startTime = Math.floor(startTime);
        endTime = Math.floor(endTime);

        const topBoundary = this.createBoundaryLine(
            topPrice, startTime, endTime, borderColor, isCleared
        );
        const bottomBoundary = this.createBoundaryLine(
            bottomPrice, startTime, endTime, borderColor, isCleared
        );
        
        this.fvgPrimitives.push(topBoundary, bottomBoundary);
        console.log('⚠️ 使用降級模式渲染FVG (僅邊界線)');
    }
    
    /**
     * 清除所有FVG圖元
     */
    clearFVGs() {
        this.fvgPrimitives.forEach(primitive => {
            try {
                this.chart.removeSeries(primitive);
            } catch (error) {
                // 忽略清除錯誤，可能是圖表已經清理
            }
        });
        this.fvgPrimitives = [];
        this.fvgMarkers = [];
        
        // 清除標記 - v4/v5兼容
        this.clearMarkers();
    }
    
    /**
     * 更新標記顯示 - v4/v5兼容
     */
    updateMarkers() {
        if (this.settings.showFVGMarkers && this.fvgMarkers.length > 0) {
            this.setMarkers(this.fvgMarkers);
        } else {
            this.clearMarkers();
        }
    }
    
    /**
     * 設置標記 - v4/v5兼容性處理
     */
    setMarkers(markers) {
        if (!this.candlestickSeries) {
            console.warn('⚠️ candlestickSeries 不存在，無法設置標記');
            return;
        }
        
        try {
            // v4 API
            if (typeof this.candlestickSeries.setMarkers === 'function') {
                this.candlestickSeries.setMarkers(markers);
                console.log('✅ 使用v4 setMarkers API');
                return;
            }
            
            // v5 可能的替代方案
            if (typeof this.candlestickSeries.applyOptions === 'function') {
                console.warn('⚠️ v5環境中setMarkers不可用，嘗試替代方案');
                // v5中標記可能需要通過其他方式設置，暫時跳過
                return;
            }
            
            console.warn('⚠️ 找不到支持的標記API');
            
        } catch (error) {
            console.error('❌ 設置標記失敗:', error);
        }
    }
    
    /**
     * 清除標記 - v4/v5兼容性處理  
     */
    clearMarkers() {
        this.setMarkers([]);
    }
    
    // === 控制方法 ===
    
    /**
     * 切換FVG顯示
     */
    toggle() {
        this.settings.showFVG = !this.settings.showFVG;
        console.log(`🎛️ FVG顯示: ${this.settings.showFVG ? '開啟' : '關閉'}`);
        
        // 如果關閉顯示，清除所有FVG
        if (!this.settings.showFVG) {
            this.clearFVGs();
        }
        
        return this.settings.showFVG;
    }
    
    /**
     * 設置顯示狀態 - 兼容舊API
     */
    setVisible(visible) {
        console.log(`🎛️ setVisible調用: ${visible}`);
        this.settings.showFVG = visible;
        
        // 如果關閉顯示，清除所有FVG
        if (!visible) {
            console.log('🧹 清除所有FVG (setVisible=false)');
            this.clearFVGs();
        }
        
        return this.settings.showFVG;
    }
    
    /**
     * 獲取顯示狀態
     */
    getVisible() {
        return this.settings.showFVG;
    }
    
    /**
     * 清除所有FVG - 兼容舊API (別名方法)
     */
    clearAll() {
        console.log('🧹 clearAll調用 - 清除所有FVG');
        this.clearFVGs();
    }
    
    /**
     * 切換標記顯示
     */
    toggleMarkers() {
        this.settings.showFVGMarkers = !this.settings.showFVGMarkers;
        console.log(`🏷️ FVG標記: ${this.settings.showFVGMarkers ? '開啟' : '關閉'}`);
        return this.settings.showFVGMarkers;
    }
    
    /**
     * 切換已清除FVG顯示
     */
    toggleClearedFVGs() {
        this.settings.showClearedFVGs = !this.settings.showClearedFVGs;
        console.log(`👻 已清除FVG: ${this.settings.showClearedFVGs ? '開啟' : '關閉'}`);
        return this.settings.showClearedFVGs;
    }
    
    // === 性能方法 ===
    
    /**
     * 設置最大線條數
     */
    setMaxLines(maxLines) {
        const newMax = Math.max(4, Math.min(200, maxLines));
        const oldMax = this.settings.maxLines;
        this.settings.maxLines = newMax;
        console.log(`⚙️ 最大線條數: ${oldMax} → ${newMax}`);
    }
    
    /**
     * 啟用/停用性能模式
     */
    enablePerformanceMode(enabled) {
        this.settings.performanceMode = enabled;
        if (enabled) {
            this.setMaxLines(50);  // 性能模式限制
            console.log('🚀 啟用FVG性能模式 (最大50條線/FVG)');
        } else {
            this.setMaxLines(130); // 恢復高質量模式
            console.log('🎨 停用FVG性能模式 (最大130條線/FVG)');
        }
    }
    
    /**
     * 獲取渲染統計信息
     */
    getStats() {
        return {
            totalPrimitives: this.fvgPrimitives.length,
            totalMarkers: this.fvgMarkers.length,
            settings: { ...this.settings },
            rendererType: 'multiline'
        };
    }
    
    /**
     * 性能追蹤渲染
     */
    renderWithPerformanceTracking(fvgs, currentTimeframe) {
        const startTime = performance.now();
        const totalLines = fvgs.reduce((sum, fvg) => {
            const gapSize = Math.abs(fvg.topPrice - fvg.bottomPrice);
            return sum + this.calculateLineCount(gapSize);
        }, 0);
        
        console.log(`📊 開始渲染 ${fvgs.length} 個FVG，預計 ${totalLines} 條線`);
        
        this.render(fvgs, currentTimeframe);
        
        const endTime = performance.now();
        console.log(`⏱️ FVG渲染性能追蹤: ${(endTime - startTime).toFixed(2)}ms`);
        
        // 性能警告
        if (totalLines > 500) {
            console.warn(`⚠️ 大量線條渲染 (${totalLines}條)，建議啟用性能模式`);
        }
        
        return {
            renderTime: endTime - startTime,
            totalLines: totalLines,
            fvgCount: fvgs.length
        };
    }
}

// 暴露到全局範圍
window.FVGRendererMultiline = FVGRendererMultiline;

console.log('📦 FVGRendererMultiline 模組載入完成');