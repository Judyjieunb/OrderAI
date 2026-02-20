import subprocess
import sys
import time
import os

def run_script(script_name, description):
    print("=" * 60)
    print(f"* 실행 중: {script_name}")
    print(f"   ({description})")
    print("=" * 60)

    start_time = time.time()
    try:
        # python 인터프리터로 스크립트 실행
        # unbuffered 모드(-u)로 실행하여 출력을 즉시 확인 + utf-8 인코딩 설정
        env = os.environ.copy()
        env["PYTHONIOENCODING"] = "utf-8"

        result = subprocess.run(
            [sys.executable, "-u", script_name],
            check=True,
            text=True,
            env=env
        )

        elapsed = time.time() - start_time
        print(f"\n* {script_name} 완료 (소요시간: {elapsed:.2f}초)\n")
        return True

    except subprocess.CalledProcessError as e:
        print(f"\n* {script_name} 실행 실패 (Exit Code: {e.returncode})\n")
        return False
    except Exception as e:
        print(f"\n* 오류 발생: {str(e)}\n")
        return False

def check_config():
    """brand_config.json 존재 여부 확인"""
    config_path = os.path.join(os.path.dirname(__file__), '..', 'public', 'brand_config.json')
    if os.path.exists(config_path):
        print(f"[Config] brand_config.json 발견 → 사용자 설정 적용")
    else:
        print(f"[Config] brand_config.json 없음 → 기본값 사용")

def main():
    pipeline_start = time.time()
    print("\n" + "=" * 60)
    print("  25S 시즌 분석 자동화 시스템 (6-Step Pipeline)")
    print("=" * 60 + "\n")

    check_config()
    print()

    scripts = [
        ("main.py",              "STEP 1: 시즌 마감 분석 & 기본 데이터 처리"),
        ("budget_proposal.py",   "STEP 2: AI 예산 제안 (룰 기반)"),
        ("weekly_analysis.py",   "STEP 3: 시계열 패턴 분석 & 대시보드 데이터 생성"),
        ("ai_sales_loss_v2.py",  "STEP 4: AI 수요 예측 & 기회비용 분석"),
        ("step4_integration.py", "STEP 5: 유사스타일 맵핑 데이터 생성 (프론트엔드용)"),
        ("generate_size_data.py","STEP 6: 사이즈 배분 데이터 생성"),
    ]

    success_count = 0

    for script, desc in scripts:
        if run_script(script, desc):
            success_count += 1
        else:
            print("* 스크립트 실행 실패로 인해 전체 프로세스를 중단합니다.")
            break

    total_elapsed = time.time() - pipeline_start

    print("=" * 60)
    if success_count == len(scripts):
        print(f"* 모든 분석이 성공적으로 완료되었습니다! ({success_count}/{len(scripts)})")
        print("   - 결과 파일: 25S_Analysis_Result.xlsx")
        print("   - 예산 설정: budget_config.json")
        print("   - 결과 파일: 25S_TimeSeries_Analysis_Result.xlsx")
        print("   - 대시보드: dashboard_data.json")
        print("   - 발주 제안: 26S_Order_Recommendation.xlsx")
        print("   - 사이즈 데이터: size_assortment_data.json")
    else:
        print(f"* 일부 과정이 완료되지 않았습니다. ({success_count}/{len(scripts)})")
    print(f"\n* 전체 파이프라인 소요시간: {total_elapsed:.1f}초")
    print("=" * 60)

    # 일시 정지 (콘솔 창이 바로 닫히지 않도록)
    if os.name == 'nt': # Windows인 경우
        os.system('pause')

if __name__ == "__main__":
    main()
