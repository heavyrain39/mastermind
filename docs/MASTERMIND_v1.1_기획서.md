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
- **`v1.1` 후속 품질 보정 (2026-03-08)**: 프리셋 슬라이더 수치가 실제 DSP 강도로 연결되지 않던 구조를 정리하고, `spaceDepth`를 실제 stereo depth 처리로 연결. 프리셋 이름과 체인 동작의 정합성을 높이기 위해 일부 프리셋 값을 보수적으로 재조정.

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

### G. 프리셋 슬라이더와 실제 DSP 강도 간 불일치 해소
- 핫픽스 이후 프리셋을 다시 점검하는 과정에서, UI상 `warmth`, `clarity`, `air`, `lowEndClean`, `glueCompression`, `autoLevelStrength`, `spaceDepth`가 정교한 연속값처럼 보이지만 실제 worker 체인에서는 상당수가 사실상 `0이면 off / 1 이상이면 on`에 가까운 구조였음을 확인함.
- 예를 들어 `Warm Tape`의 `warmth: 62`와 `Transparent`의 `warmth: 24`는 사용자 관점에서는 꽤 다른 세기처럼 보이지만, 이전 구조에서는 둘 다 "warmth 모듈 켜짐"으로만 해석되어 체감 차이가 기대보다 훨씬 작았음.
- 이 상태는 단순히 UX 문제가 아니라, 프리셋 이름과 실제 결과가 일치하지 않는 문제였음. 즉 "정직한 프리셋 설계"가 성립하지 않았음.
- 따라서 이번 후속 수정의 핵심 목표는:
  - 슬라이더 수치가 실제 DSP 강도로 반영되게 만들 것
  - `spaceDepth`처럼 UI에는 있지만 사실상 죽어 있던 파라미터를 복구할 것
  - 새 매핑 기준에서 과도해질 수 있는 프리셋은 이름에 맞게 다시 눌러둘 것

### H. `spaceDepth`가 중요했지만 실제로는 비어 있었던 원인
- `spaceDepth`는 UI와 preset 테이블에는 존재했지만 worker settings로 전달되지 않았음.
- 결과적으로 `Wide Cinema`처럼 공간 연출이 핵심인 프리셋도 실제 차별점이 대부분 `stereoWidth`와 `monoBassAnchor` 정도에 머물렀음.
- 이는 사용자가 "깊이감" 슬라이더를 움직여도 결과가 거의 바뀌지 않는 상태였고, 프리셋 설계 관점에서는 치명적인 누락이었음.

### I. 이번 후속 수정에서 `spaceDepth`를 어떤 방식으로 구현했는가
- 결론부터 말하면 **리버브를 추가하지 않았음**.
- 이유:
  - 마스터링 단계에서 후단 리버브는 원본의 배음 구조와 잔향을 직접 바꿔버릴 가능성이 큼.
  - 이번 릴리스의 최우선 목표는 "원본에 없던 질감을 만들지 않는 것"이므로, 전면적 공간계 이펙트는 방향성이 맞지 않음.
- 대신 보다 보수적인 **M/S 기반 depth enhancement**를 구현함:
  - side 채널에 짧은 지연(수 ms) 성분을 추가
  - 저역은 depth 성분에서 배제하기 위해 high-pass 적용
  - 상단 대역은 부드럽게 만들기 위해 low-pass 적용
  - depth 값에 따라 side gain을 약간 올리고 mid gain을 소폭 낮춤
- 이 방식은 리버브처럼 새로운 tail을 길게 만드는 것이 아니라, 기존 stereo image에 "뒤로 물러나는 듯한 깊이감"을 보강하는 수준의 보수적 처리임.
- 따라서 `Wide Cinema`나 `Transparent`의 미세한 공간 연출에는 유효하지만, 믹스 성격 자체를 바꾸는 공간계 효과로 이해하면 안 됨.

### J. 슬라이더별 실제 매핑을 어떻게 바꿨는가
- `clarity`
  - 기존: `deharsh on/off`
  - 수정 후: hybrid dynamic processor의 dynamic EQ 민감도, 최대 cut, 전체 dry/wet가 수치에 따라 연속적으로 변함
