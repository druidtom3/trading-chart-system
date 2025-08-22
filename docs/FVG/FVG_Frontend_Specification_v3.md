# FVG 前端UI/UX完整規格 v3.0

## 文檔概覽

本文檔詳細定義FVG交易系統前端的用戶界面、交互體驗和視覺規範。基於現有實作分析，提供專業級交易平台的完整UI/UX設計。

---

## 1. 整體佈局設計

### 1.1 主要佈局結構

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Header Toolbar                                 │
├─────────┬───────────────────────────────────────────────────────┬───────────┤
│         │                                                       │           │
│  Left   │                Main Chart Area                        │   Right   │
│ Control │                                                       │  Details  │
│ Panel   │  ┌─ Timeframe Selector ─┐                             │   Panel   │
│         │  │ M1│M5│M15│H1│H4│D1 │                               │           │
│         │  └────────────────────┘                               │           │
│         │                                                       │           │
│         │     📈 K-Line Chart + FVG Visualization               │           │
│         │                                                       │           │
│         │                                                       │           │
│         │                                                       │           │
│         │  ┌─ Playback Controls ─┐                              │           │
│         │  │ ⏮ ⏪ ⏯ ⏩ ⏭ [●●●●○○○○○○] 47% │                              │           │
│         │  └───────────────────────┘                            │           │
├─────────┴───────────────────────────────────────────────────────┴───────────┤
│                           Status Bar & Performance Monitor                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 響應式斷點設計

```css
/* 響應式斷點定義 */
:root {
  /* 桌面端 (主要目標) */
  --breakpoint-desktop: 1440px;   /* 主要設計尺寸 */
  --breakpoint-laptop: 1024px;    /* 筆記本電腦 */
  
  /* 平板端 (次要支持) */  
  --breakpoint-tablet: 768px;     /* 平板橫屏 */
  --breakpoint-mobile: 480px;     /* 手機豎屏 */
  
  /* 面板寬度 */
  --left-panel-width: 280px;      /* 左側控制面板 */
  --right-panel-width: 320px;     /* 右側詳情面板 */
  --chart-min-width: 800px;       /* 圖表最小寬度 */
}

/* 桌面端佈局 (>= 1440px) */
@media (min-width: 1440px) {
  .main-layout {
    display: grid;
    grid-template-columns: var(--left-panel-width) 1fr var(--right-panel-width);
    grid-template-rows: 60px 1fr 40px;
    height: 100vh;
  }
}

/* 筆記本佈局 (1024px - 1439px) */
@media (min-width: 1024px) and (max-width: 1439px) {
  .main-layout {
    --left-panel-width: 240px;
    --right-panel-width: 280px;
  }
  
  .right-panel {
    /* 可收縮右側面板 */
    transform: translateX(100%);
    transition: transform 0.3s ease;
  }
  
  .right-panel.expanded {
    transform: translateX(0);
  }
}

/* 平板佈局 (768px - 1023px) */
@media (min-width: 768px) and (max-width: 1023px) {
  .main-layout {
    grid-template-columns: 1fr;
    grid-template-rows: 60px 1fr 120px;
  }
  
  .left-panel, .right-panel {
    /* 轉為底部抽屜式 */
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 200px;
    transform: translateY(100%);
    transition: transform 0.3s ease;
  }
}
```

## 2. 左側控制面板詳細規格

### 2.1 技術指標區塊

```tsx
// React組件結構示例
interface TechnicalIndicatorsProps {
  settings: FVGSettings;
  onSettingsChange: (settings: FVGSettings) => void;
  statistics: FVGStatistics;
}

const TechnicalIndicators: React.FC<TechnicalIndicatorsProps> = ({
  settings,
  onSettingsChange,
  statistics
}) => {
  return (
    <div className="technical-indicators">
      {/* 主要開關區域 */}
      <div className="switches-section">
        <SwitchGroup label="Fair Value Gaps">
          <Switch 
            checked={settings.showFVG}
            onChange={(checked) => onSettingsChange({...settings, showFVG: checked})}
            label="顯示 FVG Band"
            description="顯示/隱藏所有Fair Value Gap區域"
          />
          
          <Switch
            checked={settings.showFVGMarkers} 
            onChange={(checked) => onSettingsChange({...settings, showFVGMarkers: checked})}
            label="FVG Markers (F#)"
            description="顯示/隱藏F1, F2, F3...編號標記"
            disabled={!settings.showFVG}
          />
          
          <Switch
            checked={settings.showClearedFVGs}
            onChange={(checked) => onSettingsChange({...settings, showClearedFVGs: checked})}
            label="Show Cleared FVGs" 
            description="顯示已清除的FVG (灰階顯示)"
          />
        </SwitchGroup>
      </div>
      
      {/* 統計計數區域 */}
      <div className="statistics-section">
        <StatisticItem 
          label="Bullish FVG"
          current={statistics.bullishValid}
          total={statistics.bullishTotal}
          color="success"
          trend={statistics.bullishTrend}
        />
        
        <StatisticItem
          label="Bearish FVG" 
          current={statistics.bearishValid}
          total={statistics.bearishTotal}
          color="danger"
          trend={statistics.bearishTrend}
        />
        
        <StatisticItem
          label="Total Valid"
          current={statistics.totalValid}
          total={null}
          color="primary"
          highlight={true}
        />
      </div>
    </div>
  );
};
```

