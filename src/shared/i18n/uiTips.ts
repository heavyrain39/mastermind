import type { UiLocale } from "./useUiLocale";

export interface UiTips {
  common: {
    themeMode: string;
  };
  queue: {
    uploadWav: string;
    processSelected: string;
    processAll: string;
    statusFilter: string;
    selectAll: string;
    clearQueue: string;
    selectTrack: string;
    setActiveTrack: string;
    downloadTrack: string;
    downloadDoneTracks: string;
    removeTrack: string;
  };
  ab: {
    play: string;
    stop: string;
    modeA: string;
    modeB: string;
    waveSeekOriginal: string;
    waveSeekMastered: string;
    openAb: string;
    readyListCta: string;
  };
  mastering: {
    targetLufs: string;
    truePeakCeiling: string;
    outputTrim: string;
    normalizeLoudness: string;
    warmth: string;
    clarity: string;
    air: string;
    lowEndClean: string;
    stereoWidth: string;
    spaceDepth: string;
    monoBassAnchor: string;
    glueCompression: string;
    autoLevelStrength: string;
    sampleRate: string;
    bitDepth: string;
    dither: string;
  };
  presets: {
    none: string;
    transparent: string;
    "warm-tape": string;
    "crystal-air": string;
    "punch-glue": string;
    "wide-cinema": string;
    "loud-clear": string;
    custom: string;
  };
}

