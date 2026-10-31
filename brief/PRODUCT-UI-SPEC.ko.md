# Moro — 제품·UI 결정서

> 작업명: **Moro / Lottie workbench**. 이름·도메인·상표·패키지 사용 가능성은 미확인으로, 공개 전 확인한다. 이 문서는 설계 결정서이며 동작하는 제품·검증된 UI를 의미하지 않는다.

## 1. 최종 방향

**브랜드에 맞게 바꾸고, 코드까지 가져가는 로컬 우선 Lottie 작업실.**

제품의 첫 질문은 “내 애니메이션을 우리 서비스에 맞게 바꾸면 어떻게 보일까?”다. 가장 크게 보이는 것은 애니메이션이고, 가장 가까운 조작은 색상 변경이며, 마지막 행동은 Export다. 로그인·업로드 서버·결제·빈 대시보드·긴 소개 랜딩은 만들지 않는다.

- 대상: Lottie를 실제 웹 제품에 넣는 프론트엔드 개발자와 디자이너.
- 핵심 흐름: 샘플 또는 내 파일 → 팔레트 수정 → 배경·반응 확인 → JSON·React 예제 가져가기.
- 브랜드 문장: **Make motion yours.** 설명: **Recolor Lottie animations and bring them into your app.**
- 전제: 무료·무계정·파일 내용은 브라우저 안에서 처리. 배포 시 이 약속을 네트워크 검사로 검증한다.
- 성장 가설: 단순 무료 viewer보다 “편집 전후 + 실제 적용”의 연결이 공유할 이유가 된다. 차별성·Star 증가를 입증한 사실은 아니다.

## 2. 하지 않을 것

v0.1에는 타임라인·키프레임 편집, 펜 도구, 레이어 이동·삭제, AI 생성, 팀 공간, 클라우드 저장, 갤러리 마켓, 결제, GIF/MP4 변환을 넣지 않는다. dotLottie 파일 import/export도 v0.1의 완료 조건에서 제외한다. 메뉴에 Coming soon 버튼을 나열하지 않는다.

Star 수를 가짜로 표시하거나, Star를 눌러야 다운로드할 수 있게 막거나, 대량 자동 홍보를 하지 않는다. GitHub 링크는 보조 행동이다.

## 3. 화면 구조와 URL

- `/`: 제품 자체인 작업실. 첫 방문은 자체 제작한 `Orbit loader` 샘플이 로드된 상태로 시작한다. 영문 UI가 기본이며 한국어를 선택할 수 있다.
- `/docs`: 빠른 시작·지원 범위·로컬 처리·기여 방법. 초기에는 정적 문서로 충분하다.
- GitHub: 공개 저장소가 실제 생성된 뒤 정확한 URL을 연결한다. 현재 가짜 링크·가짜 Star 수를 넣지 않는다.
- 작업 파일이나 원본 JSON을 URL query/hash에 넣지 않는다. 계정·workspace·profile 메뉴는 없다.

첫 화면에서 사용자는 샘플 색상을 즉시 바꿀 수 있다. 드롭존만 크게 띄우거나 안내 모달을 먼저 열지 않는다. `Open file`은 항상 상단에 보인다. 기존 작업이 수정된 상태에서 파일 또는 샘플을 바꾸면 교체 확인창을 연다.

## 4. 데스크톱 UI — 조용한 프레임, 큰 무대

### 배치 결정

1440px 기준: 왼쪽 228px 라이브러리, 오른쪽 남은 작업 영역. 상단 바는 48px. 라이브러리와 상단 바는 같은 저채도 청록빛 회색 바탕으로 L자 프레임을 이루고, 작업 영역은 흰 sheet로 감싼다. sheet는 오른쪽·아래쪽 8px inset, 16px radius, 그림자 없음.

작업 sheet 안쪽은 24px padding. canvas와 inspector의 간격은 24px, inspector는 288px, 나머지는 canvas다. 넓이와 실제 프리뷰 영역은 레이아웃에서 계산하고 고정 screenshot 좌표를 코드에 복사하지 않는다. canvas 영역은 `min-width:0`으로 축소 가능하게 한다.