### 2.2 統計計數器設計

```css
/* 統計計數器樣式 */
.statistic-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  margin: 4px 0;
  background: var(--surface-color);
  border-radius: 8px;
  transition: all 0.2s ease;
}

.statistic-item:hover {
  background: var(--surface-hover);
  transform: translateX(2px);
}

.statistic-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
}

.statistic-values {
  display: flex;
  align-items: center;
  gap: 4px;
  font-family: 'JetBrains Mono', monospace;
  font-weight: 600;
}

.statistic-current {
  font-size: 18px;
  color: var(--text-primary);
  
  /* 動畫效果 */
  animation: fadeIn 0.3s ease when value changes;
}

.statistic-separator {
  color: var(--text-muted);
  margin: 0 2px;
}

.statistic-total {
  font-size: 14px;
  color: var(--text-muted);
}

/* 顏色主題 */
.statistic-item.success .statistic-current {
  color: var(--color-success);
}

.statistic-item.danger .statistic-current {
  color: var(--color-danger); 
}

.statistic-item.primary .statistic-current {
  color: var(--color-primary);
}

.statistic-item.highlight {
  border: 1px solid var(--color-primary-alpha);
  background: var(--color-primary-alpha-10);
}

/* 趨勢指示器 */
.trend-indicator {
  margin-left: 8px;
  font-size: 12px;
  
  &.up { color: var(--color-success); }
  &.down { color: var(--color-danger); }
  &.stable { color: var(--text-muted); }
}
```

### 2.3 繪圖工具區域

```tsx
interface DrawingToolsProps {
  selectedTool: DrawingTool;
  onToolSelect: (tool: DrawingTool) => void;
  drawings: UserDrawing[];
  onDrawingAction: (action: DrawingAction) => void;
}

const DrawingTools: React.FC<DrawingToolsProps> = ({
  selectedTool,
  onToolSelect,
  drawings,
  onDrawingAction
}) => {
  const tools = [
    { id: 'cursor', icon: 'cursor', label: '選取工具', shortcut: 'V' },
    { id: 'horizontal_line', icon: 'minus', label: '水平線', shortcut: 'H' },
    { id: 'trend_line', icon: 'trending-up', label: '趨勢線', shortcut: 'T' },
    { id: 'rectangle', icon: 'square', label: '矩形', shortcut: 'R' },
    { id: 'fibonacci', icon: 'git-merge', label: '斐波那契', shortcut: 'F' },
    { id: 'text_note', icon: 'type', label: '文字註解', shortcut: 'N' }
  ];
  
  return (
    <div className="drawing-tools">
      <div className="tools-header">
        <h3>Drawing Tools</h3>
        <button 
          className="clear-all-btn"
          onClick={() => onDrawingAction({ type: 'clear_all' })}
          disabled={drawings.length === 0}
        >
          清除全部
        </button>
      </div>
      
      <div className="tools-grid">
        {tools.map(tool => (
          <ToolButton
            key={tool.id}
            tool={tool}
            selected={selectedTool === tool.id}
            onClick={() => onToolSelect(tool.id)}
          />
        ))}
      </div>
      
      {/* 繪圖統計 */}
      <div className="drawings-summary">
        <div className="summary-item">
          <span>水平線:</span>
          <span className="count">
            {drawings.filter(d => d.type === 'horizontal_line').length}
          </span>
        </div>
        <div className="summary-item">
          <span>矩形:</span>
          <span className="count">
            {drawings.filter(d => d.type === 'rectangle').length}
          </span>
        </div>
      </div>
    </div>
  );
};
```

## 3. 主圖表區域設計

### 3.1 FVG視覺化規格

