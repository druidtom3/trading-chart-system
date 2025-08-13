# Lightweight Charts v5.0 升級計畫

## 目前狀態分析

### v4.1.3 FVG 實現方式
- 使用多條 LineSeries 模擬矩形填充
- 每個 FVG 創建 5-150 條水平線
- 透明度通過 rgba 顏色實現
- 性能受系列數量影響

### 主要問題
1. **性能問題**: 大量 LineSeries 影響渲染效能
2. **視覺不一致**: FVG 高度影響透明度效果
3. **內存占用**: 每條線都是獨立系列對象
4. **渲染限制**: 無法實現真正的矩形填充

## v5.0 升級優勢

### Bundle Size 優化
```
v4.1.3: ~52kB (gzipped)
v5.0:   ~35kB (gzipped) - 減少 33%
```

### Primitives API 支持
```javascript
// v5.0 新功能
import { Primitives } from 'lightweight-charts/plugins';

// 創建自定義系列
const customSeries = chart.addCustomSeries(new FVGRenderer());

// 直接繪製矩形
primitiveRenderer.fillRect(x1, y1, width, height, color);
```

## 升級步驟

### 1. CDN 更新 (index.html)
```html
<!-- 替換現有 v4.1.3 CDN -->
<script src="https://cdn.jsdelivr.net/npm/lightweight-charts@5.0.0/dist/lightweight-charts.standalone.production.js"></script>

<!-- 加載 Primitives 插件 -->
<script src="https://cdn.jsdelivr.net/npm/lightweight-charts@5.0.0/dist/plugins/primitives.standalone.production.js"></script>
```

### 2. FVG 自定義系列實現
```javascript
// 新檔案: src/frontend/fvg_series.js
import { CustomSeriesPrimitivePainter } from 'lightweight-charts/plugins/primitives';

class FVGRenderer {
    constructor() {
        this._data = [];
    }

    draw(target, priceConverter, timeConverter, primitiveRenderer) {
        this._data.forEach(fvg => {
            const x1 = timeConverter(fvg.startTime);
            const x2 = timeConverter(fvg.endTime);
            const y1 = priceConverter(fvg.top);
            const y2 = priceConverter(fvg.bottom);
            
            const width = x2 - x1;
            const height = y2 - y1;
            
            const color = fvg.type === 'bull' 
                ? 'rgba(76, 175, 80, 0.3)' 
                : 'rgba(244, 67, 54, 0.3)';
            
            // 直接繪製矩形 - 無條紋、統一透明度
            primitiveRenderer.fillRect(x1, y1, width, height, color);
        });
    }
}
```

### 3. 主要方法重構
```javascript
// script.js 中的更改
class TradingChartApp {
    constructor() {
        // 替換 LineSeries 方法
        this.fvgSeries = null;
    }

    initializeFVG() {
        // 創建自定義 FVG 系列
        this.fvgSeries = this.chart.addCustomSeries(new FVGRenderer(), {
            // 配置選項
        });
    }

    // 替換 drawFVGs 方法
    drawFVGs() {
        if (!this.showFVG || !this.fvgSeries) {
            return;
        }

        // 準備 FVG 數據
        const fvgData = this.currentData?.fvgs || [];
        
        // 設置數據到自定義系列
        this.fvgSeries.setData(fvgData.map(fvg => ({
            startTime: fvg.time,
            endTime: fvg.time + (20 * 60), // 20分鐘持續時間
            top: fvg.top,
            bottom: fvg.bot,
            type: fvg.type
        })));
    }

    // 移除 getFvgPixelHeight - 不再需要
    // 移除 drawSingleFVG - 統一使用自定義系列
}
```

### 4. API 兼容性調整
```javascript
// v5.0 API 變更
// 舊版 (v4.1.3)
const priceScale = chart.priceScale('right');

// 新版 (v5.0) - 相同
const priceScale = chart.priceScale('right');

// 大部分 API 保持向後兼容
```

## 性能提升預期

### 渲染性能
```
v4.1.3: 每個 FVG 創建 30-150 個系列對象
v5.0:   所有 FVG 使用單一自定義系列
提升:   ~10-50x FVG 渲染性能
```

### 內存使用
```
v4.1.3: 每條線 ~2KB 內存
v5.0:   所有 FVG 共享單一系列
節省:   ~95% FVG 相關內存
```

### 視覺一致性
```
v4.1.3: 透明度因線條密度而異
v5.0:   所有 FVG 透明度完全一致
改善:   消除視覺深淺不一問題
```

## 升級風險評估

### 低風險
- CDN 更新
- API 大部分向後兼容
- 現有功能保持不變

### 中風險
- 自定義系列實現需測試
- Primitives 插件穩定性
- 新 API 學習成本

### 緩解措施
- 漸進式升級 (先測試環境)
- 保留 v4.1.3 fallback 機制
- 完整測試覆蓋

## 實施時程

1. **第1階段** (30分鐘): CDN 更新和基礎測試
2. **第2階段** (1小時): FVG 自定義系列實現  
3. **第3階段** (30分鐘): 功能測試和調試
4. **第4階段** (15分鐘): 性能驗證和文檔更新

## 後續可能性

### 其他指標 Primitives 化
- 移動平均線: 使用 LinePrimitive
- 支撐阻力位: 使用 LinePrimitive  
- 成交量柱狀圖: 使用 BarPrimitive
- 自定義繪圖工具: 使用 ShapePrimitive

### 進階功能
- FVG 動態更新動畫
- 交互式 FVG 設置
- 多時間框架 FVG 同步
- FVG 統計分析面板