# 交易圖表系統 - 專案檔案清單與GitHub URL

## 基礎配置檔案

| 檔案 | GitHub URL |
|------|-----------|
| README.md | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/README.md |
| requirements.txt | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/requirements.txt |

## 後端檔案 (Python)

### 核心模組
| 檔案 | GitHub URL |
|------|-----------|
| src/backend/app.py | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/src/backend/app.py |
| src/backend/data_processor.py | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/src/backend/data_processor.py |
| src/backend/time_utils.py | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/src/backend/time_utils.py |
| src/backend/trading_hours.py | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/src/backend/trading_hours.py |
| src/backend/us_holidays.py | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/src/backend/us_holidays.py |
| src/backend/candle_continuity_checker.py | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/src/backend/candle_continuity_checker.py |

### FVG檢測器
| 檔案 | GitHub URL |
|------|-----------|
| src/backend/fvg_detector.py | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/src/backend/fvg_detector.py |
| src/backend/fvg_detector_v3.py | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/src/backend/fvg_detector_v3.py |

### 指標模組
| 檔案 | GitHub URL |
|------|-----------|
| src/backend/indicators/__init__.py | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/src/backend/indicators/__init__.py |
| src/backend/indicators/base_indicator.py | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/src/backend/indicators/base_indicator.py |
| src/backend/indicators/fvg_indicator.py | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/src/backend/indicators/fvg_indicator.py |

## 前端檔案 (JavaScript/HTML/CSS)

### 核心頁面
| 檔案 | GitHub URL |
|------|-----------|
| src/frontend/index.html | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/src/frontend/index.html |
| src/frontend/index-v2.html | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/src/frontend/index-v2.html |
| src/frontend/index_fvg_demo.html | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/src/frontend/index_fvg_demo.html |
| src/frontend/demo_v5.html | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/src/frontend/demo_v5.html |
| src/frontend/test_v5.html | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/src/frontend/test_v5.html |

### 樣式檔案
| 檔案 | GitHub URL |
|------|-----------|
| src/frontend/style.css | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/src/frontend/style.css |
| src/frontend/style-v2.css | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/src/frontend/style-v2.css |

### 核心JavaScript模組
| 檔案 | GitHub URL |
|------|-----------|
| src/frontend/script.js | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/src/frontend/script.js |
| src/frontend/script-v2.js | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/src/frontend/script-v2.js |
| src/frontend/config.js | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/src/frontend/config.js |

### 管理器模組
| 檔案 | GitHub URL |
|------|-----------|
| src/frontend/chart-manager.js | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/src/frontend/chart-manager.js |
| src/frontend/data-manager.js | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/src/frontend/data-manager.js |
| src/frontend/event-manager.js | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/src/frontend/event-manager.js |
| src/frontend/playback-manager.js | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/src/frontend/playback-manager.js |

### FVG相關模組
| 檔案 | GitHub URL |
|------|-----------|
| src/frontend/fvg-renderer.js | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/src/frontend/fvg-renderer.js |
| src/frontend/fvg-custom-series.js | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/src/frontend/fvg-custom-series.js |
| src/frontend/fvg_series.js | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/src/frontend/fvg_series.js |

### 其他模組
| 檔案 | GitHub URL |
|------|-----------|
| src/frontend/candleAggregator.js | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/src/frontend/candleAggregator.js |

### 指標系統
| 檔案 | GitHub URL |
|------|-----------|
| src/frontend/indicators/indicator_manager.js | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/src/frontend/indicators/indicator_manager.js |
| src/frontend/indicators/renderers/base_renderer.js | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/src/frontend/indicators/renderers/base_renderer.js |

## 工具與配置

### 配置檔案
| 檔案 | GitHub URL |
|------|-----------|
| src/utils/config.py | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/src/utils/config.py |

### 測試檔案
| 檔案 | GitHub URL |
|------|-----------|
| test_continuity.py | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/test_continuity.py |
| test_fvg_v3.py | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/test_fvg_v3.py |
| test_improved_continuity.py | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/test_improved_continuity.py |
| test_integration_v3.py | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/test_integration_v3.py |
| test_v3_final.py | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/test_v3_final.py |

### 其他工具
| 檔案 | GitHub URL |
|------|-----------|
| bundle_size_test.js | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/bundle_size_test.js |

## 文檔資料

### 主要文檔
| 檔案 | GitHub URL |
|------|-----------|
| FVG_DISPLAY_FIX.md | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/FVG_DISPLAY_FIX.md |
| INDICATOR_SYSTEM_PLAN.md | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/INDICATOR_SYSTEM_PLAN.md |
| MAIN_SYSTEM_UPDATE.md | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/MAIN_SYSTEM_UPDATE.md |
| UPGRADE_INSTRUCTIONS.md | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/UPGRADE_INSTRUCTIONS.md |
| migration_plan_v5.md | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/migration_plan_v5.md |

