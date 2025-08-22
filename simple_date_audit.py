#!/usr/bin/env python3
"""
簡化版日期範圍審計工具
"""

import os
import sys
import pandas as pd
from datetime import datetime, date
from pathlib import Path

# 模擬配置
DATA_DIR = 'data'
CSV_FILES = {
    'M1': 'MNQ_M1_2019-2024.csv',
    'M5': 'MNQ_M5_2019-2024.csv', 
    'M15': 'MNQ_M15_2019-2024.csv',
    'H1': 'MNQ_H1_2019-2024.csv',
    'H4': 'MNQ_H4_2019-2024.csv',
    'D1': 'MNQ_D1_2019-2024.csv'
}

def audit_date_ranges():
    """審計所有數據文件的日期範圍"""
    print("=" * 60)
    print("隨機日期範圍審計報告")
    print("=" * 60)
    
    data_dir = Path(DATA_DIR)
    print(f"\n數據目錄: {data_dir.absolute()}")
    print(f"檢查 {len(CSV_FILES)} 個時間框架文件:")
    
    file_date_ranges = {}
    intersection_dates = None
    
    # 檢查每個文件
    for timeframe, filename in CSV_FILES.items():
        filepath = data_dir / filename
        print(f"\n[{timeframe}] {filename}")
        
        if not filepath.exists():
            print(f"   文件不存在: {filepath}")
            continue
            
        try:
            file_size = filepath.stat().st_size / (1024 * 1024)  # MB
            print(f"   文件大小: {file_size:.1f} MB")
            
            # 讀取前幾行檢查結構
            df_sample = pd.read_csv(filepath, nrows=5)
            print(f"   欄位: {list(df_sample.columns)}")
            
            # 讀取完整文件
            df = pd.read_csv(filepath)
            print(f"   總記錄數: {len(df):,} 筆")
            
            # 檢查必要欄位
            if 'Date' not in df.columns:
                print(f"   錯誤: 缺少 Date 欄位")
                continue
            
            # 創建 Date_Only 欄位
            df['Date_Only'] = pd.to_datetime(df['Date']).dt.date
            
            # 獲取日期範圍
            unique_dates = set(df['Date_Only'].unique())
            min_date = min(unique_dates)
            max_date = max(unique_dates)
            date_count = len(unique_dates)
            
            file_date_ranges[timeframe] = {
                'dates': unique_dates,
                'min_date': min_date,
                'max_date': max_date,
                'count': date_count
            }
            
            print(f"   日期範圍: {min_date} ~ {max_date}")
            print(f"   可用交易日: {date_count:,} 天")
            
            # 計算交集
            if intersection_dates is None:
                intersection_dates = unique_dates.copy()
                print(f"   初始化日期集合: {len(intersection_dates):,} 天")
            else:
                old_count = len(intersection_dates)
                intersection_dates &= unique_dates  # 取交集
                new_count = len(intersection_dates)
                print(f"   更新交集: {old_count:,} -> {new_count:,} 天")
                
        except Exception as e:
            print(f"   錯誤: {e}")
            
    # 最終報告
    print("\n" + "=" * 60)
    print("最終審計結果")
    print("=" * 60)
    
    if not file_date_ranges:
        print("錯誤: 沒有成功載入任何數據文件")
        return
        
    print(f"\n成功載入的時間框架: {len(file_date_ranges)} 個")
    
    # 各時間框架詳情
    print(f"\n各時間框架日期範圍:")
    for timeframe, info in file_date_ranges.items():
        print(f"   {timeframe:>3}: {info['min_date']} ~ {info['max_date']} ({info['count']:,} 天)")
        
    # 交集分析 (這就是隨機日期的來源!)
    print(f"\n隨機日期範圍 (所有時間框架的交集):")
    if intersection_dates:
        sorted_dates = sorted(list(intersection_dates))
        min_date = sorted_dates[0]
        max_date = sorted_dates[-1]
        total_days = len(sorted_dates)
        
        print(f"   範圍: {min_date} ~ {max_date}")
        print(f"   可用天數: {total_days:,} 天")
        
        # 顯示前10個日期作為樣本
        print(f"\n前10個可用日期:")
        for i, date_obj in enumerate(sorted_dates[:10]):
            print(f"      {i+1:2d}. {date_obj}")
            
        print(f"\n最後10個可用日期:")
        for i, date_obj in enumerate(sorted_dates[-10:]):
            print(f"      {len(sorted_dates)-10+i+1:2d}. {date_obj}")
            
    else:
        print("   錯誤: 沒有共同的可用日期!")
        
    # 關鍵發現
    print(f"\n" + "=" * 60)
    print("關鍵發現")
    print("=" * 60)
    print("1. 隨機日期範圍 = 所有時間框架文件日期的交集")
    print("2. 只有在所有CSV文件中都存在的日期才能被隨機選擇")
    print("3. 如果某個時間框架缺少特定日期，該日期就不會出現在隨機範圍中")

if __name__ == "__main__":
    audit_date_ranges()