import type { SVGProps } from "react";

/**
 * All Anchoran iconography is drawn here as inline stroke-based SVG
 * paths — a single consistent set (1.5px stroke, 24x24 grid), never
 * emoji, never raster. This keeps every icon on-brand and trivially
 * recolorable via currentColor / theme tokens.
 *
 * Icons whose final design is not yet defined are intentionally
 * simple/neutral placeholders and can be swapped here without
 * touching any call site.
 */
export type IconName =
  | "files"
  | "terminal"
  | "settings"
  | "notes"
  | "calculator"
  | "browser"
  | "systemMonitor"
  | "appCenter"
  | "launcher"
  | "power"
  | "lock"
  | "wifi"
  | "volume"
  | "battery"
  | "notification"
  | "search"
  | "close"
  | "minimize"
  | "maximize"
  | "restore"
  | "restart"
  | "chevronRight"
  | "folder"
  | "file"
  | "check"
  | "clock"
  | "converter"
  | "colorPicker"
  | "plus"
  | "copy"
  | "pin"
  | "chat"
  | "todo"
  | "pomodoro"
  | "qrCode"
  | "passwordGenerator"
  | "jsonFormatter"
  | "wordCounter"
  | "snake"
  | "game2048"
  | "ticTacToe"
  | "memoryMatch"
  | "diceRoller"
  | "coinFlip"
  | "connectFour"
  | "checkers"
  | "minesweeper"
  | "sudoku"
  | "typingTest"
  | "calendar"
  | "clipboardManager"
  | "kanban"
  | "textDiff"
  | "habitTracker"
  | "currencyConverter"
  | "weather"
  | "passwordVault"
  | "reminders"
  | "ttsReader"
  | "mindMap"
  | "solitaire"
  | "chess"
  | "paint"
  | "pixelArt"
  | "wallpaperMaker"
  | "photoViewer"
  | "screenshot"
  | "voiceRecorder"
  | "networkMonitor"
  | "eventViewer"
  | "mediaPlayer"
  | "zipTool"
  | "spreadsheet"
  | "magnifier"
  | "screenRecorder"
  | "document"
  | "pdfFile"
  | "presentation"
  | "ebook"
  | "email"
  | "vectorDesign"
  | "model3d"
  | "videoFile"
  | "audioFile"
  | "diskImage"
  | "executable"
  | "database"
  | "fontFile"
  | "gameRom"
  | "certificate"
  | "shortcut"
  | "subtitle"
  | "storageUsage"
  | "startupApps"
  | "emojiPicker"
  | "onScreenKeyboard"
  | "narrator"
  | "recycleBin"
  | "desktop"
  | "taskView"
  | "star";

