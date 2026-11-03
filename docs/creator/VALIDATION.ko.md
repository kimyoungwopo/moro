# Moro Creator 검증 결과

검증일: 2026-10-31. 로컬 `feat/creator-authoring` 작업본 기준이며 원격 push·공개 배포·물리 기기 검증은 하지 않았다.

## 실제 사용자 흐름

- `/create`에서 빈 프로젝트 → ellipse 추가 → X 위치 frame 0/60 키프레임 → 실제 Lottie JSON 다운로드 성공.
- 실제 Creator 플레이어의 SVG와 다운로드한 JSON을 별도 light player에 로드한 SVG에서 frame 0/30/60 위치가 모두 일치했다. 기본 프로젝트의 X는 256/328/400, Y는 256이다.
- 편집용 `.moro.json` 저장 → 새로운 페이지에서 Open project → 가져온 레이어 선택 → frame 60의 X=400 및 두 키프레임 보존을 확인했다. 프로젝트 열기는 자동 선택을 강제하지 않는다.
- 실제 포인터 드래그 여러 move를 하나의 Undo로 취소하고 Redo로 복구했다. Play 후 실제 프레임과 SVG 이동을 확인했다.
- Creator 폭 320/390/768/1440에서 페이지 가로 넘침 없음. 390px는 세로로 캔버스·레이어·타임라인·인스펙터를 재배치한다. 물리 휴대전화 시험은 아니다.
- 원본 편집 프로젝트를 실제 CLI로 변환한 loader / success-feedback / product-interaction 예제 3종을 독립 플레이어에서 주요 프레임별로 검사했다. 총 18개 예제 프레임의 가시 레이어 위치와 샘플 모델을 비교했다.

## 자동 검사

`artifacts/creator-final-check.log`의 resource-guard run `d1c832f6240343a384430d0734e6002c`: 종료 코드 0.

- ESLint 및 앱/React 예제 TypeScript 검사 성공.
- 단위 테스트: 6개 파일, 52개 통과.
- 앱 및 React 예제 production build 성공.
- standalone skill assets 동기화 및 일치 검사 성공.
- 배포/독립 CLI 검사 3개 통과. 앱/standalone 서버의 `/create` 직접 접근도 검사한다.
- 문서 검사기 테스트 6개 통과.
- 브라우저 E2E 15개 통과: 기존 회귀 8개 + 제작 흐름 4개 + 예제 재생 3개.
- `agent:check`: 레퍼런스 6개, 개별 레시피 3개, brief/project/실제 export가 짝지어진 예제 3개. 필수 frontmatter·로컬 링크·저장소 경계를 검사한다. 모델의 자동 문서 로딩이나 미학적 품질을 보증하지 않는다.
- `git diff --check` 성공.

## 화면 확인과 한계

실제 데스크톱 캡처에서 레이어/캔버스/인스펙터/타임라인과 두 X 키가 표시되고, 원은 선택 테두리 안에 정상 렌더된다. 데스크톱 인스펙터는 내부 스크롤 영역이다. 390px 전체 페이지 캡처에서 기능이 세로로 이어지며 가로 잘림은 보이지 않는다.

독립 플레이어의 성공 예제 최종 프레임은 원형 plate와 두 사각형의 체크 표시로 읽힌다. 접합부는 실제 벡터 check path가 아니라 겹친 막대이므로 모서리가 완전히 매끈한 단일 경로와 같지는 않다. 제품 예제는 tray 위 사각형과 피드백 원을 쓰는 기하학적 상호작용 연구이며 실사 제품·텍스트·로고를 제공하지 않는다.

이 단계는 shape-only 제작의 첫 vertical slice다. 자유 SVG/path/text, import한 임의 Lottie 전체를 재편집하는 기능, 이미지/폰트/expressions, dotLottie, 앱 내 GIF/MP4 export, 클라우드 저장은 범위 밖이다. 외부 플레이어 전체 호환성·물리 기기·저사양 장시간 성능은 검증하지 않았다. 루트 AGENTS.md는 별도 보호 승인 미완료로 작성되지 않았고 우회하지 않았다.

새 Python 보조 구현 대신 Rust를 사용한다는 사용자 결정을 PRODUCT.md에 반영했다. 기존 TypeScript 제품 코어와 외부 Hermes CPU 안전 가드는 이 언어 변경으로 재작성하지 않았다.
