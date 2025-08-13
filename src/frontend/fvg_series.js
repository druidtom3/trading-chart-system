// 檔名：fvg_series.js
// Lightweight Charts v5.0 FVG 自定義系列實現

/**
 * FVG 自定義系列渲染器
 * 兼容多種 API 版本的實現
 */
class FVGRenderer {
    constructor() {
        this._data = [];
        this._requestUpdate = null;
        
        // 檢測 API 能力
        this._supportsCustomSeries = this._detectCustomSeriesSupport();
        
        console.log('FVGRenderer 初始化，支持自定義系列:', this._supportsCustomSeries);
    }

    // 檢測自定義系列支持
    _detectCustomSeriesSupport() {
        // 檢查各種可能的 API
        if (typeof LightweightCharts === 'undefined') return false;
        
        // 檢查是否有自定義系列相關方法
        const chart = document.createElement('div');
        try {
            const testChart = LightweightCharts.createChart(chart, { width: 1, height: 1 });
            const hasCustomSeries = typeof testChart.addCustomSeries === 'function';
            testChart.remove();
            return hasCustomSeries;
        } catch (error) {
            console.warn('無法檢測自定義系列支持:', error);
            return false;
        }
    }

    // 更新數據
    setData(data) {
        this._data = data;
        this._triggerUpdate();
    }

    // 添加單個 FVG
    addFVG(fvg) {
        this._data.push(fvg);
        this._triggerUpdate();
    }

    // 清除所有 FVG
    clearData() {
        this._data = [];
        this._triggerUpdate();
    }

    // 觸發更新
    _triggerUpdate() {
        if (this._requestUpdate) {
            this._requestUpdate();
        }
    }

    // 設置更新回調
    attached(param) {
        this._requestUpdate = param.requestUpdate;
    }

    // 獲取數據
    data() {
        return this._data;
    }

    // 是否支持自定義系列
    supportsCustomSeries() {
        return this._supportsCustomSeries;
    }
}

/**
 * FVG 面板視圖 - 負責實際繪製
 */
class FVGPaneView {
    constructor(renderer) {
        this._renderer = renderer;
    }

    // 繪製方法
    draw(target) {
        const data = this._renderer.data();
        if (!data || data.length === 0) return;

        // 獲取畫布上下文
        const ctx = target.canvasRenderingTarget2D().context;
        
        // 遍歷所有 FVG 數據
        data.forEach(fvg => {
            this._drawFVG(ctx, target, fvg);
        });
    }

    // 繪製單個 FVG
    _drawFVG(ctx, target, fvg) {
        // 獲取座標轉換器
        const timeScale = target.chart().timeScale();
        const priceScale = target.chart().priceScale('right');

        // 轉換時間和價格為像素座標
        const x1 = timeScale.timeToCoordinate(fvg.startTime);
        const x2 = timeScale.timeToCoordinate(fvg.endTime);
        const y1 = priceScale.priceToCoordinate(fvg.top);
        const y2 = priceScale.priceToCoordinate(fvg.bottom);

        // 檢查座標有效性
        if (x1 === null || x2 === null || y1 === null || y2 === null) {
            return;
        }

        // 計算矩形參數
        const width = x2 - x1;
        const height = y2 - y1;

        // 設置顏色和透明度
        const baseColor = fvg.type === 'bull' ? '76, 175, 80' : '244, 67, 54';
        const fillColor = `rgba(${baseColor}, 0.3)`;
        const borderColor = `rgba(${baseColor}, 0.6)`;

        // 繪製填充矩形
        ctx.fillStyle = fillColor;
        ctx.fillRect(x1, y1, width, height);

        // 繪製邊框（可選）
        if (fvg.showBorder !== false) {
            ctx.strokeStyle = borderColor;
            ctx.lineWidth = 1;
            ctx.strokeRect(x1, y1, width, height);
        }
    }
}

/**
 * FVG 系列配置選項
 */
const FVG_SERIES_OPTIONS = {
    // 基本配置
    title: 'Fair Value Gap',
    visible: true,
    
    // 樣式配置
    bullColor: 'rgba(76, 175, 80, 0.3)',
    bearColor: 'rgba(244, 67, 54, 0.3)',
    borderWidth: 1,
    showBorder: true,
    
    // 行為配置
    extendLeft: false,
    extendRight: true,
    defaultDuration: 20 * 60 // 20分鐘 (秒)
};

// 導出類別和配置
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FVGRenderer, FVG_SERIES_OPTIONS };
}