# FVG 後端API與數據模型設計 v3.0

## 文檔概覽

本文檔定義FVG交易系統後端的完整API規格、數據模型、業務邏輯和系統架構。基於FastAPI構建現代化RESTful API和WebSocket實時通信。

---

## 1. API架構概覽

### 1.1 技術選型升級

```python
# requirements.txt - 核心依賴
fastapi==0.104.1           # API框架 (升級自Flask)
uvicorn[standard]==0.24.0  # ASGI服務器
pydantic==2.5.0           # 數據驗證
sqlalchemy==2.0.23        # ORM
alembic==1.12.1           # 數據庫遷移
redis==5.0.1              # 緩存和會話
asyncpg==0.29.0           # PostgreSQL異步驅動
asyncio-mqtt==0.13.0      # MQTT支持 (可選)
prometheus-client==0.19.0 # 監控指標
structlog==23.2.0         # 結構化日志
pyjwt==2.8.0             # JWT認證
python-multipart==0.0.6   # 文件上傳
websockets==11.0.3        # WebSocket支持
```

### 1.2 API版本管理

```python
# API版本設計
API_VERSION_PREFIX = "/api/v3"

# 版本兼容性矩陣
SUPPORTED_VERSIONS = {
    "v3": {
        "status": "current",
        "features": ["multi_tf_sync", "advanced_fvg", "real_time_ws"],
        "deprecated_date": None
    },
    "v2": {
        "status": "deprecated",
        "features": ["basic_fvg", "simple_replay"],
        "deprecated_date": "2024-12-01",
        "sunset_date": "2025-06-01"
    }
}

# FastAPI應用配置
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

app = FastAPI(
    title="FVG Trading System API",
    description="Professional Fair Value Gap Trading Analysis System",
    version="3.0.0",
    openapi_url=f"{API_VERSION_PREFIX}/openapi.json",
    docs_url=f"{API_VERSION_PREFIX}/docs",
    redoc_url=f"{API_VERSION_PREFIX}/redoc"
)

# 中間件配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://yourdomain.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=1000)
```

## 2. 核心數據模型

### 2.1 K線數據模型

```python
from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from enum import Enum
import uuid

class TimeframeEnum(str, Enum):
    """時間框架枚舉"""
    M1 = "M1"
    M5 = "M5"
    M15 = "M15"
    H1 = "H1"
    H4 = "H4"
    D1 = "D1"

class CandleData(BaseModel):
    """K線數據模型"""
    id: Optional[str] = Field(default_factory=lambda: str(uuid.uuid4()))
    symbol: str = Field(..., description="交易品種", example="MNQ")
    timeframe: TimeframeEnum = Field(..., description="時間框架")
    timestamp: int = Field(..., description="Unix時間戳 (秒)", gt=0)
    open: float = Field(..., description="開盤價", gt=0)
    high: float = Field(..., description="最高價", gt=0) 
    low: float = Field(..., description="最低價", gt=0)
    close: float = Field(..., description="收盤價", gt=0)
    volume: int = Field(default=0, description="成交量", ge=0)
    
    # 計算屬性
    is_bullish: bool = Field(default=False, description="是否為陽線")
    body_size: float = Field(default=0.0, description="實體大小")
    upper_shadow: float = Field(default=0.0, description="上影線長度")
    lower_shadow: float = Field(default=0.0, description="下影線長度")
    
    @validator('high')
    def high_must_be_highest(cls, v, values):
        if 'open' in values and 'low' in values and 'close' in values:
            prices = [values['open'], values['low'], values['close'], v]
            if v != max(prices):
                raise ValueError('high must be the highest price')
        return v
    
    @validator('low')
    def low_must_be_lowest(cls, v, values):
        if 'open' in values and 'high' in values and 'close' in values:
            prices = [values['open'], values['high'], values['close'], v]
            if v != min(prices):
                raise ValueError('low must be the lowest price')
        return v
    
    def __post_init_post_parse__(self):
        """計算派生屬性"""
        self.is_bullish = self.close > self.open
        self.body_size = abs(self.close - self.open)
        self.upper_shadow = self.high - max(self.open, self.close)
        self.lower_shadow = min(self.open, self.close) - self.low

class MultiTimeframeCandleData(BaseModel):
    """多時間框架K線數據"""
    primary_timeframe: TimeframeEnum
    timestamp: int = Field(..., description="主時間框架的時間戳")
    candles: Dict[TimeframeEnum, CandleData] = Field(..., description="各時間框架的K線數據")
    synchronization_quality: float = Field(default=1.0, description="同步質量 0-1", ge=0, le=1)
    
    class Config:
        schema_extra = {
            "example": {
                "primary_timeframe": "M1",
                "timestamp": 1703001600,
                "candles": {
                    "M1": {
                        "timestamp": 1703001600,
                        "open": 17000.50,
                        "high": 17010.25, 
                        "low": 16995.75,
                        "close": 17005.00
                    },
                    "M5": {
                        "timestamp": 1703001300,
                        "open": 16985.00,
                        "high": 17015.50,
                        "low": 16980.25,
                        "close": 17005.00
                    }
                }
            }
        }
```

### 2.2 FVG數據模型

```python
class FVGTypeEnum(str, Enum):
    """FVG類型"""
    BULLISH = "bullish"
    BEARISH = "bearish"

class FVGStatusEnum(str, Enum):
    """FVG狀態"""
    VALID = "valid"
    CLEARED = "cleared"
    INVALID = "invalid"

class FVGClearedByEnum(str, Enum):
    """FVG清除方式"""
    WICK = "wick"
    CLOSE = "close"
    GAP = "gap"

class FVGData(BaseModel):
    """FVG數據模型"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    number: int = Field(..., description="全局唯一編號", gt=0)
    symbol: str = Field(..., description="交易品種")
    timeframe: TimeframeEnum = Field(..., description="時間框架")
    type: FVGTypeEnum = Field(..., description="FVG類型")
    
    # 價格邊界
    top_price: float = Field(..., description="上邊界價格", gt=0)
    bottom_price: float = Field(..., description="下邊界價格", gt=0)
    gap_size: float = Field(default=0.0, description="缺口大小", ge=0)
    gap_size_points: float = Field(default=0.0, description="缺口大小(點)", ge=0)
    
    # 時間邊界
    start_time: int = Field(..., description="開始時間戳(L candle)")
    end_time: int = Field(..., description="結束時間戳(L+40)")
    detection_time: int = Field(..., description="檢測時間戳(R candle)")
    
    # 狀態信息
    status: FVGStatusEnum = Field(default=FVGStatusEnum.VALID)
    cleared_at: Optional[int] = Field(None, description="清除時間戳")
    cleared_by: Optional[FVGClearedByEnum] = Field(None, description="清除方式")
    cleared_price: Optional[float] = Field(None, description="清除時的價格")
    
    # K線索引信息
    left_candle_index: int = Field(..., description="左側K線索引")
    middle_candle_index: int = Field(..., description="中間K線索引")
    right_candle_index: int = Field(..., description="右側K線索引")
    
    # 元數據
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    @validator('bottom_price')
    def validate_price_order(cls, v, values):
        if 'top_price' in values and v >= values['top_price']:
            raise ValueError('bottom_price must be less than top_price')
        return v
    
    def __post_init_post_parse__(self):
        """計算派生屬性"""
        self.gap_size = abs(self.top_price - self.bottom_price)
        self.gap_size_points = self.gap_size * 4  # MNQ: 1點 = 0.25

class FVGBatchUpdate(BaseModel):
    """FVG批量更新"""
    added: List[FVGData] = Field(default_factory=list)
    updated: List[FVGData] = Field(default_factory=list)
    cleared: List[str] = Field(default_factory=list, description="已清除的FVG ID列表")
    timestamp: int = Field(default_factory=lambda: int(datetime.now().timestamp()))

class FVGStatistics(BaseModel):
    """FVG統計信息"""
    total_detected: int = Field(default=0)
    bullish_count: int = Field(default=0)
    bearish_count: int = Field(default=0)
    valid_count: int = Field(default=0)
    cleared_count: int = Field(default=0)
    
    # 高級統計
    average_gap_size: float = Field(default=0.0)
    largest_gap_size: float = Field(default=0.0)
    smallest_gap_size: float = Field(default=0.0)
    clearance_rate: float = Field(default=0.0, description="清除率 %", ge=0, le=100)
    
    # 時間分析
    average_duration_seconds: int = Field(default=0)
    fastest_clear_seconds: int = Field(default=0)
    longest_duration_seconds: int = Field(default=0)
    
    # 分佈統計
    gap_size_distribution: Dict[str, int] = Field(default_factory=dict)
    hourly_distribution: Dict[str, int] = Field(default_factory=dict)
    
    class Config:
        schema_extra = {
            "example": {
                "total_detected": 45,
                "bullish_count": 28,
                "bearish_count": 17,
                "valid_count": 12,
                "cleared_count": 33,
                "average_gap_size": 8.5,
                "clearance_rate": 73.3
            }
        }
```

