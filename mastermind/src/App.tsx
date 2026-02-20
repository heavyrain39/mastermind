import { FiSun, FiMoon, FiMonitor } from "react-icons/fi";
import { QueuePanel } from "./features/queue/QueuePanel";
import { ABPlayerPanel } from "./features/player/ABPlayerPanel";
import { MasteringPanel } from "./features/mastering/MasteringPanel";
import { QueueProvider } from "./features/queue/QueueProvider";
import { useThemeMode } from "./shared/theme/useThemeMode";
import { TooltipLayer } from "./shared/ui/TooltipLayer";
import { useUiLocale } from "./shared/i18n/useUiLocale";
import { getUiTips } from "./shared/i18n/uiTips";
import { VisualizerCard } from "./features/mastering/VisualizerCard";

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
          </div>
          <div className="header-controls">
            <div className="theme-toggles">
              <button
                type="button"
                className={`icon-btn ${mode === "light" ? "is-active" : ""}`}
                onClick={() => setMode("light")}
                aria-label="Light theme"
                title="Light theme"
              ><FiSun aria-hidden /></button>
              <button
                type="button"
                className={`icon-btn ${mode === "dark" ? "is-active" : ""}`}
                onClick={() => setMode("dark")}
                aria-label="Dark theme"
                title="Dark theme"
              ><FiMoon aria-hidden /></button>
              <button
                type="button"
                className={`icon-btn ${mode === "system" ? "is-active" : ""}`}
                onClick={() => setMode("system")}
                aria-label="System theme"
                title="System theme"
              ><FiMonitor aria-hidden /></button>
            </div>
          </div>
        </header>

        <main className="app-main">
          <QueuePanel locale={locale} />
          <ABPlayerPanel locale={locale} />
          <aside className="right-column">
            <VisualizerCard />
            <MasteringPanel locale={locale} />
          </aside>
        </main>

        <TooltipLayer />
      </div>
    </QueueProvider>
  );
}
