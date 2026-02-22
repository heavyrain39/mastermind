---
description: Mastermind UI 디자인 시스템 복제 지침 (Clean, Neo-brutalism, Cassette Futurism)
tags: [ui, design-system, css, styling, frontend, prompt-skill]
---

# 🎛️ Mastermind UI Design System — LLM Prompt Skill

이 문서는 **야차완(Yakshawan)** 브랜드의 고유한 UI 디자인 언어를 다른 프로젝트에 높은 정밀도로 재현하기 위한 **에이전트/LLM 프롬프트 지침(Skill Recipe)** 입니다. 새로운 웹 프로젝트를 만들 때 이 가이드를 시스템 프롬프트나 참조 문서로 제공하세요.

> 이 디자인 언어의 레퍼런스 구현체는 Mastermind 웹 마스터링 툴이지만, 아래의 원칙과 토큰은 **어떤 종류의 웹앱이나 웹사이트에도** 적용 가능합니다.

---

## 1. 🎨 디자인 컨셉 & 무드 (The Vibe)

| 항목 | 내용 |
|---|---|
| **키워드** | Clean · Minimal · Flat · Wireframe · Cassette Futurism · Editorial |
| **페르소나** | *"전직 독일인 우주비행사가 디자이너로 전직하여 만든 듯한 도구"* |
| **레퍼런스** | 80년대 Braun 하이엔드 오디오 기기, 레트로-카세트퓨처리즘, 에디토리얼 타이포그래피 |

**철학**: 자로 잰 듯 정밀하게 깎아낸 공학적 미감(Precision Engineered Aesthetics)을 바탕으로, 아날로그 하드웨어의 촉각적 느낌을 디지털 웹 환경에 플랫하게 구현합니다. 과도한 그림자나 입체감(Skeuomorphism)을 배제하고, **엄격한 그리드 정렬, 1px 테두리선, 절제된 팔레트, 역할별 타이포그래피**로 전문적이고 프로페셔널한 도구의 인상을 줍니다.

---

## 2. 🎯 UX/UI 핵심 원칙

### ❌ 하지 말 것 (Anti-patterns)
- 과한 애니메이션, 화려한 그라데이션, 강한 그림자 남발
- 불필요한 호버 모션, 복잡한 장식 요소
- `border-radius`로 둥글게 처리 (이 디자인 언어에서 둥근 모서리는 원칙적으로 사용하지 않음)

### ✅ 반드시 지킬 것 (Core Principles)
- **"정적 안정감 + 높은 사용성 + 빠른 작업 속도"** 가 핵심 가치
- 사용자의 작업 흐름(UX Flow)이 끊기지 않고 즉각적으로 이어지도록 정보 위계를 설계
- `Light / Dark / System` 3가지 모드를 지원하며 테마 전환은 즉시 반영
- 텍스트/배경 간 충분한 명도 대비(Accessibility) 확보

---

## 3. 🌗 색상 시스템 & 테마 모드

색상은 **절대로 하드코딩하지 않고** CSS Root 변수(`var(--)`)로만 관리합니다. 테마 전환 시 이 변수만 교체됩니다.

### 3-1. Light Mode (오프화이트 & 미니멀)
배경은 완전한 흰색이 아닌 차분한 오프화이트. 패널은 약간의 투명도가 들어간 흰색.
```css
:root {
  --bg: #f5f6f7;
  --panel-bg: rgba(255, 255, 255, 0.95);
  --header-bg: rgba(248, 249, 250, 0.95);
  --line: #dcdede;             /* 옅은 구분선 (내부 분할, dashed 등) */
  --line-strong: #a4a7ab;      /* 강한 구분선 (패널 테두리, 외곽) */
  --text: #212529;             /* 기본 텍스트 — 차콜에 가까운 흑색 */
  --text-dim: #797c80;         /* 보조/레이블 텍스트 */
  --accent: #111111;           /* 포인트 — 주로 검정 */
  --accent-text: #ffffff;      /* 포인트 배경 위 텍스트 */
  --hover-bg: rgba(0, 0, 0, 0.04);
}
```