### 2.3 用戶繪圖模型

```python
class DrawingTypeEnum(str, Enum):
    """繪圖類型"""
    HORIZONTAL_LINE = "horizontal_line"
    TREND_LINE = "trend_line"
    RECTANGLE = "rectangle"
    FIBONACCI = "fibonacci"
    TEXT_NOTE = "text_note"
    PRICE_ALERT = "price_alert"

class HorizontalLineData(BaseModel):
    """水平線數據"""
    price: float = Field(..., description="價格水平")
    color: str = Field(default="#007AFF", description="線條顏色")
    width: int = Field(default=1, description="線條粗細", ge=1, le=5)
    style: str = Field(default="solid", description="線條樣式")
    label: Optional[str] = Field(None, description="標籤文字")

class RectangleData(BaseModel):
    """矩形數據"""
    time1: int = Field(..., description="開始時間戳")
    time2: int = Field(..., description="結束時間戳") 
    price1: float = Field(..., description="價格1")
    price2: float = Field(..., description="價格2")
    fill_color: str = Field(default="rgba(0,122,255,0.1)", description="填充顏色")
    border_color: str = Field(default="#007AFF", description="邊框顏色")
    border_width: int = Field(default=1, description="邊框粗細")

class TextNoteData(BaseModel):
    """文字註解數據"""
    time: int = Field(..., description="時間戳位置")
    price: float = Field(..., description="價格位置")
    text: str = Field(..., description="註解文字", max_length=200)
    font_size: int = Field(default=12, description="字體大小", ge=8, le=24)
    color: str = Field(default="#FFFFFF", description="文字顏色")
    background_color: str = Field(default="rgba(0,0,0,0.7)", description="背景顏色")

class UserDrawing(BaseModel):
    """用戶繪圖模型"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str = Field(..., description="用戶ID")
    symbol: str = Field(..., description="交易品種")
    drawing_type: DrawingTypeEnum = Field(..., description="繪圖類型")
    
    # 繪圖數據 (使用Union處理不同類型)
    drawing_data: Dict[str, Any] = Field(..., description="繪圖數據")
    
    # 樣式配置
    is_visible: bool = Field(default=True, description="是否可見")
    z_index: int = Field(default=0, description="層級", ge=0)
    locked: bool = Field(default=False, description="是否鎖定")
    
    # 跨時間框架設置
    persist_across_timeframes: bool = Field(default=True, description="跨時間框架持久化")
    visible_timeframes: List[TimeframeEnum] = Field(default_factory=list, description="可見的時間框架")
    
    # 元數據
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    @validator('drawing_data')
    def validate_drawing_data(cls, v, values):
        if 'drawing_type' not in values:
            return v
            
        drawing_type = values['drawing_type']
        
        # 根據繪圖類型驗證數據結構
        if drawing_type == DrawingTypeEnum.HORIZONTAL_LINE:
            HorizontalLineData(**v)  # 驗證數據結構
        elif drawing_type == DrawingTypeEnum.RECTANGLE:
            RectangleData(**v)
        elif drawing_type == DrawingTypeEnum.TEXT_NOTE:
            TextNoteData(**v)
            
        return v
```

## 3. API端點設計

### 3.1 K線數據API

```python
from fastapi import APIRouter, Depends, Query, HTTPException, Path
from typing import List, Optional
import asyncio

router = APIRouter(prefix="/candles", tags=["Candle Data"])

@router.get("/timeframes", response_model=Dict[str, List[str]])
async def get_available_timeframes():
    """獲取可用的時間框架"""
    return {
        "timeframes": [tf.value for tf in TimeframeEnum],
        "loaded": await get_loaded_timeframes(),
        "supported_symbols": ["MNQ", "NQ", "ES", "YM"],
        "default_symbol": "MNQ"
    }

@router.get("/{symbol}/{timeframe}/{date}", response_model=List[CandleData])
async def get_candles_by_date(
    symbol: str = Path(..., description="交易品種", example="MNQ"),
    timeframe: TimeframeEnum = Path(..., description="時間框架"),
    date: str = Path(..., description="日期 YYYY-MM-DD", regex=r"\d{4}-\d{2}-\d{2}"),
    limit: int = Query(400, description="返回數量限制", ge=1, le=1440),
    include_extended_hours: bool = Query(False, description="包含盤前盤後")
):
    """獲取指定日期的K線數據"""
    try:
        candles = await candle_service.get_candles_by_date(
            symbol, timeframe, date, limit, include_extended_hours
        )
        
        if not candles:
            raise HTTPException(404, f"No candle data found for {symbol} {timeframe} on {date}")
        
        return candles
    except Exception as e:
        logger.error(f"Error fetching candles: {e}")
        raise HTTPException(500, "Internal server error")

@router.get("/{symbol}/multi-timeframe/{date}", response_model=MultiTimeframeCandleData)
async def get_multi_timeframe_candles(
    symbol: str = Path(..., description="交易品種"),
    date: str = Path(..., description="日期"),
    timeframes: List[TimeframeEnum] = Query(default=[TimeframeEnum.M1, TimeframeEnum.M5, TimeframeEnum.M15]),
    sync_to: TimeframeEnum = Query(TimeframeEnum.M1, description="同步基準時間框架")
):
    """獲取多時間框架同步K線數據"""
    tasks = []
    for tf in timeframes:
        task = candle_service.get_candles_by_date(symbol, tf, date, 1440)
        tasks.append(task)
    
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # 構建多時間框架數據
    multi_tf_data = await sync_service.synchronize_candles(
        dict(zip(timeframes, results)), sync_to
    )
    
    return multi_tf_data

@router.get("/random", response_model=Dict[str, Any])
async def get_random_date_candles(
    symbol: str = Query("MNQ", description="交易品種"),
    timeframe: TimeframeEnum = Query(TimeframeEnum.M15, description="時間框架"),
    ensure_data_quality: bool = Query(True, description="確保數據質量")
):
    """獲取隨機日期的K線數據(用於測試和演示)"""
    random_date = await candle_service.get_random_date_with_data(
        symbol, timeframe, ensure_data_quality
    )
    
    candles = await candle_service.get_candles_by_date(
        symbol, timeframe, random_date
    )
    
    # 附加統計信息
    stats = await candle_service.get_date_statistics(symbol, timeframe, random_date)
    
    return {
        "date": random_date,
        "symbol": symbol,
        "timeframe": timeframe,
        "candles": candles,
        "statistics": stats,
        "market_session_info": await get_market_session_info(random_date)
    }
```