### 상단 바

왼쪽은 루프 두 개가 이어진 단순 모노라인 마크 + Moro. 가운데는 파일명과 `Modified` 상태. 오른쪽은 `Open file`, undo/redo, 단일 주 행동 `Export`. GitHub와 Docs는 라이브러리 하단에 놓아 Export와 경쟁시키지 않는다. 자동 원격 저장이 없으므로 `Saved to cloud` 같은 상태를 만들지 않는다.

### 라이브러리

검색·프로젝트 목록 대신 샘플 목록과 파일 정보만 둔다. 초기 샘플은 **Orbit loader, Success check, Reaction burst** 세 개를 직접 제작한다. 본 문서의 이름과 썸네일은 제작 예정 샘플 사양이며 실제 애니메이션 에셋이 아직 없다.

샘플 행은 썸네일 48px, 이름, 짧은 용도 설명으로 구성. 썸네일은 정지 이미지로 표시하고 선택한 샘플만 재생한다. 하단에는 파일명, 가로×세로, frame rate, 프레임 수, 원본 크기를 실제 파싱 결과로 표시한다. 로컬 파일 경로는 표시하지 않는다.

### 중앙 무대

상단: 파일명 또는 샘플명, 그 아래 `Preview background` 선택(밝음·어두움·투명). 무대는 1개가 기본이며, 비교 토글을 켰을 때만 원본/수정본 두 무대로 바뀐다. 둘은 동일한 frame·speed·loop 설정으로 재생한다. 배경 변경은 JSON을 수정하지 않으며 “Preview only” 설명을 붙인다.

하단: 재생/정지, frame scrubber, 현재 프레임/총 프레임, 속도, loop. 편집 타임라인처럼 보이는 레이어 트랙·키프레임 마커는 표시하지 않는다. 프레임 이동 중에는 자동 재생을 잠시 멈추고 종료 후 원래 상태를 복원한다. 원본과 수정본을 같은 크기·배경·시점으로 비교한다.

### 오른쪽 inspector

탭은 `Colors`와 `Playback` 두 개. 기본은 Colors. 진단은 관련 색상 행 또는 패널 하단 disclosure에 표시한다. 별도 속성 카드가 중첩되는 구조는 피한다.

Colors: 원본색 → 목표색 → 적용되는 정적 color property 수. 동일 원본색은 그룹화하되 소수점 차이를 임의 합치지 않고 명시적 정규화 규칙을 문서화한다. opacity·gradient·keyframe color는 이 묶음에서 제외한다. 목표색 input과 스와치를 모두 제공한다. 샘플 팔레트는 고정 preset이고 사용자 파일의 색상 의미를 AI로 추정하지 않는다. `Reset colors`는 변경이 있을 때만 활성화한다.

Playback: autoplay, loop, speed와 Trigger(자동·hover·click). Trigger는 React wrapper 동작이며 Lottie 문서 자체의 state machine이 아니다. 모바일에는 hover를 숨기고 touch로 가능한 click 또는 autoplay를 제공한다.

## 5. 모바일·태블릿

### 1100px 이상

라이브러리 + canvas + inspector의 세 영역. 낮은 높이에서는 inspector만 독립 스크롤하며 페이지 전체가 이중으로 갇히지 않도록 테스트한다.

### 768–1099px

라이브러리를 `Samples` drawer로 접고 canvas + 288px inspector를 유지한다. 원본/수정본 비교는 필요시 세로로 쌓는다. 무대의 최소 유효 크기를 확보하지 못하면 한 번에 한 프리뷰만 표시한다.

### 767px 이하

48px 상단 바(메뉴, Moro, Export), 중앙 프리뷰, 재생 컨트롤, `Colors / Playback` 하단 편집 패널 순서. 전체 데스크톱 UI를 축소하지 않는다. 샘플·파일 정보·Docs·GitHub는 메뉴 sheet에 넣는다. 색상 패널은 페이지 흐름 안에 두고, 색상 picker만 modal sheet로 연다. 키보드가 올라와도 현재 hex input과 확인 버튼을 볼 수 있어야 한다.