### 3-2. Dark Mode (딥 차콜 & 카세트퓨처리즘)
눈이 부시지 않는 딥 차콜 배경. 패널은 조금 더 밝은 차콜로 계층 분리.
```css
:root[data-theme-mode="dark"] {
  --bg: #101113;
  --panel-bg: rgba(21, 22, 25, 0.95);
  --header-bg: rgba(14, 15, 17, 0.95);
  --line: #2b2d35;
  --line-strong: #4f5360;
  --text: #eceff3;             /* 밝은 오프화이트 */
  --text-dim: #8b8f99;
  --accent: #f0f0f0;           /* 밝은 회색/흰색 */
  --accent-text: #111111;
  --hover-bg: rgba(255, 255, 255, 0.05);
}
```

### 3-3. 색상 운용 규칙
- **유채색은 원칙적으로 사용하지 않습니다.** 차콜/오프화이트의 무채색 베이스를 유지하세요.
- 에러 상태(`#bf4d4d` 계열)나 위험 동작(`#c95163` 계열) 같은 시맨틱 컬러만 예외적으로 허용됩니다.
- `--line`과 `--line-strong`을 구분하세요: `--line`은 그룹 내부의 옅은 구분선(종종 `dashed`), `--line-strong`은 패널 외곽이나 헤더 하단의 실선 테두리입니다.

---

## 4. ✍️ 타이포그래피 (Editorial)

서체는 역할에 따라 엄격히 구분합니다. 폰트 변수를 추가로 선언하여 CSS 전역에서 일관되게 참조합니다.

```css
:root {
  --font-logo: "MuseoModerno", "Inter", sans-serif;
  --font-headline: "Inter", "Pretendard Variable", "Noto Sans KR", sans-serif;
  --font-body: "Inter", "Pretendard Variable", "Noto Sans KR", sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
}
```

| 역할 | 폰트 변수 | 설명 | 스타일 팁 |
|---|---|---|---|
| 로고/브랜드 | `--font-logo` | 기하학적·테크니컬 서체 | `scaleX(0.88)`, `font-variation-settings: "wght" 900, "wdth" 74` 로 장평 좁히고 임팩트 극대화 |
| 헤드라인/본문 | `--font-headline`, `--font-body` | 중립적 산세리프 | `letter-spacing: 0.01em`~`0.02em`, `font-weight: 600`~`640` |
| 수치/데이터 | `--font-mono` | 고정폭 모노스페이스 — 시간, 진행률, 퍼센트, 파일 크기 등 | `letter-spacing: 0.02em`~`0.05em`, 반드시 이 폰트를 사용 |

### 폰트 내재화 원칙
외부 CDN 대신 **woff2 Variable Font**를 로컬 자산으로 직접 내재화(`@font-face` + `font-display: swap`)하여 외부 연결 지연이나 폰트 깨짐을 원천 차단합니다.

```css
@font-face {
  font-family: "Inter";
  src: url("../assets/fonts/Inter-Variable-latin.woff2") format("woff2");
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
}
/* 나머지 폰트도 동일 패턴으로 등록 */
```

---

## 5. 📐 배경 그리드 라인 흐름 (Background Grid)

백그라운드에 80px 단위의 눈금선(그리드)을 바둑판 형태로 깔고, CSS Animation으로 매우 천천히 왼쪽으로 이동시켜 "프로세싱 중인 기계" 같은 생동감을 줍니다.

```css
body {
  background: var(--bg);
  background-image:
    linear-gradient(var(--line) 1px, transparent 1px),
    linear-gradient(90deg, var(--line) 1px, transparent 1px);
  background-size: 80px 80px;
  background-attachment: fixed;
  animation: gridSlide 7.5s linear infinite;
}

@keyframes gridSlide {
  from { background-position: 0 0, 0 0; }
  to   { background-position: -80px 0, -80px 0; }
}
```

