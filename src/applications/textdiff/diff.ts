export type DiffOp = "equal" | "add" | "remove";
export interface DiffLine {
  op: DiffOp;
  text: string;
}

/** A standard LCS-based line diff — good enough for pasted text, not optimized for huge files. */
export function diffLines(a: string, b: string): DiffLine[] {
  const linesA = a.split("\n");
  const linesB = b.split("\n");
  const n = linesA.length;
  const m = linesB.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = linesA[i] === linesB[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const result: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (linesA[i] === linesB[j]) {
      result.push({ op: "equal", text: linesA[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      result.push({ op: "remove", text: linesA[i] });
      i++;
    } else {
      result.push({ op: "add", text: linesB[j] });
      j++;
    }
  }
  while (i < n) {
    result.push({ op: "remove", text: linesA[i] });
    i++;
  }
  while (j < m) {
    result.push({ op: "add", text: linesB[j] });
    j++;
  }
  return result;
}
