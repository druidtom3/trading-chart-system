# FVG 交易系統架構設計文檔 v3.0

## 文檔概覽

本文檔集合提供 Fair Value Gap (FVG) 交易系統的完整技術規格，基於現有實作分析並大幅擴展功能。

### 文檔結構
1. **本文檔** - 系統架構概覽與技術棧
2. `FVG_Frontend_Specification_v3.md` - 前端UI/UX完整規格  
3. `FVG_Backend_API_v3.md` - 後端API與數據模型
4. `FVG_Implementation_Guide_v3.md` - 開發實現指南
5. `FVG_Testing_QA_v3.md` - 測試與品質保證

---

## 1. 系統概覽

### 1.1 產品定位
專業級FVG交易分析系統，提供：
- **實時FVG偵測** - 多時間框架同步偵測Fair Value Gap
- **高級視覺化** - 漸層填充、條紋效果、動畫轉場
- **智能回放** - K線逐步回放，多TF數據同步
- **交互分析** - 點擊、拖拽、標註、測量工具
- **數據持久化** - 圖形標註、設定偏好、歷史記錄

### 1.2 核心功能模塊

```
┌─────────────────────────────────────────────────────────────┐
│                    FVG 交易系統                               │
├──────────────┬──────────────┬──────────────┬─────────────────┤
│ 數據處理層    │ 業務邏輯層    │ 表現層       │ 存儲層          │
├──────────────┼──────────────┼──────────────┼─────────────────┤
│ • K線數據     │ • FVG偵測     │ • 圖表渲染   │ • 歷史數據      │
│ • 市場數據    │ • 多TF同步    │ • 控制面板   │ • 用戶設定      │
│ • 時區轉換    │ • 回放控制    │ • 互動工具   │ • 標註數據      │
│ • 數據清理    │ • 狀態管理    │ • 響應式UI   │ • 緩存管理      │
└──────────────┴──────────────┴──────────────┴─────────────────┘
```

## 2. 技術架構

### 2.1 整體架構圖

```mermaid
graph TB
    subgraph "前端層 (Frontend Layer)"
        UI[React/Vue UI Components]
        STATE[狀態管理 Zustand/Pinia]
        CHART[Chart Engine LightweightCharts]
        WS[WebSocket Client]
    end
    
    subgraph "API網關層 (API Gateway)"
        GATEWAY[Nginx/API Gateway]
        AUTH[身份驗證]
        RATE[速率限制]
    end
    
    subgraph "業務服務層 (Business Services)"
        FVG_API[FVG Detection Service]
        REPLAY_API[Replay Service]  
        DATA_API[Data Management Service]
        USER_API[User Service]
    end
    
    subgraph "數據層 (Data Layer)"
        REDIS[(Redis Cache)]
        POSTGRES[(PostgreSQL)]
        TIMESERIES[(InfluxDB/TimescaleDB)]
        FILES[(File Storage)]
    end
    
    UI --> STATE
    STATE --> CHART
    UI --> WS
    
    CHART --> GATEWAY
    WS --> GATEWAY
    
    GATEWAY --> AUTH
    GATEWAY --> RATE
    GATEWAY --> FVG_API
    GATEWAY --> REPLAY_API
    GATEWAY --> DATA_API
    GATEWAY --> USER_API
    
    FVG_API --> REDIS
    FVG_API --> TIMESERIES
    REPLAY_API --> REDIS
    REPLAY_API --> TIMESERIES
    DATA_API --> POSTGRES
    DATA_API --> FILES
    USER_API --> POSTGRES
```

### 2.2 技術棧選擇

#### 前端技術棧
```typescript
// 核心框架選項
Framework: React 18+ with TypeScript | Vue 3 + TypeScript
狀態管理: Zustand (React) | Pinia (Vue)
圖表引擎: LightweightCharts v4+
樣式方案: Tailwind CSS + Styled Components
建構工具: Vite + ESBuild
測試框架: Vitest + Testing Library
```

