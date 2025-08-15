// 檔名：fvg-renderer-v5.js - Lightweight Charts v5 FVG渲染器
// 使用v5的Custom Series API實現完美的矩形FVG渲染

/**
 * FVG Custom Series Renderer for Lightweight Charts v5
 * 解決縮放失準問題的完美矩形渲染
 */
class FVGCustomSeriesRenderer {
    constructor() {
        this._data = [];
        this._hoveredFVG = null;
    }

    draw(target, priceConverter) {
        const ctx = target.context;
        const timeScale = target.timeScale;
        
        // 保存上下文狀態
        ctx.save();
        
        // DPI 處理
        const dpr = window.devicePixelRatio || 1;
        
        try {
            this._data.forEach(fvg => {
                this._drawFVG(ctx, fvg, timeScale, priceConverter, dpr);
            });
        } catch (error) {
            console.warn('FVG渲染過程中發生錯誤:', error);
        }
        
        // 恢復上下文狀態
        ctx.restore();
    }
    
    _drawFVG(ctx, fvg, timeScale, priceConverter, dpr) {
        // 轉換時間座標
        const x1 = timeScale.timeToCoordinate(fvg.startTime);
        const x2 = timeScale.timeToCoordinate(fvg.endTime);
        
        // 檢查是否在可視範圍內（性能優化）
        if (x1 === null || x2 === null) return;
        const canvasWidth = ctx.canvas.width / dpr;
        if (x2 < -50 || x1 > canvasWidth + 50) return; // 給予一些邊距
        
        // 轉換價格座標
        const y1 = priceConverter.priceToCoordinate(fvg.upper);
        const y2 = priceConverter.priceToCoordinate(fvg.lower);
        
        if (y1 === null || y2 === null) return;
        
        // 計算矩形參數
        const x = Math.min(x1, x2);
        const y = Math.min(y1, y2);
        const width = Math.abs(x2 - x1);
        const height = Math.abs(y2 - y1);
        
        // 跳過太小的矩形（性能優化）
        if (width < 0.5 || height < 0.5) return;
        
        // 計算透明度（基於像素高度和FVG類型）
        const opacity = this._calculateOpacity(height, fvg);
        const baseColor = this._getFVGColor(fvg.type, opacity);
        const borderColor = this._getFVGColor(fvg.type, Math.min(opacity * 2, 0.6));
        
        // 繪製填充矩形
        ctx.fillStyle = baseColor;
        ctx.fillRect(x, y, width, height);
        
        // 繪製邊框（像素對齊）
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1;
        
        // 像素對齊確保清晰的邊框
        const alignedX = Math.floor(x) + 0.5;
        const alignedY = Math.floor(y) + 0.5;
        const alignedWidth = Math.floor(width);
        const alignedHeight = Math.floor(height);
        
        ctx.strokeRect(alignedX, alignedY, alignedWidth, alignedHeight);
        
        // 如果FVG被懸停，繪製額外高亮
        if (this._hoveredFVG && this._hoveredFVG.id === fvg.id) {
            this._drawHoverHighlight(ctx, alignedX, alignedY, alignedWidth, alignedHeight, fvg.type);
        }
        
        // 可選：繪製FVG標籤（調試用）
        if (window.CONFIG?.DEBUG && window.CONFIG?.FVG?.SHOW_LABELS) {
            this._drawFVGLabel(ctx, fvg, x, y, width, height);
        }
    }
    
    _calculateOpacity(pixelHeight, fvg) {
        // 基礎透明度
        let baseOpacity = 0.15;
        
        // 根據像素高度調整
        if (pixelHeight > 100) {
            baseOpacity = 0.25;
        } else if (pixelHeight > 50) {
            baseOpacity = 0.20;
        } else if (pixelHeight < 10) {
            baseOpacity = 0.10;
        }
        
        // 根據FVG類型微調（可選）
        if (fvg.type === 'bear') {
            baseOpacity *= 1.1; // bear FVG 稍微深一點
        }
        
        return Math.min(baseOpacity, 0.3); // 最大透明度限制
    }
    
    _getFVGColor(type, opacity) {
        const colors = {
            bull: `rgba(76, 175, 80, ${opacity})`,   // 綠色
            bear: `rgba(244, 67, 54, ${opacity})`    // 紅色
        };
        return colors[type] || colors.bull;
    }
    
