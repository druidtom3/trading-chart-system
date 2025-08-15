# 檔名：app.py

from flask import Flask, jsonify, send_from_directory, request
from flask_cors import CORS
import os
import sys

# 加入專案路徑到 Python path
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(os.path.dirname(current_dir))
src_dir = os.path.join(project_root, 'src')
sys.path.insert(0, src_dir)

from utils.config import FLASK_HOST, FLASK_PORT, FLASK_DEBUG, PROJECT_ROOT
from backend.data_processor import DataProcessor

app = Flask(__name__)
CORS(app)

# 全域資料處理器和狀態管理
data_processor = DataProcessor()
loading_status = {
    'is_loading': True,
    'progress': 0,
    'current_step': '準備載入資料...',
    'total_steps': 6,
    'completed_steps': 0,
    'error': None
}

# API健康檢查端點
@app.route('/api/health', methods=['GET'])
def health_check():
    """健康檢查端點"""
    return jsonify({
        'status': 'healthy',
        'service': 'trading-chart-backend',
        'port': FLASK_PORT,
        'data_loaded': not loading_status['is_loading'],
        'loading_progress': loading_status['progress'],
        'current_step': loading_status['current_step'],
        'timestamp': str(__import__('datetime').datetime.now())
    }), 200

@app.route('/')
def index():
    """主頁面"""
    frontend_dir = os.path.join(PROJECT_ROOT, 'src', 'frontend')
    return send_from_directory(frontend_dir, 'index-v2.html')

@app.route('/<path:filename>')
def static_files(filename):
    """靜態檔案服務"""
    frontend_dir = os.path.join(PROJECT_ROOT, 'src', 'frontend')
    return send_from_directory(frontend_dir, filename)

@app.route('/api/random-data')
def get_random_data():
    """取得隨機日期的開盤前資料"""
    try:
        # 取得時間刻度參數（預設為 H4）
        timeframe = request.args.get('timeframe', 'M15')
        
        # 驗證時間刻度是否有效
        available_timeframes = data_processor.get_available_timeframes()
        if timeframe not in available_timeframes:
            timeframe = 'H4'  # 回到預設值
        
        print(f"API: 隨機資料請求，時間刻度: {timeframe}")
        
        # 隨機選擇日期
        random_date = data_processor.get_random_date()
        
        # 使用指定的時間刻度
        data = data_processor.get_pre_market_data(random_date, timeframe)
        
        if data is None:
            return jsonify({'error': '無法取得資料'}), 500
        
        return jsonify(data)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/data/<date>/<timeframe>')
def get_specific_data(date, timeframe):
    """取得指定日期和時間刻度的資料"""
    try:
        from datetime import datetime
        target_date = datetime.strptime(date, '%Y-%m-%d').date()
        
        data = data_processor.get_pre_market_data(target_date, timeframe)
        
        if data is None:
            return jsonify({'error': '無法取得指定資料'}), 404
        
        return jsonify(data)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/timeframes')
def get_timeframes():
    """取得可用的時間刻度"""
    return jsonify(data_processor.get_available_timeframes())

@app.route('/api/playback-data/<date>/<timeframe>')
def get_playback_data(date, timeframe):
    """取得指定日期的完整交易資料（用於播放）"""
    try:
        from datetime import datetime
        target_date = datetime.strptime(date, '%Y-%m-%d').date()
        
        data = data_processor.get_market_hours_data(target_date, timeframe)
        
        if data is None:
            return jsonify({'error': '無法取得播放資料'}), 404
        
        return jsonify(data)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
@app.route('/api/m1-playback-data/<date>')
def get_m1_playback_data(date):
    """取得指定日期的 M1 完整交易資料（作為播放基礎）"""
    try:
        from datetime import datetime
        target_date = datetime.strptime(date, '%Y-%m-%d').date()
        
        # 強制使用 M1 資料
        data = data_processor.get_market_hours_data(target_date, 'M1')
        
        if data is None:
            return jsonify({'error': '無法取得 M1 播放資料'}), 404
        
        return jsonify(data)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/continuity-summary')
def get_continuity_summary():
    """取得所有時間框架的K線連續性摘要"""
    try:
        summary = data_processor.get_continuity_summary()
        return jsonify(summary)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/continuity-report/<timeframe>')
def get_continuity_report(timeframe):
    """取得特定時間框架的詳細連續性報告"""
    try:
        report = data_processor.get_continuity_report(timeframe)
        if report is None:
            return jsonify({'error': f'找不到時間框架 {timeframe} 的連續性報告'}), 404
        return jsonify(report)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/date-continuity/<date>/<timeframe>')
def get_date_continuity(date, timeframe):
    """檢查特定日期和時間框架的K線連續性"""
    try:
        from datetime import datetime
        target_date = datetime.strptime(date, '%Y-%m-%d').date()
        
        result = data_processor.check_date_continuity(target_date, timeframe)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/loading-status')
def get_loading_status():
    """取得載入狀態"""
    return jsonify(loading_status)

def update_loading_status(step, progress, current_step):
    """更新載入狀態"""
    global loading_status
    loading_status.update({
        'completed_steps': step,
        'progress': progress,
        'current_step': current_step
    })

if __name__ == '__main__':
    print("=== 交易圖表系統啟動中 ===")
    
    # 更新載入狀態
    update_loading_status(0, 0, "開始載入資料...")
    
    # 載入資料
    try:
        data_processor.load_all_data()
        # 載入完成
        loading_status.update({
            'is_loading': False,
            'progress': 100,
            'current_step': '載入完成',
            'completed_steps': 6
        })
    except Exception as e:
        loading_status.update({
            'is_loading': False,
            'error': str(e),
            'current_step': f'載入失敗: {str(e)}'
        })
    
    print(f"伺服器啟動於: http://{FLASK_HOST}:{FLASK_PORT}")
    print("請在瀏覽器開啟上述網址")
    print("按 Ctrl+C 停止伺服器")
    
    app.run(host=FLASK_HOST, port=FLASK_PORT, debug=FLASK_DEBUG)