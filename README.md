# 🎛️ MSTRMND (마스터마인드)

**웹 기반 배치 오디오 마스터링 도구**

브라우저에서 동작하는 로컬 오디오 마스터링 웹앱입니다. 최대 50곡의 트랙을 동시에 일괄 마스터링하며, 모든 처리는 사용자의 브라우저 안에서 완결됩니다 — 서버 업로드 없음, 외부 의존성 없음.

---

## 주요 기능

- **배치 마스터링**: 드래그 앤 드롭으로 최대 50곡 일괄 처리 (WAV, MP3, M4A, OGG, FLAC 입력 지원)
- **프리셋 시스템**: Transparent / Warm Tape / Crystal Air / Punch Glue / Wide Cinema / Loud & Clear 6종
- **상세 제어**: Target LUFS, True Peak Ceiling, Warmth, Clarity, Air, Stereo Width, Glue Compression 등 개별 파라미터 조정
- **A/B 모니터**: 마스터링 전/후 파형을 나란히 비교
- **출력 포맷**: WAV (24/16-bit, 48/44.1kHz, TPDF/Noise-shaped 디더) + MP3 (128~320kbps)
- **메타데이터 보존**: 마스터링 후에도 원본의 곡 정보(제목, 아티스트, 앨범 아트 등)를 보존
- **테마**: Light / Dark / System 3모드 즉시 전환
- **다국어**: 브라우저 언어 기반 한국어/영어 자동 분기

## 기술 스택

| 영역 | 기술 |
|---|---|
| 프레임워크 | React 18 + TypeScript + Vite |
| DSP 엔진 | Web Audio API + 커스텀 DSP 파이프라인 (Web Worker 병렬 풀) |
| 인코딩 | lamejs (MP3, Web Worker), 커스텀 WAV 인코더 |
| 압축 | jszip (Web Worker 분리, 실시간 진행률 보고) |
| 메타데이터 | music-metadata-browser (추출), 커스텀 ID3v2.3/RIFF 태거 (주입) |
| UI | Vanilla CSS (커스텀 디자인 시스템), react-icons |

## 프로젝트 구조

```
src/
├── App.tsx                      # 루트 셸 (헤더 + 3패널 레이아웃)
├── features/
│   ├── queue/                   # 배치 대기열 (업로드, 파일 관리, 마스터링 실행)
│   ├── player/                  # A/B 비교 플레이어 (파형 시각화)
│   └── mastering/               # 마스터링 컨트롤 패널 + 비주얼라이저
├── lib/
│   ├── audio/                   # WAV/MP3 인코딩, ZIP 압축, 메타데이터 태깅
│   └── dsp/                     # DSP 엔진 코어 (워커 클라이언트 + 워커 풀)
├── shared/
│   ├── i18n/                    # 다국어 (ko/en)
│   ├── theme/                   # 테마 모드 훅
│   ├── types/                   # 공유 타입 정의
│   └── ui/                      # 공통 UI 컴포넌트 (Dropdown, ScrollArea, Tooltip)
└── styles/
    └── global.css               # 전체 디자인 시스템 (색상, 타이포, 레이아웃)
```

## 로컬 실행

```bash
npm install
npm run dev
```

## 빌드

```bash
npm run build     # tsc -b && vite build
npm run preview   # 빌드 결과 미리보기
```

> Node.js 24 LTS를 지원합니다. Vercel 빌드는 `package.json`의 `engines.node`에 따라 최신 24.x를 사용하며, 로컬·확장 프로그램 빌드는 Node 24.19.0에서 검증했습니다.

## 현재 버전: v0.9.5

- Auto Balance 추가: 곡의 장기 음색 밸런스를 측정해 저역·중저역·프레즌스·고역을 실제 곡 20개의 중앙값 기준 쪽으로 일부(최대 ±1.5~2dB)만 보정
- Transparent 프리셋이 Auto Balance를 써서 None과 구분되는 범용 다듬기 모드가 됨(기준 밸런스와의 편차 16~22% 감소)

### v0.9.4

- Clarity(De-harsh): 엔벌로프가 512배 느리고 레벨 기준이 dBFS가 아니라 상시 고정 EQ처럼 동작하던 문제 수정, 곡 음량에 맞춰 같은 강도로 동작
- Air: 익사이터가 컷오프 부근에서 원음과 상쇄돼 거의 효과가 없던 문제 수정(10kHz 셸프 + 배음 전용 익사이터)
- Warmth: 대역 분할 위상 회전으로 피크가 커지던 문제 수정, 저역 보강·고역 완화 셸프 추가
- Glue: 사이드체인 100Hz 하이패스로 베이스 펌핑 제거
- 6개 프리셋을 실제 곡 8곡 측정값 기준으로 재조정해 프리셋 간 차이를 명확하게 함

### v0.9.3

- 최종 정리용 18kHz 로우패스를 버터워스 바이쿼드로 교체해 모든 프리셋의 고역이 2~3dB 깎이던 문제 수정
- 트랜지언트 강화(오토 레벨 55 이상)가 200Hz·4kHz 크로스오버에서 최대 약 6dB 노치를 만들던 문제 수정

### v0.9.2

- 피크 경계 검사, 작업 취소·오류 처리 및 워커 배분 안정화
- WAV 다운로드 재사용, 출력 변환 통합 및 불필요한 메모리 복사 정리
- [수정 및 검증 기록](docs/CODE_REVIEW_FIXES_2026-09-09.md)

- 배치 처리 병렬 워커 풀 (최대 4코어 동시 마스터링)
- ZIP 압축 Web Worker 분리 (메인 스레드 블로킹 해소)
- 음원 메타데이터 보존 파이프라인 (WAV RIFF INFO + MP3 ID3v2.3)
- DSP 엔진 `src/lib/dsp` 통합 완료, 외부 의존성 제거

### v1.0 예정 과제

- 배치 결과 리포트 UI (LUFS 변동폭, 피크 값, 소요 시간 요약)

---

*Made by [Yakshawan](https://heavyrain39.github.io/portfolio/)*
