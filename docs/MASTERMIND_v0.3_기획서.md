# 마스터마인드 (Mastermind) v0.3 기획/현황서

## 1. 문서 목적
- 본 문서는 `마스터마인드`의 `v0.3` 개발 결과와 현재 상태를 정리한 인수인계 기준 문서다.
- `v0.2` 문서는 보존하고, 본 문서에서 `v0.3`의 실제 변경점/버그/향후 과제를 추적한다.

---

## 2. 버전 히스토리
- `v0.1`:
  - 제품 컨셉/타겟/사운드 방향 확정
  - 로컬 웹앱 + 원클릭 실행 방향 정리
- `v0.2`:
  - React/TS/Vite 3패널 UI 골격
  - 큐 상태관리 + A/B 모니터 연동(시뮬레이션 처리)
- `v0.3` (2026-02-20 업데이트):
  - 프로젝트 네이밍/경로 `Mastermind`로 일관 정리
  - 실제 DSP 워커 접합(시뮬레이션 제거)
  - 마스터링 파라미터 실연결 + 트랙별 진행률/다운로드
  - 업로드/툴팁/레이아웃/mono 처리 관련 실사용 버그 수정

---

## 3. v0.3 한줄 요약
`“보여주기용 와이어프레임” 단계에서 “실제 WAV를 처리하고 결과를 내려받을 수 있는 로컬 마스터링 앱” 단계로 진입`

---

## 4. 오늘 작업 상세 (2026-02-20)

### A. 네이밍/구조 정리
- 앱 폴더명 변경:
  - `Web-Audio-Mastering/mastering-master` -> `Web-Audio-Mastering/mastermind`
- 런처 파일명 변경:
  - `run-mastering-master.bat` -> `run-mastermind.bat`
- 코드/문서/설정 내 레거시 문자열(`mastering-master`, `Mastering Master`) 정리

### B. 브랜딩/레이아웃/UI 개선
- 사이트명/프로젝트명 `Mastermind` 반영
- 고정형 얇은 헤더 + 좌상단 `MSTRMND` 로고 적용
- `MuseoModerno`/`Sora`를 `woff2` 내장 폰트로 사용(외부 런타임 의존 최소화)
- 하단 크레딧/포트폴리오 링크 및 결과 목록 하단 CTA 추가

### C. 언어 분기 툴팁 시스템
- 브라우저 언어 감지(`ko` 우선) 추가
- 한국어/영어 툴팁 텍스트 분기 적용
- 마스터링 파라미터/주요 액션에 설명 툴팁 연결

### D. 실제 DSP 접합 (핵심)
- 기존 `web/workers/dsp-worker.js`를 새 앱에서 호출하는 워커 클라이언트 추가
- 큐 처리 로직에서 시뮬레이션 상태전이를 제거하고 실제 처리 파이프라인으로 교체:
  1. 파일 decode
  2. LUFS 측정
  3. DSP 렌더(`RENDER_FULL_CHAIN`)
  4. 결과 WAV 인코딩
  5. 큐 상태/수치/UI 갱신

### E. 마스터링 컨트롤 실연결
- 우측 `Mastering Controls`가 실제 처리 설정을 수정하도록 연결
- 출력 포맷(`sample rate`, `bit depth`, `dither`)을 결과 파일 생성에 반영
- 전역 설정 타입 분리:
  - `src/shared/types/mastering.ts`

### F. 처리 가시성/결과 UX
- 트랙별 진행률/상태 텍스트 표시
- 곡별 다운로드 + 완료곡 일괄 다운로드(`Download Done`) 추가
- 오류 메시지 행 표시 추가

### G. 실사용 중 발견된 이슈 수정
- 업로드해도 목록이 하단에 밀려 보여 “없는 것처럼” 보이던 레이아웃 문제 수정
- 툴팁이 상단/패널에 가려지는 문제를 `fixed` 오버레이 툴팁 레이어로 교체
- mono WAV 처리 시 `Cannot read properties of undefined (reading 'length')` 오류 대응:
  - 입력을 stereo로 안전 변환
  - 체인 렌더 실패 시 `NORMALIZE` fallback 경로 제공

---

## 5. 현재 사용 시나리오 (v0.3 기준)
1. 좌측 `Upload WAV` 또는 드래그앤드롭으로 파일 추가
2. 트랙 선택 후 `Process Selected` 또는 `Process All`
3. 처리 진행률/상태 확인
4. 완료 후 A/B 모니터에서 원본/마스터 비교
5. 곡별 `Download` 또는 `Download Done`으로 결과 저장

---

## 6. 시행착오 / 디버깅 로그 (중요)

### 6.1 `Cannot read properties of undefined (reading 'length')`
- 증상:
  - Process 실행 시 즉시 실패, 트랙이 `error`로 종료
- 원인:
  - mono 입력에서 stereo 가정 로직이 섞인 DSP 경로를 타며 배열 인덱스 접근 실패 가능
