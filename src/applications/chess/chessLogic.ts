export type PieceType = "p" | "n" | "b" | "r" | "q" | "k";
export type Color = "w" | "b";
export interface Piece {
  type: PieceType;
  color: Color;
}
export type Board = (Piece | null)[][]; // [row 0..7][col 0..7], row 0 = rank 8 (black back rank)

/** Whether each side has castling rights left on each wing — cleared once a king or that wing's rook has moved or been captured. */
export interface CastlingRights {
  wK: boolean;
  wQ: boolean;
  bK: boolean;
  bQ: boolean;
}

export function initialCastlingRights(): CastlingRights {
  return { wK: true, wQ: true, bK: true, bQ: true };
}

/** The square a pawn can capture into via en passant this move only, or null. */
export type EnPassantTarget = [number, number] | null;

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

/**
 * Pseudo-legal moves for the piece at (r,c) — doesn't check for
 * leaving own king in check, and doesn't include castling (that's
 * handled separately in legalMoves, since it needs to check squares
 * for check along the way rather than just occupancy).
 */
function pseudoMoves(board: Board, r: number, c: number, enPassant: EnPassantTarget = null): [number, number][] {
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
      if (!inBounds(nr, nc)) continue;
      if (board[nr][nc] && board[nr][nc]!.color !== piece.color) moves.push([nr, nc]);
      else if (enPassant && enPassant[0] === nr && enPassant[1] === nc) moves.push([nr, nc]);
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

/** Castling destinations for the king at (r,c) — kingside/queenside, only when rights allow, the path is clear, and the king isn't in, through, or landing in check. */
function castlingMoves(board: Board, r: number, c: number, color: Color, rights: CastlingRights): [number, number][] {
  const moves: [number, number][] = [];
  const homeRow = color === "w" ? 7 : 0;
  if (r !== homeRow || c !== 4) return moves;
  const opponent = color === "w" ? "b" : "w";
  if (isSquareAttacked(board, r, c, opponent)) return moves; // can't castle out of check

  const kingSideRight = color === "w" ? rights.wK : rights.bK;
  if (kingSideRight && !board[r][5] && !board[r][6] && board[r][7]?.type === "r" && board[r][7]?.color === color) {
    if (!isSquareAttacked(board, r, 5, opponent) && !isSquareAttacked(board, r, 6, opponent)) {
      moves.push([r, 6]);
    }
  }
  const queenSideRight = color === "w" ? rights.wQ : rights.bQ;
  if (
    queenSideRight &&
    !board[r][3] &&
    !board[r][2] &&
    !board[r][1] &&
    board[r][0]?.type === "r" &&
    board[r][0]?.color === color
  ) {
    if (!isSquareAttacked(board, r, 3, opponent) && !isSquareAttacked(board, r, 2, opponent)) {
      moves.push([r, 2]);
    }
  }
  return moves;
}

function applyMove(board: Board, from: [number, number], to: [number, number], enPassant: EnPassantTarget = null): Board {
  const next = board.map((row) => [...row]);
  const piece = next[from[0]][from[1]];
  const isEnPassantCapture =
    !!piece && piece.type === "p" && from[1] !== to[1] && !board[to[0]][to[1]] && !!enPassant && enPassant[0] === to[0] && enPassant[1] === to[1];
  next[to[0]][to[1]] = piece;
  next[from[0]][from[1]] = null;
  if (isEnPassantCapture) {
    // The captured pawn sits beside the capturer, not on the landing square.
    next[from[0]][to[1]] = null;
  }
  // Auto-queen promotion — no UI for underpromotion, matches most casual play.
  if (piece && piece.type === "p" && (to[0] === 0 || to[0] === 7)) {
    next[to[0]][to[1]] = { type: "q", color: piece.color };
  }
  // Castling: the king move above is already applied; also relocate its rook.
  if (piece && piece.type === "k" && Math.abs(to[1] - from[1]) === 2) {
    const row = from[0];
    if (to[1] === 6) {
      next[row][5] = next[row][7];
      next[row][7] = null;
    } else if (to[1] === 2) {
      next[row][3] = next[row][0];
      next[row][0] = null;
    }
  }
  return next;
}

/** Legal moves for the piece at (r,c): pseudo-legal (plus castling for the king) minus any that leave its own king in check. */
export function legalMoves(
  board: Board,
  r: number,
  c: number,
  castling: CastlingRights = initialCastlingRights(),
  enPassant: EnPassantTarget = null
): [number, number][] {
  const piece = board[r][c];
  if (!piece) return [];
  const candidates = [...pseudoMoves(board, r, c, enPassant), ...(piece.type === "k" ? castlingMoves(board, r, c, piece.color, castling) : [])];
  return candidates.filter(([tr, tc]) => {
    const next = applyMove(board, [r, c], [tr, tc], enPassant);
    return !isInCheck(next, piece.color);
  });
}

export function hasAnyLegalMove(
  board: Board,
  color: Color,
  castling: CastlingRights = initialCastlingRights(),
  enPassant: EnPassantTarget = null
): boolean {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.color === color && legalMoves(board, r, c, castling, enPassant).length > 0) return true;
    }
  return false;
}

export function makeMove(board: Board, from: [number, number], to: [number, number], enPassant: EnPassantTarget = null): Board {
  return applyMove(board, from, to, enPassant);
}

/** Castling rights and en passant target to carry forward after a move — call with the state *before* the move. */
export function nextCastlingRights(rights: CastlingRights, board: Board, from: [number, number], to: [number, number]): CastlingRights {
  const next = { ...rights };
  const piece = board[from[0]][from[1]];
  const clearFor = (pos: [number, number]) => {
    const [r, c] = pos;
    if (r === 7 && c === 4) {
      next.wK = false;
      next.wQ = false;
    } else if (r === 0 && c === 4) {
      next.bK = false;
      next.bQ = false;
    } else if (r === 7 && c === 7) next.wK = false;
    else if (r === 7 && c === 0) next.wQ = false;
    else if (r === 0 && c === 7) next.bK = false;
    else if (r === 0 && c === 0) next.bQ = false;
  };
  if (piece) clearFor(from);
  clearFor(to); // capturing a corner rook also removes that side's rights
  return next;
}

export function nextEnPassantTarget(board: Board, from: [number, number], to: [number, number]): EnPassantTarget {
  const piece = board[from[0]][from[1]];
  if (piece && piece.type === "p" && Math.abs(to[0] - from[0]) === 2) {
    return [(from[0] + to[0]) / 2, from[1]];
  }
  return null;
}

export const PIECE_UNICODE: Record<Color, Record<PieceType, string>> = {
  w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
  b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" },
};
