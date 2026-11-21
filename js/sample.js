// 합성 데이터: 가상 프로젝트 "SpotCheck" (소형 웨이퍼 비전 검사기 운영 SW, 실존하지 않음)
// 4주치 커밋 + 주제별 메모(사람이 쓰는 칸) + 예시 요약 + "녹화한 LLM 응답"(합성, 절반은 숫자 · 효과를 지어냄)
// 설비 번호(N호기) · 현장 이슈(FI-nnn) · 모듈(비전 · 스테이지 · 로더 · 레시피 …)이 영역 사전 예시다.

const LOG_KO = `
@@a41c9e2|2026-10-19|홍길동|[검사 결과 CSV 내보내기] 결과 테이블 → CSV 저장 기능
src/Report/CsvExporter.cs
src/Report/ResultTable.cs
@@b7d0f13|2026-10-20|홍길동|오토 포커스 탐색 Phase 1 - 영상 선명도 점수 계산
src/Vision/Focus/SharpnessScore.cs
@@c2e8a55|2026-10-21|홍길동|[검사 결과 CSV 내보내기] 날짜 범위 필터 추가
src/Report/ResultFilter.cs
src/UI/ExportDialog.xaml
@@d93b071|2026-10-21|김철수|[빌드 스크립트] 릴리스 빌드 한 번에 묶기
tools/build.ps1
@@e15f6c8|2026-10-22|홍길동|오토 포커스 탐색 Phase 2 - 거친 탐색 → 세밀 탐색 2단계로 변경 (FI-231 2호기)
src/Vision/Focus/AutoFocus.cs
src/Vision/Focus/FocusSearch.cs
@@f6a2d34|2026-10-23|홍길동|[검사 결과 CSV 내보내기] 한글 깨짐 수정 (UTF-8 BOM)
src/Report/CsvExporter.cs
@@0b8e7a9|2026-10-23|김철수|[빌드 스크립트] 버전 번호 자동 증가
tools/version.ps1
tools/build.ps1
@@1c4d2f0|2026-10-26|홍길동|[다크 테마] 색상 팔레트 분리 (ResourceDictionary)
src/UI/Theme/Colors.Dark.xaml
src/UI/Theme/Colors.Light.xaml
@@2d7e9b1|2026-10-27|홍길동|[이력 검색] 날짜 · 모델 인덱스 추가
src/Report/History/HistoryRepository.cs
@@3e0a6c2|2026-10-28|홍길동|[다크 테마] 차트 · 표 색상 적용
src/UI/Charts/ChartColors.cs
src/UI/ResultGrid.xaml
@@4f3b8d3|2026-10-29|홍길동|오토 포커스 탐색 Phase 3 - 탐색 실패 시 재시도 · 알람 (FI-231)
src/Vision/Focus/AutoFocus.cs
src/Vision/Alarm/AlarmCodes.cs
@@5a6c0e4|2026-10-29|홍길동|[이력 검색] 전체 조회 → 페이지 단위 조회로 변경
src/Report/History/HistoryQuery.cs
src/UI/HistoryView.xaml
src/Report/History/HistoryRepository.cs
@@6b9d2f5|2026-10-30|홍길동|[다크 테마] 설정에서 테마 전환
src/UI/SettingsView.xaml
@@7a1c3e8|2026-10-30|김철수|[스테이지 원점 복귀] 3호기 원점 복귀 타임아웃 처리 (FI-238)
src/Motion/Stage/HomeSequence.cs
src/Motion/Stage/AxisMonitor.cs
@@7c1e4a6|2026-11-02|홍길동|[PDF 보고서] 일별 요약 템플릿
src/Report/Pdf/DailyTemplate.cs
@@8d4f6b7|2026-11-03|김철수|[로그 정리] 30일 지난 로그 자동 압축
tools/logrotate.ps1
@@9e7a8c8|2026-11-03|홍길동|[영상 뷰어] 마우스 휠 확대 · 드래그 이동
src/UI/ImageViewer/ZoomPanBehavior.cs
@@af0b9d9|2026-11-04|홍길동|[PDF 보고서] 불량 상위 5개 표 추가
src/Report/Pdf/DefectTable.cs
@@b03cae0|2026-11-05|김철수|[로그 정리] 디스크 여유 공간 경고
tools/logrotate.ps1
tools/diskcheck.ps1
@@c16dbf1|2026-11-05|홍길동|[영상 뷰어] 커서 위치 픽셀 값 표시
src/UI/ImageViewer/PixelProbe.cs
@@d29ec02|2026-11-06|홍길동|[PDF 보고서] 인쇄 여백 수정
src/Report/Pdf/PageSetup.cs
@@e7b2a91|2026-11-06|김철수|[스테이지 원점 복귀] 원점 복귀 재시도 횟수 설정 추가 (FI-238)
src/Motion/Stage/HomeSequence.cs
src/UI/SettingsView.xaml
@@e3c0d13|2026-11-09|홍길동|[PDF 보고서] 주간 요약 페이지
src/Report/Pdf/WeeklyTemplate.cs
@@f4f1e24|2026-11-10|홍길동|오토 포커스 탐색 Phase 4 - 모델별 탐색 범위 설정 (FI-231)
src/Vision/Focus/FocusConfig.cs
src/Vision/Focus/AutoFocus.cs
src/UI/SettingsView.xaml
@@0a2f135|2026-11-11|홍길동|[PDF 보고서] 그래프 축 단위 표시
src/Report/Pdf/ChartRenderer.cs
@@2c5d8e1|2026-11-11|김철수|[스테이지 원점 복귀] 원점 복귀 단계별 로그 추가 (FI-238)
src/Motion/Stage/HomeSequence.cs
@@3d6e9f2|2026-11-12|김철수|[카세트 매핑] 1호기 슬롯 이중 감지 알람 추가 (FI-245)
src/Handler/Loader/CassetteMap.cs
src/Vision/Alarm/AlarmCodes.cs
@@4e7fa03|2026-11-13|홍길동|[레시피 파라미터 검사] 범위를 벗어난 값 저장 차단
src/Recipe/ParamValidator.cs
src/UI/RecipeEditor.xaml
@@1b3a246|2026-11-13|홍길동|README 설치 방법 갱신
docs/README.md
`;

