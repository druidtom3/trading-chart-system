# 檔名：fvg_indicator.py

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from indicators.base_indicator import BaseIndicator
from fvg_detector import FVGDetector
import pandas as pd
from typing import Dict, List, Any

class FVGIndicator(BaseIndicator):
    """
    FVG 指標包裝器 - 符合統一指標接口
    """
    
    def __init__(self, config: Dict[str, Any] = None):
        super().__init__("FVG", config)
        
        # 從配置中獲取參數（依據規格v2調整預設值）
        self.detection_range = self.config.get('detection_range', 400)  # FVG檢測範圍
        self.require_dir_continuity = self.config.get('require_dir_continuity', False)  # 規格v2預設值
        self.iou_thresh = self.config.get('iou_thresh', 0.8)  # 規格v2要求
        self.tick_eps = self.config.get('tick_eps', 0.0)  # 規格v2新增
        
        # 初始化 FVG 檢測器
        self.detector = FVGDetector(
            detection_range=self.detection_range,
            require_dir_continuity=self.require_dir_continuity,
            iou_thresh=self.iou_thresh,
            tick_eps=self.tick_eps
        )
        
    def calculate(self, data: pd.DataFrame) -> List[Dict[str, Any]]:
        """
        計算 FVG 指標
        
        Args:
            data: K線數據
            
        Returns:
            FVG 結果列表
        """
        if not self.enabled or not self.validate_data(data):
            return []
            
        try:
            # 使用現有的 FVG 檢測器
            fvgs = self.detector.detect(data)
            
            # 轉換為統一格式
            results = []
            for fvg in fvgs:
                results.append({
                    'type': 'area',  # 渲染類型
                    'data': {
                        'time': fvg['time'],
                        'top': fvg['top'],
                        'bot': fvg['bot'],
                        'fvg_type': fvg['type'],
                        'idx': fvg['idx']
                    },
                    'style': {
                        'color': '#ff4757' if fvg['type'] == 'bear' else '#2ed573',
                        'opacity': 0.3
                    }
                })
            
            return results
            
        except Exception as e:
            print(f"FVG 計算錯誤: {str(e)}")
            return []
    
    def get_render_config(self) -> Dict[str, Any]:
        """
        獲取 FVG 渲染配置
        """
        return {
            'type': 'areas',  # 區域類型渲染器
            'layer': 'background',  # 渲染層級
            'styles': {
                'bull': {
                    'color': '#2ed573',
                    'opacity': 0.3,
                    'borderColor': '#2ed573',
                    'borderWidth': 1
                },
                'bear': {
                    'color': '#ff4757', 
                    'opacity': 0.3,
                    'borderColor': '#ff4757',
                    'borderWidth': 1
                }
            }
        }
    
    def get_config_schema(self) -> Dict[str, Any]:
        """
        獲取 FVG 配置參數模式
        """
        base_schema = super().get_config_schema()
        base_schema['properties'].update({
            "detection_range": {
                "type": "integer",
                "default": 400,
                "minimum": 10,
                "maximum": 1000,
                "title": "檢測範圍"
            },
            "require_dir_continuity": {
                "type": "boolean", 
                "default": False,
                "title": "要求方向連續性"
            },
            "iou_thresh": {
                "type": "number",
                "default": 0.8,
                "minimum": 0.0,
                "maximum": 1.0,
                "title": "IoU去重閾值"
            },
            "tick_eps": {
                "type": "number",
                "default": 0.0,
                "minimum": 0.0,
                "maximum": 10.0,
                "title": "tick容差"
            }
        })
        return base_schema
    
    def update_config(self, config: Dict[str, Any]):
        """更新配置並重新初始化檢測器"""
        super().update_config(config)
        
        # 更新檢測器參數
        if 'detection_range' in config:
            self.detection_range = config['detection_range']
        if 'require_dir_continuity' in config:
            self.require_dir_continuity = config['require_dir_continuity']
        if 'iou_thresh' in config:
            self.iou_thresh = config['iou_thresh']
        if 'tick_eps' in config:
            self.tick_eps = config['tick_eps']
            
        # 重新初始化檢測器
        self.detector = FVGDetector(
            detection_range=self.detection_range,
            require_dir_continuity=self.require_dir_continuity,
            iou_thresh=self.iou_thresh,
            tick_eps=self.tick_eps
        )