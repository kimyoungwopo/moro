# 디자인 리서치 전체 반영 — 구현·검증 매트릭스

상태: 구현 및 전체 오프라인 회귀 343 unit / 109 Rust / 46 browser 통과. 실제 Codex 총4회(빈 첫 응답 반려 + 성공한 스타일/포즈/모션3단계), 원본 일치·Apply/Undo/재열기와 독립 렌더를 검증했다. 2026-11-01 사용자 요청 `전체 반영해보자`에 따른 작업이며 사용자의 최종 예술적 승인과는 별개다. 상세 근거는 `DESIGN-DIRECTOR-V3-RESULT.ko.md`에 기록했다.

## 제품 경계

- 기존 `/create` v1과 `/rig` v2, 기존 프로젝트, 누적 dirty 변경을 보존한다.
- 표현 확장은 별도 ProjectV3 + `/studio`에서 제공한다. 지원하지 않는 기능을 기존 v2에 억지로 인코딩하거나 형식을 조용히 바꾸지 않는다.
- v2에도 검토한 디자인 가이드를 실제 provider 입력에 연결하되 기존 요청·출력 계약을 유지한다.
- 모델은 데이터만 출력한다. 코드·식·도구·플러그인·MCP·파일 접근·외부 asset은 허용하지 않는다. 기존 격리·동의·단일 admission·취소·timeout을 유지한다.

## 반영 항목과 완료 증거

1. **형태 언어·실루엣·여백:** 실제 style 단계는 정적인 제안만 허용한다. 스타일 프레임 검토 없이는 다음 단계를 자동 호출하지 않는다. 사용자 최종 예술적 승인과 작업자의 단계 진행 승인을 구분한다.
2. **러프·핵심 포즈:** poses 단계는 3–5개의 서로 다른 프레임을 보여 준다. 승인한 그림의 색·정적 형태·정체성을 다음 단계에서 바꾸면 거절한다.
3. **위계·감정·재질·안무:** 선별한 가이드를 고정·검토된 텍스트로 실제 v2/Director subprocess stdin에 포함한다. 파일이 있는 것, assistant가 읽은 것만으로 연결 완료라고 하지 않는다. 실제 fixture capture 검사가 필요하다.
4. **중간 포즈 보존:** motion 단계가 승인한 포즈의 채널·형태를 바꾸면 브라우저 검증이 거절한다. Native는 스타일 불변성과 기존 authored key 유지도 검사한다. 모델 자기평가를 승인으로 사용하지 않는다.
5. **Custom easing:** 지원 범위는 4개의 0..1 제어점을 가진 bounded cubic Bezier와 기존 네 프리셋이다. easing 자체의 overshoot는 지원한다고 하지 않는다. 필요한 overshoot는 허용 범위 내 명시적인 numeric keys로 저작한다.
6. **독립 X/Y scale·skew/axis:** scalar scale 근사 대신 진짜 Lottie transform 필드를 내보낸다. skew 부호·합성 순서는 설치된 독립 lottie-web player의 SVG CTM과 비교한다.
7. **경로 변형:** 동일 topology·closed 상태·정점 수의 cubic 경로 keyframes를 실제 animated shape로 내보낸다. 불일치는 거절하며 자동 보정하지 않는다.
8. **Mask:** 비-group layer의 static LOCAL add/subtract/inverted masks를 지원한다. group clipping·animated mask·모든 Lottie mask mode를 지원한다고 하지 않는다. 독립 player에서 실제 픽셀이 가려지는지 확인한다.
9. **Trim path:** path layer의 start/end/offset과 tracks를 실제 trim operator로 내보낸다. opacity 흉내와 구분한다. 독립 player에서 보이는 선의 실제 길이 변화를 확인한다.
10. **편집·저장·재사용:** 선택 레이어의 실제 제어·키·경로/마스크 편집과 save/open/export를 연결한다. 원본은 explicit Apply 전 불변이고 한 번의 Undo로 복구한다. stale/no-op/cancel/preview 실패가 작업을 덮지 않는다.
11. **기술/디자인 검토 분리:** strict JSON·범위·export·안전 검사는 기술 증거다. 실루엣·재질·접촉·가림·시선·반복 피로도는 별도 주관 검토다. 자동 aesthetic 점수·레이어 수·통과 test 수를 디자인 승인으로 포장하지 않는다.
12. **배포 표면:** 로컬 `/studio`, standalone skill distribution, native bridge SPA 경로까지 실제로 읽어 확인한다. repo 안에서만 열리는 기능으로 끝내지 않는다.

## 조사 출처

주요 원문은 연구 보고서 `Lottie-Design-Research.ko.md`와 ledger에 보존했다. 런타임에 사용할 가이드·원본 리비전·라이선스·의도적 제외 사항은 `docs/ai/guidance/`와 관련 attribution에 남긴다.

- LottieFiles 공식 motion-design-skill: https://github.com/LottieFiles/motion-design-skill
- Duolingo shape language: https://blog.duolingo.com/shape-language-duolingos-art-style
- Duolingo 러프/정제 과정: https://blog.duolingo.com/streak-milestone-design-animation
- Carbon motion: https://carbondesignsystem.com/building-blocks/foundations/motion
- Carbon choreography: https://carbondesignsystem.com/guidelines/motion/choreography
- Creator easing: https://docs.lottiefiles.com/en/creator/07_animation/easing
- Lottie format helpers/properties: https://lottie.github.io/lottie-spec/latest/specs/helpers/ 및 연구 ledger의 고정 원문

외부 가이드는 참고 자료다. vendor identity·모델별 지시·글로벌 설치·재량 없는 1/3 규칙·ambient/spring 의무·Carbon 전용 대각선 금지를 가져오지 않는다. Gmarket promo montage를 특정 인앱 결제 동작의 검증 자료로 쓰지 않는다. 외부 브랜드 그림은 복제하지 않는다.

## 부모 통합 검증 준비

- `fixtures/director-v3-advanced.json`: 직접 저작한 OFFLINE 기술 fixture이며 AI 작품이 아니다.
- `fixtures/director-v3-parent-corpus.json`: 부모가 별도로 만든 valid/invalid 16 cases.
- `tests/director-parent-parity.test.ts`, `bridge/tests/director_parent_parity.rs`: 양쪽 strict parser의 같은 corpus 판정.
- `e2e/director-engine.spec.ts`: 독립 lottie-web의 affine matrices, 실제 morph geometry, mask 픽셀, trim path 길이, reverse seek 검증. 전체 브라우저 회귀에 포함해 통과했다.
- 실 provider provenance·원본/다운로드 일치·독립 전체 재생·대표 프레임/160px 검토를 별도로 수행했다. fixture나 수동 저작물을 실제 AI 출력으로 바꿔 부르지 않는다. 최종 ZIP은 전달용 verification/파일 manifest로 별도 확인한다.
