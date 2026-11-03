# Confetti Fanfare — twin burst

체크 표시 대신 보여주는 원본 축하 컨페티 예제. 양쪽에서 순차 분사되고, 색종이가 포물선으로 올라가 회전·부유한 뒤 내려오며 사라진다. 짧은 분사선과 네 개의 반짝임이 한 번의 축하 동작을 보조한다. 글자·카드·체크 배지는 없다.

-768×768,60fps,240프레임(4초),88레이어.
- 원본 Lottie는 투명 배경이다. MP4만 #111C2E 배경 위에 실제 Lottie player로 렌더했다.
- `project.moro.json`: Moro Creator에서 Open project로 여는 편집 원본.
- `animation.json`: 실제 Moro exporter 출력. 일반 Lottie player에서 재생할 파일.
- `source.ts`: 고정 seed의 편집 가능한 제작 소스. 외부 갤러리나 CSS 애니메이션 복제물이 아니다.

## 출처와 검증 경계

이번 것은 **Moro 제작 코어로 직접 작성한 절차적 데모**다. 사용자 AI CLI가 자동 생성한 결과라고 주장하지 않는다. 기존 AI bridge의20레이어 제안 제한을 변경하거나 우회하지 않았다. 수동 Creator 코어의100레이어 범위 안에서 작성했다.

실제 canonical CLI 출력과 animation.json 일치, 실제 편집기 열기/저장/내보내기 일치, 독립 light player 렌더120프레임, 가시 도형의 경계 이탈0건, 종료 시 전 계층 투명화를 확인했다. 편집 원본60fps/MP4전송30fps를 구분한다. 영상 미리보기는4초 원본을3회 반복하며 오디오를 넣지 않았다.

## 재생·편집

프로젝트를 `/create`에서 열고 Timeline frame으로 이동하거나 Play를 누른다. 투명 배경 위 효과로 사용하는 경우 player의 loop는false로 두고 완료 후 제거하면 된다. JSON 자체에는 host의 재생 정책을 넣지 않았다.

소스 수정 후 저장소 루트에서 새로운 출력 폴더로 재생성한다. Node22.13+와 `npm ci`가 필요하다. 원본 덮어쓰기는 거부한다.

```sh
node --experimental-strip-types examples/authoring/confetti-fanfare/source.ts artifacts/confetti-new
node scripts/moro-create.mjs --input artifacts/confetti-new/project.moro.json --out artifacts/confetti-new/cli-animation.json
```
