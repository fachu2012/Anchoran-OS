import { useEffect, useState, type DragEvent } from "react";
import { Icon } from "@/components/Icon";
import { persistGet, persistSet } from "@/core/persist";
import "@/applications/apps.css";
import "./kanban.css";

type ColumnId = "todo" | "doing" | "done";

interface Card {
  id: string;
  text: string;
}

type Board = Record<ColumnId, Card[]>;

const COLUMNS: { id: ColumnId; label: string }[] = [
  { id: "todo", label: "To Do" },
  { id: "doing", label: "Doing" },
  { id: "done", label: "Done" },
];

const STORAGE_KEY = "kanbanBoard";
const DEFAULT_BOARD: Board = { todo: [], doing: [], done: [] };
const DRAG_MIME = "application/x-anchoran-kanban-card";

export function KanbanApp() {
  const [board, setBoard] = useState<Board>(DEFAULT_BOARD);
  const [drafts, setDrafts] = useState<Record<ColumnId, string>>({ todo: "", doing: "", done: "" });
  const [dragOverCol, setDragOverCol] = useState<ColumnId | null>(null);

  useEffect(() => {
    persistGet<Board>("data", STORAGE_KEY, DEFAULT_BOARD).then(setBoard);
  }, []);

  function save(next: Board) {
    setBoard(next);
    persistSet("data", STORAGE_KEY, next);
  }

  function addCard(col: ColumnId) {
    const text = drafts[col].trim();
    if (!text) return;
    save({ ...board, [col]: [...board[col], { id: `${Date.now()}`, text }] });
    setDrafts((d) => ({ ...d, [col]: "" }));
  }

  function removeCard(col: ColumnId, id: string) {
    save({ ...board, [col]: board[col].filter((c) => c.id !== id) });
  }

  function onDrop(e: DragEvent, targetCol: ColumnId) {
    e.preventDefault();
    setDragOverCol(null);
    const raw = e.dataTransfer.getData(DRAG_MIME);
    if (!raw) return;
    const [sourceCol, cardId] = raw.split(":") as [ColumnId, string];
    if (sourceCol === targetCol) return;
    const card = board[sourceCol].find((c) => c.id === cardId);
    if (!card) return;
    save({
      ...board,
      [sourceCol]: board[sourceCol].filter((c) => c.id !== cardId),
      [targetCol]: [...board[targetCol], card],
    });
  }

  return (
    <div className="app-root">
      <div className="app-content kanban-content">
        {COLUMNS.map((col) => (
          <div
            key={col.id}
            className="kanban-column"
            data-drag-over={dragOverCol === col.id}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverCol(col.id);
            }}
            onDragLeave={() => setDragOverCol((c) => (c === col.id ? null : c))}
            onDrop={(e) => onDrop(e, col.id)}
          >
            <div className="kanban-column-header">
              {col.label} <span className="kanban-count">{board[col.id].length}</span>
            </div>
            <div className="kanban-cards">
              {board[col.id].map((card) => (
                <div
                  key={card.id}
                  className="kanban-card"
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData(DRAG_MIME, `${col.id}:${card.id}`)}
                >
                  <span>{card.text}</span>
                  <button className="todo-remove" onClick={() => removeCard(col.id, card.id)} aria-label="Delete">
                    <Icon name="close" size={12} />
                  </button>
                </div>
              ))}
            </div>
            <div className="kanban-add">
              <input
                placeholder="Add card…"
                value={drafts[col.id]}
                onChange={(e) => setDrafts((d) => ({ ...d, [col.id]: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && addCard(col.id)}
              />
              <button className="app-toolbar-btn" onClick={() => addCard(col.id)}>
                <Icon name="plus" size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
