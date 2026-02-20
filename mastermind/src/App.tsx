import { QueuePanel } from "./features/queue/QueuePanel";
import { ABPlayerPanel } from "./features/player/ABPlayerPanel";
import { MasteringPanel } from "./features/mastering/MasteringPanel";
import { QueueProvider } from "./features/queue/QueueProvider";
import { useThemeMode } from "./shared/theme/useThemeMode";
import { Dropdown } from "./shared/ui/Dropdown";
import { TooltipLayer } from "./shared/ui/TooltipLayer";
import { useUiLocale } from "./shared/i18n/useUiLocale";
import { getUiTips } from "./shared/i18n/uiTips";

const themeOptions = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" }
];

export default function App() {
  const { mode, setMode, effectiveMode } = useThemeMode();
  const locale = useUiLocale();
  const tips = getUiTips(locale);

  return (
    <QueueProvider>
      <div className="app-shell">
        <header className="app-header">
          <div className="brand-wrap">
            <h1 className="brand-mark">MSTRMND</h1>
            <p className="brand-tagline">Mastermind: Your clever audio mastering ally.</p>
          </div>
          <div className="header-controls">
            <div
              className="theme-switch has-tooltip"
              data-tooltip={tips.common.themeMode}
            >
              <span>Theme</span>
              <Dropdown
                ariaLabel="Theme mode"
                value={mode}
                options={themeOptions}
                onChange={(next) => setMode(next as typeof mode)}
              />
            </div>
            <span className="meta-chip">Active: {effectiveMode}</span>
          </div>
        </header>

        <main className="app-main">
          <QueuePanel locale={locale} />
          <ABPlayerPanel locale={locale} />
          <MasteringPanel locale={locale} />
        </main>

        <footer className="app-credit">
          Made by.{" "}
          <a
            className="inline-link"
            href="https://heavyrain39.github.io/portfolio/"
            target="_blank"
            rel="noreferrer noopener"
          >
            Yakshawan
          </a>
        </footer>

        <TooltipLayer />
      </div>
    </QueueProvider>
  );
}
