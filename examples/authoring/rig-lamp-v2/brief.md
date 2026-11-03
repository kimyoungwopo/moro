# Articulated desk lamp — local v2 / 직접 저작

Rig lab의 빈 프로젝트에서 실제 UI로 새로 만든 비인간 기술 시연이다. AI 생성·기존 JSON import·숨겨진 앱 상태 주입이 아니다.

열기: `/rig` → Open v2 project → `project.moro.json`. `/create`와 기존 v1 CLI는 이 v2 파일의 편집 경로가 아니다. `animation.json`은 독립 재생용 Lottie이며 편집 프로젝트와 다르다.

- 원본:512×512,60fps,240프레임(4초),10 nodes. 보이는 도형7개와 transform-only groups3개, 부모가 있는 nodes8개.
- 구성: 바닥·팔·관절을 도형으로 생성 → 3개 그룹의 부모 관계와 실제 회전축 설정 → 등갓의4개 cubic vertices와 상대 tangent offsets를 숫자 입력으로 직접 편집 → 세 그룹의 회전 키프레임 → 실제 재생 → 편집 프로젝트 저장 및 Lottie export.
- 편집기 UI를 통한 재실행 녹화와 결과 영상은 서로 다른 전달물이다. 제작 과정은 원속도 전체 조작이며, 입력마다220ms의 가독성 대기를 넣었다. 가짜 진행 상태나 정적 스크린샷으로 교체하지 않았다.
- 결과영상은 원본 Lottie를 독립 light player에서30fps로120장 캡처한4초 모션을3회 반복한12초/무음 H.264 파생본이다. 전달용 확대 영상만 원본512 캔버스의(x130,y158,size346) 영역을512로 확대한다. 모든240프레임의 전체 도형/stroke bound가 이 영역 안에 있음을 확인했고 원본 JSON·전체 캔버스 렌더는 보존했다.
- 원본 project/export는 수작업 후처리하지 않았다. UI 저장 project를 strict v2 parser로 읽고 실제 core export와 다운로드 animation이 같음을 확인했다.
- 관절 world matrices의 처음/마지막 일치와240프레임에서 world bounds 초과0을 검사했다. 그 수치는 미적 승인이나 고품질 인간 제작 증거가 아니다.

AI/provider는 여전히 v1이다. 사람 제작 지원·v2 provider 활성화·자동 rig/IK·path morph·합성 group opacity는 이 예제가 증명하지 않는다. MP4는 개발 검증용 렌더 파생본이며 앱 자체에 MP4 export가 추가된 것은 아니다.
