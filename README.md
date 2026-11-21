# 주간 보고 생성기 · Weekly Report Builder

git log 를 주제별로 묶고, 요약에 **입력에 없는 숫자 · 수량 표현 · 상태어 · 효과어**가 들어가면 막은 뒤, 주간 보고 PPTX · Markdown 으로 내보내는 브라우저 전용 웹 앱(PWA)입니다. 서버가 없고, 데이터는 사용자 브라우저에만 저장됩니다.

- 바로 쓰기: https://mhbae-semi-lab.github.io/weekly-report/
- 직접 실행: 정적 파일이라 아무 웹 서버로 열면 됩니다 (아래 "설치 · 사용")
- 언어: 한국어 · English (화면과 검증 규칙 모두)

## 관점

장비 SW 팀이 매주 커밋과 현장 대응 메모를 사내 양식 PPT 로 옮기는 반복 업무를, **숫자를 지어내지 않는 방식으로** 자동화합니다. 보고서에 "탐색 시간 40% 단축", "수율 향상" 같은 말이 측정 없이 들어가는 것을 막는 것이 핵심입니다.

## 해결

1. 커밋을 주제로 묶습니다. 같은 현장 이슈 번호(예: `FI-238`, `#123`)를 가진 커밋은 제목이 달라도 한 주제가 되고, 모듈(경로 · 제목 단어)과 설비 번호(예: `3호기`, `EQ-03`)를 붙입니다.
2. 주제마다 메모(왜 · 상태)를 받아 3줄 요약을 만듭니다. 규칙 기반 요약은 키 없이 항상 동작하고, LLM 요약(본인 Anthropic 키 또는 로컬 Ollama)은 옆 칸(Shadow)에 보입니다.
3. **사실 검증**: 요약의 숫자(소수 · 날짜 포함), "세 배" "절반" "twice" 같은 글자 수량, 완료 · 검증 · 배포 같은 상태어, 단축 · 향상 · 수율 · 가동률 · UPH 같은 효과어가 커밋 제목 · 메모에 없으면 막고, 막힌 표현과 이유를 표로 보여줍니다. LLM 요약이 실패하면 규칙 요약을 씁니다.
4. 지난주와 비교해 이어진 일 · 끝난 일 · 이번 주 커밋 없음 · 새 일을 나누고, 이어진 주제는 지난주 '왜' 메모를 이어받습니다. 설비 · 현장 이슈별 진척 표를 만듭니다.
5. PPTX(기본 양식 설정 또는 내 PPTX 양식의 `{{자리표시자}}` 채우기) · Markdown · 클립보드로 내보냅니다.

### 현장 검증 절차 (재현 → 비교 → Shadow → 전환 · 롤백)

| 단계 | 앱 안에서 |
|---|---|
| 재현 | 합성 4주 세트와 "녹화한 LLM 응답(절반은 숫자 · 효과를 지어냄)"을 버튼 하나로 엽니다. 내 주차를 라벨을 붙여 재현 세트로 저장합니다 |
| 비교 | 영역 사전 · 보고서 언어를 바꾸면 적용 전에 같은 주차와 재현 세트로 전 / 후를 나란히 보여주고 바뀐 칸만 강조합니다 |
| Shadow | LLM 요약은 옆 칸에만 나오고 결정은 규칙 · 사람이 합니다. 검증에 막힌 경우가 목록으로 쌓입니다 |
| 전환 · 롤백 | Shadow 기록 10건 이상 · 통과율 80% 이상이면 "LLM 채택으로 전환"이 켜집니다. 전환 뒤에도 통과한 요약만 채택하고, 직전 설정과 요약으로 한 번에 되돌립니다. 변경 이력은 남습니다 |

## 상용 제품과 비교 (2026-11-21 조사)

