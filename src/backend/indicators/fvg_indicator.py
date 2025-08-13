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
        
        # 從配置中獲取參數
        self.max_age = self.config.get('max_age', 200)
        self.require_dir_continuity = self.config.get('require_dir_continuity', True)
        
        # 初始化 FVG 檢測器
        self.detector = FVGDetector(
            max_age=self.max_age,
            require_dir_continuity=self.require_dir_continuity
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
            "max_age": {
                "type": "integer",
                "default": 200,
                "minimum": 10,
                "maximum": 1000,
                "title": "最大存活期"
            },
            "require_dir_continuity": {
                "type": "boolean", 
                "default": True,
                "title": "要求方向連續性"
            }
        })
        return base_schema
    
    def update_config(self, config: Dict[str, Any]):
        """更新配置並重新初始化檢測器"""
        super().update_config(config)
        
        # 更新檢測器參數
        if 'max_age' in config:
            self.max_age = config['max_age']
        if 'require_dir_continuity' in config:
            self.require_dir_continuity = config['require_dir_continuity']
            
        # 重新初始化檢測器
        self.detector = FVGDetector(
            max_age=self.max_age,
            require_dir_continuity=self.require_dir_continuity
        )