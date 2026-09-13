import { lazy, Suspense } from "react";
import { useWindowStore } from "./windowStore";
import { WindowFrame } from "./WindowFrame";
import type { AppId } from "@/core/types";

// Each app is its own lazy chunk: Anchoran's initial load only ships
// the desktop shell, not every application's code — an app's bundle
// is fetched the first time a window for it actually opens. Exported
// so App.tsx can preload a few of these chunks in the background for
// whichever apps are actually used most (see preloadFrequentApps.ts)
// — the first real open of one of those then never has to wait on the
// fetch, without shipping every app's code up front.
export const APP_COMPONENTS: Record<
  AppId,
  React.LazyExoticComponent<
    (props: { openPath?: string; startAdmin?: boolean; windowId?: string; embedPath?: string; pluginId?: string }) => JSX.Element
  >
> = {
  files: lazy(() => import("@/applications/files/Files").then((m) => ({ default: m.FilesApp }))),
  terminal: lazy(() => import("@/applications/terminal/Terminal").then((m) => ({ default: m.TerminalApp }))),
  settings: lazy(() => import("@/applications/settings/Settings").then((m) => ({ default: m.SettingsApp }))),
  notes: lazy(() => import("@/applications/notes/Notes").then((m) => ({ default: m.NotesApp }))),
  calculator: lazy(() => import("@/applications/calculator/Calculator").then((m) => ({ default: m.CalculatorApp }))),
  browser: lazy(() => import("@/applications/browser/Browser").then((m) => ({ default: m.BrowserApp }))),
  systemMonitor: lazy(() =>
    import("@/applications/systemmonitor/SystemMonitor").then((m) => ({ default: m.SystemMonitorApp }))
  ),
  appCenter: lazy(() => import("@/applications/appcenter/AppCenter").then((m) => ({ default: m.AppCenterApp }))),
  clock: lazy(() => import("@/applications/clock/Clock").then((m) => ({ default: m.ClockApp }))),
  converter: lazy(() => import("@/applications/converter/Converter").then((m) => ({ default: m.ConverterApp }))),
  colorPicker: lazy(() =>
    import("@/applications/colorpicker/ColorPicker").then((m) => ({ default: m.ColorPickerApp }))
  ),
  chat: lazy(() => import("@/applications/chat/Chat").then((m) => ({ default: m.ChatApp }))),
  todo: lazy(() => import("@/applications/todo/Todo").then((m) => ({ default: m.TodoApp }))),
  pomodoro: lazy(() => import("@/applications/pomodoro/Pomodoro").then((m) => ({ default: m.PomodoroApp }))),
  qrCode: lazy(() => import("@/applications/qrcode/QrCode").then((m) => ({ default: m.QrCodeApp }))),
  passwordGenerator: lazy(() =>
    import("@/applications/passwordgenerator/PasswordGenerator").then((m) => ({ default: m.PasswordGeneratorApp }))
  ),
  jsonFormatter: lazy(() =>
    import("@/applications/jsonformatter/JsonFormatter").then((m) => ({ default: m.JsonFormatterApp }))
  ),
  wordCounter: lazy(() =>
    import("@/applications/wordcounter/WordCounter").then((m) => ({ default: m.WordCounterApp }))
  ),
  snake: lazy(() => import("@/applications/snake/Snake").then((m) => ({ default: m.SnakeApp }))),
  game2048: lazy(() => import("@/applications/game2048/Game2048").then((m) => ({ default: m.Game2048App }))),
  ticTacToe: lazy(() => import("@/applications/tictactoe/TicTacToe").then((m) => ({ default: m.TicTacToeApp }))),
  memoryMatch: lazy(() =>
    import("@/applications/memorymatch/MemoryMatch").then((m) => ({ default: m.MemoryMatchApp }))
  ),
  diceRoller: lazy(() => import("@/applications/diceroller/DiceRoller").then((m) => ({ default: m.DiceRollerApp }))),
  coinFlip: lazy(() => import("@/applications/coinflip/CoinFlip").then((m) => ({ default: m.CoinFlipApp }))),
  connectFour: lazy(() =>
    import("@/applications/connectfour/ConnectFour").then((m) => ({ default: m.ConnectFourApp }))
  ),
  checkers: lazy(() => import("@/applications/checkers/Checkers").then((m) => ({ default: m.CheckersApp }))),
  minesweeper: lazy(() =>
    import("@/applications/minesweeper/Minesweeper").then((m) => ({ default: m.MinesweeperApp }))
  ),
  sudoku: lazy(() => import("@/applications/sudoku/Sudoku").then((m) => ({ default: m.SudokuApp }))),
  typingTest: lazy(() => import("@/applications/typingtest/TypingTest").then((m) => ({ default: m.TypingTestApp }))),
  calendar: lazy(() => import("@/applications/calendar/Calendar").then((m) => ({ default: m.CalendarApp }))),
  clipboardManager: lazy(() =>
    import("@/applications/clipboardmanager/ClipboardManager").then((m) => ({ default: m.ClipboardManagerApp }))
  ),
  kanban: lazy(() => import("@/applications/kanban/Kanban").then((m) => ({ default: m.KanbanApp }))),
  textDiff: lazy(() => import("@/applications/textdiff/TextDiff").then((m) => ({ default: m.TextDiffApp }))),
  habitTracker: lazy(() =>
    import("@/applications/habittracker/HabitTracker").then((m) => ({ default: m.HabitTrackerApp }))
  ),
  currencyConverter: lazy(() =>
    import("@/applications/currencyconverter/CurrencyConverter").then((m) => ({ default: m.CurrencyConverterApp }))
  ),
  weather: lazy(() => import("@/applications/weather/Weather").then((m) => ({ default: m.WeatherApp }))),
  passwordVault: lazy(() =>
    import("@/applications/passwordvault/PasswordVault").then((m) => ({ default: m.PasswordVaultApp }))
  ),
  reminders: lazy(() => import("@/applications/reminders/Reminders").then((m) => ({ default: m.RemindersApp }))),
  ttsReader: lazy(() => import("@/applications/ttsreader/TtsReader").then((m) => ({ default: m.TtsReaderApp }))),
  mindMap: lazy(() => import("@/applications/mindmap/MindMap").then((m) => ({ default: m.MindMapApp }))),
  solitaire: lazy(() => import("@/applications/solitaire/Solitaire").then((m) => ({ default: m.SolitaireApp }))),
  chess: lazy(() => import("@/applications/chess/Chess").then((m) => ({ default: m.ChessApp }))),
  paint: lazy(() => import("@/applications/paint/Paint").then((m) => ({ default: m.PaintApp }))),
  pixelArt: lazy(() => import("@/applications/pixelart/PixelArt").then((m) => ({ default: m.PixelArtApp }))),
  wallpaperMaker: lazy(() =>
    import("@/applications/wallpapermaker/WallpaperMaker").then((m) => ({ default: m.WallpaperMakerApp }))
  ),
  photoViewer: lazy(() =>
    import("@/applications/photoviewer/PhotoViewer").then((m) => ({ default: m.PhotoViewerApp }))
  ),
  screenshot: lazy(() => import("@/applications/screenshot/Screenshot").then((m) => ({ default: m.ScreenshotApp }))),
  voiceRecorder: lazy(() =>
    import("@/applications/voicerecorder/VoiceRecorder").then((m) => ({ default: m.VoiceRecorderApp }))
  ),
  networkMonitor: lazy(() =>
    import("@/applications/networkmonitor/NetworkMonitor").then((m) => ({ default: m.NetworkMonitorApp }))
  ),
  eventViewer: lazy(() =>
    import("@/applications/eventviewer/EventViewer").then((m) => ({ default: m.EventViewerApp }))
  ),
  mediaPlayer: lazy(() =>
    import("@/applications/mediaplayer/MediaPlayer").then((m) => ({ default: m.MediaPlayerApp }))
  ),
  zipTool: lazy(() => import("@/applications/ziptool/ZipTool").then((m) => ({ default: m.ZipToolApp }))),
  spreadsheet: lazy(() =>
    import("@/applications/spreadsheet/Spreadsheet").then((m) => ({ default: m.SpreadsheetApp }))
  ),
  magnifier: lazy(() => import("@/applications/magnifier/Magnifier").then((m) => ({ default: m.MagnifierApp }))),
  screenRecorder: lazy(() =>
    import("@/applications/screenrecorder/ScreenRecorder").then((m) => ({ default: m.ScreenRecorderApp }))
  ),
  storageUsage: lazy(() =>
    import("@/applications/storageusage/StorageUsage").then((m) => ({ default: m.StorageUsageApp }))
  ),
  startupApps: lazy(() =>
    import("@/applications/startupapps/StartupApps").then((m) => ({ default: m.StartupAppsApp }))
  ),
  emojiPicker: lazy(() =>
    import("@/applications/emojipicker/EmojiPicker").then((m) => ({ default: m.EmojiPickerApp }))
  ),
  codeRunner: lazy(() =>
    import("@/applications/coderunner/CodeRunner").then((m) => ({ default: m.CodeRunnerApp }))
  ),
  // Recycle Bin, On-Screen Keyboard and Narrator never open a window —
  // see windowStore.ts's openApp — these entries only exist to satisfy
  // APP_COMPONENTS' type and are never rendered.
  recycleBin: lazy(() => Promise.resolve({ default: () => <></> })),
  onScreenKeyboard: lazy(() => Promise.resolve({ default: () => <></> })),
  narrator: lazy(() => Promise.resolve({ default: () => <></> })),
  embeddedApp: lazy(() =>
    import("@/applications/embeddedapp/EmbeddedApp").then((m) => ({ default: m.EmbeddedApp }))
  ),
  anchover: lazy(() => import("@/applications/anchover/Anchover").then((m) => ({ default: m.AnchoverApp }))),
  releaseRanking: lazy(() =>
    import("@/applications/releaseranking/ReleaseRanking").then((m) => ({ default: m.ReleaseRankingApp }))
  ),
  pluginHost: lazy(() => import("@/applications/pluginhost/PluginHost").then((m) => ({ default: m.PluginHostApp }))),
};