#### 後端技術棧  
```python
# 現有基礎擴展
核心框架: FastAPI (升級自Flask) + Python 3.11+
異步處理: asyncio + aioredis + asyncpg
數據庫: PostgreSQL 15+ + Redis 7+ + InfluxDB 2.0
消息隊列: Redis Streams | RabbitMQ
部署方案: Docker + Kubernetes | Docker Compose
監控方案: Prometheus + Grafana + ELK Stack
```

### 2.3 數據架構設計

#### 2.3.1 多時間框架數據結構
```sql
-- K線數據表設計 (TimescaleDB)
CREATE TABLE candles (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    timeframe VARCHAR(5) NOT NULL, -- M1, M5, M15, H1, H4, D1
    timestamp TIMESTAMPTZ NOT NULL,
    open DECIMAL(12,4) NOT NULL,
    high DECIMAL(12,4) NOT NULL, 
    low DECIMAL(12,4) NOT NULL,
    close DECIMAL(12,4) NOT NULL,
    volume BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 創建時間序列超表
SELECT create_hypertable('candles', 'timestamp', chunk_time_interval => INTERVAL '1 day');

-- 索引優化
CREATE INDEX ON candles (symbol, timeframe, timestamp DESC);
CREATE INDEX ON candles (timestamp, symbol) WHERE timeframe = 'M1';
```

#### 2.3.2 FVG數據結構
```sql
-- FVG檢測結果表
CREATE TABLE fvg_detections (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    timeframe VARCHAR(5) NOT NULL,
    fvg_number INTEGER NOT NULL, -- 全局唯一編號
    type fvg_type_enum NOT NULL, -- 'bullish' | 'bearish'
    
    -- 價格邊界
    top_price DECIMAL(12,4) NOT NULL,
    bottom_price DECIMAL(12,4) NOT NULL,
    
    -- 時間邊界
    start_time TIMESTAMPTZ NOT NULL,  -- L candle time
    end_time TIMESTAMPTZ NOT NULL,    -- L + 40 candles time
    detection_time TIMESTAMPTZ NOT NULL, -- R candle time (確認時間)
    
    -- 狀態追蹤
    status fvg_status_enum DEFAULT 'valid',
    cleared_at TIMESTAMPTZ NULL,
    cleared_by VARCHAR(10) NULL, -- 'wick' | 'close' | 'gap'
    cleared_price DECIMAL(12,4) NULL,
    
    -- 關聯K線索引
    left_candle_id BIGINT NOT NULL,
    middle_candle_id BIGINT NOT NULL, 
    right_candle_id BIGINT NOT NULL,
    
    -- 元數據
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT fvg_price_logic CHECK (
        (type = 'bullish' AND top_price > bottom_price) OR
        (type = 'bearish' AND top_price > bottom_price)
    )
);

-- 枚舉類型定義
CREATE TYPE fvg_type_enum AS ENUM ('bullish', 'bearish');
CREATE TYPE fvg_status_enum AS ENUM ('valid', 'cleared', 'invalid');

-- 索引設計
CREATE UNIQUE INDEX ON fvg_detections (symbol, timeframe, fvg_number);
CREATE INDEX ON fvg_detections (symbol, timeframe, status, detection_time);
CREATE INDEX ON fvg_detections (start_time, end_time) WHERE status = 'valid';
```

