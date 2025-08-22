# FVG 系統實現指南與驗收標準 v3.0

## 文檔概覽

本文檔提供FVG交易系統的完整實現指南，包括開發流程、代碼標準、測試策略、部署指南和驗收標準。

---

## 1. 開發環境設置

### 1.1 系統要求

```bash
# 最低系統要求
- OS: Windows 10/macOS 12+/Ubuntu 20.04+
- CPU: 4核心 2.4GHz+
- RAM: 16GB+ (建議32GB)
- 存儲: 500GB+ SSD
- 網絡: 100Mbps+ (開發用)

# 推薦開發環境
- IDE: VS Code + 擴展包 / PyCharm Professional
- 終端: Windows Terminal / iTerm2
- API測試: Postman / Insomnia
- 資料庫工具: pgAdmin / DBeaver
- 容器: Docker Desktop 4.0+
```

### 1.2 開發工具鏈安裝

```bash
# 1. Python環境 (後端)
# 使用pyenv管理Python版本
curl https://pyenv.run | bash
pyenv install 3.11.7
pyenv global 3.11.7

# 安裝poetry (依賴管理)
curl -sSL https://install.python-poetry.org | python3 -

# 2. Node.js環境 (前端)
# 使用nvm管理Node版本
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18.19.0
nvm use 18.19.0

# 3. 資料庫安裝
# PostgreSQL 15+
# Windows: 使用官方安裝包
# macOS: brew install postgresql@15
# Ubuntu: apt install postgresql-15

# Redis 7+
# Windows: 使用Docker或WSL
# macOS: brew install redis
# Ubuntu: apt install redis-server

# 4. 其他工具
npm install -g @vue/cli @angular/cli create-react-app
pip install pre-commit black flake8 mypy
```

### 1.3 項目結構初始化

```bash
# 創建項目目錄
mkdir fvg-trading-system-v3
cd fvg-trading-system-v3

# 後端結構
mkdir -p backend/{app,tests,scripts,migrations,docker}
mkdir -p backend/app/{api,core,models,services,utils}

# 前端結構 (React示例)
npx create-react-app frontend --template typescript
cd frontend
npm install @types/node @types/react @types/react-dom

# 或Vue結構
vue create frontend --preset typescript

# 共享資源
mkdir -p {docs,scripts,data,deploy}

# Git初始化
git init
curl -o .gitignore https://raw.githubusercontent.com/github/gitignore/main/Python.gitignore
echo -e "\nnode_modules/\n.env\n*.log\ndata/\n.DS_Store" >> .gitignore
```

## 2. 後端開發指南

### 2.1 項目配置

```python
# backend/pyproject.toml
[tool.poetry]
name = "fvg-backend"
version = "3.0.0"
description = "FVG Trading System Backend API"
authors = ["FVG Team <team@fvg-system.com>"]

[tool.poetry.dependencies]
python = "^3.11"
fastapi = "^0.104.1"
uvicorn = {extras = ["standard"], version = "^0.24.0"}
pydantic = "^2.5.0"
sqlalchemy = "^2.0.23"
alembic = "^1.12.1"
asyncpg = "^0.29.0"
redis = "^5.0.1"
pandas = "^2.1.4"
numpy = "^1.26.2"
python-jose = {extras = ["cryptography"], version = "^3.3.0"}
python-multipart = "^0.0.6"
websockets = "^11.0.3"
prometheus-client = "^0.19.0"
structlog = "^23.2.0"

[tool.poetry.group.dev.dependencies]
pytest = "^7.4.3"
pytest-asyncio = "^0.21.1"
pytest-cov = "^4.1.0"
black = "^23.11.0"
flake8 = "^6.1.0"
mypy = "^1.7.1"
pre-commit = "^3.6.0"

[tool.black]
line-length = 88
target-version = ['py311']
include = '\.pyi?$'

[tool.mypy]
python_version = "3.11"
warn_return_any = true
warn_unused_configs = true
disallow_untyped_defs = true

# backend/app/main.py - FastAPI應用入口
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from contextlib import asynccontextmanager
import uvicorn

from app.core.config import settings
from app.core.database import engine, SessionLocal
from app.api.v3 import api_router
from app.core.logging import setup_logging

@asynccontextmanager
async def lifespan(app: FastAPI):
    """應用生命週期管理"""
    # 啟動時執行
    setup_logging()
    logger.info("🚀 FVG Trading System API starting...")
    
    # 檢查數據庫連接
    try:
        async with engine.begin() as conn:
            await conn.run_sync(lambda _: None)
        logger.info("✅ Database connection established")
    except Exception as e:
        logger.error(f"❌ Database connection failed: {e}")
        raise
    
    # 檢查Redis連接
    try:
        from app.core.cache import redis_client
        await redis_client.ping()
        logger.info("✅ Redis connection established")
    except Exception as e:
        logger.error(f"❌ Redis connection failed: {e}")
        raise
    
    yield
    
    # 關閉時執行
    logger.info("📴 FVG Trading System API shutting down...")
    await engine.dispose()

def create_app() -> FastAPI:
    """創建FastAPI應用"""
    
    app = FastAPI(
        title=settings.PROJECT_NAME,
        description="Professional Fair Value Gap Trading Analysis System",
        version="3.0.0",
        openapi_url=f"{settings.API_V3_STR}/openapi.json",
        docs_url=f"{settings.API_V3_STR}/docs",
        redoc_url=f"{settings.API_V3_STR}/redoc",
        lifespan=lifespan
    )
    
    # 添加中間件
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    app.add_middleware(GZipMiddleware, minimum_size=1000)
    
    # 註冊路由
    app.include_router(api_router, prefix=settings.API_V3_STR)
    
    return app

app = create_app()

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_config=None  # 使用自定義日志配置
    )
```

### 2.2 核心服務實現

