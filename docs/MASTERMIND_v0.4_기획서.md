# 마스터마인드 (Mastermind) v0.4 기획/현황서

## 1. 문서 목적
- 본 문서는 `마스터마인드`의 `v0.4` 업데이트 내용을 `기획 의도 + 실제 구현 상태 + 다음 작업 인수인계` 기준으로 정리한다.
- `v0.3` 문서는 보존하고, 본 문서에서 `v0.4` 변경점과 남은 과제를 독립적으로 파악할 수 있게 작성한다.

---

## 2. 버전 히스토리
- `v0.1`
  - 제품 정의, 톤 방향, 배치 마스터링 범위 정의
- `v0.2`
  - React/TS/Vite 3패널 UI 골격
  - Queue/A-B 연동 1차 구현(시뮬레이션 처리)
- `v0.3` (2026-02-20)
  - 실제 DSP 워커 연동
  - 처리 진행률/다운로드/에러 처리 보강
  - 모노 입력/툴팁/UI 안정성 버그 보수
- `v0.4` (2026-02-20)
  - 사용자 피드백 기반 UI 구조 재설계(좌/중/우 패널 정보 밀도 재편)
  - A/B 웨이브폼 실 렌더(canvas) 및 즉시 전환 재생 UX 구현
  - 프리셋 드롭다운 구조화 + 로컬 저장 복원
  - 완료 트랙 ZIP 일괄 다운로드 추가

---

## 3. v0.4 한줄 요약
`실사용 관점의 마스터링 작업 흐름(업로드 -> 선택 -> 처리 -> A/B 확인 -> 개별/일괄 다운로드) 중심으로 UI를 정리하고, 웨이브폼 기반 A/B 모니터링을 실동작 수준으로 끌어올린 버전`

---

## 4. 이번 작업 상세 (2026-02-20)

### A. 좌측 Queue 패널 단순화
- 기존:
  - `Process Selected` + `Process All` 중복
  - `Status Filter` 및 상세 메타(Orig/Out LUFS, 용량, complete 텍스트) 과다 노출
- 변경:
  - 상단 액션을 `Upload`, `Process` 2개로 단순화
  - `Process`는 선택 체크된 트랙만 처리
  - 상태 필터/좌측 다운로드/상세 메타 제거
  - 목록 헤더에 마스터 체크박스 추가(전체 선택/해제, 부분선택 indeterminate)
  - 행 우측에 삭제 버튼을 휴지통 아이콘으로 교체(`react-icons/fi`)
  - 처리 중인 트랙은 행 하단 진행 게이지만 표시

### B. 중앙 A/B 모니터 구조 변경
- 기존:
  - 공용 Play/Stop + A/B 모드 버튼
  - 각 파형은 placeholder 수준
  - Ready List에 `Open A/B` 버튼 중심
- 변경:
  - `Original`과 `Mastered` 각각 독립 `Play/Pause`, `Stop` 버튼 배치
  - 한쪽 재생 시 반대쪽 자동 일시정지
  - 웨이브폼 클릭 시 해당 위치 seek 유지
  - 추가로 웨이브폼 클릭 시 즉시 해당 소스 재생(교차 전환 포함):
    - 예: A 재생 중 B 파형 클릭 -> A 일시정지 + B 클릭 지점 즉시 재생
  - Ready List는 행 클릭으로 바로 A/B 대상 선택, 선택 행 강조 스타일 적용
  - 각 행에 개별 다운로드 아이콘 추가
  - 리스트 헤더 우측 `Download All` 버튼 추가(완료 트랙 ZIP)

### C. 웨이브폼 실 렌더 구현
- 파형 렌더링을 placeholder에서 canvas 기반으로 교체
- 소스 URL fetch -> AudioBuffer decode -> peak 추출 -> canvas 드로잉
- 재생 위치(progress) 오버레이를 파형 위에 표시
- 리사이즈 시 재그리기 처리

### D. 우측 Mastering Controls 압축
- 기존:
  - 상단 `Total / Selected / Done` 요약 표시
  - 슬라이더 라벨이 위쪽 배치되어 세로 공간 과점유
  - Output Format 3개가 세로 배치
- 변경:
  - 상단 요약 제거
  - 슬라이더/토글을 라벨 좌측 + 컨트롤 우측의 한 행 구조로 재배치
  - Output Format(`Sample Rate`, `Bit Depth`, `Dither`)를 한 행 3열로 압축

### E. 프리셋 구조 개편
- 기존 텍스트형 프리셋 표시(`JRPG Transparent Warm`) 제거
- 드롭다운 프리셋 도입:
  - `Transparent`(기본)
  - `Velvet Lift`
  - `Crystal Air`
  - `Punch Glue`
  - `Wide Cinema`
  - `Broadcast Calm`
  - `Custom (Reset)`
- `Custom (Reset)` 선택 시 기본 프리셋(`Transparent`) 값으로 즉시 복귀
- 프리셋 정의 파일 분리:
  - `src/features/mastering/presets.ts`

### F. 로컬 저장(재접속 복원)
- 마스터링 설정값과 선택 프리셋을 `localStorage`에 저장/복원
- 저장 키:
  - `mastermind.mastering.settings.v1`
  - `mastermind.mastering.preset.v1`
- 비정상 값은 범위 검증 후 안전한 기본값으로 sanitize