원본/수정본은 두 작은 썸네일이 아니라 `Original / Edited` 전환으로 보여준다. 선택한 frame은 유지한다. 주요 touch target은 최소 44px, 본문/입력은 16px, 보조 텍스트는 12px 이상으로 설계한다. 데스크톱 전용 안내로 기능을 막지 않는다.

## 6. 비주얼 시스템

방향은 **Framed sheet**. 선택 이유는 편집 도구의 조용한 chrome을 유지하면서 파일의 색상·모션이 시선을 독점하게 하기 위해서다. 앱의 정체성은 프레임의 낮은 청록 기운, 반복 루프 마크, 원본→목표색 매핑 행에서 나온다. Figma 전체를 복제하거나 흔한 SaaS 카드 대시보드로 만들지 않는다.

- ground: `#F2F7F7` — 제품의 재료인 색상을 방해하지 않는 저채도 프레임.
- surface: `#FFFFFF`, raised/canvas surround: `#F4F6F8`, selected: `#EBEDEE`.
- text: `#131416`, muted: `#5D5F60`, border: `#E8EAEC`, control border: `#CDCED1`.
- accent: `#1B6C80`. 로고·focus·선택 표시 정도로 제한. Export는 near-black + white label.
- warning: `#92400E` on `#FFFBEB`; error: `#C4242A` on `#FFEDEA`. 색상 외에 문구·아이콘을 함께 사용.
- 애니메이션과 사용자가 고른 팔레트의 다색은 실제 작업물 데이터이므로 허용. 앱 chrome의 무지개 장식은 금지.
- UI 글꼴: IBM Plex Sans / 한국어 system sans fallback. code·hex·파일 ID에는 IBM Plex Mono 또는 system monospace. 최종 도입 시 폰트 license 확인 후 self-host, 외부 폰트 요청 없음.
- 크기: 파일명 22/28, 패널 제목 16/24, UI 14/20, 보조 12/18. 모바일 입력 16px. 수치는 tabular nums.
- radius: sheet 16px, 그룹 8px, control 6px. spacing은 4px 단위, 큰 영역 간 gap 24px.
- 기본 light chrome만 제공. dark background preview는 지원하지만 앱 전체 dark theme은 후순위.
- 배경 gradient·glass·glow·도트 그리드·매번 튀는 패널 entrance는 금지. 실제 투명도 확인용 체크보드는 예외.

## 7. 상호작용·상태·접근성

모든 편집은 즉시 preview에 반영하지만 다운로드 전까지 원본 파일 자체를 덮어쓰지 않는다. 색상 drag는 하나의 undo 명령으로 합치고, 취소하면 이전 값으로 복원한다. hex 입력은 유효한 완성 값에서만 commit하며 입력 중 invalid 문자열로 preview를 깨지 않는다.

상태 모델: `sample-ready → loading → ready → modified → exporting → exported`. 실패는 `load-error`, `preview-error`, `export-error`로 분리하며 직전 정상 문서를 보존한다. 재생기 재시작 실패 시 색상 변경 기록을 버리지 않는다.

- 빈 파일: `This file is empty. Choose another JSON file.`
- 잘못된 JSON: 구문 오류 위치를 가능한 범위에서 표시하고 다른 파일 열기 제공.
- 지원하지 않는 color: `Animated colors are preserved, not editable in this version.`
- 외부 이미지/폰트 참조: 원격 URL을 자동 fetch하지 않고 참조 존재를 진단한다. v0.1은 외부 에셋 문서의 편집 export를 차단하고 원본 다운로드는 허용한다. 필요한 원격 조회 허용·서명 URL·CORS를 임의 처리하지 않는다.
- expressions: 임의 JavaScript 평가 금지. expression 미지원 모드가 확인된 player 설정을 사용하고, 이를 보장하지 못하면 해당 문서 preview·편집 export를 차단한다.
- 파싱 전 파일 크기 제한과 중첩/노드 수 budget을 둔다. 수치는 fixture·실기기 측정 후 확정하고 UI에 실제 제한을 표시한다.
- 파일 교체/새로고침: 수정 상태면 경고. 기본 세션은 메모리 기반이며 새로고침 복구를 약속하지 않는다. IndexedDB 복구는 별도 후속 범위.
- 단축키: Space 재생, Cmd/Ctrl+Z undo, Shift+Cmd/Ctrl+Z redo, Cmd/Ctrl+O 파일 열기. 입력 focus 중 재생/단축키를 가로채지 않는다. browser reload/back shortcut을 덮어쓰지 않는다.
- 색상 input·slider·icon button은 label/accessible name을 갖고, 모든 기능은 키보드로 도달. modal은 focus trap/Escape/닫은 뒤 focus 복귀.
- UI feedback은 120–180ms, sheet 전환 최대 220ms의 설계 목표. 실제 동작 시간 보장 수치가 아니다. reduced motion에서는 UI 이동을 제거하고 샘플 자동 재생을 멈춰 명시적 Play를 제공한다.