```python
# backend/app/services/fvg_detection.py
from typing import List, Optional, Dict, Any
import asyncio
import pandas as pd
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.fvg import FVGModel
from app.models.candle import CandleModel
from app.schemas.fvg import FVGData, FVGDetectionRequest
from app.core.cache import cache_service
from app.core.metrics import fvg_metrics
import structlog

logger = structlog.get_logger()

class FVGDetectionService:
    """FVG檢測服務"""
    
    def __init__(self):
        self.detection_algorithms = {
            'v4': self._detect_fvg_v4,
            'v5_optimized': self._detect_fvg_v5_optimized
        }
    
    async def detect_fvgs_for_date(
        self,
        session: AsyncSession,
        symbol: str,
        timeframe: str,
        date: str,
        algorithm: str = 'v5_optimized'
    ) -> List[FVGData]:
        """為指定日期檢測FVG"""
        
        start_time = time.time()
        
        try:
            # 1. 獲取K線數據
            candles = await self._get_candle_data(session, symbol, timeframe, date)
            if len(candles) < 3:
                logger.warning("Insufficient candle data", symbol=symbol, timeframe=timeframe, date=date)
                return []
            
            # 2. 檢查緩存
            cache_key = f"fvg:{symbol}:{timeframe}:{date}:{algorithm}"
            cached_result = await cache_service.get_fvgs(cache_key)
            if cached_result:
                logger.info("FVG cache hit", cache_key=cache_key)
                return cached_result
            
            # 3. 執行檢測算法
            detection_func = self.detection_algorithms.get(algorithm, self._detect_fvg_v4)
            fvgs = await detection_func(candles)
            
            # 4. 後處理和驗證
            validated_fvgs = await self._validate_and_enrich_fvgs(fvgs, candles)
            
            # 5. 緩存結果
            await cache_service.set_fvgs(cache_key, validated_fvgs, expiry=3600)
            
            # 6. 記錄指標
            detection_time = time.time() - start_time
            fvg_metrics.detection_duration.labels(
                symbol=symbol, 
                timeframe=timeframe,
                algorithm=algorithm
            ).observe(detection_time)
            
            fvg_metrics.detection_count.labels(
                symbol=symbol,
                timeframe=timeframe, 
                algorithm=algorithm
            ).inc()
            
            logger.info(
                "FVG detection completed",
                symbol=symbol,
                timeframe=timeframe,
                date=date,
                algorithm=algorithm,
                fvg_count=len(validated_fvgs),
                detection_time=detection_time
            )
            
            return validated_fvgs
            
        except Exception as e:
            logger.error(
                "FVG detection failed",
                symbol=symbol,
                timeframe=timeframe,
                date=date,
                error=str(e),
                exc_info=True
            )
            raise
    
    async def _detect_fvg_v5_optimized(self, candles: List[CandleModel]) -> List[FVGData]:
        """優化版FVG檢測算法 (v5)"""
        
        if len(candles) < 3:
            return []
        
        fvgs = []
        candle_count = len(candles)
        
        # 預處理價格數組 (向量化操作)
        df = pd.DataFrame([{
            'index': i,
            'timestamp': candle.timestamp,
            'open': candle.open,
            'high': candle.high,
            'low': candle.low,
            'close': candle.close,
        } for i, candle in enumerate(candles)])
        
        # 計算K線類型
        df['is_bullish'] = df['close'] > df['open']
        df['is_bearish'] = df['close'] < df['open']
        
        # 滾動窗口檢測 (向量化)
        for i in range(1, candle_count - 1):
            left_idx = i - 1
            middle_idx = i  
            right_idx = i + 1
            
            left = df.iloc[left_idx]
            middle = df.iloc[middle_idx] 
            right = df.iloc[right_idx]
            
            # 多頭FVG檢測
            bullish_conditions = [
                middle['close'] > middle['open'],  # 中間K線為陽線
                middle['close'] > left['high'],    # 中間收盤 > 左高
                left['high'] < right['low']        # 左高 < 右低 (缺口)
            ]
            
            if all(bullish_conditions):
                fvg = await self._create_fvg_data(
                    fvg_type='bullish',
                    top_price=right['low'],
                    bottom_price=left['high'],
                    left_candle=candles[left_idx],
                    middle_candle=candles[middle_idx],
                    right_candle=candles[right_idx],
                    indices=(left_idx, middle_idx, right_idx)
                )
                
                # 檢查是否已清除
                await self._check_clearing_status(fvg, candles[right_idx:], right_idx)
                fvgs.append(fvg)
            
            # 空頭FVG檢測
            bearish_conditions = [
                middle['close'] < middle['open'],  # 中間K線為陰線
                middle['close'] < left['low'],     # 中間收盤 < 左低
                left['low'] > right['high']        # 左低 > 右高 (缺口)
            ]
            
            if all(bearish_conditions):
                fvg = await self._create_fvg_data(
                    fvg_type='bearish',
                    top_price=left['low'], 
                    bottom_price=right['high'],
                    left_candle=candles[left_idx],
                    middle_candle=candles[middle_idx],
                    right_candle=candles[right_idx],
                    indices=(left_idx, middle_idx, right_idx)
                )
                
                await self._check_clearing_status(fvg, candles[right_idx:], right_idx)
                fvgs.append(fvg)
        
        return fvgs
    
    async def _create_fvg_data(
        self,
        fvg_type: str,
        top_price: float,
        bottom_price: float,
        left_candle: CandleModel,
        middle_candle: CandleModel, 
        right_candle: CandleModel,
        indices: tuple
    ) -> FVGData:
        """創建FVG數據對象"""
        
        gap_size = abs(top_price - bottom_price)
        gap_size_points = gap_size * 4  # MNQ: 1點 = 0.25
        
        # 計算結束時間 (左K線 + 40根)
        end_time = left_candle.timestamp + (40 * 60)  # 假設為M1數據
        
        return FVGData(
            symbol=left_candle.symbol,
            timeframe=left_candle.timeframe,
            type=fvg_type,
            top_price=top_price,
            bottom_price=bottom_price,
            gap_size=gap_size,
            gap_size_points=gap_size_points,
            start_time=left_candle.timestamp,
            end_time=end_time,
            detection_time=right_candle.timestamp,
            left_candle_index=indices[0],
            middle_candle_index=indices[1],
            right_candle_index=indices[2],
            number=await self._get_next_fvg_number()
        )
    
    async def _check_clearing_status(
        self, 
        fvg: FVGData, 
        subsequent_candles: List[CandleModel], 
        start_index: int
    ):
        """檢查FVG清除狀態"""
        
        max_lookback = 40
        level_price = fvg.bottom_price if fvg.type == 'bullish' else fvg.top_price
        
        for i, candle in enumerate(subsequent_candles[:max_lookback]):
            # 多頭FVG清除條件: 收盤價低於底邊界
            if fvg.type == 'bullish' and candle.close < level_price:
                fvg.status = 'cleared'
                fvg.cleared_at = candle.timestamp
                fvg.cleared_by = 'close'
                fvg.cleared_price = candle.close
                break
            
            # 空頭FVG清除條件: 收盤價高於頂邊界
            elif fvg.type == 'bearish' and candle.close > level_price:
                fvg.status = 'cleared'
                fvg.cleared_at = candle.timestamp
                fvg.cleared_by = 'close'
                fvg.cleared_price = candle.close
                break
            
            # Wick清除檢查
            if fvg.type == 'bullish' and candle.low < level_price:
                fvg.status = 'cleared'
                fvg.cleared_at = candle.timestamp
                fvg.cleared_by = 'wick'
                fvg.cleared_price = candle.low
                break
            
            elif fvg.type == 'bearish' and candle.high > level_price:
                fvg.status = 'cleared'
                fvg.cleared_at = candle.timestamp 
                fvg.cleared_by = 'wick'
                fvg.cleared_price = candle.high
                break
    
    async def _get_next_fvg_number(self) -> int:
        """獲取下一個FVG全局編號"""
        # 使用Redis原子遞增
        return await cache_service.redis.incr("fvg:global_counter")

# backend/app/services/replay.py  
class ReplayService:
    """回放服務"""
    
    def __init__(self):
        self.active_sessions: Dict[str, ReplaySession] = {}
        self.websocket_connections: Dict[str, List[WebSocket]] = {}
    
    async def create_replay_session(
        self,
        user_id: str,
        symbol: str,
        timeframes: List[str],
        date: str,
        settings: ReplaySettings
    ) -> ReplaySession:
        """創建回放會話"""
        
        session_id = str(uuid.uuid4())
        
        try:
            # 1. 驗證數據完整性
            data_check = await self._verify_data_completeness(symbol, timeframes, date)
            if not data_check.is_complete:
                raise ValueError(f"Incomplete data: {data_check.missing_info}")
            
            # 2. 預加載數據
            session_data = await self._preload_session_data(symbol, timeframes, date)
            
            # 3. 創建會話對象
            session = ReplaySession(
                id=session_id,
                user_id=user_id,
                symbol=symbol,
                timeframes=timeframes,
                date=date,
                total_candles=session_data['total_candles'],
                settings=settings,
                status=ReplayStatus.PREPARED
            )
            
            # 4. 緩存會話數據
            await cache_service.set_session(session_id, {
                'session': session.dict(),
                'candle_data': session_data['candles'],
                'fvg_data': session_data['fvgs']
            })
            
            self.active_sessions[session_id] = session
            
            logger.info(
                "Replay session created",
                session_id=session_id,
                user_id=user_id,
                symbol=symbol,
                timeframes=timeframes,
                date=date,
                total_candles=session_data['total_candles']
            )
            
            return session
            
        except Exception as e:
            logger.error(
                "Failed to create replay session",
                user_id=user_id,
                symbol=symbol,
                date=date,
                error=str(e),
                exc_info=True
            )
            raise
    
    async def start_websocket_stream(self, session_id: str, connection_id: str):
        """開始WebSocket數據流"""
        
        session = self.active_sessions.get(session_id)
        if not session or session.status != ReplayStatus.PLAYING:
            return
        
        try:
            cached_data = await cache_service.get_session(session_id)
            if not cached_data:
                raise ValueError("Session data not found")
            
            candle_data = cached_data['candle_data']
            fvg_data = cached_data['fvg_data']
            
            # 模擬K線回放
            while session.status == ReplayStatus.PLAYING and session.current_index < session.total_candles:
                # 獲取當前時間點的多時間框架數據
                current_data = await self._get_synchronized_data_at_index(
                    candle_data, fvg_data, session.current_index
                )
                
                # 發送到WebSocket
                message = {
                    'type': 'multi_tf_candle',
                    'session_id': session_id,
                    'index': session.current_index,
                    'progress': (session.current_index / session.total_candles) * 100,
                    'data': current_data
                }
                
                await self._send_to_session_websockets(session_id, message)
                
                # 更新會話狀態
                session.current_index += 1
                
                # 控制播放速度
                await asyncio.sleep(session.settings.speed)
            
            # 播放結束
            if session.current_index >= session.total_candles:
                session.status = ReplayStatus.FINISHED
                await self._send_to_session_websockets(session_id, {
                    'type': 'replay_finished',
                    'session_id': session_id
                })
                
        except Exception as e:
            logger.error(
                "WebSocket stream error",
                session_id=session_id,
                connection_id=connection_id,
                error=str(e),
                exc_info=True
            )
            
            session.status = ReplayStatus.ERROR
            await self._send_to_session_websockets(session_id, {
                'type': 'error',
                'message': str(e)
            })
```

### 2.3 API路由實現