```typescript
// FVG視覺化配置
interface FVGVisualizationConfig {
  // 基礎顏色配置
  colors: {
    bullish: {
      base: '#68C7B4';           // 基礎綠色
      fill: 'rgba(104,199,180,0.22)';  // 填充色 22% 透明度
      border: 'rgba(104,199,180,0.75)'; // 邊框色 75% 不透明度
      stripe: 'rgba(104,199,180,0.35)'; // 條紋色 35% 透明度
    };
    bearish: {
      base: '#F2A0A0';           // 基礎紅色  
      fill: 'rgba(242,160,160,0.22)';   // 填充色 22% 透明度
      border: 'rgba(242,160,160,0.75)'; // 邊框色 75% 不透明度
      stripe: 'rgba(242,160,160,0.35)'; // 條紋色 35% 透明度  
    };
    cleared: {
      base: '#BDBDBD';           // 灰色基調
      fill: 'rgba(189,189,189,0.12)';   // 更淡的填充
      border: 'transparent';      // 無邊框
      stripe: 'rgba(189,189,189,0.20)'; // 淡化條紋
    };
  };
  
  // 視覺效果配置
  effects: {
    borderWidth: 1.5;           // 邊框粗細
    stripeCount: 4;             // 條紋數量  
    stripeSpacing: 5;           // 條紋間距 (px)
    animationDuration: 250;     // 動畫時長 (ms)
    hoverOpacityReduction: 0.3; // Hover時其他元素透明度降低
  };
}

// FVG渲染引擎
class FVGRenderEngine {
  private config: FVGVisualizationConfig;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  
  constructor(canvas: HTMLCanvasElement, config: FVGVisualizationConfig) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.config = config;
  }
  
  renderFVGBand(fvg: FVGData, viewport: ChartViewport): void {
    const { colors, effects } = this.config;
    const colorScheme = fvg.status === 'cleared' 
      ? colors.cleared 
      : colors[fvg.type];
    
    // 計算屏幕坐標
    const x1 = viewport.timeToX(fvg.startTime);
    const x2 = viewport.timeToX(fvg.endTime);
    const y1 = viewport.priceToY(fvg.topPrice);
    const y2 = viewport.priceToY(fvg.bottomPrice);
    
    // 繪製填充區域
    this.ctx.fillStyle = colorScheme.fill;
    this.ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
    
    // 繪製條紋效果 (僅valid狀態)
    if (fvg.status === 'valid') {
      this.renderStripes(x1, y1, x2, y2, colorScheme.stripe);
    }
    
    // 繪製邊框 (僅valid狀態)
    if (fvg.status === 'valid' && colorScheme.border !== 'transparent') {
      this.ctx.strokeStyle = colorScheme.border;
      this.ctx.lineWidth = effects.borderWidth;
      this.ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    }
  }
  
  private renderStripes(x1: number, y1: number, x2: number, y2: number, color: string): void {
    const { stripeCount, stripeSpacing } = this.config.effects;
    const bandHeight = y2 - y1;
    const stripeHeight = 1;
    const totalStripesHeight = stripeCount * stripeHeight + (stripeCount - 1) * stripeSpacing;
    const startY = y1 + (bandHeight - totalStripesHeight) / 2;
    
    this.ctx.fillStyle = color;
    
    for (let i = 0; i < stripeCount; i++) {
      const stripeY = startY + i * (stripeHeight + stripeSpacing);
      this.ctx.fillRect(x1 + 2, stripeY, x2 - x1 - 4, stripeHeight);
    }
  }
  
  renderFVGMarker(fvg: FVGData, viewport: ChartViewport, globalNumber: number): void {
    const x = viewport.timeToX(fvg.startTime) - 12; // 向左偏移
    const y = viewport.priceToY((fvg.topPrice + fvg.bottomPrice) / 2);
    
    // 繪製圓形背景
    const radius = 10;
    this.ctx.fillStyle = fvg.type === 'bullish' ? '#00D68F' : '#FF3D71';
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, 2 * Math.PI);
    this.ctx.fill();
    
    // 繪製編號文字
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = '12px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(`F${globalNumber}`, x, y);
  }
}
```

### 3.2 交互行為設計

```typescript
// 圖表交互控制器
class ChartInteractionController {
  private selectedFVG: FVGData | null = null;
  private hoveredFVG: FVGData | null = null;
  private isDrawing: boolean = false;
  
  onMouseMove(event: MouseEvent, viewport: ChartViewport): void {
    const { x, y } = this.getMousePosition(event);
    const price = viewport.yToPrice(y);
    const time = viewport.xToTime(x);
    
    // 檢測FVG hover
    const hoveredFVG = this.findFVGAtPosition(x, y);
    
    if (hoveredFVG !== this.hoveredFVG) {
      this.onFVGHoverChange(this.hoveredFVG, hoveredFVG);
      this.hoveredFVG = hoveredFVG;
    }
    
    // 更新十字線和價格顯示
    this.updateCrosshair(time, price);
    
    // 繪圖模式處理
    if (this.isDrawing && this.selectedTool !== 'cursor') {
      this.updateDrawingPreview(time, price);
    }
  }
  
  onClick(event: MouseEvent, viewport: ChartViewport): void {
    const { x, y } = this.getMousePosition(event);
    
    // 檢測FVG點擊
    const clickedFVG = this.findFVGAtPosition(x, y);
    
    if (clickedFVG) {
      this.selectFVG(clickedFVG);
      this.focusOnFVG(clickedFVG, viewport);
      return;
    }
    
    // 繪圖工具處理
    if (this.selectedTool !== 'cursor') {
      this.handleDrawingClick(viewport.xToTime(x), viewport.yToPrice(y));
    }
  }
  
  private onFVGHoverChange(oldFVG: FVGData | null, newFVG: FVGData | null): void {
    // 恢復原來FVG的樣式
    if (oldFVG) {
      this.setFVGHighlight(oldFVG, false);
    }
    
    // 高亮新的FVG
    if (newFVG) {
      this.setFVGHighlight(newFVG, true);
      this.showFVGTooltip(newFVG);
    } else {
      this.hideFVGTooltip();
    }
  }
  
  private selectFVG(fvg: FVGData): void {
    // 取消之前的選擇
    if (this.selectedFVG) {
      this.setFVGSelection(this.selectedFVG, false);
    }
    
    // 設置新選擇
    this.selectedFVG = fvg;
    this.setFVGSelection(fvg, true);
    
    // 右側詳情面板滾動到對應項目
    this.scrollToFVGDetails(fvg);
    
    // 觸發事件
    this.emit('fvg:selected', fvg);
  }
  
  private focusOnFVG(fvg: FVGData, viewport: ChartViewport): void {
    // 平滑滾動到FVG位置
    const targetTime = fvg.startTime;
    const currentCenter = viewport.getTimeCenter();
    
    if (Math.abs(targetTime - currentCenter) > viewport.getVisibleTimeRange() * 0.3) {
      viewport.animateToTime(targetTime, 500); // 500ms動畫
    }
  }
}
```

## 4. 右側詳情面板規格

### 4.1 FVG詳情清單設計

