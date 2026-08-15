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
    lufsMatch: string;
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
      themeMode: "화면 테마를 변경합니다. 마스터링 결과물에는 영향을 주지 않습니다."
    },
    queue: {
      uploadWav: "작업할 오디오 파일(WAV, MP3, M4A, OGG, FLAC)을 대기열에 추가합니다.",
      processSelected: "선택한 트랙들만 마스터링을 시작합니다.",
      processAll: "전체 대기열 트랙의 마스터링을 시작합니다.",
      statusFilter: "처리 상태에 따라 목록을 필터링합니다.",
      selectAll: "모든 트랙을 선택하거나 선택 해제합니다.",
      clearQueue: "대기열을 비우고 트랙 데이터를 모두 삭제합니다.",
      selectTrack: "이 트랙을 작업 대상에 포함하거나 제외합니다.",
      setActiveTrack: "이 트랙을 A/B 비교 청취용 활성 채널로 설정합니다.",
      downloadTrack: "마스터링이 완료된 오디오 파일을 다운로드합니다.",
      downloadDoneTracks: "완료된 모든 트랙을 ZIP 파일로 다운로드합니다.",
      removeTrack: "이 트랙을 대기열에서 삭제합니다."
    },
    ab: {
      lufsMatch: "켜면 원본과 마스터의 재생 음량을 맞춰, 음색 차이만 비교할 수 있습니다.",
      play: "선택된 채널(A 또는 B)을 재생합니다.",
      stop: "재생을 멈추고 처음으로 돌아갑니다.",
      modeA: "채널 A (원본 트랙) 소리를 듣습니다.",
      modeB: "채널 B (마스터링 결과물) 소리를 듣습니다.",
      waveSeekOriginal: "클릭하여 원본 파형의 특정 구간으로 이동합니다.",
      waveSeekMastered: "클릭하여 마스터 파형의 특정 구간으로 이동합니다.",
      openAb: "이 트랙을 A/B 비교 패널에서 엽니다.",
      readyListCta: "포트폴리오 페이지에서 기존 작업 내역을 확인합니다."
    },
    mastering: {
      targetLufs: "최종 목표 볼륨(LUFS)을 설정합니다. 유튜브 등 플랫폼은 보통 -14.0 LUFS를 권장합니다.",
      truePeakCeiling: "소리의 왜곡(클리핑)을 막는 최대 볼륨 한계선입니다. 보통 -1.0 dBTP 기준을 권장합니다.",
      outputTrim: "출력되기 직전의 최종 볼륨을 미세 조정합니다.",
      normalizeLoudness: "여러 곡의 볼륨이 일정하게 들리도록 전체 밸런스를 맞춰줍니다.",
      warmth: "저중음역 배음을 보강하여 사운드에 아날로그 질감을 더합니다.",
      clarity: "뭉친 중고음역을 다듬어 소리를 더 선명하고 투명하게 만듭니다.",
      air: "초고음역을 열어주어 탁 트인 개방감과 공간감을 부여합니다.",
      lowEndClean: "저음역을 정리해 킥과 베이스 윤곽을 단단하게 잡아줍니다.",
      stereoWidth: "스테레오 폭을 넓혀 더 스케일이 큰 공간감을 연출합니다.",
      spaceDepth: "앞뒤 거리감을 조절하여 입체적인 깊이감을 더합니다.",
      monoBassAnchor: "저음이 퍼지지 않고 중앙(모노)에서 무게 중심을 잡도록 고정합니다.",
      glueCompression: "분리된 악기 소리들을 뭉쳐주어 하나의 곡처럼 자연스럽게 밀착시킵니다.",
      autoLevelStrength: "곡 전체의 볼륨 밸런스를 자동 보정하는 강도를 설정합니다.",
      sampleRate: "오디오 해상도를 결정합니다. 일반 음원은 44.1kHz, 영상용은 48kHz를 권장합니다.",
      bitDepth: "오디오의 다이내믹 범위를 결정합니다. 일반 배포용은 16-bit, 고음질용은 24-bit를 선택하세요.",
      dither: "비트 레이트를 낮출 때 발생하는 디지털 노이즈를 자연스러운 미세 노이즈로 덮어줍니다."
    },
    presets: {
      none: "음원에 일절 손대지 않고 볼륨(LUFS)만 목표치에 맞추어 정규화합니다.",
      transparent: "원본의 느낌을 유지하며 볼륨 정규화와 가벼운 보정만 적용합니다.",
      "warm-tape": "아날로그 테이프의 질감을 더합니다. 저음을 채우고 쏘는 고음은 부드럽게 눌러줍니다.",
      "crystal-air": "초고음역 확장에 집중하여 맑고 찰랑거리는 선명함을 만들어냅니다.",
      "punch-glue": "압축감을 강하게 주어 밀도 높고 타격감 있는 단단한 소리로 만듭니다.",
      "wide-cinema": "넓은 스테레오 이미지와 깊은 공간감을 연출합니다. 시네마틱 스코어나 앰비언트 음원에 적합합니다.",
      "loud-clear": "유튜브 등 스트리밍 배포용으로 꽉 찬 볼륨과 깔끔한 디테일의 밸런스를 잡습니다.",
      custom: "파라미터를 수동으로 조절합니다. 선택 시 기본값(Transparent)으로 초기화된 상태에서 시작합니다."
    }
  },
  en: {
    common: {
      themeMode: "Changes the visual theme. This does not affect the output audio or processing."
    },
    queue: {
      uploadWav: "Add audio files (WAV, MP3, M4A, OGG, FLAC) to the queue for analysis and processing.",
      processSelected: "Process only the currently selected tracks.",
      processAll: "Process all tracks in the queue.",
      statusFilter: "Filter the track list by their processing status.",
      selectAll: "Select or deselect all tracks in the queue.",
      clearQueue: "Remove all tracks from the queue and clear data.",
      selectTrack: "Select or deselect this track for processing.",
      setActiveTrack: "Set this track as the active channel for A/B comparison.",
      downloadTrack: "Download the mastered audio file for this track.",
      downloadDoneTracks: "Download all completely processed tracks as a ZIP file.",
      removeTrack: "Remove this track from the queue."
    },
    ab: {
      lufsMatch: "Turn on to match playback loudness and compare tone without volume bias.",
      play: "Play the currently selected channel (A or B).",
      stop: "Stop playback and return to the beginning.",
      modeA: "Listen to Channel A (Original Track).",
      modeB: "Listen to Channel B (Mastered Track).",
      waveSeekOriginal: "Click to jump to a specific part of the original track.",
      waveSeekMastered: "Click to jump to a specific part of the mastered track.",
      openAb: "Open this track in the A/B comparison panel.",
      readyListCta: "Check the portfolio page for additional operation logs."
    },
    mastering: {
      targetLufs: "Sets the final target loudness (LUFS). -14.0 LUFS is recommended for YouTube and streaming.",
      truePeakCeiling: "Sets the maximum peak level to prevent distortion (clipping). -1.0 dBTP is the standard safe limit.",
      outputTrim: "Fine-tunes the final output volume just before exporting the audio.",
      normalizeLoudness: "Balances the overall loudness across multiple tracks so they maintain a consistent volume level.",
      warmth: "Adds a warm, analog texture to the sound by boosting low-mid harmonics.",
      clarity: "Clears up muddy or harsh elements in the upper-mids to make the sound pristine and well-defined.",
      air: "Expands the ultra-high frequencies to give the sound an open, airy, and spacious feel.",
      lowEndClean: "Removes muddy low frequencies, keeping the kick and bass tight and controlled.",
      stereoWidth: "Adjusts how far the sound spreads to the left and right, creating a wider stereo image.",
      spaceDepth: "Controls the front-to-back depth of the sound, adding a sense of three-dimensional space.",
      monoBassAnchor: "Centers the low frequencies (bass) to mono, ensuring they remain solid and anchored in the middle.",
      glueCompression: "Subtly compresses the mix to 'glue' individual instruments together, making them sound like one cohesive track.",
      autoLevelStrength: "Sets how strongly the automatic leveling adjusts the overall volume balance.",
      sampleRate: "Determines the audio resolution. Choose 48kHz for video or 44.1kHz for standard music releases.",
      bitDepth: "Determines the dynamic range. Select 24-bit for high-res or 16-bit for standard CD/streaming delivery.",
      dither: "Adds a subtle, pleasant noise to mask digital artifacts when reducing the bit depth."
    },
    presets: {
      none: "Applies no tonal or dynamic processing. Only normalizes the volume to the target LUFS.",
      transparent: "Respects the original balance with minimal intervention. Applies loudness normalization and very subtle corrections.",
      "warm-tape": "Recreates the warm texture of analog tape. Enhances low-mid harmonics and gently smooths the highs.",
      "crystal-air": "Prioritizes ultra-high extension and pristine clarity. Ideal for an open, airy, and crisp sound.",
      "punch-glue": "Maximizes impact and cohesion. Applies firm dynamic compression for a dense and punchy result.",
      "wide-cinema": "Creates a wider stereo image and deep spatial dimension. Best suited for cinematic scores and ambient tracks.",
      "loud-clear": "Optimized for streaming platforms like YouTube. Balances high loudness with a clean, detailed output.",
      custom: "Allows manual parameter adjustments. Selecting this resets values to the default Transparent settings."
    }
  },
  pt: {
    common: {
      themeMode: "Altera o tema visual. Isso não afeta o áudio de saída ou o processamento."
    },
    queue: {
      uploadWav: "Adicione arquivos de áudio (WAV, MP3, M4A, OGG, FLAC) à fila para análise e processamento.",
      processSelected: "Processar apenas as faixas atualmente selecionadas.",
      processAll: "Processar todas as faixas na fila.",
      statusFilter: "Filtre a lista de faixas pelo status de processamento.",
      selectAll: "Selecionar ou desmarcar todas as faixas na fila.",
      clearQueue: "Remover todas as faixas da fila e limpar os dados.",
      selectTrack: "Selecionar ou desmarcar esta faixa para processamento.",
      setActiveTrack: "Defina esta faixa como o canal ativo para comparação A/B.",
      downloadTrack: "Baixe o arquivo de áudio masterizado para esta faixa.",
      downloadDoneTracks: "Baixar todas as faixas totalmente processadas como um arquivo ZIP.",
      removeTrack: "Remover esta faixa da fila."
    },
    ab: {
      lufsMatch: "Ative para igualar o volume e comparar o timbre sem viés de volume.",
      play: "Reproduzir o canal atualmente selecionado (A ou B).",
      stop: "Parar a reprodução e voltar ao início.",
      modeA: "Ouvir o Canal A (Faixa Original).",
      modeB: "Ouvir o Canal B (Faixa Masterizada).",
      waveSeekOriginal: "Clique para pular para uma parte específica da faixa original.",
      waveSeekMastered: "Clique para pular para uma parte específica da faixa masterizada.",
      openAb: "Abra esta faixa no painel de comparação A/B.",
      readyListCta: "Verifique a página do portfólio para logs de operação adicionais."
    },
    mastering: {
      targetLufs: "Define a intensidade final desejada (LUFS). -14.0 LUFS é recomendado para YouTube e streaming.",
      truePeakCeiling: "Define o nível máximo de pico para evitar distorções (clipping). -1.0 dBTP é o limite de segurança padrão.",
      outputTrim: "Ajusta o volume de saída final logo antes de exportar o áudio.",
      normalizeLoudness: "Equilibra o volume geral em várias faixas para que mantenham um nível consistente.",
      warmth: "Adiciona uma textura analógica e quente ao som, aumentando os harmônicos graves-médios.",
      clarity: "Limpa elementos abafados ou ásperos nos médios-altos para tornar o som cristalino e bem definido.",
      air: "Expande as frequências ultra-altas para dar ao som uma sensação aberta e espaçosa.",
      lowEndClean: "Remove frequências graves turvas, mantendo o bumbo e o baixo firmes e controlados.",
      stereoWidth: "Ajusta a amplitude do som para a esquerda e para a direita, criando uma imagem estéreo mais ampla.",
      spaceDepth: "Controla a profundidade do som, adicionando uma sensação de espaço tridimensional.",
      monoBassAnchor: "Centraliza as frequências baixas (graves) em mono, garantindo que permaneçam sólidas no centro.",
      glueCompression: "Comprime sutilmente a mixagem para 'colar' os instrumentos individuais, fazendo-os soar como uma faixa coesa.",
      autoLevelStrength: "Define a intensidade em que o nivelador automático ajusta o equilíbrio geral do volume.",
      sampleRate: "Determina a resolução do áudio. Escolha 48kHz para vídeo ou 44.1kHz para lançamentos musicais padrão.",
      bitDepth: "Determina o alcance dinâmico. Selecione 24-bit para alta resolução ou 16-bit para CD/streaming padrão.",
      dither: "Adiciona um ruído sutil e agradável para mascarar artefatos digitais ao reduzir a profundidade de bits."
    },
    presets: {
      none: "Não aplica processamento tonal ou dinâmico. Apenas normaliza o volume para o alvo LUFS.",
      transparent: "Respeita o equilíbrio original com intervenção mínima. Aplica normalização de volume e correções muito sutis.",
      "warm-tape": "Recria a textura quente da fita analógica. Realça os harmônicos graves-médios e suaviza suavemente os agudos.",
      "crystal-air": "Prioriza a extensão ultra-alta e clareza cristalina. Ideal para um som aberto, leve e nítido.",
      "punch-glue": "Maximiza o impacto e coesão. Aplica uma compressão dinâmica firme para um resultado denso e com punch.",
      "wide-cinema": "Cria uma imagem estéreo mais ampla e profunda dimensão espacial. Mais adequado para trilhas cinematográficas e faixas ambientais.",
      "loud-clear": "Otimizado para plataformas de streaming como o YouTube. Equilibra o alto volume com uma saída limpa e detalhada.",
      custom: "Permite ajustes manuais de parâmetros. Selecionar esta opção redefine os valores para as configurações transparentes padrão."
    }
  },
  ja: {
    common: {
      themeMode: "画面のテーマを変更します。マスタリングされたオーディオ出力には影響しません。"
    },
    queue: {
      uploadWav: "作業するオーディオファイル（WAV、MP3、M4A、OGG、FLAC）を追加します。",
      processSelected: "選択したトラックのみマスタリングを開始します。",
      processAll: "キュー内の全トラックのマスタリングを開始します。",
      statusFilter: "処理状態に応じてトラック一覧をフィルタリングします。",
      selectAll: "すべてのトラックを選択、または選択解除します。",
      clearQueue: "キューを空にして、すべてのトラックデータを削除します。",
      selectTrack: "このトラックを作業対象に含める、または除外します。",
      setActiveTrack: "このトラックをA/B比較の対象チャンネルに設定します。",
      downloadTrack: "マスタリングが完了したオーディオファイルをダウンロードします。",
      downloadDoneTracks: "完了したすべてのトラックをZIPファイルでダウンロードします。",
      removeTrack: "このトラックをキューから削除します。"
    },
    ab: {
      lufsMatch: "オンにすると再生音量をそろえ、音量差に惑わされず音質を比較できます。",
      play: "選択したチャンネル（AまたはB）を再生します。",
      stop: "再生を停止して最初に戻ります。",
      modeA: "チャンネルA（オリジナル音源）を聴きます。",
      modeB: "チャンネルB（マスタリング結果）を聴きます。",
      waveSeekOriginal: "クリックしてオリジナル波形の特定の位置に移動します。",
      waveSeekMastered: "クリックしてマスタリング波形の特定の位置に移動します。",
      openAb: "このトラックをA/B比較パネルで開きます。",
      readyListCta: "ポートフォリオページで過去の作業履歴を確認できます。"
    },
    mastering: {
      targetLufs: "最終的な目標音量（LUFS）を設定します。YouTube等の標準である-14.0 LUFSを推奨します。",
      truePeakCeiling: "音の歪み（クリッピング）を防ぐための最大音量の上限です。通常は-1.0 dBTPに設定します。",
      outputTrim: "出力される直前の最終音量を微調整します。",
      normalizeLoudness: "複数の曲の音量がバラつかないよう、一定に聴こえるようにバランスを整えます。",
      warmth: "中低音域の倍音を補強し、アナログテープのような温かみのある質感を加えます。",
      clarity: "モコモコした中高音域を整理し、クリアで透明感のあるサウンドにします。",
      air: "超高音域を広げて、抜けの良い開放感と空間の広がりを与えます。",
      lowEndClean: "濁った低音域を整理し、キックとベースの輪郭をタイトに引き締めます。",
      stereoWidth: "ステレオの幅を広げ、よりスケールの大きな空間を演出します。",
      spaceDepth: "前後の距離感を調整して、立体的な奥行きを加えます。",
      monoBassAnchor: "低音が広がらないよう、中央（モノラル）に重心を固定します。",
      glueCompression: "バラバラの楽器の音を滑らかにまとめ、自然な一体感を出します。",
      autoLevelStrength: "全体の音量バランスを自動補正する機能の強さを設定します。",
      sampleRate: "オーディオの解像度を決定します。一般的には44.1kHz、映像用なら48kHzを推奨します。",
      bitDepth: "オーディオのダイナミックレンジを決定します。配信用は16-bit、高音質用は24-bitを選択してください。",
      dither: "ビット数を下げる際に発生するデジタルノイズを、微少で自然なノイズでカバーします。"
    },
    presets: {
      none: "音質には一切手を加えず、音量（LUFS）だけを目標値に合わせて正規化します。",
      transparent: "オリジナルの雰囲気を保ちつつ、音量調整とごく軽微な補正のみ行います。",
      "warm-tape": "アナログテープの質感を加えます。低音を豊かにし、刺さる高音は滑らかに抑えます。",
      "crystal-air": "超高音域の広がりにフォーカスし、クリアで抜けの良いサウンドを作ります。",
      "punch-glue": "圧縮感を強めにかけて、密度が高くパンチのあるタイトなサウンドにします。",
      "wide-cinema": "ステレオ幅と空間を広げ、映画音楽やアンビエントトラックに合う響きにします。",
      "loud-clear": "YouTubeなどの配信用に、音圧の高さとクリアなディテールのバランスを取ります。",
      custom: "パラメータを手動で調整します。選択すると標準（Transparent）に初期化された状態から始まります。"
    }
  }
};

export function getUiTips(locale: UiLocale): UiTips {
  return tipsByLocale[locale];
}