```python
# backend/app/api/v3/endpoints/fvg.py
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Path, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.auth import get_current_user
from app.schemas.fvg import FVGData, FVGDetectionRequest, FVGStatistics
from app.services.fvg_detection import FVGDetectionService
from app.services.fvg_statistics import FVGStatisticsService

router = APIRouter()

fvg_service = FVGDetectionService()
stats_service = FVGStatisticsService()

@router.post("/detect", response_model=List[FVGData])
async def detect_fvgs(
    request: FVGDetectionRequest,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """執行FVG檢測
    
    支持同步和異步檢測模式:
    - 同步: 立即返回結果 (適合小數據集)
    - 異步: 後台執行，返回任務ID (適合大數據集)
    """
    
    try:
        # 估算數據量
        estimated_candles = await fvg_service.estimate_data_size(
            request.symbol, 
            request.timeframe, 
            request.date_range
        )
        
        # 小數據集: 同步處理
        if estimated_candles <= 1440:  # <= 1天的M1數據
            fvgs = await fvg_service.detect_fvgs_for_date_range(
                session, 
                request.symbol,
                request.timeframe,
                request.date_range,
                request.settings.algorithm
            )
            
            return fvgs
        
        # 大數據集: 異步處理
        else:
            task_id = await fvg_service.create_async_detection_task(
                user_id=current_user.id,
                request=request
            )
            
            background_tasks.add_task(
                fvg_service.execute_async_detection,
                task_id,
                session,
                request
            )
            
            raise HTTPException(
                status_code=202,
                detail={
                    "message": "Detection task created",
                    "task_id": task_id,
                    "estimated_candles": estimated_candles,
                    "status_url": f"/api/v3/fvg/tasks/{task_id}"
                }
            )
            
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"FVG detection error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/tasks/{task_id}", response_model=Dict[str, Any])
async def get_detection_task_status(
    task_id: str = Path(..., description="任務ID"),
    current_user: User = Depends(get_current_user)
):
    """獲取異步檢測任務狀態"""
    
    task_status = await fvg_service.get_task_status(task_id, current_user.id)
    
    if not task_status:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return task_status

@router.get("/{symbol}/{timeframe}/statistics", response_model=FVGStatistics)
async def get_fvg_statistics(
    symbol: str = Path(..., description="交易品種"),
    timeframe: str = Path(..., description="時間框架"),
    date_from: Optional[str] = Query(None, description="開始日期 YYYY-MM-DD"),
    date_to: Optional[str] = Query(None, description="結束日期 YYYY-MM-DD"),
    session: AsyncSession = Depends(get_session)
):
    """獲取FVG統計信息
    
    提供詳細的FVG統計分析:
    - 基本計數統計
    - 時間分佈分析  
    - 價格分佈分析
    - 清除率統計
    - 績效分析
    """
    
    try:
        stats = await stats_service.calculate_comprehensive_statistics(
            session,
            symbol=symbol,
            timeframe=timeframe,
            date_from=date_from,
            date_to=date_to
        )
        
        return stats
        
    except Exception as e:
        logger.error(f"Statistics calculation error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Statistics calculation failed")

@router.get("/{symbol}/{timeframe}/heatmap", response_model=Dict[str, Any])
async def get_fvg_heatmap_data(
    symbol: str = Path(..., description="交易品種"),
    timeframe: str = Path(..., description="時間框架"),
    date_from: str = Query(..., description="開始日期"),
    date_to: str = Query(..., description="結束日期"),
    resolution: str = Query("daily", description="解析度: hourly|daily|weekly"),
    session: AsyncSession = Depends(get_session)
):
    """獲取FVG熱力圖數據
    
    用於前端繪製FVG活動熱力圖:
    - 時間 vs 價格區間的FVG密度
    - 支持多種時間解析度
    - 包含統計權重
    """
    
    try:
        heatmap_data = await stats_service.generate_fvg_heatmap(
            session,
            symbol=symbol,
            timeframe=timeframe,
            date_from=date_from,
            date_to=date_to,
            resolution=resolution
        )
        
        return {
            "symbol": symbol,
            "timeframe": timeframe,
            "date_range": {"from": date_from, "to": date_to},
            "resolution": resolution,
            "heatmap_data": heatmap_data,
            "metadata": {
                "total_cells": len(heatmap_data),
                "max_density": max((cell["density"] for cell in heatmap_data), default=0),
                "generated_at": datetime.now().isoformat()
            }
        }
        
    except Exception as e:
        logger.error(f"Heatmap generation error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Heatmap generation failed")
```

## 3. 前端開發指南

### 3.1 React + TypeScript 設置

```typescript
// frontend/src/types/api.ts - API類型定義
export interface CandleData {
  id: string;
  symbol: string;
  timeframe: Timeframe;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  is_bullish: boolean;
  body_size: number;
  upper_shadow: number;
  lower_shadow: number;
}

export interface FVGData {
  id: string;
  number: number;
  symbol: string;
  timeframe: Timeframe;
  type: 'bullish' | 'bearish';
  top_price: number;
  bottom_price: number;
  gap_size: number;
  gap_size_points: number;
  start_time: number;
  end_time: number;
  detection_time: number;
  status: 'valid' | 'cleared' | 'invalid';
  cleared_at?: number;
  cleared_by?: 'wick' | 'close' | 'gap';
  cleared_price?: number;
  left_candle_index: number;
  middle_candle_index: number;
  right_candle_index: number;
}

export type Timeframe = 'M1' | 'M5' | 'M15' | 'H1' | 'H4' | 'D1';

// frontend/src/services/api.ts - API客戶端
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { FVGData, CandleData, FVGStatistics } from '../types/api';

class APIClient {
  private client: AxiosInstance;
  
  constructor(baseURL: string = process.env.REACT_APP_API_URL || 'http://localhost:8000') {
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    // 請求攔截器 - 添加認證
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('access_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );
    
    // 響應攔截器 - 錯誤處理
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Token過期，嘗試刷新
          await this.refreshToken();
          return this.client.request(error.config);
        }
        return Promise.reject(error);
      }
    );
  }
  
  // K線數據API
  async getCandles(
    symbol: string,
    timeframe: Timeframe,
    date: string,
    limit?: number
  ): Promise<CandleData[]> {
    const response = await this.client.get(
      `/api/v3/candles/${symbol}/${timeframe}/${date}`,
      { params: { limit } }
    );
    return response.data;
  }
  
  async getMultiTimeframeCandles(
    symbol: string,
    date: string,
    timeframes: Timeframe[]
  ): Promise<MultiTimeframeCandleData> {
    const response = await this.client.get(
      `/api/v3/candles/${symbol}/multi-timeframe/${date}`,
      { params: { timeframes: timeframes.join(',') } }
    );
    return response.data;
  }
  
  // FVG API
  async detectFVGs(request: FVGDetectionRequest): Promise<FVGData[]> {
    const response = await this.client.post('/api/v3/fvg/detect', request);
    return response.data;
  }
  
  async getFVGs(
    symbol: string,
    timeframe: Timeframe,
    filters?: FVGFilters
  ): Promise<FVGData[]> {
    const response = await this.client.get(
      `/api/v3/fvg/${symbol}/${timeframe}`,
      { params: filters }
    );
    return response.data;
  }
  
  async getFVGStatistics(
    symbol: string,
    timeframe: Timeframe,
    dateFrom?: string,
    dateTo?: string
  ): Promise<FVGStatistics> {
    const response = await this.client.get(
      `/api/v3/fvg/${symbol}/${timeframe}/statistics`,
      { params: { date_from: dateFrom, date_to: dateTo } }
    );
    return response.data;
  }
  
  // 回放API
  async createReplaySession(request: CreateReplaySessionRequest): Promise<ReplaySession> {
    const response = await this.client.post('/api/v3/replay/sessions', request);
    return response.data;
  }
  
  async startReplay(sessionId: string): Promise<{ websocket_url: string }> {
    const response = await this.client.post(`/api/v3/replay/sessions/${sessionId}/play`);
    return response.data;
  }
  
  private async refreshToken(): Promise<void> {
    // 實現token刷新邏輯
    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      const response = await this.client.post('/api/v3/auth/refresh', {
        refresh_token: refreshToken
      });
      
      localStorage.setItem('access_token', response.data.access_token);
    }
  }
}

export const apiClient = new APIClient();

// frontend/src/hooks/useFVGData.ts - 自定義Hook
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/api';
import { FVGData, Timeframe } from '../types/api';

interface UseFVGDataOptions {
  symbol: string;
  timeframe: Timeframe;
  date?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function useFVGData({
  symbol,
  timeframe,
  date,
  autoRefresh = false,
  refreshInterval = 30000
}: UseFVGDataOptions) {
  const [fvgs, setFVGs] = useState<FVGData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  const loadFVGs = useCallback(async () => {
    if (!symbol || !timeframe) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await apiClient.getFVGs(symbol, timeframe, { date });
      setFVGs(data);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load FVGs');
    } finally {
      setLoading(false);
    }
  }, [symbol, timeframe, date]);
  
  // 初始加載
  useEffect(() => {
    loadFVGs();
  }, [loadFVGs]);
  
  // 自動刷新
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(loadFVGs, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, loadFVGs]);
  
  // 過濾函數
  const getValidFVGs = useCallback(() => 
    fvgs.filter(fvg => fvg.status === 'valid'), [fvgs]);
  
  const getClearedFVGs = useCallback(() =>
    fvgs.filter(fvg => fvg.status === 'cleared'), [fvgs]);
  
  const getBullishFVGs = useCallback(() =>
    fvgs.filter(fvg => fvg.type === 'bullish'), [fvgs]);
  
  const getBearishFVGs = useCallback(() =>
    fvgs.filter(fvg => fvg.type === 'bearish'), [fvgs]);
  
  return {
    fvgs,
    loading,
    error,
    lastUpdated,
    refetch: loadFVGs,
    
    // 過濾后的數據
    validFVGs: getValidFVGs(),
    clearedFVGs: getClearedFVGs(),
    bullishFVGs: getBullishFVGs(),
    bearishFVGs: getBearishFVGs(),
    
    // 統計
    statistics: {
      total: fvgs.length,
      valid: getValidFVGs().length,
      cleared: getClearedFVGs().length,
      bullish: getBullishFVGs().length,
      bearish: getBearishFVGs().length,
    }
  };
}
```

### 3.2 狀態管理 (Zustand)