#### 2.3.3 用戶繪圖數據結構
```sql
-- 用戶繪圖數據表
CREATE TABLE user_drawings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    symbol VARCHAR(10) NOT NULL,
    drawing_type drawing_type_enum NOT NULL,
    
    -- 繪圖數據 (JSON)
    drawing_data JSONB NOT NULL,
    
    -- 顯示屬性
    style_config JSONB NOT NULL DEFAULT '{}',
    is_visible BOOLEAN DEFAULT true,
    z_index INTEGER DEFAULT 0,
    
    -- 時間戳
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- 約束
    CONSTRAINT valid_drawing_data CHECK (
        (drawing_type = 'horizontal_line' AND drawing_data ? 'price') OR
        (drawing_type = 'rectangle' AND drawing_data ? 'price1' AND drawing_data ? 'price2')
    )
);

CREATE TYPE drawing_type_enum AS ENUM (
    'horizontal_line', 'trend_line', 'rectangle', 
    'fibonacci', 'text_note', 'price_alert'
);

-- 用戶設定表
CREATE TABLE user_preferences (
    user_id UUID PRIMARY KEY,
    chart_settings JSONB NOT NULL DEFAULT '{}',
    fvg_settings JSONB NOT NULL DEFAULT '{}',
    ui_preferences JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 3. 性能與擴展性設計

### 3.1 性能目標
- **K線渲染**: 400根K線內60fps流暢渲染
- **FVG計算**: 單次檢測<100ms (包含40根回溯檢查)
- **多TF切換**: <200ms完成數據加載和視圖切換
- **內存使用**: 前端峰值<150MB，後端單進程<512MB
- **併發處理**: 支持100+同時用戶

### 3.2 緩存策略

#### 3.2.1 多層緩存架構
```python
# 緩存層級設計
class CacheStrategy:
    L1_MEMORY = "進程內存緩存"      # 100ms訪問，熱點數據
    L2_REDIS = "Redis分散式緩存"    # 1-5ms訪問，共享數據  
    L3_DATABASE = "數據庫查詢"      # 10-100ms，持久化數據
    
    # 緩存鍵設計
    CANDLE_KEY = "candles:{symbol}:{timeframe}:{date}"
    FVG_KEY = "fvgs:{symbol}:{timeframe}:{date_range}"  
    USER_DRAWINGS = "drawings:{user_id}:{symbol}"
```

#### 3.2.2 智能預取策略
```python
class DataPreloader:
    """智能數據預加載"""
    
    async def preload_adjacent_data(self, current_date: str, timeframe: str):
        """預載入相鄰日期數據"""
        prev_date = get_previous_trading_day(current_date)
        next_date = get_next_trading_day(current_date)
        
        tasks = [
            self.load_candles(prev_date, timeframe),
            self.load_candles(next_date, timeframe),
            self.precompute_fvgs(prev_date, timeframe),
            self.precompute_fvgs(next_date, timeframe)
        ]
        await asyncio.gather(*tasks, return_exceptions=True)
    
    async def preload_multi_timeframe(self, date: str, base_tf: str):
        """預載入相關時間框架數據"""
        related_tfs = self.get_related_timeframes(base_tf)
        tasks = [
            self.load_candles(date, tf) for tf in related_tfs
        ]
        await asyncio.gather(*tasks, return_exceptions=True)
```

### 3.3 實時數據處理

#### 3.3.1 WebSocket事件設計
```typescript
// WebSocket 事件類型定義
interface WSEventMap {
    // K線數據事件
    'candle_update': CandleUpdateEvent;
    'multi_tf_candle': MultiTimeframeCandleEvent;
    
    // FVG事件
    'fvg_detected': FVGDetectedEvent; 
    'fvg_cleared': FVGClearedEvent;
    'fvg_batch_update': FVGBatchUpdateEvent;
    
    // 回放控制事件
    'replay_started': ReplayStartedEvent;
    'replay_progress': ReplayProgressEvent;
    'replay_finished': ReplayFinishedEvent;
    
    // 系統事件
    'connection_status': ConnectionStatusEvent;
    'error': ErrorEvent;
}

