import pandas as pd
import json
from config_loader import get_sell_through_threshold, get_early_stockout_date, get_shortage_cutoff_date

_ST_THRESHOLD = get_sell_through_threshold()
_EARLY_STOCKOUT_DATE = get_early_stockout_date()
_SHORTAGE_CUTOFF_DATE = get_shortage_cutoff_date()

# 1. 데이터 로드 (파일명에 맞게 수정)
file_path = '../data/weekly_dx25s.xlsx - Data.csv'
try:
    df = pd.read_csv(file_path)
except:
    # 엑셀 파일일 경우 (첫 번째 시트)
    df = pd.read_excel('../data/weekly_dx25s.xlsx', sheet_name=0)

# 2. 전처리: 25S 시즌('당해') 데이터 필터링 및 날짜 변환
df_process = df[df['PERIOD'] == '당해'].copy()
df_process['END_DT'] = pd.to_datetime(df_process['END_DT'])

# -------------------------------------------------------
# 3. 핵심 로직: 스타일별 시계열 패턴 분석 함수
# -------------------------------------------------------
# -------------------------------------------------------
# 3. 핵심 로직: 스타일별 시계열 패턴 분석 함수
# -------------------------------------------------------
def generate_chart_data(group, init_date):
    """
    그룹(스타일 or 컬러)의 Chart JSON 생성을 위한 데이터 리스트 반환
    판매 시작(최초입고일) 4주 전부터 데이터 포함
    """
    chart_data = []
    reorder_count = 0
    
    # 최초입고일 4주 전 계산
    cutoff_date = None
    if pd.notnull(init_date):
        cutoff_date = init_date - pd.Timedelta(days=28)  # 4주 = 28일
    
    # 그룹별 재고, 판매, 입고 계산 (이미 날짜별로 정렬된 상태라고 가정)
    for _, row in group.iterrows():
        # 최초입고일 4주 전 이후 데이터만 포함
        if cutoff_date is not None and row['END_DT'] < cutoff_date:
            continue
            
        label = ''
        if row['STOR_QTY_KR'] > 0 and pd.notnull(init_date) and row['END_DT'] > init_date:
            reorder_count += 1
            label = f'{reorder_count}차 리오더' if reorder_count > 0 else '리오더'
        elif row.get('Sell_Through', 0) >= _ST_THRESHOLD and label == '':
            label = '재고부족'
            
        chart_data.append({
            'date': row['END_DT'].strftime('%m/%d'),
            'sale': int(row['SALE_QTY_CNS']),
            'stock': int(row['STOCK_QTY_KR']) if 'STOCK_QTY_KR' in row else int(row.get('STOCK_QTY', 0)),
            'in': int(row['STOR_QTY_KR']),
            'label': label
        })
    return chart_data

def analyze_style_pattern(group, is_total=False):
    # 날짜순 정렬
    group = group.sort_values('END_DT')
    
    # [A] 기초 재고 및 누적 흐름 계산
    # 누적 입고 (STOR_QTY_KR)
    group['Cum_In'] = group['STOR_QTY_KR'].cumsum()
    # 누적 판매 (SALE_QTY_CNS)
    group['Cum_Sale'] = group['SALE_QTY_CNS'].cumsum()
    
    # 판매율 (Sell-Through)
    group['Sell_Through'] = group.apply(
        lambda x: x['Cum_Sale'] / x['Cum_In'] if x['Cum_In'] > 0 else 0, axis=1
    )
    
    # [B] 중요 시점 추출
    # 1. 최초 입고일
    in_stock = group[group['STOR_QTY_KR'] > 0]
    init_date = in_stock['END_DT'].min() if not in_stock.empty else pd.NaT
    
    # 2. 리오더 발생일 (최초 입고일 + 14일 이후 입고가 있는 경우)
    reorders = []
    if pd.notnull(init_date):
        reorder_rows = group[
            (group['END_DT'] > init_date + pd.Timedelta(days=14)) & 
            (group['STOR_QTY_KR'] > 0)
        ]
        reorders = reorder_rows['END_DT'].dt.strftime('%m/%d').tolist()
    
    # 3. 결품 임박 시점 (누적 판매율 70% 최초 돌파 주차)
    # 단, 입고가 10장 이상인 유의미한 경우만 체크
    stock_out_row = group[(group['Sell_Through'] >= _ST_THRESHOLD) & (group['Cum_In'] > 10)]
    stock_out_date = stock_out_row['END_DT'].min() if not stock_out_row.empty else pd.NaT
    
    # [C] AI 진단 (Diagnosis)
    total_sale = group['SALE_QTY_CNS'].sum()
    final_str = group['Sell_Through'].iloc[-1] if not group.empty else 0
    total_in = group['STOR_QTY_KR'].sum()
    total_order = group['ORDER_QTY'].sum() if 'ORDER_QTY' in group.columns else total_in
    
    status = "⚪Normal"
    if pd.notnull(stock_out_date):
        if stock_out_date <= _EARLY_STOCKOUT_DATE:
            status = "🚨Early Shortage (5월전 품절)"
        elif stock_out_date <= _SHORTAGE_CUTOFF_DATE:
            status = "⚠️Shortage (시즌중 품절)"
        else:
            status = "🟢Hit (적기 소진)"
    elif final_str >= 0.8:
        status = "🟢Hit (고효율)"
    elif final_str < 0.55:
        status = "🔴Risk (부진)"
    # else: 55% <= final_str < 80% -> Normal (기본값 유지)

    # [D] 차트 데이터 생성
    chart_data = generate_chart_data(group, init_date)

    # 판매가 (TAG_PRICE) 추출 - 그룹 내 첫 번째 값 사용
    tag_price = group['TAG_PRICE'].iloc[0] if 'TAG_PRICE' in group.columns else 0

    return pd.Series({
        '최초입고': init_date.strftime('%Y-%m-%d') if pd.notnull(init_date) else '-',
        '결품시점(70%)': stock_out_date.strftime('%Y-%m-%d') if pd.notnull(stock_out_date) else '-',
        '리오더입고일': ', '.join(reorders),
        '총발주': total_order,
        '총입고': total_in,
        '총판매': total_sale,
        '최종판매율': round(final_str * 100, 1),
        'AI_진단': status,
        '판매가': int(tag_price),
        'Chart_JSON': json.dumps(chart_data, ensure_ascii=False) # JSON 문자열로 저장
    })