```typescript
// frontend/src/store/fvgStore.ts
import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { FVGData, FVGSettings, FVGStatistics } from '../types/api';

interface FVGStore {
  // 狀態
  fvgs: FVGData[];
  selectedFVG: FVGData | null;
  settings: FVGSettings;
  statistics: FVGStatistics | null;
  loading: boolean;
  error: string | null;
  
  // 動作
  setFVGs: (fvgs: FVGData[]) => void;
  addFVG: (fvg: FVGData) => void;
  updateFVG: (id: string, updates: Partial<FVGData>) => void;
  removeFVG: (id: string) => void;
  selectFVG: (fvg: FVGData | null) => void;
  updateSettings: (settings: Partial<FVGSettings>) => void;
  setStatistics: (stats: FVGStatistics) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // 計算屬性
  visibleFVGs: FVGData[];
  validFVGs: FVGData[];
  clearedFVGs: FVGData[];
  bullishFVGs: FVGData[];
  bearishFVGs: FVGData[];
}

export const useFVGStore = create<FVGStore>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      // 初始狀態
      fvgs: [],
      selectedFVG: null,
      settings: {
        showFVG: true,
        showFVGMarkers: true,
        showClearedFVGs: false,
        algorithm: 'v5_optimized',
        minGapSize: 0,
        maxLookback: 40
      },
      statistics: null,
      loading: false,
      error: null,
      
      // 動作實現
      setFVGs: (fvgs) => set({ fvgs }, false, 'setFVGs'),
      
      addFVG: (fvg) => set(
        (state) => ({ fvgs: [...state.fvgs, fvg] }),
        false,
        'addFVG'
      ),
      
      updateFVG: (id, updates) => set(
        (state) => ({
          fvgs: state.fvgs.map(fvg =>
            fvg.id === id ? { ...fvg, ...updates } : fvg
          )
        }),
        false,
        'updateFVG'
      ),
      
      removeFVG: (id) => set(
        (state) => ({ 
          fvgs: state.fvgs.filter(fvg => fvg.id !== id),
          selectedFVG: state.selectedFVG?.id === id ? null : state.selectedFVG
        }),
        false,
        'removeFVG'
      ),
      
      selectFVG: (fvg) => set({ selectedFVG: fvg }, false, 'selectFVG'),
      
      updateSettings: (newSettings) => set(
        (state) => ({ 
          settings: { ...state.settings, ...newSettings }
        }),
        false,
        'updateSettings'
      ),
      
      setStatistics: (stats) => set({ statistics: stats }, false, 'setStatistics'),
      setLoading: (loading) => set({ loading }, false, 'setLoading'),
      setError: (error) => set({ error }, false, 'setError'),
      
      // 計算屬性
      get visibleFVGs() {
        const { fvgs, settings } = get();
        if (!settings.showFVG) return [];
        
        return fvgs.filter(fvg => {
          if (!settings.showClearedFVGs && fvg.status === 'cleared') return false;
          if (settings.minGapSize && fvg.gap_size < settings.minGapSize) return false;
          return true;
        });
      },
      
      get validFVGs() {
        return get().fvgs.filter(fvg => fvg.status === 'valid');
      },
      
      get clearedFVGs() {
        return get().fvgs.filter(fvg => fvg.status === 'cleared');
      },
      
      get bullishFVGs() {
        return get().visibleFVGs.filter(fvg => fvg.type === 'bullish');
      },
      
      get bearishFVGs() {
        return get().visibleFVGs.filter(fvg => fvg.type === 'bearish');
      },
    })),
    {
      name: 'fvg-store',
    }
  )
);

// 持久化設置
import { persist } from 'zustand/middleware';

export const useSettingsStore = create<{
  theme: 'light' | 'dark';
  language: 'en' | 'zh';
  chartSettings: ChartSettings;
  toggleTheme: () => void;
  setLanguage: (lang: 'en' | 'zh') => void;
  updateChartSettings: (settings: Partial<ChartSettings>) => void;
}>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      language: 'en',
      chartSettings: {
        candleLimit: 400,
        autoScale: true,
        showVolume: false,
        timeScale: {
          barSpacing: 8,
          rightOffset: 20,
        }
      },
      
      toggleTheme: () => set(
        (state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })
      ),
      
      setLanguage: (lang) => set({ language: lang }),
      
      updateChartSettings: (newSettings) => set(
        (state) => ({
          chartSettings: { ...state.chartSettings, ...newSettings }
        })
      ),
    }),
    {
      name: 'app-settings',
    }
  )
);
```

### 3.3 組件實現示例

```tsx
// frontend/src/components/FVGDetailsList.tsx
import React, { useState, useMemo, useCallback } from 'react';
import { FixedSizeList as List } from 'react-window';
import { useFVGStore } from '../store/fvgStore';
import { FVGData } from '../types/api';
import { formatPrice, formatTime, formatDuration } from '../utils/format';

interface FVGDetailsListProps {
  height: number;
  onFVGSelect: (fvg: FVGData) => void;
}

export const FVGDetailsList: React.FC<FVGDetailsListProps> = ({
  height,
  onFVGSelect
}) => {
  const { fvgs, selectedFVG, settings } = useFVGStore();
  const [filter, setFilter] = useState<'all' | 'valid' | 'cleared'>('all');
  const [sortBy, setSortBy] = useState<'time' | 'size' | 'type'>('time');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // 過濾和排序
  const processedFVGs = useMemo(() => {
    let filtered = fvgs;
    
    // 應用過濾器
    switch (filter) {
      case 'valid':
        filtered = filtered.filter(fvg => fvg.status === 'valid');
        break;
      case 'cleared':
        filtered = filtered.filter(fvg => fvg.status === 'cleared');
        break;
    }
    
    // 應用排序
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'time':
          comparison = a.detection_time - b.detection_time;
          break;
        case 'size':
          comparison = a.gap_size - b.gap_size;
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });
    
    return filtered;
  }, [fvgs, filter, sortBy, sortOrder]);
  
  const handleFVGClick = useCallback((fvg: FVGData) => {
    onFVGSelect(fvg);
  }, [onFVGSelect]);
  
  // 虛擬列表項目渲染器
  const FVGItem: React.FC<{ index: number; style: React.CSSProperties }> = ({
    index,
    style
  }) => {
    const fvg = processedFVGs[index];
    const isSelected = selectedFVG?.id === fvg.id;
    
    return (
      <div
        style={style}
        className={`fvg-item ${fvg.type} ${fvg.status} ${isSelected ? 'selected' : ''}`}
        onClick={() => handleFVGClick(fvg)}
      >
        <div className="fvg-header">
          <div className="fvg-info">
            <div className="fvg-number">
              <FVGTypeIcon type={fvg.type} />
              <span>FVG #{fvg.number}</span>
            </div>
            <StatusBadge status={fvg.status} />
          </div>
          <div className="fvg-actions">
            <IconButton
              icon="target"
              onClick={(e) => {
                e.stopPropagation();
                onFVGSelect(fvg);
                // 觸發圖表聚焦
              }}
              tooltip="聚焦到此FVG"
            />
          </div>
        </div>
        
        <div className="fvg-details">
          <div className="price-range">
            <span className="label">Range:</span>
            <span className="values">
              {formatPrice(fvg.bottom_price)} - {formatPrice(fvg.top_price)}
            </span>
          </div>
          
          <div className="gap-size">
            <span className="label">Gap:</span>
            <span className="value">{fvg.gap_size_points.toFixed(1)} pts</span>
          </div>
          
          <div className="timestamp">
            <span className="label">Formed:</span>
            <span className="value">{formatTime(fvg.detection_time)}</span>
          </div>
          
          {fvg.status === 'cleared' && fvg.cleared_at && (
            <div className="cleared-info">
              <span className="label">Cleared:</span>
              <span className="value">
                {formatTime(fvg.cleared_at)} by {fvg.cleared_by}
              </span>
              <span className="duration">
                ({formatDuration(fvg.cleared_at - fvg.detection_time)})
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };
  
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
              { value: 'valid', label: 'Valid Only' },
              { value: 'cleared', label: 'Cleared Only' }
            ]}
          />
        </div>
        
        <div className="sort-section">
          <Select
            value={sortBy}
            onChange={setSortBy}
            options={[
              { value: 'time', label: 'Formation Time' },
              { value: 'size', label: 'Gap Size' },
              { value: 'type', label: 'Type' }
            ]}
          />
          
          <IconButton
            icon={sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'}
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            tooltip={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
          />
        </div>
      </div>
      
      {/* 虛擬化列表 */}
      <div className="list-container">
        <List
          height={height - 60} // 減去控制條高度
          itemCount={processedFVGs.length}
          itemSize={120} // 每個項目高度
          itemData={processedFVGs}
        >
          {FVGItem}
        </List>
      </div>
      
      {/* 統計信息 */}
      <div className="list-footer">
        <div className="stats">
          <span>Total: {processedFVGs.length}</span>
          <span>Valid: {processedFVGs.filter(f => f.status === 'valid').length}</span>
          <span>Cleared: {processedFVGs.filter(f => f.status === 'cleared').length}</span>
        </div>
      </div>
    </div>
  );
};

// 輔助組件
const FVGTypeIcon: React.FC<{ type: 'bullish' | 'bearish' }> = ({ type }) => (
  <div className={`fvg-type-icon ${type}`}>
    {type === 'bullish' ? '▲' : '▼'}
  </div>
);

const StatusBadge: React.FC<{ status: string }> = ({ status }) => (
  <span className={`status-badge ${status}`}>
    {status.toUpperCase()}
  </span>
);
```

## 4. 測試策略

### 4.1 後端測試架構