### 3.2 FVG檢測API

```python
router = APIRouter(prefix="/fvg", tags=["FVG Detection"])

@router.post("/detect", response_model=List[FVGData])
async def detect_fvgs(
    detection_request: FVGDetectionRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """執行FVG檢測"""
    try:
        # 異步執行檢測
        task_id = str(uuid.uuid4())
        
        # 立即返回任務ID，後台執行檢測
        background_tasks.add_task(
            fvg_detection_service.detect_fvgs_async,
            task_id,
            detection_request,
            current_user.id
        )
        
        return await fvg_detection_service.get_cached_results(
            detection_request.symbol,
            detection_request.timeframe,
            detection_request.date_range
        )
    
    except Exception as e:
        logger.error(f"FVG detection error: {e}")
        raise HTTPException(500, "FVG detection failed")

@router.get("/{symbol}/{timeframe}", response_model=List[FVGData])
async def get_fvgs(
    symbol: str = Path(..., description="交易品種"),
    timeframe: TimeframeEnum = Path(..., description="時間框架"),
    date_from: Optional[str] = Query(None, description="開始日期"),
    date_to: Optional[str] = Query(None, description="結束日期"),
    status: Optional[FVGStatusEnum] = Query(None, description="狀態過濾"),
    fvg_type: Optional[FVGTypeEnum] = Query(None, description="類型過濾"),
    min_gap_size: Optional[float] = Query(None, description="最小缺口大小", ge=0),
    max_gap_size: Optional[float] = Query(None, description="最大缺口大小", ge=0),
    sort_by: str = Query("detection_time", description="排序字段"),
    sort_order: str = Query("desc", description="排序方向"),
    limit: int = Query(100, description="返回數量", ge=1, le=1000),
    offset: int = Query(0, description="偏移量", ge=0)
):
    """獲取FVG數據(支持複雜查詢)"""
    
    filters = FVGFilters(
        symbol=symbol,
        timeframe=timeframe,
        date_from=date_from,
        date_to=date_to,
        status=status,
        fvg_type=fvg_type,
        min_gap_size=min_gap_size,
        max_gap_size=max_gap_size
    )
    
    return await fvg_service.get_fvgs_with_filters(
        filters, sort_by, sort_order, limit, offset
    )

@router.get("/statistics/{symbol}/{timeframe}", response_model=FVGStatistics)
async def get_fvg_statistics(
    symbol: str = Path(..., description="交易品種"),
    timeframe: TimeframeEnum = Path(..., description="時間框架"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None)
):
    """獲取FVG統計信息"""
    return await fvg_service.calculate_statistics(symbol, timeframe, date_from, date_to)

@router.put("/{fvg_id}/status", response_model=FVGData)
async def update_fvg_status(
    fvg_id: str = Path(..., description="FVG ID"),
    status_update: FVGStatusUpdate,
    current_user: User = Depends(get_current_user)
):
    """更新FVG狀態(手動標記清除等)"""
    
    fvg = await fvg_service.get_fvg_by_id(fvg_id)
    if not fvg:
        raise HTTPException(404, "FVG not found")
    
    # 記錄操作日誌
    await audit_service.log_fvg_status_change(
        fvg_id, fvg.status, status_update.new_status, current_user.id
    )
    
    return await fvg_service.update_fvg_status(fvg_id, status_update)

class FVGDetectionRequest(BaseModel):
    """FVG檢測請求"""
    symbol: str = Field(..., description="交易品種")
    timeframe: TimeframeEnum = Field(..., description="時間框架")
    date_range: DateRange = Field(..., description="日期範圍")
    settings: FVGDetectionSettings = Field(default_factory=FVGDetectionSettings)

class FVGDetectionSettings(BaseModel):
    """FVG檢測設置"""
    max_lookback: int = Field(default=40, description="最大回看K線數", ge=10, le=100)
    min_gap_size: float = Field(default=0.0, description="最小缺口大小", ge=0)
    include_overlapping: bool = Field(default=True, description="包含重疊FVG")
    real_time_updates: bool = Field(default=False, description="實時更新")

class FVGStatusUpdate(BaseModel):
    """FVG狀態更新"""
    new_status: FVGStatusEnum
    cleared_by: Optional[FVGClearedByEnum] = None
    cleared_price: Optional[float] = None
    notes: Optional[str] = Field(None, max_length=500)
```

### 3.3 回放系統API

