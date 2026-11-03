# Moro Quality lab — 앱 통합 검증 결과

검증일 2026-11-01, 로컬 작업. 공개 commit/push/deploy 및 인증/전역 설정 변경 없음. 이전 07:00 운영은 종료된 상태이며 재가동하지 않았다.

## 이번에 실제 완성한 사용자 흐름

Creator의 **Quality lab**에서 capability 확인 → 별도 7회 동의 → Rust HTTP/기존 native seven-stage runner → 네 후보 수동 선택 → 실제 Lottie preview → 명시적 Apply → editable project 저장/실제 Lottie export → 독립 expression-free light player → **한 Undo로 원래 rectangle 복원**을 실행했다.

이 수용 검증은 **명시적으로 지정한 fake-harness-cli-fixture**만 사용한 프로토콜/제품 통합 검증이다. 브리지 자식은 빈 PATH/disposable HOME을 사용했다. 실제 Codex/Claude 7회 루프나 예술성 개선을 검증한 것이 아니다. 첫 후보는 base이며 final을 자동 우승자로 고르지 않는다. 보고서는 artisticReview=not_reviewed다.

## 부모가 재실행한 결과

- 첫 entrypoint 행동 RED: 기존 Creator에 Quality lab 버튼이 없어 assertion 실패. `artifacts/harness2-app-entry-red.log`.
- 통합 진입점 1개 + 전체 lint + 본체/React example 타입 검사 + Vite build: 성공, guard finished.returncode=0. `artifacts/harness2-app-parent-integration.log`.
- `npm run skill:sync && npm run check && MORO_NATIVE_HARNESS_E2E=1 MORO_E2E_PORT=14188 npm run test:e2e && git diff --check`: 성공, guard finished.returncode=0. **174 unit tests, 21 Chromium E2E**, distribution3/guidance6, lint/types/build/example build/skill/agent checks 포함. `artifacts/harness2-app-full-integration.log`.
- 격리한 HOME/PATH, private Rust toolchain으로 `cargo test --manifest-path bridge/Cargo.toml --locked`: 부모 재실행 **69 passed / 0 failed**, guard finished.returncode=0. `artifacts/harness2-app-parent-rust.log`.
- 네이티브 app E2E: 7.8초에 통과. HTTP의 비동의/다른 budget/unknown snapshot 거절, human zero-call preflight, report 7단계/7회/not_reviewed, 후보4개, 다운로드, canonical export 동일, 독립 player frame0/60/119, 한 Undo를 확인했다. 320/390/1440px에서 수평 overflow 없음.
- 하위 UI 브라우저 검사는 별도로 실제 Chromium/fake HTTP에서 stale/no-op/cancel/malformed/late response, guidance XSS, reduced motion/frame seek, 44px controls와 대비를 확인했다. 해당 Undo는 전용 parent fixture이고, 실제 Creator history 검증은 위 native E2E가 담당한다. 상세 인계 `artifacts/harness2-app-ui-handoff.md`.

## 동작 경계

- 일반 생성/문맥 수정/harness는 하나의 admission slot을 공유한다. 취소 표시 이후에도 process cleanup이 끝나기 전 새 실행을 받지 않는다.
- preflight는 provider 실행/CLI help도 하지 않는다. start는 literal consent=true/callBudget=7만 허용하며 브라우저가 source pack/파일 경로/프로젝트를 넘길 수 없다.
- 앱은 제출 직전 편집기 snapshot을 **로컬에만** 고정한다. 문서가 바뀌면 채택을 막고 부모 callback도 최신 프로젝트를 동기 재검사한다. 같은 결과는 Undo를 소비하지 않는다.
- 고정 지식 원문/fingerprint/upstream pin과 단계별 evidence가 report에 포함된다. 다운로드는 보고서일 뿐 미래 모델 지침으로 자동 주입하지 않는다.
- 기존 CLI의 report/adopt는 strict validation을 유지하며, 앱의 candidate Apply와 CLI의 lesson export는 별도 동작이다.

## 함께 제작한 신규 실제 AI 결과

`examples/authoring/ai-toaster/`의 ‘톡, 아침이 왔다’는 **일반 AI assistant 경로로 실제 Codex 1회** 새로 생성했다. 기존 예제 import/가짜 응답/수작업 JSON 수정 없음. 13레이어, 768²,60fps,240프레임(4초 loop). 실제 raw proposal=저장 project, export=core exporter 일치를 확인했다.

미리보기 MP4는 원본 Lottie를 독립 player에서 30fps로 캡처한 **512²/12초(4초 루프3회)/무음** 파생본이다. 120 unique-frame captures, 240 numeric frame 검사, bounds 초과0,13개 layer endpoint 일치, 빵 껍질/속살 중심 편차0을 확인했다. 완전 decode360frames 성공. 원본 프로젝트/animation/raw/receipt는 별도로 보존했다.

첫 생성 UI 시도는 provider 선택 전 lazy panel loading timeout으로 종료됐다. 별도 재현 페이지에서는 정상 로딩되었고, 이 실패 전에 실제 generation-start 이벤트나 제출 요청은 없었다. 그 후 새 페이지에서 1회의 실제 generation을 완료했다. 최초 failure 자료를 보존했으며 transient 원인을 확정하거나 제품 코드를 임의 수정하지 않았다.

헤드리스 Chromium의 최종 MP4는 ended=true/currentTime=12로 끝까지 재생됐지만 droppedVideoFrames=162/360을 기록했다. full decode/파일 무결성과 표시 성능은 별개이며 무드롭/모든 기기의 부드러운 재생을 보장하지 않는다. source/video semantic matching은 파일 checker만으로 증명하지 않았고, 실제 raw→export 일치 및 독립 렌더 경로를 별도로 검증했다.

## 남은 제품 한계

고품질 사람 제작은 해결되지 않았다. path/curve, parent/group transform, pivot 및 v2 authoring은 **감사/계약 제안만 존재하고 미구현**이다. human-character preflight의 호출 전 차단을 유지한다. Linux/Windows/새 기기의 clean install 및 실제 7-call 품질 향상은 이번에 검증하지 않았다. 실제 모델 요청은 위 일반 생성1회와 fixture 수용 검증을 구분한다. 앱 내 MP4 export 기능을 추가한 것은 아니며 영상은 개발 검증용 독립 렌더 파생본이다.

## 전달

앱 전체 소스는 기존 dirty work와 새 Quality lab을 함께 보존하고, .git/node_modules/bridge target/dist/테스트 브라우저 결과/인증 자료를 제외해 별도 ZIP으로 전달한다. 파일 목록/개별 SHA256, ZIP integrity, 압축 해제본 hash 일치를 별도 archive-verification.json에 기록한다. 이는 새 기기 설치 성공 증거가 아니다. 영상·Moro editable project·Lottie JSON·실제 생성 receipt는 별도 작품 폴더에 보존한다.
