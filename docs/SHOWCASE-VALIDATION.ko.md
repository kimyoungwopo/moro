# Moro — Showcase & UI polish 검증 보고서

검증일: 2026-10-31 KST
기준 저장소: kimyoungwopo/moro / main 63f9ad71d9d9001fe0791b973cbd3ca9a9b580be
작업 폴더: `/path/to/moro` (로컬 검증 당시 작업 사본)
로컬 브랜치: feat/showcase-and-ui-polish
상태: 로컬 구현·실행 검증·실제 앱 데모 완료. 원격 push, PR, 공개 호스팅·배포·홍보는 수행하지 않음.

## 구현한 것

1. **원본 모션 2종** — Parcel dispatch와 Payment approved. 기존 세 샘플은 보존. 각 640×640 / 60fps / 240 frames. 정적 다섯 색, 원본 벡터 도형, 위치·회전·크기·opacity·trim keyframes. 외부 에셋·폰트·expression 없음. 실제 SVG player로 렌더 확인.
2. **팔레트 프리셋 3종** — Lagoon / Ember / Ink. 원본의 색조·명도 기반 결정적 매핑, 한 번 적용=undo 한 번. AI나 색상 의미 추정 기능이 아님. alpha·unknown fields·원본 bytes 보존 테스트.
3. **첫 화면/성장 동선** — 대표 샘플 기본 진입, 샘플 썸네일·라이브러리 설명, 실제 파일에서 계산한 재생 길이/FPS, 라이브러리와 Export의 GitHub 링크, 독립 favicon. Star gate·가짜 숫자 없음.
4. **브라우저 회귀 테스트/CI 구성** — Playwright 1.64.1 정확한 버전 pin. production app에서 편집·비교·undo/redo·다운로드·재import·차단 입력·모바일 picker/focus·reduced motion·새 성장 동선을 테스트. CI workflow에 브라우저 테스트 단계를 추가했으나 새 커밋의 원격 CI 실행은 하지 않음.
5. **실제 데모** — Chrome에서 샘플 재생→Lagoon→Ember→원본/수정본 비교→JSON 다운로드→Payment approved→Ink→React export를 실제 UI 입력으로 녹화. mockup/가짜 progress/합성 UI 프레임 아님. README GIF도 실제 녹화 일부로 교체.

## 실행 검증

- npm ci --ignore-scripts: clean clone 작업 폴더에서 설치. 이후 Playwright dev dependency 추가.
- `npm run check`: exit 0. lint(신규 e2e/config 포함), strict typecheck, **30 unit tests**, 앱 build, React example build, skill sync check, **3 distribution tests** 모두 통과.
- `MORO_E2E_PORT=14187 npm run test:e2e`: exit 0, **8/8 passed**, 13.0초. 기본 4187 포트에는 다른 프로세스가 있어 사용하지 않았다. 원래 프로세스는 건드리지 않고 shipped explicit port override를 추가해 검증. 기본값은 4187, strictPort/reuseExistingServer:false 유지.
- `npm audit --json`: 보고된 취약점 total **0**. 프로젝트 코드 전체 보안 인증은 아님.
- 최종 notices/demo 문서 갱신 후 `npm run skill:sync`, `npm run skill:check`, `git diff --check` 추가 통과.
- root `npm run check`는 브라우저 테스트를 포함하지 않으므로 `test:e2e`를 별도 실행해야 한다. CI에는 둘 다 연결.

## RED → GREEN와 발견한 결함

- 팔레트 helper: 빈 mapping 상태에서 실제 역할 매핑·undo transaction assertion 실패를 확인한 후 구현, 세 테스트 통과.
- 모션 생성: 두 샘플 각각 테스트→생성→구조/보존/프레임 bounds 검증. generator 전수 구조 검사는 시각 품질의 증거가 아니므로 실제 렌더를 추가했다.
- **실제 렌더에서 발견:** Lottie shape group 순서 때문에 소포 라벨·바코드·명세서·카드 세부 도형이 배경색 뒤에 가려짐. stacking regression test를 먼저 실패시킨 뒤, back-to-front로 작성한 도형 배열을 serializer에서 반전. 테스트 통과와 수정 렌더의 라벨·바코드·칩·영수증·체크 표시를 실제 캡처로 확인.
- 브라우저 새 기능 RED는 원본 snapshot에 대한 사후 민감도 replay였으며 parent UI 편집보다 먼저 실행된 TDD라고 주장하지 않는다. baseline 동작 회귀와 새 계약을 구분했다.

