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
    'current_file': '',
    'current_file_progress': 0,
    'error': None,
    'estimated_time_remaining': None,
    'start_time': None,
    'details': []
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

@app.route('/api/loading-status', methods=['GET'])
def get_loading_status():
    """獲取詳細載入狀態"""
    status = loading_status.copy()
    
    # 計算預估剩餘時間
    if status['start_time'] and status['progress'] > 0:
        import datetime
        elapsed = (datetime.datetime.now() - status['start_time']).total_seconds()
        if status['progress'] > 5:  # 避免除零錯誤
            estimated_total = elapsed / (status['progress'] / 100)
            remaining = max(0, estimated_total - elapsed)
            status['estimated_time_remaining'] = int(remaining)
    
    return jsonify(status), 200

@app.route('/')
def index():
    """主頁面"""
    frontend_dir = os.path.join(PROJECT_ROOT, 'src', 'frontend')
    return send_from_directory(frontend_dir, 'index-v2.html')

@app.route('/debug')
def debug_loading():
    """載入調試頁面"""
    return send_from_directory(PROJECT_ROOT, 'debug_loading.html')

@app.route('/simple')
def simple_index():
    """簡化版主頁面"""
    frontend_dir = os.path.join(PROJECT_ROOT, 'src', 'frontend')
    return send_from_directory(frontend_dir, 'index-simple.html')

@app.route('/<path:filename>')
def static_files(filename):
    """靜態檔案服務"""
    frontend_dir = os.path.join(PROJECT_ROOT, 'src', 'frontend')
    return send_from_directory(frontend_dir, filename)

