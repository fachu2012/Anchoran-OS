/**
 * A tiny, dependency-free formula engine — no `eval()`. Supports cell
 * references (A1, B2…), +, -, *, /, parentheses, and SUM(range).
 * Deliberately small in scope: this is a lightweight spreadsheet, not
 * a full Excel-compatible engine.
 */

export type Grid = Record<string, string>; // "A1" -> raw cell text (may start with "=")

function colToIndex(col: string): number {
  let n = 0;
  for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export function cellId(row: number, col: number): string {
  let c = col + 1;
  let letters = "";
  while (c > 0) {
    const rem = (c - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    c = Math.floor((c - 1) / 26);
  }
  return `${letters}${row + 1}`;
}

function parseRange(ref: string): string[] {
  const [start, end] = ref.split(":");
  if (!end) return [start];
  const m1 = start.match(/^([A-Z]+)(\d+)$/i);
  const m2 = end.match(/^([A-Z]+)(\d+)$/i);
  if (!m1 || !m2) return [];
  const c1 = colToIndex(m1[1].toUpperCase());
  const r1 = Number(m1[2]) - 1;
  const c2 = colToIndex(m2[1].toUpperCase());
  const r2 = Number(m2[2]) - 1;
  const ids: string[] = [];
  for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) {
    for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) {
      ids.push(cellId(r, c));
    }
  }
  return ids;
}

class Parser {
  pos = 0;
  constructor(private src: string) {}

  peek() {
    return this.src[this.pos];
  }
  next() {
    return this.src[this.pos++];
  }
  skipSpace() {
    while (this.peek() === " ") this.pos++;
  }

  parseExpr(): number {
    let value = this.parseTerm();
    this.skipSpace();
    while (this.peek() === "+" || this.peek() === "-") {
      const op = this.next();
      const rhs = this.parseTerm();
      value = op === "+" ? value + rhs : value - rhs;
      this.skipSpace();
    }
    return value;
  }

  parseTerm(): number {
    let value = this.parseFactor();
    this.skipSpace();
    while (this.peek() === "*" || this.peek() === "/") {
      const op = this.next();
      const rhs = this.parseFactor();
      value = op === "*" ? value * rhs : value / rhs;
      this.skipSpace();
    }
    return value;
  }

  parseFactor(): number {
    this.skipSpace();
    if (this.peek() === "-") {
      this.next();
      return -this.parseFactor();
    }
    if (this.peek() === "(") {
      this.next();
      const value = this.parseExpr();
      this.skipSpace();
      if (this.peek() === ")") this.next();
      return value;
    }
    this.skipSpace();
    const match = this.src.slice(this.pos).match(/^-?\d+(\.\d+)?/);
    if (match) {
      this.pos += match[0].length;
      return Number(match[0]);
    }
    return 0;
  }
}

export function evaluateFormula(raw: string, grid: Grid, seen: Set<string> = new Set()): number | string {
  if (!raw.startsWith("=")) {
    const n = Number(raw);
    return raw.trim() === "" ? "" : Number.isNaN(n) ? raw : n;
  }
  let expr = raw.slice(1).toUpperCase();

  const sumMatch = expr.match(/^SUM\((.+)\)$/);
  if (sumMatch) {
    const ids = parseRange(sumMatch[1]);
    return ids.reduce((total, id) => {
      const v = resolveCell(id, grid, seen);
      return total + (typeof v === "number" ? v : 0);
    }, 0);
  }

  expr = expr.replace(/[A-Z]+\d+/g, (ref) => {
    const v = resolveCell(ref, grid, seen);
    return String(typeof v === "number" ? v : 0);
  });

  try {
    return new Parser(expr).parseExpr();
  } catch {
    return "#ERR";
  }
}

function resolveCell(id: string, grid: Grid, seen: Set<string>): number | string {
  if (seen.has(id)) return "#CYCLE";
  const raw = grid[id];
  if (!raw) return "";
  const nextSeen = new Set(seen).add(id);
  return evaluateFormula(raw, grid, nextSeen);
}

export function displayValue(raw: string | undefined, grid: Grid): string {
  if (!raw) return "";
  const v = evaluateFormula(raw, grid);
  return v === "" ? "" : String(v);
}
