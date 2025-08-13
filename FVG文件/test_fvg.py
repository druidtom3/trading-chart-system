# tests/test_fvg.py
# pytest -q tests/test_fvg.py
import pandas as pd
from fvg_implement import FVGDetector


def _df(data):
    return pd.DataFrame(data, columns=["open", "high", "low", "close"])


def test_three_bar_fvg_detected():
    candles = [
        (10, 12, 9, 11),      # L
        (11, 15, 11, 15),     # C (向上)
        (16, 17, 16, 16.5),   # R
    ]
    fvgs = FVGDetector().detect(_df(candles))
    assert any(f["type"] == "bull" for f in fvgs)


def test_gap_fvg_detected():
    candles = [
        (10, 12, 9, 11),      # prev
        (13, 14, 13, 13.5),   # gap-up + 多頭實體
    ]
    fvgs = FVGDetector().detect(_df(candles))
    assert any(f["type"] == "bull" for f in fvgs)


def test_partial_fill_not_counted():
    candles = [
        (10, 12, 9, 11),
        (11, 15, 11, 15),
        (16, 17, 16, 16.5),   # FVG 12-16
        (15.5, 16.5, 15.4, 16.4),  # 影線刺入，實體未覆蓋
    ]
    fvgs = FVGDetector().detect(_df(candles))
    assert fvgs[0]["filled"] is False


def test_expired_flag():
    base = [(10, 12, 9, 11)]
    df = _df(base * 45)
    df.iloc[1] = (11, 15, 11, 15)
    df.iloc[2] = (16, 17, 16, 16.5)
    fvgs = FVGDetector(max_age=40).detect(df)
    assert fvgs[0]["expired"] is True