// 事件數據結構
interface MultiTimeframeCandleEvent {
    type: 'multi_tf_candle';
    timestamp: number;
    primary_tf: Timeframe;
    candles: Record<Timeframe, CandleData>;
    synchronized_fvgs: FVGData[];
    metadata: {
        replay_progress?: number;
        market_session?: MarketSession;
    };
}
```

#### 3.3.2 背壓控制
```python
class BackpressureManager:
    """WebSocket背壓控制"""
    
    def __init__(self, max_queue_size: int = 1000):
        self.max_queue_size = max_queue_size
        self.client_queues: Dict[str, asyncio.Queue] = {}
        
    async def send_with_backpressure(
        self, 
        client_id: str, 
        message: Dict[str, Any]
    ):
        """發送消息，支持背壓控制"""
        queue = self.client_queues.get(client_id)
        if not queue:
            return
            
        if queue.qsize() >= self.max_queue_size:
            # 丟棄最舊的消息
            try:
                await queue.get_nowait()
            except asyncio.QueueEmpty:
                pass
        
        await queue.put(message)
```

## 4. 安全性設計

### 4.1 身份驗證與授權
```python
class SecurityConfig:
    """安全配置"""
    
    # JWT配置
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
    JWT_ALGORITHM = "HS256"  
    JWT_EXPIRE_MINUTES = 30
    REFRESH_TOKEN_EXPIRE_DAYS = 7
    
    # 速率限制
    RATE_LIMITS = {
        "api_calls": "1000/hour",
        "websocket_connections": "10/minute", 
        "data_requests": "500/hour"
    }
    
    # CORS配置
    CORS_ORIGINS = [
        "http://localhost:3000",
        "https://yourdomain.com"
    ]
```

### 4.2 數據驗證
```python
from pydantic import BaseModel, validator
from typing import List, Optional
import re

class FVGDetectionRequest(BaseModel):
    """FVG偵測請求驗證"""
    symbol: str
    timeframe: str
    date_range: DateRange
    settings: FVGSettings
    
    @validator('symbol')
    def validate_symbol(cls, v):
        if not re.match(r'^[A-Z]{2,10}$', v):
            raise ValueError('Invalid symbol format')
        return v
    
    @validator('timeframe') 
    def validate_timeframe(cls, v):
        valid_tfs = ['M1', 'M5', 'M15', 'H1', 'H4', 'D1']
        if v not in valid_tfs:
            raise ValueError(f'Invalid timeframe: {v}')
        return v

class WebSocketMessage(BaseModel):
    """WebSocket消息驗證"""
    type: str
    data: dict
    timestamp: float
    
    @validator('type')
    def validate_message_type(cls, v):
        valid_types = [
            'subscribe_candles', 'unsubscribe_candles',
            'subscribe_fvgs', 'unsubscribe_fvgs',
            'replay_control'
        ]
        if v not in valid_types:
            raise ValueError(f'Invalid message type: {v}')
        return v
```

## 5. 監控與日志設計

### 5.1 應用指標監控
```python
from prometheus_client import Counter, Histogram, Gauge
import time

# 定義監控指標
fvg_detection_counter = Counter(
    'fvg_detections_total',
    'Total number of FVG detections',
    ['symbol', 'timeframe', 'type']
)

fvg_detection_duration = Histogram(
    'fvg_detection_duration_seconds', 
    'Time spent on FVG detection',
    ['symbol', 'timeframe']
)

active_websocket_connections = Gauge(
    'websocket_connections_active',
    'Number of active WebSocket connections'
)

class MetricsCollector:
    """指標收集器"""
    
    @staticmethod
    def record_fvg_detection(symbol: str, timeframe: str, fvg_type: str, duration: float):
        fvg_detection_counter.labels(
            symbol=symbol, 
            timeframe=timeframe, 
            type=fvg_type
        ).inc()
        
        fvg_detection_duration.labels(
            symbol=symbol,
            timeframe=timeframe  
        ).observe(duration)
    
    @staticmethod
    def track_websocket_connection(delta: int):
        active_websocket_connections.inc(delta)
```

### 5.2 結構化日志
```python
import structlog
from typing import Dict, Any

# 配置結構化日志
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="ISO"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

