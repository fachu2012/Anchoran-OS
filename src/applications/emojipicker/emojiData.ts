/** A curated, compact emoji set grouped by category — not the full Unicode range, but enough to cover everyday use without bloating the bundle. */
export const EMOJI_CATEGORIES: { label: string; emoji: string[] }[] = [
  {
    label: "Smileys",
    emoji: ["😀", "😁", "😂", "🤣", "😊", "😍", "😘", "😜", "🤔", "😎", "🙂", "🙃", "😉", "😢", "😭", "😡", "😱", "🥳", "🤯", "🥺", "😴", "🤒", "🤗", "😇"],
  },
  {
    label: "Gestures & People",
    emoji: ["👍", "👎", "👌", "✌️", "🤞", "👏", "🙌", "🙏", "💪", "👋", "🤝", "👀", "🧠", "💀", "👶", "🧑", "👨", "👩", "🧓", "🕺", "💃"],
  },
  {
    label: "Animals & Nature",
    emoji: ["🐶", "🐱", "🐭", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐸", "🐵", "🐔", "🐦", "🐟", "🐢", "🌵", "🌲", "🌸", "🌞", "🌙", "⭐", "🔥", "❄️"],
  },
  {
    label: "Food & Drink",
    emoji: ["🍎", "🍌", "🍕", "🍔", "🍟", "🌮", "🍣", "🍩", "🍰", "🍫", "☕", "🍺", "🍷", "🥤", "🍿", "🥑", "🍉", "🍇"],
  },
  {
    label: "Activities & Objects",
    emoji: ["⚽", "🏀", "🎮", "🎧", "🎸", "🎨", "📷", "💡", "📱", "💻", "⌚", "🔑", "🔒", "📦", "✉️", "📅", "📌", "🔍", "🛠️", "💰"],
  },
  {
    label: "Symbols",
    emoji: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💯", "✅", "❌", "⚡", "⚠️", "❓", "❗", "♻️", "🔁", "🎉", "✨", "🚀"],
  },
];