```python
router = APIRouter(prefix="/replay", tags=["Replay System"])

@router.post("/sessions", response_model=ReplaySession)
async def create_replay_session(
    session_request: CreateReplaySessionRequest,
    current_user: User = Depends(get_current_user)
):
    """創建回放會話"""
    
    # 驗證數據可用性
    data_availability = await replay_service.check_data_availability(
        session_request.symbol,
        session_request.timeframes,
        session_request.date
    )
    
    if not data_availability.is_complete:
        raise HTTPException(400, f"Incomplete data: {data_availability.missing_timeframes}")
    
    session = await replay_service.create_session(
        user_id=current_user.id,
        symbol=session_request.symbol,
        timeframes=session_request.timeframes,
        date=session_request.date,
        settings=session_request.settings
    )
    
    return session

@router.get("/sessions/{session_id}", response_model=ReplaySession)
async def get_replay_session(
    session_id: str = Path(..., description="會話ID"),
    current_user: User = Depends(get_current_user)
):
    """獲取回放會話信息"""
    session = await replay_service.get_session(session_id)
    
    if not session or session.user_id != current_user.id:
        raise HTTPException(404, "Session not found")
    
    return session

@router.post("/sessions/{session_id}/play", response_model=Dict[str, Any])
async def start_replay_playback(
    session_id: str = Path(..., description="會話ID"),
    playback_settings: PlaybackSettings = None,
    current_user: User = Depends(get_current_user)
):
    """開始回放播放"""
    
    session = await replay_service.get_session(session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(404, "Session not found")
    
    if session.status != ReplayStatus.PREPARED:
        raise HTTPException(400, f"Session not ready: {session.status}")
    
    await replay_service.start_playback(session_id, playback_settings)
    
    return {
        "status": "playing",
        "session_id": session_id,
        "websocket_url": f"/ws/replay/{session_id}",
        "estimated_duration_minutes": session.total_candles * session.speed / 60
    }

@router.post("/sessions/{session_id}/pause")
async def pause_replay_playback(
    session_id: str,
    current_user: User = Depends(get_current_user)
):
    """暫停回放"""
    await replay_service.pause_playback(session_id, current_user.id)
    return {"status": "paused"}

@router.post("/sessions/{session_id}/seek")
async def seek_replay_position(
    session_id: str,
    seek_request: SeekRequest,
    current_user: User = Depends(get_current_user)
):
    """跳轉到指定位置"""
    
    session = await replay_service.seek_to_position(
        session_id, seek_request.target_index, current_user.id
    )
    
    return {
        "status": "seeked",
        "current_index": session.current_index,
        "progress_percentage": (session.current_index / session.total_candles) * 100
    }

@router.delete("/sessions/{session_id}")
async def stop_replay_session(
    session_id: str,
    current_user: User = Depends(get_current_user)
):
    """停止並刪除回放會話"""
    await replay_service.stop_and_cleanup_session(session_id, current_user.id)
    return {"status": "stopped"}

# 數據模型
class ReplaySession(BaseModel):
    """回放會話"""
    id: str
    user_id: str
    symbol: str
    timeframes: List[TimeframeEnum]
    date: str
    status: ReplayStatus
    current_index: int = 0
    total_candles: int
    speed: float = 1.0
    settings: ReplaySettings
    created_at: datetime
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None

class ReplayStatus(str, Enum):
    """回放狀態"""
    PREPARING = "preparing"
    PREPARED = "prepared" 
    PLAYING = "playing"
    PAUSED = "paused"
    FINISHED = "finished"
    ERROR = "error"

class CreateReplaySessionRequest(BaseModel):
    """創建回放會話請求"""
    symbol: str = Field(..., description="交易品種")
    timeframes: List[TimeframeEnum] = Field(..., description="時間框架列表", min_items=1)
    date: str = Field(..., description="日期")
    settings: ReplaySettings = Field(default_factory=lambda: ReplaySettings())

class ReplaySettings(BaseModel):
    """回放設置"""
    speed: float = Field(default=1.0, description="播放速度(秒/K線)", gt=0, le=10)
    auto_detect_fvg: bool = Field(default=True, description="自動檢測FVG")
    show_formation_alerts: bool = Field(default=True, description="顯示形成提醒")
    show_clearing_alerts: bool = Field(default=True, description="顯示清除提醒")
    enable_sound_alerts: bool = Field(default=False, description="啟用聲音提醒")

class PlaybackSettings(BaseModel):
    """播放設置"""
    speed: Optional[float] = Field(None, gt=0, le=10)
    start_from_index: Optional[int] = Field(None, ge=0)
    
class SeekRequest(BaseModel):
    """跳轉請求"""
    target_index: int = Field(..., ge=0)
```

### 3.4 用戶繪圖API

```python
router = APIRouter(prefix="/drawings", tags=["User Drawings"])

@router.post("", response_model=UserDrawing)
async def create_drawing(
    drawing: CreateDrawingRequest,
    current_user: User = Depends(get_current_user)
):
    """創建用戶繪圖"""
    
    # 驗證繪圖數據
    validate_drawing_data(drawing.drawing_type, drawing.drawing_data)
    
    # 檢查用戶繪圖數量限制
    current_count = await drawing_service.get_user_drawing_count(
        current_user.id, drawing.symbol
    )
    
    if current_count >= MAX_DRAWINGS_PER_SYMBOL:
        raise HTTPException(400, f"Maximum {MAX_DRAWINGS_PER_SYMBOL} drawings per symbol")
    
    user_drawing = UserDrawing(
        user_id=current_user.id,
        symbol=drawing.symbol,
        drawing_type=drawing.drawing_type,
        drawing_data=drawing.drawing_data,
        is_visible=drawing.is_visible,
        persist_across_timeframes=drawing.persist_across_timeframes
    )
    
    return await drawing_service.create_drawing(user_drawing)

@router.get("/{symbol}", response_model=List[UserDrawing])
async def get_user_drawings(
    symbol: str = Path(..., description="交易品種"),
    drawing_type: Optional[DrawingTypeEnum] = Query(None, description="繪圖類型過濾"),
    visible_only: bool = Query(False, description="只返回可見的繪圖"),
    timeframe: Optional[TimeframeEnum] = Query(None, description="時間框架過濾"),
    current_user: User = Depends(get_current_user)
):
    """獲取用戶繪圖列表"""
    
    filters = DrawingFilters(
        user_id=current_user.id,
        symbol=symbol,
        drawing_type=drawing_type,
        visible_only=visible_only,
        timeframe=timeframe
    )
    
    return await drawing_service.get_drawings_with_filters(filters)

@router.put("/{drawing_id}", response_model=UserDrawing) 
async def update_drawing(
    drawing_id: str = Path(..., description="繪圖ID"),
    update_data: UpdateDrawingRequest,
    current_user: User = Depends(get_current_user)
):
    """更新用戶繪圖"""
    
    drawing = await drawing_service.get_drawing_by_id(drawing_id)
    if not drawing or drawing.user_id != current_user.id:
        raise HTTPException(404, "Drawing not found")
    
    if drawing.locked:
        raise HTTPException(400, "Drawing is locked")
    
    return await drawing_service.update_drawing(drawing_id, update_data)

@router.delete("/{drawing_id}")
async def delete_drawing(
    drawing_id: str = Path(..., description="繪圖ID"),
    current_user: User = Depends(get_current_user)
):
    """刪除用戶繪圖"""
    
    drawing = await drawing_service.get_drawing_by_id(drawing_id)
    if not drawing or drawing.user_id != current_user.id:
        raise HTTPException(404, "Drawing not found")
    
    if drawing.locked:
        raise HTTPException(400, "Drawing is locked")
    
    await drawing_service.delete_drawing(drawing_id)
    return {"status": "deleted"}

@router.post("/bulk-operations")
async def bulk_drawing_operations(
    operations: BulkDrawingOperations,
    current_user: User = Depends(get_current_user)
):
    """批量繪圖操作"""
    
    results = await drawing_service.execute_bulk_operations(
        operations, current_user.id
    )
    
    return results

# 數據模型
class CreateDrawingRequest(BaseModel):
    """創建繪圖請求"""
    symbol: str = Field(..., description="交易品種")
    drawing_type: DrawingTypeEnum = Field(..., description="繪圖類型")
    drawing_data: Dict[str, Any] = Field(..., description="繪圖數據")
    is_visible: bool = Field(default=True, description="是否可見")
    persist_across_timeframes: bool = Field(default=True, description="跨時間框架持久化")
    visible_timeframes: List[TimeframeEnum] = Field(default_factory=list)

class UpdateDrawingRequest(BaseModel):
    """更新繪圖請求"""
    drawing_data: Optional[Dict[str, Any]] = None
    is_visible: Optional[bool] = None
    z_index: Optional[int] = None
    locked: Optional[bool] = None

class BulkDrawingOperations(BaseModel):
    """批量繪圖操作"""
    delete_ids: List[str] = Field(default_factory=list, description="要刪除的繪圖ID")
    toggle_visibility_ids: List[str] = Field(default_factory=list, description="切換可見性的繪圖ID")
    lock_ids: List[str] = Field(default_factory=list, description="要鎖定的繪圖ID")
    unlock_ids: List[str] = Field(default_factory=list, description="要解鎖的繪圖ID")

MAX_DRAWINGS_PER_SYMBOL = 50
```

