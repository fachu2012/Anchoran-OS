/**
 * The old Anchoran OS bundled-app ids removed by the Anchoran App SDK
 * migration (see CHANGELOG) — every simple utility/game app that used
 * to ship inside Anchoran itself and now only exists as a standalone
 * Webstore plugin (individually, or fused with a couple of others
 * that shared its real purpose — see `movedTo`/`fusedWith`). Used by
 * `upgradeAppRemoval.ts` to detect a device crossing this migration
 * during an update (so it can warn before removing them) and by
 * `installedAppsStore.ts` to actually drop them from a persisted
 * installed-apps list that predates the migration, so a stale id
 * never reaches `WindowManager`'s `APP_COMPONENTS` lookup (which no
 * longer has an entry for any of these).
 */
export interface LegacyAppInfo {
  /** The old AppId this app used to have. */
  id: string;
  /** Its old display title, for the pre-update warning list. */
  title: string;
  /** The Webstore plugin id it now lives in. */
  movedToPluginId: string;
  /** The Webstore plugin's display title. */
  movedToPluginTitle: string;
}

export const LEGACY_APP_IDS: LegacyAppInfo[] = [
  { id: "calculator", title: "Calculator", movedToPluginId: "calculator", movedToPluginTitle: "Calculator" },
  { id: "chat", title: "Chat", movedToPluginId: "chat", movedToPluginTitle: "Chat" },
  { id: "pomodoro", title: "Pomodoro Timer", movedToPluginId: "pomodoro", movedToPluginTitle: "Pomodoro Timer" },
  { id: "qrCode", title: "QR Code", movedToPluginId: "qrcode", movedToPluginTitle: "QR Code" },
  { id: "snake", title: "Snake", movedToPluginId: "snake", movedToPluginTitle: "Snake" },
  { id: "game2048", title: "2048", movedToPluginId: "game2048", movedToPluginTitle: "2048" },
  { id: "ticTacToe", title: "Tic-Tac-Toe", movedToPluginId: "tictactoe", movedToPluginTitle: "Tic-Tac-Toe" },
  { id: "memoryMatch", title: "Memory Match", movedToPluginId: "memorymatch", movedToPluginTitle: "Memory Match" },
  { id: "checkers", title: "Checkers", movedToPluginId: "checkers", movedToPluginTitle: "Checkers" },
  { id: "connectFour", title: "Connect Four", movedToPluginId: "connectfour", movedToPluginTitle: "Connect Four" },
  { id: "minesweeper", title: "Minesweeper", movedToPluginId: "minesweeper", movedToPluginTitle: "Minesweeper" },
  { id: "sudoku", title: "Sudoku", movedToPluginId: "sudoku", movedToPluginTitle: "Sudoku" },
  { id: "solitaire", title: "Solitaire", movedToPluginId: "solitaire", movedToPluginTitle: "Solitaire" },
  { id: "chess", title: "Chess", movedToPluginId: "chess", movedToPluginTitle: "Chess" },
  { id: "calendar", title: "Calendar", movedToPluginId: "calendar", movedToPluginTitle: "Calendar" },
  { id: "kanban", title: "Kanban", movedToPluginId: "kanban", movedToPluginTitle: "Kanban" },
  { id: "habitTracker", title: "Habit Tracker", movedToPluginId: "habittracker", movedToPluginTitle: "Habit Tracker" },
  { id: "weather", title: "Weather", movedToPluginId: "weather", movedToPluginTitle: "Weather" },
  { id: "mindMap", title: "Mind Map", movedToPluginId: "mindmap", movedToPluginTitle: "Mind Map" },
  { id: "spreadsheet", title: "Spreadsheet", movedToPluginId: "spreadsheet", movedToPluginTitle: "Spreadsheet" },
  { id: "emojiPicker", title: "Emoji Picker", movedToPluginId: "emojipicker", movedToPluginTitle: "Emoji Picker" },
  { id: "typingTest", title: "Typing Test", movedToPluginId: "typingtest", movedToPluginTitle: "Typing Test" },
  { id: "ttsReader", title: "Text-to-Speech Reader", movedToPluginId: "ttsreader", movedToPluginTitle: "Text-to-Speech Reader" },
  { id: "clipboardManager", title: "Clipboard Manager", movedToPluginId: "clipboardmanager", movedToPluginTitle: "Clipboard Shelf" },
  { id: "zipTool", title: "Zip Tool", movedToPluginId: "ziptool", movedToPluginTitle: "Zip Tool" },
  { id: "colorPicker", title: "Color Picker", movedToPluginId: "colorpicker", movedToPluginTitle: "Color Picker" },
  { id: "clock", title: "Clock", movedToPluginId: "clock", movedToPluginTitle: "Clock" },
  { id: "magnifier", title: "Magnifier", movedToPluginId: "magnifier", movedToPluginTitle: "Magnifier" },
  // Fused into "Chance"
  { id: "diceRoller", title: "Dice Roller", movedToPluginId: "chance", movedToPluginTitle: "Chance" },
  { id: "coinFlip", title: "Coin Flip", movedToPluginId: "chance", movedToPluginTitle: "Chance" },
  // Fused into "Text Tools"
  { id: "jsonFormatter", title: "JSON Formatter", movedToPluginId: "text-tools", movedToPluginTitle: "Text Tools" },
  { id: "wordCounter", title: "Word Counter", movedToPluginId: "text-tools", movedToPluginTitle: "Text Tools" },
  { id: "textDiff", title: "Text Diff", movedToPluginId: "text-tools", movedToPluginTitle: "Text Tools" },
  // Fused into "Converter"
  { id: "converter", title: "Converter", movedToPluginId: "converter", movedToPluginTitle: "Converter" },
  { id: "currencyConverter", title: "Currency Converter", movedToPluginId: "converter", movedToPluginTitle: "Converter" },
  // Fused into "Password Tools"
  { id: "passwordGenerator", title: "Password Generator", movedToPluginId: "password-tools", movedToPluginTitle: "Password Tools" },
  { id: "passwordVault", title: "Password Vault", movedToPluginId: "password-tools", movedToPluginTitle: "Password Tools" },
  // Fused into "Recorder"
  { id: "screenRecorder", title: "Screen Recorder", movedToPluginId: "recorder", movedToPluginTitle: "Recorder" },
  { id: "voiceRecorder", title: "Voice Recorder", movedToPluginId: "recorder", movedToPluginTitle: "Recorder" },
  // Fused into "Draw Studio"
  { id: "paint", title: "Paint", movedToPluginId: "draw-studio", movedToPluginTitle: "Draw Studio" },
  { id: "pixelArt", title: "Pixel Art", movedToPluginId: "draw-studio", movedToPluginTitle: "Draw Studio" },
  // Fused into "Image Tools"
  { id: "screenshot", title: "Screenshot", movedToPluginId: "image-tools", movedToPluginTitle: "Image Tools" },
  { id: "wallpaperMaker", title: "Wallpaper Maker", movedToPluginId: "image-tools", movedToPluginTitle: "Image Tools" },
  // Fused into "Tasks & Reminders"
  { id: "todo", title: "To-Do List", movedToPluginId: "tasks-reminders", movedToPluginTitle: "Tasks & Reminders" },
  { id: "reminders", title: "Reminders", movedToPluginId: "tasks-reminders", movedToPluginTitle: "Tasks & Reminders" },
];

export const LEGACY_APP_ID_SET = new Set(LEGACY_APP_IDS.map((a) => a.id));

export function legacyAppInfo(id: string): LegacyAppInfo | undefined {
  return LEGACY_APP_IDS.find((a) => a.id === id);
}
