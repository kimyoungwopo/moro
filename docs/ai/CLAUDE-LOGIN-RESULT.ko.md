# Claude 로그인 연결 — 구현·검증 결과

## 완료한 기능

- Creator AI / Quality lab / Rig v2 / Studio v3의 Claude 선택 시 공통 연결 UI.
- 명시적인 로그인 동의 → Rust 로컬 브리지 → 공식 CLI를 실행할 사용자 Terminal 연결 요청.
- 공식 `auth status --json`의 허용된 상태만 반환. 이메일·계정/조직 ID·코드·토큰·원문 출력은 응답하지 않음.
- 마운트·제공자 선택·취소/Escape는 로그인 요청0회. 동의 후1회. 중복 실행 제한, 생성과 원자적 admission 공유.
- 인증으로 문서·Undo를 변경하지 않음. 수동 명령 복사/오프라인 오류/CLI정보와 실제 추론 가능성 구분.

## 부모 전체 통합 검증

`artifacts/claude-login-20261102-integration.sh`를 변경하지 않은 shared resource guard에서 실행했다. 최종 returncode0. 완료 시각: **2026-11-02 09:29:29 KST**. 완료 결과 확인·보고는 이후로 지연됐으며 그 사이 계속 실행된 것으로 표현하지 않는다.

- 프론트엔드390개 통과(신규 인증 관련47개 포함).
- Rust123개 통과(신규 auth HTTP14개 포함).
- 브라우저 E2E46개 통과, skip/retry0.
- lint / typecheck / production build / example build / skill sync+check / distribution / guidance / authoring check / diff whitespace 검사 통과.

부모의 별도 실제 네이티브 HTTP+UI 검증은 **오프라인 CLI/Terminal launcher fixture**를 사용했다. 중간 HTTP 응답을 가로채서 성공으로 교체하지 않았다.

- 동의 후 native launcher1회, 취소 시0회; 중복 요청409.
- signed_out→signed_in fixture 상태 readback, 개인정보 canary 미노출.
- 화면1440 / 390 / 320px 가로 넘침 없음; page error0.
- 인증 전후 다운로드한 문서 동일, Undo 변화 없음.
- 근거: `artifacts/claude-login-20261102-native-ui/receipt.json` 및 화면 PNG.

## 실제 설치 CLI 연결의 별도 확인

설치된 Claude Code2.1.105와 새 브리지를 사용해 **읽기 전용 상태 조회**를 실제 UI에서 실행했다. CLI는 `signed_out`을 보고했고, Moro가 올바르게 표시했다. 로그인 동의 모달만 열었다가 Escape로 닫았으며, 실제 인증 POST0회·실제 Terminal 로그인0회·모델 추론0회다.

또한 실제 `/usr/bin/osascript`에서 앱을 제어하지 않는 순수 argv probe를 실행해 `--` 이후 명령 인자가 정확히1개로 전달됨을 확인했다. 결과는 `1:MORO_AUTH_ARGV_PROBE`. 이 검사는 Terminal 제어 권한이나 계정 인증 성공의 증명이 아니다.

- 근거: `artifacts/claude-login-20261102-real-status/receipt.json` 및 실제 상태/동의 화면 PNG.
- 사용자 검토용 브리지: Mac loopback14205, Studio 경로 `/studio`. 다른 기기의 localhost 접속 주소가 아니다.
- 공개 배포·커밋·푸시·CLI 설치/업데이트·계정 변경은 하지 않았다.

## 남은 사용자 단계 / 한계

사용자가 Moro에서 Claude를 선택하고 **Claude 로그인 → 동의 → 공식 로그인 시작**을 눌러 Terminal과 공식 브라우저 인증을 완료해야 한다. macOS가 Automation 권한을 물을 수 있다. 필요 시 코드는 공식 Terminal에만 입력한다. 그 뒤 로그인 상태를 다시 확인한다.

**구현·로컬 기능 검증 완료와 실제 계정 로그인/추론 성공은 별개다.** 실제 macOS Terminal 로그인 실행 및 브라우저 승인은 자동 QA에서 수행하지 않았다. Linux 자동 Terminal 연결·Windows·새 환경 clean install도 검증하지 않았다. CLI가 로그인 정보를 보고해도 만료된 토큰 또는 다음 요청 성공까지 보장하지 않는다.

사용 가이드: `CLAUDE-LOGIN.ko.md`. 상세 계약: `CLAUDE-LOGIN-CONTRACT.md`.