    _drawHoverHighlight(ctx, x, y, width, height, type) {
        // 繪製懸停高亮效果
        ctx.strokeStyle = this._getFVGColor(type, 0.8);
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 1, y - 1, width + 2, height + 2);
    }
    
    _drawFVGLabel(ctx, fvg, x, y, width, height) {
        // 繪製調試標籤
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.font = '10px Arial';
        const label = `${fvg.id} (${fvg.type})`;
        const labelX = x + 2;
        const labelY = y + 12;
        
        // 背景
        const metrics = ctx.measureText(label);
        ctx.fillRect(labelX - 1, labelY - 10, metrics.width + 2, 12);
        
        // 文字
        ctx.fillStyle = 'white';
        ctx.fillText(label, labelX, labelY);
    }
    
    update(data) {
        this._data = data || [];
        if (window.CONFIG?.DEBUG) {
            console.log('FVG Custom Series 更新數據:', this._data.length, '個FVG');
        }
    }
    
    setHoveredFVG(fvgId) {
        this._hoveredFVG = fvgId ? { id: fvgId } : null;
    }
}

/**
 * FVG Custom Series for Lightweight Charts v5
 */
class FVGCustomSeries {
    constructor() {
        this.renderer = new FVGCustomSeriesRenderer();
        this._lastValue = 0;
    }
    
    priceValueBuilder(plotRow) {
        // v5 要求：返回價格值用於自動縮放
        return plotRow.value || this._lastValue;
    }
    
    isWhitespace(data) {
        // v5 要求：判斷是否為空白數據
        return data.value === undefined || data.value === null;
    }
    
    renderer() {
        // v5 要求：返回渲染器實例
        return this.renderer;
    }
    
    update(data, timeframe = 'M15') {
        if (!data || !Array.isArray(data)) {
            this.renderer.update([]);
            return;
        }
        
        // 轉換數據格式
        const timeStep = ConfigUtils.getTimeframeSeconds(timeframe);
        const processedData = data.map(fvg => {
            const startTime = fvg.left_time || fvg.time;
            let endTime = fvg.clear_time;
            
            // 如果沒有清除時間，使用預設延伸
            if (!endTime) {
                const extensionPeriods = CONFIG?.FVG?.DISPLAY_LENGTH || 40;
                endTime = startTime + (extensionPeriods * timeStep);
            }
            
            this._lastValue = Math.max(fvg.top, fvg.bot); // 更新最後價格值
            
            return {
                startTime: startTime,
                endTime: endTime,
                upper: Math.max(fvg.top, fvg.bot),
                lower: Math.min(fvg.top, fvg.bot),
                type: fvg.type,
                id: fvg.id,
                // 保留原始數據
                originalData: fvg
            };
        });
        
        this.renderer.update(processedData);
    }
}

/**
 * FVG Renderer V5 - 主要渲染管理器
 */
class FVGRendererV5 {
    constructor(chart, candlestickSeries) {
        this.chart = chart;
        this.candlestickSeries = candlestickSeries;
        this.customSeries = null;
        this.fvgSeries = new FVGCustomSeries();
        this.isVisible = true;
        this.currentTimeframe = 'M15';
        this.lastData = [];
        
        // 檢查v5功能可用性
        this.isV5Available = typeof this.chart.addCustomSeries === 'function';
        
        if (window.CONFIG?.DEBUG) {
            console.log('FVGRendererV5 初始化:', {
                isV5Available: this.isV5Available,
                chartType: typeof this.chart
            });
        }
    }
    
