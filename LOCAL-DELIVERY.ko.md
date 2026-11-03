# Moro 로컬 검증본 실행 안내

이 묶음은 `kimyoungwopo/moro`의 `63f9ad7`를 기준으로 만든 로컬 개선본입니다. 원격 저장소 push·공개 배포는 하지 않았습니다. 원본 작업 폴더에 덮어쓰지 말고 새 폴더에서 확인하세요.

## 실행

Node.js 22.13 이상이 필요합니다.

```sh
npm ci
npm run dev
```

브라우저에서 `http://127.0.0.1:4173`을 여세요. 해당 포트가 이미 사용 중이면 다른 사람의 서버를 종료하지 말고, production build를 다른 포트로 띄울 수 있습니다.

```sh
npm run build
PORT=4180 npm run serve
```

## 검증

```sh
npm run check
npm audit
npx playwright install chromium
MORO_E2E_PORT=14187 npm run test:e2e
```

브라우저 테스트는 production app을 빌드하고 지정한 loopback 포트에 자기 서버를 띄웁니다. 이미 사용 중인 서버를 재사용하거나 종료하지 않습니다. Chrome이 설치되어 있고 bundled Chromium을 설치하지 않으려면 `PLAYWRIGHT_CHANNEL=chrome`을 명시할 수 있습니다.

## 이번 변경

- Parcel dispatch / Payment approved 원본 Lottie 샘플
- Lagoon / Ember / Ink 팔레트 프리셋과 한 번의 undo
- GitHub/Export 연결과 라이브러리·favicon 보강
- 실제 UI 회귀 테스트 8개 및 CI 연결
- 실제 편집 영상에서 만든 README GIF

`docs/SHOWCASE-VALIDATION.ko.md`가 최종 점검 보고서입니다. `docs/VALIDATION.md`는 이전 베이스의 기록이며, 최종 테스트 수는 새 보고서를 기준으로 확인하세요.

앱의 GIF/MP4 export 기능이 추가된 것은 아닙니다. 별도 MP4는 개선된 앱을 실제 조작한 검증·소개 영상입니다. 사용자 skill 디렉터리 설치, 원격 CI 실행, public hosting, 원격 push는 수행하지 않았습니다.