function AppLoadingFallback() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
      <div style={{ width: 22, height: 22, border: "2px solid var(--anchoran-border)", borderTopColor: "var(--anchoran-accent)", borderRadius: "50%", animation: "spin 700ms linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export function WindowManager() {
  const windows = useWindowStore((s) => s.windows);
  const activeDesktopId = useWindowStore((s) => s.activeDesktopId);
  const snapPreview = useWindowStore((s) => s.snapPreview);
  // Only the active virtual desktop's windows are actually shown —
  // same principle as a minimized window not being rendered either.
  const visibleWindows = windows.filter((w) => w.desktopId === activeDesktopId);

  return (
    <div className="wm-layer">
      {visibleWindows.map((win) => {
        const AppComponent = APP_COMPONENTS[win.appId];
        return (
          <WindowFrame key={win.windowId} win={win}>
            <Suspense fallback={<AppLoadingFallback />}>
              <AppComponent
                openPath={win.openPath}
                startAdmin={win.startAdmin}
                windowId={win.windowId}
                embedPath={win.embedPath}
                pluginId={win.pluginId}
              />
            </Suspense>
          </WindowFrame>
        );
      })}
      {snapPreview && (
        <div
          className="wm-snap-preview"
          style={{
            left: snapPreview.x,
            top: snapPreview.y,
            width: snapPreview.width,
            height: snapPreview.height,
          }}
        />
      )}
    </div>
  );
}