```tsx
interface FVGDetailsListProps {
  fvgs: FVGData[];
  selectedFVG: FVGData | null;
  onFVGSelect: (fvg: FVGData) => void;
  onFVGAction: (fvg: FVGData, action: string) => void;
  settings: FVGDisplaySettings;
}

const FVGDetailsList: React.FC<FVGDetailsListProps> = ({
  fvgs,
  selectedFVG, 
  onFVGSelect,
  onFVGAction,
  settings
}) => {
  const [filter, setFilter] = useState<FVGFilter>('all');
  const [sortBy, setSortBy] = useState<FVGSortKey>('formedAt');
  
  const filteredFVGs = useMemo(() => {
    let filtered = fvgs;
    
    // 應用篩選器
    switch (filter) {
      case 'valid_only':
        filtered = filtered.filter(f => f.status === 'valid');
        break;
      case 'cleared_only':
        filtered = filtered.filter(f => f.status === 'cleared');
        break;
    }
    
    // 應用排序
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'formedAt':
          return b.formedAt - a.formedAt;
        case 'gapSize':
          const sizeA = Math.abs(a.topPrice - a.bottomPrice);
          const sizeB = Math.abs(b.topPrice - b.bottomPrice);
          return sizeB - sizeA;
        case 'type':
          return a.type.localeCompare(b.type);
        default:
          return 0;
      }
    });
    
    return filtered;
  }, [fvgs, filter, sortBy]);
  
  return (
    <div className="fvg-details-list">
      {/* 控制條 */}
      <div className="list-controls">
        <div className="filter-section">
          <Select
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All FVGs' },
              { value: 'valid_only', label: 'Valid Only' },
              { value: 'cleared_only', label: 'Cleared Only' }
            ]}
          />
        </div>
        
        <div className="sort-section">
          <Select 
            value={sortBy}
            onChange={setSortBy}
            options={[
              { value: 'formedAt', label: 'Formation Time' },
              { value: 'gapSize', label: 'Gap Size' },
              { value: 'type', label: 'Type' }
            ]}
          />
        </div>
      </div>
      
      {/* 清單容器 (虛擬滾動) */}
      <VirtualizedList
        items={filteredFVGs}
        itemHeight={80}
        containerHeight={400}
        renderItem={({ item: fvg, index }) => (
          <FVGDetailCard
            key={fvg.id}
            fvg={fvg}
            selected={selectedFVG?.id === fvg.id}
            onClick={() => onFVGSelect(fvg)}
            onAction={(action) => onFVGAction(fvg, action)}
          />
        )}
      />
    </div>
  );
};

// 單個FVG詳情卡片
const FVGDetailCard: React.FC<{
  fvg: FVGData;
  selected: boolean;
  onClick: () => void;
  onAction: (action: string) => void;
}> = ({ fvg, selected, onClick, onAction }) => {
  const gapSize = Math.abs(fvg.topPrice - fvg.bottomPrice);
  const gapSizePoints = (gapSize * 4).toFixed(1); // 轉換為點數
  
  return (
    <div 
      className={`fvg-detail-card ${selected ? 'selected' : ''} ${fvg.type} ${fvg.status}`}
      onClick={onClick}
    >
      {/* 卡片頭部 */}
      <div className="card-header">
        <div className="fvg-info">
          <div className="fvg-number">
            <FVGTypeIcon type={fvg.type} />
            <span>FVG #{fvg.number}</span>
          </div>
          <div className="fvg-status">
            <StatusBadge status={fvg.status} />
          </div>
        </div>
        
        <div className="card-actions">
          <IconButton
            icon="target"
            onClick={(e) => {
              e.stopPropagation();
              onAction('focus');
            }}
            tooltip="聚焦到此FVG"
          />
          <IconButton
            icon="eye"
            onClick={(e) => {
              e.stopPropagation(); 
              onAction('toggle_visibility');
            }}
            tooltip="切換顯示/隱藏"
          />
        </div>
      </div>
      
      {/* 卡片內容 */}
      <div className="card-content">
        <div className="price-info">
          <div className="price-range">
            <span className="label">Range:</span>
            <span className="range">
              {fvg.bottomPrice.toFixed(2)} - {fvg.topPrice.toFixed(2)}
            </span>
          </div>
          <div className="gap-size">
            <span className="label">Gap:</span>
            <span className="size">{gapSizePoints} pts</span>
          </div>
        </div>
        
        <div className="time-info">
          <div className="formed-time">
            <span className="label">Formed:</span>
            <span className="time">
              {formatTime(fvg.formedAt)}
            </span>
          </div>
          
          {fvg.status === 'cleared' && fvg.clearedAt && (
            <div className="cleared-info">
              <span className="label">Cleared:</span>
              <span className="time">{formatTime(fvg.clearedAt)}</span>
              <span className="method">by {fvg.clearedBy}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
```

### 4.2 統計資訊面板