# 4. 전체 스타일 분석 실행
print("데이터 분석 중...")
result_df = df_process.groupby(['ITEM_NM', 'PART_CD', 'COLOR_CD']).apply(analyze_style_pattern).reset_index()

# 5. 결과 저장
# 5-1. 새로운 컬럼 추가 (기회비용 분석용)
result_df['AI 계산 기회비용'] = 0  # 초기값 0, ai_sales_loss_v2.py에서 업데이트
result_df['AI제안 발주량'] = 0      # 초기값 0, ai_sales_loss_v2.py에서 업데이트

# 5-2. 컬럼 순서 재정렬 (판매가를 PART_CD 오른쪽으로, 기회비용 컬럼을 AI_진단 오른쪽으로)
column_order = [
    'ITEM_NM', 'PART_CD', '판매가', 'COLOR_CD',
    '최초입고', '결품시점(70%)', '리오더입고일',
    '총발주', '총입고', '총판매', '최종판매율',
    'AI_진단', 'AI 계산 기회비용', 'AI제안 발주량',
    'Chart_JSON'
]
result_df = result_df[column_order]

# 5-3. 엑셀 저장 (Chart_JSON 제외)
result_df.drop(columns=['Chart_JSON']).to_excel('../output/25S_TimeSeries_Analysis_Result.xlsx', index=False)
print("* 분석 결과 저장 완료: ../output/25S_TimeSeries_Analysis_Result.xlsx")

# 6. 대시보드용 JSON 출력 및 저장 (대표 성공/실패 사례 1건씩)
# 6. 대시보드용 JSON 출력 및 저장 (대표 성공/실패 사례 -> Total + Colors 구조로 변환)
print("\n--- [대시보드 데이터 생성 중 (Total + Colors)] ---")

def create_dashboard_entry(part_cd, color_cd, raw_df, anal_df):
    """
    특정 스타일(part_cd)에 대한 대시보드 데이터 생성
    - total: 해당 스타일의 모든 컬러 합산 데이터
    - colors: 각 컬러별 데이터 맵
    """
    # 1. Total Data 생성 (Raw Data에서 다시 집계)
    style_raw_mask = (raw_df['PART_CD'] == part_cd)
    style_raw = raw_df[style_raw_mask].copy()
    
    # 날짜별로 모든 컬러 합산
    agg_dict = {
        'STOR_QTY_KR': 'sum',
        'SALE_QTY_CNS': 'sum',
        'STOCK_QTY_KR': 'sum',
        'TAG_PRICE': 'first'
    }
    # ORDER_QTY 컬럼이 있으면 추가
    if 'ORDER_QTY' in style_raw.columns:
        agg_dict['ORDER_QTY'] = 'sum'
    
    style_total_raw = style_raw.groupby('END_DT').agg(agg_dict).reset_index()
    
    # Total 분석 실행
    total_analysis = analyze_style_pattern(style_total_raw, is_total=True)
    
    # ITEM_NM, PRDT_NM 추출
    item_nm = style_raw['ITEM_NM'].iloc[0]
    prdt_nm = style_raw['PRDT_NM'].iloc[0] if 'PRDT_NM' in style_raw.columns else ''
    
    total_entry = {
        'chartData': json.loads(total_analysis['Chart_JSON']),
        'itemInfo': {
            'name': str(item_nm),
            'code': str(part_cd),
            'color': '전체',
            'price': int(total_analysis['판매가']),
            'prdt_nm': str(prdt_nm)
        },
        'analysis': {
            '최초입고': str(total_analysis['최초입고']),
            '결품시점': str(total_analysis['결품시점(70%)']),
            '리오더입고일': str(total_analysis['리오더입고일']),
            '총발주': int(total_analysis['총발주']),
            '총입고': int(total_analysis['총입고']),
            '총판매': int(total_analysis['총판매']),
            '최종판매율': float(total_analysis['최종판매율']),
            'AI_진단': str(total_analysis['AI_진단'])
        }
    }
    
    # 2. Colors Data 수집 (이미 분석된 anal_df 활용)
    # 해당 스타일의 모든 컬러 찾기
    colors_anal = anal_df[anal_df['PART_CD'] == part_cd]
    colors_entry = {}
    
    for _, row in colors_anal.iterrows():
        c_code = str(row['COLOR_CD'])
        colors_entry[c_code] = {
            'chartData': json.loads(row['Chart_JSON']),
            'itemInfo': {
                'name': str(row['ITEM_NM']),
                'code': str(row['PART_CD']),
                'color': c_code,
                'price': int(row['판매가']),
                'prdt_nm': str(prdt_nm)
            },
            'analysis': {
                '최초입고': str(row['최초입고']),
                '결품시점': str(row['결품시점(70%)']),
                '리오더입고일': str(row['리오더입고일']),
                '총발주': int(row['총발주']),
                '총입고': int(row['총입고']),
                '총판매': int(row['총판매']),
                '최종판매율': float(row['최종판매율']),
                'AI_진단': str(row['AI_진단'])
            }
        }
        
    return {
        'total': total_entry,
        'colors': colors_entry
    }

