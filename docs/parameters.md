# FVG系統參數文檔

## 概述
本文檔記錄了Fair Value Gap (FVG)檢測系統中所有參數的含義、預設值和使用說明。

## 前端配置參數 (CONFIG.FVG)

### 檢測參數
| 參數名稱 | 預設值 | 含義 | 說明 |
|---------|--------|------|------|
| `DETECTION_RANGE` | 400 | FVG檢測範圍 | 開盤前檢測多少根K線範圍內的FVG |
| `REQUIRE_DIR_CONTINUITY` | false | 方向連續性要求 | 是否要求左右K線(L,C)同色，false為依據FVG規則v2規範 |
| `FILL_MODE` | "single" | 回補模式 | "single"=單根實體覆蓋, "multi_strict"=多根連續覆蓋 |
| `CONFIRM_ON_CLOSE` | false | 收盤確認 | 是否僅用已收盤K線做回補/到期判定 |
| `TICK_EPS` | 0.0 | Tick精度容差 | 填補檢測的價格容差，提高檢測準確性 |
| `IOU_THRESHOLD` | 0.8 | IoU去重閾值 | 重疊區域去重的最小重疊比例，依據規格v2設定 |

### 顯示參數
| 參數名稱 | 預設值 | 含義 | 說明 |
|---------|--------|------|------|
| `DISPLAY_LENGTH` | 40 | FVG顯示長度 | 每個FVG向右延伸的K線數量 |
| `OPACITY` | 0.25 | 填充透明度 | FVG區域的視覺透明度 |
| `MAX_LINES` | 60 | 最大填充線條數 | 單個FVG最多繪製的線條數量 |
| `FALLBACK_LINES` | 12 | 退路線條數 | 當計算線條數過少時的最小線條數 |
| `LINE_WIDTH` | 1 | 線條寬度 | 填充線的寬度 |
| `GAP_WIDTH` | 2 | 線條間隔 | 填充線之間的間距 |

## 後端檢測參數

### FVGDetector 類別參數
| 參數名稱 | 預設值 | 含義 | 說明 |
|---------|--------|------|------|
| `detection_range` | 400 | 檢測範圍 | 開盤前多少根K線範圍內檢測FVG |
| `require_dir_continuity` | False | 方向連續性 | 是否要求三根結構的L與C同色 |
| `fill_mode` | "single" | 回補模式 | 回補檢測的嚴格程度 |
| `confirm_on_close` | False | 收盤確認 | 是否僅在K線收盤後確認回補/到期 |
| `iou_thresh` | 0.8 | IoU閾值 | 重疊區域計算的閾值 |
| `tick_eps` | 0.0 | Tick容差 | 價格比較的精度容差 |

## 系統配置參數

### Flask 後端配置
| 參數名稱 | 預設值 | 含義 | 說明 |
|---------|--------|------|------|
| `FLASK_DEBUG` | False | 調試模式 | 生產環境設為False，開發時可設為True |
| `FLASK_HOST` | '127.0.0.1' | 伺服器主機 | Flask伺服器綁定的IP地址 |
| `FLASK_PORT` | 5000 | 伺服器端口 | Flask伺服器監聽的端口號 |

### 前端系統配置
| 參數名稱 | 預設值 | 含義 | 說明 |
|---------|--------|------|------|
| `DEBUG` | false | 調試模式 | 控制是否顯示console調試訊息 |

## 參數使用指南

### 1. 調整檢測靈敏度
- **增加檢測範圍**: 提高 `DETECTION_RANGE` 值
- **降低檢測噪音**: 設置 `REQUIRE_DIR_CONTINUITY` 為 true
- **調整去重程度**: 修改 `IOU_THRESHOLD` (0.5-0.9範圍)

### 2. 優化顯示效果
- **延長FVG顯示**: 增加 `DISPLAY_LENGTH` 值
- **調整視覺密度**: 修改 `OPACITY` 和線條相關參數
- **提升渲染性能**: 降低 `MAX_LINES` 值

### 3. 回補檢測調優
- **嚴格單次回補**: 使用 `FILL_MODE: "single"`
- **多次累積回補**: 使用 `FILL_MODE: "multi_strict"`
- **實時vs收盤確認**: 調整 `CONFIRM_ON_CLOSE`

## 注意事項

1. **參數同步**: 前後端相同功能的參數應保持一致
2. **性能影響**: `DETECTION_RANGE` 和 `MAX_LINES` 直接影響性能
3. **規格依據**: 當前參數基於FVG規則v2.txt規範設定
4. **調試模式**: 生產環境應關閉所有DEBUG選項

## 更新歷史

- 2024-08-14: 統一命名約定，添加缺失的前端參數
- 2024-08-14: 重命名MAX_AGE為DETECTION_RANGE
- 2024-08-14: 移除未使用的前端DETECTION_RANGE參數
- 2024-08-14: 添加條件式調試輸出控制