### G. 다운로드 플로우 보강
- 완료 트랙 일괄 다운로드를 기존 “순차 개별 다운로드”에서 ZIP 방식으로 전환
- `JSZip` 사용, 파일명은 개별 mastered 파일명 유지
- ZIP 파일명에 타임스탬프 포함:
  - `mastermind-mastered-<ISO-timestamp>.zip`

### H. 레이아웃/스크롤 구조 재정리
- `Made by. Yakshawan` 푸터를 얇은 하단 행으로 유지하되 메인과 충돌하지 않게 재배치
- 전체 화면을 `header / main / footer` 그리드로 고정
- 메인 패널 영역은 화면 내 고정, 각 패널 내부에 스크롤 할당
- 모바일 구간에서는 세로 스택 + 전체 스크롤 허용으로 전환

---

## 5. 현재 사용자 시나리오 (v0.4 기준)
1. 좌측 `Upload` 또는 드래그 앤 드롭으로 다중 WAV 업로드
2. 기본 전체 선택 상태에서 필요한 트랙만 체크 해제
3. `Process` 실행(체크된 트랙만 처리)
4. 좌측 목록에서 트랙별 진행 게이지 확인
5. 중앙 A/B에서 원본/마스터 파형 클릭으로 즉시 비교 재생
6. 완료 트랙 목록에서 행 선택 시 즉시 A/B 대상 전환
7. 개별 다운로드 아이콘 또는 `Download All`(ZIP)로 결과 저장
8. 우측에서 프리셋/세부 파라미터 조정, 재접속 시 설정 복원

---

## 6. 기술 변경 포인트

### 6.1 상태/컨텍스트
- `QueueProvider` 확장:
  - 프리셋 선택 상태(`selectedPresetId`)
  - 프리셋 적용 함수(`setMasteringPreset`)
  - ZIP 다운로드(`downloadDoneTracksZip`)
  - 설정/프리셋 로컬 저장 및 sanitize
- `processAllTracks` 경로는 UI에서 제거되고, 실사용은 선택 처리 중심으로 통일

### 6.2 의존성 추가
- `react-icons` (휴지통/재생/일시정지/정지/다운로드 아이콘)
- `jszip` (완료 트랙 ZIP 생성)

### 6.3 UI 구조
- Queue/AB/Mastering 3패널 모두 DOM 구조와 CSS grid/scroll 배치 조정
- `global.css`를 v0.4 레이아웃 기준으로 재작성

---

## 7. 파일 변경 내역 (핵심)
- 신규:
  - `Web-Audio-Mastering/mastermind/src/features/mastering/presets.ts`
  - `Web-Audio-Mastering/docs/MASTERMIND_v0.4_기획서.md`
- 주요 수정:
  - `Web-Audio-Mastering/mastermind/src/features/queue/QueueProvider.tsx`
  - `Web-Audio-Mastering/mastermind/src/features/queue/QueuePanel.tsx`
  - `Web-Audio-Mastering/mastermind/src/features/player/ABPlayerPanel.tsx`
  - `Web-Audio-Mastering/mastermind/src/features/mastering/MasteringPanel.tsx`
  - `Web-Audio-Mastering/mastermind/src/styles/global.css`
  - `Web-Audio-Mastering/mastermind/package.json`
  - `Web-Audio-Mastering/mastermind/package-lock.json`

---

## 8. 검증 결과
- 타입 체크:
  - `npx tsc -b` 통과
- 빌드:
  - `npm run build`는 v0.3에서 보고된 것과 동일하게 Vite transform 이후 비정상 종료 케이스 재현
  - 기능 구현 자체는 개발 서버 기준 확인 가능한 상태

---

## 9. 알려진 이슈 / 리스크
1. 빌드 종료코드 이슈
- Node 24 계열 환경에서 `vite build` 종료코드 불안정 현상 지속
- Node 20 LTS 기준 재검증 필요

2. 웨이브폼 렌더 성능
- 현재는 소스 fetch/decode 후 캔버스 드로잉 방식
- 대용량/다수 트랙에서 decode 비용 증가 가능
- 추후 캐시 전략 또는 워커 분리 고려 필요

3. 프리셋 값 다양화 미완
- 드롭다운 구조는 준비했지만, 프리셋별 파라미터 차등값은 아직 동일 베이스
- 사운드 디자인 단계에서 프리셋별 수치 튜닝 필요

---

## 10. 다음 작업자 인수인계 체크리스트
- [x] Queue 액션 단순화(Upload/Process)
- [x] 마스터 체크박스(전체 선택/해제) 동작
- [x] 중앙 A/B 파형 클릭 즉시 재생 + 교차 전환 정지
- [x] 완료 리스트 행 선택형 UX + 개별/ZIP 다운로드
- [x] Mastering 패널 압축 레이아웃
- [x] 프리셋 드롭다운 + 로컬 저장
- [ ] 프리셋별 실제 사운드 파라미터 차등 설계
- [ ] Node 20 LTS 기준 빌드 안정화
- [ ] 웨이브폼 렌더 최적화/캐시 정책 정리

---

## 11. v0.4 완료 정의 (DoD)
- 사용자 피드백으로 제기된 핵심 UI 구조 문제가 해결되고,
- A/B 모니터가 파형 클릭 기반 즉시 비교 재생까지 지원하며,
- 다운로드 플로우(개별/일괄 ZIP)와 설정 지속성(localStorage)이 동작하고,
- 다음 작업자가 문서만으로 `현재 구현 상태/남은 과제/리스크`를 분명히 파악할 수 있으면 v0.4 완료로 본다.

