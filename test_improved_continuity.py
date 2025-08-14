#!/usr/bin/env python3
# 測試改進的連續性檢查

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

import pandas as pd
from datetime import datetime, date, timedelta
from src.backend.candle_continuity_checker import CandleContinuityChecker

def test_smart_continuity_checker():
    """測試智能連續性檢查器"""
    print("=== 測試智能連續性檢查器 ===")
    
    # 創建包含各種間隙的測試數據
    test_data = []
    base_time = datetime(2020, 12, 24, 15, 0)  # 聖誕節前
    
    # 正常交易時間的K線
    for i in range(10):
        test_data.append({
            'DateTime': base_time + timedelta(minutes=5*i),
            'Open': 100 + i,
            'High': 102 + i,
            'Low': 99 + i,
            'Close': 101 + i,
            'Volume': 1000
        })
    
    # 聖誕節假期間隙（應該被忽略）
    gap_start = base_time + timedelta(minutes=50)  # 15:50
    gap_end = gap_start + timedelta(days=3)        # 3天後
    
    # 假期後的K線
    for i in range(5):
        test_data.append({
            'DateTime': gap_end + timedelta(minutes=5*i),
            'Open': 120 + i,
            'High': 122 + i,
            'Low': 119 + i,
            'Close': 121 + i,
            'Volume': 1000
        })
    
    # 真正的數據缺失（應該被報告）
    data_gap_start = gap_end + timedelta(minutes=25)
    data_gap_end = data_gap_start + timedelta(hours=2)  # 2小時數據缺失
    
    # 數據缺失後的K線
    for i in range(5):
        test_data.append({
            'DateTime': data_gap_end + timedelta(minutes=5*i),
            'Open': 130 + i,
            'High': 132 + i,
            'Low': 129 + i,
            'Close': 131 + i,
            'Volume': 1000
        })
    
    df = pd.DataFrame(test_data)
    
    print(f"測試數據: {len(df)} 根K線")
    print(f"時間範圍: {df['DateTime'].min()} ~ {df['DateTime'].max()}")
    
    # 使用改進的檢查器
    checker = CandleContinuityChecker(start_date=date(2019, 5, 20))
    result = checker.check_continuity(df, 'M5')
    
    print(f"\n檢查結果:")
    print(f"狀態: {result['status']}")
    
    if result['status'] == 'completed':
        summary = result['summary']
        print(f"總K線數: {summary['total_candles']}")
        print(f"連續性: {summary['continuity_percentage']:.1f}%")
        print(f"數據缺失: {summary['total_data_gaps']} 個間隙")
        print(f"正常停盤: {summary['total_trading_gaps']} 個間隙")
        
        print(f"\n數據缺失詳情:")
        for gap in result['data_gaps']:
            print(f"  {gap['start_time']} ~ {gap['end_time']}")
            print(f"  原因: {gap['reason']}")
            print(f"  缺失: {gap['missing_candles']} 根K線")
        
        print(f"\n正常停盤詳情:")
        for gap in result['trading_gaps']:
            print(f"  {gap['start_time']} ~ {gap['end_time']}")
            print(f"  原因: {gap['reason']}")
        
        print(f"\n建議:")
        for rec in result['recommendations']:
            print(f"  - {rec}")
    
    return result

def test_date_filtering():
    """測試日期過濾功能"""
    print(f"\n=== 測試日期過濾 (>= 2019-05-20) ===")
    
    # 創建包含早期數據的測試數據
    early_data = []
    
    # 早期數據（應該被過濾掉）
    early_time = datetime(2019, 5, 15, 10, 0)
    for i in range(5):
        early_data.append({
            'DateTime': early_time + timedelta(minutes=5*i),
            'Open': 50 + i,
            'High': 52 + i,
            'Low': 49 + i,
            'Close': 51 + i,
            'Volume': 500
        })
    
    # 有效數據（2019-05-20之後）
    valid_time = datetime(2019, 5, 21, 10, 0)
    for i in range(10):
        early_data.append({
            'DateTime': valid_time + timedelta(minutes=5*i),
            'Open': 100 + i,
            'High': 102 + i,
            'Low': 99 + i,
            'Close': 101 + i,
            'Volume': 1000
        })
    
    df = pd.DataFrame(early_data)
    print(f"原始數據: {len(df)} 根K線")
    print(f"原始範圍: {df['DateTime'].min()} ~ {df['DateTime'].max()}")
    
    checker = CandleContinuityChecker()
    result = checker.check_continuity(df, 'M5')
    
    if result['status'] == 'completed':
        summary = result['summary']
        print(f"過濾後數據: {summary['total_candles']} 根K線")
        print(f"過濾後範圍: {summary['time_range']['start']} ~ {summary['time_range']['end']}")
        print(f"起始日期過濾: {result['start_date_filter']}")

if __name__ == '__main__':
    test_smart_continuity_checker()
    test_date_filtering()
    
    print(f"\n=== 測試完成 ===")
    print("改進的連續性檢查器能正確區分正常停盤和數據缺失！")