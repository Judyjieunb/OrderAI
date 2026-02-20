import pandas as pd
import numpy as np
import json
import os
import math
from datetime import datetime, timedelta
from config_loader import get_season_end_date, get_sell_through_threshold

# ============================================
# 0. 설정 및 상수
# ============================================
ANALYSIS_RESULT_FILE = '../output/25S_TimeSeries_Analysis_Result.xlsx'  # 시계열 분석 결과 파일
ORIGINAL_DATA_FILE = '../data/weekly_dx25s.xlsx'  # 원본 시계열 데이터 파일명
TARGET_FILE = '../output/25S_TimeSeries_Analysis_Result.xlsx'  # 결과 엑셀 파일명 (같은 파일에 추가)
JSON_FILE = '../public/dashboard_data.json'  # 대시보드 데이터 파일명
SEASON_END_DATE = get_season_end_date()  # 시즌 종료일
TARGET_END_SALES = 5  # 시즌 종료 시점 목표 판매량 (수렴값, 기초체력 기준으로도 사용)
SELL_THROUGH_THRESHOLD = get_sell_through_threshold()  # 상업적 결품 판매율 기준

print("=" * 60)
print("Step 3: AI 수요 예측 및 기회비용 분석 (Opportunity Loss Analysis) v2")
print("=" * 60)

# ============================================
# 1. 손실 발생 품번 추출 (25S_TimeSeries_Analysis_Result.xlsx)
# ============================================
def extract_loss_part_codes():
    """
    25S_TimeSeries_Analysis_Result.xlsx에서 기회비용 계산 대상 품번(PART_CD) 추출
    - AI_진단 컬럼에서 세 가지 패턴 매칭:
      1) Early Shortage (5월전 품절)
      2) Shortage (시즌중 품절)
      3) Hit (적기 소진) - 결품 발생했지만 7/30 이후
    """
    print(f"[1단계] 기회비용 계산 대상 품번 추출 중: {ANALYSIS_RESULT_FILE}")
    try:
        # 엑셀 파일 로드
        df = pd.read_excel(ANALYSIS_RESULT_FILE)
        print(f"  * 파일 로드 완료: {len(df)}행")

        # AI_진단 컬럼 확인
        if 'AI_진단' not in df.columns:
            print(f"  [오류] 'AI_진단' 컬럼을 찾을 수 없습니다.")
            print(f"  * 사용 가능한 컬럼: {list(df.columns)}")
            return None, None

        # 기회비용 계산 대상 필터링 (세 가지 패턴)
        # 1. Early Shortage (5월전 품절)
        # 2. Shortage (시즌중 품절)
        # 3. Hit (적기 소진) - 결품 발생했지만 시즌 후반
        pattern1 = df['AI_진단'].astype(str).str.contains('Early Shortage', na=False)
        pattern2 = df['AI_진단'].astype(str).str.contains('Shortage \(시즌중', na=False)
        pattern3 = df['AI_진단'].astype(str).str.contains('Hit \(적기', na=False)
        loss_mask = pattern1 | pattern2 | pattern3  # OR 조건
        loss_df = df[loss_mask].copy()

        print(f"  * 기회비용 계산 대상 스타일: {len(loss_df)}건")
        print(f"    - Early Shortage: {pattern1.sum()}건")
        print(f"    - Shortage (시즌중): {pattern2.sum()}건")
        print(f"    - Hit (적기 소진): {pattern3.sum()}건")

        if len(loss_df) == 0:
            print(f"  [경고] 기회비용 계산 대상 스타일이 없습니다.")
            return None, df

        # PART_CD 추출 (중복 제거)
        part_codes = loss_df['PART_CD'].unique().tolist()
        print(f"  * 추출된 품번(PART_CD): {len(part_codes)}개")
        print(f"  * 품번 목록: {part_codes[:10]}..." if len(part_codes) > 10 else f"  * 품번 목록: {part_codes}")

        # 품번별 상세 정보 저장 (나중에 결과 매핑용)
        part_info = loss_df[['PART_CD', 'ITEM_NM', 'COLOR_CD', 'AI_진단']].drop_duplicates()

        return part_codes, part_info, df  # 전체 df도 반환 (나중에 전체 발주량 계산용)

    except Exception as e:
        print(f"  [오류] 파일 로드 실패: {str(e)}")
        import traceback
        traceback.print_exc()
        return None, None, None

