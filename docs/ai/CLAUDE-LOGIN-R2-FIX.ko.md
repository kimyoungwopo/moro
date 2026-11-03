# Claude 연결 r2 — 실제 Chrome 진입 및 로그인 상태 조회 수정

## 확인된 원인

1. 실제 visible Chrome의 외부 진입은 `Sec-Fetch-Site: cross-site`, `Sec-Fetch-Mode: navigate`, `Sec-Fetch-Dest: document`로 들어왔다. 기존 검사는 API뿐 아니라 첫 HTML까지403으로 막았다. curl/headless에서200만 확인한 것으로 사용자 브라우저 진입을 증명할 수 없었다.
2. 공식 CLI는 일반 환경에서 로그인 정보를 보고했지만 Moro와 같은 env allowlist에서는 로그아웃으로 보고했다. 변수값을 출력하지 않고 하나씩 비교했을 때 **USER만 추가하면** 같은 CLI가 로그인 정보를 보고했다. 재로그인을 유도할 문제가 아니라 macOS CLI Keychain 조회에 필요한 비밀이 아닌 OS 사용자 식별자가 빠진 문제였다.

## 최소 변경

- Host/Origin 및 API 보안 검사를 그대로 두고, 허용된 공개 진입 경로의 GET/HEAD + navigate + document 조합에만 외부 진입을 허용한다. API·iframe·잘못된 Origin/Host·POST·알 수 없는 경로는 계속 차단한다.
- 공식 subprocess env allowlist에 USER만 추가한다. API 키·OAuth 토큰 환경 변수는 계속 전달하지 않는다. 인증 정보는 CLI가 관리하며 Moro가 읽거나 복사하지 않는다.
- 실제 계정 로그인/로그아웃·토큰 재발급·Claude 앱 데이터 변경·모델 호출은 하지 않았다.

## 증거

- `artifacts/claude-navigation-red.log`: 외부 문서 진입403으로 실제 행동 RED.
- `artifacts/claude-navigation-green.log`: 진입 및 보안 음성 사례 통과.
- `artifacts/claude-user-env-red.log`: USER 누락 시 signed_out으로 실제 행동 RED.
- `artifacts/claude-user-env-green.log`: USER 보존 + credential env 미전달 테스트 포함 auth16개 통과.
- 최종 전체 Rust 및 native HTTP/UI fixture: `artifacts/claude-login-r2-regressions.log`.
- 실제 Chrome Playwriter 세션28에서 `/studio`가 열리고 Claude 선택 후 `CLI 로그인 정보가 있어요` 표시를 확인했다. API 응답 signed_in / inferenceVerified=false. 사용자 기존 탭은 보존했다.
- 실제 visible 화면: `artifacts/claude-auth-visible-fixed.png`.

## 해석상의 경계

사용자가 로그인했다고 한 대상은 **Claude 앱**이었다. Moro 연결은 Claude Code CLI를 사용한다. 앱 쿠키/토큰을 가져오거나 앱 로그인과 CLI 계정이 같다고 추정하지 않는다. 지금 확인한 것은 이 Mac의 공식 CLI가 로그인 정보를 보고하고 Moro가 그대로 인식한다는 사실이다. 실제 추론·계정 일치·요금제 가용성은 별도이며 자동으로 모델 요청을 보내 확인하지 않았다.

사용자 검토를 위해 visible Chrome 탭과 localhost14205 브리지는 유지한다. 인증은 새로 시작하지 않았으므로 기존 로그인을 다시 진행할 필요가 없다.