## UI 점검 범위

실제 production UI를 **1440×900, 1024×844, 768×1024, 390×844, 320×760**에서 확인. 320px는 한국어 상태. 측정한 body scroll width와 viewport width가 동일해 가로 넘침 없음. 320px 프리셋 버튼은 측정값 87×72px로 최소 44px 충족.

- 데스크톱: 원본/수정본 비교, 프리셋·개별 색상, 큰 프리뷰, 패널 가독성을 캡처로 확인.
- 태블릿: 비교 프리뷰를 세로로 유지하며 transport와 inspector가 접근 가능함을 확인.
- 모바일: 원본/수정본 전환, 페이지 흐름 안의 색상 패널, 3개 preset, HEX 입력. 실제 soft keyboard는 미검증.
- 브라우저 자동 테스트: picker Escape/Cancel이 색상과 focus를 복원, reduced motion 초기 정지와 명시적 Play, expression 차단, malformed file의 이전 문서 보존.
- 최종 주요 조작 중 browser log의 새 console error 없음. favicon을 자체 SVG로 연결.
- 전체 locale purity·모든 control의 contrast·screen reader·실기기·저사양 성능을 전수 인증한 것은 아님. 기존 부분 한글화 범위는 유지한다.

## 영상·파일 검증

- 원본 기록: 1440×900, H.264, 30fps, **30.8초 / 924 frames**, 13,326,750 bytes.
- 전송용 MP4: 동일 해상도/프레임/길이, **1,392,096 bytes**. 원본은 별도로 보존.
- MP4 전체 디코딩 exit 0. 1 / 5.5 / 9 / 12.5 / 17 / 24.5 / 29초 프레임을 추출해 contact sheet로 시각 검수. 앱 조작·결과 상태, 크롭·검은 화면·다른 앱/검사 toolbar 혼입 여부 확인.
- 전체 GIF: 960×600 / 308 frames, 실제 촬영 전체. README teaser는 동일 원본의 첫 14.5초 / 145 frames. 로컬 raw와 기존 baseline GIF는 artifacts에 보존하고 소스 ZIP에서는 제외.
- capture 명령은 녹화 파일 저장 후 finally에서 중복 stop을 호출해 exit 1을 반환했다. 파일은 성공적으로 저장됐으며 ffprobe·전체 decode·frame 검수로 별도 검증했다. task overlay는 이후 원복. 이 자동화 cleanup 오류를 제품 동작 실패로 분류하지 않는다.

## 구현 파일 안내

- `apps/web/src/palettes.ts`, `PalettePresets.tsx`, `showcase.css`: 프리셋과 UI 추가 경계.
- `apps/web/src/main.tsx`, `apps/web/index.html`, `apps/web/public/favicon.svg`: 기존 앱 통합.
- `scripts/generate-showcase.mjs`, `apps/web/public/samples/{dispatch,approved}.json`: 원본 샘플과 재생성 소스.
- `tests/{palettes,showcase}.test.ts`: 문서 보존·명령·모션/stacking 검증.
- `e2e/`, `playwright.config.ts`, `.github/workflows/check.yml`: 브라우저 회귀와 CI.
- `docs/SHOWCASE-ASSETS.md`, `docs/E2E.md`: 출처/재생성/테스트 방법과 이력.
- `skill/assets`: 최종 built app/core/notices와 동기화. 실제 사용자 skill 경로에는 설치하지 않았다.

## 남은 범위

공개 데모 배포와 원격 브랜치 push/PR, 새 CI readback, 이름/도메인 검토, 물리 iOS/Android 키보드·성능 점검은 별도다. GIF/MP4 생성 기능을 제품에 넣은 것이 아니라 이번 검증용 화면 녹화만 제작했다. AI·계정·클라우드·타임라인은 추가하지 않았다.

다음 공개 단계는 사용자 승인 후 **scoped commit/push → exact-SHA CI 확인 → Git 연동 배포 → 실제 공개 URL에서 핵심 흐름 재검증** 순서가 적절하다.

## 리소스 정리

Task-owned Chrome tab과 session을 닫았고, 기존 연결 탭 7개가 유지됨을 readback 확인했다. 검사 전용 production server도 중단했다. 테스트는 task-owned 서버를 사용했으며 다른 4187 프로세스를 종료하지 않았다. 사용자 작업 디렉터리/원격 저장소에 쓰지 않았다.