@app.route('/api/random-data')
def get_random_data():
    """取得隨機日期的開盤前資料"""
    try:
        import numpy as np
        
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
        
        # 確保所有數據都是JSON可序列化的
        def convert_to_serializable(obj):
            if isinstance(obj, np.integer):
                return int(obj)
            elif isinstance(obj, np.floating):
                return float(obj)
            elif isinstance(obj, np.ndarray):
                return obj.tolist()
            elif isinstance(obj, dict):
                return {k: convert_to_serializable(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [convert_to_serializable(v) for v in obj]
            return obj
        
        serializable_data = convert_to_serializable(data)
        return jsonify(serializable_data)
    
    except Exception as e:
        import traceback
        print(f"API錯誤: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/data/<date>/<timeframe>')
def get_specific_data(date, timeframe):
    """取得指定日期和時間刻度的資料"""
    # Debug output for API calls
    print(f"API Request: {date}/{timeframe}")
    
    try:
        from datetime import datetime
        import json
        import numpy as np
        
        target_date = datetime.strptime(date, '%Y-%m-%d').date()
        data = data_processor.get_pre_market_data(target_date, timeframe)
        
        if data is None:
            print(f"No data available for {date}/{timeframe}")
        
        if data is None:
            return jsonify({'error': '無法取得指定資料'}), 404
        
        # 確保所有數據都是JSON可序列化的
        def convert_to_serializable(obj):
            if isinstance(obj, np.integer):
                return int(obj)
            elif isinstance(obj, np.floating):
                return float(obj)
            elif isinstance(obj, np.ndarray):
                return obj.tolist()
            elif isinstance(obj, dict):
                return {k: convert_to_serializable(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [convert_to_serializable(v) for v in obj]
            return obj
        
        serializable_data = convert_to_serializable(data)
        return jsonify(serializable_data)
    
    except Exception as e:
        import traceback
        print(f"API錯誤: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/timeframes')
def get_timeframes():
    """取得可用的時間刻度"""
    return jsonify(data_processor.get_available_timeframes())

@app.route('/api/date-range')
def get_date_range():
    """取得可用日期範圍詳細信息"""
    try:
        if not data_processor.available_dates:
            return jsonify({'error': '數據未載入'}), 500
        
        dates_list = sorted(list(data_processor.available_dates))
        from utils.config import RANDOM_DATE_CONFIG
        
        return jsonify({
            'min_date': str(dates_list[0]),
            'max_date': str(dates_list[-1]),
            'total_days': len(dates_list),
            'sample_dates': [str(d) for d in dates_list[:10]],
            'recent_dates': [str(d) for d in dates_list[-10:]],
            'config': RANDOM_DATE_CONFIG,
            'note': 'D1數據缺少255天週末和節假日，M1/M5使用優化載入模式'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/playback-data/<date>/<timeframe>')
def get_playback_data(date, timeframe):
    """取得指定日期的完整交易資料（用於播放）"""
    try:
        from datetime import datetime
        import numpy as np
        
        target_date = datetime.strptime(date, '%Y-%m-%d').date()
        
        data = data_processor.get_market_hours_data(target_date, timeframe)
        
        if data is None:
            return jsonify({'error': '無法取得播放資料'}), 404
        
        # 確保所有數據都是JSON可序列化的
        def convert_to_serializable(obj):
            if isinstance(obj, np.integer):
                return int(obj)
            elif isinstance(obj, np.floating):
                return float(obj)
            elif isinstance(obj, np.ndarray):
                return obj.tolist()
            elif isinstance(obj, dict):
                return {k: convert_to_serializable(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [convert_to_serializable(v) for v in obj]
            return obj
        
        serializable_data = convert_to_serializable(data)
        return jsonify(serializable_data)
    
    except Exception as e:
        import traceback
        print(f"API錯誤: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500
    
@app.route('/api/m1-playback-data/<date>')
def get_m1_playback_data(date):
    """取得指定日期的 M1 完整交易資料（作為播放基礎）"""
    try:
        from datetime import datetime
        import numpy as np
        
        target_date = datetime.strptime(date, '%Y-%m-%d').date()
        
        # 強制使用 M1 資料
        data = data_processor.get_market_hours_data(target_date, 'M1')
        
        if data is None:
            return jsonify({'error': '無法取得 M1 播放資料'}), 404
        
        # 確保所有數據都是JSON可序列化的
        def convert_to_serializable(obj):
            if isinstance(obj, np.integer):
                return int(obj)
            elif isinstance(obj, np.floating):
                return float(obj)
            elif isinstance(obj, np.ndarray):
                return obj.tolist()
            elif isinstance(obj, dict):
                return {k: convert_to_serializable(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [convert_to_serializable(v) for v in obj]
            return obj
        
        serializable_data = convert_to_serializable(data)
        return jsonify(serializable_data)
    
    except Exception as e:
        import traceback
        print(f"API錯誤: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")
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

@app.route('/api/clear-cache')
def clear_cache():
    """清除API響應緩存"""
    try:
        data_processor._response_cache.clear()
        data_processor._processed_data_cache.clear()
        return jsonify({'message': 'Cache cleared successfully', 'status': 'success'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


def update_loading_status(**kwargs):
    """更新載入狀態"""
    global loading_status
    loading_status.update(kwargs)

if __name__ == '__main__':
    print("=== 交易圖表系統啟動中 ===")
    
    # 設置載入狀態回調
    data_processor.set_loading_callback(update_loading_status)
    
    # 載入資料
    try:
        data_processor.load_all_data()
        # 載入完成
        update_loading_status(
            is_loading=False,
            progress=100,
            current_step='載入完成',
            completed_steps=6
        )
    except Exception as e:
        update_loading_status(
            is_loading=False,
            error=str(e),
            current_step=f'載入失敗: {str(e)}'
        )
    
    print(f"伺服器啟動於: http://{FLASK_HOST}:{FLASK_PORT}")
    print("請在瀏覽器開啟上述網址")
    print("按 Ctrl+C 停止伺服器")
    
    app.run(host=FLASK_HOST, port=FLASK_PORT, debug=FLASK_DEBUG)