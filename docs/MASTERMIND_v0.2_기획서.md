# 마스터마인드 (Mastermind) v0.2 기획/현황서

## 1. 문서 목적
- 본 문서는 `마스터마인드`의 기획 + 현재 구현 현황을 함께 관리하는 기준 문서다.
- 다음 작업자(LLM/개발자/디자이너)가 빠르게 상황을 파악하고 이어서 개발할 수 있도록 작성한다.

---

## 2. 버전 히스토리
- `v0.1`:
  - 제품 컨셉, 사운드 방향, 기능 범위, 마일스톤 정의
  - 로컬 웹앱 + Windows 원클릭 실행 + 배치 마스터링 방향 확정
- `v0.2` (2026-02-19 업데이트):
  - UI/UX 의사결정 보강
  - React 보일러플레이트 생성
  - 와이어프레임 기반 3패널 UI 골격 구현
  - WAV 다중 업로드 + 큐 상태관리 1차 구현
  - A/B 모니터를 큐 상태와 연동

---

## 3. 제품 한줄 정의
`JRPG/판타지 instrumental WAV 플레이리스트를 YouTube 환경에 맞춰 일관된 볼륨과 투명·따뜻·부드러운 톤으로 일괄 마스터링하는 로컬 웹앱`

---

## 4. 핵심 목표(변경 없음)
- 대상: JRPG/판타지 계열 instrumental WAV
- 일반 배치량: 약 18곡, 최대 50곡
- 목표:
  - 곡 간 loudness 일관성
  - transparent/warm/smooth/clean 톤
  - 전곡 A/B 비교 가능한 빠른 작업 UX

---

## 5. 확정된 의사결정 (v0.2 반영)

### 5.1 UI 모드 정책
- `Simple + Advanced` 이중 모드로 가지 않음
- `단일 Advanced UI`로 고정
- 내부 엔진용 저수준 파라미터는 숨기고, 사용자 노출 파라미터는 그룹화

### 5.2 레이아웃 정책
- 카드 UI 중심이 아니라 `구조화된 와이어프레임 레이아웃` 채택
- 데스크톱 우선(모바일 대응은 v0.1~v0.2 범위 밖)
- 3패널:
  - 좌측: Queue
  - 중앙: A/B 모니터
  - 우측: Mastering Controls

### 5.3 컴포넌트 정책
- 커스텀 스크롤바 사용
- 커스텀 드롭다운 컴포넌트 사용
- 공통 UI 컴포넌트로 재사용 가능한 구조 유지

---

## 6. 오늘 작업 내역 상세 (2026-02-19)

### A. 기반 작업
- 공개 저장소를 로컬로 클론
- 기존 코드의 구조/의존성/보안 포인트 점검
- 프롬프트 인젝션 계열 위험은 사실상 없음(LLM 연동 코드 부재)

### B. 신규 앱 스캐폴드 생성
- 신규 앱 루트 생성:
  - `Web-Audio-Mastering/mastermind`
- React + TypeScript + Vite 보일러플레이트 구성
- 기본 폴더 구조 생성:
  - `src/features/*`
  - `src/shared/*`
  - `src/styles/*`

### C. 원클릭 실행 도구
- 프로젝트 루트에 원클릭 배치 파일 생성:
  - `run-mastermind.bat`
- 동작:
  - `mastermind` 폴더로 이동
  - 필요 시 `npm install`
  - 브라우저 `http://localhost:5173` 오픈
  - `npm run dev` 실행

### D. UI 골격 구현
- 와이어프레임 톤의 3패널 레이아웃 구현
- Light / Dark / System 테마 전환 연결
- 커스텀 공통 UI 컴포넌트 구현:
  - `src/shared/ui/Dropdown.tsx`
  - `src/shared/ui/ScrollArea.tsx`

### E. 큐 기능 1차 구현 (핵심)
- 전역 큐 상태 관리 컨텍스트 추가:
  - `src/features/queue/QueueProvider.tsx`
- 다중 WAV 업로드(입력 필터 포함)
- 큐 상태값 관리:
  - `idle`, `queued`, `processing`, `done`, `error`
- 곡 선택/전체 선택/해제
- 선택 처리/전체 처리 액션
- 곡 제거/큐 비우기
- 진행률 표시(완료 수 기반)
- 상태 필터 드롭다운

주의:
- 현재 “마스터링 처리”는 실제 DSP 렌더가 아니라 상태 전이 시뮬레이션이다.
- 다음 단계에서 실제 DSP 워커와 접합 필요.

### F. A/B 모니터 연결
- 활성 트랙 개념 추가(Queue에서 선택)
- A/B(Original/Mastered) 모드 전환 버튼 연결
- HTMLAudioElement 기반 재생/정지/타임 업데이트 연결
- waveform 클릭 seek 동작(placeholder 영역 기준) 연결
- 큐에서 `done` 상태 트랙 목록을 A/B Ready 리스트로 표시