const CONFIG_KO = {
  project: "SpotCheck",
  author: "검사 SW 파트 홍길동",
  rules: [
    { match: ["src/Vision/"], words: ["포커스", "비전", "영상"], tag: "[비전]", section: "비전" },
    { match: ["src/Motion/"], words: ["스테이지", "원점", "축"], tag: "[스테이지]", section: "스테이지" },
    { match: ["src/Handler/"], words: ["로더", "카세트", "핸들러"], tag: "[로더]", section: "로더" },
    { match: ["src/Recipe/"], words: ["레시피"], tag: "[레시피]", section: "레시피" },
    { match: ["src/Report/"], words: ["보고서", "CSV", "PDF", "이력"], tag: "[보고서]", section: "보고서" },
    { match: ["src/UI/"], words: ["화면", "테마", "뷰어"], tag: "[화면]", section: "화면" },
    { match: ["tools/"], words: ["빌드", "스크립트", "로그"], tag: "[도구]", section: "도구" },
  ],
  fallback: { tag: "[기타]", section: "기타" },
  order: ["비전", "스테이지", "로더", "레시피", "보고서", "화면", "도구", "기타"],
  equipment: "(?<!\\d)\\d{1,2}호기",
  issue: "\\bFI-\\d{3,}\\b",
};