## 8. Export — 제품의 마지막 한 단계

상단 Export는 modal을 연다. 탭은 `Lottie JSON` / `React` 두 개. JSON 탭에 파일명·수정 요약·진단과 Download를 표시한다. 재생 속도·hover 같은 wrapper 설정이 JSON에 포함되지 않는다는 점을 명시한다.

React 탭은 설치 명령, TSX, asset 파일 경로 예제를 제공한다. `Copy code`와 필요한 파일 다운로드가 연결되며 실제 파일과 코드의 이름이 일치한다. 의존성 버전과 import API는 선택한 player의 실제 검증 버전으로 고정한다. v0.1에서 npm component package를 별도 배포하지 않고 코드 예제부터 제공한다.

JSON 기본 파일명은 `{original-name}.moro.json`; 원본 유지. `Download original`은 별도 text action이다. 원본 데이터와 export copy는 분리하고 Object URL은 사용 종료 후 해제한다. “다운로드 완료”는 브라우저에서 파일 저장을 확정할 수 없는 경우 사용하지 않고 “다운로드 요청됨” 수준으로 표시한다.

Export 후 Star modal·confetti를 강제로 띄우지 않는다. 하단에 `Useful? Support the project on GitHub.` 링크를 조용히 둔다. 공유 링크는 public sample/preset ID만 담으며 사용자 파일을 자동 업로드하지 않는다. v0.1에는 사용자 파일 공유 기능이 없다.

## 9. 구현 구조

React + TypeScript + Vite의 브라우저 앱을 제안한다. 선택한 재생기 하나를 adapter 뒤에 숨기고, 두 엔진 동시 지원을 v0.1 목표로 삼지 않는다. UI 상태와 문서 상태는 분리한다. 아래 디렉터리는 권장 구조이며 아직 프로젝트 코드는 없다.

```text
apps/web/                  shell, library, stage, inspector, export
packages/document-core/    inert parse, diagnostics, static-color edits, undo
packages/player-adapter/   load/play/pause/seek/speed/dispose
examples/react/            생성 코드 실제 실행 검증
fixtures/                  자체 샘플, edge cases, provenance
```

문서 모델은 `originalBytes`, `originalDocument`, `workingDocument`, `diagnostics`, `editHistory`, `playbackSettings`를 분리한다. 원본 bytes는 immutable, 수정은 JSON path 기반 명령이며 배열·unknown property를 임의 삭제하지 않는다. frame 범위와 색상 값은 문서에서 읽고 중복 hardcode하지 않는다.

변경 payload는 property path·before·after를 기록하고 export는 workingDocument를 직렬화한다. preview player가 입력 객체를 변형할 수 있으므로 원본·workingDocument의 참조를 그대로 넘기지 않는다. 샘플·테스트는 provenance를 기록하고 서비스 REA 번들은 제품 코드·fixture에 복사하지 않는다.

## 10. 작업 순서와 통과 조건