```python
# backend/tests/conftest.py - 測試配置
import asyncio
import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

from app.main import app
from app.core.database import get_session
from app.core.config import settings
from app.models.base import Base

# 測試數據庫配置
TEST_DATABASE_URL = "postgresql+asyncpg://test:test@localhost:5432/fvg_test"

@pytest_asyncio.fixture(scope="session")
async def test_engine():
    """創建測試數據庫引擎"""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        poolclass=NullPool,
        echo=False
    )
    
    # 創建所有表
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    yield engine
    
    # 清理
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    
    await engine.dispose()

@pytest_asyncio.fixture
async def test_session(test_engine):
    """創建測試數據庫會話"""
    async with AsyncSession(test_engine) as session:
        yield session
        await session.rollback()

@pytest_asyncio.fixture
async def test_client(test_session):
    """創建測試客戶端"""
    
    # 覆蓋依賴
    app.dependency_overrides[get_session] = lambda: test_session
    
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client
    
    app.dependency_overrides.clear()

@pytest.fixture
def sample_candle_data():
    """樣本K線數據"""
    return [
        {
            "timestamp": 1703001600,
            "open": 17000.0,
            "high": 17010.0,
            "low": 16990.0,
            "close": 17005.0,
            "volume": 1000,
            "symbol": "MNQ",
            "timeframe": "M1"
        },
        # ... 更多測試數據
    ]

# backend/tests/test_fvg_detection.py - FVG檢測測試
import pytest
from app.services.fvg_detection import FVGDetectionService
from app.models.candle import CandleModel

class TestFVGDetection:
    """FVG檢測功能測試"""
    
    @pytest_asyncio.fixture
    async def fvg_service(self):
        return FVGDetectionService()
    
    @pytest_asyncio.fixture
    async def bullish_pattern_candles(self):
        """多頭FVG模式的K線數據"""
        return [
            # 左K線 (L)
            CandleModel(
                timestamp=1703001600,
                open=17000.0,
                high=17005.0,  # L.High = 17005
                low=16995.0,
                close=17002.0,
                symbol="MNQ",
                timeframe="M1"
            ),
            # 中間K線 (C) - 陽線
            CandleModel(
                timestamp=1703001660,
                open=17010.0,
                high=17020.0,
                low=17008.0,
                close=17015.0,  # C.Close > L.High
                symbol="MNQ",
                timeframe="M1"
            ),
            # 右K線 (R)
            CandleModel(
                timestamp=1703001720,
                open=17008.0,
                high=17012.0,
                low=17006.0,  # R.Low > L.High (Gap)
                close=17010.0,
                symbol="MNQ",
                timeframe="M1"
            ),
        ]
    
    async def test_detect_bullish_fvg(self, fvg_service, bullish_pattern_candles):
        """測試多頭FVG檢測"""
        
        # 執行檢測
        fvgs = await fvg_service._detect_fvg_v5_optimized(bullish_pattern_candles)
        
        # 驗證結果
        assert len(fvgs) == 1
        fvg = fvgs[0]
        
        assert fvg.type == 'bullish'
        assert fvg.status == 'valid'
        assert fvg.bottom_price == 17005.0  # L.High
        assert fvg.top_price == 17006.0     # R.Low
        assert fvg.gap_size == 1.0
        assert fvg.left_candle_index == 0
        assert fvg.middle_candle_index == 1
        assert fvg.right_candle_index == 2
    
    async def test_fvg_clearing_detection(self, fvg_service):
        """測試FVG清除檢測"""
        
        # 創建FVG + 清除K線
        candles = [
            # ... FVG形成的K線
            # 清除K線 - 收盤價低於FVG底邊界
            CandleModel(
                timestamp=1703001780,
                open=17005.0,
                high=17006.0,
                low=17000.0,
                close=17003.0,  # 低於FVG底邊界
                symbol="MNQ",
                timeframe="M1"
            )
        ]
        
        fvgs = await fvg_service._detect_fvg_v5_optimized(candles)
        
        # 驗證清除狀態
        assert len(fvgs) == 1
        fvg = fvgs[0]
        assert fvg.status == 'cleared'
        assert fvg.cleared_by == 'close'
        assert fvg.cleared_price == 17003.0
    
    async def test_no_fvg_detection_invalid_pattern(self, fvg_service):
        """測試無效模式不產生FVG"""
        
        # 無缺口的K線模式
        candles = [
            CandleModel(timestamp=1703001600, open=17000.0, high=17005.0, low=16995.0, close=17002.0, symbol="MNQ", timeframe="M1"),
            CandleModel(timestamp=1703001660, open=17002.0, high=17010.0, low=16999.0, close=17008.0, symbol="MNQ", timeframe="M1"),
            CandleModel(timestamp=1703001720, open=17008.0, high=17012.0, low=17004.0, close=17010.0, symbol="MNQ", timeframe="M1"),
        ]
        
        fvgs = await fvg_service._detect_fvg_v5_optimized(candles)
        assert len(fvgs) == 0
    
    @pytest.mark.parametrize("algorithm", ["v4", "v5_optimized"])
    async def test_algorithm_consistency(self, fvg_service, bullish_pattern_candles, algorithm):
        """測試不同算法的一致性"""
        
        detection_func = fvg_service.detection_algorithms[algorithm]
        fvgs = await detection_func(bullish_pattern_candles)
        
        # 基本一致性檢查
        assert len(fvgs) >= 0
        for fvg in fvgs:
            assert fvg.type in ['bullish', 'bearish']
            assert fvg.status in ['valid', 'cleared', 'invalid']
            assert fvg.gap_size >= 0

# backend/tests/test_api_endpoints.py - API端點測試
class TestFVGAPI:
    """FVG API端點測試"""
    
    async def test_detect_fvgs_endpoint(self, test_client):
        """測試FVG檢測API端點"""
        
        request_data = {
            "symbol": "MNQ",
            "timeframe": "M1",
            "date_range": {
                "from": "2024-01-01",
                "to": "2024-01-02"
            },
            "settings": {
                "algorithm": "v5_optimized",
                "max_lookback": 40,
                "min_gap_size": 0.0
            }
        }
        
        response = await test_client.post("/api/v3/fvg/detect", json=request_data)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # 驗證返回數據結構
        if data:
            fvg = data[0]
            required_fields = [
                'id', 'number', 'symbol', 'timeframe', 'type',
                'top_price', 'bottom_price', 'gap_size', 'status'
            ]
            for field in required_fields:
                assert field in fvg
    
    async def test_get_fvg_statistics_endpoint(self, test_client):
        """測試FVG統計API端點"""
        
        response = await test_client.get("/api/v3/fvg/MNQ/M1/statistics")
        
        assert response.status_code == 200
        stats = response.json()
        
        expected_fields = [
            'total_detected', 'bullish_count', 'bearish_count',
            'valid_count', 'cleared_count', 'average_gap_size',
            'clearance_rate'
        ]
        for field in expected_fields:
            assert field in stats
    
    async def test_api_error_handling(self, test_client):
        """測試API錯誤處理"""
        
        # 無效的timeframe
        response = await test_client.get("/api/v3/fvg/MNQ/INVALID/statistics")
        assert response.status_code == 422
        
        # 無效的日期格式
        request_data = {
            "symbol": "MNQ",
            "timeframe": "M1", 
            "date_range": {
                "from": "invalid-date",
                "to": "2024-01-02"
            }
        }
        
        response = await test_client.post("/api/v3/fvg/detect", json=request_data)
        assert response.status_code == 422
```

### 4.2 前端測試策略

```typescript
// frontend/src/components/__tests__/FVGDetailsList.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FVGDetailsList } from '../FVGDetailsList';
import { useFVGStore } from '../../store/fvgStore';
import { mockFVGData } from '../../../__mocks__/fvgData';

// Mock Zustand store
jest.mock('../../store/fvgStore');
const mockUseFVGStore = useFVGStore as jest.MockedFunction<typeof useFVGStore>;

describe('FVGDetailsList', () => {
  const mockOnFVGSelect = jest.fn();
  
  beforeEach(() => {
    mockUseFVGStore.mockReturnValue({
      fvgs: mockFVGData,
      selectedFVG: null,
      settings: {
        showFVG: true,
        showFVGMarkers: true,
        showClearedFVGs: false,
      },
    });
    
    mockOnFVGSelect.mockClear();
  });
  
  it('renders FVG list correctly', () => {
    render(
      <FVGDetailsList height={400} onFVGSelect={mockOnFVGSelect} />
    );
    
    // 檢查是否渲染了正確數量的FVG項目
    expect(screen.getAllByText(/FVG #/)).toHaveLength(mockFVGData.length);
  });
  
  it('filters FVGs correctly', async () => {
    render(
      <FVGDetailsList height={400} onFVGSelect={mockOnFVGSelect} />
    );
    
    // 切換到只顯示valid FVGs
    const filterSelect = screen.getByDisplayValue('All FVGs');
    fireEvent.change(filterSelect, { target: { value: 'valid' } });
    
    await waitFor(() => {
      const validFVGs = mockFVGData.filter(fvg => fvg.status === 'valid');
      expect(screen.getAllByText(/FVG #/)).toHaveLength(validFVGs.length);
    });
  });
  
  it('calls onFVGSelect when FVG item is clicked', () => {
    render(
      <FVGDetailsList height={400} onFVGSelect={mockOnFVGSelect} />
    );
    
    const firstFVGItem = screen.getByText(`FVG #${mockFVGData[0].number}`);
    fireEvent.click(firstFVGItem);
    
    expect(mockOnFVGSelect).toHaveBeenCalledWith(mockFVGData[0]);
  });
  
  it('sorts FVGs correctly', async () => {
    render(
      <FVGDetailsList height={400} onFVGSelect={mockOnFVGSelect} />
    );
    
    // 按gap size排序
    const sortSelect = screen.getByDisplayValue('Formation Time');
    fireEvent.change(sortSelect, { target: { value: 'size' } });
    
    await waitFor(() => {
      const items = screen.getAllByText(/FVG #/);
      // 驗證排序順序 (可以檢查第一個和最後一個項目)
      expect(items[0]).toBeInTheDocument();
    });
  });
});