- `air`
  - 기존: exciter on/off
  - 수정 후: exciter의 HPF 기준점, drive, bias, mix가 수치에 따라 연속적으로 변함
- `warmth`
  - 기존: tape warmth preset on/off
  - 수정 후: multiband saturation의 밴드별 drive / bias / mix가 수치에 따라 연속적으로 변함
- `lowEndClean`
  - 기존: HPF on/off + 고정 mud cut
  - 수정 후: HPF cutoff와 250Hz 부근 mud cut 강도가 수치에 따라 연속적으로 변함
- `glueCompression`
  - 기존: glue compressor on/off
  - 수정 후: threshold, ratio, attack, release, knee와 병렬 blend가 수치에 따라 연속적으로 변함
- `autoLevelStrength`
  - 기존: 실질적으로 `50 이상이면 punch on`, 미만이면 off에 가까움
  - 수정 후: 먼저 실제 dynamic leveling 강도로 연결하고, 높은 구간에서만 transient enhancement를 보조적으로 섞는 구조로 정리
- `spaceDepth`
  - 기존: 미사용
  - 수정 후: stereo depth 처리의 지연/필터/side-mid 보정 강도로 연결

### K. 왜 `autoLevelStrength`를 transient punch와 분리해야 했는가
- 이름이 `Auto-level Strength`인데 실제로는 임계값 기반 punch 스위치처럼 작동하면, 사용자 기대와 결과가 근본적으로 어긋남.
- 특히 `Loud & Clear`처럼 "더 또렷하고 앞으로 나오는" 인상을 기대하는 프리셋도, 예전 구조에서는 `40`과 `49`가 사실상 같은 의미였음.
- 따라서 이번 수정에서는:
  - 기본적으로는 dynamic leveler에 연결
  - 값이 높은 구간에서만 multiband transient를 소량 병렬로 추가
  - 즉 "레벨 정리"가 주 기능이고, "punch 보강"은 고강도 구간의 부가 효과가 되도록 정리함

### L. 프리셋 값 재조정 원칙
- 이번에 매핑이 실제 강도로 살아났기 때문에, 기존 수치를 그대로 두면 일부 프리셋이 과도하게 들릴 가능성이 있었음.
- 그래서 다음 원칙으로 프리셋 값을 보수적으로 손봤음:
  - `Transparent`: 사용자가 의도한 "살짝 따스하고 투명하며, 너무 punchy하지 않고 서정적인" 성격은 유지하되, 새 강도 매핑 기준에서 과도해질 수 있는 `air`, `lowEndClean`, `glue`, `auto-level`을 약간만 낮춤
  - `Warm Tape`: warm 중심 성격을 살리고, clarity / air가 warmth를 덮지 않도록 더 눌러둠
  - `Crystal Air`: warmth / glue는 더 줄이고 air / clarity 중심으로 정리
  - `Punch Glue`: 실제로 punch 성격이 살아나도록 `autoLevelStrength`를 고강도 구간으로 넘기고, 나머지는 과잉을 줄임
  - `Wide Cinema`: 이제 `spaceDepth`가 실제로 동작하므로, 기존 `stereoWidth` / `spaceDepth` 수치를 그대로 두기보다 width는 다소 낮추고 depth 중심으로 재정렬
  - `Loud & Clear`: loudness 인상은 유지하되 warmth / glue / auto-level을 다소 보수화

### M. 이번 수정의 실제 파일 단위 작업
- `src/features/queue/QueueProvider.tsx`
  - worker로 보내는 settings에 `clarityAmount`, `airAmount`, `warmthAmount`, `lowEndCleanAmount`, `glueCompressionAmount`, `autoLevelAmount`, `spaceDepthAmount`를 추가
- `src/lib/dsp/dspWorkerClient.ts`
  - 위 수치형 worker settings 타입 정의 추가
