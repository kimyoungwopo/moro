# Morning Tulip — Gentle Greeting Loop

**실제 AI 생성 작품. 수동 램프/기술 fixture가 아닙니다.**

- Moro Rig lab의 `AI generate v2`에서 `brief.txt`를 입력하고, 동의 및 `Confirm one AI request`로 공식 Codex CLI 요청을 **1회** 보냈습니다.
- 실제 서버 job: `j4947-1`. 512×512, 60fps, 240프레임, 4초 루프.
- AI가 새로 설계한 15개 노드: 곡선 경로 9개, 그룹 5개, 부모를 가진 노드 13개.
- 기존 작품/현재 프로젝트/저장소를 AI에 전달하지 않았습니다. 요청 이후 도형·색·부모 관계·피벗·키프레임을 수동 보정하지 않았습니다.
- `project.moro.json`은 응답 그대로 명시적 Apply 후 UI에서 내려받은 편집 원본입니다. 응답과 저장 프로젝트의 일치, 한 번의 Undo로 빈 문서 복구, Redo 및 새 페이지 재열기를 검증했습니다.
- `animation.json`은 UI에서 내려받은 실제 Lottie이며 코어 v2 export와 일치합니다. `receipt.json`은 생성/적용/내보내기 provenance입니다.
- 원문 요청은 `brief.txt`; 결과 영상은 독립 플레이어로 렌더한 파생본이며 앱에 MP4 export가 생겼다는 뜻이 아닙니다.
- 기술적 성공은 인물 생성 품질이나 모든 요청의 예술적 완성도를 승인하지 않습니다. v2 AI는 실험적 object-motion 신규 생성이며 v2 맥락 수정/자동 rigging은 포함하지 않습니다.