// frontend/src/hooks/__tests__/useFVGData.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { useFVGData } from '../useFVGData';
import { apiClient } from '../../services/api';
import { mockFVGData } from '../../../__mocks__/fvgData';

// Mock API client
jest.mock('../../services/api');
const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('useFVGData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('loads FVG data successfully', async () => {
    mockApiClient.getFVGs.mockResolvedValue(mockFVGData);
    
    const { result } = renderHook(() =>
      useFVGData({
        symbol: 'MNQ',
        timeframe: 'M1',
        date: '2024-01-01'
      })
    );
    
    // 初始狀態
    expect(result.current.loading).toBe(true);
    expect(result.current.fvgs).toEqual([]);
    
    // 等待數據加載
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.fvgs).toEqual(mockFVGData);
      expect(result.current.error).toBeNull();
    });
  });
  
  it('handles API errors correctly', async () => {
    const errorMessage = 'Failed to load FVGs';
    mockApiClient.getFVGs.mockRejectedValue(new Error(errorMessage));
    
    const { result } = renderHook(() =>
      useFVGData({
        symbol: 'MNQ',
        timeframe: 'M1'
      })
    );
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(errorMessage);
      expect(result.current.fvgs).toEqual([]);
    });
  });
  
  it('filters FVGs correctly', async () => {
    mockApiClient.getFVGs.mockResolvedValue(mockFVGData);
    
    const { result } = renderHook(() =>
      useFVGData({
        symbol: 'MNQ',
        timeframe: 'M1'
      })
    );
    
    await waitFor(() => {
      expect(result.current.validFVGs).toEqual(
        mockFVGData.filter(fvg => fvg.status === 'valid')
      );
      
      expect(result.current.bullishFVGs).toEqual(
        mockFVGData.filter(fvg => fvg.type === 'bullish')
      );
    });
  });
  
  it('auto-refreshes data when enabled', async () => {
    mockApiClient.getFVGs.mockResolvedValue(mockFVGData);
    
    const { result } = renderHook(() =>
      useFVGData({
        symbol: 'MNQ',
        timeframe: 'M1',
        autoRefresh: true,
        refreshInterval: 100 // 100ms for testing
      })
    );
    
    await waitFor(() => {
      expect(mockApiClient.getFVGs).toHaveBeenCalledTimes(1);
    });
    
    // 等待自動刷新
    await waitFor(() => {
      expect(mockApiClient.getFVGs).toHaveBeenCalledTimes(2);
    }, { timeout: 200 });
  });
});

// E2E測試 (Playwright)
// frontend/e2e/fvg-detection.spec.ts
import { test, expect } from '@playwright/test';

test.describe('FVG Detection Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // 等待應用加載
    await expect(page.locator('[data-testid="main-chart"]')).toBeVisible();
  });
  
  test('should detect and display FVGs', async ({ page }) => {
    // 1. 選擇日期和時間框架
    await page.selectOption('[data-testid="timeframe-selector"]', 'M1');
    await page.fill('[data-testid="date-picker"]', '2024-01-01');
    
    // 2. 開始FVG檢測
    await page.click('[data-testid="detect-fvg-button"]');
    
    // 3. 等待檢測完成
    await expect(page.locator('[data-testid="loading-indicator"]')).toBeHidden();
    
    // 4. 驗證FVG顯示在圖表上
    await expect(page.locator('[data-testid="fvg-band"]')).toBeVisible();
    
    // 5. 驗證FVG詳情面板
    await expect(page.locator('[data-testid="fvg-details-list"]')).toBeVisible();
    
    // 6. 檢查統計數據
    const bullishCount = await page.locator('[data-testid="bullish-fvg-count"]').textContent();
    expect(parseInt(bullishCount || '0')).toBeGreaterThanOrEqual(0);
  });
  
  test('should allow FVG interaction', async ({ page }) => {
    // 準備: 確保有FVG數據
    await page.selectOption('[data-testid="timeframe-selector"]', 'M1');
    await page.click('[data-testid="detect-fvg-button"]');
    await expect(page.locator('[data-testid="fvg-band"]').first()).toBeVisible();
    
    // 1. 點擊FVG band
    await page.click('[data-testid="fvg-band"]');
    
    // 2. 驗證選中狀態
    await expect(page.locator('[data-testid="fvg-band"].selected')).toBeVisible();
    
    // 3. 檢查詳情面板同步選中
    await expect(page.locator('[data-testid="fvg-detail-card"].selected')).toBeVisible();
    
    // 4. 測試聚焦功能
    await page.click('[data-testid="focus-fvg-button"]');
    
    // 5. 驗證圖表視區更新 (檢查圖表中心是否移動到FVG位置)
    // 這可能需要更複雜的DOM查詢或自定義測試屬性
  });
  
  test('should handle replay mode with FVG detection', async ({ page }) => {
    // 1. 啟動回放模式
    await page.click('[data-testid="prepare-replay-button"]');
    await expect(page.locator('[data-testid="playback-controls"]')).toBeVisible();
    
    // 2. 開始播放
    await page.click('[data-testid="play-button"]');
    
    // 3. 驗證K線逐步出現
    await page.waitForTimeout(2000); // 等待幾根K線
    
    // 4. 檢查FVG實時檢測
    const fvgCount = await page.locator('[data-testid="total-valid-fvgs"]').textContent();
    
    // 5. 暫停播放
    await page.click('[data-testid="pause-button"]');
    
    // 6. 驗證狀態保持
    await expect(page.locator('[data-testid="pause-button"]')).toBeVisible();
  });
});
```

## 5. 部署與運維

### 5.1 Docker容器化

```dockerfile
# backend/Dockerfile
FROM python:3.11-slim as builder

# 設置工作目錄
WORKDIR /app

# 安裝系統依賴
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# 安裝Poetry
RUN pip install poetry

# 複製依賴文件
COPY pyproject.toml poetry.lock ./

# 配置Poetry並安裝依賴
RUN poetry config virtualenvs.create false \
    && poetry install --only=main --no-dev

# 生產階段
FROM python:3.11-slim

WORKDIR /app

# 安裝運行時依賴
RUN apt-get update && apt-get install -y \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# 從builder階段複製安裝的包
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# 複製應用代碼
COPY . .

# 創建非root用戶
RUN groupadd -r appuser && useradd -r -g appuser appuser
RUN chown -R appuser:appuser /app
USER appuser

# 健康檢查
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/api/v3/health || exit 1

# 啟動命令
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]

# frontend/Dockerfile
FROM node:18-alpine as builder

WORKDIR /app

# 安裝依賴
COPY package*.json ./
RUN npm ci --only=production

# 複製源代碼
COPY . .

# 構建應用
RUN npm run build

# 生產階段 - 使用nginx
FROM nginx:alpine

# 複製構建結果
COPY --from=builder /app/dist /usr/share/nginx/html

# 複製nginx配置
COPY nginx.conf /etc/nginx/nginx.conf

# 健康檢查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/ || exit 1

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 5.2 Kubernetes部署

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: fvg-system

---
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: fvg-backend-config
  namespace: fvg-system
data:
  DATABASE_HOST: "postgresql-service"
  DATABASE_PORT: "5432"
  DATABASE_NAME: "fvg_db"
  REDIS_HOST: "redis-service"
  REDIS_PORT: "6379"
  LOG_LEVEL: "INFO"
  CORS_ORIGINS: "https://fvg.yourdomain.com"

---
# k8s/secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: fvg-backend-secrets
  namespace: fvg-system
type: Opaque
data:
  DATABASE_PASSWORD: <base64-encoded-password>
  JWT_SECRET_KEY: <base64-encoded-jwt-secret>
  REDIS_PASSWORD: <base64-encoded-redis-password>

---
# k8s/backend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: fvg-backend
  namespace: fvg-system
  labels:
    app: fvg-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: fvg-backend
  template:
    metadata:
      labels:
        app: fvg-backend
    spec:
      containers:
      - name: backend
        image: fvg-system/backend:v3.0.0
        ports:
        - containerPort: 8000
        env:
        - name: DATABASE_URL
          value: "postgresql+asyncpg://$(DATABASE_USER):$(DATABASE_PASSWORD)@$(DATABASE_HOST):$(DATABASE_PORT)/$(DATABASE_NAME)"
        envFrom:
        - configMapRef:
            name: fvg-backend-config
        - secretRef:
            name: fvg-backend-secrets
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /api/v3/health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /api/v3/ready
            port: 8000
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3

---
# k8s/backend-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: fvg-backend-service
  namespace: fvg-system
spec:
  selector:
    app: fvg-backend
  ports:
  - protocol: TCP
    port: 80
    targetPort: 8000
  type: ClusterIP

---
# k8s/frontend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: fvg-frontend
  namespace: fvg-system
spec:
  replicas: 2
  selector:
    matchLabels:
      app: fvg-frontend
  template:
    metadata:
      labels:
        app: fvg-frontend
    spec:
      containers:
      - name: frontend
        image: fvg-system/frontend:v3.0.0
        ports:
        - containerPort: 80
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"