class FVGDetectionService:
    """FVG偵測服務（含日志）"""
    
    async def detect_fvgs(self, symbol: str, timeframe: str, date: str) -> List[FVGData]:
        start_time = time.time()
        
        logger.info(
            "fvg_detection_started",
            symbol=symbol,
            timeframe=timeframe, 
            date=date,
            request_id=self.generate_request_id()
        )
        
        try:
            # FVG偵測邏輯
            results = await self._perform_detection(symbol, timeframe, date)
            
            detection_time = time.time() - start_time
            
            logger.info(
                "fvg_detection_completed",
                symbol=symbol,
                timeframe=timeframe,
                date=date,
                fvg_count=len(results),
                detection_time=detection_time,
                bullish_count=len([f for f in results if f.type == 'bullish']),
                bearish_count=len([f for f in results if f.type == 'bearish'])
            )
            
            return results
            
        except Exception as e:
            logger.error(
                "fvg_detection_failed",
                symbol=symbol,
                timeframe=timeframe,
                date=date,
                error=str(e),
                error_type=type(e).__name__
            )
            raise
```

## 6. 部署架構

### 6.1 容器化部署
```yaml
# docker-compose.yml
version: '3.8'

services:
  # 前端應用
  frontend:
    build: 
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - REACT_APP_API_URL=http://api:8000
    depends_on:
      - api

  # API服務  
  api:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/fvg_db
      - REDIS_URL=redis://redis:6379
      - INFLUXDB_URL=http://influxdb:8086
    depends_on:
      - postgres
      - redis
      - influxdb
    volumes:
      - ./data:/app/data

  # 數據庫服務
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: fvg_db
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  influxdb:
    image: influxdb:2.0
    ports:
      - "8086:8086"
    environment:
      - INFLUXDB_DB=market_data
      - INFLUXDB_ADMIN_USER=admin
      - INFLUXDB_ADMIN_PASSWORD=admin123
    volumes:
      - influxdb_data:/var/lib/influxdb2

  # 監控服務
  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus

  grafana:
    image: grafana/grafana
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana:/etc/grafana/provisioning

volumes:
  postgres_data:
  redis_data:
  influxdb_data:
  prometheus_data:
  grafana_data:
```

### 6.2 Kubernetes部署
```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: fvg-api
  labels:
    app: fvg-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: fvg-api
  template:
    metadata:
      labels:
        app: fvg-api
    spec:
      containers:
      - name: api
        image: fvg-system/api:latest
        ports:
        - containerPort: 8000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: fvg-secrets
              key: database-url
        resources:
          requests:
            memory: "256Mi" 
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5

---
apiVersion: v1
kind: Service  
metadata:
  name: fvg-api-service
spec:
  selector:
    app: fvg-api
  ports:
  - protocol: TCP
    port: 80
    targetPort: 8000
  type: ClusterIP

---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: fvg-api-ingress
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - api.fvg-system.com
    secretName: fvg-api-tls
  rules:
  - host: api.fvg-system.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: fvg-api-service
            port:
              number: 80
```

## 7. 總結

本架構文檔提供了FVG交易系統的完整技術藍圖，包括：

- ✅ **可擴展的微服務架構** - 支持水平擴展和高併發
- ✅ **高性能數據處理** - 多層緩存和智能預取策略  
- ✅ **實時通信機制** - WebSocket + 背壓控制
- ✅ **完善的監控體系** - 指標收集、結構化日志、告警機制
- ✅ **企業級安全設計** - 身份驗證、數據驗證、速率限制
- ✅ **容器化部署方案** - Docker + Kubernetes 生產環境

### 下一步閱讀
請繼續閱讀以下專業文檔：
- [前端UI/UX完整規格](./FVG_Frontend_Specification_v3.md)
- [後端API與數據模型](./FVG_Backend_API_v3.md) 
- [開發實現指南](./FVG_Implementation_Guide_v3.md)
- [測試與品質保證](./FVG_Testing_QA_v3.md)

---

*版本: v3.0 | 更新日期: 2025-08-20 | 維護者: FVG開發團隊*