```tsx
const FVGStatisticsPanel: React.FC<{
  statistics: FVGStatistics;
  timeframe: string;
  dateRange: DateRange;
}> = ({ statistics, timeframe, dateRange }) => {
  return (
    <div className="fvg-statistics-panel">
      <div className="panel-header">
        <h3>FVG Statistics</h3>
        <div className="timeframe-badge">{timeframe}</div>
      </div>
      
      <div className="stats-grid">
        {/* 基本統計 */}
        <StatGroup title="Detection Summary">
          <StatItem 
            label="Total Detected" 
            value={statistics.totalDetected}
            icon="search"
          />
          <StatItem
            label="Currently Valid"
            value={statistics.currentlyValid}
            color="success"
            icon="check-circle"
          />
          <StatItem
            label="Cleared"  
            value={statistics.totalCleared}
            color="muted"
            icon="x-circle"
          />
        </StatGroup>
        
        {/* 類型分佈 */}
        <StatGroup title="Type Distribution">
          <div className="type-chart">
            <PieChart
              data={[
                { name: 'Bullish', value: statistics.bullishCount, color: '#68C7B4' },
                { name: 'Bearish', value: statistics.bearishCount, color: '#F2A0A0' }
              ]}
              width={120}
              height={120}
            />
          </div>
          <div className="type-legend">
            <LegendItem color="#68C7B4" label="Bullish" value={statistics.bullishCount} />
            <LegendItem color="#F2A0A0" label="Bearish" value={statistics.bearishCount} />
          </div>
        </StatGroup>
        
        {/* 性能統計 */}
        <StatGroup title="Performance Metrics">
          <StatItem
            label="Avg. Gap Size"
            value={`${statistics.averageGapSize.toFixed(1)} pts`}
            icon="trending-up"
          />
          <StatItem
            label="Largest Gap"
            value={`${statistics.largestGap.toFixed(1)} pts`}
            icon="maximize"
          />
          <StatItem
            label="Clear Rate"
            value={`${statistics.clearanceRate.toFixed(1)}%`}
            icon="percent"
          />
        </StatGroup>
        
        {/* 時間分析 */}
        <StatGroup title="Timing Analysis">
          <StatItem
            label="Avg. Duration"
            value={formatDuration(statistics.averageDuration)}
            icon="clock"
          />
          <StatItem
            label="Fastest Clear"
            value={formatDuration(statistics.fastestClear)}
            icon="zap"
          />
        </StatGroup>
      </div>
      
      {/* 導出功能 */}
      <div className="export-section">
        <button 
          className="export-btn"
          onClick={() => exportFVGData(statistics, 'csv')}
        >
          <Icon name="download" />
          Export CSV
        </button>
        <button
          className="export-btn"  
          onClick={() => exportFVGData(statistics, 'json')}
        >
          <Icon name="code" />
          Export JSON
        </button>
      </div>
    </div>
  );
};
```

## 5. 回放控制界面設計

### 5.1 播放控制條

```tsx
interface PlaybackControlBarProps {
  isPlaying: boolean;
  isPrepared: boolean;
  currentIndex: number;
  totalCandles: number;
  currentDate: string;
  speed: number;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSpeedChange: (speed: number) => void;
  onSeek: (index: number) => void;
  onDateChange: (date: string) => void;
}

const PlaybackControlBar: React.FC<PlaybackControlBarProps> = ({
  isPlaying,
  isPrepared,
  currentIndex,
  totalCandles,
  currentDate,
  speed,
  onPlay,
  onPause,
  onStop,
  onSpeedChange,
  onSeek,
  onDateChange
}) => {
  const progress = totalCandles > 0 ? (currentIndex / totalCandles) * 100 : 0;
  
  return (
    <div className="playback-control-bar">
      {/* 主要控制按鈕 */}
      <div className="main-controls">
        <IconButton
          icon="skip-back"
          onClick={() => onSeek(Math.max(0, currentIndex - 10))}
          disabled={!isPrepared || currentIndex <= 0}
          tooltip="後退10根K線"
        />
        
        <IconButton
          icon="chevron-left"
          onClick={() => onSeek(Math.max(0, currentIndex - 1))} 
          disabled={!isPrepared || currentIndex <= 0}
          tooltip="後退1根K線"
        />
        
        <div className="play-pause-stop">
          {isPlaying ? (
            <IconButton
              icon="pause"
              onClick={onPause}
              className="primary"
              size="large"
              tooltip="暫停回放"
            />
          ) : (
            <IconButton
              icon="play"
              onClick={onPlay}
              disabled={!isPrepared}
              className="primary"
              size="large" 
              tooltip="開始回放"
            />
          )}
          
          <IconButton
            icon="square"
            onClick={onStop}
            disabled={!isPrepared}
            tooltip="停止回放"
          />
        </div>
        
        <IconButton
          icon="chevron-right"
          onClick={() => onSeek(Math.min(totalCandles - 1, currentIndex + 1))}
          disabled={!isPrepared || currentIndex >= totalCandles - 1}
          tooltip="前進1根K線"
        />
        
        <IconButton
          icon="skip-forward"
          onClick={() => onSeek(Math.min(totalCandles - 1, currentIndex + 10))}
          disabled={!isPrepared || currentIndex >= totalCandles - 1}
          tooltip="前進10根K線"
        />
      </div>
      
      {/* 進度條 */}
      <div className="progress-section">
        <div className="progress-info">
          <span className="current-position">
            {currentIndex + 1}
          </span>
          <span className="separator">/</span>
          <span className="total-candles">
            {totalCandles}
          </span>
          <span className="progress-percentage">
            ({progress.toFixed(1)}%)
          </span>
        </div>
        
        <div className="progress-bar-container">
          <ProgressBar
            value={progress}
            onChange={(value) => {
              const newIndex = Math.floor((value / 100) * totalCandles);
              onSeek(newIndex);
            }}
            disabled={!isPrepared}
            showTooltip={true}
            formatTooltip={(value) => {
              const index = Math.floor((value / 100) * totalCandles);
              return `K線 ${index + 1}/${totalCandles}`;
            }}
          />
        </div>
      </div>
      
      {/* 速度控制 */}
      <div className="speed-controls">
        <label className="speed-label">速度:</label>
        <SpeedSelector
          value={speed}
          onChange={onSpeedChange}
          options={[
            { value: 0.5, label: '0.5s' },
            { value: 1.0, label: '1s' },
            { value: 2.0, label: '2s' },
            { value: 3.0, label: '3s' },
            { value: 5.0, label: '5s' }
          ]}
          disabled={!isPrepared}
        />
      </div>
      
      {/* 日期選擇 */}
      <div className="date-controls">
        <DatePicker
          value={currentDate}
          onChange={onDateChange}
          disabled={isPlaying}
          placeholder="選擇日期"
          format="YYYY-MM-DD"
        />
        
        <div className="quick-actions">
          <IconButton
            icon="calendar" 
            onClick={() => onDateChange('today')}
            disabled={isPlaying}
            tooltip="今天"
          />
          <IconButton
            icon="shuffle"
            onClick={() => onDateChange('random')}
            disabled={isPlaying}
            tooltip="隨機日期"
          />
        </div>
      </div>
    </div>
  );
};
```

