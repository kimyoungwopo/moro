# Moro — Lottie 제작 도구로 방향 수정

상태: 사용자 요구에 따른 제품 범위 수정. 아래 제작 기능은 아직 구현되지 않았으며, 기존 recolor/샘플/테스트/데모의 완성도와 분리한다.

## 제품 약속

**Create motion. Export Lottie.**

사용자가 완성된 Lottie 파일을 가져오지 않아도, 빈 캔버스에서 도형을 배치하고 움직임을 만들어 실제 Lottie JSON을 얻는 무계정·로컬 우선 오픈소스 제작 도구. Star·샘플 품질·기존 파일의 색상 변경은 이 주된 사용자 결과를 대체하지 않는다.

## 현재 기능과 앞으로의 역할

- 기존 JSON 열기·팔레트 수정·비교·원본 보존: 유지하되 import/recolor 보조 모드로 둔다.
- 자체 샘플과 프리셋: 시작점·학습 재료. 샘플 색상만 바꾸는 흐름을 제작 기능으로 부르지 않는다.
- Lottie player adapter: 제작 결과를 실제 export renderer로 확인하는 기존 자산.
- document-core: 기존 입력 문서 보존 계층으로 유지. 직접 제작용 문서 모델을 별도로 둔다.
- 기존 단위/브라우저 테스트: 현재 구현의 근거일 뿐 새 제작 흐름의 검증으로 재사용하지 않는다.

## 첫 제작 버전의 실제 기능

1. **New animation**: 빈 프로젝트 생성, canvas 크기·fps·duration 설정.
2. **도형과 레이어**: 사각형·원, 선택·이동·크기·fill/stroke·레이어 순서·복제·삭제. pen/path·text·SVG import는 후속 범위.
3. **진짜 타임라인**: 레이어별 트랙, playhead와 속성별 키프레임. position·scale·rotation·opacity. 재생 scrubber만 제공하고 키프레임 편집이라고 부르지 않는다.
4. **모션 작성**: 원하는 시점에서 속성 값을 바꾸고 명시적으로 keyframe 추가/수정/삭제. 첫 버전은 linear와 검증한 easing preset만 지원. 임의 expression·사용자 JS는 실행하지 않는다.
5. **결과와 편집 원본**: Lottie JSON export, 재편집용 `.moro` 프로젝트 저장/다시 열기, undo/redo. export는 추상적인 미리보기나 CSS animation이 아니라 실제 Lottie keyframe 데이터를 생성한다.
6. **적용 예제**: 검증한 Lottie player로 재생하고 기존 React 사용 예제 흐름에 연결.

첫 수직 구현은 **빈 프로젝트 → 원 추가 → 0초/1초 X 위치 keyframe 작성 → 이동 재생 → JSON 다운로드 → 독립 player에서 같은 이동 재생**이다. 이 흐름을 통과하기 전 범용 제작기 완성으로 보고하지 않는다.

## 화면 구성

기존 밝은 framed-sheet와 typography는 유지한다. 앱의 정보 구조는 제작 행동에 맞게 확장한다.

```text
상단: Moro / New / 프로젝트 이름 / undo·redo / Export
왼쪽: Layers(기본) · Shapes · Templates
중앙: 선택·드래그·resize 가능한 canvas
오른쪽: 선택 객체의 geometry·fill/stroke·transform / keyframe 추가
하단: 레이어 트랙 + time ruler + playhead + 속성 keyframes
```

초기 진입의 주 행동은 **New animation**. `Open Lottie`와 `Open project`는 구분한다. 기존 palette 작업실은 별도 모드/경로로 보존하며 제작 canvas라고 이름만 바꾸지 않는다. Templates는 새 제작 문서를 시작하는 보조 기능이다.

데스크톱은 canvas와 timeline을 동시에 쓸 수 있어야 한다. 모바일은 canvas + 선택 속성 sheet + 축약 timeline으로 재구성하되, 데스크톱 전체를 축소하지 않는다. 복잡한 타임라인의 모바일 완성도를 데스크톱 결과에서 추정하지 않는다.

## 문서·렌더링 경계

```text
MoroProject (자체 versioned 편집 문서)
  canvas: width / height / fps / duration
  layers: rect / ellipse / 순서 / style
  tracks: property / keyframes / easing
  selection + history: 편집 세션 상태
      ↓ 검증 + 결정적 변환
Lottie JSON (배포용 output)
      ↓ 실제 player
Preview / 독립 재생 검증 / React 예제
```

CSS/Canvas preview만 별도로 움직여 export와 다른 결과를 내지 않는다. 먼저 프로젝트→Lottie 변환과 실제 player 재생을 만든 뒤 canvas 편집 overlay를 연결한다. 타임라인은 초 단위 표시와 frame 단위 저장 중 하나를 명시적으로 정하고, 최종 데이터는 frame 기준으로 일관되게 처리한다. 도형 순서·anchor·scale·in/out frame을 실제 renderer와 대조한다.

기존 임의 Lottie를 자체 editable scene으로 완전히 역변환하는 것은 첫 버전에서 약속하지 않는다. 지원하지 않는 입력을 강제로 editable로 바꾸거나 unknown field를 삭제하지 않고, 기존 recolor 모드로 안내한다.

## 구현 순서와 통과 기준

1. **Project core / exporter**: rect·ellipse, static layer, position keyframes, serialize/parse. 실제 Lottie output을 독립 player에서 검증.
2. **Creator vertical slice**: New→원 추가→이동 keyframes→재생→다운로드. 실제 UI로 수행하고 양끝/중간 프레임을 검증.
3. **편집 신뢰성**: 선택·drag·resize·레이어 순서·복제·삭제·undo/redo·프로젝트 save/reopen. drag 한 번은 undo 한 번.
4. **타임라인 확장**: scale·rotation·opacity, keyframe 시간 이동/삭제/easing. 데이터·canvas·export 세 결과를 비교.
5. **제품 연결**: 기존 recolor 모드·자체 샘플·React 예제 재사용. 샘플은 `.moro` 프로젝트도 제공해 사용자가 도형과 keyframe을 직접 수정 가능하게 한다.

각 단계는 failing test→최소 구현→통과→브라우저 확인으로 진행한다. 새 문서 모델과 UI를 작성했다고 기존 전체 gate를 생략하지 않는다. 기존 동작은 regression으로 보호한다.

## 새 완료 기준

- 파일 없이 빈 프로젝트를 만들 수 있다.
- 서로 다른 도형 2개를 만들고 레이어 순서를 바꿀 수 있다.
- 최소 한 도형에 서로 다른 시점의 position keyframe 2개를 작성할 수 있다.
- 재생·seek의 시작/중간/끝 위치가 작성한 값과 일치한다.
- undo/redo와 프로젝트 저장→다시 열기 후 객체·keyframes·설정이 유지된다.
- 내보낸 Lottie가 앱 밖의 동일 검증 player에서도 같은 모션으로 재생된다.
- 템플릿을 열고 색상뿐 아니라 도형·motion을 바꿀 수 있다.
- 기존 import/recolor/export 테스트가 유지된다.

현재 샘플 영상과 30+3+8 테스트 통과는 이전 palette workbench의 근거이며 위 제작 완료 기준을 통과했다는 의미가 아니다.

## 유지하는 제한

로그인·cloud·AI 모델/API key는 필요하지 않다. AI 생성·마켓·팀 협업·범용 AE 호환·임의 expression·SVG/font 전체 지원·GIF/MP4 제품 export는 이 제작 MVP와 분리한다. 사용자가 명시적으로 추가 요청하면 별도로 범위를 정한다.