- `src/lib/dsp/worker.js`
  - 수치 정규화 및 dry/wet 혼합 유틸 추가
  - clarity / air / warmth / auto-level / glue / low-end clean의 연속 강도 매핑 구현
  - `spaceDepth`용 stereo depth enhancement 추가
  - linear-only 판정도 새 수치형 파라미터 기준으로 재정의
- `src/features/mastering/presets.ts`
  - 새 매핑 기준에서 일부 프리셋 값 재조정

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
- `src/features/queue/QueueProvider.tsx`
  - 프리셋 슬라이더 수치를 worker에 연속값으로 전달하도록 확장
- `src/lib/dsp/dspWorkerClient.ts`
  - worker settings 타입에 수치형 preset control 필드 추가
- `src/lib/dsp/worker.js`
  - 슬라이더 수치 기반 DSP 강도 매핑 구현
  - `spaceDepth`용 stereo depth enhancement 구현
  - low-end clean / glue / auto-level의 실제 강도 반영 구조 추가
- `src/features/mastering/presets.ts`
  - 새 강도 매핑 기준에 맞춰 프리셋 값 재조정

---

## 7. 검증 결과

### A. 개발 검증
- `npx tsc --noEmit` 통과.
- `npm run build:ext` 통과.
- 주의: 현재 로컬 시스템 Node 버전이 `v24.12.0`인 경우 plain `vite build`가 불안정할 수 있으므로, production-like 검증은 `npm run build:ext` 기준으로 보는 것이 맞음.

### A-2. 후속 품질 보정 검증
- `npm run build:ext`를 이번 후속 수정 이후 다시 실행하여 정상 통과 확인.
- 즉, `spaceDepth` 구현과 worker settings 확장, preset 값 재조정이 타입/빌드 수준에서는 현재 배포 체인과 충돌하지 않음을 확인함.

### B. 청감 검증
- 수정 직후 `None`에서 고역 잡음이 사실상 사라진 것을 확인.
- `Warm Tape` 프리셋에서도 이전처럼 귀에 걸리는 잡음이 들리지 않는 수준까지 개선됨.
- `-14 LUFS`를 절대 정확도보다 품질 우선으로 맞추되, 결과값은 실사용 기준 충분히 근접한 수준으로 수렴함.
- 후속 수정 시점의 해석:
  - 이번 변경은 "잡음 핫픽스"가 아니라 "프리셋 설계 정직성 복구"에 더 가까움.
  - 따라서 숫자상 빌드/타입 검증은 완료됐지만, 최종 청감 QA는 프리셋별로 다시 듣고 판단해야 함.
  - 우선 청감 재검증 우선순위는 `Transparent`, `Wide Cinema`, `Punch Glue`, `Warm Tape` 순으로 보는 것이 좋음.

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
5. `spaceDepth`의 청감 적정점 검증
   - 너무 얕으면 무의미하고, 너무 깊으면 pseudo-spatial artifact처럼 들릴 수 있으므로 `Wide Cinema` / `Transparent` 중심으로 재청취 필요
6. `autoLevelStrength`와 transient enhancement 경계값 검증
   - 현재는 고강도 구간에서만 transient enhancement를 소량 병렬로 넣도록 정리했으므로, `Punch Glue`와 `Loud & Clear`가 이름에 맞게 분리되는지 확인 필요

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
- 추가 후속 수정으로 프리셋 슬라이더 수치가 실제 DSP 강도로 더 정직하게 반영되도록 구조를 보정했고, `spaceDepth`도 더 이상 죽은 파라미터가 아니게 되었음.
- 현재 상태는 실사용 배포 기준으로 충분히 안전하지만, 이후 작업은 "공통 끝단 안정화"가 아니라 "개별 프리셋의 청감 밸런스 미세 조정" 단계로 보는 것이 맞음.

---

**v1.1 요약:** "공통 export 끝단의 과도한 비선형 마무리 체인을 정리하여, `None`을 포함한 전체 프리셋에서 고역 잡음 리스크를 실사용 가능한 수준으로 낮춘 안정화 릴리스. 이후 후속 보정으로 프리셋 슬라이더 수치와 실제 DSP 강도의 정합성을 높이고, `spaceDepth`를 실제 stereo depth 처리로 복구함."