---

## 6. 🏗️ 패널 & 구조 디테일 (Structural Detail)

### 6-1. 패널 (.panel)
모든 주요 영역은 `.panel` 컨테이너로 묶어 모듈화합니다.

```css
.panel {
  border: 1px solid var(--line-strong);
  background: var(--panel-bg);
  box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.05);
  position: relative;
  overflow: hidden;
}
:root[data-theme-mode="dark"] .panel {
  box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.4);
}
```
- 그림자의 **blur는 항상 0** — 딱 떨어지는 판화/도장 느낌
- 라이트/다크에서 그림자 opacity만 조절

### 6-2. 카세트 모서리 포인트
패널 좌측 상단에 10×10px 네모난 프레임을 가상요소로 덧댑니다. 카세트 데크의 기기 프레임을 연상시키는 구조적 디테일입니다.

```css
.panel::before {
  content: "";
  position: absolute;
  top: 0; left: 0;
  width: 10px; height: 10px;
  background: var(--bg);
  border-right: 1px solid var(--line-strong);
  border-bottom: 1px solid var(--line-strong);
}
```

### 6-3. 패널 내부 섹션 헤더
```css
.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px 8px 22px;     /* 좌측 여백은 카세트 포인트(10px)를 피함 */
  border-bottom: 1px solid var(--line);
}
.panel-head h2 {
  margin: 0;
  font-family: var(--font-headline);
  font-size: 14px;
  font-weight: 640;
  letter-spacing: 0.01em;
}
```

---

## 7. 🎛️ 인터랙션 컴포넌트 (Buttons & Controls)

### 7-1. 카세트 버튼 (Chamfered Buttons)
일반적인 둥근 버튼 대신, 모서리가 **사선으로 깎인** 폴리곤 형태를 `clip-path`로 구현합니다.
- `::before` (외곽선) + `::after` (내부 채움)을 겹쳐 1px 테두리와 chamfer를 동시에 표현
- Hover 시 배경이 반전되고 `scale(0.98)` 축소 → 촉각적 피드백
- Active 시 `scale(0.95)` 추가 축소

```css
.compact-btn {
  position: relative;
  background: transparent;
  border: none;
  padding: 6px 11px;
  font-family: var(--font-body);
  font-weight: 500;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  transition: transform 120ms ease, color 120ms ease;
  z-index: 1;
  isolation: isolate;
}
.compact-btn::before {
  content: ""; position: absolute; inset: 0;
  background: var(--line-strong);
  clip-path: polygon(6px 0, 100% 0, 100% 100%, 0 100%, 0 6px);
  z-index: -2;
  transition: background 120ms ease;
}
.compact-btn::after {
  content: ""; position: absolute; inset: 1px;
  background: var(--panel-bg);
  clip-path: polygon(5.5px 0, 100% 0, 100% 100%, 0 100%, 0 5.5px);
  z-index: -1;
  transition: background 120ms ease;
}
.compact-btn:hover { color: var(--accent-text); transform: scale(0.98); }
.compact-btn:hover::before,
.compact-btn:hover::after { background: var(--accent); }
.compact-btn:active { transform: scale(0.95); }
.compact-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
```

### 7-2. 주요 액션 버튼 (Primary Action)
카세트 chamfer 없이, 심플한 1px 실선 테두리 + 대문자 + hover 시 반전.
```css
.primary-action-btn {
  background: transparent;
  border: 1px solid var(--line-strong);
  padding: 10px 16px;
  font-weight: 640;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  transition: all 120ms ease;
}
.primary-action-btn:hover {
  background: var(--accent);
  color: var(--accent-text);
  border-color: var(--accent);
  transform: scale(0.98);
}
.primary-action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
```

