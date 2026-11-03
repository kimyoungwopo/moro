# Moro Harness² 첫 네이티브 구현 — 검증 결과

검증일: 2026-11-01 Asia/Seoul. 로컬 전용 전달 후보이며 커밋·푸시·배포하지 않았다. 기존 dirty source를 보존했다.

## 구현 및 검증된 범위

- Rust의 k=1 7단계: base → propose-invariant → propose-domain → probe-invariant → probe-domain → compose → final. 프로젝트 실행 4회와 guidance 편집 3회, 재시도 없음.
- 네이티브 CLI preflight/run/report/adopt. run은 명시적인 `--allow-model-calls 7`이 필요하고, 기본 도움말·preflight·report는 모델을 호출하지 않는다.
- 고정 지식의 정확한 내용·SHA256, 원본 task, stage ledger와 실제 transport prompt sidecar를 보존한다. 새 출력 예약은 기존 파일을 덮어쓰지 않는다.
- strict Project/Guidance 검증, 실패 시 정지, 명시적 검토 후 로컬 lesson export만 허용한다. 자동 편집기 Apply·전역 지침 주입·예술성 자동 승인은 없다.
- 고품질 사람 요청은 path/curve, grouping/parent transform, pivot 부재를 명시하고 provider 호출 전에 차단한다. 거절된 장난감 사람을 새로 만들거나 승인하지 않았다.

## 이번 독립 재현의 실제 결과

`artifacts/harness2-independent-20261101/`은 전부 FAKE PROTOCOL / NOT INFERENCE이다. 공급자 이름은 실제 모델 사용을 의미하지 않는다.

- 빈 PATH, disposable HOME, 명시적 fake-harness-cli-fixture 바이너리만 사용했다.
- codex·claude 형식 각각 preflight → 7단계 run → strict report → fixture-only lesson export 성공. 9개 CLI 명령 전체 성공, 두 형식 합계 14개 fixture stage.
- 각 `*-report.json`에 실제 stage/source/ledger가 있고, `*.prompts/`에 7개 prompt transcript가 있다. `invocations.json`에 호출 인자와 종료값을 보존했다.
- 별도 human run은 blocked / modelCalls=0, 출력 파일도 만들지 않았다. 해당 증거는 `human-blocked.stdout.json`이다.
- fixture 최종 프로젝트를 기존 core로 parse/export하고, 설치된 expression-free `lottie_light.min.js`를 기존 `e2e/player-fixture.ts`로 실행했다. 512×512 캔버스의 청록색 원 1개인 정적 fixture이며 작품·사람 이미지 대체물이 아니다.
- 실제 브라우저 렌더 캡처 60장과 pose 6개, core export 일치, bounds 초과 0. render-summary.json과 프로젝트·animation 파일을 함께 보존했다. 정적 fixture이므로 이 결과를 창작 모션 개선이나 실시간 재생 성능 증거로 해석하면 안 된다.

## 통합 최종 검사

모든 무거운 검사는 기존 resource_guard를 통해 단일 직렬 실행했고 guard finished.returncode=0을 확인했다.

| 명령 | 실제 결과 | 로그 |
|---|---|---|
| npm run build | 성공 | artifacts/harness2-integrated-build.log |
| npm run skill:sync | 성공 | artifacts/harness2-integrated-sync.log |
| npm run check | lint·typecheck·121 tests·본체/React example build·skill check·distribution 3·guidance 6·agent check 성공 | artifacts/harness2-integrated-check.log |
| private Rust env cargo test --manifest-path bridge/Cargo.toml --locked | 64 passed, 0 failed | artifacts/harness2-integrated-rust.log |
| MORO_E2E_PORT=14188 npm run test:e2e | Chromium 20 passed, 모바일·독립 export·저장/재열기·undo·consent 포함 | artifacts/harness2-integrated-e2e.log |
| MORO_QUALITY_ROOT=artifacts/harness2-independent-20261101/render node artifacts/ai-quality-render.mjs | 실제 fixture export 렌더 성공 | artifacts/harness2-fixture-render.log |

agent:check는 문서 구조/참조 검사이며 모델이 문서를 자동으로 읽었다는 증명이 아니다. 이번 통합 검사는 기존 121/20 기준선을 유지했다.

## 원본과의 차이 및 출처

원본: https://github.com/google-research/harness2, pin `1cfe254e8d25b15f37048c3730134686abe60335`.

원본 Python runtime을 Moro에 내장한 것이 아니다. 원본의 deterministic no-model demo는 별도 감사에서 통과했으며 `artifacts/moro-harness2-upstream-audit.md`와 `artifacts/harness2-upstream-demo/verification.json`에 근거가 있다. 원본 두 task×두 mode의 ledger와 물리 실행 수는 감사 문서에 구분했다.

이번 구현은 app-specific Rust adaptation이다. 원본의 넓은 코드/도구 수정 표면·sandbox-disabled 실행·재시도·reflection memory 자동 carry-forward·final 자동 채택을 가져오지 않았다. k=1 두 proposal branch도 Rust executor에서 순차 실행한다. 최종 성공은 항상 review_required / artisticReview=not_reviewed다. Apache-2.0 원문은 `licenses/Harness2-Apache-2.0.txt`, 저작권 및 변경 고지는 THIRD_PARTY_NOTICES.md에 유지했다.

## 중요한 한계와 사고 기록

초기 worker의 수정 전 mismatch RED 테스트가 실제 PATH/HOME을 상속했고 설치된 Claude로 fall-through할 가능성이 있었다. 임시 report가 삭제되어 정확한 공식 CLI 실행·추론 여부는 확인할 수 없다. 인증 자료를 조사하지 않았으며 전체 과거 개발 과정의 공식 CLI 활동 0회를 주장하지 않는다. 이후 테스트는 빈 PATH·disposable HOME·명시 fixture 및 provider override mismatch gate로 수정했고 이번 독립 검증도 그 격리를 적용했다.

실제 Codex/Claude 추론, 모델 간 품질 비교, 예술성 향상, 사람 제작 지원은 검증하지 않았다. app comparison UI와 path/group/pivot engine 확장은 미구현이다. 기존 rect/ellipse·20 layer 한계를 유지했다. Linux hash 분기는 여기서 실행하지 않았고 Windows는 지원하지 않는다. macOS private toolchain에 rustfmt가 없어 포맷 검사는 수행하지 않았다.

## 전달물 및 검증 경계

전체 현재 Moro 소스와 필요한 package/lock/scripts/public assets/fonts/fixtures/examples/Rust sources/Cargo.lock/knowledge/licenses/docs, 선별한 proof reports를 ZIP으로 전달한다. .git·node_modules·bridge/target·dist·e2e/.results·인증/비밀/개인 자료·대량 과거 artifact는 제외한다. archive manifest로 파일별 SHA256 및 누락 여부를 검증하고 ZIP integrity test를 수행한다. 외부 clean install이나 새 기기 실행은 수행하지 않으므로 이를 성공으로 주장하지 않는다.

전달 경로 예시: `/path/to/delivery/moro-harness2/`
예약 전달 시도와 수신자의 실제 수신/열람은 별개다. 생산 완료는 ZIP·보고서·이 문서가 존재하고 해시가 확인된 뒤에만 checkpoint에 기록한다.