### 5.2 多時間框架同步指示器

```tsx
const MultiTimeframeSyncIndicator: React.FC<{
  syncedTimeframes: string[];
  currentTimeframes: Record<string, TimeframeStatus>;
  onTimeframeToggle: (tf: string, enabled: boolean) => void;
}> = ({ syncedTimeframes, currentTimeframes, onTimeframeToggle }) => {
  const allTimeframes = ['M1', 'M5', 'M15', 'H1', 'H4', 'D1'];
  
  return (
    <div className="multi-tf-sync-indicator">
      <div className="indicator-header">
        <Icon name="layers" />
        <span>多時間框架同步</span>
      </div>
      
      <div className="timeframe-status-grid">
        {allTimeframes.map(tf => {
          const status = currentTimeframes[tf];
          const isSynced = syncedTimeframes.includes(tf);
          
          return (
            <div
              key={tf}
              className={`tf-status-item ${status?.status || 'inactive'} ${isSynced ? 'synced' : ''}`}
            >
              <div className="tf-label">{tf}</div>
              
              <div className="status-indicators">
                {/* 數據狀態指示器 */}
                <div className={`data-status ${status?.hasData ? 'ready' : 'no-data'}`}>
                  <div className="status-dot" />
                </div>
                
                {/* 同步狀態指示器 */}
                {isSynced && (
                  <div className="sync-status">
                    <Icon name="check" size={12} />
                  </div>
                )}
              </div>
              
              {/* 當前K線信息 */}
              {status?.currentCandle && (
                <div className="current-candle-info">
                  <div className="candle-time">
                    {formatTimeShort(status.currentCandle.timestamp)}
                  </div>
                  <div className="candle-price">
                    {status.currentCandle.close.toFixed(2)}
                  </div>
                </div>
              )}
              
              {/* 切換開關 */}
              <Toggle
                size="small"
                checked={isSynced}
                onChange={(checked) => onTimeframeToggle(tf, checked)}
                disabled={!status?.hasData}
              />
            </div>
          );
        })}
      </div>
      
      {/* 同步統計 */}
      <div className="sync-statistics">
        <div className="stat-item">
          <span className="label">已同步:</span>
          <span className="value">{syncedTimeframes.length}/6</span>
        </div>
        <div className="stat-item">
          <span className="label">延遲:</span>
          <span className="value">~2ms</span>
        </div>
      </div>
    </div>
  );
};
```

## 6. 主題與視覺規範

### 6.1 色彩系統

```css
/* 深色主題 (默認) */
:root {
  /* 主色調 */
  --color-primary: #007AFF;
  --color-primary-hover: #0056D6;
  --color-primary-alpha: rgba(0, 122, 255, 0.1);
  
  /* 成功/危險色 */
  --color-success: #68C7B4;
  --color-success-alpha: rgba(104, 199, 180, 0.1);
  --color-danger: #F2A0A0;
  --color-danger-alpha: rgba(242, 160, 160, 0.1);
  
  /* 背景色 */
  --bg-primary: #1A1A1A;
  --bg-secondary: #2D2D2D;
  --bg-tertiary: #3A3A3A;
  --bg-surface: #404040;
  --bg-surface-hover: #4A4A4A;
  
  /* 文字色 */
  --text-primary: #FFFFFF;
  --text-secondary: #B0B0B0;
  --text-muted: #808080;
  --text-disabled: #505050;
  
  /* 邊框色 */
  --border-primary: #404040;
  --border-secondary: #333333;
  --border-focus: var(--color-primary);
  
  /* 陰影 */
  --shadow-small: 0 2px 4px rgba(0, 0, 0, 0.2);
  --shadow-medium: 0 4px 8px rgba(0, 0, 0, 0.3);
  --shadow-large: 0 8px 16px rgba(0, 0, 0, 0.4);
}

/* 淺色主題 */
[data-theme="light"] {
  --bg-primary: #FFFFFF;
  --bg-secondary: #F8F9FA;
  --bg-tertiary: #E9ECEF;
  --bg-surface: #FFFFFF;
  --bg-surface-hover: #F1F3F4;
  
  --text-primary: #212529;
  --text-secondary: #495057;
  --text-muted: #6C757D;
  --text-disabled: #ADB5BD;
  
  --border-primary: #DEE2E6;
  --border-secondary: #E9ECEF;
  
  --shadow-small: 0 2px 4px rgba(0, 0, 0, 0.1);
  --shadow-medium: 0 4px 8px rgba(0, 0, 0, 0.15);
  --shadow-large: 0 8px 16px rgba(0, 0, 0, 0.2);
}
```

