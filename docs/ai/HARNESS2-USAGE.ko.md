# Moro 네이티브 Harness² 사용법

이 CLI는 원래 Python Harness² 런타임을 실행하지 않습니다. 고정된 도구 권한과 JSON 스키마 안에서 k=1 Propose–Probe–Compose 알고리즘을 Rust로 옮긴 로컬 실행기입니다. 정상 종료도 `review_required`이며, 결과가 예술적으로 개선됐다는 뜻은 아닙니다. 현재 편집기 프로젝트를 덮어쓰거나 Apply하지 않습니다.

## 준비

저장소 루트에서 실행합니다. 기존 Rust/Cargo 도구체인을 사용하며 추가 암호화 의존성은 없습니다. macOS/Linux POSIX 환경만 지원하고 Windows는 지원하지 않습니다. brief 파일은 UTF-8, 공백만 있는 내용은 불가, 최대 4,000 Unicode scalar 값입니다. 초과분을 자르지 않고 거부합니다.

```sh
npm run harness:preflight -- --brief-file ./brief.txt --domain ui-motion
npm run harness:preflight -- --brief-file ./brief.txt --domain human-character --provider claude
```

preflight는 JSON으로 준비 여부, 차단 사유, 공급자, 7회 예산, 단계당 180초 제한, 지식 파일 경로/해시를 보여줍니다. **모델 호출은 0회**이며 모델 실행 파일도 조회하거나 실행하지 않습니다. `human-character`는 path/curve, grouping/parent transform, pivot 기능이 없어 항상 차단됩니다. 기존에 거절된 사람 캐릭터가 승인된 기준으로 바뀌지 않습니다.

## 모델 실행은 별도 동의가 필요합니다

아래는 사용자가 실제 호출 비용과 brief를 확인하고 실행을 승인한 뒤 사용하는 형식입니다. 이 문서나 보고서를 여는 것만으로 실행 권한이 생기지 않습니다.

```sh
npm run harness:run -- --brief-file ./brief.txt --domain ui-motion --provider codex --allow-model-calls 7 --out ./new-report.json --codex-bin /reviewed/absolute/path/to/codex
# Claude를 선택하면 --provider claude 및 --claude-bin /reviewed/absolute/path/to/claude
```

- `--allow-model-calls 7`만 허용합니다. 생략, 6, 8, 07 등은 거부합니다. 기본 실행은 모델을 호출하지 않습니다.
- 실행 파일을 지정할 때는 검토한 절대 경로를 사용합니다. 선택한 공급자와 다른 `--*-bin` 옵션은 거부합니다. 생략하면 **동의·도메인·지식 검사 뒤에만** 해당 공급자를 PATH에서 찾습니다.
- 총 4회 project 생성 + 3회 guidance 생성, 재시도 없이 최대 7회입니다. 각 단계는 기존 격리된 provider 경계를 사용합니다. 도움말 기능 확인용 subprocess는 모델 호출 횟수와 별개입니다.
- 단계: `base`, `propose-invariant`, `propose-domain`, `probe-invariant`, `probe-domain`, `compose`, `final`. stderr에는 고정된 단계 진행만 나옵니다.
- `--out`은 새 경로여야 합니다. 기존 파일/심볼릭 링크가 있으면 덮어쓰지 않고 provider 실행 전에 종료합니다. 출력 파일을 먼저 `incomplete`로 예약합니다. 실행 파일을 못 찾거나 중단되면 예약이 남을 수 있으므로 새 경로로 재시도합니다.
- `<out>.prompts/`도 새 디렉터리여야 합니다. 실제 provider stdin 프롬프트를 단계별 `.txt`로 보관합니다. 파일은 0600, 디렉터리는 0700으로 생성합니다. brief와 프로젝트 내용이 포함되므로 민감 자료로 취급하세요. 인증 정보나 provider stderr는 기록하지 않습니다.
- SIGINT/SIGTERM은 같은 취소 플래그로 provider를 중단합니다. 진행 중 실패는 `failed`, 비정상 강제 종료 등은 예약된 `incomplete` 또는 검사에서 거부되는 불완전 JSON이 남을 수 있습니다. 어느 경우도 승인으로 취급하면 안 됩니다.
- `human-character` run은 0회 호출의 `blocked` JSON을 출력하고 파일을 만들지 않습니다. 차단과 preflight의 정상 JSON 출력은 종료 코드 0, 입력 오류/실행 실패는 1입니다.

지식은 컴파일 시 포함된 다음 저장소 텍스트로 고정됩니다. 사용자 지정 guide 경로는 받지 않습니다.

- `skills/lottie-authoring/references/harness-quality.md`
- `skills/lottie-authoring/references/character-quality.md`
- `skills/lottie-authoring/references/motion-principles.md`

보고서는 지식 원문과 SHA256을 그대로 담습니다. 해시는 macOS의 고정 `/usr/bin/shasum -a 256` 또는 Linux의 `/usr/bin/sha256sum`에 제한된 stdin을 전달해 구합니다. 도구가 없거나 실패하면 해시를 지어내지 않고 종료합니다. 모델 프롬프트도 같은 원문을 소비합니다. 원문 스냅샷은 권한이나 전역 지시가 아니라 참고 데이터입니다.

## 보고서 확인과 수동 검토 후 lesson 내보내기

```sh
npm run harness:report -- --input ./new-report.json
# 실제 결과를 사람이 검토하고 승인한 경우에만:
npm run harness:adopt -- --input ./new-report.json --out ./new-local-lesson.json --review-approved
```

입력은 최대 8 MiB JSON입니다. report는 단계 상태, 호출 횟수, brief/도메인, 차단 사유를 요약합니다. 알 수 없는 필드, 중복 JSON 키, 잘못된 단계/스키마/원문 해시, 마지막 단계와 최종 결과의 불일치, 자체 승인 표시는 거부합니다. 이 빌드가 포함한 정확한 지식 원문과 경로를 요구하므로 지식이 변경된 다른 빌드의 보고서는 보수적으로 거부될 수 있습니다. JSON 검증과 해시는 암호학적 서명이나 실제 추론 수행 증명이 아닙니다.

adopt는 올바른 7단계 `review_required` ui-motion 보고서와 명시적인 `--review-approved`가 있어야 새 로컬 lesson 파일을 만듭니다. `blocked`, `failed`, 자체 승인, 손상된 입력은 내보낼 수 없습니다. lesson에는 원래 task/도메인, 정확한 composed guidance, 지식 스냅샷/해시, 입력 보고서 바이트의 SHA256, 명시적 운영자 승인이 남습니다. **향후 프롬프트 자동 주입, 전역 메모리 학습, 편집기 변경은 하지 않습니다.** 거절된 실제 사람 캐릭터에 이 플래그를 적용하지 마세요.

## 검증 범위

`cargo test --manifest-path bridge/Cargo.toml --test harness_cli --locked`는 실제 네이티브 CLI와 별도 subprocess인 `fake-harness-cli-fixture`를 사용합니다. 두 공급자의 7단계 프로토콜, 실제 소비 프롬프트, 해시, 덮어쓰기 금지, 취소/실패, report/adopt 거부 조건을 확인합니다. 이는 명시적으로 가짜 프로토콜 검증이며 모델 추론이나 시각적·예술적 개선을 입증하지 않습니다. 프로덕션 CLI에 숨겨진 fixture 모드는 없습니다.

상류 출처 및 Apache 2.0 고지는 `THIRD_PARTY_NOTICES.md`와 `licenses/Harness2-Apache-2.0.txt`를 확인하세요. Google의 보증·추천 또는 원래 Python 엔진 통합으로 표시하지 않습니다.
