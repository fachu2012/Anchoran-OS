import { useEffect, useState } from "react";
import { persistGet, persistSet } from "@/core/persist";
import { cellId, displayValue, type Grid } from "./formula";
import "@/applications/apps.css";
import "./spreadsheet.css";

const ROWS = 30;
const COLS = 12;
const STORAGE_KEY = "spreadsheetGrid";

export function SpreadsheetApp() {
  const [grid, setGrid] = useState<Grid>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    persistGet<Grid>("data", STORAGE_KEY, {}).then(setGrid);
  }, []);

  function save(next: Grid) {
    setGrid(next);
    persistSet("data", STORAGE_KEY, next);
  }

  function selectCell(id: string) {
    setSelected(id);
    setEditValue(grid[id] ?? "");
  }

  function commitEdit() {
    if (!selected) return;
    const next = { ...grid };
    if (editValue.trim() === "") delete next[selected];
    else next[selected] = editValue;
    save(next);
  }

  return (
    <div className="app-root">
      <div className="app-toolbar">
        <span className="spreadsheet-cellref">{selected ?? ""}</span>
        <input
          className="spreadsheet-formula-bar"
          placeholder="Value or =formula (e.g. =A1+B2, =SUM(A1:A5))"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => e.key === "Enter" && commitEdit()}
          disabled={!selected}
        />
      </div>
      <div className="app-content spreadsheet-scroll">
        <table className="spreadsheet-table">
          <thead>
            <tr>
              <th />
              {Array.from({ length: COLS }, (_, c) => (
                <th key={c}>{cellId(0, c).replace(/\d+$/, "")}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: ROWS }, (_, r) => (
              <tr key={r}>
                <th>{r + 1}</th>
                {Array.from({ length: COLS }, (_, c) => {
                  const id = cellId(r, c);
                  return (
                    <td
                      key={id}
                      data-selected={selected === id}
                      onClick={() => selectCell(id)}
                    >
                      {displayValue(grid[id], grid)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