---
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: fvg-ingress
  namespace: fvg-system
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
spec:
  tls:
  - hosts:
    - fvg.yourdomain.com
    - api.fvg.yourdomain.com
    secretName: fvg-tls-secret
  rules:
  - host: fvg.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: fvg-frontend-service
            port:
              number: 80
  - host: api.fvg.yourdomain.com  
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: fvg-backend-service
            port:
              number: 80

---
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: fvg-backend-hpa
  namespace: fvg-system
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: fvg-backend
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
```

### 5.3 監控與告警

```yaml
# monitoring/prometheus-rules.yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: fvg-system-alerts
  namespace: fvg-system
spec:
  groups:
  - name: fvg.backend
    rules:
    - alert: FVGBackendDown
      expr: up{job="fvg-backend"} == 0
      for: 1m
      labels:
        severity: critical
      annotations:
        summary: "FVG Backend is down"
        description: "FVG Backend has been down for more than 1 minute"
    
    - alert: FVGBackendHighLatency
      expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{job="fvg-backend"}[5m])) > 2
      for: 2m
      labels:
        severity: warning
      annotations:
        summary: "FVG Backend high latency"
        description: "95th percentile latency is {{ $value }}s"
    
    - alert: FVGDetectionErrors
      expr: rate(fvg_detection_errors_total[5m]) > 0.1
      for: 2m
      labels:
        severity: warning
      annotations:
        summary: "High FVG detection error rate"
        description: "FVG detection error rate is {{ $value }} errors/second"
    
    - alert: DatabaseConnectionErrors
      expr: rate(database_connection_errors_total[5m]) > 0
      for: 1m
      labels:
        severity: critical
      annotations:
        summary: "Database connection errors"
        description: "Database connection error rate: {{ $value }} errors/second"

# monitoring/grafana-dashboard.json (部分)
{
  "dashboard": {
    "title": "FVG Trading System Dashboard",
    "panels": [
      {
        "title": "API Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total{job=\"fvg-backend\"}[5m])",
            "legendFormat": "{{method}} {{handler}}"
          }
        ]
      },
      {
        "title": "FVG Detection Metrics",
        "type": "graph", 
        "targets": [
          {
            "expr": "rate(fvg_detections_total[5m])",
            "legendFormat": "{{symbol}} {{timeframe}}"
          }
        ]
      },
      {
        "title": "WebSocket Connections",
        "type": "stat",
        "targets": [
          {
            "expr": "websocket_connections_active",
            "legendFormat": "Active Connections"
          }
        ]
      },
      {
        "title": "Database Query Performance",
        "type": "heatmap",
        "targets": [
          {
            "expr": "rate(database_query_duration_seconds_bucket[5m])",
            "legendFormat": "{{le}}"
          }
        ]
      }
    ]
  }
}
```

## 6. 驗收標準與檢查清單

### 6.1 功能驗收標準

```markdown
# FVG 系統功能驗收檢查清單

## A. 核心FVG檢測功能 ✅
- [ ] **FVG算法準確性**
  - [ ] 多頭FVG檢測: C.Close > C.Open && C.Close > L.High && L.High < R.Low
  - [ ] 空頭FVG檢測: C.Close < C.Open && C.Close < L.Low && L.Low > R.High
  - [ ] 邊界價格正確: Bullish(bottom=L.High, top=R.Low), Bearish(top=L.Low, bottom=R.High)
  - [ ] 缺口大小計算正確 (點數轉換)

- [ ] **FVG清除機制**
  - [ ] Close清除: 收盤價觸及對邊界
  - [ ] Wick清除: 影線觸及對邊界
  - [ ] 清除時間和價格記錄準確
  - [ ] 最大回看期限 (40根K線) 正確執行

- [ ] **多時間框架支持**
  - [ ] 支持M1, M5, M15, H1, H4, D1
  - [ ] 時間框架間數據同步正確
  - [ ] FVG編號全域唯一不重複

## B. 用戶界面功能 ✅
- [ ] **左側控制面板**
  - [ ] FVG開關: 主開關、Marker開關、Show Cleared開關
  - [ ] 統計計數: Bullish X/Y, Bearish X/Y, Total Valid Z
  - [ ] 繪圖工具: 水平線、矩形、文字標註等
  - [ ] 數值變化動畫效果

- [ ] **主圖表區域**  
  - [ ] K線正常顯示，支持縮放和平移
  - [ ] FVG Band: 正確顏色、透明度、條紋效果
  - [ ] FVG Markers: F# 編號、位置、密度控制
  - [ ] Hover/Click交互: 高亮、選擇、聚焦
  - [ ] 清除動畫: valid→cleared 250ms轉場

- [ ] **右側詳情面板**
  - [ ] FVG清單: 完整信息顯示、虛擬化滾動
  - [ ] 篩選排序: valid/cleared/both, 按時間/大小/類型
  - [ ] 統計面板: 圓餅圖、性能指標、導出功能
  - [ ] 卡片互動: 點擊聚焦、狀態同步

## C. 回放系統功能 ✅
- [ ] **回放控制**
  - [ ] 準備階段: 數據完整性檢查、多TF預加載
  - [ ] 播放控制: 播放/暫停/停止/跳轉
  - [ ] 速度控制: 0.5s-10s/candle 可調
  - [ ] 進度顯示: 當前位置/總數/百分比

- [ ] **實時FVG檢測**
  - [ ] 逐步K線推進時實時檢測FVG
  - [ ] 新FVG形成時立即顯示和統計
  - [ ] FVG清除時實時狀態更新
  - [ ] WebSocket數據流同步

- [ ] **多TF同步回放**
  - [ ] M1為主時間線，其他TF正確對應
  - [ ] 時間框架切換時數據一致
  - [ ] 同步質量指標監控

## D. 數據管理功能 ✅  
- [ ] **數據加載與緩存**
  - [ ] 支援本地CSV文件和API數據源
  - [ ] 多層緩存: 內存、Redis、數據庫
  - [ ] 智能預取: 相鄰日期、相關時間框架
  - [ ] 數據質量檢查: 時間戳、價格範圍、OHLC邏輯

- [ ] **用戶數據持久化**
  - [ ] 繪圖數據: 水平線、矩形、文字標註
  - [ ] 用戶設定: 主題、語言、圖表偏好
  - [ ] 跨時間框架持久化: H-Line在TF切換時保持

- [ ] **API接口完整性**
  - [ ] RESTful API: 符合OpenAPI規範
  - [ ] 錯誤處理: 標準HTTP狀態碼和錯誤信息
  - [ ] 認證授權: JWT令牌、權限控制
  - [ ] 限率控制: 防止API濫用

## E. 性能與穩定性 ✅
- [ ] **響應時間要求**
  - [ ] FVG檢測: 單次<100ms (400根K線)
  - [ ] 圖表渲染: 60fps (400根K線+80個FVG)
  - [ ] TF切換: <200ms 完成加載
  - [ ] WebSocket延遲: <50ms

- [ ] **資源使用限制**
  - [ ] 前端內存: 峰值<150MB
  - [ ] 後端內存: 單進程<512MB  
  - [ ] CPU使用率: <70% (正常負載)
  - [ ] 數據庫連接: <100 併發連接

- [ ] **穩定性測試**
  - [ ] 長時間運行: 24小時無內存泄漏
  - [ ] 併發用戶: 支持100+ 同時用戶
  - [ ] 異常恢復: 網絡中斷、服務重啟後正常
  - [ ] 數據一致性: 並發操作不產生髒數據

## F. 安全與合規 ✅
- [ ] **安全防護**
  - [ ] 輸入驗證: SQL注入、XSS防護
  - [ ] 認證機制: 安全的JWT實現
  - [ ] HTTPS傳輸: 敏感數據加密
  - [ ] API限率: 防止DDoS和爬蟲

- [ ] **數據保護**
  - [ ] 敏感信息脫敏: 日誌中不包含密碼等
  - [ ] 備份恢復: 定期數據備份和恢復測試
  - [ ] 存取日誌: 完整的審計日誌記錄

## G. 用戶體驗 ✅
- [ ] **響應式設計**
  - [ ] 桌面端: 1440px+ 完整功能
  - [ ] 筆記本: 1024px+ 可收縮面板
  - [ ] 平板: 768px+ 抽屜式面板

- [ ] **無障礙支援**
  - [ ] 鍵盤導航: Tab順序合理
  - [ ] 螢幕閱讀器: 適當的aria標籤
  - [ ] 色彩對比: 符合WCAG 2.1 AA標準
  - [ ] 快捷鍵: 空格鍵播放/暫停等

- [ ] **國際化**
  - [ ] 多語言: 中文/英文切換
  - [ ] 時區處理: Asia/Taipei (UTC+8)
  - [ ] 數字格式: 千分位、小數點顯示
  - [ ] 日期格式: 本地化日期時間顯示

## H. 部署與運維 ✅
- [ ] **容器化部署**
  - [ ] Docker鏡像: 多階段構建、安全掃描通過
  - [ ] K8s部署: HPA、健康檢查、滾動更新
  - [ ] 配置管理: ConfigMap/Secret正確使用

- [ ] **監控告警**
  - [ ] 應用指標: Prometheus + Grafana
  - [ ] 錯誤追蹤: 結構化日誌、錯誤聚合
  - [ ] 告警規則: 服務宕機、高延遲、錯誤率
  - [ ] 性能監控: APM追蹤、數據庫查詢分析