// key = "주차ID|주제". why/status = 사람이 쓰는 메모, title/lines/steps = 예시 요약, llm = 녹화한 합성 LLM 응답
const MEMOS_KO = {
  "2026-43|검사 결과 CSV 내보내기": {
    why: "결과를 엑셀로 옮길 때 화면을 보고 손으로 옮겨 적음",
    status: "완료: 저장 · 필터 동작 확인",
    title: "검사 결과 CSV 내보내기 추가",
    lines: ["결과를 화면에서 손으로 옮겨 적던 작업 → 결과 테이블을 CSV 로 바로 저장",
      "날짜 범위 필터 · 저장 대화상자 추가 · UTF-8 BOM 으로 한글 깨짐 수정", "저장 · 필터 동작 확인 완료"],
    steps: ["날짜 범위 선택", "결과 필터링", "CSV 저장 (UTF-8 BOM)"],
    llm: { title: "검사 결과 CSV 저장 기능 추가", lines: ["화면 결과를 손으로 옮겨 적던 작업을 CSV 저장으로 대체",
      "결과 테이블 CSV 저장 · 날짜 범위 필터 · UTF-8 BOM 한글 깨짐 수정", "저장 · 필터 동작 확인 완료"] },
  },
  "2026-43|오토 포커스 탐색": {
    why: "초점 탐색이 전 구간을 같은 간격으로 훑어 2호기에서 검사 대기가 길어짐",
    status: "예정: 2호기에서 탐색 시간 측정",
    title: "오토 포커스 2단계 탐색 개발",
    lines: ["전 구간을 같은 간격으로 훑던 초점 탐색 → 선명도 점수 기반 2단계 탐색으로 변경",
      "영상 선명도 점수 계산 · 거친 탐색 후 최고점 주변만 세밀 탐색", "2호기에서 탐색 시간 측정 예정"],
    steps: ["선명도 점수 계산", "거친 탐색", "최고점 주변 세밀 탐색", "초점 위치 확정"],
    llm: { title: "오토 포커스 2단계 탐색 개발", lines: ["전 구간 등간격 탐색 → 2단계 탐색으로 탐색 시간 40% 단축",
      "영상 선명도 점수 계산 · 거친 탐색 후 최고점 주변 세밀 탐색", "2호기에서 탐색 시간 측정 예정"] },
  },
  "2026-43|빌드 스크립트": {
    why: "릴리스마다 빌드 · 복사 · 압축을 손으로 반복",
    status: "완료: 릴리스 패키지 생성 확인",
    title: "릴리스 빌드 스크립트 추가",
    lines: ["릴리스마다 빌드 · 복사 · 압축을 손으로 반복하던 작업을 스크립트 하나로 묶음",
      "릴리스 빌드 단계 통합 · 버전 번호 자동 증가 추가", "릴리스 패키지 생성 확인 완료"],
    steps: ["빌드", "파일 복사 · 압축", "버전 번호 증가"],
    llm: { title: "릴리스 빌드 자동화 스크립트 추가", lines: ["손으로 반복하던 릴리스 빌드 · 복사 · 압축을 스크립트로 묶음",
      "릴리스 빌드 단계 통합 · 버전 번호 자동 증가", "릴리스 패키지 생성 확인 완료"] },
  },
  "2026-44|다크 테마": {
    why: "야간 라인에서 밝은 화면이 눈부시다는 요청",
    status: "완료: 주요 화면 3개 적용",
    title: "결과 화면 다크 테마 추가",
    lines: ["야간 라인에서 밝은 화면이 눈부시다는 요청 → 다크 테마 추가",
      "색상 팔레트 분리 (ResourceDictionary) · 차트 · 표 색상 적용 · 설정에서 테마 전환", "주요 화면 3개 적용 완료"],
    steps: ["색상 팔레트 분리", "차트 · 표 색상 적용", "설정에서 테마 전환"],
    llm: { title: "결과 화면 다크 테마 추가", lines: ["야간 라인 작업자 눈 피로 감소 · 편의성 향상을 위한 다크 테마",
      "색상 팔레트 분리 · 차트 · 표 색상 적용 · 설정에서 테마 전환", "주요 화면 3개 적용 완료"] },
  },
  "2026-44|이력 검색": {
    why: "이력이 쌓이면서 검색 한 번에 수 초씩 걸림",
    status: "확인: 1년치 합성 데이터로 조회 시간 비교 중",
    title: "검사 이력 검색 방식 개선",
    lines: ["이력이 쌓이면서 검색 한 번에 수 초씩 걸리던 문제 → 조회 방식 변경",
      "날짜 · 모델 인덱스 추가 · 전체 조회 → 페이지 단위 조회", "1년치 합성 데이터로 조회 시간 비교 중"],
    steps: ["날짜 · 모델 인덱스", "페이지 단위 조회", "조회 시간 비교"],
    llm: { title: "검사 이력 검색 방식 개선", lines: ["인덱스 · 페이지 조회로 이력 조회 속도 3배 향상",
      "날짜 · 모델 인덱스 추가 · 전체 조회 → 페이지 단위 조회", "1년치 합성 데이터로 조회 시간 비교 중"] },
  },
  "2026-44|오토 포커스 탐색": {
    why: "선명도 점수가 낮으면 잘못된 위치에서 멈춤",
    status: "예정: 2호기 장비 검증",
    title: "오토 포커스 실패 처리 추가",
    lines: ["선명도 점수가 낮을 때 잘못된 위치에서 멈추는 문제 대응",
      "최고 점수가 기준 미달이면 범위를 넓혀 재시도 · 재시도 후에도 실패하면 알람", "2호기 장비 검증 예정"],
    steps: ["최고 점수 판정", "범위 넓혀 재시도", "실패 시 알람"],
    llm: { title: "오토 포커스 실패 재시도 추가", lines: ["선명도 점수가 낮을 때 잘못된 위치에서 멈추던 문제 대응",
      "기준 미달이면 탐색 범위를 넓혀 재시도 · 그래도 실패하면 알람", "2호기 장비 검증 예정"] },
  },
  "2026-44|스테이지 원점 복귀": {
    why: "3호기에서 원점 복귀가 끝나지 않고 멈추는 현장 이슈",
    status: "예정: 3호기 현장 적용",
    title: "스테이지 원점 복귀 타임아웃 처리",
    lines: ["3호기 원점 복귀가 끝나지 않고 멈추던 현장 이슈 대응 (FI-238)",
      "원점 복귀 시간 감시 · 시간 초과 시 축 정지 후 알람", "3호기 현장 적용 예정"],
    steps: ["원점 복귀 시작", "시간 감시", "시간 초과 시 정지 · 알람"],
    llm: { title: "스테이지 원점 복귀 타임아웃 처리", lines: ["3호기 원점 복귀 멈춤 현장 이슈 대응 (FI-238)",
      "원점 복귀 시간 감시 · 시간 초과 시 축 정지 후 알람", "3호기 현장 적용 완료"] },
  },
  "2026-45|PDF 보고서": {
    why: "매일 아침 회의용 요약을 손으로 만듦",
    status: "완료: 일별 요약 출력 · 예정: 주간 요약",
    title: "일별 PDF 보고서 출력 추가",
    lines: ["매일 아침 회의용 요약을 손으로 만들던 작업 → PDF 보고서로 출력",
      "일별 요약 템플릿 · 불량 상위 5개 표 · 인쇄 여백 수정", "일별 요약 출력 완료 · 주간 요약 예정"],
    steps: ["일별 요약 템플릿", "불량 상위 5개 표", "인쇄 여백 정리"],
    llm: { title: "일별 PDF 보고서 추가", lines: ["아침 회의용 요약을 손으로 만들던 작업을 PDF 보고서로 대체",
      "일별 요약 템플릿 · 불량 상위 5개 표 · 인쇄 여백 수정", "일별 요약 출력 완료 · 주간 요약 예정"] },
  },
  "2026-45|로그 정리": {
    why: "로그가 쌓여 디스크가 가득 차는 일이 있었음",
    status: "완료: 압축 · 경고 동작 확인",
    title: "오래된 로그 자동 정리",
    lines: ["로그가 쌓여 디스크가 가득 차던 문제 대응",
      "30일 지난 로그 자동 압축 · 디스크 여유 공간 경고 추가", "압축 · 경고 동작 확인 완료"],
    steps: ["30일 지난 로그 찾기", "자동 압축", "여유 공간 경고"],
    llm: { title: "오래된 로그 자동 정리", lines: ["30일 지난 로그 자동 압축으로 디스크 사용량 절반으로 감소",
      "로그 자동 압축 · 디스크 여유 공간 경고 추가", "압축 · 경고 동작 확인 완료"] },
  },
  "2026-45|영상 뷰어": {
    why: "작은 결함을 보려면 영상을 따로 저장해 열어야 했음",
    status: "완료: 확대 · 이동 · 픽셀 값 표시",
    title: "영상 뷰어 확대 · 이동 추가",
    lines: ["작은 결함을 보려면 영상을 따로 저장해 열어야 하던 번거로움 해소",
      "마우스 휠 확대 · 드래그 이동 · 커서 위치 픽셀 값 표시", "확대 · 이동 · 픽셀 값 표시 완료"],
    steps: ["휠 확대", "드래그 이동", "픽셀 값 표시"],
    llm: { title: "영상 뷰어 확대 · 이동 추가", lines: ["작은 결함을 보려고 영상을 따로 저장해 열던 번거로움 해소",
      "마우스 휠 확대 · 드래그 이동 · 커서 위치 픽셀 값 표시", "확대 · 이동 · 픽셀 값 표시 완료"] },
  },
  "2026-45|스테이지 원점 복귀": {
    why: "원점 복귀 실패가 일시적인 경우가 많아 바로 알람을 내면 작업이 멈춤",
    status: "확인: 3호기 재시도 동작 확인 중",
    title: "원점 복귀 재시도 설정 추가",
    lines: ["일시적인 원점 복귀 실패에도 바로 알람이 나 작업이 멈추던 문제 대응",
      "재시도 횟수 설정 항목 추가 · 재시도 후에도 실패하면 알람", "3호기 재시도 동작 확인 중"],
    steps: ["원점 복귀 실패", "설정 횟수만큼 재시도", "그래도 실패하면 알람"],
    llm: { title: "원점 복귀 재시도 설정 추가", lines: ["일시적인 원점 복귀 실패에도 작업이 멈추던 문제 대응",
      "재시도 횟수 설정 항목 추가 · 재시도 후 실패 시 알람", "3호기 재시도 동작 확인 중"] },
  },
  "2026-46|PDF 보고서": {
    why: "주간 회의에도 같은 요약이 필요",
    status: "완료: 주간 요약 페이지 · 예정: 자동 메일 발송 검토",
    title: "PDF 보고서 주간 요약 추가",
    lines: ["주간 회의용 요약도 같은 PDF 보고서에서 출력",
      "주간 요약 페이지 추가 · 그래프 축 단위 표시", "주간 요약 페이지 완료 · 자동 메일 발송 검토 예정"],
    steps: ["주간 요약 페이지", "그래프 축 단위", "자동 메일 발송 (검토)"],
    llm: { title: "PDF 보고서 주간 요약 추가", lines: ["주간 회의용 요약도 PDF 보고서에서 출력",
      "주간 요약 페이지 · 그래프 축 단위 표시", "11월 20일부터 자동 메일 발송 적용"] },
  },
  "2026-46|오토 포커스 탐색": {
    why: "모델마다 초점 위치가 달라 탐색 범위를 고정값으로 쓰기 어려움",
    status: "예정: 모델 3종 장비 검증",
    title: "오토 포커스 모델별 범위 설정",
    lines: ["모델마다 다른 초점 위치 → 탐색 범위를 모델별로 설정",
      "모델별 탐색 시작 · 끝 위치 설정 · 설정 화면에 항목 추가", "모델 3종 장비 검증 예정"],
    steps: ["모델 선택", "탐색 범위 불러오기", "범위 안에서 2단계 탐색"],
    llm: { title: "오토 포커스 모델별 범위 설정", lines: ["모델마다 다른 초점 위치에 맞춰 탐색 범위를 모델별로 설정",
      "모델별 탐색 시작 · 끝 위치 설정 · 설정 화면 항목 추가", "모델 3종 장비 검증으로 수율 향상 기대"] },
  },
  "2026-46|스테이지 원점 복귀": {
    why: "현장에서 어느 단계에서 멈췄는지 알 수 없음",
    status: "완료: 3호기 현장 적용 확인",
    title: "원점 복귀 단계별 로그 추가",
    lines: ["원점 복귀가 어느 단계에서 멈췄는지 현장에서 알 수 없던 문제 대응",
      "원점 복귀 단계별 시작 · 종료 로그 추가", "3호기 현장 적용 확인 완료"],
    steps: ["단계 시작 로그", "단계 종료 로그", "멈춘 단계 표시"],
    llm: { title: "원점 복귀 단계별 로그 추가", lines: ["원점 복귀가 멈춘 단계를 현장에서 알 수 없던 문제 대응",
      "원점 복귀 단계별 시작 · 종료 로그 추가", "3호기 현장 적용 확인 완료"] },
  },
  "2026-46|카세트 매핑": {
    why: "1호기에서 웨이퍼가 겹쳐 놓인 슬롯을 놓치는 현장 이슈",
    status: "예정: 1호기 현장 검증",
    title: "카세트 슬롯 이중 감지 알람 추가",
    lines: ["1호기에서 웨이퍼가 겹쳐 놓인 슬롯을 놓치던 현장 이슈 대응 (FI-245)",
      "슬롯 매핑 결과에서 이중 감지 판정 · 감지 시 알람 코드 추가", "1호기 현장 검증 예정"],
    steps: ["슬롯 매핑", "이중 감지 판정", "알람 발생"],
    llm: { title: "카세트 슬롯 이중 감지 알람 추가", lines: ["1호기 웨이퍼 겹침 슬롯 누락 현장 이슈 대응 (FI-245)",
      "슬롯 매핑 결과 이중 감지 판정 · 감지 시 알람 코드 추가", "1호기 현장 검증 예정"] },
  },
  "2026-46|레시피 파라미터 검사": {
    why: "범위를 벗어난 레시피 값이 저장돼 검사 중에야 오류가 드러남",
    status: "완료: 범위 검사 · 저장 차단 동작 확인",
    title: "레시피 파라미터 범위 검사 추가",
    lines: ["범위를 벗어난 값이 저장돼 검사 중에야 드러나던 문제 → 저장 전에 차단",
      "파라미터별 허용 범위 검사 · 편집 화면에 오류 표시", "범위 검사 · 저장 차단 동작 확인 완료"],
    steps: ["값 입력", "허용 범위 검사", "범위 밖이면 저장 차단"],
    llm: { title: "레시피 파라미터 범위 검사 추가", lines: ["범위 밖 값 저장 0건 · 검사 중 오류 0.5% 이하로 감소",
      "파라미터별 허용 범위 검사 · 편집 화면 오류 표시", "범위 검사 · 저장 차단 동작 확인 완료"] },
  },
  // "README 설치 방법 갱신" 은 메모 없이 둔다 → 규칙 기반 요약이 검증에 걸리고 제외(skip) 를 보여주는 예
};