const PATHS: Record<IconName, string> = {
  files:
    "M3 6.5A1.5 1.5 0 0 1 4.5 5h4l1.6 2H19.5A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-11Z",
  terminal: "M4 5.5h16v13H4v-13Zm3 4 3 2.5-3 2.5M12.5 14.5h4",
  settings:
    "M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Zm7.4-3.2a7.4 7.4 0 0 0-.13-1.38l1.86-1.45-1.86-3.22-2.2.62a7.5 7.5 0 0 0-2.39-1.38L14.3 3h-4.6l-.38 2.19a7.5 7.5 0 0 0-2.39 1.38l-2.2-.62-1.86 3.22 1.86 1.45c-.09.45-.13.9-.13 1.38s.04.93.13 1.38l-1.86 1.45 1.86 3.22 2.2-.62c.71.6 1.52 1.07 2.39 1.38L9.7 21h4.6l.38-2.19c.87-.31 1.68-.78 2.39-1.38l2.2.62 1.86-3.22-1.86-1.45c.09-.45.13-.9.13-1.38Z",
  notes: "M6 4.5h9l3 3v12H6v-15Zm9 0v3h3M8.5 12h7M8.5 15.5h7",
  calculator:
    "M6 3.5h12v17H6v-17Zm1.5 3h9M8 10h1.6M11.2 10h1.6M14.4 10h1.6M8 13h1.6M11.2 13h1.6M14.4 13v4M8 16h1.6M11.2 16h1.6",
  browser:
    "M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm-8-8h16M12 4c2 2.2 3 5 3 8s-1 5.8-3 8c-2-2.2-3-5-3-8s1-5.8 3-8Z",
  systemMonitor:
    "M4 5.5h16v10H4v-10Zm5 13.5h6M12 15.5V19M7 12.5l2.4-3.2 2 2.4 3-4",
  appCenter: "M5 5h5.5v5.5H5V5Zm8.5 0H19v5.5h-5.5V5ZM5 13.5h5.5V19H5v-5.5Zm8.5 0H19V19h-5.5v-5.5Z",
  launcher: "M4 6.5h16M4 12h16M4 17.5h16",
  power: "M12 4v7.5M7 6.6a7 7 0 1 0 10 0",
  lock: "M7 10.5V8a5 5 0 0 1 10 0v2.5M5.5 10.5h13v9h-13v-9ZM12 14.5v2.2",
  wifi: "M3.5 9.5a12.5 12.5 0 0 1 17 0M6.3 12.9a8.5 8.5 0 0 1 11.4 0M9.2 16.2a4.3 4.3 0 0 1 5.6 0M12 19.2h.01",
  volume: "M4.5 9.5h3.2L12 6v12l-4.3-3.5H4.5v-5Zm11 -1.8a5.5 5.5 0 0 1 0 8.6M17.7 5.5a9.5 9.5 0 0 1 0 13",
  battery: "M3.5 9h14v6h-14V9Zm14 1.5h1.8a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-1.8v-3ZM6 9v6",
  notification:
    "M12 4.5a5 5 0 0 0-5 5v3l-1.5 3h13L17 12.5v-3a5 5 0 0 0-5-5Zm-1.8 13a1.8 1.8 0 0 0 3.6 0",
  search: "M11 4.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm6.9 13.4L21 21",
  close: "M6 6l12 12M18 6 6 18",
  minimize: "M5 12.5h14",
  maximize: "M6.5 6.5h11v11h-11v-11Z",
  restore: "M8.5 4.5h11v11h-3M4.5 8.5h11v11h-11v-11Z",
  restart: "M18.5 8a6.5 6.5 0 1 0 1.3 5.5M18.5 4v4.5H14",
  chevronRight: "M9.5 5.5 16 12l-6.5 6.5",
  folder: "M3.5 7A1.5 1.5 0 0 1 5 5.5h4l1.6 2H19a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18V7Z",
  file: "M7 3.5h7l4 4v13H7v-17Zm7 0v4h4",
  check: "M5 12.5l4.5 4.5L19 7.5",
  clock: "M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm0-12v4.3l3 2",
  converter: "M6 8h11l-3-3M18 16H7l3 3",
  colorPicker:
    "M14.5 4.5 19 9l-8.3 8.3a2 2 0 0 1-1.3.6l-3.4.3.3-3.4a2 2 0 0 1 .6-1.3L14.5 4.5Zm2 2L20 3M5 21h4",
  plus: "M12 5.5v13M5.5 12h13",
  copy: "M8.5 8.5h10v10h-10v-10ZM5.5 5.5h10v3M5.5 5.5v10h3",
  pin: "M9 4.5h6l.8 5.2L19 13v2h-6v5l-1 2-1-2v-5H5v-2l3.2-3.3L9 4.5Z",
  chat: "M4.5 5.5h15v11h-8L7 20v-3.5H4.5v-11Z M8 10h8 M8 13h5",
  todo: "M5 6.5h14M5 12h14M5 17.5h14M4.2 6.5l.8.8 1.2-1.4M4.2 12l.8.8 1.2-1.4M4.2 17.5l.8.8 1.2-1.4",
  pomodoro: "M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm0-12v4l2.6 2.6M9 3h6",
  qrCode:
    "M4.5 4.5h6v6h-6v-6Zm9 0h6v6h-6v-6Zm-9 9h6v6h-6v-6Zm10.5-1.5h1.5v1.5M19.5 15h1v1M15 15h1.5v1.5M13.5 19.5h1v1M17 19.5h3v-3",
  passwordGenerator:
    "M7 12.5V9a5 5 0 0 1 10 0v3.5M5.5 12.5h13v8h-13v-8ZM12 16v1.8",
  jsonFormatter: "M8.5 4.5c-2 0-3 1-3 3v3l-2 1.5 2 1.5v3c0 2 1 3 3 3M15.5 4.5c2 0 3 1 3 3v3l2 1.5-2 1.5v3c0 2-1 3-3 3",
  wordCounter: "M4.5 5.5h15M4.5 10h15M4.5 14.5h9M4.5 19h6M17 14.5a2.5 2.5 0 1 1 2.5 2.5",
  snake: "M5 6.5h6a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h6M17 6.5h.01M17 4.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z",
  game2048: "M4.5 4.5h6.5v6.5H4.5v-6.5Zm9 0H19v6.5h-5.5v-6.5Zm-9 9H10v6.5H4.5v-6.5Zm9.5.5 4.5 5.5m0-5.5-4.5 5.5",
  ticTacToe: "M9 4.5v15M15 4.5v15M4.5 9h15M4.5 15h15M6 6.5l3 3M9 6.5l-3 3M15.5 15.5a2 2 0 1 0 4 0 2 2 0 0 0-4 0Z",
  memoryMatch: "M4.5 4.5h7v7h-7v-7Zm8 0h7v7h-7v-7Zm-8 8h7v7h-7v-7Zm8 0h7v7h-7v-7Z",
  diceRoller:
    "M5.5 5.5h13v13h-13v-13Zm3 3h.01M12 9h.01M15.5 8.5h.01M8.5 15.5h.01M12 15h.01M15.5 15.5h.01M8.5 12h.01M15.5 12h.01",
  coinFlip: "M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm0-11.5v7M9.2 10.2 12 8.5l2.8 1.7",
  connectFour:
    "M4 4.5h16v15H4v-15Zm3 3a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6Zm5 0a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6Zm5 4.5a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6Zm-5 4a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6Zm-5-2a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6Z",
  checkers:
    "M4 4.5h16v16H4v-16Zm4 4h.01M8 16h.01M16 8h.01M16 16h.01M6.5 6h3v3h-3v-3Zm8 8h3v3h-3v-3Z",
  minesweeper:
    "M12 4.5v2M12 17.5v2M4.5 12h2M17.5 12h2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Z",
  sudoku:
    "M4 4.5h16v16H4v-16Zm5.3 0v16M14.7 4.5v16M4 9.3h16M4 14.7h16M7 7l1.6 1.6M8.6 7 7 8.6",
  typingTest:
    "M4 6.5h16v11H4v-11Zm2.5 2.5h1.4M9.5 9h1.4M12.5 9h1.4M15.5 9h1.4M6.5 12h1.4M9.5 12h5M15.5 12h1.4M8 15h8",
  calendar: "M5 5.5h14v14H5v-14Zm0 4.5h14M8.5 3.5v4M15.5 3.5v4M8 14h1.5M11.5 14h1.5M15 14h1.5M8 17h1.5",
  clipboardManager:
    "M9 4.5h6v3H9v-3ZM6.5 6.5H8v2h8v-2h1.5v13h-11v-13Zm2 6h7M8.5 15.5h7M8.5 18h4.5",
  kanban: "M4.5 4.5h15v15h-15v-15Zm4 2v6M12 6.5v10M16 6.5v3.5",
  textDiff:
    "M5 5.5h7v5H5v-5Zm7 8h7v5h-7v-5ZM8.5 10.5V13M15.5 13v-2.5M9 7.5h1.5M14 15.5h1.5",
  habitTracker:
    "M4.5 5.5h4v4h-4v-4Zm6.75 0h4v4h-4v-4Zm6.75 0h4v4h-4v-4ZM4.5 12h4v4h-4v-4Zm6.75 0h4v4h-4v-4Zm6.75 0h4v4h-4v-4Z",
  currencyConverter:
    "M9 4.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Zm6 6a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9ZM9 7v5M7 9.3h4M15 12.7v5M13 15h4",
  weather:
    "M7.5 18a4 4 0 0 1-.6-7.95 5 5 0 0 1 9.7-1.7A3.8 3.8 0 0 1 17 18H7.5Z",
  passwordVault:
    "M12 3.5 19.5 6v6c0 4.5-3.2 7.6-7.5 8.5C7.7 19.6 4.5 16.5 4.5 12V6L12 3.5Zm0 5a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4ZM12 12v3",
  reminders:
    "M12 3.5v2M6 6.5l1.4 1.4M18 6.5l-1.4 1.4M12 20a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm0-11v4l2.6 1.6",
  ttsReader:
    "M4.5 9.5h3.2L12 6v12l-4.3-3.5H4.5v-5Zm11-1.8a5.5 5.5 0 0 1 0 8.6M17.7 5.5a9.5 9.5 0 0 1 0 13",
  mindMap:
    "M12 4.5a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4ZM6 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm12 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM12 8.9v5M12 13.9 7 17M12 13.9l5 3.1",
  solitaire:
    "M5 5.5h6v9H5v-9Zm8 4h6v9h-6v-9ZM8 7.8h.01M16.5 12.3h.01",
  chess:
    "M9 20.5h6M8 20.5c0-3 .8-4.5 1.6-6M16 20.5c0-3-.8-4.5-1.6-6M9.6 14.5c-.8-1.5-1-2.7-.3-4C10 9 12 9 12 7c0-1-1-1.3-1-2.2 0-.9.9-1.3 1-1.3s1 .4 1 1.3c0 .9-1 1.2-1 2.2 0 2 2 2 2.7 3.5.7 1.3.5 2.5-.3 4Z",
  paint:
    "M12 4.5C7.3 4.5 3.5 8 3.5 12.3c0 3.5 2.8 6.2 6.2 6.2h1c.7 0 1.3-.6 1.3-1.3 0-.3-.1-.6-.3-.9-.2-.2-.3-.5-.3-.8 0-.7.6-1.3 1.3-1.3h2.3c2.4 0 4.5-2 4.5-4.5 0-3-3-5.2-6.5-5.2Zm-5 6.3a1.1 1.1 0 1 1 0-2.2 1.1 1.1 0 0 1 0 2.2Zm3-3.3a1.1 1.1 0 1 1 0-2.2 1.1 1.1 0 0 1 0 2.2Zm4 0a1.1 1.1 0 1 1 0-2.2 1.1 1.1 0 0 1 0 2.2Zm3 3.3a1.1 1.1 0 1 1 0-2.2 1.1 1.1 0 0 1 0 2.2Z",
  pixelArt: "M4.5 4.5h5v5h-5v-5Zm10 0h5v5h-5v-5ZM4.5 14.5h5v5h-5v-5Zm5 -5h5v5h-5v-5Zm5 5h5v5h-5v-5Z",
  wallpaperMaker: "M4 5.5h16v13H4v-13Zm0 9 5-5 4 4 3-3 4 4",
  photoViewer:
    "M4.5 5.5h15v13h-15v-13Zm2.3 2.7a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8ZM6 16.5l4-4.5 3 3 2.5-3L18 16.5Z",
  screenshot:
    "M4.5 8V6.5a1.5 1.5 0 0 1 1.5-1.5H8M4.5 16v1.5A1.5 1.5 0 0 0 6 19h2M16 5.5h2A1.5 1.5 0 0 1 19.5 7v1.5M19.5 16V17.5A1.5 1.5 0 0 1 18 19h-2M8 12a4 4 0 1 0 8 0 4 4 0 0 0-8 0Z",
  voiceRecorder:
    "M12 4.5a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0v-5a3 3 0 0 0-3-3ZM7 11v1.5a5 5 0 0 0 10 0V11M12 17.5v2.5",
  networkMonitor:
    "M4.5 19h15M6.5 19v-5h3v5M11.5 19V9h3v10M16.5 19v-8h3v8",
  eventViewer:
    "M4.5 6.5h15v11h-15v-11Zm2.5 3h1.5M9.5 9.5h9M6.5 12.5h1.5M9.5 12.5h6M6.5 15.5h1.5M9.5 15.5h4",
  mediaPlayer: "M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm-2-4.5v-7l6 3.5-6 3.5Z",
  zipTool:
    "M9.5 3.5h5v3h-5v-3Zm0 3h5v3h-5v-3Zm0 3h5v3h-5v-3ZM6.5 12.5h11v8h-11v-8Zm4-9v3h2v-3",
  spreadsheet:
    "M4.5 4.5h15v15h-15v-15Zm0 5h15M4.5 14.5h15M9.5 4.5v15M14.5 4.5v15",
  magnifier:
    "M10.5 4.5a6 6 0 1 0 0 12 6 6 0 0 0 0-12Zm4.2 10.2L19.5 19.5M10.5 8v5M8 10.5h5",
  screenRecorder:
    "M4.5 6.5h11v11h-11v-11Zm11 3 4-2.5v7l-4-2.5M9 10.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z",
  document: "M7 3.5h7l4 4v13H7v-17Zm7 0v4h4M9 12h6M9 15h6M9 9h3",
  pdfFile: "M7 3.5h7l4 4v13H7v-17Zm7 0v4h4M8.5 17.5v-5h1.3a1.3 1.3 0 0 1 0 2.6H8.5m4-2.6v5m0-2.5h1.5m2-2.5v5h1.2a1.4 1.4 0 0 0 0-5H16",
  presentation: "M4 5.5h16v10H4v-10Zm4 14 4-4 4 4M12 15.5v4M9.5 9l2 2 3-3.5",
  ebook: "M4.5 6c2-1 5-1 7 0v13c-2-1-5-1-7 0V6Zm14 0c-2-1-5-1-7 0v13c2-1 5-1 7 0V6Z",
  email: "M4.5 6.5h15v11h-15v-11Zm0 0 7.5 6.5 7.5-6.5",
  vectorDesign: "M5 19 15 5l1.5 3.5L20 10 6 19Zm10-14a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6ZM6 19a1.2 1.2 0 1 0 0-2.4A1.2 1.2 0 0 0 6 19Z",
  model3d: "M12 3.5 4.5 8v8l7.5 4.5 7.5-4.5V8L12 3.5Zm0 0v9m0 9v-9m0 0L4.7 8.2M12 12.5l7.3-4.3",
  videoFile: "M7 3.5h7l4 4v13H7v-17Zm7 0v4h4M10.5 12v4l3.5-2-3.5-2Z",
  audioFile: "M7 3.5h7l4 4v13H7v-17Zm7 0v4h4M14 11v4.3a1.7 1.7 0 1 1-1-1.55V11h1ZM9.5 12h1",
  diskImage: "M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm0-5.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM4.5 12h3M16.5 12h3",
  executable: "M7 3.5h7l4 4v13H7v-17Zm7 0v4h4M10 11l2 2-2 2",
  database: "M12 5.2c3.6 0 6.5-1 6.5-1.7S15.6 1.8 12 1.8 5.5 2.8 5.5 3.5 8.4 5.2 12 5.2Zm6.5-1.7v13c0 .7-2.9 1.7-6.5 1.7s-6.5-1-6.5-1.7v-13M18.5 8.5c0 .7-2.9 1.7-6.5 1.7s-6.5-1-6.5-1.7M18.5 13c0 .7-2.9 1.7-6.5 1.7S5.5 13.7 5.5 13",
  fontFile: "M6 18.5 10.5 6h1.6L16.5 18.5M7.8 14h5.9M17 18.5v-6c0-1 .8-1.4 2-1.4.8 0 1.5.3 1.5.3",
  gameRom: "M6.5 9.5h11a3.5 3.5 0 0 1 3.3 4.7l-.5 1.4a2 2 0 0 1-3.5.5L15.5 14h-7l-1.3 2.1a2 2 0 0 1-3.5-.5l-.5-1.4A3.5 3.5 0 0 1 6.5 9.5Zm2 1.5v3M7 12.5h3M16.5 11.5h.01M18.5 13h.01",
  certificate: "M12 3.5 5 6.5v5.5c0 4.5 3 7 7 8.5 4-1.5 7-4 7-8.5V6.5L12 3.5Zm-2.8 8.3 2 2 4-4.3",
  shortcut: "M7 3.5h7l4 4v13H7v-17Zm7 0v4h4M11 17.5l4-4M15 13.5v3.3h-3.3",
  subtitle: "M4.5 6.5h15v11h-15v-11Zm3 3h3M13.5 9.5H17M7.5 13h2.5M13.5 13h4",
  storageUsage: "M4.5 20V6.5h6l2 2h7V20h-15Zm3-3.5V13m4 3.5v-6m4 6v-3",
  startupApps: "M12 4v9.5M8 9.5 12 13.5 16 9.5M5.5 15v4.5h13V15",
  emojiPicker: "M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm-3-9h.01M15 11h.01M8.5 14.5c1 1.3 2.2 2 3.5 2s2.5-.7 3.5-2",
  onScreenKeyboard: "M4 6.5h16v11H4v-11Zm2.5 2.5h1.4M9.5 9h1.4M12.5 9h1.4M15.5 9h1.4M6.5 12h1.4M9.5 12h5M15.5 12h1.4M8 15h8",
  narrator: "M12 4.5a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0v-5a3 3 0 0 0-3-3ZM7 11v1.5a5 5 0 0 0 10 0V11M12 17.5v2.5M8 21h8",
  recycleBin: "M6 7.5h12l-1 12.5H7L6 7.5Zm3-3h6l1 2H8l1-2ZM10 11v6M14 11v6",
  desktop: "M4 5.5h16v10H4v-10Zm5.5 14h5M12 15.5v4",
  taskView: "M4 5h9v6.5H4V5Zm11 2.5h5V15h-5V7.5ZM4 14h9v5H4v-5Z",
  star: "M12 3.5l2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.2 5.9-.8L12 3.5Z",
};

export function Icon({
  name,
  size = 20,
  strokeWidth = 1.6,
  ...rest
}: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
