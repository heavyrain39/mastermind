# 마스터마인드 (Mastermind) v1.1 기획서 / 인수인계 문서

## 1. 문서 목적
- 본 문서는 `Mastermind` v1.1 기준의 현재 상태, 2026-03-08 핫픽스 이슈, 원인 분석, 수정 내역, 재발 방지 가이드를 기록하는 인수인계 문서입니다.
- 기존 `docs/MASTERMIND_v1.0_기획서.md`는 출시 시점 기록으로 유지하고, 본 문서는 그 이후 실제 운영 중 발견된 품질 이슈와 대응 내용을 추가로 남기는 목적을 가집니다.

---

## 2. 버전 히스토리 요약
- **`v0.7`**: DSP 오디오 코어 안정화, 출력 설정 UI 도입.
- **`v0.8`**: MP3 인코더 워커 분리, `None` 프리셋 도입, 진행률 UI 통합.
- **`v0.9`**: 배치 처리 병렬화, ZIP 생성 워커 도입.
- **`v0.9.5`**: 메타데이터 보존, DSP 엔진 `src/lib/dsp` 통합, i18n 적용.
- **`v1.0`**: 웹앱과 Chrome Extension 이중 빌드/배포 체계 확립, Chrome Web Store 등록.
- **`v1.1` (2026-03-08)**: 마스터링 결과물에서 발생하던 고역 잡음/아티팩트 문제를 공통 export 체인 기준으로 수정. `None` 및 전체 프리셋의 끝단 true-peak 처리 구조를 재정비.

---

## 3. 운영 중 발견된 핵심 이슈

### A. 증상
- Suno 원본 음원을 마스터링하면 원본에 없던 잡음이 새로 생김.
- 특히 고음역 부근에서 거칠고 얇은 노이즈성 성분이 들림.
- `None` 프리셋을 선택하고 사실상 볼륨만 조정하는 경우에도 같은 문제가 발생함.
- 사용 환경상 웹앱(Vercel 배포본) 사용자가 많기 때문에 문제 영향 범위는 웹과 익스텐션 전체로 판단해야 했음.

### B. 실제 영향 범위
- 문제는 특정 프리셋 하나의 튜닝 문제가 아니라, **공통 export 마무리 단계**의 구조 문제였음.
- 따라서 `None`만이 아니라 `Transparent`, `Warm Tape`, `Crystal Air`, `Punch Glue`, `Wide Cinema`, `Loud & Clear` 전부에서 재현 가능성이 있었음.
- 귀에 잘 들리는 정도는 소스와 프리셋에 따라 달랐지만, 구조적으로는 전체 프리셋 공통 리스크였음.

### C. 사용자 관점에서 위험했던 이유
- `None`은 사용자가 "원본 질감을 유지하면서 볼륨만 정리한다"라고 기대하는 프리셋임.
- 그런데 실제 구현은 완전 바이패스가 아니었고, 사용자는 의도하지 않은 비선형 처리까지 함께 거치고 있었음.
- 이미 배포 및 홍보가 진행된 상태였기 때문에, 문제를 늦게 발견할수록 신뢰도 하락 위험이 컸음.

---

## 4. 원인 분석

### A. 1차 원인: 공통 끝단 소프트클리퍼 + 리미터 조합
- 문제의 가장 큰 원인은 `src/lib/dsp/worker.js` export 체인의 마지막 구간이었음.
- 모든 프리셋이 export 시점에 다음 순서를 공통으로 통과하고 있었음.
  - Loudness normalize
  - `applyMasteringSoftClip(...)`
  - 최종 true peak limiter
- 이 구조는 두 번 연속 비선형 peak 처리 블록을 거치는 셈이어서, 원본에 없던 고역 하모닉/거친 결을 만들 가능성이 높았음.
- 특히 Suno 계열 소스처럼 이미 상단 대역이 복잡한 음원에서는 이 부작용이 더 잘 드러났음.

### B. 2차 원인: `None` 프리셋이 실제로는 완전 투명 경로가 아니었음
- `None`을 선택해도 export 체인의 공통 끝단 소프트클리퍼/리미터를 그대로 통과했음.
- 즉 `None`은 UI 라벨상 "아무 것도 안 하는 프리셋"처럼 보였지만, 실제 구현은 "톤 관련 모듈만 일부 꺼진 상태"였음.
- 이 때문에 사용자는 볼륨만 조정한다고 생각했는데도 비선형 처리에 의한 아티팩트를 겪을 수 있었음.

