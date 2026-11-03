# Rig lab v2 — 실제 구현·검증·빈 화면 저작 시연

2026-11-01, 로컬 검증본. 공개 commit/push/deploy 및 인증/전역 설정 변경 없음. 기존 v1 source와 이전 전달물을 보존했다. 이 작업은 수동 v2 authoring이며 새로운 AI 작품/인물 품질 승인이 아니다.

## 구현

- `/rig` 별도 local-only 편집기. v1 `/create`·palette·AI·Quality lab을 유지하고 명시적인 v1 COPY import만 허용한다.
- static cubic contour의 vertex/in-out tangent 실제 숫자·캔버스 편집, open/closed 제약, 변환 전용 parent/group, static local pivot.
- `T(position)*R*S*T(-pivot)` / parent world matrices와 실제 Lottie null-parent+relative-tangent path export. 그룹 opacity 상속 없음.
- inverse-parent 도형 드래그, inverse-node 핸들 드래그, 한 gesture Undo/취소, static-safe preserve-world pivot/reparent, subtree duplicate/remap와 descendant 있는 group 삭제 거부.
- editable v2 save/reopen와 playback export 분리, standalone Rust byte parser/semantic validator/read-only CLI, 별도 JSON Schema. provider-v2 활성화 없음.
- invalid/oversized/deep/cyclic/duplicate-key 입력과 all-time scale/world bounds를 거부한다. clamp/bake/자동 fallback 하지 않는다.

## 부모가 실제 실행한 검증

- `npm run build && npm run skill:sync && npm run check`: lint·본체/React example types·**235 unit tests**·build·distribution3·guidance6·skill/agent check가 통과했다.
- 기존 + Rig lab authoring·역방향 독립 player·mobile320/390px·v1 reject·export budget browser 검사까지 **27개 통과**한 로그: `artifacts/engine-v2-final-regression.log`, guard returncode0.
- 격리된 HOME/PATH에서 부모가 실제 `cargo test --locked` 재실행: **84 passed / 0 failed**. `artifacts/engine-v2-parent-native-and-media.log`, 후속 render/encode/decode까지 guard returncode0.
- 부모가 TS 코어를 실제 메모리 bundle한 뒤 동일 byte corpus를 native CLI와 비교: **13/13 일치** (3 valid/10 invalid). `artifacts/engine-v2-parent-parity/results.json`. stdout/error를 만들거나 예상값으로 대체하지 않았다.
- 최종 hover 가독성 수정 뒤 **28개 browser tests 전체 통과**, native fixture도 포함했고 skip/retry 없이 완료했다. `artifacts/engine-v2-final-delivery-chain.log`의 guard `c092917264274e90b35c8f70b19cc3f2`는 finished.returncode=0이다. 앞선27개 성공, 중간1개 test-deadline 실패와 마지막28개 성공은 서로 다른 실행으로 구분한다.

실제 browser authoring acceptance는 빈 /rig→Add path→tangent 숫자/실제 포인터 drag→한 Undo→group parent→pivot→rotation keys→save→새 페이지 reopen→export→독립 Lottie를 실행했다. 320/390px에서 회전된 parent 아래 child 드래그의 local 좌표, 취소, 한 Undo와 수평 overflow0을 확인했다. 별도의 independent light-player는 parent chain/pivot/curve를0/60/15/119/30/0 역방향 seek에서 실제 SVG CTM과 비교했다. 순수 함수 검사나 overlay만으로 player 성공을 선언한 것이 아니다.

## 통합 과정에서 직접 잡은 문제

