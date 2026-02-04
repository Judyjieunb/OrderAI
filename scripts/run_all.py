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

def main():
    print("\n* 25S 시즌 분석 자동화 시스템 시작\n")
    
    scripts = [
        ("main.py", "STEP 1: 시즌 마감 분석 & 기본 데이터 처리"),
        ("weekly_analysis.py", "STEP 2: 시계열 패턴 분석 & 대시보드 데이터 생성 (기초)"),
        ("ai_sales_loss_v2.py", "STEP 3: AI 수요 예측 & 기회비용 분석 (심화)"),
        ("step4_integration.py", "STEP 4: 유사스타일 맵핑 → 당시즌 발주 제안"),
    ]
    
    success_count = 0
    
    for script, desc in scripts:
        if run_script(script, desc):
            success_count += 1
        else:
            print("* 스크립트 실행 실패로 인해 전체 프로세스를 중단합니다.")
            break
            
    print("=" * 60)
    if success_count == len(scripts):
        print(f"* 모든 분석이 성공적으로 완료되었습니다! ({success_count}/{len(scripts)})")
        print("   - 결과 파일: 25S_Analysis_Result.xlsx")
        print("   - 결과 파일: 25S_TimeSeries_Analysis_Result.xlsx")
        print("   - 대시보드: dashboard_data.json")
        print("   - 발주 제안: 26S_Order_Recommendation.xlsx")
    else:
        print(f"* 일부 과정이 완료되지 않았습니다. ({success_count}/{len(scripts)})")
    print("=" * 60)

    # 일시 정지 (콘솔 창이 바로 닫히지 않도록)
    if os.name == 'nt': # Windows인 경우
        os.system('pause')

if __name__ == "__main__":
    main()