### 7-3. Range Slider (페이더 스타일)
- 트랙: 높이 2px의 가느다란 선, `--progress` 변수로 채움 비율 표현
- 썸(Thumb): 세로로 긴 직사각형(8×14px), **border-radius: 0** — 기계적 페이더
- Hover 시 수직 확장 `scaleY(1.5)`

```css
input[type="range"]::-webkit-slider-runnable-track {
  height: 2px;
  background: linear-gradient(to right,
    var(--accent) 0%, var(--accent) var(--progress, 0%),
    var(--line) var(--progress, 0%), var(--line) 100%);
}
input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  height: 14px; width: 8px;
  background: var(--accent);
  margin-top: -6px;
  border: none; border-radius: 0;
  transition: transform 100ms ease;
}
input[type="range"]::-webkit-slider-thumb:hover {
  transform: scaleY(1.5);
}
```

### 7-4. Toggle Checkbox (사각 스위치)
브라우저 기본 형태가 아닌 14×14px 네모 상자. 체크 시 내부에 8×8px 작은 사각형이 나타남.
```css
input[type="checkbox"] {
  -webkit-appearance: none; appearance: none;
  width: 14px; height: 14px;
  border: 1px solid var(--line-strong);
  background: var(--bg);
  position: relative;
  transition: all 120ms ease;
}
input[type="checkbox"]:checked {
  background: var(--accent);
  border-color: var(--accent);
}
input[type="checkbox"]:checked::after {
  content: "";
  position: absolute;
  top: 2px; left: 2px;
  width: 8px; height: 8px;
  background: var(--accent-text);
}
```

### 7-5. 커스텀 스크롤바
브라우저 기본 스크롤바를 쓰지 않습니다. 얇고 각진 형태로 통일합니다.
```css
.scroll-area::-webkit-scrollbar { width: 6px; height: 6px; }
.scroll-area::-webkit-scrollbar-thumb {
  background: var(--line-strong);
  border-radius: 0;             /* 각진 형태 유지 */
}
.scroll-area::-webkit-scrollbar-thumb:hover { background: var(--accent); }
.scroll-area::-webkit-scrollbar-track {
  background: rgba(127, 127, 127, 0.05);
  border-left: 1px solid var(--line);
}
```

### 7-6. 커스텀 드롭다운
브라우저 네이티브 `<select>` 대신 `.dropdown` 컴포넌트를 사용합니다. 드롭다운 트리거 역시 카세트 버튼과 동일한 `clip-path` chamfer를 적용하여 일체감을 줍니다.

### 7-7. 에디토리얼 링크 (Inline Links)
출판물 같은 정밀한 밑줄 처리로 에디토리얼 느낌을 강화합니다.
```css
.inline-link {
  text-decoration-line: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 2px;
  text-decoration-color: currentColor;
  transition: opacity 120ms ease;
}
.inline-link:hover { opacity: 0.74; }
```

### 7-8. 헤드라인 장식 (Decorative Symbol & Micro-interaction)
주요 섹션의 타이틀(헤드라인) 텍스트 우측 상단에는 십자 모양(Cross)의 작은 SVG 장식을 배치하여 기술적이고 정밀한 타겟팅 시스템의 느낌을 강조할 수 있습니다. 이는 정적인 텍스트에 마이크로 인터랙션을 부여하여 기기 자체가 살아서 시스템을 스캐닝하는 듯한 생동감을 줍니다.

- **비율 및 위치**: 헤드라인 폰트 크기 기준 `0.5em` 정사각형. 텍스트의 상단(Ascender) 부근에 걸치도록 `top: -0.3em`, `marginLeft: 0.2em` 등으로 직관적인 어깨 글자(Superscript) 위치에 미세 정렬합니다.
- **애니메이션 패턴 (`4.5초` 주기 예시)**:
  - 평소에는 정지해 있다가 잠시 조준점을 맞추듯 움찔(`45deg`)하고, 이후 매우 빠른 속도로 스핀(`1125deg`)한 뒤 다시 안정(`1080deg`)을 찾는 회전 패턴을 무한 반복합니다.
  - 이처럼 물리적인 가감속(Ease)이 포함된 간헐적 스핀은 시선을 과도하게 뺏지 않으면서도 인터페이스의 기계적 해상도를 확 높여줍니다.