### 6.2 字體系統

```css
/* 字體定義 */
:root {
  --font-family-base: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-family-mono: 'JetBrains Mono', 'SF Mono', Monaco, 'Cascadia Code', monospace;
  --font-family-display: 'Inter Display', var(--font-family-base);
  
  /* 字體大小 */
  --font-size-xs: 0.75rem;   /* 12px */
  --font-size-sm: 0.875rem;  /* 14px */
  --font-size-base: 1rem;    /* 16px */
  --font-size-lg: 1.125rem;  /* 18px */
  --font-size-xl: 1.25rem;   /* 20px */
  --font-size-2xl: 1.5rem;   /* 24px */
  --font-size-3xl: 1.875rem; /* 30px */
  
  /* 字重 */
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
  
  /* 行高 */
  --line-height-tight: 1.25;
  --line-height-normal: 1.5;
  --line-height-relaxed: 1.75;
}

/* 字體類別 */
.text-display {
  font-family: var(--font-family-display);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-tight);
}

.text-mono {
  font-family: var(--font-family-mono);
  font-feature-settings: 'tnum' on, 'lnum' on;
}

.text-price {
  font-family: var(--font-family-mono);
  font-weight: var(--font-weight-semibold);
  font-feature-settings: 'tnum' on;
  letter-spacing: 0.025em;
}
```

### 6.3 動畫系統

```css
/* 動畫時間曲線 */
:root {
  --timing-function-ease: cubic-bezier(0.4, 0, 0.2, 1);
  --timing-function-ease-in: cubic-bezier(0.4, 0, 1, 1);
  --timing-function-ease-out: cubic-bezier(0, 0, 0.2, 1);
  --timing-function-ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  
  /* 動畫持續時間 */
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 350ms;
  --duration-slower: 500ms;
}

/* FVG動畫類別 */
.fvg-band {
  transition: 
    opacity var(--duration-normal) var(--timing-function-ease),
    filter var(--duration-normal) var(--timing-function-ease);
}

.fvg-band.clearing {
  animation: fvgClearing var(--duration-normal) var(--timing-function-ease-in) forwards;
}

.fvg-band.forming {
  animation: fvgForming var(--duration-normal) var(--timing-function-ease-out) forwards;
}

@keyframes fvgClearing {
  from {
    opacity: 1;
    filter: saturate(1) brightness(1);
  }
  to {
    opacity: 0.3;
    filter: saturate(0) brightness(0.8);
  }
}

@keyframes fvgForming {
  from {
    opacity: 0;
    transform: scaleY(0);
  }
  to {
    opacity: 1;
    transform: scaleY(1);
  }
}

/* 統計計數器動畫 */
.statistic-value {
  transition: all var(--duration-fast) var(--timing-function-ease);
}

.statistic-value.updating {
  animation: valueChange var(--duration-normal) var(--timing-function-ease);
}

@keyframes valueChange {
  0% { transform: scale(1); }
  50% { 
    transform: scale(1.1);
    color: var(--color-primary);
  }
  100% { transform: scale(1); }
}
```

## 7. 響應式設計與無障礙

### 7.1 響應式佈局實現

```css
/* 響應式容器查詢 */
.chart-container {
  container-type: inline-size;
  height: 100%;
}

/* 基於容器寬度的響應式設計 */
@container (max-width: 1200px) {
  .right-panel {
    width: 280px;
  }
  
  .fvg-detail-card {
    padding: 12px;
  }
  
  .statistic-item {
    flex-direction: column;
    align-items: flex-start;
  }
}

@container (max-width: 900px) {
  .main-layout {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr auto;
  }
  
  .left-panel,
  .right-panel {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 50vh;
    transform: translateY(100%);
    transition: transform 0.3s ease;
    z-index: 100;
  }
  
  .left-panel.open,
  .right-panel.open {
    transform: translateY(0);
  }
  
  .chart-container {
    touch-action: pan-x pan-y;
  }
}

/* 觸控設備優化 */
@media (pointer: coarse) {
  .fvg-marker {
    min-width: 44px;
    min-height: 44px;
  }
  
  .icon-button {
    min-width: 44px;
    min-height: 44px;
  }
  
  .playback-controls {
    padding: 16px;
    gap: 16px;
  }
}
```

### 7.2 無障礙支援