# 진단별 필터 정의
diagnosis_filters = {
    # Success 그룹
    'hit': result_df['AI_진단'] == '🟢Hit (적기 소진)',
    'normal': result_df['AI_진단'] == '⚪Normal',
    # Failure 그룹
    'early_shortage': result_df['AI_진단'] == '🚨Early Shortage (5월전 품절)',
    'shortage': result_df['AI_진단'] == '⚠️Shortage (시즌중 품절)',
    'risk': result_df['AI_진단'] == '🔴Risk (부진)'
}

# 새로운 JSON 구조: success/failure 하위에 진단별 분류
dashboard_data = {
    'success': {
        'hit': [],
        'normal': []
    },
    'failure': {
        'early_shortage': [],
        'shortage': [],
        'risk': []
    }
}

# 각 진단별로 스타일 수집
def collect_styles_by_diagnosis(diagnosis_key, filter_mask, group_key):
    """진단별 스타일 수집 함수"""
    candidates = result_df[filter_mask].sort_values('총판매', ascending=False)
    if candidates.empty:
        return 0

    part_codes = candidates['PART_CD'].unique()
    count = 0

    for part_cd in part_codes:
        part_rows = candidates[candidates['PART_CD'] == part_cd]
        representative_row = part_rows.iloc[0]
        color_cd = representative_row['COLOR_CD']

        entry = create_dashboard_entry(part_cd, color_cd, df_process, result_df)
        dashboard_data[group_key][diagnosis_key].append(entry)
        count += 1

    return count

# Success 그룹 수집
print("\n[Success 그룹]")
hit_count = collect_styles_by_diagnosis('hit', diagnosis_filters['hit'], 'success')
print(f"  - 🟢Hit (적기 소진): {hit_count}개 스타일")

normal_count = collect_styles_by_diagnosis('normal', diagnosis_filters['normal'], 'success')
print(f"  - ⚪Normal: {normal_count}개 스타일")

# Failure 그룹 수집
print("\n[Failure 그룹]")
early_shortage_count = collect_styles_by_diagnosis('early_shortage', diagnosis_filters['early_shortage'], 'failure')
print(f"  - 🚨Early Shortage (5월전 품절): {early_shortage_count}개 스타일")

shortage_count = collect_styles_by_diagnosis('shortage', diagnosis_filters['shortage'], 'failure')
print(f"  - ⚠️Shortage (시즌중 품절): {shortage_count}개 스타일")

risk_count = collect_styles_by_diagnosis('risk', diagnosis_filters['risk'], 'failure')
print(f"  - 🔴Risk (부진): {risk_count}개 스타일")

total_count = hit_count + normal_count + early_shortage_count + shortage_count + risk_count
print(f"\n* 총 {total_count}개 스타일 대시보드 데이터 생성 완료")

# JSON 파일로 저장 (루트 및 public 폴더)
import os

# output 폴더에 저장
with open('../output/dashboard_data.json', 'w', encoding='utf-8') as f:
    json.dump(dashboard_data, f, ensure_ascii=False, indent=2)

# public 폴더에도 저장 (React 앱용)
os.makedirs('../public', exist_ok=True)
with open('../public/dashboard_data.json', 'w', encoding='utf-8') as f:
    json.dump(dashboard_data, f, ensure_ascii=False, indent=2)

print("* 대시보드 데이터 저장 완료: dashboard_data.json (구조: Total + Colors)")