    render(fvgs, currentTimeframe = 'M15', playbackMode = false) {
        this.currentTimeframe = currentTimeframe;
        
        if (window.CONFIG?.DEBUG) {
            console.log('FVGRendererV5.render:', {
                fvgCount: fvgs?.length || 0,
                timeframe: currentTimeframe,
                isVisible: this.isVisible,
                isV5Available: this.isV5Available
            });
        }
        
        // 清除舊的系列
        if (this.customSeries) {
            try {
                this.chart.removeSeries(this.customSeries);
                this.customSeries = null;
            } catch (error) {
                console.warn('清除舊FVG系列時發生錯誤:', error);
            }
        }
        
        if (!this.isVisible || !fvgs || fvgs.length === 0) {
            return;
        }
        
        // 過濾太小的FVG
        const filteredFvgs = fvgs.filter(fvg => {
            const height = Math.abs(fvg.top - fvg.bot);
            return height >= 1.0; // 最小高度過濾器
        });
        
        if (filteredFvgs.length === 0) {
            if (window.CONFIG?.DEBUG) {
                console.log('過濾後無FVG需要渲染');
            }
            return;
        }
        
        this.lastData = filteredFvgs;
        
        // 嘗試使用v5 Custom Series
        if (this.isV5Available) {
            try {
                this._renderWithCustomSeries(filteredFvgs, currentTimeframe);
            } catch (error) {
                console.error('v5 Custom Series 渲染失敗:', error);
                this._fallbackRender(filteredFvgs, currentTimeframe);
            }
        } else {
            console.warn('Custom Series API 不可用，使用降級渲染');
            this._fallbackRender(filteredFvgs, currentTimeframe);
        }
    }
    
    _renderWithCustomSeries(fvgs, timeframe) {
        if (window.CONFIG?.DEBUG) {
            console.log('使用 v5 Custom Series 渲染', fvgs.length, '個FVG');
        }
        
        // 創建自定義系列
        this.customSeries = this.chart.addCustomSeries(this.fvgSeries, {
            priceScaleId: 'right',
            lastValueVisible: false,
            priceLineVisible: false,
            crosshairMarkerVisible: false,
        });
        
        // 更新FVG數據
        this.fvgSeries.update(fvgs, timeframe);
        
        // 設置虛擬數據以觸發渲染
        // v5需要至少一個數據點來觸發自定義渲染器
        const dummyData = [{
            time: Math.floor(Date.now() / 1000),
            value: this.fvgSeries._lastValue || 0
        }];
        
        this.customSeries.setData(dummyData);
        
        if (window.CONFIG?.DEBUG) {
            console.log('v5 Custom Series 創建成功');
        }
    }
    
    _fallbackRender(fvgs, timeframe) {
        console.warn('使用降級渲染方案 - 可能是v4或API不支援');
        
        // 降級到v4兼容模式或其他渲染方式
        if (window.FVGRenderer) {
            // 如果有舊版渲染器，使用它
            if (!this._fallbackRenderer) {
                this._fallbackRenderer = new FVGRenderer(this.chart, this.candlestickSeries);
            }
            this._fallbackRenderer.render(fvgs, timeframe);
        } else {
            console.error('沒有可用的降級渲染方案');
        }
    }
    
    clearAll() {
        if (this.customSeries) {
            try {
                this.chart.removeSeries(this.customSeries);
                this.customSeries = null;
            } catch (error) {
                console.warn('清除FVG系列時發生錯誤:', error);
            }
        }
        
        if (this._fallbackRenderer) {
            this._fallbackRenderer.clearAll();
        }
    }
    
    toggle() {
        this.isVisible = !this.isVisible;
        
        if (!this.isVisible) {
            this.clearAll();
        } else if (this.lastData.length > 0) {
            // 重新渲染最後的數據
            this.render(this.lastData, this.currentTimeframe);
        }
        
        return this.isVisible;
    }
    
    setVisible(visible) {
        if (this.isVisible !== visible) {
            this.toggle();
        }
    }
    
    // 額外功能：設置懸停FVG（用於交互）
    setHoveredFVG(fvgId) {
        if (this.fvgSeries && this.fvgSeries.renderer) {
            this.fvgSeries.renderer.setHoveredFVG(fvgId);
            // 觸發重繪
            if (this.customSeries) {
                this.chart.applyOptions({});
            }
        }
    }
    
    // 獲取當前渲染的FVG數量
    getFVGCount() {
        return this.lastData.length;
    }
    
    // 檢查是否使用v5渲染
    isUsingV5Renderer() {
        return this.isV5Available && this.customSeries !== null;
    }
}

// 導出到全局作用域
window.FVGRendererV5 = FVGRendererV5;
window.FVGCustomSeries = FVGCustomSeries;
window.FVGCustomSeriesRenderer = FVGCustomSeriesRenderer;

if (window.CONFIG?.DEBUG) {
    console.log('FVG Renderer V5 模組載入完成');
}