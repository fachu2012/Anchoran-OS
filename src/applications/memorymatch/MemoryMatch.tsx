import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import "@/applications/apps.css";
import "./memorymatch.css";

const SYMBOLS = ["◆", "●", "■", "▲", "★", "✚", "◉", "◈"];

interface Card {
  id: number;
  symbol: string;
  flipped: boolean;
  matched: boolean;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function newDeck(): Card[] {
  const pairs = shuffle([...SYMBOLS, ...SYMBOLS]);
  return pairs.map((symbol, id) => ({ id, symbol, flipped: false, matched: false }));
}

export function MemoryMatchApp() {
  const [cards, setCards] = useState<Card[]>(newDeck);
  const [selected, setSelected] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [locked, setLocked] = useState(false);

  const won = useMemo(() => cards.every((c) => c.matched), [cards]);

  useEffect(() => {
    if (selected.length !== 2) return;
    setLocked(true);
    setMoves((m) => m + 1);
    const [a, b] = selected;
    const timer = window.setTimeout(() => {
      setCards((prev) => {
        const match = prev[a].symbol === prev[b].symbol;
        return prev.map((c, i) =>
          i === a || i === b ? { ...c, matched: match, flipped: match } : c
        );
      });
      setSelected([]);
      setLocked(false);
    }, 600);
    return () => window.clearTimeout(timer);
  }, [selected]);

  function flip(i: number) {
    if (locked || cards[i].flipped || cards[i].matched || selected.includes(i)) return;
    setCards((prev) => prev.map((c, idx) => (idx === i ? { ...c, flipped: true } : c)));
    setSelected((s) => [...s, i]);
  }

  function restart() {
    setCards(newDeck());
    setSelected([]);
    setMoves(0);
    setLocked(false);
  }

  return (
    <div className="app-root">
      <div className="app-toolbar">
        <button className="app-toolbar-btn" onClick={restart}>
          <Icon name="restart" size={14} /> New game
        </button>
        <div className="memory-moves">Moves: {moves}</div>
      </div>
      <div className="app-content memory-content">
        <div className="memory-board">
          {cards.map((card, i) => (
            <button
              key={card.id}
              className="memory-card"
              data-open={card.flipped || card.matched}
              data-matched={card.matched}
              onClick={() => flip(i)}
            >
              <span className="memory-card-face memory-card-front" />
              <span className="memory-card-face memory-card-back">{card.symbol}</span>
            </button>
          ))}
        </div>
        {won && <div className="memory-won">Solved in {moves} moves!</div>}
      </div>
    </div>
  );
}