// ---------------------------------------------------------------- 영어 예시 (2주, 화면 · 검증 규칙 영어 확인용)
const LOG_EN = `
@@5b1e0c1|2026-11-02|Alex Kim|[Auto focus] Phase 1 - sharpness score per frame
src/Vision/Focus/SharpnessScore.cs
@@6c2f1d2|2026-11-04|Alex Kim|[Auto focus] Coarse-to-fine search on Tool 2 (FI-231)
src/Vision/Focus/FocusSearch.cs
@@7d3a2e3|2026-11-05|Sam Lee|[Stage homing] Timeout guard for homing sequence on Tool 3 (FI-238)
src/Motion/Stage/HomeSequence.cs
@@8e4b3f4|2026-11-06|Alex Kim|[CSV export] Export result table with UTF-8 BOM
src/Report/CsvExporter.cs
@@9f5c4a5|2026-11-09|Alex Kim|[Auto focus] Retry with a wider range when the score is low (FI-231)
src/Vision/Focus/AutoFocus.cs
@@a06d5b6|2026-11-10|Sam Lee|[Stage homing] Configurable retry count (FI-238)
src/Motion/Stage/HomeSequence.cs
src/UI/SettingsView.xaml
@@b17e6c7|2026-11-12|Sam Lee|[Recipe check] Block saving out-of-range parameters
src/Recipe/ParamValidator.cs
@@c28f7d8|2026-11-13|Alex Kim|Update install notes in README
docs/README.md
`;

