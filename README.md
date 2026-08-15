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

> ⚠️ **Node v24+에서 `vite build`가 크래시될 수 있습니다.** 로컬 타입 검증은 `tsc -b`로, 프로덕션 빌드는 Node 20 LTS 환경(Vercel 등)을 권장합니다.

## 현재 버전: v1.2.0

- 배치 처리 병렬 워커 풀 (최대 4코어 동시 마스터링)
- ZIP 압축 Web Worker 분리 (메인 스레드 블로킹 해소)
- 음원 메타데이터 보존 파이프라인 (WAV RIFF INFO + MP3 ID3v2.3)
- DSP 엔진 `src/lib/dsp` 통합 완료, 외부 의존성 제거

### v1.0 예정 과제

- 배치 결과 리포트 UI (LUFS 변동폭, 피크 값, 소요 시간 요약)

## 디자인 언어

이 웹앱의 UI 디자인 시스템은 **야차완 브랜드 디자인 언어**로서 다른 프로젝트에도 범용 적용 가능하도록 별도 문서화되어 있습니다.

→ [`docs/MASTERMIND_DESIGN_RECIPE.md`](docs/MASTERMIND_DESIGN_RECIPE.md)

## 문서

- [v0.9 기획/현황서](docs/MASTERMIND_v0.9_기획서.md) — 최신 기술 상세
- [v0.1~v0.8 기획서](docs/) — 버전별 히스토리

---

*Made by [Yakshawan](https://heavyrain39.github.io/portfolio/)*