### C. 3차 원인: 프리셋 상태와 저장된 설정의 불일치 가능성
- `selectedPresetId`와 실제 `masteringSettings`가 localStorage 복원 과정에서 어긋날 수 있었음.
- 예를 들어 UI상 `None`으로 보여도, 내부 설정은 예전 `custom` 값이 남아 있을 수 있었음.
- 이 문제는 loudness normalize on/off 같은 핵심 동작을 혼란스럽게 만들었고, 재현성 판단을 어렵게 했음.

### D. 주의: 프리셋별 개별 DSP 리스크는 아직 존재
- 이번 핫픽스의 주원인은 공통 끝단이었지만, 프리셋별 모듈 자체도 잠재 리스크는 있음.
- 예시:
  - `air` 계열: `exciter.js`는 고역 생성 계열이라 과하면 상단 거칠음 유발 가능.
  - `warmth` 계열: `multiband-saturation.js`는 밴드별 `tanh` 포화 기반이라 소스에 따라 aliasing성 질감 가능.
  - `clarity` 계열: `dynamic-processor.js`는 FFT 재합성 블록이라 민감한 소스에서 잔결/스미어 가능.
- 다만 이번 사건의 직접 원인은 이 개별 모듈보다 **공통 끝단 처리**가 훨씬 유력했고, 실제 청감상 개선 효과도 가장 컸음.

---

## 5. v1.1 수정 내역

### A. 공통 export 끝단에서 소프트클리퍼 제거
- `src/lib/dsp/worker.js`에서 export 마무리 단계의 `applyMasteringSoftClip(...)`를 제거함.
- 전 프리셋 공통으로 더 단순하고 보수적인 true-peak limiter 하나만 사용하도록 변경함.
- 이번 릴리스의 핵심 수정은 여기에 있음.

### B. `None` 및 사실상 gain-only 설정 전용의 투명 경로 추가
- 톤/스테레오/압축 관련 모듈이 모두 꺼진 경우, 별도 투명 경로를 타도록 분기함.
- 이 경로에서는:
  - LUFS 보정은 유지
  - 필요 시 true-peak ceiling 보호는 유지
  - 불필요한 캐릭터성 비선형 블록은 우회
- 결과적으로 `None` 또는 볼륨 위주 설정에서 원본 질감을 해치지 않는 방향으로 동작하게 됨.

### C. 더 단순한 true-peak limiter로 교체
- `applyTransparentLimiterToChannels(...)`를 추가하여, 공통 끝단과 gain-only 경로에서 동일한 보수적 리미터를 사용하도록 정리함.
- 기존 구조처럼 soft-knee saturation 성격이 강한 세이프티 단계가 아니라, linked gain envelope 기반의 true-peak 제어를 우선함.

### D. 프리셋 상태와 저장된 설정 동기화 로직 추가
- 앱 초기 로드 시 `selectedPresetId`와 `masteringSettings`를 동기화하는 보정 로직을 추가함.
- `None`이 화면에 보이는데 실제로는 예전 custom 값이 적용되는 식의 상태 꼬임을 줄였음.

### E. worker에 프리셋 ID 전달 보강
- `selectedPresetId`를 worker 설정으로 명시적으로 전달하도록 정리함.
- 이는 추후 preset-specific 분기나 디버깅 시에도 중요함.

### F. 확장 프로그램 버전 갱신
- Chrome Extension manifest 버전을 `0.8.4`로 상향.
- 심사용 패키지 파일명도 `mstrmnd-ext-v0.8.4.zip`으로 생성.

---

## 6. 실제 수정 파일
- `src/lib/dsp/worker.js`
  - 공통 export 끝단 소프트클리퍼 제거
  - 투명 true-peak limiter 추가
  - gain-only 전용 경로 추가
- `src/features/queue/QueueProvider.tsx`
  - persisted preset / settings 동기화 로직 추가
  - selected preset을 worker에 전달하도록 보완
- `src/lib/dsp/dspWorkerClient.ts`
  - worker settings에 `presetId` 추가
- `src/extension/manifest.json`
  - extension version `0.8.4`