## 4. WebSocket實時通信

### 4.1 WebSocket連接管理

```python
from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, Set
import json
import asyncio

class ConnectionManager:
    """WebSocket連接管理器"""
    
    def __init__(self):
        # 活動連接: {user_id: {connection_id: websocket}}
        self.active_connections: Dict[str, Dict[str, WebSocket]] = {}
        
        # 訂閱管理: {channel: {user_id: connection_ids}}
        self.subscriptions: Dict[str, Dict[str, Set[str]]] = {}
        
        # 連接元數據
        self.connection_metadata: Dict[str, Dict[str, Any]] = {}
    
    async def connect(self, websocket: WebSocket, user_id: str, connection_id: str):
        """建立WebSocket連接"""
        await websocket.accept()
        
        if user_id not in self.active_connections:
            self.active_connections[user_id] = {}
        
        self.active_connections[user_id][connection_id] = websocket
        self.connection_metadata[connection_id] = {
            "user_id": user_id,
            "connected_at": datetime.now(),
            "last_heartbeat": datetime.now(),
            "subscribed_channels": set()
        }
        
        # 發送連接確認
        await self.send_to_connection(connection_id, {
            "type": "connection_established",
            "connection_id": connection_id,
            "server_time": datetime.now().isoformat()
        })
        
        logger.info(f"User {user_id} connected: {connection_id}")
    
    def disconnect(self, user_id: str, connection_id: str):
        """斷開WebSocket連接"""
        if user_id in self.active_connections:
            self.active_connections[user_id].pop(connection_id, None)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        
        # 清理訂閱
        for channel in self.subscriptions:
            if user_id in self.subscriptions[channel]:
                self.subscriptions[channel][user_id].discard(connection_id)
                if not self.subscriptions[channel][user_id]:
                    del self.subscriptions[channel][user_id]
        
        self.connection_metadata.pop(connection_id, None)
        logger.info(f"User {user_id} disconnected: {connection_id}")
    
    async def subscribe(self, user_id: str, connection_id: str, channel: str):
        """訂閱頻道"""
        if channel not in self.subscriptions:
            self.subscriptions[channel] = {}
        
        if user_id not in self.subscriptions[channel]:
            self.subscriptions[channel][user_id] = set()
        
        self.subscriptions[channel][user_id].add(connection_id)
        
        if connection_id in self.connection_metadata:
            self.connection_metadata[connection_id]["subscribed_channels"].add(channel)
        
        await self.send_to_connection(connection_id, {
            "type": "subscription_confirmed",
            "channel": channel
        })
    
    async def unsubscribe(self, user_id: str, connection_id: str, channel: str):
        """取消訂閱頻道"""
        if (channel in self.subscriptions and 
            user_id in self.subscriptions[channel]):
            self.subscriptions[channel][user_id].discard(connection_id)
            
            if not self.subscriptions[channel][user_id]:
                del self.subscriptions[channel][user_id]
        
        if connection_id in self.connection_metadata:
            self.connection_metadata[connection_id]["subscribed_channels"].discard(channel)
        
        await self.send_to_connection(connection_id, {
            "type": "unsubscription_confirmed", 
            "channel": channel
        })
    
    async def broadcast_to_channel(self, channel: str, message: Dict[str, Any]):
        """向頻道廣播消息"""
        if channel not in self.subscriptions:
            return
        
        disconnected_connections = []
        
        for user_id, connection_ids in self.subscriptions[channel].items():
            if user_id not in self.active_connections:
                continue
            
            for connection_id in connection_ids.copy():
                if connection_id not in self.active_connections[user_id]:
                    disconnected_connections.append((user_id, connection_id))
                    continue
                
                try:
                    websocket = self.active_connections[user_id][connection_id]
                    await websocket.send_text(json.dumps(message))
                except Exception as e:
                    logger.error(f"Failed to send to {connection_id}: {e}")
                    disconnected_connections.append((user_id, connection_id))
        
        # 清理無效連接
        for user_id, connection_id in disconnected_connections:
            self.disconnect(user_id, connection_id)
    
    async def send_to_user(self, user_id: str, message: Dict[str, Any]):
        """向特定用戶發送消息(所有連接)"""
        if user_id not in self.active_connections:
            return
        
        disconnected_connections = []
        
        for connection_id, websocket in self.active_connections[user_id].items():
            try:
                await websocket.send_text(json.dumps(message))
            except Exception as e:
                logger.error(f"Failed to send to user {user_id}, connection {connection_id}: {e}")
                disconnected_connections.append(connection_id)
        
        # 清理無效連接
        for connection_id in disconnected_connections:
            self.disconnect(user_id, connection_id)
    
    async def send_to_connection(self, connection_id: str, message: Dict[str, Any]):
        """向特定連接發送消息"""
        if connection_id not in self.connection_metadata:
            return
        
        user_id = self.connection_metadata[connection_id]["user_id"]
        
        if (user_id in self.active_connections and 
            connection_id in self.active_connections[user_id]):
            try:
                websocket = self.active_connections[user_id][connection_id]
                await websocket.send_text(json.dumps(message))
            except Exception as e:
                logger.error(f"Failed to send to connection {connection_id}: {e}")
                self.disconnect(user_id, connection_id)

# 全局連接管理器
connection_manager = ConnectionManager()
```

### 4.2 WebSocket路由設計