```tsx
// 無障礙屬性示例
const FVGDetailCard: React.FC<FVGDetailCardProps> = ({ fvg, selected, onClick }) => {
  return (
    <div
      className="fvg-detail-card"
      role="button"
      tabIndex={0}
      aria-selected={selected}
      aria-label={`FVG ${fvg.number}, ${fvg.type}, ${fvg.status}, 價格範圍 ${fvg.bottomPrice} 到 ${fvg.topPrice}`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onClick();
        }
      }}
    >
      {/* 卡片內容 */}
    </div>
  );
};

// 鍵盤快捷鍵支援
const useKeyboardShortcuts = () => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 如果在輸入框中，忽略快捷鍵
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      switch (e.key) {
        case ' ':
          e.preventDefault();
          // 播放/暫停
          break;
        case 'ArrowLeft':
          e.preventDefault();
          // 前一根K線
          break;
        case 'ArrowRight':
          e.preventDefault();
          // 後一根K線
          break;
        case 'v':
          e.preventDefault();
          // 切換到選取工具
          break;
        case 'h':
          e.preventDefault();
          // 切換到水平線工具
          break;
        case 'Escape':
          // 取消當前操作
          break;
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
};

// 螢幕閱讀器支援
const ScreenReaderAnnouncements: React.FC<{
  announcements: string[];
}> = ({ announcements }) => {
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {announcements.map((announcement, index) => (
        <div key={index}>{announcement}</div>
      ))}
    </div>
  );
};
```

## 8. 效能優化策略

### 8.1 渲染效能優化

```typescript
// 虛擬化長清單
const VirtualizedFVGList: React.FC<{
  items: FVGData[];
  containerHeight: number;
  itemHeight: number;
}> = ({ items, containerHeight, itemHeight }) => {
  const [scrollTop, setScrollTop] = useState(0);
  
  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(
    startIndex + Math.ceil(containerHeight / itemHeight) + 1,
    items.length
  );
  
  const visibleItems = items.slice(startIndex, endIndex);
  const totalHeight = items.length * itemHeight;
  const offsetY = startIndex * itemHeight;
  
  return (
    <div 
      className="virtualized-list"
      style={{ height: containerHeight, overflow: 'auto' }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, index) => (
            <FVGDetailCard
              key={item.id}
              fvg={item}
              style={{ height: itemHeight }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// 防抖滾動處理
const useDebounceScrollHandler = (handler: (scrollTop: number) => void, delay: number = 16) => {
  const timeoutRef = useRef<NodeJS.Timeout>();
  
  return useCallback((scrollTop: number) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      handler(scrollTop);
    }, delay);
  }, [handler, delay]);
};
```

### 8.2 狀態管理優化

```typescript
// 使用Zustand進行狀態管理
interface FVGStore {
  // 狀態
  fvgs: FVGData[];
  selectedFVG: FVGData | null;
  settings: FVGSettings;
  statistics: FVGStatistics;
  
  // 動作
  setFVGs: (fvgs: FVGData[]) => void;
  selectFVG: (fvg: FVGData | null) => void;
  updateSettings: (settings: Partial<FVGSettings>) => void;
  addFVG: (fvg: FVGData) => void;
  clearFVG: (fvgId: string) => void;
  
  // 計算屬性
  visibleFVGs: FVGData[];
  validFVGs: FVGData[];
  clearedFVGs: FVGData[];
}

const useFVGStore = create<FVGStore>((set, get) => ({
  fvgs: [],
  selectedFVG: null,
  settings: defaultFVGSettings,
  statistics: initialStatistics,
  
  setFVGs: (fvgs) => set({ fvgs }),
  
  selectFVG: (fvg) => set({ selectedFVG: fvg }),
  
  updateSettings: (newSettings) => set((state) => ({
    settings: { ...state.settings, ...newSettings }
  })),
  
  addFVG: (fvg) => set((state) => ({
    fvgs: [...state.fvgs, fvg]
  })),
  
  clearFVG: (fvgId) => set((state) => ({
    fvgs: state.fvgs.map(fvg => 
      fvg.id === fvgId 
        ? { ...fvg, status: 'cleared' as const, clearedAt: Date.now() }
        : fvg
    )
  })),
  
  // 計算屬性
  get visibleFVGs() {
    const { fvgs, settings } = get();
    return fvgs.filter(fvg => 
      settings.showFVG && 
      (settings.showClearedFVGs || fvg.status === 'valid')
    );
  },
  
  get validFVGs() {
    return get().fvgs.filter(fvg => fvg.status === 'valid');
  },
  
  get clearedFVGs() {
    return get().fvgs.filter(fvg => fvg.status === 'cleared');
  }
}));

// 選擇器優化
const selectVisibleBullishFVGs = (state: FVGStore) => 
  state.visibleFVGs.filter(fvg => fvg.type === 'bullish');

const selectVisibleBearishFVGs = (state: FVGStore) =>
  state.visibleFVGs.filter(fvg => fvg.type === 'bearish');
```

---

## 總結

本前端規格文檔提供了FVG交易系統用戶界面的完整設計，包括：

- ✅ **完整的佈局體系** - 響應式三欄佈局，支持多設備
- ✅ **詳細的組件設計** - 每個UI組件的結構、行為、樣式  
- ✅ **專業級視覺效果** - FVG渲染、動畫、主題系統
- ✅ **優秀的用戶體驗** - 交互邏輯、無障礙支援、效能優化
- ✅ **可維護的代碼結構** - TypeScript、模塊化、狀態管理

### 下一步開發重點
1. 實現核心組件庫和設計系統
2. 開發FVG渲染引擎和交互控制器  
3. 建立響應式佈局和主題切換
4. 整合後端API和WebSocket連接
5. 實現無障礙支援和效能優化

---

*版本: v3.0 | 更新日期: 2025-08-20 | 維護者: FVG前端團隊*