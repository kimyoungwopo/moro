# Moro Design Director v3 — 리서치 반영 및 실제 생성 결과

## 검증된 결과

공식 디자인 자료의 선별 가이드를 실제 v2/Director provider 입력에 연결하고, 별도 `/studio`에서 스타일 → 핵심 포즈 → 모션 → 미리보기 → 명시적 Apply 흐름을 구현했다. 기존 v1/v2 형식·경로·누적 작업은 보존했다. 이 문서는 로컬 macOS 기능·산출물 검증 기록이며 공개 배포·상업적 품질 승인·사용자의 최종 디자인 승인이 아니다.

최종 전체 오프라인 회귀: **343 unit / 109 Rust / 46 browser**, skip/retry 0. lint·typecheck·본체/React 예제 build·standalone distribution·guidance 검사도 통과했다. 실제 로그는 `artifacts/design-director-v3-no-placeholder-full.log`, guard `3254d698ee78475ca280322a9588a361`, returncode 0이다. fixture 검사는 실제 모델 추론과 구분한다.

## 실제 Codex 생성 — 총 4회

- `j17754-1`: 첫 style 응답은 그릴 도형 없이 그룹 3개만 반환했다. 실제 화면도 비어 있어 작업자가 반려했고 다음 단계에 사용하지 않았다. 원본·예약·화면을 보존했다.
- 사용자가 기존 1회를 포함한 **총 4회 상한**을 승인했다. 원래 예약을 덮거나 우회하지 않고 별도 재생성 디렉터리를 사용했다.
- `j20399-1`: 완전한 그림을 담은 스타일. 실제 상자·상품 3개·배지/체크·접지 그림자를 검토했다.
- `j20399-2`: 0 / 75 / 126 / 180 / 216f의 다섯 핵심 포즈. 기존 그림을 유지하며 상품 수납과 모서리가 연결된 덮개 접힘을 검토했다.
- `j20399-3`: 최종 모션. native의 디자인·작성 키 보존과 frontend의 포즈별 8채널/경로/trim 샘플 일치를 통과했다.

최종 프로젝트는 **512×512 / 60fps / 300f**, 5초 단발 이벤트다. 22 nodes, 5 groups, 11 paths, 4 path-morph layers, 100 numeric keys와 12 geometry keys를 갖는다. 이 수치는 구조 설명이지 미적 품질 점수가 아니다. 응답의 그림·타이밍을 수동으로 고치지 않았다.

## 실제 앱 경로 증거

같은 브라우저 실행에서 빈 편집기·브리프·각 호출의 동의와 이전 제안 전송 별도 동의·running·수정하지 않은 응답·단계별 작업자 수락·독립 재생·명시적 Apply를 기록했다.

- API 원본 proposal과 실제 다운로드 proposal의 JSON 값 일치
- 원본 project와 Apply 후 편집 파일 일치
- 실제 다운로드 Lottie와 core export 일치
- 한 번의 Undo로 처음의 빈 문서 복구, Redo로 결과 복구
- 새 페이지에서 저장 파일을 열고 다시 다운로드한 값 일치
- 실제 요청은 Codex이며 HTTP interception·fixture·수동 그림·자동 provider fallback은 사용하지 않았다.

`artifacts/design-director-v3-live-replacement/receipt.json`에 실제 job IDs와 위 결과를 저장했다. 비교는 직렬화된 JSON 값 기준이며 원시 CLI 이벤트 스트림의 byte-for-byte 보존을 주장하지 않는다. 모델의 자기 설명, 작업자의 다음 단계 진행 동의, 사용자의 예술적 승인은 각각 다르다.

## 실제 렌더·검토

다운로드한 Lottie를 앱과 분리한 설치된 공식 SVG player에서 150장으로 렌더했다. Lottie 원본은 60fps이며 결과 MP4는 **512×512 / 30fps / 5초**, 무음 미리보기 파생본이다. 앱에 MP4 내보내기 기능을 구현했다고 하지 않는다.

