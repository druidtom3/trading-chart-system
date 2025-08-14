#!/usr/bin/env python3
# 測試FVG檢測器V3版本

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

import pandas as pd
from datetime import datetime
from src.backend.fvg_detector_v3 import FVGDetectorV3

def test_bull_fvg():
    """測試多頭FVG檢測"""
    print("=== 測試多頭FVG ===")
    
    # 創建測試數據：多頭FVG模式
    # L: [100-105], C: [107-112] (陽線), R: [108-115]
    # 間隙：L.High(105) < R.Low(108), C.Open(107) > L.High(105)
    test_data = [
        {'time': 1000, 'open': 100, 'high': 105, 'low': 99, 'close': 102},     # L
        {'time': 1001, 'open': 107, 'high': 112, 'low': 106, 'close': 111},    # C (陽線)
        {'time': 1002, 'open': 110, 'high': 115, 'low': 108, 'close': 113},    # R
        {'time': 1003, 'open': 113, 'high': 117, 'low': 112, 'close': 116},    # 後續K線
        {'time': 1004, 'open': 116, 'high': 118, 'low': 98, 'close': 99},     # 觸及L.Low=99
    ]
    
    df = pd.DataFrame(test_data)
    detector = FVGDetectorV3()
    
    # 檢測FVG
    fvgs = detector.detect_fvgs(df)
    
    print(f"檢測到 {len(fvgs)} 個FVG")
    for fvg in fvgs:
        print(f"  FVG-{fvg['id']}: {fvg['type']} [{fvg['bot']:.1f}, {fvg['top']:.1f}]")
        print(f"    形成時間: {fvg['time']}, 左界: {fvg['left_time']}")
        print(f"    已清除: {fvg['cleared']}")
        if fvg['cleared']:
            print(f"    清除時間: {fvg['clear_time']}")
    
    # 預期結果：應該檢測到1個多頭FVG，但被L.Low=99清除
    assert len(fvgs) == 0, "多頭FVG應該被清除，不應出現在結果中"
    print("[OK] 多頭FVG測試通過")

def test_bear_fvg():
    """測試空頭FVG檢測"""
    print("\n=== 測試空頭FVG ===")
    
    # 創建測試數據：空頭FVG模式
    # L: [110-115], C: [105-110] (陰線), R: [100-107]  
    # 間隙：L.Low(110) > R.High(107), C.Open(110) < L.Low(110)
    test_data = [
        {'time': 2000, 'open': 112, 'high': 115, 'low': 110, 'close': 111},    # L
        {'time': 2001, 'open': 110, 'high': 110, 'low': 105, 'close': 106},    # C (陰線)
        {'time': 2002, 'open': 108, 'high': 107, 'low': 100, 'close': 103},    # R
        {'time': 2003, 'open': 103, 'high': 108, 'low': 102, 'close': 106},    # 後續K線
        {'time': 2004, 'open': 106, 'high': 116, 'low': 105, 'close': 115},    # 觸及L.High=115
    ]
    
    df = pd.DataFrame(test_data)
    detector = FVGDetectorV3()
    
    # 檢測FVG
    fvgs = detector.detect_fvgs(df)
    
    print(f"檢測到 {len(fvgs)} 個FVG")
    for fvg in fvgs:
        print(f"  FVG-{fvg['id']}: {fvg['type']} [{fvg['bot']:.1f}, {fvg['top']:.1f}]")
        print(f"    已清除: {fvg['cleared']}")
    
    # 預期結果：應該檢測到1個空頭FVG，但被L.High=115清除
    assert len(fvgs) == 0, "空頭FVG應該被清除，不應出現在結果中"
    print("[OK] 空頭FVG測試通過")

def test_persistent_fvg():
    """測試持續存在的FVG（40個K線內未被清除）"""
    print("\n=== 測試持續FVG ===")
    
    # 創建多頭FVG，但後續K線都不觸及bot
    test_data = [
        {'time': 3000, 'open': 100, 'high': 105, 'low': 99, 'close': 102},     # L
        {'time': 3001, 'open': 107, 'high': 112, 'low': 106, 'close': 111},    # C (陽線)
        {'time': 3002, 'open': 110, 'high': 115, 'low': 108, 'close': 113},    # R
    ]
    
    # 添加37個不觸及bot=105的K線
    for i in range(37):
        test_data.append({
            'time': 3003 + i,
            'open': 115 + i,
            'high': 118 + i,
            'low': 112 + i,  # 最低點都高於L.Low=99
            'close': 116 + i
        })
    
    df = pd.DataFrame(test_data)
    detector = FVGDetectorV3()
    
    # 檢測FVG
    fvgs = detector.detect_fvgs(df)
    
    print(f"檢測到 {len(fvgs)} 個FVG")
    for fvg in fvgs:
        print(f"  FVG-{fvg['id']}: {fvg['type']} [{fvg['bot']:.1f}, {fvg['top']:.1f}]")
        print(f"    已清除: {fvg['cleared']}")
    
    # 預期結果：應該有1個未被清除的多頭FVG
    assert len(fvgs) == 1, f"應該有1個FVG，但檢測到{len(fvgs)}個"
    assert fvgs[0]['type'] == 'bull', "應該是多頭FVG"
    assert not fvgs[0]['cleared'], "FVG不應該被清除"
    print("[OK] 持續FVG測試通過")

def test_v3_vs_v2_differences():
    """測試V3與V2的差異"""
    print("\n=== 測試V3簡化特性 ===")
    
    # 測試V3不需要require_dir_continuity
    # L和C不同色但仍能形成FVG的情況
    test_data = [
        {'time': 4000, 'open': 102, 'high': 105, 'low': 99, 'close': 100},     # L (陰線)
        {'time': 4001, 'open': 107, 'high': 112, 'low': 106, 'close': 111},    # C (陽線) - 與L不同色
        {'time': 4002, 'open': 110, 'high': 115, 'low': 108, 'close': 113},    # R
    ]
    
    df = pd.DataFrame(test_data)
    detector = FVGDetectorV3()
    
    fvgs = detector.detect_fvgs(df)
    
    print(f"L與C不同色情況下檢測到 {len(fvgs)} 個FVG")
    
    # V3應該能檢測到（因為只要求C.Close > C.Open）
    assert len(fvgs) == 1, "V3應該能檢測到FVG，不受L與C顏色限制"
    print("[OK] V3簡化特性測試通過")

if __name__ == '__main__':
    test_bull_fvg()
    test_bear_fvg()
    test_persistent_fvg()
    test_v3_vs_v2_differences()
    
    print("\n=== 所有V3測試通過 ===")
    print("FVG檢測器V3版本功能正常！")