// 檔名：fvg-custom-series.js - 改進的自定義FVG渲染器

class FVGCustomRenderer {
    constructor(chart) {
        this.chart = chart;
        this.fvgs = [];
        this.series = null;
    }
    
    createRenderer() {
        const self = this;
        
        return {
            // 主要繪製函數
            draw: (params) => {
                const { context: ctx, bitmapSize, mediaSize, 
                        horizontalPixelRatio, verticalPixelRatio } = params;
                
                // 保存當前狀態
                ctx.save();
                
                // 設置縮放比例（重要！處理高DPI螢幕）
                ctx.scale(horizontalPixelRatio, verticalPixelRatio);
                
                // 遍歷所有FVG
                self.fvgs.forEach(fvg => {
                    self.drawFVG(ctx, params, fvg);
                });
                
                // 恢復狀態
                ctx.restore();
            },
            
            // 處理Z-index（確保FVG在K線後面）
            zOrder: () => 'bottom',
        };
    }
    
    drawFVG(ctx, params, fvg) {
        const { timeScale, priceScale } = params;
        
        // 計算時間座標（處理縮放）
        const x1 = timeScale.timeToCoordinate(fvg.startTime);
        const x2 = timeScale.timeToCoordinate(fvg.endTime);
        
        // 如果FVG在可視範圍外，跳過繪製（性能優化）
        if (x2 < 0 || x1 > params.mediaSize.width) {
            return;
        }
        
        // 計算價格座標（處理縮放）
        const y1 = priceScale.priceToCoordinate(fvg.upper);
        const y2 = priceScale.priceToCoordinate(fvg.lower);
        
        // 檢查座標有效性
        if (x1 === null || x2 === null || y1 === null || y2 === null) {
            return;
        }
        
        // 計算矩形參數
        const x = Math.min(x1, x2);
        const y = Math.min(y1, y2);
        const width = Math.abs(x2 - x1);
        const height = Math.abs(y2 - y1);
        
        // 跳過太小的矩形（性能優化）
        if (width < 1 || height < 1) {
            return;
        }
        
        // 繪製填充
        ctx.fillStyle = fvg.fillColor;
        ctx.fillRect(x, y, width, height);
        
        // 繪製邊框（可選）
        if (fvg.showBorder) {
            ctx.strokeStyle = fvg.borderColor;
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, width, height);
        }
    }
    
    
    updateFVGs(fvgs, currentTimeframe = 'M15') {
        const timeStep = this.getTimeStep(currentTimeframe);
        
        this.fvgs = fvgs.map(fvg => {
            const startTime = fvg.left_time || fvg.time;
            const endTime = fvg.clear_time || (startTime + 40 * timeStep);
            
            return {
                startTime: startTime,
                endTime: endTime,
                upper: Math.max(fvg.top, fvg.bot),
                lower: Math.min(fvg.top, fvg.bot),
                fillColor: this.getFVGColor(fvg.type, 0.15),
                borderColor: this.getFVGColor(fvg.type, 0.3),
                showBorder: true,
                type: fvg.type,
                id: fvg.id
            };
        });
        
        // 觸發重繪
        this.requestUpdate();
    }
    
    getFVGColor(type, opacity) {
        const colors = {
            bull: `rgba(76, 175, 80, ${opacity})`,   // 綠色
            bear: `rgba(244, 67, 54, ${opacity})`    // 紅色
        };
        return colors[type] || colors.bull;
    }
    
    getTimeStep(timeframe) {
        const steps = {
            'M1': 60,
            'M5': 300,
            'M15': 900,
            'H1': 3600,
            'H4': 14400,
            'D1': 86400
        };
        return steps[timeframe] || 900;
    }
    
    requestUpdate() {
        if (this.series) {
            this.series.update();
        }
    }
}

// 暴露到全局範圍
window.FVGCustomRenderer = FVGCustomRenderer;