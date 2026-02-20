"""
공유 설정 로더: public/brand_config.json에서 설정값 읽기
없으면 현재 하드코딩된 기본값과 동일한 값 사용
"""

import json
import os

_CONFIG_PATH = os.path.join(os.path.dirname(__file__), '..', 'public', 'brand_config.json')
_config_cache = None


def _load_config():
    global _config_cache
    if _config_cache is not None:
        return _config_cache

    if os.path.exists(_CONFIG_PATH):
        try:
            with open(_CONFIG_PATH, 'r', encoding='utf-8') as f:
                _config_cache = json.load(f)
                print(f"[Config] brand_config.json 로드 완료")
                return _config_cache
        except Exception as e:
            print(f"[Config] brand_config.json 파싱 실패, 기본값 사용: {e}")

    _config_cache = {}
    return _config_cache


def get_grade_thresholds():
    """등급 임계값 반환: {'S': 75, 'A': 65, 'B': 55, 'C': 40}"""
    cfg = _load_config()
    thresholds = cfg.get('gradeThresholds', {})
    return {
        'S': thresholds.get('S', 75),
        'A': thresholds.get('A', 65),
        'B': thresholds.get('B', 55),
        'C': thresholds.get('C', 40),
    }


def get_sell_through_threshold():
    """상업적 결품 판매율 기준 (기본 70% = 0.7)"""
    cfg = _load_config()
    value = cfg.get('targetSellThrough', 70)
    return value / 100  # % → 비율


def get_season_end_date():
    """시즌 종료일 반환 (pd.Timestamp)"""
    import pandas as pd
    cfg = _load_config()
    end = cfg.get('endDate', {})
    month = end.get('month', '09')
    day = end.get('day', '30')
    base = cfg.get('baseSeason', '25S')
    year = 2000 + int(base[:2]) if base else 2025
    return pd.Timestamp(f'{year}-{month}-{day}')


def get_early_stockout_date():
    """조기 결품 기준일 반환 (pd.Timestamp)"""
    import pandas as pd
    cfg = _load_config()
    early = cfg.get('earlyStockoutDate', {})
    month = early.get('month', '05')
    day = early.get('day', '30')
    base = cfg.get('baseSeason', '25S')
    year = 2000 + int(base[:2]) if base else 2025
    return pd.Timestamp(f'{year}-{month}-{day}')


def get_shortage_cutoff_date():
    """시즌중 결품 기준일 = 조기결품일 + 2개월"""
    early = get_early_stockout_date()
    return early + pd.DateOffset(months=2)


def reset_cache():
    """캐시 리셋 (테스트용)"""
    global _config_cache
    _config_cache = None


# pandas import for get_shortage_cutoff_date
import pandas as pd
