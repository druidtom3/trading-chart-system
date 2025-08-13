# 檔名：base_indicator.py

from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional
import pandas as pd

class BaseIndicator(ABC):
    """
    基礎指標類別 - 所有技術指標的統一接口
    """
    
    def __init__(self, name: str, config: Dict[str, Any] = None):
        self.name = name
        self.config = config or {}
        self.enabled = True
        self.visible = True
        
    @abstractmethod
    def calculate(self, data: pd.DataFrame) -> List[Dict[str, Any]]:
        """
        計算指標數據
        
        Args:
            data: K線數據 (包含 OHLC)
            
        Returns:
            指標結果列表
        """
        pass
    
    @abstractmethod
    def get_render_config(self) -> Dict[str, Any]:
        """
        獲取渲染配置
        
        Returns:
            包含渲染類型、顏色、樣式等配置
        """
        pass
    
    def get_config_schema(self) -> Dict[str, Any]:
        """
        獲取配置參數模式
        
        Returns:
            參數配置的 JSON Schema
        """
        return {
            "type": "object",
            "properties": {
                "enabled": {"type": "boolean", "default": True},
                "visible": {"type": "boolean", "default": True}
            }
        }
    
    def update_config(self, config: Dict[str, Any]):
        """更新配置"""
        self.config.update(config)
        self.enabled = config.get('enabled', self.enabled)
        self.visible = config.get('visible', self.visible)
    
    def validate_data(self, data: pd.DataFrame) -> bool:
        """驗證輸入數據格式"""
        required_columns = ['Open', 'High', 'Low', 'Close']
        return all(col in data.columns for col in required_columns)

class IndicatorManager:
    """
    指標管理器 - 管理所有指標的註冊、計算和配置
    """
    
    def __init__(self):
        self.indicators: Dict[str, BaseIndicator] = {}
        self.enabled_indicators: Dict[str, bool] = {}
        
    def register_indicator(self, indicator: BaseIndicator):
        """註冊指標"""
        self.indicators[indicator.name] = indicator
        self.enabled_indicators[indicator.name] = indicator.enabled
        
    def get_indicator(self, name: str) -> Optional[BaseIndicator]:
        """獲取指標實例"""
        return self.indicators.get(name)
    
    def list_indicators(self) -> List[Dict[str, Any]]:
        """獲取所有指標列表"""
        return [
            {
                "name": name,
                "enabled": indicator.enabled,
                "visible": indicator.visible,
                "config": indicator.config,
                "schema": indicator.get_config_schema()
            }
            for name, indicator in self.indicators.items()
        ]
    
    def toggle_indicator(self, name: str) -> bool:
        """切換指標開關"""
        if name in self.indicators:
            indicator = self.indicators[name]
            indicator.enabled = not indicator.enabled
            self.enabled_indicators[name] = indicator.enabled
            return indicator.enabled
        return False
    
    def calculate_all(self, data: pd.DataFrame) -> Dict[str, List[Dict[str, Any]]]:
        """計算所有啟用的指標"""
        results = {}
        
        for name, indicator in self.indicators.items():
            if indicator.enabled and indicator.validate_data(data):
                try:
                    results[name] = indicator.calculate(data)
                except Exception as e:
                    print(f"指標 {name} 計算失敗: {str(e)}")
                    results[name] = []
                    
        return results
    
    def get_render_configs(self) -> Dict[str, Dict[str, Any]]:
        """獲取所有啟用指標的渲染配置"""
        return {
            name: indicator.get_render_config()
            for name, indicator in self.indicators.items()
            if indicator.enabled and indicator.visible
        }