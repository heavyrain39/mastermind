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
}

const tipsByLocale: Record<UiLocale, UiTips> = {
  ko: {
    common: {
      themeMode:
        "테마는 화면 스타일만 바꿉니다. 음량이나 마스터링 결과 자체에는 영향을 주지 않습니다."
    },
    queue: {
      uploadWav: "WAV 파일을 여러 개 한 번에 추가합니다.",
      processSelected: "선택한 트랙만 마스터링 큐에 넣어 처리합니다.",
      processAll: "큐에 있는 모든 트랙을 한 번에 처리합니다.",
      statusFilter: "상태별로 목록을 좁혀서 확인합니다.",
      selectAll: "큐의 모든 트랙 선택 상태를 한 번에 바꿉니다.",
      clearQueue: "큐를 비우고 로드된 트랙을 모두 제거합니다.",
      selectTrack: "이 곡을 처리 대상에 포함하거나 제외합니다.",
      setActiveTrack: "이 곡을 A/B 모니터의 현재 트랙으로 엽니다.",
      downloadTrack: "이 곡의 마스터링 결과 파일을 다운로드합니다.",
      downloadDoneTracks: "완료된 모든 트랙의 결과 파일을 순차 다운로드합니다.",
      removeTrack: "이 곡만 큐에서 제거합니다."
    },
    ab: {
      play: "현재 선택된 A 또는 B 소스를 재생합니다.",
      stop: "재생을 멈추고 재생 위치를 처음으로 돌립니다.",
      modeA: "원본 오디오(A)로 모니터링합니다.",
      modeB: "마스터링 결과(B)로 모니터링합니다.",
      waveSeekOriginal: "원본 파형에서 클릭한 위치로 즉시 이동합니다.",
      waveSeekMastered: "마스터 파형에서 클릭한 위치로 즉시 이동합니다.",
      openAb: "선택한 결과를 중앙 A/B 모니터로 불러옵니다.",
      readyListCta: "포트폴리오에서 다른 오디오/제품 프로젝트도 확인할 수 있습니다."
    },
    mastering: {
      targetLufs:
        "유튜브 기준에 맞추기 좋은 평균 음량 목표치입니다. 기본값 -14 LUFS는 과도한 라우드니스 경쟁을 줄여줍니다.",
      truePeakCeiling:
        "인코딩 과정에서 생길 수 있는 오버를 막기 위한 최대 피크 한도입니다. 일반적으로 -1.0 dBTP가 안전합니다.",
      outputTrim: "최종 출력 전체 레벨을 미세 조정해 과출력을 방지합니다.",
      normalizeLoudness: "트랙 간 평균 체감 음량을 더 균일하게 맞춥니다.",
      warmth: "저중역의 온기를 더해 차갑지 않은 인상을 만듭니다.",
      clarity: "거칠고 자극적인 대역을 정리해 더 부드럽고 또렷하게 만듭니다.",
      air: "고역의 개방감과 숨결감을 더합니다.",
      lowEndClean: "저역의 번짐을 줄여 킥/베이스 분리를 개선합니다.",
      stereoWidth: "좌우 폭을 조절해 공간감 인상을 바꿉니다.",
      spaceDepth: "전후 거리감과 잔향 느낌을 조절합니다.",
      monoBassAnchor: "저역을 중앙에 더 단단히 고정해 재생 호환성을 높입니다.",
      glueCompression: "트랙 요소들을 한 덩어리로 묶어주는 압축 강도입니다.",
      autoLevelStrength: "자동 레벨 보정의 개입 정도를 정합니다.",
      sampleRate: "최종 파일의 샘플레이트입니다. 배포 플랫폼 기준에 맞춰 선택하세요.",
      bitDepth: "최종 파일의 비트 깊이입니다. 24-bit는 작업용, 16-bit는 배포 호환성이 좋습니다.",
      dither: "비트 깊이를 낮출 때 생길 수 있는 왜곡을 줄이기 위한 노이즈 처리 방식입니다."
    }
  },
  en: {
    common: {
      themeMode:
        "Theme only changes interface appearance and does not affect loudness or mastering results."
    },
    queue: {
      uploadWav: "Add one or more WAV files to the queue.",
      processSelected: "Master only the tracks currently selected.",
      processAll: "Master every track in the queue at once.",
      statusFilter: "Filter queue rows by processing status.",
      selectAll: "Toggle selection for every track in the queue.",
      clearQueue: "Remove all loaded tracks from the queue.",
      selectTrack: "Include or exclude this track from processing.",
      setActiveTrack: "Open this track in the A/B monitor.",
      downloadTrack: "Download this mastered result file.",
      downloadDoneTracks: "Download all completed mastered files.",
      removeTrack: "Remove this track from the queue only."
    },
    ab: {
      play: "Play whichever source is currently selected: A or B.",
      stop: "Stop playback and return to the start.",
      modeA: "Monitor the original source.",
      modeB: "Monitor the mastered source.",
      waveSeekOriginal: "Click anywhere on the original waveform to seek.",
      waveSeekMastered: "Click anywhere on the mastered waveform to seek.",
      openAb: "Load this finished track into the A/B monitor.",
      readyListCta: "Visit the portfolio page to discover other projects."
    },
    mastering: {
      targetLufs:
        "Average loudness target tuned for YouTube-friendly playback. Starting at -14 LUFS usually avoids over-processing.",
      truePeakCeiling:
        "Peak safety ceiling to avoid inter-sample overs after encoding. -1.0 dBTP is a common safe default.",
      outputTrim: "Fine-adjust final output gain to prevent clipping.",
      normalizeLoudness: "Keep perceived loudness more consistent across tracks.",
      warmth: "Adds low-mid body for a warmer tone.",
      clarity: "Reduces harsh areas for a cleaner, smoother top end.",
      air: "Adds gentle high-frequency openness.",
      lowEndClean: "Tightens low-end buildup and improves bass definition.",
      stereoWidth: "Adjust perceived left-right width.",
      spaceDepth: "Adjust front-back depth and sense of space.",
      monoBassAnchor: "Keeps low frequencies centered for better translation.",
      glueCompression: "How strongly mix elements are glued together.",
      autoLevelStrength: "How aggressively auto-leveling evens level changes.",
      sampleRate: "Final output sample rate for export.",
      bitDepth: "Final output bit depth. 24-bit is production-friendly, 16-bit is distribution-friendly.",
      dither: "Noise-shaping method used when reducing bit depth."
    }
  }
};

export function getUiTips(locale: UiLocale): UiTips {
  return tipsByLocale[locale];
}