### G. 설정 패널 연결
- Mastering Controls 패널에 큐 요약값 연결:
  - Total / Selected / Done
- 파라미터 그룹 구조 유지:
  - Loudness & Safety
  - Tone Character
  - Stereo & Space
  - Dynamics
  - Output Format(하단)

---

## 7. 현재 코드 구조 (v0.2 기준)

### 7.1 주요 파일
- 앱 진입:
  - `Web-Audio-Mastering/mastermind/src/main.tsx`
  - `Web-Audio-Mastering/mastermind/src/App.tsx`
- 큐:
  - `Web-Audio-Mastering/mastermind/src/features/queue/QueueProvider.tsx`
  - `Web-Audio-Mastering/mastermind/src/features/queue/QueuePanel.tsx`
- A/B:
  - `Web-Audio-Mastering/mastermind/src/features/player/ABPlayerPanel.tsx`
- 마스터링 패널:
  - `Web-Audio-Mastering/mastermind/src/features/mastering/MasteringPanel.tsx`
- 공통 UI:
  - `Web-Audio-Mastering/mastermind/src/shared/ui/Dropdown.tsx`
  - `Web-Audio-Mastering/mastermind/src/shared/ui/ScrollArea.tsx`
- 스타일:
  - `Web-Audio-Mastering/mastermind/src/styles/global.css`
- 원클릭 실행:
  - `run-mastermind.bat`

### 7.2 타입
- `Web-Audio-Mastering/mastermind/src/shared/types/audio.ts`에 Track 모델 확장:
  - 파일 핸들 정보, 선택 상태, URL, LUFS, 상태, 에러 메시지 등 포함

---

## 8. 현재 동작 시나리오
1. 사용자가 WAV 여러 개 업로드
2. 큐 목록에 트랙 생성 및 기본 선택
3. `Process Selected` 또는 `Process All` 실행
4. 상태가 `queued -> processing -> done`으로 전이
5. 완료된 트랙은 A/B Ready 목록에 표시
6. 중앙 패널에서 A/B 전환 및 seek 가능

---

## 9. 사운드/파라미터 정책 (유지 + 보강)

### 9.1 기본 프로파일
- 기본 프리셋: `JRPG Transparent Warm`
- 기본값:
  - Target LUFS: `-14`
  - True Peak Ceiling: `-1.0 dBTP`
  - Stereo Width: `105%`

### 9.2 노출 파라미터 그룹
- Loudness and Safety
- Tone Character
- Stereo and Space
- Dynamics
- Output Format(우선순위 낮아 하단 배치)

### 9.3 내부 숨김 파라미터
- limiter lookahead/release 세부값
- multiband crossover
- soft clip knee/drive 세부 토글

---

## 10. 검증 결과 및 알려진 이슈

### 10.1 성공
- `npx tsc -b` 기준 타입 체크 통과
- 개발 서버 실행/화면 확인 가능

### 10.2 이슈
- `npm run build`가 현재 환경(Node `v24.12.0`)에서 Vite build 단계 transform 이후 비정상 종료됨
  - 출력 산출물(`dist`)은 생성되지만 프로세스 종료 코드가 정상적이지 않음
  - 실제 프로젝트 안정 빌드는 Node 20 LTS 기준으로 재확인 필요

---

## 11. 다음 단계 (v0.3 목표)
1. 실제 DSP 접합
   - 기존 `web/lib/dsp`, `web/workers` 재사용/개조
   - 시뮬레이션 처리 제거
2. 실제 waveform 렌더
   - `wavesurfer.js` 연동
   - 원본/마스터 파형 동기 seek
3. 메타 분석
   - 실제 LUFS/true peak 측정 반영
4. 결과 파일 출력
   - 브라우저 환경에 맞는 저장 플로우(개별/일괄)
5. 빌드 환경 안정화
   - Node 버전 고정 및 CI 기준 정리

---

## 12. 인수인계 체크리스트 (v0.2)
- [x] 단일 Advanced UI 정책 확정
- [x] 구조화된 3패널 와이어프레임 구현
- [x] 커스텀 스크롤/드롭다운 컴포넌트 도입
- [x] WAV 다중 업로드 + 큐 상태관리 1차 구현
- [x] A/B 모니터와 큐 연동
- [ ] 실제 DSP 렌더 접합
- [ ] 실제 waveform 렌더링 접합
- [ ] 빌드 파이프라인 안정화(Node 20 LTS 기준 재검증)

---

## 13. v0.2 완료 정의 (DoD)
- 기능 시연 가능한 UI 골격이 준비되어 있고,
- 큐 업로드/선택/상태전이/A-B 상호작용이 동작하며,
- 다음 단계의 핵심 과제(DSP/파형/출력/빌드안정화)가 명확히 정의되어 있으면 v0.2 완료로 본다.
