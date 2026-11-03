# Moro v2 AI: 실제 요청부터 제작까지

## 완료 범위

Rig lab의 새 v2 AI 생성 연결을 구현했고, **제품 화면에서 실제 공식 Codex CLI 요청 1회**로 새 튤립 모션을 생성했습니다. 이전의 수동 램프는 이번 증거로 사용하지 않았습니다.

- 시작: 빈 `/rig`, 0개 노드.
- 입력: `artifacts/ai-rig-tulip-brief.txt`. 작품 원본·현재 문서·저장소를 전송하지 않았습니다.
- 실행: `AI generate v2` → 입력/동의 → `Generate proposal` → `Confirm one AI request`.
- 실제 서버 job `j4947-1`; 약 72.3초 후 검토 가능한 응답을 받았습니다. 즉시 적용/자동 재시도/수동 수정/fixture 대체 없음.
- 결과: **Morning Tulip — Gentle Greeting Loop**, 512×512, 60fps, 240프레임, 4초 루프.
- 15개 노드, 실제 곡선 경로 9개, 그룹 5개, 부모가 있는 노드 13개. AI가 도형·구도·부모 관계·정적 피벗·키프레임을 새로 설계했습니다.
- 독립 미리보기 후 명시적 Apply, 편집 원본 저장, 실제 Lottie 다운로드, 한 번의 Undo로 빈 문서 복구, Redo 및 새 페이지 재열기까지 검증했습니다.

## 검증 근거

부모 통합 체인 `artifacts/engine-v2-ai-parent-integration.log`, shared guard `f23635e008c4494a90b5fdfe2cae472d`, returncode 0:

- 프런트엔드 unit **245개**.
- Rust integration **93개**. disposable HOME/TMP, 빈 PATH, 절대 fake provider, provider 인증 환경 제거. 부모 재검증은 shell launcher에서 실제 Rust 검사를 실행했습니다. 하위 작업의 임시 Python 검사 launcher는 최종 제품 소스에 포함하지 않았습니다.
- Chromium **34개**, 새 v2 AI 오프라인 6개 및 opt-in native Harness fixture 포함. retry/skip 없음.
- lint/typecheck/build/example build/distribution/guidance/skill/agent/diff 검사 통과.
- 오프라인 검사는 실제 모델 생성 증거와 별개입니다. 위 Rust fake subprocess 및 브라우저 fixture를 실제 AI 작품이라고 부르지 않습니다.

실제 생성 기록 `artifacts/engine-v2-ai-tulip-live/receipt.json`:

- 응답과 편집 원본은 JSON 값 기준 동일. 전송/저장 서식의 바이트 동일성을 주장하지 않습니다.
- 실제 다운로드한 Lottie는 `exportLottieV2` 결과와 동일.
- project SHA256 `ff4c012c95d6002f493e6ab0170c1cf11b256eb45eb2722b8ebd084cdc86dcf9`.
- animation SHA256 `02cac144e0ce4f536b85794a6b1d732615dec9fc75e788d8f2342fe5ecbaa355`.
- 실제 생성 예제는 `examples/authoring/ai-tulip-v2/`에 보존했습니다.

## 영상과 독립 렌더

- 과정: **102.366667초**, 1440×1080, H.264, 30fps, 3071프레임, 무음. 빈 화면/입력/요청/실제 대기/응답 검토/Apply/저장/Undo/재생이 담긴 실제 브라우저 녹화입니다. 대기 구간을 가속하거나 합성 UI로 바꾸지 않았습니다.
- 결과: **12초**, 512×512, H.264, 30fps, 360프레임, 무음. 실제 4초 모션을 독립 Lottie 플레이어로 렌더해 3회 반복한 파생본입니다. 원본 작품을 확대 crop하거나 보정하지 않았습니다.
- 독립 120프레임 렌더, 240프레임 수치 검사. 화면 밖 bounds 0건, 15개 노드의 처음/마지막 world transform 및 opacity 일치.
- 두 MP4 전체 디코딩 통과. 인코딩 후 과정의 빈 화면/입력/대기/응답/적용/마지막 화면과 결과 7개 포즈를 직접 확인했습니다.
- 결과 영상 Chromium 1× 재생은 ended=true, currentTime=12, error 없이 끝났습니다. **360프레임 중 표시 드롭 185개**가 관측돼 무드롭·매끄러운 실시간 재생 성능을 검증했다고 주장하지 않습니다. 파일 디코딩/동작과 표시 성능은 별개입니다.

## 제품 경계와 남은 제한

- v2는 실험적 object-motion **신규 생성**입니다. v2 현재 프로젝트 맥락 수정, 자동 rigging, 인물 품질 승인, SVG import/path morphing, 앱 내부 MP4 export는 포함하지 않습니다.
- 기존 `/create` v1 생성/맥락 수정/라이브러리와 Quality lab의 v1 7-call 파이프라인은 별도입니다. 이번 실제 실행은 7-call 품질 개선 루프가 아니라 v2 단일 요청입니다.
- 공식 CLI가 로그인·할당량·과금을 소유합니다. 토큰 수집/인증 변경 없음. Claude 오프라인 protocol은 검사했지만 기존 계정의 실제 OAuth 문제를 해결했다고 주장하지 않습니다.
- v1/v2/Harness가 같은 단일 admission slot을 공유하며 취소 cleanup까지 소유합니다. malformed/실패/취소/stale/no-op/export budget 초과는 기존 문서와 Undo를 바꾸지 않습니다.
- macOS 로컬 검증이며 clean install, Linux/Windows 실기기, 물리 모바일, 공개 배포는 수행하지 않았습니다. commit/push/배포/전역 설정 변경/루트 AGENTS.md 쓰기 없음.

## 자동 재개

이번 오후 작업의 전용 감시는 job `73fa5955e55a`입니다. 공식 세션 API가 같은 canonical session에 재개를 접수했고, admission `2c679a8e4e1d438baaf470b47a975eaf`가 execution generation **46**에서 실제 시작한 것을 읽어 확인했습니다. 이어서 위 통합 검사와 실제 AI 생성 작업을 실행했습니다. 강제 장애를 주입해 모든 crash 상황을 시험한 것은 아닙니다.

완성 artifact의 해시/형식을 확인하고 첨부 전달을 준비한 뒤 이 작업의 감시만 중지합니다. 파일 준비/전송 요청과 수신자의 열람 확인을 구분하며, 완료 플래그나 exit0만으로 전달 성공을 가정하지 않습니다.
