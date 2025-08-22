# 檔名：data_validator.py

from typing import List, Dict, Any, Optional, Union
import logging
from datetime import datetime

class DataValidator:
    """
    統一的數據驗證器
    用於驗證K線數據和FVG數據的完整性和正確性
    """
    
    def __init__(self):
        self.error_count = 0
        self.validation_history = []
        
    @staticmethod
    def validate_candle_limit(data_length: int, timeframe: str, config_limit: int) -> int:
        """
        統一的K線數量驗證
        
        Args:
            data_length: 實際數據長度
            timeframe: 時間框架
            config_limit: 配置限制
            
        Returns:
            調整後的數據長度
        """
        if data_length > config_limit:
            print(f"[{timeframe}] 數據量 {data_length} 超過限制 {config_limit}，截取最新 {config_limit} 筆")
            return config_limit
        return data_length
    
    @staticmethod
    def validate_fvg_data(fvgs: list, max_count: int = 50, timeframe: str = "Unknown") -> list:
        """
        統一的FVG數量驗證
        
        Args:
            fvgs: FVG數據列表
            max_count: 最大數量限制
            timeframe: 時間框架（用於日誌）
            
        Returns:
            調整後的FVG列表
        """
        if len(fvgs) > max_count:
            # 按gap_size排序，保留前N個最重要的FVG
            sorted_fvgs = sorted(
                fvgs, 
                key=lambda x: x.get('gap_size', 0) if isinstance(x, dict) else 0, 
                reverse=True
            )
            print(f"[{timeframe}] FVG數量 {len(fvgs)} 超過限制 {max_count}，保留前 {max_count} 個最大的")
            return sorted_fvgs[:max_count]
        return fvgs
    
    def validate_candle_data(self, data: List[Dict], source: str = "Unknown") -> Dict[str, Any]:
        """
        驗證K線數據完整性
        
        Args:
            data: K線數據列表
            source: 數據源標識
            
        Returns:
            驗證結果字典
        """
        validation_result = {
            'source': source,
            'timestamp': datetime.now().isoformat(),
            'total_count': 0,
            'valid_count': 0,
            'errors': [],
            'warnings': []
        }
        
        if not data:
            validation_result['errors'].append('數據為空或None')
            self._log_validation(validation_result)
            return validation_result
            
        if not isinstance(data, list):
            validation_result['errors'].append(f'數據不是列表類型，實際類型: {type(data)}')
            self._log_validation(validation_result)
            return validation_result
            
        validation_result['total_count'] = len(data)
        
        # 驗證每筆數據
        for i, candle in enumerate(data):
            candle_errors = self._validate_single_candle(candle, i)
            if not candle_errors:
                validation_result['valid_count'] += 1
            else:
                validation_result['errors'].extend(candle_errors)
                
        self._log_validation(validation_result)
        return validation_result
    
    def _validate_single_candle(self, candle: Dict, index: int) -> List[str]:
        """驗證單根K線數據"""
        errors = []
        
        if not candle:
            errors.append(f'第{index}根K線為None或空')
            return errors
            
        # 檢查必要欄位
        required_fields = ['time', 'open', 'high', 'low', 'close']
        optional_fields = ['volume', 'vwap']
        
        for field in required_fields:
            if field not in candle or candle[field] is None:
                errors.append(f'第{index}根K線缺少 {field} 欄位')
            elif field != 'time' and not isinstance(candle[field], (int, float)):
                errors.append(f'第{index}根K線 {field} 不是數字類型: {type(candle[field])}')
                
        # 檢查時間格式
        if 'time' in candle and candle['time'] is not None:
            if not isinstance(candle['time'], (int, float)) or candle['time'] <= 0:
                errors.append(f'第{index}根K線時間格式錯誤: {candle["time"]}')
                
        # 檢查價格邏輯
        if all(field in candle and candle[field] is not None for field in ['high', 'low']):
            if candle['high'] < candle['low']:
                errors.append(f'第{index}根K線 high < low: {candle["high"]} < {candle["low"]}')
                
        return errors
    
    def validate_fvg_list(self, fvgs: List[Dict], source: str = "Unknown") -> Dict[str, Any]:
        """
        驗證FVG數據列表
        
        Args:
            fvgs: FVG數據列表
            source: 數據源標識
            
        Returns:
            驗證結果字典
        """
        validation_result = {
            'source': source,
            'timestamp': datetime.now().isoformat(),
            'total_count': 0,
            'valid_count': 0,
            'errors': [],
            'warnings': []
        }
        
        if not fvgs:
            validation_result['warnings'].append('FVG數據為空')
            self._log_validation(validation_result)
            return validation_result
            
        if not isinstance(fvgs, list):
            validation_result['errors'].append(f'FVG不是列表類型，實際類型: {type(fvgs)}')
            self._log_validation(validation_result)
            return validation_result
            
        validation_result['total_count'] = len(fvgs)
        
        # 驗證每個FVG
        for i, fvg in enumerate(fvgs):
            fvg_errors = self._validate_single_fvg(fvg, i)
            if not fvg_errors:
                validation_result['valid_count'] += 1
            else:
                validation_result['errors'].extend(fvg_errors)
                
        self._log_validation(validation_result)
        return validation_result
    
    def _validate_single_fvg(self, fvg: Dict, index: int) -> List[str]:
        """驗證單個FVG數據"""
        errors = []
        
        if not fvg:
            errors.append(f'第{index}個FVG為None或空')
            return errors
            
        # 檢查必要欄位（根據實際FVG結構調整）
        required_fields = ['startTime', 'endTime']
        for field in required_fields:
            if field not in fvg or fvg[field] is None:
                errors.append(f'第{index}個FVG缺少 {field} 欄位')
                
        # 檢查價格欄位
        price_fields = ['topPrice', 'bottomPrice', 'startPrice', 'endPrice', 'gap_size']
        has_price_field = any(field in fvg and fvg[field] is not None for field in price_fields)
        
        if not has_price_field:
            errors.append(f'第{index}個FVG缺少價格相關欄位')
            
        return errors
    
    def _log_validation(self, validation_result: Dict[str, Any]):
        """記錄驗證結果"""
        self.validation_history.append(validation_result)
        
        has_errors = len(validation_result['errors']) > 0
        status = '❌ 失敗' if has_errors else '✅ 通過'
        
        print(f"📋 數據驗證 [{validation_result['source']}] {status}")
        print(f"   總數: {validation_result['total_count']}, 有效: {validation_result['valid_count']}, 錯誤: {len(validation_result['errors'])}")
        
        if has_errors:
            self.error_count += 1
            # 只顯示前5個錯誤以避免日誌過長
            for i, error in enumerate(validation_result['errors'][:5]):
                print(f"   錯誤{i+1}: {error}")
            if len(validation_result['errors']) > 5:
                print(f"   ... 還有 {len(validation_result['errors']) - 5} 個錯誤")
    
    def get_validation_summary(self) -> Dict[str, Any]:
        """獲取驗證摘要"""
        return {
            'total_validations': len(self.validation_history),
            'error_count': self.error_count,
            'success_rate': (len(self.validation_history) - self.error_count) / len(self.validation_history) * 100 if self.validation_history else 0,
            'latest_validations': self.validation_history[-5:] if self.validation_history else []
        }
    
    def clear_history(self):
        """清除驗證歷史"""
        self.validation_history = []
        self.error_count = 0