```python
@app.websocket("/ws/realtime/{user_id}")
async def websocket_endpoint(
    websocket: WebSocket, 
    user_id: str,
    token: str = Query(..., description="JWT認證令牌")
):
    """實時數據WebSocket端點"""
    
    # 驗證JWT令牌
    try:
        user = await verify_jwt_token(token)
        if user.id != user_id:
            await websocket.close(code=1008, reason="Unauthorized")
            return
    except Exception:
        await websocket.close(code=1008, reason="Invalid token")
        return
    
    connection_id = str(uuid.uuid4())
    
    try:
        await connection_manager.connect(websocket, user_id, connection_id)
        
        while True:
            # 接收客戶端消息
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # 處理消息
            await handle_websocket_message(user_id, connection_id, message)
            
    except WebSocketDisconnect:
        connection_manager.disconnect(user_id, connection_id)
    except Exception as e:
        logger.error(f"WebSocket error for user {user_id}: {e}")
        connection_manager.disconnect(user_id, connection_id)

async def handle_websocket_message(user_id: str, connection_id: str, message: Dict[str, Any]):
    """處理WebSocket消息"""
    
    message_type = message.get("type")
    
    if message_type == "subscribe":
        # 訂閱頻道
        channel = message.get("channel")
        if channel:
            await connection_manager.subscribe(user_id, connection_id, channel)
    
    elif message_type == "unsubscribe":
        # 取消訂閱
        channel = message.get("channel")
        if channel:
            await connection_manager.unsubscribe(user_id, connection_id, channel)
    
    elif message_type == "heartbeat":
        # 心跳包
        connection_manager.connection_metadata[connection_id]["last_heartbeat"] = datetime.now()
        await connection_manager.send_to_connection(connection_id, {
            "type": "heartbeat_ack",
            "timestamp": datetime.now().isoformat()
        })
    
    elif message_type == "replay_control":
        # 回放控制
        await handle_replay_control(user_id, connection_id, message.get("data", {}))
    
    elif message_type == "fvg_subscription":
        # FVG訂閱設置
        await handle_fvg_subscription(user_id, connection_id, message.get("data", {}))
    
    else:
        # 未知消息類型
        await connection_manager.send_to_connection(connection_id, {
            "type": "error",
            "message": f"Unknown message type: {message_type}"
        })

@app.websocket("/ws/replay/{session_id}")
async def replay_websocket(websocket: WebSocket, session_id: str, token: str = Query(...)):
    """回放專用WebSocket端點"""
    
    # 驗證令牌和會話權限
    user = await verify_jwt_token(token)
    session = await replay_service.get_session(session_id)
    
    if not session or session.user_id != user.id:
        await websocket.close(code=1008, reason="Unauthorized")
        return
    
    connection_id = f"replay_{session_id}_{uuid.uuid4()}"
    
    try:
        await websocket.accept()
        
        # 註冊回放連接
        await replay_service.register_websocket_connection(session_id, connection_id, websocket)
        
        # 開始回放數據流
        await replay_service.start_websocket_stream(session_id, connection_id)
        
        while True:
            # 接收控制消息
            data = await websocket.receive_text()
            control_message = json.loads(data)
            
            # 處理回放控制
            await handle_replay_websocket_control(session_id, connection_id, control_message)
    
    except WebSocketDisconnect:
        await replay_service.unregister_websocket_connection(session_id, connection_id)
    except Exception as e:
        logger.error(f"Replay WebSocket error: {e}")
        await replay_service.unregister_websocket_connection(session_id, connection_id)
```

### 4.3 實時事件分發

```python
class EventDispatcher:
    """事件分發器"""
    
    def __init__(self, connection_manager: ConnectionManager):
        self.connection_manager = connection_manager
        self.event_handlers = {}
        
    def register_handler(self, event_type: str, handler):
        """註冊事件處理器"""
        if event_type not in self.event_handlers:
            self.event_handlers[event_type] = []
        self.event_handlers[event_type].append(handler)
    
    async def dispatch_event(self, event_type: str, event_data: Dict[str, Any]):
        """分發事件"""
        
        # 執行事件處理器
        if event_type in self.event_handlers:
            for handler in self.event_handlers[event_type]:
                try:
                    await handler(event_data)
                except Exception as e:
                    logger.error(f"Event handler error for {event_type}: {e}")
        
        # 廣播到WebSocket客戶端
        channel = f"events:{event_type}"
        message = {
            "type": "event",
            "event_type": event_type,
            "data": event_data,
            "timestamp": datetime.now().isoformat()
        }
        
        await self.connection_manager.broadcast_to_channel(channel, message)

# 全局事件分發器
event_dispatcher = EventDispatcher(connection_manager)

# FVG事件處理
async def handle_fvg_detected(event_data: Dict[str, Any]):
    """處理FVG檢測事件"""
    fvg = event_data["fvg"]
    symbol = fvg["symbol"]
    timeframe = fvg["timeframe"]
    
    # 更新緩存
    await fvg_cache_service.add_fvg(symbol, timeframe, fvg)
    
    # 發送到特定頻道
    channel = f"fvg:{symbol}:{timeframe}"
    await connection_manager.broadcast_to_channel(channel, {
        "type": "fvg_detected",
        "fvg": fvg
    })
    
    # 記錄指標
    metrics.fvg_detection_counter.labels(
        symbol=symbol,
        timeframe=timeframe,
        fvg_type=fvg["type"]
    ).inc()

async def handle_fvg_cleared(event_data: Dict[str, Any]):
    """處理FVG清除事件"""
    fvg_id = event_data["fvg_id"]
    cleared_data = event_data["cleared_data"]
    
    # 更新數據庫
    await fvg_service.mark_as_cleared(fvg_id, cleared_data)
    
    # 廣播清除事件
    symbol = cleared_data["symbol"]
    timeframe = cleared_data["timeframe"]
    channel = f"fvg:{symbol}:{timeframe}"
    
    await connection_manager.broadcast_to_channel(channel, {
        "type": "fvg_cleared",
        "fvg_id": fvg_id,
        "cleared_data": cleared_data
    })

# 回放事件處理
async def handle_replay_candle(event_data: Dict[str, Any]):
    """處理回放K線事件"""
    session_id = event_data["session_id"]
    multi_tf_candle = event_data["multi_tf_candle"]
    
    # 發送到回放會話頻道
    channel = f"replay:{session_id}"
    await connection_manager.broadcast_to_channel(channel, {
        "type": "multi_tf_candle",
        "data": multi_tf_candle
    })

# 註冊事件處理器
event_dispatcher.register_handler("fvg_detected", handle_fvg_detected)
event_dispatcher.register_handler("fvg_cleared", handle_fvg_cleared)
event_dispatcher.register_handler("replay_candle", handle_replay_candle)
```

## 5. 緩存策略設計

### 5.1 Redis緩存架構