### 項目文檔
| 檔案 | GitHub URL |
|------|-----------|
| docs/folder_structure.txt | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/docs/folder_structure.txt |
| docs/parameters.md | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/docs/parameters.md |

## 歷史記錄與分析

### 2025-08-03 記錄
| 檔案 | GitHub URL |
|------|-----------|
| misc/0803/20250804總結.txt | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/misc/0803/20250804總結.txt |
| misc/0803/readme20250804.md | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/misc/0803/readme20250804.md |
| misc/0803/專案資料夾結構.txt | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/misc/0803/專案資料夾結構.txt |
| misc/0803/過程討論摘要.md | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/misc/0803/過程討論摘要.md |

### 2025-08-04 記錄
| 檔案 | GitHub URL |
|------|-----------|
| misc/0804/PatternWeaver 專案完整總結.txt | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/misc/0804/PatternWeaver%20專案完整總結.txt |
| misc/0804/README.md | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/misc/0804/README.md |
| misc/0804/過程討論以及修正摘要.txt | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/misc/0804/過程討論以及修正摘要.txt |

### 2025-08-08 記錄
| 檔案 | GitHub URL |
|------|-----------|
| misc/0808/0808新任務.txt | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/misc/0808/0808新任務.txt |
| misc/0808/交接文檔.md | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/misc/0808/交接文檔.md |

### 2025-08-13 記錄
| 檔案 | GitHub URL |
|------|-----------|
| misc/0813/FVG半透明修改建議.txt | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/misc/0813/FVG半透明修改建議.txt |
| misc/0813/FVG偵測修正.txt | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/misc/0813/FVG偵測修正.txt |
| misc/0813/FVG偵測修正2.txt | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/misc/0813/FVG偵測修正2.txt |
| misc/0813/FVG偵測修正3.txt | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/misc/0813/FVG偵測修正3.txt |
| misc/0813/FVG偵測修正3_回應.txt | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/misc/0813/FVG偵測修正3_回應.txt |

### 2025-08-14 記錄
| 檔案 | GitHub URL |
|------|-----------|
| misc/0814/FVG修正.txt | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/misc/0814/FVG修正.txt |
| misc/0814/FVG修正2.txt | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/misc/0814/FVG修正2.txt |
| misc/0814/FVG修正3.txt | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/misc/0814/FVG修正3.txt |
| misc/0814/FVG修正4.txt | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/misc/0814/FVG修正4.txt |
| misc/0814/FVG規則v2.txt | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/misc/0814/FVG規則v2.txt |
| misc/0814/FVG規則V3.txt | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/misc/0814/FVG規則V3.txt |
| misc/0814/重構.txt | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/misc/0814/重構.txt |
| misc/0814/專案檔案清單與URL.md | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/misc/0814/專案檔案清單與URL.md |

### 其他
| 檔案 | GitHub URL |
|------|-----------|
| misc/新文字文件.txt | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/misc/新文字文件.txt |

## 系統配置檔案

| 檔案 | GitHub URL |
|------|-----------|
| .claude/settings.local.json | https://raw.githubusercontent.com/druidtom3/trading-chart-system/main/.claude/settings.local.json |

---

## 使用說明

1. **主要入口**: `src/frontend/index-v2.html` - 最新版本的前端界面
2. **後端服務**: `src/backend/app.py` - Flask API服務器
3. **配置檔案**: `src/utils/config.py` - 系統配置參數
4. **FVG檢測**: `src/backend/fvg_detector_v3.py` - 最新V3版FVG檢測器

## 最新版本功能

- **改進的FVG自定義渲染器**: 解決縮放問題的完整矩形渲染
- **DPI縮放支援**: 適應高解析度螢幕的精確座標轉換
- **V3 FVG檢測**: 簡化精準的檢測邏輯
- **左側技術指標面板**: 改善的UI布局
- **最小高度過濾**: 過濾太小的FVG (≥1.0點)
- **回退機制**: 確保不同瀏覽器的相容性
- **性能優化**: 跳過螢幕外FVG渲染

## 最新更新 (2025-08-14)

### 新增檔案
- `src/frontend/fvg-custom-series.js` - 改進的自定義FVG渲染器
- `misc/0814/FVG修正2.txt` - 矩形渲染分析
- `misc/0814/FVG修正3.txt` - 自定義渲染器完整實現
- `misc/0814/FVG修正4.txt` - 最佳解決方案：改進的方案3

### 主要改進
- 修復FVG縮放時位置不準確問題
- 實現真正的矩形填充 (非三線組合)
- 加入DPI縮放與座標轉換
- 修復後端API缺少欄位問題

生成時間: 2025-08-14
最新Git提交: 93076d4