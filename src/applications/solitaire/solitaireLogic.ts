export type Suit = "S" | "H" | "D" | "C";
export interface Card {
  id: string;
  rank: number; // 1 (Ace) .. 13 (King)
  suit: Suit;
  faceUp: boolean;
}

export const SUITS: Suit[] = ["S", "H", "D", "C"];
export const RANK_LABEL: Record<number, string> = { 1: "A", 11: "J", 12: "Q", 13: "K" };

export function rankLabel(rank: number): string {
  return RANK_LABEL[rank] ?? String(rank);
}

export function isRed(suit: Suit): boolean {
  return suit === "H" || suit === "D";
}

export function newShuffledDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({ id: `${suit}${rank}`, rank, suit, faceUp: false });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function canStackTableau(moving: Card, onto: Card | undefined): boolean {
  if (!onto) return moving.rank === 13;
  return onto.faceUp && isRed(onto.suit) !== isRed(moving.suit) && onto.rank === moving.rank + 1;
}

export function canStackFoundation(moving: Card, onto: Card | undefined, suit: Suit): boolean {
  if (moving.suit !== suit) return false;
  if (!onto) return moving.rank === 1;
  return onto.rank === moving.rank - 1;
}
