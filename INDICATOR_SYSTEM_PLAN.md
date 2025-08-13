# 指標管理系統實現計劃

## 系統概述

這個指標管理系統提供了一個統一、可擴展的架構來管理多種技術指標，包括但不限於 FVG、移動平均線、支撐阻力位等。

## 已完成的設計

### 1. 後端架構
- ✅ `BaseIndicator` - 統一指標接口
- ✅ `IndicatorManager` - 後端指標管理器
- ✅ `FVGIndicator` - FVG 指標包裝器
- ✅ 模組化設計，便於擴展

### 2. 前端架構
- ✅ `FrontendIndicatorManager` - 前端指標管理器
- ✅ 渲染器系統 (`BaseRenderer`, `AreaRenderer`, `LineRenderer`, `MarkerRenderer`)
- ✅ UI 控制系統

## 實現步驟

### ✅ 階段 1：UI 重新設計 (已完成)

#### 1.1 漢堡選單 + 側邊欄設計
- ✅ 添加漢堡選單按鈕 (☰ 圖標)
- ✅ 創建側邊欄指標面板
- ✅ 實現背景遮罩和滑動動畫
- ✅ 響應式設計支持

#### 1.2 指標分類系統
- ✅ **價格動作**: FVG、支撐阻力位
- ✅ **移動平均線**: SMA、EMA  
- ✅ **震盪指標**: RSI、MACD
- ✅ 每個指標都有勾選框和設定按鈕

#### 1.3 互動功能實現
- ✅ 勾選框控制指標顯示/隱藏
- ✅ 與原有 FVG 按鈕的同步機制
- ✅ 設定按鈕預留介面
- ✅ 側邊欄開關動畫效果

### 階段 2：後端 API 擴展 (1-2 天)

#### 2.1 後端 API 擴展
在 `app.py` 中添加指標相關的 API 端點：

```python
# 在 app.py 中添加
from indicators import default_manager

@app.route('/api/indicators/<indicator_name>/<date>/<timeframe>')
def get_indicator_data(indicator_name, date, timeframe):
    try:
        # 載入 K 線數據
        data = data_processor.get_data_for_date_timeframe(date, timeframe)
        
        # 計算指標
        indicator = default_manager.get_indicator(indicator_name)
        if indicator and indicator.enabled:
            results = indicator.calculate(data)
            return jsonify(results)
        else:
            return jsonify([])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/indicators/list')
def get_indicators_list():
    return jsonify(default_manager.list_indicators())

@app.route('/api/indicators/<indicator_name>/toggle', methods=['POST'])
def toggle_indicator(indicator_name):
    enabled = default_manager.toggle_indicator(indicator_name)
    return jsonify({'enabled': enabled})
```

#### 2.2 前端整合指標管理器
在 `index.html` 中引入指標管理器：

```html
<!-- 在 </body> 之前添加 -->
<script src="indicators/renderers/base_renderer.js"></script>
<script src="indicators/indicator_manager.js"></script>
```

連接現有勾選框與指標管理器：

```javascript
// 替換現有的 bindIndicatorCheckboxes 中的註釋代碼
this.indicatorManager.toggleIndicator(indicator.toUpperCase());
```

### 階段 2：FVG 系統重構 (1 天)

#### 2.1 移除舊的 FVG 邏輯
- 將 `script.js` 中的 FVG 相關方法遷移到指標管理器
- 保持 `fvg-toggle-btn` 按鈕的功能性

#### 2.2 統一 FVG 處理流程
```javascript
// 替換現有的 toggleFVG 方法
toggleFVG() {
    this.indicatorManager.toggleIndicator('FVG');
}

// 在圖表更新時調用
updateChart(data) {
    // ... 現有邏輯
    
    // 更新所有指標
    this.indicatorManager.updateAllIndicators();
}
```

### 階段 3：新指標添加 (每個指標 0.5-1 天)

#### 3.1 移動平均線指標
創建 `ma_indicator.py`：

```python
class MovingAverageIndicator(BaseIndicator):
    def __init__(self, config: Dict[str, Any] = None):
        super().__init__("MA", config)
        self.period = self.config.get('period', 20)
        self.ma_type = self.config.get('type', 'SMA')  # SMA, EMA, WMA
    
    def calculate(self, data: pd.DataFrame) -> List[Dict[str, Any]]:
        # 實現移動平均線計算
        pass
```

#### 3.2 支撐阻力位指標
創建 `support_resistance_indicator.py`：

```python
class SupportResistanceIndicator(BaseIndicator):
    def __init__(self, config: Dict[str, Any] = None):
        super().__init__("SR", config)
        self.lookback = self.config.get('lookback', 50)
        self.min_touches = self.config.get('min_touches', 2)
```

### 階段 4：UI 優化 (1 天)

#### 4.1 指標控制面板
創建一個專門的指標控制區域：

```html
<div class="indicator-panel">
    <h3>技術指標</h3>
    <div class="indicator-controls">
        <!-- 指標按鈕會動態添加到這裡 -->
    </div>
    <div class="indicator-settings">
        <!-- 指標參數設置 -->
    </div>
</div>
```

#### 4.2 參數配置面板
實現指標參數的動態配置界面。

## 優勢分析

### 1. 可擴展性
- 新指標只需實現 `BaseIndicator` 接口
- 統一的渲染系統支援多種視覺效果
- 模組化設計便於維護

### 2. 統一性
- 所有指標使用相同的開關控制方式
- 統一的 API 接口
- 一致的用戶體驗

### 3. 性能
- 指標按需計算和渲染
- 支持快取機制
- 獨立的渲染層避免衝突

### 4. 用戶友好
- 直觀的開/關按鈕
- 可配置的指標參數
- 清晰的視覺層次

## 未來擴展

1. **指標組合**：支持多個指標的組合策略
2. **自定義指標**：允許用戶創建自定義指標
3. **指標設置持久化**：保存用戶的指標配置
4. **性能監控**：監控指標計算性能
5. **更多指標類型**：布林通道、MACD、RSI 等

## 遷移風險評估

### 低風險
- 現有 FVG 功能保持不變
- 向後兼容的 API 設計
- 漸進式重構方式

### 注意事項
- 需要測試所有時間刻度的指標顯示
- 確保播放模式下指標正常工作
- 驗證指標的性能影響

這個設計提供了一個強大、靈活且用戶友好的指標管理系統，為未來添加更多技術指標奠定了堅實的基礎。