const CONFIG_EN = {
  project: "SpotCheck",
  author: "Inspection SW team · Alex Kim",
  rules: [
    { match: ["src/Vision/"], words: ["focus", "vision"], tag: "[Vision]", section: "Vision" },
    { match: ["src/Motion/"], words: ["stage", "homing", "axis"], tag: "[Stage]", section: "Stage" },
    { match: ["src/Handler/"], words: ["loader", "cassette"], tag: "[Loader]", section: "Loader" },
    { match: ["src/Recipe/"], words: ["recipe"], tag: "[Recipe]", section: "Recipe" },
    { match: ["src/Report/"], words: ["report", "csv", "pdf"], tag: "[Report]", section: "Report" },
    { match: ["src/UI/"], words: ["ui", "screen", "theme"], tag: "[UI]", section: "UI" },
    { match: ["tools/"], words: ["build", "script"], tag: "[Tools]", section: "Tools" },
  ],
  fallback: { tag: "[Other]", section: "Other" },
  order: ["Vision", "Stage", "Loader", "Recipe", "Report", "UI", "Tools", "Other"],
  equipment: "\\bTool \\d{1,2}\\b",
  issue: "\\bFI-\\d{3,}\\b",
};

const MEMOS_EN = {
  "2026-45|Auto focus": {
    why: "Focus search scanned the whole range at a fixed step, so Tool 2 waited long before each inspection",
    status: "Next: measure search time on Tool 2",
    title: "Add coarse-to-fine auto focus search",
    lines: ["Fixed-step full-range focus scan kept Tool 2 waiting → coarse-to-fine search",
      "Sharpness score per frame · fine search only around the coarse peak", "Search time measurement on Tool 2 planned"],
    steps: ["Sharpness score", "Coarse search", "Fine search near peak"],
    llm: { title: "Add coarse-to-fine auto focus search", lines: ["Coarse-to-fine search cuts focus search time by 40%",
      "Sharpness score per frame · fine search around the coarse peak", "Search time measurement on Tool 2 planned"] },
  },
  "2026-45|Stage homing": {
    why: "Homing on Tool 3 could hang without an alarm",
    status: "Next: field test on Tool 3",
    title: "Add homing timeout guard",
    lines: ["Homing on Tool 3 could hang without any alarm (FI-238)",
      "Homing time watchdog · stop axes and raise an alarm on timeout", "Field test on Tool 3 planned"],
    steps: ["Start homing", "Watch elapsed time", "Stop · alarm on timeout"],
    llm: { title: "Add homing timeout guard", lines: ["Homing on Tool 3 could hang without an alarm (FI-238)",
      "Homing watchdog · stop axes and alarm on timeout", "Deployed to Tool 3 and verified"] },
  },
  "2026-45|CSV export": {
    why: "Results were copied by hand into spreadsheets",
    status: "Done: export checked",
    title: "Add CSV export of results",
    lines: ["Results were copied by hand into spreadsheets → export the result table to CSV",
      "CSV writer with UTF-8 BOM so Korean text opens correctly in Excel", "Export checked"],
    steps: [],
    llm: { title: "Add CSV export of results", lines: ["Replace hand-copying of results with a CSV export",
      "Result table export with UTF-8 BOM for Korean text", "Export checked"] },
  },
  "2026-46|Auto focus": {
    why: "A low sharpness score left the lens at a wrong position",
    status: "Next: verify on Tool 2",
    title: "Add auto focus retry",
    lines: ["A low sharpness score left the lens at a wrong position",
      "Retry with a wider range when the score is low · alarm when the retry fails", "Verification on Tool 2 planned"],
    steps: ["Check peak score", "Retry with wider range", "Alarm on failure"],
    llm: { title: "Add auto focus retry", lines: ["Three times more stable focus with a wider retry range",
      "Retry with a wider range when the score is low · alarm on failure", "Verification on Tool 2 planned"] },
  },
  "2026-46|Stage homing": {
    why: "Transient homing failures stopped the line right away",
    status: "Done: retry checked on Tool 3",
    title: "Add configurable homing retry",
    lines: ["Transient homing failures stopped the line right away (FI-238)",
      "Retry count in settings · alarm only after the last retry", "Retry checked on Tool 3"],
    steps: [],
    llm: { title: "Add configurable homing retry", lines: ["Transient homing failures no longer stop the line at once (FI-238)",
      "Retry count setting · alarm after the last retry", "Retry checked on Tool 3"] },
  },
  "2026-46|Recipe check": {
    why: "Out-of-range recipe values were saved and only failed during inspection",
    status: "Done: save blocking checked",
    title: "Block out-of-range recipe values",
    lines: ["Out-of-range values were saved and failed only during inspection → block before saving",
      "Per-parameter range check · error shown in the recipe editor", "Save blocking checked"],
    steps: ["Enter value", "Range check", "Block save if out of range"],
    llm: { title: "Block out-of-range recipe values", lines: ["Range check before saving improves yield and throughput",
      "Per-parameter range check · error shown in the editor", "Save blocking checked"] },
  },
};