```python
from redis import Redis
from typing import Optional, List, Dict, Any
import json
import pickle
from datetime import timedelta

class CacheService:
    """緩存服務"""
    
    def __init__(self, redis_client: Redis):
        self.redis = redis_client
        
        # 緩存鍵前綴
        self.KEY_PREFIXES = {
            "candles": "candles",
            "fvgs": "fvgs",
            "statistics": "stats",
            "user_drawings": "drawings",
            "sessions": "sessions"
        }
        
        # 默認過期時間
        self.DEFAULT_EXPIRY = {
            "candles": timedelta(hours=24),
            "fvgs": timedelta(hours=12),
            "statistics": timedelta(hours=6),
            "user_drawings": timedelta(days=30),
            "sessions": timedelta(hours=2)
        }
    
    def _make_key(self, prefix: str, *parts: str) -> str:
        """構建緩存鍵"""
        return f"{self.KEY_PREFIXES[prefix]}:{':'.join(parts)}"
    
    async def get_candles(self, symbol: str, timeframe: str, date: str) -> Optional[List[CandleData]]:
        """獲取K線數據緩存"""
        key = self._make_key("candles", symbol, timeframe, date)
        
        try:
            cached_data = await self.redis.get(key)
            if cached_data:
                data = json.loads(cached_data)
                return [CandleData(**candle) for candle in data]
        except Exception as e:
            logger.error(f"Cache get error: {e}")
        
        return None
    
    async def set_candles(self, symbol: str, timeframe: str, date: str, candles: List[CandleData]):
        """設置K線數據緩存"""
        key = self._make_key("candles", symbol, timeframe, date)
        
        try:
            # 序列化數據
            data = [candle.dict() for candle in candles]
            await self.redis.setex(
                key, 
                self.DEFAULT_EXPIRY["candles"],
                json.dumps(data, default=str)
            )
        except Exception as e:
            logger.error(f"Cache set error: {e}")
    
    async def get_fvgs(self, symbol: str, timeframe: str, date_range_hash: str) -> Optional[List[FVGData]]:
        """獲取FVG數據緩存"""
        key = self._make_key("fvgs", symbol, timeframe, date_range_hash)
        
        try:
            cached_data = await self.redis.get(key)
            if cached_data:
                data = json.loads(cached_data)
                return [FVGData(**fvg) for fvg in data]
        except Exception as e:
            logger.error(f"FVG cache get error: {e}")
        
        return None
    
    async def set_fvgs(self, symbol: str, timeframe: str, date_range_hash: str, fvgs: List[FVGData]):
        """設置FVG數據緩存"""
        key = self._make_key("fvgs", symbol, timeframe, date_range_hash)
        
        try:
            data = [fvg.dict() for fvg in fvgs]
            await self.redis.setex(
                key,
                self.DEFAULT_EXPIRY["fvgs"],
                json.dumps(data, default=str)
            )
        except Exception as e:
            logger.error(f"FVG cache set error: {e}")
    
    async def invalidate_fvg_cache(self, symbol: str, timeframe: str):
        """使FVG緩存失效"""
        pattern = self._make_key("fvgs", symbol, timeframe, "*")
        keys = await self.redis.keys(pattern)
        
        if keys:
            await self.redis.delete(*keys)
            logger.info(f"Invalidated {len(keys)} FVG cache entries for {symbol}:{timeframe}")
    
    # 統計數據緩存
    async def get_statistics(self, cache_key: str) -> Optional[Dict[str, Any]]:
        """獲取統計數據緩存"""
        key = self._make_key("statistics", cache_key)
        
        try:
            cached_data = await self.redis.get(key)
            if cached_data:
                return json.loads(cached_data)
        except Exception as e:
            logger.error(f"Statistics cache get error: {e}")
        
        return None
    
    async def set_statistics(self, cache_key: str, stats: Dict[str, Any]):
        """設置統計數據緩存"""
        key = self._make_key("statistics", cache_key)
        
        try:
            await self.redis.setex(
                key,
                self.DEFAULT_EXPIRY["statistics"],
                json.dumps(stats, default=str)
            )
        except Exception as e:
            logger.error(f"Statistics cache set error: {e}")
    
    # 會話緩存
    async def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """獲取會話數據"""
        key = self._make_key("sessions", session_id)
        
        try:
            cached_data = await self.redis.get(key)
            if cached_data:
                return pickle.loads(cached_data)
        except Exception as e:
            logger.error(f"Session cache get error: {e}")
        
        return None
    
    async def set_session(self, session_id: str, session_data: Dict[str, Any]):
        """設置會話數據"""
        key = self._make_key("sessions", session_id)
        
        try:
            await self.redis.setex(
                key,
                self.DEFAULT_EXPIRY["sessions"],
                pickle.dumps(session_data)
            )
        except Exception as e:
            logger.error(f"Session cache set error: {e}")
    
    async def delete_session(self, session_id: str):
        """刪除會話數據"""
        key = self._make_key("sessions", session_id)
        await self.redis.delete(key)

# 緩存裝飾器
def cache_result(cache_key_func, expiry_seconds=3600):
    """緩存結果裝飾器"""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            # 生成緩存鍵
            cache_key = cache_key_func(*args, **kwargs)
            
            # 嘗試從緩存獲取
            cached_result = await cache_service.redis.get(cache_key)
            if cached_result:
                return json.loads(cached_result)
            
            # 執行原函數
            result = await func(*args, **kwargs)
            
            # 緩存結果
            await cache_service.redis.setex(
                cache_key,
                expiry_seconds,
                json.dumps(result, default=str)
            )
            
            return result
        return wrapper
    return decorator

# 使用示例
@cache_result(
    lambda symbol, tf, date: f"daily_stats:{symbol}:{tf}:{date}",
    expiry_seconds=21600  # 6小時
)
async def get_daily_fvg_statistics(symbol: str, timeframe: str, date: str):
    """獲取日統計(帶緩存)"""
    return await fvg_service.calculate_daily_statistics(symbol, timeframe, date)
```

## 6. 數據庫設計

### 6.1 SQLAlchemy模型定義

```python
from sqlalchemy import Column, String, Integer, Float, DateTime, Boolean, Text, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.dialects.postgresql import UUID, JSONB, ENUM
from sqlalchemy.sql import func
import uuid

Base = declarative_base()

# 枚舉類型
timeframe_enum = ENUM(
    'M1', 'M5', 'M15', 'H1', 'H4', 'D1',
    name='timeframe_enum'
)

fvg_type_enum = ENUM(
    'bullish', 'bearish',
    name='fvg_type_enum'
)

fvg_status_enum = ENUM(
    'valid', 'cleared', 'invalid',
    name='fvg_status_enum'
)

class CandleModel(Base):
    """K線數據表"""
    __tablename__ = 'candles'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    symbol = Column(String(10), nullable=False)
    timeframe = Column(timeframe_enum, nullable=False)
    timestamp = Column(Integer, nullable=False)
    
    open = Column(Float, nullable=False)
    high = Column(Float, nullable=False)
    low = Column(Float, nullable=False)
    close = Column(Float, nullable=False)
    volume = Column(Integer, default=0)
    
    # 計算字段
    is_bullish = Column(Boolean, default=False)
    body_size = Column(Float, default=0.0)
    upper_shadow = Column(Float, default=0.0)
    lower_shadow = Column(Float, default=0.0)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # 索引
    __table_args__ = (
        Index('ix_candles_symbol_timeframe_timestamp', 'symbol', 'timeframe', 'timestamp'),
        Index('ix_candles_timestamp', 'timestamp'),
        Index('ix_candles_symbol_timeframe', 'symbol', 'timeframe'),
    )

class FVGModel(Base):
    """FVG檢測結果表"""
    __tablename__ = 'fvg_detections'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    number = Column(Integer, nullable=False, unique=True)  # 全局唯一編號
    
    symbol = Column(String(10), nullable=False)
    timeframe = Column(timeframe_enum, nullable=False)
    type = Column(fvg_type_enum, nullable=False)
    
    # 價格邊界
    top_price = Column(Float, nullable=False)
    bottom_price = Column(Float, nullable=False)
    gap_size = Column(Float, nullable=False)
    gap_size_points = Column(Float, nullable=False)
    
    # 時間邊界
    start_time = Column(Integer, nullable=False)
    end_time = Column(Integer, nullable=False)
    detection_time = Column(Integer, nullable=False)
    
    # 狀態追蹤
    status = Column(fvg_status_enum, default='valid')
    cleared_at = Column(Integer)
    cleared_by = Column(String(10))
    cleared_price = Column(Float)
    
    # K線索引關聯
    left_candle_index = Column(Integer, nullable=False)
    middle_candle_index = Column(Integer, nullable=False)
    right_candle_index = Column(Integer, nullable=False)
    
    # 元數據
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 索引
    __table_args__ = (
        Index('ix_fvg_symbol_timeframe_status', 'symbol', 'timeframe', 'status'),
        Index('ix_fvg_detection_time', 'detection_time'),
        Index('ix_fvg_number', 'number'),
        Index('ix_fvg_status_valid', 'status', postgresql_where="status = 'valid'"),
    )

class UserDrawingModel(Base):
    """用戶繪圖表"""
    __tablename__ = 'user_drawings'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    symbol = Column(String(10), nullable=False)
    drawing_type = Column(String(20), nullable=False)
    
    # 繪圖數據 (JSON)
    drawing_data = Column(JSONB, nullable=False)
    
    # 顯示屬性
    is_visible = Column(Boolean, default=True)
    z_index = Column(Integer, default=0)
    locked = Column(Boolean, default=False)
    
    # 跨時間框架設置
    persist_across_timeframes = Column(Boolean, default=True)
    visible_timeframes = Column(JSONB, default=list)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 索引
    __table_args__ = (
        Index('ix_drawings_user_symbol', 'user_id', 'symbol'),
        Index('ix_drawings_type', 'drawing_type'),
        Index('ix_drawings_visible', 'is_visible', postgresql_where="is_visible = true"),
    )

class ReplaySessionModel(Base):
    """回放會話表"""
    __tablename__ = 'replay_sessions'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    
    symbol = Column(String(10), nullable=False)
    timeframes = Column(JSONB, nullable=False)  # 時間框架列表
    date = Column(String(10), nullable=False)  # YYYY-MM-DD
    
    status = Column(String(20), default='preparing')
    current_index = Column(Integer, default=0)
    total_candles = Column(Integer, nullable=False)
    speed = Column(Float, default=1.0)
    
    # 會話設置
    settings = Column(JSONB, default=dict)
    
    # 時間戳
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    started_at = Column(DateTime(timezone=True))
    finished_at = Column(DateTime(timezone=True))
    
    # 索引
    __table_args__ = (
        Index('ix_replay_user_status', 'user_id', 'status'),
        Index('ix_replay_created', 'created_at'),
    )
```