- 조치:
  - decode 직후 mono를 stereo로 복제 변환
  - full chain 실패 시 normalize fallback 적용

### 6.2 “업로드는 됐는데 목록에 안 보임”
- 증상:
  - selected 상태는 존재하나 화면상 리스트가 아래로 밀려 즉시 보이지 않음
- 원인:
  - 패널 grid row 구조 + hidden input 배치 영향으로 스크롤 영역이 하단으로 밀림
- 조치:
  - `queue-panel` 전용 row 정의
  - hidden input이 layout row를 차지하지 않도록 처리

### 6.3 툴팁이 헤더/패널에 가려짐
- 증상:
  - 우측 패널 툴팁이 상단 고정 헤더에 가려져 일부/전체가 안 보임
- 원인:
  - pseudo-element 툴팁이 부모 stacking/overflow 영향을 받음
- 조치:
  - 전역 `TooltipLayer`(fixed + high z-index)로 변경

### 6.4 빌드 종료코드 이슈 지속
- 증상:
  - `npm run build`가 transform 이후 비정상 종료 코드로 끝나는 환경 존재
- 상태:
  - `npx tsc -b`는 통과
  - 런타임/개발 서버 기준 기능 동작은 확인
- 조치 필요:
  - Node 20 LTS 기준으로 CI/로컬 빌드 재검증

---

## 7. 현재 한계 / 미완료 사항
- 실제 waveform 렌더(파형 시각화)는 아직 placeholder 수준
- 마스터링 완료 직후 첫 완료 트랙 자동 A/B 오픈 미구현
- 파형 클릭 seek를 “실제 렌더된 waveform UI” 기준으로 직관적으로 제공하는 작업 미완료
- 다중 트랙 처리 취소/재시도 UX는 기본 수준(강화 필요)

---

## 8. 사용자 피드백 반영 백로그 (v0.3 이후)
1. 마스터링 완료 시 첫 완료 트랙(또는 유일 트랙)을 A/B에 자동 로드
2. 마스터링 완료 즉시 waveform 자동 표시(원본/마스터)
3. 재생 중 waveform 클릭 시 해당 시점으로 즉시 점프 + 원본/마스터 비교 흐름 최적화

주의:
- 위 3개 항목은 사용자 요청에 따라 “즉시 구현”이 아니라 다음 작업 항목으로 문서화함.

---

## 9. 다음 단계 (v0.4 제안)
1. Waveform 실구현
  - `wavesurfer.js` 기반 실제 파형 렌더/동기화
  - 클릭 seek + 드래그 탐색 + A/B 포지션 동기
2. A/B UX 자동화
  - 첫 완료 트랙 자동 포커스
  - 완료 시 중앙 패널 상태 자동 업데이트
3. DSP 안정성 강화
  - mono/stereo/짧은 오디오/비정상 헤더 파일 케이스 확장 테스트
  - worker 오류 코드 체계화
4. 배포 안정화
  - Node 20 LTS 고정
  - 빌드 종료코드 이슈 재현/해결
5. 결과 관리
  - 곡별 메타(렌더 설정 스냅샷) 저장
  - 배치 ZIP 다운로드(선택)

---

## 10. 주요 변경 파일 (v0.3)
- 앱/브랜딩:
  - `Web-Audio-Mastering/mastermind/src/App.tsx`
  - `Web-Audio-Mastering/mastermind/src/styles/global.css`
- 큐/처리:
  - `Web-Audio-Mastering/mastermind/src/features/queue/QueueProvider.tsx`
  - `Web-Audio-Mastering/mastermind/src/features/queue/QueuePanel.tsx`
- 마스터링 패널:
  - `Web-Audio-Mastering/mastermind/src/features/mastering/MasteringPanel.tsx`
- 워커/인코딩:
  - `Web-Audio-Mastering/mastermind/src/lib/dsp/dspWorkerClient.ts`
  - `Web-Audio-Mastering/mastermind/src/lib/audio/wav.ts`
- 공용 타입/툴팁:
  - `Web-Audio-Mastering/mastermind/src/shared/types/audio.ts`
  - `Web-Audio-Mastering/mastermind/src/shared/types/mastering.ts`
  - `Web-Audio-Mastering/mastermind/src/shared/ui/TooltipLayer.tsx`
  - `Web-Audio-Mastering/mastermind/src/shared/i18n/uiTips.ts`

---

## 11. v0.3 완료 정의 (DoD)
- 실제 WAV 파일을 큐에 올려 마스터링 처리 후 결과 다운로드가 가능하고,
- 마스터링 파라미터가 실제 처리 경로에 연결되어 있으며,
- 사용자 피드백으로 확인된 치명 UX/처리 오류(목록 비가시/툴팁 가림/mono 오류)가 재현되지 않는 상태를 v0.3 완료로 본다.

