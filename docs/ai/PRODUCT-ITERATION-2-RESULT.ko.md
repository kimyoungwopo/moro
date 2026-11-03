# Moro 제품 2차: 생성 → 문맥 수정 → 로컬 재사용

상태: 최종 회귀·실제 AI 수정·전달 영상 검증 완료(2026-11-01 KST). 2026-10-31 작업의 후속 로컬 후보이며 commit/push/공개 배포하지 않았다.

## 구현

- 기본 New motion은 기존처럼 brief와 표시 크기만 보낸다. Refine current project는 별도 동의한 현재 프로젝트 스냅샷을 추가한다. 입력 변경은 재동의를 요구하며 1–20레이어/64KiB 제한이 있다.
- Rust는 누락/거짓 동의, 잘못된 프로젝트, 용량 초과를 CLI 실행 전에 거부한다. 기존 격리·출력 검증·취소·Host/Origin 경계를 유지했다. 새 프로토콜은 `{provider,prompt,baseProject,contextConsent:true}`이며 기본 두 필드 요청도 그대로 지원한다.
- 추가/삭제/변경 레이어와 설정/순서 차이를 Apply 전에 보여준다. 생성 중 편집 원본이 바뀌면 Apply를 막고, 적용 순간에도 최신 참조를 재확인한다. 동등한 기본값과 JSON 키 순서는 무시하되 실제 속성·이름·레이어 순서는 비교한다. 무변경 제안은 Undo를 소비하지 않는다.
- Motion library에 이전 실제 AI 생성 예제를 연결했다. 예제 열기는 AI 호출이 아니다. 현재 편집본과 AI 제안을 서로 다른 출처로 IndexedDB에 명시적으로 저장한다. 최대12개, 자동 삭제/자동 저장 없음, transaction 완료 뒤 성공 표시, 삭제 확인 취소 시 보존, 새로고침 뒤 복구를 검증했다.
- 병아리의 ‘4초 루프 중 한 번 눈 깜빡’ 문장에서 ‘한 번’을 전체 one-shot으로 오판하던 문제를 수정했다. 명시적 반복 금지/부정/모호성 검사는 유지했다.

## 실제 AI 검증 — 병아리 아님, 컨페티1회

사용자가 병아리 대신 다른 예제 전송을 승인해, 이전 실제 AI 생성 컨페티14레이어만 사용했다. 현재 사용자의 문서·저장소·계정 데이터는 보내지 않았다. 예제를 명시적으로 연 뒤 JSON 전송 동의와 실제 Codex CLI를 거쳤다. 기존 완성물을 새로 생성한 척하지 않는다.

요청: 모양·색상·궤적은 유지하고 4초→5초로 재생. durationFrames300, 모든 키프레임의 frame을1.25배 반올림. 도형/팔레트/ID/순서/value/easing/키프레임 개수는 보존.

실측 결과:
- 실제 요청1회, 모델 대기47.135초. HTTP 가로채기·가짜 CLI·출력 손보정 없음.
- 14레이어 추가/삭제0, 순서 유지. 시간 외 속성 동일.196키프레임 모두 요청한 반올림 시각과 일치.
- raw-proposal.json = 실제 Save project 다운로드 데이터. 실제 Lottie 다운로드 = canonical core export.
- Undo1회 뒤 다운로드한 프로젝트 = 원본 데이터. AI 원본 제안의 native IndexedDB 저장/라이브러리 재사용도 확인.
- 독립 실제 Lottie player로 원본120+수정150, 총270프레임 캡처. 모든 프레임의 수치 경계 검사에서 이탈0. 영상 배경만 #111C2E이며 JSON은 투명하다.

이는 이번 시간축 수정 사례의 성공이지 모든 캐릭터/모델/예술적 품질의 보장이 아니다. 구조 차이만으로 요청 외 변경이 없다고 판정하지 않으며, 이번에는 원본과 모든 비시간 속성을 독립 비교했다.

## 영상과 검증 시점

- `real-ai-refinement-comparison.mp4`: 같은 실제 시계로 동시 시작하는4초/5초 비교, 영상만2회 반복. 모델의 event를 loop로 바꾼 것이 아니다.
- `actual-moro-refinement-process.mp4`: 실제 라이브러리 열기→별도 동의→Codex→미리보기/차이→저장→Apply→다운로드→Undo. 생성 대기 구간만8배속, 나머지는 실제 속도.
- `actual-refinement-full.webm`: 대기도 압축하지 않은 원본 녹화.
- 녹화 후 화면 검수에서 모바일 Close 줄바꿈과 preview의 과거 ‘brief만 전송’ 도움말을 발견했다. 최종 제품에서는 Close 단일 줄과 문맥 포함 여부별 안내로 수정했다. 원본 녹화/모델 출력을 바꾸거나 이를 숨기려고 모델을 재호출하지 않았다. 최종 화면은 별도 브라우저 회귀 캡처로 확인한다.

## 최종 자동 검사와 미디어 범위

- 앱 unit121, Chromium 브라우저20, Rust38, 배포3, guidance6 통과. lint/typecheck/build/skill sync/agent check/git diff --check도 통과. `artifacts/iteration2-final-regression.log`, `iteration2-rust-parent.log` 보존.
- 390px/1440px에서 실제 저장·새로고침·재열기·12개 한도 초과 시 ID 보존·삭제 취소/확인·포커스 복귀·원본 변경 시 Apply 차단·명시적 Apply/Undo를 검사했다. Close 텍스트가 한 줄인지도 실제 range fragment로 회귀 검사했다.
- MP4 두 파일은 FFmpeg 전체 디코딩, native video의 실제 탐색/종료/error-null을 확인했다. 다만 headless Chromium 및 별도 Chrome 재생에서 프레임 드롭이 관측됐다. Chrome의 재생 구간 드롭은 비교147/296프레임, 과정186/375프레임이었다. 이는 파일 디코딩 오류는 아니지만 **무드롭·매끄러운 표시 성능까지 검증했다는 뜻은 아니다**. 초기/분리 측정 로그와 결과를 보존하며 원인을 추정해 단정하지 않는다.

## 남은 제한

- static/dev server에서는 CLI 연결 없이 수동 제작/라이브러리를 사용한다. 실제 AI는 Rust loopback bridge와 사용자의 공식 CLI 로그인이 필요하다. Windows native bridge는 미지원, Linux 실기기 및 Claude 실제 OAuth 재인증 후 inference는 미검증이다.
- 라이브러리는 브라우저/origin 한정이다. 클라우드 동기화·자동 저장·손상 데이터 자동 복구는 없다. 사이트 데이터 삭제 전에 프로젝트 파일 백업이 필요하다.
- 지원 geometry는 rect/ellipse, 정적 corner radius와 기존 transform tracks다. 이미지/텍스트/임의 SVG path/관절 rig/임의 코드 실행을 추가한 것은 아니다.
- 소스 ZIP은 의존 파일·자산·아카이브 무결성을 검사하지만 별도 clean-install 환경을 새로 만든 것은 아니다. 원격 배포나 공개 버전 반영도 수행하지 않았다.