1. editable budget에는 유효하지만 export complexity를 초과하는 프로젝트가 렌더 중 예외로 전체 화면을 비우던 문제를 browser RED로 재현했다. export 예외를 별도 상태로 유지하여 오류를 표시하고 editable save를 계속 허용한다. 한도를 완화하거나 데이터를 잘라내지 않았다. `e2e/rig-export-budget.spec.ts`.
2. 전역 hover 규칙 때문에 주 버튼의 흰 글자가 밝은 배경 위에 놓이는 문제: 실제 computed contrast **1.083346**의 browser RED 후 `.moro-rig button.rig-primary:hover:not(:disabled)` 범위에서 수정했다. `e2e/rig-controls.spec.ts`.
3. 후속 전체 회귀에서 native Harness 복합 검사가30초의 test deadline에 도달했다. 당시 trace를 직접 열어 capability/generation/candidate Apply/save/export는 모두 완료했고, independent page 생성 중 deadline에 도달한 것을 확인했다. 이 복합 검사만90초로 분리했다. provider180초 한도·7회 예산·동의·모든 assert·실패 시 중단은 그대로이며 자동 retry를 추가하지 않았다. 최종 재실행 결과와 이전 실패를 구분한다.

## 처음부터 만드는 실제 과정과 결과

`Articulated desk lamp - manual v2`를 빈 Rig lab에서 실제 UI로 새로 저작했다. 자동화는 버튼/필드만 조작했으며 프로젝트 import, 사전 완성 data 주입, fake provider, hidden app state mutation 없음. provider POST=0이다.

가시 경로: 빈 프로젝트 → base → 부모/관절/팔 → cubic 등갓 vertex/tangent 편집 → 세 그룹의 keyframes → 실제 Play → editable save → Lottie export. 입력마다220ms의 가독성 대기를 넣은 원속도 재실행 녹화이며, UI 화면을 정적 이미지로 교체하거나 가짜 진행 상태를 삽입하지 않았다. 최초 빠른 녹화와 후속 수정 전 녹화도 별도로 보존했다. 전달하는 것은 마지막 수정된 화면에서 재실행한 영상이다.

원본10 nodes(보이는7,groups3),512²/60fps/240frames(4초). 실제 저장 JSON과 exportLottieV2 결과가 다운로드 animation과 일치한다. independent light-player의120 PNG captures/30fps 및240 numeric frames에서 world bounds 초과0, 모든 node의 첫/마지막 world matrix 일치를 확인했다. 이는 수치/렌더 검증이지 artistic approval이 아니다.

결과 MP4는4초 모션3회,12초/무음/512²/30fps이다. 전달용 확대본만 원본 canvas의 x130,y158,size346을512로 확대했다. 전체240프레임 bounds union이 x164..444.5232/y230.1585..435이므로 margin 포함 crop 안에 들어간다. 원본 JSON/전체 캔버스 영상은 그대로 보존했다. 앱에 MP4 export를 추가한 것이 아니고 별도 개발 렌더 파생본이다.

영상 capture·encoding·full decode·실제 처음/중간/마지막 frame 관찰은 별도 단계로 수행한다. 타일 contact sheet의 남는 검정 칸은 마지막 프레임이 아니므로 실제 마지막 decoded frame을 따로 검사했다. 무드롭 재생/물리 모바일 기기 성능/모든 플랫폼 성능은 보장하지 않는다.

## 남은 경계

AI pipeline은 아직 v1이며 human-character preflight 차단을 유지한다. local v2에 path/group/pivot가 생겼다는 사실만으로 AI가 이를 생성·수정하거나 고품질 사람 디자인이 승인됐다고 선언하지 않는다. 자동 IK/rig, animated preserve-world reparent/bake, path morph/holes/compound contour, group 합성 opacity, SVG import, live model 품질 개선, Linux/Windows 및 새 기기 clean install은 이번 완료 범위 밖이다. JSON Schema 단독으로 graph/world/duplicate/depth/parity를 증명하지 않는다.

전달은 제작 과정 MP4·완성 모션 MP4·Moro editable/Lottie 원본·검증 receipt 및 source ZIP이다. 소스 ZIP은 credentials/node_modules/.git/target/dist/대량 capture를 제외하고 실제 package/import/assets 의존 경로를 포함하며, 파일별 SHA256/ZIP integrity/압축해제 hash 일치를 확인한다. 이는 clean install 성공을 대신하지 않는다.