const tipsByLocale: Record<UiLocale, UiTips> = {
  ko: {
    common: {
      themeMode: "테마는 시각적 표시 모드만 전환합니다. 출력 결과나 데이터 신호 체계에는 영향을 미치지 않습니다."
    },
    queue: {
      uploadWav: "분석 및 처리할 오디오 파일(WAV, MP3, M4A, OGG, FLAC)을 대기열 시스템에 할당합니다.",
      processSelected: "현재 선택된 트랙 세트에 한해 마스터링 루틴을 개시합니다.",
      processAll: "대기열의 모든 트랙에 대한 일괄 처리 루틴을 개시합니다.",
      statusFilter: "처리 상태 분류 지표에 따라 목록을 필터링합니다.",
      selectAll: "대기열 전원의 선택 상태를 일괄 반전 처리합니다.",
      clearQueue: "대기열의 모든 트랙 데이터를 메모리에서 완전 초기화합니다.",
      selectTrack: "마스터링 처리 대상으로 지정하거나 지정 해제합니다.",
      setActiveTrack: "해당 트랙을 A/B 모니터링 시스템의 활성 채널로 전환합니다.",
      downloadTrack: "완료 처리된 트랙의 마스터 데이터를 로컬 환경으로 전송(다운로드)합니다.",
      downloadDoneTracks: "처리 완료된 전체 트랙 데이터를 압축하여 순차 전송합니다.",
      removeTrack: "해당 트랙을 대기열에서 영구히 배제합니다."
    },
    ab: {
      play: "현재 지정된 소스 채널(A 또는 B)의 재생 프로세스를 시작합니다.",
      stop: "재생 프로세스를 중단하고 타임라인 0:00 지점으로 복귀합니다.",
      modeA: "채널 A (원본 데이터) 모니터링 모드를 활성화합니다.",
      modeB: "채널 B (마스터링 완료형 데이터) 모니터링 모드를 활성화합니다.",
      waveSeekOriginal: "원본 파형의 특정 시점으로 즉시 탐색(Seek)합니다.",
      waveSeekMastered: "마스터 파형의 특정 시점으로 즉시 탐색(Seek)합니다.",
      openAb: "완료된 해당 트랙을 중앙 A/B 모니터 시스템에 할당합니다.",
      readyListCta: "포트폴리오 페이지에서 추가적인 임무 기록을 열람할 수 있습니다."
    },
    mastering: {
      targetLufs: "최종 음원의 기준 볼륨(LUFS)을 설정합니다. 유튜브 등 영상 규격인 -14.0 LUFS를 권장합니다.",
      truePeakCeiling: "소리가 왜곡(클리핑)되지 않도록 막아주는 최상단 안전선입니다. 안전을 위해 통상 -1.0 dBTP를 유지합니다.",
      outputTrim: "마스터링 처리를 모두 거친 후, 플레이어에 전달되기 직전의 최종 볼륨을 미세 조정합니다.",
      normalizeLoudness: "여러 트랙의 곡들을 묶을 때, 곡들 사이의 볼륨 차이가 나지 않도록 전체적인 밸런스를 고르게 맞춥니다.",
      warmth: "사운드에 따뜻하고 아날로그적인 질감을 더합니다. (저역/중음역대 배음 보강)",
      clarity: "먹먹하거나 거칠게 뭉친 소리를 다듬어 맑고 깨끗하게 만듭니다. (중고역대 정돈)",
      air: "탁 트인 개방감과 찰랑거리는 공간감을 부여합니다. (초고음역대 확장)",
      lowEndClean: "웅웅거리는 불필요한 저음을 깎아내어 킥/베이스 사운드를 단단하고 깔끔하게 제어합니다.",
      stereoWidth: "소리가 양옆으로 퍼지는 폭을 조절하여 더 넓은 무대를 연출합니다.",
      spaceDepth: "소리가 앞뒤로 위치하는 깊이감을 제어하여 입체적인 공간 규모를 만듭니다.",
      monoBassAnchor: "저음이 양옆으로 흩어지지 않도록 모노(정중앙)로 묵직하게 잡아줍니다.",
      glueCompression: "각기 따로 노는 악기 소리들을 하나의 곡처럼 쫀득하게 밀착시킵니다. (다이내믹스 응집)",
      autoLevelStrength: "전체적인 볼륨 밸런스를 자동으로 맞춰주는 기능이 어느 정도로 개입할지 강도를 설정합니다.",
      sampleRate: "소리의 해상도를 결정합니다. 영상용(48kHz) 또는 보편적인 음원용(44.1kHz)을 선택하세요.",
      bitDepth: "소리의 다이내믹 레인지를 결정합니다. 배포 목적지에 맞춰 24-bit 또는 16-bit를 지정합니다.",
      dither: "비트 해상도를 낮출 때 생기는 디지털 노이즈를, 듣기 좋은 자연스러운 아주 작은 노이즈로 감쪽같이 덮어줍니다."
    },
    presets: {
      none: "음원에 일절 손을 대지 않고, 볼륨(LUFS)만 목표치에 맞춰 정규화합니다.",
      transparent: "원본의 밸런스를 최대한 존중하며, 볼륨 정규화와 최소한의 보정만 적용합니다.",
      "warm-tape": "아날로그 테이프의 따뜻한 질감을 재현합니다. 저중역 배음을 보강하고 고역을 부드럽게 다듬습니다.",
      "crystal-air": "초고역 확장과 맑은 결을 우선시합니다. 개방감 있고 선명한 사운드를 원할 때 적합합니다.",
      "punch-glue": "타격감과 응집력을 극대화합니다. 다이나믹스를 강하게 압축하여 밀도 높은 결과물을 만듭니다.",
      "wide-cinema": "넓은 스테레오 이미지와 깊은 공간감을 연출합니다. 시네마틱 스코어나 앰비언트 음원에 적합합니다.",
      "loud-clear": "유튜브 등 스트리밍 배포에 최적화된 설정입니다. 높은 음압과 깔끔한 디테일 사이의 균형을 잡습니다.",
      custom: "사용자가 직접 파라미터를 조정합니다. 선택 시 기본 프리셋(Transparent) 수치로 초기화됩니다."
    }
  },
  en: {
    common: {
      themeMode: "Switches the visual display mode. This action does not impact the output signal or mastering pipeline."
    },
    queue: {
      uploadWav: "Allocate audio files (WAV, MP3, M4A, OGG, FLAC) to the queue system for analysis and processing.",
      processSelected: "Initiate mastering routine exclusively on the currently designated track subset.",
      processAll: "Initiate batch mastering routine across all tracks in the current queue.",
      statusFilter: "Filter queue displays according to processing status parameters.",
      selectAll: "Invert selection status uniformly across all queued tracks.",
      clearQueue: "Purge all track data instances from the queue memory.",
      selectTrack: "Designate or un-designate this track for mastering operations.",
      setActiveTrack: "Assign this track to the active channel of the A/B monitoring system.",
      downloadTrack: "Download the processed master data for this track to the local environment.",
      downloadDoneTracks: "Compress and sequentially download all processed track data.",
      removeTrack: "Permanently expel this track from the current system queue."
    },
    ab: {
      play: "Commence playback process for the currently designated source channel (A or B).",
      stop: "Halt playback process and reset timeline to the 0:00 position.",
      modeA: "Activate monitoring mode for Channel A (Original Data).",
      modeB: "Activate monitoring mode for Channel B (Mastered Data).",
      waveSeekOriginal: "Instantly seek to a specific coordinate within the original waveform.",
      waveSeekMastered: "Instantly seek to a specific coordinate within the mastered waveform.",
      openAb: "Allocate the finished track to the central A/B monitor system.",
      readyListCta: "Access the portfolio page to review supplementary mission logs."
    },
    mastering: {
      targetLufs: "Set the target loudness parameter (LUFS). The recommended baseline of -14.0 LUFS effectively mitigates system overload.",
      truePeakCeiling: "Limit the maximum amplitude ceiling for signal peaks. -1.0 dBTP generally functions as the safe threshold.",
      outputTrim: "Fine-tune output stage gain to systematically prevent clipping during the final delivery phase.",
      normalizeLoudness: "Calculate and automatically compensate perceived volume variances across all tracks.",
      warmth: "Supplement low-mid harmonic content to regulate the perceived textural warmth.",
      clarity: "Suppress unnecessary resonance and harsh frequencies in the upper-mid range to maximize definition.",
      air: "Open the ultra-high frequency band to expand the spatial resolution of the playback environment.",
      lowEndClean: "Control excessive low-end buildup and maintain phase separation between kick and bass elements.",
      stereoWidth: "Adjust the polarity width of the stereo image to reconfigure perceived spatial scale.",
      spaceDepth: "Modulate reverberation decay parameters to simulate front-to-back distance in the acoustic space.",
      monoBassAnchor: "Restrict low-frequency phase shifting and lock it to the mono axis to guarantee playback compatibility.",
      glueCompression: "Regulate the dynamics threshold to reinforce physical cohesion between track components.",
      autoLevelStrength: "Determine the intervention threshold and intensity of the automated leveling processor.",
      sampleRate: "Define the output sample rate. 48kHz and 44.1kHz are supported depending on deployment requirements.",
      bitDepth: "Define the output bit depth. Select either 24-bit or 16-bit pipeline based on the destination target.",
      dither: "Select the algorithm to suppress quantization noise generated during bit-depth downward conversion."
    },
    presets: {
      none: "Applies no tonal or dynamic processing at all. Only normalizes volume to the target LUFS.",
      transparent: "Respects the original balance with minimal intervention. Applies loudness normalization and subtle correction only.",
      "warm-tape": "Recreates the warm texture of analog tape. Enhances low-mid harmonics and gently rolls off the highs.",
      "crystal-air": "Prioritizes ultra-high extension and pristine clarity. Ideal for open, sparkling sonic landscapes.",
      "punch-glue": "Maximizes impact and cohesion. Applies heavy dynamic compression for a dense, powerful result.",
      "wide-cinema": "Creates a wide stereo image and deep spatial dimension. Suited for cinematic scores and ambient material.",
      "loud-clear": "Optimized for streaming platforms such as YouTube. Balances high loudness with clean, detailed output.",
      custom: "Allows manual parameter adjustment. Selecting this resets values to the default Transparent baseline."
    }
  }
};

export function getUiTips(locale: UiLocale): UiTips {
  return tipsByLocale[locale];
}
