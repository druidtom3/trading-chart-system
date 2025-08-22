#!/usr/bin/env python3
"""
隨機日期範圍審計工具
檢查系統中可用日期範圍的定義和實際範圍
"""

import os
import sys
import pandas as pd
from datetime import datetime, date
from pathlib import Path

# 添加後端路徑
sys.path.append('src/backend')
sys.path.append('src')

try:
    from utils.config import DATA_DIR, CSV_FILES
except ImportError:
    # 如果無法導入配置，使用默認值
    DATA_DIR = 'data'
    CSV_FILES = {
        'M1': 'MNQ_M1_2019-2024.csv',
        'M5': 'MNQ_M5_2019-2024.csv', 
        'M15': 'MNQ_M15_2019-2024.csv',
        'H1': 'MNQ_H1_2019-2024.csv',
        'H4': 'MNQ_H4_2019-2024.csv',
        'D1': 'MNQ_D1_2019-2024.csv'
    }

class DateRangeAuditor:
    def __init__(self):
        self.data_dir = Path(DATA_DIR)
        self.csv_files = CSV_FILES
        self.file_date_ranges = {}
        self.intersection_dates = None
        
    def audit_date_ranges(self):
        """審計所有數據文件的日期範圍"""
        print("=" * 80)
        print("隨機日期範圍審計報告")
        print("=" * 80)
        
        print(f"\n數據目錄: {self.data_dir.absolute()}")
        print(f"檢查 {len(self.csv_files)} 個時間框架文件:")
        
        # 檢查每個文件
        for timeframe, filename in self.csv_files.items():
            filepath = self.data_dir / filename
            print(f"\n⏰ {timeframe} 時間框架: {filename}")
            
            if not filepath.exists():
                print(f"   ❌ 文件不存在: {filepath}")
                continue
                
            try:
                file_size = filepath.stat().st_size / (1024 * 1024)  # MB
                print(f"   📏 文件大小: {file_size:.1f} MB")
                
                # 讀取文件並分析日期
                df = pd.read_csv(filepath)
                print(f"   📊 總記錄數: {len(df):,} 筆")
                
                # 檢查必要欄位
                if 'Date' not in df.columns:
                    print(f"   ❌ 缺少 Date 欄位")
                    continue
                
                # 創建 Date_Only 欄位（模擬系統邏輯）
                if 'Time' in df.columns:
                    df['Date_Only'] = pd.to_datetime(df['Date']).dt.date
                else:
                    df['Date_Only'] = pd.to_datetime(df['Date']).dt.date
                
                # 獲取日期範圍
                unique_dates = set(df['Date_Only'].unique())
                min_date = min(unique_dates)
                max_date = max(unique_dates)
                date_count = len(unique_dates)
                
                self.file_date_ranges[timeframe] = {
                    'dates': unique_dates,
                    'min_date': min_date,
                    'max_date': max_date,
                    'count': date_count,
                    'file_size_mb': file_size,
                    'total_records': len(df)
                }
                
                print(f"   📅 日期範圍: {min_date} ~ {max_date}")
                print(f"   📈 可用交易日: {date_count:,} 天")
                print(f"   ✅ 載入成功")
                
                # 計算交集
                if self.intersection_dates is None:
                    self.intersection_dates = unique_dates.copy()
                    print(f"   🔄 初始化日期集合: {len(self.intersection_dates):,} 天")
                else:
                    old_count = len(self.intersection_dates)
                    self.intersection_dates &= unique_dates  # 取交集
                    new_count = len(self.intersection_dates)
                    print(f"   🔄 更新交集: {old_count:,} -> {new_count:,} 天")
                    
            except Exception as e:
                print(f"   ❌ 處理失敗: {e}")
                
        # 生成最終報告
        self.generate_final_report()
        
    def generate_final_report(self):
        """生成最終審計報告"""
        print("\n" + "=" * 80)
        print("📋 最終審計報告")
        print("=" * 80)
        
        if not self.file_date_ranges:
            print("❌ 沒有成功載入任何數據文件")
            return
            
        print(f"\n✅ 成功載入的時間框架: {len(self.file_date_ranges)} 個")
        
        # 各時間框架詳情
        print(f"\n📊 各時間框架日期範圍:")
        for timeframe, info in self.file_date_ranges.items():
            print(f"   {timeframe:>3}: {info['min_date']} ~ {info['max_date']} ({info['count']:,} 天)")
            
        # 交集分析
        print(f"\n🎯 隨機日期範圍 (所有時間框架的交集):")
        if self.intersection_dates:
            sorted_dates = sorted(list(self.intersection_dates))
            min_date = sorted_dates[0]
            max_date = sorted_dates[-1]
            total_days = len(sorted_dates)
            
            print(f"   📅 範圍: {min_date} ~ {max_date}")
            print(f"   📈 可用天數: {total_days:,} 天")
            print(f"   📍 最早日期: {min_date}")
            print(f"   📍 最晚日期: {max_date}")
            
            # 計算覆蓋率
            total_span = (max_date - min_date).days + 1
            coverage = (total_days / total_span) * 100 if total_span > 0 else 0
            print(f"   📊 覆蓋率: {coverage:.1f}% ({total_days}/{total_span} 天)")
            
            # 顯示樣本日期
            print(f"\n📝 樣本日期 (前10個):")
            for i, date_obj in enumerate(sorted_dates[:10]):
                print(f"      {i+1:2d}. {date_obj}")
                
            if total_days > 10:
                print(f"   ... 省略 {total_days-10} 個日期")
                
        else:
            print("   ❌ 沒有共同的可用日期！")
            
        # 檢查數據一致性
        self.check_data_consistency()
        
    def check_data_consistency(self):
        """檢查數據一致性"""
        print(f"\n🔍 數據一致性檢查:")
        
        if len(self.file_date_ranges) == 0:
            print("   ❌ 沒有數據可檢查")
            return
            
        # 檢查是否所有文件都有相同的日期範圍
        all_min_dates = [info['min_date'] for info in self.file_date_ranges.values()]
        all_max_dates = [info['max_date'] for info in self.file_date_ranges.values()]
        
        min_of_min = min(all_min_dates)
        max_of_min = max(all_min_dates)
        min_of_max = min(all_max_dates)
        max_of_max = max(all_max_dates)
        
        print(f"   📅 最早開始日期: {min_of_min}")
        print(f"   📅 最晚開始日期: {max_of_min}")
        print(f"   📅 最早結束日期: {min_of_max}")
        print(f"   📅 最晚結束日期: {max_of_max}")
        
        if min_of_min == max_of_min and min_of_max == max_of_max:
            print("   ✅ 所有時間框架具有相同的日期範圍")
        else:
            print("   ⚠️  不同時間框架具有不同的日期範圍")
            
        # 交集損失分析
        if self.intersection_dates:
            max_possible = max(len(info['dates']) for info in self.file_date_ranges.values())
            actual_intersection = len(self.intersection_dates)
            loss_percentage = ((max_possible - actual_intersection) / max_possible * 100) if max_possible > 0 else 0
            
            print(f"   📊 最大可能日期數: {max_possible:,}")
            print(f"   📊 實際交集日期數: {actual_intersection:,}")
            print(f"   📉 交集損失: {loss_percentage:.1f}%")
            
    def recommend_improvements(self):
        """建議改進措施"""
        print(f"\n💡 建議改進措施:")
        
        if not self.intersection_dates:
            print("   🔧 重要：沒有共同日期，需要檢查數據文件")
            print("   🔧 建議：確保所有時間框架文件包含相同的日期範圍")
            return
            
        # 檢查是否有明確的範圍配置
        print("   🔧 當前使用交集邏輯，隨機日期範圍取決於所有文件的共同日期")
        print("   🔧 建議：在配置文件中明確定義隨機日期範圍")
        print("   🔧 建議：添加 API 端點來查詢可用日期範圍")
        print("   🔧 建議：定期檢查數據完整性和日期範圍")

def main():
    """主函數"""
    auditor = DateRangeAuditor()
    
    try:
        auditor.audit_date_ranges()
        auditor.recommend_improvements()
        
    except KeyboardInterrupt:
        print("\n\n⏹️  審計被用戶中斷")
    except Exception as e:
        print(f"\n❌ 審計過程中發生錯誤: {e}")
        import traceback
        traceback.print_exc()
        
    print(f"\n" + "=" * 80)
    print("審計完成")
    print("=" * 80)

if __name__ == "__main__":
    main()