### 6.2 數據庫遷移腳本

```python
# alembic/versions/001_initial_schema.py
"""Initial schema

Revision ID: 001
Revises: 
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '001'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # 創建枚舉類型
    timeframe_enum = postgresql.ENUM(
        'M1', 'M5', 'M15', 'H1', 'H4', 'D1',
        name='timeframe_enum'
    )
    timeframe_enum.create(op.get_bind())
    
    fvg_type_enum = postgresql.ENUM(
        'bullish', 'bearish',
        name='fvg_type_enum'
    )
    fvg_type_enum.create(op.get_bind())
    
    fvg_status_enum = postgresql.ENUM(
        'valid', 'cleared', 'invalid',
        name='fvg_status_enum'
    )
    fvg_status_enum.create(op.get_bind())
    
    # 創建K線數據表
    op.create_table(
        'candles',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('symbol', sa.String(10), nullable=False),
        sa.Column('timeframe', timeframe_enum, nullable=False),
        sa.Column('timestamp', sa.Integer, nullable=False),
        sa.Column('open', sa.Float, nullable=False),
        sa.Column('high', sa.Float, nullable=False),
        sa.Column('low', sa.Float, nullable=False),
        sa.Column('close', sa.Float, nullable=False),
        sa.Column('volume', sa.Integer, default=0),
        sa.Column('is_bullish', sa.Boolean, default=False),
        sa.Column('body_size', sa.Float, default=0.0),
        sa.Column('upper_shadow', sa.Float, default=0.0),
        sa.Column('lower_shadow', sa.Float, default=0.0),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now())
    )
    
    # 創建索引
    op.create_index(
        'ix_candles_symbol_timeframe_timestamp',
        'candles',
        ['symbol', 'timeframe', 'timestamp']
    )
    
    # 創建FVG檢測結果表
    op.create_table(
        'fvg_detections',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('number', sa.Integer, nullable=False, unique=True),
        sa.Column('symbol', sa.String(10), nullable=False),
        sa.Column('timeframe', timeframe_enum, nullable=False),
        sa.Column('type', fvg_type_enum, nullable=False),
        sa.Column('top_price', sa.Float, nullable=False),
        sa.Column('bottom_price', sa.Float, nullable=False),
        sa.Column('gap_size', sa.Float, nullable=False),
        sa.Column('gap_size_points', sa.Float, nullable=False),
        sa.Column('start_time', sa.Integer, nullable=False),
        sa.Column('end_time', sa.Integer, nullable=False),
        sa.Column('detection_time', sa.Integer, nullable=False),
        sa.Column('status', fvg_status_enum, default='valid'),
        sa.Column('cleared_at', sa.Integer),
        sa.Column('cleared_by', sa.String(10)),
        sa.Column('cleared_price', sa.Float),
        sa.Column('left_candle_index', sa.Integer, nullable=False),
        sa.Column('middle_candle_index', sa.Integer, nullable=False),
        sa.Column('right_candle_index', sa.Integer, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now())
    )
    
    # FVG索引
    op.create_index(
        'ix_fvg_symbol_timeframe_status',
        'fvg_detections',
        ['symbol', 'timeframe', 'status']
    )
    
    op.create_index(
        'ix_fvg_status_valid',
        'fvg_detections',
        ['status'],
        postgresql_where="status = 'valid'"
    )

def downgrade():
    op.drop_table('fvg_detections')
    op.drop_table('candles')
    
    # 刪除枚舉類型
    op.execute('DROP TYPE IF EXISTS fvg_status_enum')
    op.execute('DROP TYPE IF EXISTS fvg_type_enum')  
    op.execute('DROP TYPE IF EXISTS timeframe_enum')
```

---

## 總結

本後端API設計文檔提供了FVG交易系統完整的後端技術規格，包括：

- ✅ **現代化API架構** - FastAPI + 異步處理 + WebSocket實時通信
- ✅ **完整的數據模型** - K線、FVG、用戶繪圖、會話管理  
- ✅ **豐富的API端點** - RESTful設計 + 複雜查詢支持
- ✅ **實時通信機制** - WebSocket連接管理 + 事件分發
- ✅ **高效緩存策略** - Redis多層緩存 + 智能失效
- ✅ **可擴展數據庫** - PostgreSQL + 索引優化 + 分區支持

### 主要技術亮點
1. **異步處理** - 全面採用async/await，支持高併發
2. **類型安全** - Pydantic數據驗證，TypeScript友好
3. **緩存優化** - 多層緩存策略，顯著提升性能
4. **實時通信** - WebSocket + 事件驅動，毫秒級數據推送  
5. **可觀測性** - 結構化日志 + 指標監控 + 分佈式追蹤

---

*版本: v3.0 | 更新日期: 2025-08-20 | 維護者: FVG後端團隊*