1. **Playback spike:** 자체 최소 fixture + 정적 color·gradient·keyframe·외부 asset·expression fixture로 후보 player를 비교한다. pause/seek와 expression 비실행 경계부터 검증. 외부 reference는 자동 fetch하지 않는다.
2. **문서 core:** 파싱·진단·정적 fill/stroke 수정·undo 테스트. 안 바꾼 field를 보존하고 undo가 구조적으로 원본과 동일해져야 통과.
3. **Desktop vertical slice:** 샘플 진입 → color map 수정 → synced compare → JSON export → 재import를 실제 브라우저로 검증.
4. **모바일과 React 예제:** 390px에서 file input·hex·modal·다운로드 동작, 생성 TSX의 실제 실행과 trigger 동작 확인.
5. **공개 준비:** README의 실제 데모 clip, 설치·지원/미지원·local 처리 설명, LICENSE/notice, CONTRIBUTING, issue template, CI. 이름·저장소 공개·호스팅·홍보는 사용자 승인 후 진행.

기간과 Star 목표 수는 추정하지 않는다. 단계 통과의 근거는 코드·테스트·브라우저 결과로 남긴다. 문서·UI mockup 완료와 구현 완료는 구분한다.

## 11. 수용 테스트

- AC01: 로그인 없이 `/`에서 자체 샘플을 열고 수정 가능.
- AC02: 정적 fill/stroke 수정이 nested/precomposition 대상에 적용되고 keyframe/gradient/opacity/unknown field는 유지.
- AC03: color gesture 하나는 undo 하나로 되돌리고 redo 재적용.
- AC04: 원본/수정본 비교의 frame·speed·loop가 일치하며 원본 data가 수정되지 않음.
- AC05: 다운로드 JSON을 다시 열었을 때 문서 변경값·실제 렌더 일치. wrapper 설정은 JSON 편집과 분리.
- AC06: 외부 에셋·expression·손상 파일은 정해진 진단과 안전한 차단 경로. 사용자 파일 bytes의 외부 전송 없음.
- AC07: 1440/1024/768/390px에서 page 가로 overflow 없음. 모바일 picker keyboard·focus 복귀 정상.
- AC08: 생성 React 예제가 clean example 프로젝트에서 실행되고 autoplay/hover/click의 지원되는 동작을 재현.
- AC09: reduced motion·keyboard-only 사용, control 명칭·contrast·focus 상태 확인.
- AC10: lint/typecheck/unit/browser/build 결과와 실제 공개 데모는 별도 검증. 린트 규칙 완화로 통과시키지 않음.

## 12. 공개와 유지보수

README는 영문 우선이며 한 줄 제품 정의 → 실제 편집 clip → Try demo → local quick start → 기능/제약 → 기여 방법 순서. 구현 전 fake screenshots·가짜 성능/사용자/Star 수는 넣지 않는다. 실제 생성 코드와 export 결과를 데모에 포함한다.

데모는 정적 배포를 기본으로 하며 player/WASM/font도 self-host한다. 분석 telemetry는 기본 비활성이고 초기 검증은 자발적 feedback으로 받는다. 외부 GitHub 이동은 명시적 클릭만 허용하고 탭 열기 정책은 문서화한다.

초기 기여 작업은 테스트 fixture·문서 번역·오류 메시지·접근성으로 분리한다. 개발자 혼자 감당할 수 없는 포맷·플러그인 지원을 약속하지 않는다. 라이선스는 최종 dependency/asset 목록을 검토한 뒤 선택하며 본 문서는 법률 판단이 아니다.

## 13. 확정과 남은 검증

**확정:** 무계정·로컬 우선, app-first 첫 화면, light framed-sheet UI, 큰 canvas+palette inspector, 정적 색상 편집, JSON/React 결과물, 비침해적인 GitHub CTA.

**구현 전 검증:** 작업명 사용 가능성, player/version과 expression 비실행 보장, 파일 budget, 색상 정규화, 자체 샘플 제작·권리, 폰트 포함 조건, 공개 URL, 실제 export 호환성. 이것들은 UI 방향을 미정으로 돌리는 항목이 아니라 spike와 공개 gate에서 해결할 기술/운영 항목이다.

본 문서의 화면 배치도는 설계 모식도다. 실제 작동 화면·검증된 애니메이션 에셋으로 소개하지 않는다.