# ============================================
# 2. 원본 시계열 데이터 로드
# ============================================
def load_weekly_data(part_codes):
    """
    weekly_dx25s.xlsx에서 추출한 품번의 시계열 데이터 로드
    """
    print(f"[2단계] 원본 시계열 데이터 로드 중: {ORIGINAL_DATA_FILE}")
    try:
        # CSV 파일 우선 시도
        csv_path = f"{ORIGINAL_DATA_FILE} - Data.csv"
        if os.path.exists(csv_path):
            print(f"  * CSV 파일 발견: {csv_path}")
            df = pd.read_csv(csv_path)
        elif os.path.exists(ORIGINAL_DATA_FILE):
            print(f"  * 엑셀 파일 로드: {ORIGINAL_DATA_FILE} (첫 번째 시트)")
            df = pd.read_excel(ORIGINAL_DATA_FILE, sheet_name=0)
        else:
            print(f"  [오류] 원본 데이터 파일을 찾을 수 없습니다: {ORIGINAL_DATA_FILE}")
            return None
        
        print(f"  * 원본 데이터: {len(df)}행")
        
        # PERIOD 필터링
        if 'PERIOD' in df.columns:
            before_filter = len(df)
            df = df[df['PERIOD'] == '당해'].copy()
            after_filter = len(df)
            print(f"  * PERIOD='당해' 필터링: {before_filter}행 -> {after_filter}행")
        
        # PART_CD 필터링 (추출한 품번만)
        before_part_filter = len(df)
        df = df[df['PART_CD'].isin(part_codes)].copy()
        after_part_filter = len(df)
        print(f"  * PART_CD 필터링: {before_part_filter}행 -> {after_part_filter}행")
        
        if len(df) == 0:
            print(f"  [오류] 필터링 후 데이터가 없습니다.")
            return None
        
        # 날짜 변환
        if 'END_DT' in df.columns:
            df['END_DT'] = pd.to_datetime(df['END_DT'])
        else:
            print(f"  [오류] END_DT 컬럼을 찾을 수 없습니다.")
            return None
        
        # 정렬
        df = df.sort_values(['PART_CD', 'COLOR_CD', 'END_DT'])
        
        print(f"  * 데이터 로드 완료: {len(df)}행")
        print(f"  * 날짜 범위: {df['END_DT'].min()} ~ {df['END_DT'].max()}")
        
        return df
        
    except Exception as e:
        print(f"  [오류] 데이터 로드 실패: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

# ============================================
# 3. 상업적 결품 시점 감지 (판매율 70% 도달)
# ============================================
def detect_commercial_stockout(group):
    """
    주차별 판매율을 추적하여 판매율 70% 도달한 주차를 상업적 결품시점으로 간주
    """
    # 날짜순 정렬
    group = group.sort_values('END_DT').reset_index(drop=True)
    
    # 누적 입고 및 판매 계산
    if 'STOR_QTY_KR' not in group.columns or 'SALE_QTY_CNS' not in group.columns:
        return None
    
    cum_in = group['STOR_QTY_KR'].cumsum()
    cum_sale = group['SALE_QTY_CNS'].cumsum()
    
    # 판매율 계산 (0 나누기 방지)
    sell_through = cum_sale.div(cum_in).replace([np.inf, -np.inf], 0).fillna(0)
    
    # 판매율 70% 도달 시점 찾기
    stockout_mask = sell_through >= SELL_THROUGH_THRESHOLD
    stockout_rows = group[stockout_mask]
    
    if len(stockout_rows) == 0:
        return None
    
    # 첫 번째로 70% 도달한 시점
    stockout_idx = stockout_rows.index[0]
    stockout_date = group.loc[stockout_idx, 'END_DT']
    
    return stockout_idx, stockout_date

# ============================================
# 4. 기회비용 계산 (기획서 기반)
# ============================================
def calculate_opportunity_loss(group, stockout_idx):
    """
    기획서(STEP3_AI수요예측.md)에 따라 기회비용 계산
    
    공식:
    - Base Velocity (P_avg): 결품 직전 4주간 평균 판매량
    - 감쇠율 (r): r = (10 / P_avg)^(1/W)
    - 기회비용: max(0, 예측 - 실제)
    """
    try:
        # 1. Base Velocity (P_avg) 산출 - 결품 직전 4주간 평균
        if stockout_idx < 4:
            # 데이터가 부족하면 None 반환
            return None
        
        base_sales = group['SALE_QTY_CNS'].iloc[stockout_idx-4:stockout_idx]
        p_avg = base_sales.mean()
        
        # 기초체력이 목표치(10) 이하면 분석 제외
        if p_avg <= TARGET_END_SALES:
            return None
        
        # 2. 잔여 기간 (W) 산출
        stockout_date = group['END_DT'].iloc[stockout_idx]
        if stockout_date >= SEASON_END_DATE:
            return None
        
        days_remaining = (SEASON_END_DATE - stockout_date).days
        weeks_remaining = days_remaining / 7
        
        if weeks_remaining <= 0:
            return None
        
        # 3. 동적 감쇠율 (r) 역산: r = (10 / P_avg)^(1/W)
        decay_rate = (TARGET_END_SALES / p_avg) ** (1 / weeks_remaining)
        
        # 4. 예측 루프 (결품 시점부터 끝까지)
        results = []
        current_predicted = p_avg  # 초기값
        season_end_cutoff = pd.Timestamp('2025-10-30')  # 시즌 마감 기준일
        
        for i in range(stockout_idx, len(group)):
            date = group['END_DT'].iloc[i]
            actual_sale = group['SALE_QTY_CNS'].iloc[i]
            
            # 시즌 마감 이후(10월 30일 이후)는 AI 예측 0으로 설정
            if date > season_end_cutoff:
                predicted_int = 0
                loss = 0
            else:
                # 예측값 갱신 (감쇠 적용)
                current_predicted = current_predicted * decay_rate
                
                # 판매량은 정수여야 함
                predicted_int = int(round(current_predicted))
                
                # 기회비용 = max(0, 예측 - 실제)
                loss = max(0, predicted_int - actual_sale)
            
            results.append({
                'date': date,
                'actual_sale': actual_sale,
                'predicted_sale': predicted_int,
                'loss': loss
            })
        
        return pd.DataFrame(results)
        
    except Exception as e:
        print(f"    [오류] 기회비용 계산 실패: {str(e)}")
        return None

# ============================================
# 5. 전체 분석 실행
# ============================================
def run_analysis(weekly_df, part_info):
    """
    전체 품번에 대해 기회비용 분석 수행
    """
    print("[3단계] 기회비용 분석 수행 중...")
    
    results = []
    dashboard_updates = {}
    
    # PART_CD, COLOR_CD로 그룹화
    grouped = weekly_df.groupby(['PART_CD', 'COLOR_CD'])
    
    count = 0
    loss_count = 0
    skipped_short = 0
    no_stockout = 0
    low_velocity = 0
    past_season_end = 0
    zero_loss = 0
    error_count = 0
    
    for (part_cd, color_cd), group in grouped:
        count += 1
        
        # 데이터가 너무 적으면 스킵
        if len(group) < 4:
            skipped_short += 1
            continue
        
        try:
            # 상업적 결품 시점 감지
            stockout_result = detect_commercial_stockout(group)
            
            if not stockout_result:
                no_stockout += 1
                continue
            
            stockout_idx, stockout_date = stockout_result
            
            # 기회비용 계산
            loss_df = calculate_opportunity_loss(group, stockout_idx)
            
            if loss_df is None or loss_df.empty:
                # 제외 사유 확인
                base_sales = group['SALE_QTY_CNS'].iloc[stockout_idx-4:stockout_idx]
                p_avg = base_sales.mean()
                
                if p_avg <= TARGET_END_SALES:
                    low_velocity += 1
                elif stockout_date >= SEASON_END_DATE:
                    past_season_end += 1
                else:
                    zero_loss += 1
                continue
            
            # 총 기회비용 합계
            total_loss = loss_df['loss'].sum()
            
            if total_loss <= 0:
                zero_loss += 1
                continue
            
            # 결과 저장
            loss_count += 1
            
            # ITEM_NM 찾기
            item_nm = part_info[part_info['PART_CD'] == part_cd]['ITEM_NM'].iloc[0] if len(part_info[part_info['PART_CD'] == part_cd]) > 0 else part_cd
            
            # 엑셀 저장용 요약 정보
            results.append({
                'ITEM_NM': item_nm,
                'PART_CD': part_cd,
                'COLOR_CD': color_cd,
                '결품유형': '상업적 결품 (Broken Assortment)',
                '결품시점': stockout_date.strftime('%Y-%m-%d'),
                '총기회비용(수량)': total_loss
            })
            
            # 대시보드 업데이트용 데이터 준비
            pred_map = {row['date'].strftime('%m/%d'): row['predicted_sale'] for _, row in loss_df.iterrows()}
            
            dashboard_updates[(part_cd, color_cd)] = {
                'loss_qty': int(total_loss),
                'type': '상업적 결품 (Broken Assortment)',
                'predictions': pred_map
            }
            
        except Exception as e:
            error_count += 1
            if error_count <= 5:
                print(f"  [오류] {part_cd}/{color_cd} 분석 중 오류: {str(e)}")
        
        if count % 50 == 0:
            print(f"  ... {count}개 스타일/컬러 분석 완료 (발견된 손실 사례: {loss_count}건)")
    
    print(f"  * 최종 분석 완료: 총 {count}개 중 {loss_count}건에서 기회비용 발생")
    print(f"  * [디버깅] 제외 사유:")
    print(f"    - 데이터 부족(<4주): {skipped_short}건")
    print(f"    - 결품 미감지: {no_stockout}건")
    print(f"    - 기초체력 부족(P_avg<={TARGET_END_SALES}): {low_velocity}건")
    print(f"    - 시즌 종료일 지남: {past_season_end}건")
    print(f"    - 기회비용 0: {zero_loss}건")
    if error_count > 0:
        print(f"    - 오류 발생: {error_count}건")
    
    return pd.DataFrame(results), dashboard_updates

# ============================================
# 6. 결과 업데이트 (Excel & JSON)
# ============================================
def update_results(loss_summary_df, dashboard_updates):
    print("[4단계] 결과 파일 업데이트 중...")

    # [A] 엑셀 업데이트 - 전체 품번에 대해 AI제안 발주량 계산
    if os.path.exists(TARGET_FILE):
        try:
            # 첫 번째 시트 읽기
            df = pd.read_excel(TARGET_FILE)
            print(f"  * 시트 로드 완료: {len(df)}행")

            # 업데이트 카운터
            loss_updated = 0  # 기회비용 업데이트 건수
            order_updated = 0  # 발주량 업데이트 건수

            # 각 행에 대해 AI제안 발주량 계산
            for idx, row in df.iterrows():
                part_cd = row.get('PART_CD')
                color_cd = row.get('COLOR_CD')
                ai_diagnosis = str(row.get('AI_진단', ''))
                total_sale = row.get('총판매', 0)

                # 기회비용 계산 대상 확인 (Shortage 또는 Hit 적기소진)
                is_loss_target = ('Shortage' in ai_diagnosis) or ('Hit (적기' in ai_diagnosis)

                # 기회비용이 있는 경우 (dashboard_updates에 존재)
                if is_loss_target and (part_cd, color_cd) in dashboard_updates:
                    update_info = dashboard_updates[(part_cd, color_cd)]
                    loss_qty = update_info['loss_qty']

                    # AI계산 기회비용 업데이트
                    df.at[idx, 'AI계산 기회비용'] = loss_qty

                    # AI제안 발주량 계산: (총판매 + 기회비용) / 0.75, 10단위 올림
                    suggested_order = (total_sale + loss_qty) / 0.75
                    suggested_order_rounded = math.ceil(suggested_order / 10) * 10
                    df.at[idx, 'AI제안 발주량'] = int(suggested_order_rounded)

                    loss_updated += 1
                else:
                    # 기회비용 없는 경우: Hit(고효율), Normal, Risk
                    # AI계산 기회비용 = 0
                    df.at[idx, 'AI계산 기회비용'] = 0

                    # AI제안 발주량 = 총판매 / 0.75, 10단위 올림
                    if total_sale > 0:
                        suggested_order = total_sale / 0.75
                        suggested_order_rounded = math.ceil(suggested_order / 10) * 10
                        df.at[idx, 'AI제안 발주량'] = int(suggested_order_rounded)
                    else:
                        df.at[idx, 'AI제안 발주량'] = 0

                order_updated += 1

            # 파일 저장 (원본 시트 업데이트)
            df.to_excel(TARGET_FILE, index=False)
            print(f"  * 엑셀 업데이트 완료:")
            print(f"    - 기회비용 반영: {loss_updated}건")
            print(f"    - AI제안 발주량 계산: {order_updated}건")
            
        except Exception as e:
            print(f"  [오류] 엑셀 업데이트 실패: {str(e)}")
            import traceback
            traceback.print_exc()
    else:
        print(f"  [오류] 대상 엑셀 파일({TARGET_FILE})이 없습니다.")

    # [B] JSON 업데이트
    if os.path.exists(JSON_FILE):
        try:
            with open(JSON_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)

            updated_count = 0

            def update_style_entry(style_entry, dashboard_updates):
                """스타일 엔트리의 colors와 total 데이터를 업데이트하는 헬퍼 함수"""
                nonlocal updated_count
                colors_data = style_entry.get('colors', {})

                # [1] 각 컬러별 데이터 업데이트
                for color_key, entry in colors_data.items():
                    item_info = entry.get('itemInfo', {})
                    if not item_info: continue

                    code = item_info.get('code')  # PART_CD
                    color = item_info.get('color')  # COLOR_CD

                    # 업데이트할 데이터가 있는지 확인
                    if (code, color) in dashboard_updates:
                        update_info = dashboard_updates[(code, color)]
                        predictions = update_info['predictions']

                        # analysis 정보 업데이트
                        if 'analysis' not in entry: entry['analysis'] = {}
                        entry['analysis']['예상손실수량'] = update_info['loss_qty']
                        entry['analysis']['AI_진단_상세'] = update_info['type']

                        # chartData 업데이트 (잠재수요 및 Loss 주입)
                        chart_data = entry.get('chartData', [])

                        for point in chart_data:
                            date_key = point.get('date')

                            # 해당 날짜에 예측 데이터가 있으면 주입
                            if date_key in predictions:
                                point['potential_sale'] = predictions[date_key]

                                try:
                                    actual_sale = int(point.get('sale', 0))
                                except:
                                    actual_sale = 0

                                point['loss'] = max(0, point['potential_sale'] - actual_sale)
                            else:
                                try:
                                    actual_sale = int(point.get('sale', 0))
                                except:
                                    actual_sale = 0
                                point['potential_sale'] = actual_sale
                                point['loss'] = 0

                        updated_count += 1

                # [2] Total 데이터 업데이트: 각 컬러의 AI 예측과 Loss를 주차별로 합산
                total_data = style_entry.get('total', {})
                if total_data and colors_data:
                    total_chart_data = total_data.get('chartData', [])

                    # 주차별 AI 예측 및 Loss 합산 맵 생성
                    date_prediction_sum = {}
                    date_loss_sum = {}

                    for color_key, entry in colors_data.items():
                        chart_data = entry.get('chartData', [])
                        for point in chart_data:
                            date_key = point.get('date')
                            potential_sale = point.get('potential_sale', 0)
                            loss = point.get('loss', 0)

                            if date_key:
                                date_prediction_sum[date_key] = date_prediction_sum.get(date_key, 0) + potential_sale
                                date_loss_sum[date_key] = date_loss_sum.get(date_key, 0) + loss

                    # Total chartData에 합산된 AI 예측 및 Loss 주입
                    for point in total_chart_data:
                        date_key = point.get('date')
                        if date_key in date_prediction_sum:
                            point['potential_sale'] = date_prediction_sum[date_key]
                            point['loss'] = date_loss_sum.get(date_key, 0)
                        else:
                            # AI 예측이 없는 주차는 실제 판매량과 동일하게 설정
                            try:
                                actual_sale = int(point.get('sale', 0))
                            except:
                                actual_sale = 0
                            point['potential_sale'] = actual_sale
                            point['loss'] = 0

            # success/failure 카테고리 순회 (진단별 중첩 구조)
            for category in ['success', 'failure']:
                if not data.get(category): continue

                category_data = data[category]

                # 진단별 중첩 구조 처리: {"hit": [...], "normal": [...]} 등
                if isinstance(category_data, dict):
                    for diagnosis_key, style_list in category_data.items():
                        if not isinstance(style_list, list):
                            continue
                        for style_entry in style_list:
                            update_style_entry(style_entry, dashboard_updates)
                else:
                    # 이전 단일 객체/배열 구조 호환성
                    category_list = category_data if isinstance(category_data, list) else [category_data]
                    for style_entry in category_list:
                        update_style_entry(style_entry, dashboard_updates)

            # 파일 저장
            with open(JSON_FILE, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)

            # Public 폴더 업데이트 (React 앱용)
            if os.path.exists('../public'):
                with open('../public/dashboard_data.json', 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)

            print(f"  * 대시보드 데이터 업데이트 완료: {updated_count}개 컬러 데이터 반영")

        except Exception as e:
            print(f"  [오류] JSON 업데이트 실패: {str(e)}")
            import traceback
            traceback.print_exc()
    else:
        print(f"  [경고] 대시보드 데이터 파일({JSON_FILE})이 없습니다.")

# ============================================
# 메인 실행
# ============================================
def main():
    # 1. 기회비용 계산 대상 품번 추출
    result = extract_loss_part_codes()
    if result[0] is None and result[2] is None:
        print("  ! 데이터를 로드할 수 없습니다.")
        return

    part_codes, part_info, full_df = result

    # 2. 기회비용 계산 대상이 있는 경우 분석 실행
    updates = {}
    if part_codes is not None:
        # 원본 시계열 데이터 로드
        weekly_df = load_weekly_data(part_codes)
        if weekly_df is not None:
            # 기회비용 분석 실행
            loss_summary, updates = run_analysis(weekly_df, part_info)
            print(f"  * 기회비용 분석 완료: {len(updates)}건")
        else:
            print("  [경고] 시계열 데이터 로드 실패, 기회비용 없이 발주량만 계산합니다.")
    else:
        print("  * 기회비용 계산 대상 없음, 발주량만 계산합니다.")

    # 3. 결과 저장 (전체 품번에 대해 AI제안 발주량 계산)
    update_results(None, updates)

    print("=" * 60)
    print("분석 완료")
    print("=" * 60)

if __name__ == "__main__":
    main()

