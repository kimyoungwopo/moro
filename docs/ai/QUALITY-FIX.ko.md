# Moro AI 품질 문제 수정 결과

> 앞선 좌표·기본 지침·미리보기 단계의 기록이다. 작은 배지·체크 접합을 추가로 수정한 최신 검증은 [디자인 품질 수정 결과](DESIGN-QUALITY-RESULT.ko.md)를 참고한다.

검증일: 2026-10-31. 로컬 구현·실제 실행 결과이며 원격 commit/push·공개 배포는 하지 않았다.

## 수정한 원인

1. **좌표 계약 불명확**: 스키마와 실제 모델 입력에 x/y가 도형의 중심임을 명시했다. 512 배경은 x256/y256이며 scale/opacity 정상값은100이다.
2. **제작 문서가 모델에 전달되지 않음**: 격리된 no-tools CLI는 저장소의 스킬을 자동으로 읽지 않는다. 실제 composition/motion/timing/looping 레퍼런스4개를 Rust 빌드에 포함하고 두 제공자의 실제 subprocess stdin에 전달하도록 연결했다. 체크 획은 끝점·중점·길이·atan2 회전 기준으로 구성하도록 안내한다.
3. **Apply 전에 결과를 확인할 수 없음**: 제안 자체를 실제 Lottie player로 재생한다. Frame 이동, Play/Pause,64/128/512px 확인, 모션 감소 설정을 제공한다. 캔버스 경계는 바깥 미리보기 영역과 구별하고 가운데 배치했다. 큰 캔버스는 모바일 내부 스크롤로 확인한다.
4. **구조 검증을 품질 합격으로 오인**: 잘림·작은 요소·낮은 투명도·가시 요소 없음·움직임 없음·명시적 루프 끝점 불일치의 수치 경고를 추가했다. 경고가 없어도 `Not an artistic approval`을 표시한다.

## 실제로 검증한 것

- Rust25개 통과. helper 함수만 검사하지 않고, 두 provider subprocess가 레퍼런스 묶음을 실제로 받는지 행동 RED→GREEN으로 검증했다. Claude subprocess 검사는 가짜 CLI fixture이며 Claude 실제 추론 성공을 뜻하지 않는다.
- 앱 단위84개, 브라우저17개, 배포3개, 문서6개 통과. lint/typecheck/build/skill 동기화와 git diff --check 성공.
- 브라우저17개 중 AI 관련2개는 명시적 HTTP fixture이다. 실제 SVG 위치/크기, 잘림·투명도·작은 요소 경고, 부정형 루프 지시를 루프로 오인하지 않음, 이벤트 끝 정지, 모션 감소,390px 가로 넘침 없음과44px 조작부, Apply/한 번 Undo를 확인했다.
- 별도 실제 Rust HTTP + 공식 Codex + Chromium 경로에서도 제안 → 실제 SVG frame0/60/119 → Apply → 프로젝트/Lottie 다운로드 → Creator/독립 player 위치 일치 → 한 번 Undo가 성공했다. 이 경로에는 가짜 CLI나 HTTP 가로채기가 없다.
- Play/프레임 이동은 기존 편집기·현재 프로젝트를 바꾸지 않는다. 생성된 원본을 자동으로 고치거나 사용자 몰래 적용하지 않는다.

## 같은 기본 요청으로 재생성한3종

과거 기본 요청 원문을 그대로 복사해 byte-equal을 확인했다. 이전 `success-guided`의 보강 지시를 사용하지 않았다. AI 출력 프로젝트와 Lottie를 사람이 수정하지 않았고3종 모두 core export와 일치했다. independent player의 실제 SVG와64px 이미지·시작/중간/끝·루프·영상 전체 디코딩으로 검토했다.

- **Loader**: 순차 부유와 작은 크기 구분은 기본 UI용으로 사용 가능하다. 독창적인 프리미엄 일러스트라는 뜻은 아니다.
- **결제 완료**: 중앙 배치와 원형 바탕의 잘림 문제가 이번 생성에서 해소됐다.64px에서도 체크로 읽힌다. 두 사각 획 접합에는 미세한 각진 흔적이 남아 있다.
- **상품 이동**: 큰 크기에서 접촉·쌓임·완료 상태는 더 명확해졌다.64px에서는 완료 배지가 여전히 작다. 정교한 상품 일러스트보다 기하학적 UI 데모 수준이다.
- 세 결과의 샘플 검사에서 보이는 도형의 캔버스 이탈은0건, loader/product의 시작·끝 포즈는 일치했다. success 마지막1초는 안정적이었다. 샘플 숫자는 모든 프레임·픽셀·의미가 합격했다는 보증이 아니다.

비교 영상 `success-same-brief-before-after.mp4`: **왼쪽=수정 전 기본 요청, 오른쪽=제품 코드 수정 후 같은 기본 요청**. 별도 보강 prompt의 성공 사례를 오른쪽에 바꿔 넣지 않았다. 전달 영상만 SVG 바깥의4px inline baseline 여백을 제외했다. 도형이나 원본 JSON을 보정한 것이 아니다. 편집 원본60fps/전달 MP430fps, loader/product 미리보기는 원본1주기를3회 반복한다.

## 재요청 방법과 남은 한계

미리보기·경고를 보고 Animation brief를 직접 수정한 뒤 새 전송 동의를 하고 Generate proposal을 누른다. **수정한 brief만 전송**한다. 모델은 현재 프로젝트, 미리보기 이미지, 수치 경고를 자동으로 받지 않는다. 모델 시각 QA나 자동 수리 기능이 있다고 주장하지 않는다.

- 경고는 제한된 샘플의 수치 검사이다. 픽셀 수준 안티앨리어싱·가려짐·체크 의미·모션의 미학을 판정하지 않는다.
-64px 선택은 실제 미리보기 크기와 경고 기준을 바꾼다. 생성 목적을 자동으로 바꾸거나 이미 생성한 프로젝트를 재설계하지 않는다. 작은 아이콘이 목적이면 요청에도 목표 크기·단순화·최소 선 두께를 명시해야 한다.
- rect/ellipse와 기존5개 transform track 범위이다. path/text/image/정교한 일러스트·자동 기존 프로젝트 편집은 지원하지 않는다.
- 작은 표본의 개선이며 일반 성공률·모든 AI/모든 계정의 고품질을 보장하지 않는다.
- Claude 실제 추론은 앞선 OAuth401 이후 재인증되지 않았다. 사용자가 공식 CLI에서 로그인한 뒤 별도 검증해야 한다. 인증 우회나 토큰 복사는 하지 않았다.

## 로컬 증거

- `artifacts/ai-quality-rust-green.log`
- `artifacts/ai-quality-final-regression.log`
- `artifacts/ai-quality-fixed/{cases.json,results.json,render-summary.json,candidate.sha256}`
- `artifacts/ai-quality-fixed/{loader,success,product}/`
- `artifacts/ai-quality-final-live/`와 `artifacts/ai-quality-final-live-polished/`: 실제 Codex 통합 결과, 원본·스크린샷·receipt
- `artifacts/ai-quality/`: 수정 전 원본과 별도 guided 비교, 그대로 보존

전달 묶음에는 동일 요청 전후 영상·최신 소스·생성된3종 원본·최종 미리보기 캡처·검증 기록을 포함한다. 수동 제작에는 계정이 필요 없다. AI 사용은 사용자 공식 CLI의 계정·사용량·요금 정책을 따른다.