```tsx
import { motion } from "framer-motion";

export default function DecorativeSymbol() {
    return (
        <motion.span
            className="inline-block"
            style={{
                width: "0.5em", height: "0.5em",
                position: "relative",
                top: "-0.3em", marginLeft: "0.2em"
            }}
        >
            <motion.svg
                viewBox="0 0 100 100" fill="none"
                className="w-full h-full text-foreground"
                animate={{ rotate: [0, 0, 45, 1125, 1080, 1080] }}
                transition={{
                    duration: 4.5,
                    times: [0, 0.1, 0.2, 0.7, 0.9, 1],
                    ease: "easeInOut",
                    repeat: Infinity,
                    repeatDelay: 0.5
                }}
            >
                <line x1="50" y1="0" x2="50" y2="100" stroke="currentColor" strokeWidth="6" />
                <line x1="0" y1="50" x2="100" y2="50" stroke="currentColor" strokeWidth="6" />
            </motion.svg>
        </motion.span>
    );
}
```

---

## 8. 🧩 디자인 토큰 & 공통 규칙

### 8-1. 스페이싱 스케일
조밀한 도구 느낌을 위해 **4px 기반의 촘촘한 스케일**을 사용합니다.
- 주요 사용 값: `4px`, `6px`, `8px`, `10px`, `12px`, `16px`
- 패널 내부 패딩: `8px ~ 12px`
- 섹션 간 갭: `12px`

### 8-2. 트랜지션
모든 인터랙션의 기본 트랜지션 시간은 **`120ms ease`** 입니다. 이보다 느리면 도구답지 않고, 빠르면 변화가 인지되지 않습니다. 예외적으로 진행 막대의 채움에는 `200ms ease-out`을 씁니다.

### 8-3. 포커스 링 (Accessibility)
키보드 탐색 시 `:focus-visible` 상태에 1px 실선 아웃라인을 표시합니다.
```css
:focus-visible {
  outline: 1px solid var(--accent);
  outline-offset: 1px;
}
```

### 8-4. 비활성 상태 (Disabled)
비활성화된 요소는 `opacity: 0.4` + `cursor: not-allowed`로 통일합니다. 배경색이나 별도 비활성 색상을 만들지 않습니다.

### 8-5. 다국어 대응 (i18n)
- 브라우저 언어/로케일에 따라 UI 텍스트를 분기 처리합니다.
- 텍스트 길이 변화에도 레이아웃이 깨지지 않도록 `overflow: hidden; text-overflow: ellipsis` 등의 방어 처리를 항상 고려합니다.

---

## 9. 🗂️ 레이아웃 정책

- **와이어프레임 & 모듈형 구조**: 카드 UI 중심의 둥글둥글한 디자인을 탈피하고, 요소들을 명확하게 구획하는 격자/모듈형 레이아웃을 기본으로 합니다.
- **레이아웃 시프트 방지**: 동적 데이터 변화에도 UI가 덜컹거리지 않도록 "단단한 하드웨어 도구"처럼 영역의 크기가 묵직하게 유지되어야 합니다.
- **명확한 영역 분리**: 화면 구성 요소들은 각각 독립된 `.panel`로 감싸서 사용자가 역할을 즉각적으로 파악할 수 있도록 분리합니다.
- **모바일 뷰 최적화 (Stack & Hover 방어)**: 기본 디자인은 다중 패널이 병렬(Grid)로 나열된 데스크탑 환경에 깊이 최적화되어 있습니다. 따라서 모바일(`max-width`)에서는 panel 구조를 단일 열(Stack)로 자연스럽게 세로 배치해야 하며, 터치스크린 등 마우스가 없는 기기에서는 `scale(0.98)` 수축 등의 호버 효과가 잔류하지 않도록 `@media (hover: hover)` 미디어 쿼리로 인터랙션 분기 처리를 철저히 해야 합니다.

