# PatternWeaver 交易圖表系統

## 專案簡介
PatternWeaver 是一個專業的交易圖表分析系統，提供歷史資料回放、多時間刻度切換、以及動態 K 線生成功能。系統專注於 MNQ（微型那斯達克期貨）的「紐約開盤前五分鐘」分析。

## 主要功能
- 隨機選擇歷史交易日進行分析
- 支援 6 種時間刻度（M1/M5/M15/H1/H4/D1）
- 動態播放功能，模擬真實交易環境
- TradingView 風格的專業圖表介面
- 自動處理夏令時/冬令時轉換

## 技術架構
- **後端**：Python Flask + Pandas
- **前端**：原生 JavaScript + TradingView Lightweight Charts
- **資料**：CSV 格式歷史交易資料

## 快速開始
1. 確保已安裝 Python 3.8+
2. 安裝依賴：`pip install flask flask-cors pandas pytz`
3. 執行 `python src/backend/app.py` 啟動系統
4. 開啟瀏覽器訪問 `http://127.0.0.1:5000`

## 資料需求
請將以下 CSV 檔案放置於 `data` 資料夾：
- MNQ_M1_2019-2024.csv
- MNQ_M5_2019-2024.csv
- MNQ_M15_2019-2024.csv
- MNQ_H1_2019-2024.csv
- MNQ_H4_2019-2024.csv
- MNQ_D1_2019-2024.csv

## 開發狀態
- 第一階段：基礎功能完成
- 第二階段：動態 K 線生成完成
- 第三階段：技術指標開發中