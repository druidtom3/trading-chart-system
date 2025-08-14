#!/usr/bin/env python3
# 測試K線連續性檢查功能

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

import pandas as pd
from datetime import datetime, date
from src.backend.candle_continuity_checker import CandleContinuityChecker

def test_continuity_checker():
    """測試連續性檢查器"""
    print("=== K線連續性檢查測試 ===")
    
    # 創建測試數據：有一些間隙的M5數據
    test_data = []
    base_time = datetime(2023, 1, 1, 9, 0)  # 9:00開始
    
    # 正常的前5根K線
    for i in range(5):
        test_data.append({
            'DateTime': base_time + pd.Timedelta(minutes=5*i),
            'Open': 100.0 + i,
            'High': 102.0 + i,
            'Low': 99.0 + i,
            'Close': 101.0 + i,
            'Volume': 1000 + i*100
        })
    
    # 跳過2根K線（製造10分鐘間隙）
    # 繼續添加3根K線
    for i in range(3):
        test_data.append({
            'DateTime': base_time + pd.Timedelta(minutes=5*(7+i)),  # 跳過了5,6
            'Open': 105.0 + i,
            'High': 107.0 + i,
            'Low': 104.0 + i,
            'Close': 106.0 + i,
            'Volume': 1500 + i*100
        })
    
    # 創建DataFrame
    df = pd.DataFrame(test_data)
    
    print(f"測試數據: {len(df)} 根K線")
    print(f"時間範圍: {df['DateTime'].min()} ~ {df['DateTime'].max()}")
    print()
    
    # 創建檢查器
    checker = CandleContinuityChecker()
    
    # 執行檢查
    print("執行連續性檢查...")
    result = checker.check_continuity(df, 'M5')
    
    # 顯示結果
    print(f"檢查狀態: {result['status']}")
    if result['status'] == 'completed':
        summary = result['summary']
        print(f"總K線數: {summary['total_candles']}")
        print(f"連續性: {summary['continuity_percentage']:.1f}%")
        print(f"間隙數量: {summary['total_gaps']}")
        print(f"缺失K線: {summary['total_missing_candles']}")
        
        if result['gaps']:
            print("\n發現的間隙:")
            for i, gap in enumerate(result['gaps']):
                print(f"  {i+1}. {gap['start_time']} ~ {gap['end_time']}")
                print(f"     缺失: {gap['missing_candles']} 根K線")
        
        print("\n建議:")
        for rec in result['recommendations']:
            print(f"  - {rec}")
    
    # 測試快速檢查
    print(f"\n快速檢查結果: {checker.quick_check(df, 'M5')}")
    
    return result

def test_with_real_data():
    """使用實際數據測試（如果可用）"""
    print("\n=== 實際數據測試 ===")
    
    try:
        from src.backend.data_processor import DataProcessor
        from src.utils.config import DATA_DIR, CSV_FILES
        
        # 嘗試載入M5數據的一小部分
        m5_file = os.path.join(DATA_DIR, CSV_FILES.get('M5', ''))
        if os.path.exists(m5_file):
            print(f"讀取文件: {m5_file}")
            # 只讀取前1000行來測試
            df = pd.read_csv(m5_file, nrows=1000)
            
            # 處理時間欄位
            df['DateTime'] = pd.to_datetime(df['Date'] + ' ' + df['Time'], 
                                          format='%m/%d/%Y %H:%M')
            df = df.sort_values('DateTime').reset_index(drop=True)
            
            print(f"載入了 {len(df)} 根K線")
            print(f"時間範圍: {df['DateTime'].min()} ~ {df['DateTime'].max()}")
            
            # 檢查連續性
            checker = CandleContinuityChecker()
            result = checker.check_continuity(df, 'M5')
            
            if result['status'] == 'completed':
                summary = result['summary']
                print(f"連續性: {summary['continuity_percentage']:.1f}%")
                print(f"間隙數量: {summary['total_gaps']}")
                print(f"缺失K線: {summary['total_missing_candles']}")
                
                if summary['total_gaps'] > 0:
                    print(f"前3個間隙:")
                    for i, gap in enumerate(result['gaps'][:3]):
                        print(f"  {i+1}. {gap['start_time']} ~ {gap['end_time']} (缺失: {gap['missing_candles']})")
            
        else:
            print(f"找不到數據文件: {m5_file}")
            
    except Exception as e:
        print(f"實際數據測試失敗: {str(e)}")

if __name__ == '__main__':
    # 執行測試
    test_continuity_checker()
    test_with_real_data()
    
    print("\n=== 測試完成 ===")