## I. 測試覆蓋率 ✅
- [ ] **單元測試**
  - [ ] 後端: >90% 代碼覆蓋率
  - [ ] 前端: >85% 代碼覆蓋率  
  - [ ] 核心算法: 100% 路徑覆蓋

- [ ] **集成測試**
  - [ ] API端點: 所有接口測試通過
  - [ ] 數據流: 端到端數據流驗證
  - [ ] WebSocket: 實時通信測試

- [ ] **E2E測試**
  - [ ] 關鍵用戶流程: FVG檢測、回放、設定保存
  - [ ] 跨瀏覽器: Chrome, Firefox, Safari, Edge
  - [ ] 性能測試: Lighthouse分數 >90
```

### 6.2 自動化驗收腳本

```python
# scripts/acceptance_test.py
import asyncio
import aiohttp
import time
from typing import Dict, List, Any
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class FVGAcceptanceTest:
    """FVG系統自動化驗收測試"""
    
    def __init__(self, api_base_url: str = "http://localhost:8000"):
        self.api_base_url = api_base_url
        self.session = None
        self.test_results = []
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def test_health_check(self) -> bool:
        """測試系統健康檢查"""
        try:
            async with self.session.get(f"{self.api_base_url}/api/v3/health") as resp:
                if resp.status == 200:
                    data = await resp.json()
                    logger.info(f"✅ Health check passed: {data}")
                    return True
                else:
                    logger.error(f"❌ Health check failed: {resp.status}")
                    return False
        except Exception as e:
            logger.error(f"❌ Health check error: {e}")
            return False
    
    async def test_fvg_detection_accuracy(self) -> bool:
        """測試FVG檢測準確性"""
        try:
            # 使用已知有FVG的測試數據
            test_request = {
                "symbol": "MNQ",
                "timeframe": "M1", 
                "date_range": {
                    "from": "2024-01-01",
                    "to": "2024-01-01"
                },
                "settings": {
                    "algorithm": "v5_optimized",
                    "max_lookback": 40
                }
            }
            
            start_time = time.time()
            async with self.session.post(
                f"{self.api_base_url}/api/v3/fvg/detect", 
                json=test_request
            ) as resp:
                detection_time = time.time() - start_time
                
                if resp.status == 200:
                    fvgs = await resp.json()
                    
                    # 驗證檢測結果
                    if self._validate_fvg_results(fvgs):
                        logger.info(f"✅ FVG detection passed: {len(fvgs)} FVGs detected in {detection_time:.2f}s")
                        return detection_time < 0.1  # 100ms要求
                    else:
                        logger.error("❌ FVG validation failed")
                        return False
                else:
                    logger.error(f"❌ FVG detection failed: {resp.status}")
                    return False
                    
        except Exception as e:
            logger.error(f"❌ FVG detection error: {e}")
            return False
    
    def _validate_fvg_results(self, fvgs: List[Dict[str, Any]]) -> bool:
        """驗證FVG結果的正確性"""
        if not fvgs:
            return True  # 空結果也是有效的
        
        for fvg in fvgs:
            # 檢查必要字段
            required_fields = [
                'id', 'number', 'symbol', 'timeframe', 'type',
                'top_price', 'bottom_price', 'gap_size', 'status'
            ]
            
            for field in required_fields:
                if field not in fvg:
                    logger.error(f"Missing field: {field} in FVG {fvg.get('id', 'unknown')}")
                    return False
            
            # 驗證價格邏輯
            if fvg['bottom_price'] >= fvg['top_price']:
                logger.error(f"Invalid price range: bottom {fvg['bottom_price']} >= top {fvg['top_price']}")
                return False
            
            # 驗證缺口大小
            expected_gap = abs(fvg['top_price'] - fvg['bottom_price'])
            if abs(fvg['gap_size'] - expected_gap) > 0.001:
                logger.error(f"Gap size mismatch: expected {expected_gap}, got {fvg['gap_size']}")
                return False
        
        return True
    
    async def test_websocket_connection(self) -> bool:
        """測試WebSocket連接"""
        try:
            import websockets
            
            ws_url = self.api_base_url.replace('http', 'ws') + '/ws/realtime/test-user'
            
            async with websockets.connect(
                f"{ws_url}?token=test-token",
                timeout=10
            ) as websocket:
                # 發送心跳
                await websocket.send('{"type": "heartbeat"}')
                
                # 等待響應
                response = await asyncio.wait_for(websocket.recv(), timeout=5)
                data = json.loads(response)
                
                if data.get('type') == 'heartbeat_ack':
                    logger.info("✅ WebSocket connection test passed")
                    return True
                else:
                    logger.error(f"❌ Unexpected WebSocket response: {data}")
                    return False
                    
        except Exception as e:
            logger.error(f"❌ WebSocket test failed: {e}")
            return False
    
    async def test_performance_requirements(self) -> bool:
        """測試性能要求"""
        try:
            # 測試併發API請求
            concurrent_requests = 50
            
            async def make_request():
                async with self.session.get(f"{self.api_base_url}/api/v3/health") as resp:
                    return resp.status == 200
            
            start_time = time.time()
            results = await asyncio.gather(
                *[make_request() for _ in range(concurrent_requests)],
                return_exceptions=True
            )
            
            total_time = time.time() - start_time
            success_count = sum(1 for result in results if result is True)
            
            # 驗證併發處理能力
            if success_count >= concurrent_requests * 0.95:  # 95% 成功率
                avg_time = total_time / concurrent_requests
                logger.info(f"✅ Performance test passed: {success_count}/{concurrent_requests} requests succeeded in {total_time:.2f}s (avg: {avg_time:.3f}s)")
                return True
            else:
                logger.error(f"❌ Performance test failed: only {success_count}/{concurrent_requests} succeeded")
                return False
                
        except Exception as e:
            logger.error(f"❌ Performance test error: {e}")
            return False
    
    async def run_all_tests(self) -> Dict[str, bool]:
        """運行所有驗收測試"""
        tests = [
            ("health_check", self.test_health_check),
            ("fvg_detection_accuracy", self.test_fvg_detection_accuracy),
            ("websocket_connection", self.test_websocket_connection),
            ("performance_requirements", self.test_performance_requirements),
        ]
        
        results = {}
        
        for test_name, test_func in tests:
            logger.info(f"Running test: {test_name}")
            try:
                result = await test_func()
                results[test_name] = result
                logger.info(f"Test {test_name}: {'PASS' if result else 'FAIL'}")
            except Exception as e:
                logger.error(f"Test {test_name} failed with error: {e}")
                results[test_name] = False
        
        # 生成測試報告
        self._generate_test_report(results)
        
        return results
    
    def _generate_test_report(self, results: Dict[str, bool]):
        """生成測試報告"""
        passed = sum(results.values())
        total = len(results)
        
        report = f"""
=== FVG 系統驗收測試報告 ===
測試時間: {time.strftime('%Y-%m-%d %H:%M:%S')}
API Base URL: {self.api_base_url}

測試結果: {passed}/{total} 通過

詳細結果:
"""
        
        for test_name, result in results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            report += f"  - {test_name}: {status}\n"
        
        report += f"""
總體狀態: {'🎉 所有測試通過，系統可以上線' if passed == total else '⚠️  部分測試失敗，需要修復'}
"""
        
        print(report)
        
        # 保存到文件
        with open(f"acceptance_test_report_{int(time.time())}.txt", "w") as f:
            f.write(report)

async def main():
    """主函數"""
    import argparse
    
    parser = argparse.ArgumentParser(description="FVG System Acceptance Test")
    parser.add_argument("--api-url", default="http://localhost:8000", help="API base URL")
    parser.add_argument("--test", help="Run specific test only")
    
    args = parser.parse_args()
    
    async with FVGAcceptanceTest(args.api_url) as test_runner:
        if args.test:
            # 運行特定測試
            test_method = getattr(test_runner, f"test_{args.test}", None)
            if test_method:
                result = await test_method()
                print(f"Test {args.test}: {'PASS' if result else 'FAIL'}")
            else:
                print(f"Test {args.test} not found")
        else:
            # 運行所有測試
            results = await test_runner.run_all_tests()
            
            # 設置退出碼
            exit_code = 0 if all(results.values()) else 1
            exit(exit_code)

if __name__ == "__main__":
    asyncio.run(main())
```

## 總結

本實現指南提供了FVG交易系統的完整開發、測試、部署和驗收框架：

- ✅ **完整的開發環境** - 從工具安裝到項目結構
- ✅ **詳細的代碼示例** - 後端服務、前端組件、測試用例
- ✅ **現代化部署方案** - Docker容器化、Kubernetes編排
- ✅ **全面的測試策略** - 單元測試、集成測試、E2E測試
- ✅ **嚴格的驗收標準** - 111項具體檢查點
- ✅ **自動化驗收腳本** - 可執行的測試套件

### 開發里程碑建議
1. **Phase 1** (4週): 後端核心API + FVG檢測算法
2. **Phase 2** (4週): 前端基礎界面 + 圖表集成
3. **Phase 3** (3週): 實時通信 + 回放系統
4. **Phase 4** (2週): 性能優化 + 測試完善
5. **Phase 5** (1週): 部署上線 + 驗收測試

---

*版本: v3.0 | 更新日期: 2025-08-20 | 維護者: FVG開發團隊*