export const SAMPLES = {
  ko: { log: LOG_KO, config: CONFIG_KO, memos: MEMOS_KO },
  en: { log: LOG_EN, config: CONFIG_EN, memos: MEMOS_EN },
};

// 내 데이터용 기본 영역 사전: 경로 규칙은 비워 두고, 장비 SW 에서 흔한 모듈 이름 · 설비 · 이슈 번호 패턴만 둔다
export const DEFAULT_CONFIG = {
  ko: {
    project: "", author: "",
    rules: [
      { match: [], words: ["vision", "비전", "카메라", "조명", "포커스", "영상"], tag: "[비전]", section: "비전" },
      { match: [], words: ["motion", "stage", "스테이지", "모션", "축", "원점", "servo"], tag: "[모션]", section: "모션" },
      { match: [], words: ["handler", "loader", "efem", "robot", "로더", "로봇", "카세트", "핸들러"], tag: "[반송]", section: "반송" },
      { match: [], words: ["recipe", "레시피"], tag: "[레시피]", section: "레시피" },
      { match: [], words: ["alarm", "interlock", "알람", "인터락"], tag: "[알람]", section: "알람" },
      { match: [], words: ["secs", "gem", "hsms", "통신", "comm"], tag: "[통신]", section: "통신" },
      { match: [], words: ["ui", "화면", "view", "dialog"], tag: "[화면]", section: "화면" },
      { match: [], words: ["report", "log", "보고서", "로그", "csv", "pdf"], tag: "[보고서]", section: "보고서" },
      { match: [], words: ["build", "ci", "installer", "빌드", "설치", "script"], tag: "[도구]", section: "도구" },
    ],
    fallback: { tag: "[기타]", section: "기타" },
    order: ["비전", "모션", "반송", "레시피", "알람", "통신", "화면", "보고서", "도구", "기타"],
    equipment: "(?<!\\d)\\d{1,2}호기|\\b(?:EQ|EQP|TOOL|UNIT)[-_]?\\d{1,3}\\b",
    issue: "#\\d{2,6}\\b|\\b[A-Z]{2,10}-\\d{3,6}\\b",
  },
  en: {
    project: "", author: "",
    rules: [
      { match: [], words: ["vision", "camera", "light", "focus", "image"], tag: "[Vision]", section: "Vision" },
      { match: [], words: ["motion", "stage", "axis", "homing", "servo"], tag: "[Motion]", section: "Motion" },
      { match: [], words: ["handler", "loader", "efem", "robot", "cassette"], tag: "[Transfer]", section: "Transfer" },
      { match: [], words: ["recipe"], tag: "[Recipe]", section: "Recipe" },
      { match: [], words: ["alarm", "interlock"], tag: "[Alarm]", section: "Alarm" },
      { match: [], words: ["secs", "gem", "hsms", "comm"], tag: "[Comm]", section: "Comm" },
      { match: [], words: ["ui", "view", "dialog", "screen"], tag: "[UI]", section: "UI" },
      { match: [], words: ["report", "log", "csv", "pdf"], tag: "[Report]", section: "Report" },
      { match: [], words: ["build", "ci", "installer", "script"], tag: "[Tools]", section: "Tools" },
    ],
    fallback: { tag: "[Other]", section: "Other" },
    order: ["Vision", "Motion", "Transfer", "Recipe", "Alarm", "Comm", "UI", "Report", "Tools", "Other"],
    equipment: "\\b(?:EQ|EQP|TOOL|Tool|UNIT)[-_ ]?\\d{1,3}\\b",
    issue: "#\\d{2,6}\\b|\\b[A-Z]{2,10}-\\d{3,6}\\b",
  },
};