---

## 10. 🎯 LLM 프롬프트 요약 (Copy & Paste)

새 프로젝트에서 이 디자인 언어를 적용할 때, 아래 블록을 LLM에게 시스템 프롬프트로 제공하세요.

> **[Mastermind UI System 가이드라인]**
> 당신은 해당 웹 프로젝트를 '야차완 디자인 언어(Mastermind Design Language)'에 맞추어 작성해야 합니다.
> 1. **핵심 원칙**: "독일인 우주비행사가 디자인한 80년대 정밀 하이엔드 오디오 기기" 같은 느낌을 주세요. **정적 안정감 + 높은 사용성 + 빠른 작업 속도**가 최우선입니다. 과한 애니메이션, 화려한 그라데이션, 불필요한 호버 효과, `border-radius`로 둥글게 처리하는 것을 철저히 배제하세요.
> 2. **색상**: 모든 색상은 CSS Variables(`--bg`, `--panel-bg`, `--line`, `--line-strong`, `--text`, `--text-dim`, `--accent`, `--accent-text`, `--hover-bg`)로만 관리하세요. 유채색은 에러/위험 상태에만 예외적으로 허용합니다. Light/Dark/System 3모드를 지원하며 테마 전환은 즉시 반영되어야 합니다.
> 3. **레이아웃**: 모든 구성 단위를 `.panel`(`border: 1px solid var(--line-strong)`, blur 0의 `box-shadow: 4px 4px 0`)로 감싸 모듈화합니다. 패널 좌상단에 10×10px 사각 장식(::before)을 넣습니다. 패딩은 4~12px 스케일로 조밀하게. **내부 데이터가 변해도 레이아웃이 덜컹거리면 안 됩니다.** 모바일 환경에서는 다중 패널을 세로 열(Stack)로 배치하세요.
> 4. **배경**: body에 80px 간격 `linear-gradient` 그리드 라인을 깔고 `gridSlide` 애니메이션으로 천천히 좌측 이동시킵니다.
> 5. **타이포**: 수치/시간/진행률은 반드시 모노스페이스(`--font-mono`) 폰트를 사용합니다. 헤드라인은 `--font-headline`로 자간을 살짝 좁히세요. 폰트는 외부 CDN 아닌 woff2로 내재화합니다.
> 6. **인터랙션**: 버튼은 `clip-path`로 좌상단 모서리를 사선 절단(chamfer). `::before`(외곽)+`::after`(내부) 가상요소로 1px 테두리를 구현합니다. Hover 시 `scale(0.98)` 축소, Active 시 `scale(0.95)`. 모든 상태 시각화와 Hover 마이크로 인터랙션은 터치 기기를 방어하기 위해 `@media (hover: hover)` 처리하세요. 주요 헤드라인 텍스트 우상단에는 0.5em 크기의 십자(+) 기호를 배치할 수 있으며, 간헐적으로 빠르게 스핀하는 애니메이션을 넣어 기계적 디테일을 살립니다. 슬라이더 thumb은 8×14px 세로 직사각형(페이더)입니다.
> 7. **컴포넌트**: 브라우저 기본 `<select>`나 스크롤바 대신 커스텀 드롭다운(같은 chamfer 스타일)과 커스텀 스크롤바(6px, 각진 형태)를 사용하세요.
> 8. **공통 규칙**: 트랜지션은 `120ms ease`. 비활성 상태는 `opacity: 0.4`. 포커스 링은 `outline: 1px solid var(--accent)`. 링크 밑줄은 `thickness: 1px`, `underline-offset: 2px`.
> 9. **다국어/글로벌**: i18n 분기 처리를 처음부터 염두에 두고, 텍스트 길이 변화에도 UI가 무너지지 않도록 유연하게 설계하세요.
