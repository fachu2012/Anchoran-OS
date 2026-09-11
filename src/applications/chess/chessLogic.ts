export type PieceType = "p" | "n" | "b" | "r" | "q" | "k";
export type Color = "w" | "b";
export interface Piece {
  type: PieceType;
  color: Color;
}
export type Board = (Piece | null)[][]; // [row 0..7][col 0..7], row 0 = rank 8 (black back rank)

export function initialBoard(): Board {
  const back: PieceType[] = ["r", "n", "b", "q", "k", "b", "n", "r"];
  const board: Board = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let c = 0; c < 8; c++) {
    board[0][c] = { type: back[c], color: "b" };
    board[1][c] = { type: "p", color: "b" };
    board[6][c] = { type: "p", color: "w" };
    board[7][c] = { type: back[c], color: "w" };
  }
  return board;
}

function inBounds(r: number, c: number) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

const KNIGHT_DELTAS = [
  [1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1],
];
const KING_DELTAS = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
];
const BISHOP_DIRS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const ROOK_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Pseudo-legal moves for the piece at (r,c) — doesn't check for leaving own king in check. */
function pseudoMoves(board: Board, r: number, c: number): [number, number][] {
  const piece = board[r][c];
  if (!piece) return [];
  const pieceColor = piece.color;
  const moves: [number, number][] = [];

  function slide(dirs: number[][]) {
    for (const [dr, dc] of dirs) {
      let nr = r + dr;
      let nc = c + dc;
      while (inBounds(nr, nc)) {
        const target = board[nr][nc];
        if (!target) {
          moves.push([nr, nc]);
        } else {
          if (target.color !== pieceColor) moves.push([nr, nc]);
          break;
        }
        nr += dr;
        nc += dc;
      }
    }
  }

  if (piece.type === "p") {
    const dir = piece.color === "w" ? -1 : 1;
    const startRow = piece.color === "w" ? 6 : 1;
    if (inBounds(r + dir, c) && !board[r + dir][c]) {
      moves.push([r + dir, c]);
      if (r === startRow && !board[r + dir * 2][c]) moves.push([r + dir * 2, c]);
    }
    for (const dc of [-1, 1]) {
      const nr = r + dir;
      const nc = c + dc;
      if (inBounds(nr, nc) && board[nr][nc] && board[nr][nc]!.color !== piece.color) moves.push([nr, nc]);
    }
  } else if (piece.type === "n") {
    for (const [dr, dc] of KNIGHT_DELTAS) {
      const nr = r + dr;
      const nc = c + dc;
      if (inBounds(nr, nc) && (!board[nr][nc] || board[nr][nc]!.color !== piece.color)) moves.push([nr, nc]);
    }
  } else if (piece.type === "k") {
    for (const [dr, dc] of KING_DELTAS) {
      const nr = r + dr;
      const nc = c + dc;
      if (inBounds(nr, nc) && (!board[nr][nc] || board[nr][nc]!.color !== piece.color)) moves.push([nr, nc]);
    }
  } else if (piece.type === "b") {
    slide(BISHOP_DIRS);
  } else if (piece.type === "r") {
    slide(ROOK_DIRS);
  } else if (piece.type === "q") {
    slide([...BISHOP_DIRS, ...ROOK_DIRS]);
  }
  return moves;
}

function findKing(board: Board, color: Color): [number, number] | null {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.type === "k" && p.color === color) return [r, c];
    }
  return null;
}

export function isSquareAttacked(board: Board, r: number, c: number, byColor: Color): boolean {
  for (let sr = 0; sr < 8; sr++) {
    for (let sc = 0; sc < 8; sc++) {
      const piece = board[sr][sc];
      if (piece && piece.color === byColor) {
        if (pseudoMoves(board, sr, sc).some(([mr, mc]) => mr === r && mc === c)) return true;
      }
    }
  }
  return false;
}

export function isInCheck(board: Board, color: Color): boolean {
  const king = findKing(board, color);
  if (!king) return false;
  return isSquareAttacked(board, king[0], king[1], color === "w" ? "b" : "w");
}

function applyMove(board: Board, from: [number, number], to: [number, number]): Board {
  const next = board.map((row) => [...row]);
  const piece = next[from[0]][from[1]];
  next[to[0]][to[1]] = piece;
  next[from[0]][from[1]] = null;
  // Auto-queen promotion — no UI for underpromotion, matches most casual play.
  if (piece && piece.type === "p" && (to[0] === 0 || to[0] === 7)) {
    next[to[0]][to[1]] = { type: "q", color: piece.color };
  }
  return next;
}

/** Legal moves for the piece at (r,c): pseudo-legal minus any that leave its own king in check. */
export function legalMoves(board: Board, r: number, c: number): [number, number][] {
  const piece = board[r][c];
  if (!piece) return [];
  return pseudoMoves(board, r, c).filter(([tr, tc]) => {
    const next = applyMove(board, [r, c], [tr, tc]);
    return !isInCheck(next, piece.color);
  });
}

export function hasAnyLegalMove(board: Board, color: Color): boolean {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.color === color && legalMoves(board, r, c).length > 0) return true;
    }
  return false;
}

export function makeMove(board: Board, from: [number, number], to: [number, number]): Board {
  return applyMove(board, from, to);
}

export const PIECE_UNICODE: Record<Color, Record<PieceType, string>> = {
  w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
  b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" },
};
