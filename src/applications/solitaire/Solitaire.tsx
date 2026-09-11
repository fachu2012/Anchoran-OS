import { useCallback, useState } from "react";
import { Icon } from "@/components/Icon";
import {
  newShuffledDeck,
  canStackTableau,
  canStackFoundation,
  isRed,
  rankLabel,
  SUITS,
  type Card,
  type Suit,
} from "./solitaireLogic";
import "@/applications/apps.css";
import "./solitaire.css";

const SUIT_SYMBOL: Record<Suit, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };

interface Selection {
  source: "tableau" | "waste";
  columnIndex?: number;
  cardIndex?: number;
}

function dealNewGame() {
  const deck = newShuffledDeck();
  const tableau: Card[][] = Array.from({ length: 7 }, () => []);
  let cursor = 0;
  for (let col = 0; col < 7; col++) {
    for (let row = 0; row <= col; row++) {
      const card = deck[cursor++];
      tableau[col].push({ ...card, faceUp: row === col });
    }
  }
  const stock = deck.slice(cursor).map((c) => ({ ...c, faceUp: false }));
  return { tableau, stock, waste: [] as Card[], foundations: { S: [], H: [], D: [], C: [] } as Record<Suit, Card[]> };
}

export function SolitaireApp() {
  const [state, setState] = useState(dealNewGame);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [won, setWon] = useState(false);

  const restart = useCallback(() => {
    setState(dealNewGame());
    setSelection(null);
    setWon(false);
  }, []);

  function checkWin(foundations: Record<Suit, Card[]>) {
    return SUITS.every((s) => foundations[s].length === 13);
  }

  function drawStock() {
    setState((s) => {
      if (s.stock.length === 0) {
        return { ...s, stock: s.waste.map((c) => ({ ...c, faceUp: false })).reverse(), waste: [] };
      }
      const card = { ...s.stock[s.stock.length - 1], faceUp: true };
      return { ...s, stock: s.stock.slice(0, -1), waste: [...s.waste, card] };
    });
  }

  function selectedCards(): Card[] | null {
    if (!selection) return null;
    if (selection.source === "waste") {
      const top = state.waste[state.waste.length - 1];
      return top ? [top] : null;
    }
    const col = state.tableau[selection.columnIndex!];
    return col.slice(selection.cardIndex!);
  }

  function clearSourceAfterMove() {
    if (!selection) return (s: typeof state) => s;
    if (selection.source === "waste") {
      return (s: typeof state) => ({ ...s, waste: s.waste.slice(0, -1) });
    }
    const colIndex = selection.columnIndex!;
    const cardIndex = selection.cardIndex!;
    return (s: typeof state) => {
      const col = s.tableau[colIndex].slice(0, cardIndex);
      if (col.length > 0) col[col.length - 1] = { ...col[col.length - 1], faceUp: true };
      const tableau = s.tableau.map((c, i) => (i === colIndex ? col : c));
      return { ...s, tableau };
    };
  }

  function moveToTableau(targetCol: number) {
    const moving = selectedCards();
    if (!moving) return;
    const dest = state.tableau[targetCol];
    if (!canStackTableau(moving[0], dest[dest.length - 1])) return;
    const removeSource = clearSourceAfterMove();
    setState((s) => {
      const next = removeSource(s);
      const tableau = next.tableau.map((c, i) => (i === targetCol ? [...c, ...moving] : c));
      return { ...next, tableau };
    });
    setSelection(null);
  }

  function moveToFoundation(suit: Suit) {
    const moving = selectedCards();
    if (!moving || moving.length !== 1) return;
    const dest = state.foundations[suit];
    if (!canStackFoundation(moving[0], dest[dest.length - 1], suit)) return;
    const removeSource = clearSourceAfterMove();
    setState((s) => {
      const next = removeSource(s);
      const foundations = { ...next.foundations, [suit]: [...dest, moving[0]] };
      if (checkWin(foundations)) setWon(true);
      return { ...next, foundations };
    });
    setSelection(null);
  }

  function onTableauCardClick(colIndex: number, cardIndex: number) {
    const col = state.tableau[colIndex];
    const card = col[cardIndex];
    if (!card.faceUp) {
      if (cardIndex === col.length - 1) {
        setState((s) => {
          const next = s.tableau.map((c, i) =>
            i === colIndex ? c.map((cc, ci) => (ci === cardIndex ? { ...cc, faceUp: true } : cc)) : c
          );
          return { ...s, tableau: next };
        });
      }
      return;
    }
    if (selection) {
      moveToTableau(colIndex);
      return;
    }
    setSelection({ source: "tableau", columnIndex: colIndex, cardIndex });
  }

  function onWasteClick() {
    if (state.waste.length === 0) return;
    setSelection(selection?.source === "waste" ? null : { source: "waste" });
  }

  return (
    <div className="app-root">
      <div className="app-toolbar">
        <button className="app-toolbar-btn" onClick={restart}>
          <Icon name="restart" size={14} /> New game
        </button>
        {won && <span style={{ color: "var(--anchoran-accent)", fontSize: 13 }}>You won!</span>}
      </div>
      <div className="app-content solitaire-content">
        <div className="solitaire-top-row">
          <div className="solitaire-pile" onClick={drawStock} data-empty={state.stock.length === 0}>
            {state.stock.length > 0 ? <div className="solitaire-card solitaire-card-back" /> : <Icon name="restart" size={16} />}
          </div>
          <div className="solitaire-pile" onClick={onWasteClick}>
            {state.waste.length > 0 && (
              <div className="solitaire-card" data-selected={selection?.source === "waste"} data-red={isRed(state.waste[state.waste.length - 1].suit)}>
                {rankLabel(state.waste[state.waste.length - 1].rank)}
                {SUIT_SYMBOL[state.waste[state.waste.length - 1].suit]}
              </div>
            )}
          </div>
          <div className="solitaire-spacer" />
          {SUITS.map((suit) => (
            <div key={suit} className="solitaire-pile" onClick={() => moveToFoundation(suit)}>
              {state.foundations[suit].length > 0 ? (
                <div className="solitaire-card" data-red={isRed(suit)}>
                  {rankLabel(state.foundations[suit][state.foundations[suit].length - 1].rank)}
                  {SUIT_SYMBOL[suit]}
                </div>
              ) : (
                <span className="solitaire-foundation-placeholder">{SUIT_SYMBOL[suit]}</span>
              )}
            </div>
          ))}
        </div>
        <div className="solitaire-tableau">
          {state.tableau.map((col, colIndex) => (
            <div key={colIndex} className="solitaire-column" onClick={() => col.length === 0 && moveToTableau(colIndex)}>
              {col.map((card, cardIndex) => (
                <div
                  key={card.id}
                  className="solitaire-card solitaire-stacked"
                  data-back={!card.faceUp}
                  data-red={card.faceUp && isRed(card.suit)}
                  data-selected={
                    selection?.source === "tableau" &&
                    selection.columnIndex === colIndex &&
                    cardIndex >= (selection.cardIndex ?? 0)
                  }
                  style={{ top: cardIndex * 22 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTableauCardClick(colIndex, cardIndex);
                  }}
                >
                  {card.faceUp && (
                    <>
                      {rankLabel(card.rank)}
                      {SUIT_SYMBOL[card.suit]}
                    </>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
