# 코드 리뷰 수정 및 검증 — 2026-09-09

## 수정 범위

- **피크 검사의 양 끝 누락:** 모든 원본 샘플을 검사하고 첫·마지막 샘플 사이의 보간 구간까지 포함한다. 버퍼/채널 피크 계산은 공통 함수로 통합했다. 최종 리미터 출력도 다시 검사해 잔여 초과분이 있을 때만 전체 게인을 낮춘다.
- **취소 뒤 재처리:** 디코딩·LUFS 측정 등의 비동기 단계 사이에서 취소를 확인한다. 렌더링 취소가 정규화 작업을 새로 만들던 대체 경로를 제거했다.
- **실패 결과의 잘못된 완료 처리:** 선택한 효과를 적용하지 않은 원본 정규화 결과를 완료로 표시하지 않는다. 렌더링 실패는 기존 트랙 오류 상태와 메시지로 전달하며 재시도할 수 있다.
- **워커 배분 경쟁 조건:** 워커 생성과 예약을 동기적으로 처리한다. 종료 직전에 예약됐지만 아직 전송되지 않은 요청도 세대 번호로 차단한다. 종료 후 새 작업과 워커 오류 후 대기 작업 복구는 유지한다.
- **다운로드 변환 중복:** 개별·ZIP 다운로드가 `src/lib/audio/exportMaster.ts`를 공유한다. 저장된 24-bit WAV의 샘플레이트와 메타데이터가 같으면 바이트를 재사용하고, 조건이 다르면 기존 디코딩·리샘플링·인코딩을 수행한다. 24-bit에서 dither가 비활성인 기존 동작도 유지한다.
- **불필요한 PCM 복사:** 워커 반환 배열을 AudioBuffer에 복사하기 전 만들던 중간 Float32Array 사본을 제거했다. 원본 버퍼를 보호하는 전송용 복사는 유지한다.
- **재마스터링 메모리 정리:** React 상태 갱신 함수의 실행 시점에 의존하던 이전 master URL 해제를 실제 상태 반영 후 수행한다. 이미 제거된 트랙의 결과 URL도 생성하지 않는다.
- **지원 런타임의 테스트 실행:** Windows의 Node 20은 `--test tests/*.test.mjs`에서 와일드카드를 확장하지 못하므로, 테스트 파일을 명시적으로 열거하는 실행기로 변경했다.

프리셋 값, 효과 순서, 화면 구성, 파일명 규칙, 출력 옵션 및 브랜드 이미지는 변경하지 않았다. 후속 릴리스 버전은 0.9.2이며 기존 0.9.1 ZIP은 보존했다. 웹스토어 제출용 `mstrmnd-ext-v0.9.2.zip`은 manifest 버전, ZIP 루트 구성, 전체 빌드 파일의 바이트 일치 및 기존 아이콘 보존을 검증했다.

## 검증 결과

- 자동 테스트 13개 통과: 기존 FFT/soft-knee/LUFS/배포 구성 6개, 피크 경계/전체 export chain 2개, 워커 배분·종료·오류 복구 3개, 출력 재사용·변환 2개.
- TypeScript 검사 및 웹 production 빌드 통과.
- 확장 프로그램 Vite 빌드 통과. Chrome Web Store 설치·업로드 검증은 포함하지 않는다.
- production preview의 실제 Chromium에서 업로드, Transparent 마스터링, A/B 재생 전환, LUFS Match, WAV/MP3 및 ZIP 다운로드, 재마스터링을 확인했다.
- 같은 조건의 WAV 다운로드가 WAV 인코더를 재호출하지 않는 것을 확인했다.
- 실제 워커 클라이언트에 렌더링 실패를 주입했을 때 정규화나 WAV 생성이 실행되지 않고 오류가 표시됐다. 렌더링 대기 중 취소 후에도 새 정규화/인코딩 요청이 없었고, 다시 시작하면 정상 완료했다.
- 다운로드한 WAV: 24-bit/48 kHz 및 16-bit/44.1 kHz, 모두 2초/2채널. MP3: 192 kbps/44.1 kHz/2채널, 인코더 패딩 포함 약 2.038초.
- WAV ZIP 및 MP3 ZIP의 각 파일은 대응하는 개별 다운로드와 바이트 단위로 일치했다.
- 2초 합성 음원(440 Hz, 90 Hz, 7.8 kHz 혼합 및 양 끝 fade)을 7개 프리셋으로 처리한 수정 전후 비교에서 최대 샘플 차이는 모두 0이었다. 해당 입력은 피크 제한을 초과하지 않는 사례이며, 모든 실제 음악에 대한 청취 품질 보증은 아니다.

## 재실행

```powershell
npm test
npm run build
node node_modules/vite/bin/vite.js build -c vite.ext.config.ts
node tests/helpers/create-audio-fixtures.mjs
npm run preview -- --host 127.0.0.1 --port 4184 --strictPort
```

preview가 실행 중인 별도 터미널에서:

```powershell
npx --yes --package @playwright/cli playwright-cli -s=mstrmnd-review open http://127.0.0.1:4184 --headed
npx --yes --package @playwright/cli playwright-cli -s=mstrmnd-review run-code --filename tests/browser/mastering-workflow.js
```

브라우저 검증은 해당 테스트 세션의 localStorage를 초기화한다. 생성한 음원·다운로드·화면 캡처는 Git에서 제외한 `output/playwright/`에 저장한다. 워커 오류 주입은 테스트 페이지 안에서만 적용한다.