| 제품 | 확인한 내용 |
|---|---|
| [GitHub Copilot PR 요약](https://docs.github.com/en/copilot/how-tos/use-copilot-for-common-tasks/create-a-pr-summary) | PR 1건 단위 요약. [Copilot CLI 쿡북](https://docs.github.com/en/copilot/tutorials/copilot-cookbook/communicate-effectively/summarize-repository-activity)으로 주간 저장소 활동 요약은 가능. PPTX 출력은 문서에 없음 |
| [Copilot in PowerPoint](https://support.microsoft.com/office/frequently-asked-questions-about-copilot-in-powerpoint-3e229188-9086-4f4c-9f9f-824cd25ae84f) | 조직 양식 · 브랜드로 덱 생성. 업무용 Copilot 라이선스 필요. git 이력 입력은 문서에 없음 |
| [Atlassian Rovo](https://www.atlassian.com/software/bitbucket/features/ai) | Jira · Confluence · Bitbucket 요약, [Confluence 안 슬라이드](https://support.atlassian.com/confluence-cloud/docs/create-ai-generated-slides-with-rovo/). 네이티브 PPTX 내보내기는 [요청 단계](https://jira.atlassian.com/browse/ROVO-563) |
| [Geekbot](https://help.geekbot.com/en/articles/14007711-geekbot-features) | 사람이 입력한 스탠드업 요약. 연동은 Slack · Teams · API · MCP, 커밋을 직접 읽지 않음 |
| [git-standup](https://github.com/kamranahmedse/git-standup) | 작성자 · 기간별 커밋 목록. 요약 없음 |
| [decktective](https://github.com/rizqiyi/decktective) | git → PPTX(사용자 양식 채우기) CLI. "입력 사실에 없는 숫자는 빌드 실패"를 문서로 밝힘 |
| [gitrecap](https://github.com/aaaaorg/gitrecap) · [gh-weekly](https://github.com/Skytim/gh-weekly) · [Gitmore](https://gitmore.io) | git 기반 AI 주간 요약 (Markdown · Slack · 메일). 숫자 · 주장 검증은 문서에 없음 |

### 차별점 (조사한 제품 중에서 찾지 못함, 2026-11 기준)

1. **숫자 · 글자 수량 · 상태어 · 효과어(장비 지표 포함)를 함께 막는 검증**과, 막힌 표현마다 이유를 보여주는 화면. 숫자만 막는 게이트는 decktective 가 이미 문서화했으므로 이 앱의 주장은 "함께 막는 범위와 한국어 수량 표현"입니다. 합성 4주 세트 측정은 아래 "측정" 참고.
2. **브라우저만으로** 로컬 · 사내 git log 파일을 읽습니다. 서버 · 설치 · GitHub/Atlassian 클라우드 · M365 Copilot 라이선스가 필요 없습니다 (GitHub 가져오기는 선택).
3. **장비 SW 보고 구조**: 모듈 · 설비 번호 · 현장 이슈 번호로 묶고, 지난주 대비와 설비 · 이슈 진척 표를 만듭니다.

이 README 는 "AI 가 커밋을 요약한다", "브랜드 양식 PPT 를 자동으로 만든다", "사용자 PPTX 양식을 채운다", "숫자 검증 게이트" 자체를 차별점으로 주장하지 않습니다 (위 제품들이 이미 합니다).

## 측정

- **지어낸 숫자 · 단어 차단율** (`node tests/measure.js`): 합성 4주 세트(한국어 16 · 영어 6 주제)의 사람이 쓴 요약에 지어낸 표현 11종(한) · 8종(영)을 넣은 변형 220개 — 첫 버전 검증기 88개(40.0%) → 현재 220개(100%). 녹화한 합성 LLM 응답 22개 중 지어낸 12개는 첫 버전 8개 · 현재 12개 차단, 정상 10개와 사람이 쓴 요약 22개는 둘 다 잘못 막지 않음. 패턴은 개발자가 만든 합성 세트라 실제 LLM 출력의 차단율을 보장하지 않습니다.
- **보고서 작성 클릭 수**: 같은 46주차 로그(주제 6개)로 "지난주 보고를 만든 다음 주에 이번 주 보고 작성" — 첫 버전 25번 클릭 · 입력란 11개, 현재 16번(클릭 15 + 파일 놓기 1) · 입력란 8개. 자세한 방법은 [docs/measurements.md](docs/measurements.md).

## 설치 · 사용

설치 없이 https://mhbae-semi-lab.github.io/weekly-report/ 에서 바로 쓸 수 있습니다. 직접 띄우려면, 정적 파일이라 빌드가 없으므로 저장소 폴더에서 아무 정적 서버로 엽니다.

```
python -m http.server 8732
```

브라우저에서 `http://localhost:8732` 를 열고, 주소 표시줄의 설치 버튼으로 앱처럼 설치할 수 있습니다 (오프라인 동작).

1. 저장소에서 로그를 파일로 저장합니다.
   ```
   git log --no-merges --date=short --name-only --since="5 weeks ago" --format="@@%h|%ad|%an|%s" > log.txt
   ```
   일반 `git log`, `--stat`, `--name-status`, `--numstat`, `--oneline` 출력도 자동 인식합니다. 읽지 못한 줄은 몇 번째 줄인지와 이유를 보여줍니다.
2. `log.txt` 를 화면에 놓고 주차를 고릅니다. 다음 주에 새 로그를 놓으면 커밋을 합치고 지난주 메모는 남습니다.
3. 주제마다 메모의 왜 · 상태를 채우고, 검증을 통과하면 내보냅니다.
4. (선택) 설정에서 본인 Anthropic API 키나 로컬 Ollama 를 넣으면 LLM 요약이 Shadow 칸에 나옵니다. 키는 메모리에만 둡니다.

테스트:

```
node --test "tests/*.test.js"
node tests/measure.js
```

라이브러리(PptxGenJS 4.0.1 + JSZip, Anthropic TypeScript SDK 1.6.0 번들, Pretendard 1.3.9)는 `vendor/` 에 들어 있어 CDN 없이 동작합니다. 다시 받는 방법은 [vendor/README.md](vendor/README.md).

## 개인정보

데이터는 브라우저 IndexedDB 에만 저장됩니다. 밖으로 나가는 것은 사용자가 LLM 생성(본인 키, 보내기 전 미리보기 · 마스킹)이나 GitHub 가져오기를 누를 때뿐입니다. [privacy.html](privacy.html)

## 한계

- 검증은 문자열 비교라 "입력에 같은 숫자가 다른 뜻으로 있음"은 통과합니다. 의미까지 맞는지는 사람이 봅니다.
- 상태어 · 효과어 목록은 고정이며 설정에서 바꿀 수 없습니다. 목록에 없는 과장 표현은 통과합니다.
- 차단율 측정은 개발자가 만든 합성 패턴 기준입니다. 실제 LLM 출력으로는 Shadow 기록으로 직접 확인해야 합니다.
- 사용자 PPTX 양식은 `{{자리표시자}}` 가 한 문단 안에 있어야 합니다. 차트 안 자리표시자는 채우지 않고, 내지를 복제할 때 발표자 노트는 복사하지 않습니다.
- GitHub 가져오기는 공개 저장소만, 로그인 없이 시간당 60회 제한입니다.
- `--oneline` 은 날짜가 없어 지정한 한 날짜로 묶습니다.

## 만든 방법

배민혁이 설계 · 검증했고, 코드 작성에 AI 코딩 도구(Claude Code)를 사용했습니다. 사내용으로 쓰던 Python CLI 의 흐름(규칙 우선 · LLM 출력 검증 · 실패 시 규칙 대체)을 공개용 브라우저 앱으로 새로 만들었고, 사내 자료 · 데이터는 들어 있지 않습니다. 예시 데이터는 모두 합성입니다.

## English summary

A browser-only PWA that turns `git log` output into a weekly status report (PPTX / Markdown). Commits are grouped by topic, module, equipment ID and field-issue ID; each topic gets a 3-line summary (rule-based, or an LLM in a Shadow column with your own Anthropic key or local Ollama). A fact gate blocks numbers, number words, status words and effect words (including equipment metrics such as yield or uptime) that are not in the commit subjects or memo, and shows why each phrase was blocked. Includes week-over-week comparison, the reproduce → compare → Shadow → switch/rollback workflow, offline support and Korean/English UI. No server; data stays in IndexedDB. Try it at https://mhbae-semi-lab.github.io/weekly-report/.

## License

MIT. 포함한 라이브러리 · 글꼴의 라이선스는 `vendor/licenses/`.