독립 플레이어의 전체 재생에서 complete 1회, frame299, paused=true를 확인했다. 과정 MP4는 **834.333333초 / 1280×960 / 15fps**로 대기·검토 구간을 가속하지 않았다. 두 MP4 모두 ffmpeg full decode를 통과했다. 상세 metadata는 `media-verification.json`에 있다.

추가로 결과 MP4를 native video에서 seek 2.5/4.8/0초 후 끝까지 재생해 ended=true, error=null을 확인했다. 단, 소유한 headless Chromium의 재생 quality delta는 total146 / dropped86이었다. 파일 디코드 정상과 화면 표시 성능은 다른 증거다. 실기기에서 무드롭 재생된다고 주장하지 않으며, 이 측정을 녹색으로 만들기 위해 반복 재생하거나 원인을 추측하지 않았다. 원본 측정은 `native-video-playback.json`에 보존한다.

0 / 30 / 60 / 100 / 160 / 220 / 260 / 299f contact sheet와 실제 160px SVG 표시를 확인했다. 상품이 앞면 뒤로 들어가고, 덮개가 연결 변을 유지하며 닫히고, 배지·체크가 나온 뒤 안정된 완료 상태가 남는다. 작은 표시에서도 상자와 체크가 구분된다. 이 샘플·재생 검증을 물리적 모바일 기기 성능이나 사용자의 미적 승인으로 확대하지 않는다.

한계: 종이는 물리적 3D가 아니라 동일 topology의 2D 경로 변형이다. 고정 paint order를 위해 중간에 안쪽 면을 숨기므로 평면적인 전환이 남는다. 최종 상업적/예술적 판단은 사용자 검토가 필요하다.

## 반영한 기능과 실제 발견·수정한 결함

- 고정된 검토 가이드가 실제 격리 subprocess stdin에 전달됨. 외부 skill 설치·실행·사용자 규칙 탐색은 하지 않는다. MIT 원문·고정 리비전과 개념 출처를 보존했다.
- 정적 스타일·포즈·모션의 분리, 정확한 제안 snapshot과 디자인/포즈 보존, 명시적 동의·Apply·Undo.
- bounded custom cubic easing, 독립 scaleX/Y, skew/axis, 동일 topology path morph, 정적 로컬 add/subtract/inverted masks, 실제 path trim과 편집 제어.
- UI의 128KiB 요청 사전 검사에 빠졌던 native 64KiB 이전-envelope 한도를 추가했다. 원본을 자르거나 자동 재시도하지 않는다.
- animated shape의 이전 `e`와 다음 `s`가 배열을 공유해 공식 player에서 tangent가 두 번 변환되는 preview 버그를 실제 RED→GREEN으로 수정했다. 각 occurrence의 geometry를 독립 생성한다.
- 테스트 SVG의 inline baseline 4px 여백을 수정했다. 허용 오차를 늘리지 않았다.
- 음수 로컬 좌표·winding 때문에 반전 mask가 잘못 보이는 문제를 vector-only 내부 precomp 정규화로 수정했다. 실제 가림 픽셀과 부모/skew/morph의 world 위치 일치를 검사했다.
- 실제 첫 응답의 빈 그룹 문제를 계기로 그릴 도형 없는 스타일은 native/UI에서 반려하도록 보강했다. 빈 수동 편집 문서는 여전히 유효하다. 이 자격 검사는 디자인 완성도를 자동 승인하지 않는다.

## 지원 경계 / 배포

custom cubic의 네 authored 제어점은 0..1 범위다. masks는 최대 4개의 정적 로컬 경로이며 animated mask·group clipping·모든 Lottie 기능 지원을 주장하지 않는다. 사람 캐릭터 품질·true 3D·Windows·물리적 모바일·새 환경 clean install은 이 결과로 검증하지 않았다. Claude는 protocol fixture만 검증했으며 실제 생성은 Codex만 사용했다.

저장 전 상태와 주관 검토 기록은 브라우저 탭에만 존재할 수 있으므로 파일을 내려받아야 한다. 로그인·키·토큰은 공식 CLI가 소유한다. 공개 push·commit·배포·새 전역 설정은 하지 않았다. 결과 MP4·편집 원본·단계별 응답·소스 ZIP은 별도 전달한다.