- `package.json`
  - extension zip 파일명 `0.8.4` 반영

---

## 7. 검증 결과

### A. 개발 검증
- `npx tsc --noEmit` 통과.
- `npm run build:ext` 통과.
- 주의: 현재 로컬 시스템 Node 버전이 `v24.12.0`인 경우 plain `vite build`가 불안정할 수 있으므로, production-like 검증은 `npm run build:ext` 기준으로 보는 것이 맞음.

### B. 청감 검증
- 수정 직후 `None`에서 고역 잡음이 사실상 사라진 것을 확인.
- `Warm Tape` 프리셋에서도 이전처럼 귀에 걸리는 잡음이 들리지 않는 수준까지 개선됨.
- `-14 LUFS`를 절대 정확도보다 품질 우선으로 맞추되, 결과값은 실사용 기준 충분히 근접한 수준으로 수렴함.

### C. 현재 해석
- 이번 문제의 주범은 개별 프리셋 모듈보다 공통 끝단 소프트클리퍼/리미터 조합이었을 가능성이 매우 높음.
- 다만 장기적으로는 개별 프리셋 모듈도 샘플별 청감 검증이 필요함.

---

## 8. 다음 작업자 LLM을 위한 명시적 가이드

### A. "잡음이 생긴다"는 리포트를 받으면 가장 먼저 볼 곳
1. `src/lib/dsp/worker.js`의 export 공통 끝단
2. `None` 또는 gain-only 설정이 정말 비선형 블록을 우회하는지
3. loudness normalize 이후에 몇 번의 비선형 처리 블록이 직렬로 연결되는지

### B. 절대 금지에 가까운 변경 방향
- `None` 프리셋에 캐릭터성 소프트클리퍼를 다시 기본으로 넣는 것
- loudness target을 맞추겠다는 이유로 비선형 블록을 연달아 두 개 이상 직렬 삽입하는 것
- UI 프리셋 상태와 localStorage 복원 상태를 따로 놀게 두는 것

### C. 권장 검증 방식
- 하나의 테스트 소스만 듣지 말고 다음 조합으로 확인할 것
  - `None`
  - `Transparent`
  - `Warm Tape`
  - 고역이 많은 Suno 계열 소스
  - 보컬 중심 소스
- WAV와 MP3를 모두 들어볼 것
- "LUFS 숫자"보다 먼저 "청감상 새 잡음이 생겼는지"를 판단할 것

### D. 향후 품질 개선 우선순위
1. `exciter.js`와 `multiband-saturation.js`의 상단 대역 aliasing 리스크 점검
2. `dynamic-processor.js` FFT 재합성의 스미어/잔결 여부 점검
3. 프리셋별 회귀 테스트용 고정 샘플 세트 확보
4. 가능하면 "transparent mode"에 대한 간단한 null-test 또는 peak/LUFS 자동 비교 도구 도입

---

## 9. 개발 환경 특이사항 (v1.0 문서에서 이어받음)

### A. PowerShell 명령 구문
- 현재 개발 환경은 Windows PowerShell 기준.
- `&&` 대신 세미콜론(`;`) 또는 별도 명령 실행을 사용해야 할 수 있음.

### B. Node / Vite 빌드 주의
- Node `v24.12.0` 이상 환경에서 plain `vite build`가 불안정할 수 있음.
- 로컬 검증은 `npm run build:ext`를 우선 사용.
- 해당 스크립트는 프로젝트에 포함된 `node-v20.18.0-win-x64`를 사용하여 안전하게 extension build + zip까지 수행함.

---

## 10. 현재 상태 요약
- 웹앱과 익스텐션 모두 공통 export 끝단 잡음 문제는 우선 해결된 상태.
- v1.1의 핵심은 "정확히 더 크게"보다 "원본에 없던 고역 노이즈를 만들지 않게" 쪽에 우선순위를 둔 것.
- 현재 상태는 실사용 배포 기준으로 충분히 안전하며, 이후 작업은 개별 프리셋 모듈의 미세 품질 개선 영역으로 넘어감.

---

**v1.1 요약:** "공통 export 끝단의 과도한 비선형 마무리 체인을 정리하여, `None`을 포함한 전체 프리셋에서 고역 잡음 리스크를 실사용 가능한 수준으로 낮춘 안정화 릴리스."
