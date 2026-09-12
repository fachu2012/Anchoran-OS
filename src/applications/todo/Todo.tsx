import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { EmptyState } from "@/components/EmptyState";
import { persistGet, persistSet } from "@/core/persist";
import "@/applications/apps.css";
import "./todo.css";

interface TodoItem {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
}

const STORAGE_KEY = "todoItems";

export function TodoApp() {
  const [items, setItems] = useState<TodoItem[]>([]);
  const [draft, setDraft] = useState("");
  const [hideDone, setHideDone] = useState(false);

  useEffect(() => {
    persistGet<TodoItem[]>("data", STORAGE_KEY, []).then(setItems);
  }, []);

  function save(next: TodoItem[]) {
    setItems(next);
    persistSet("data", STORAGE_KEY, next);
  }

  function addItem() {
    const text = draft.trim();
    if (!text) return;
    save([{ id: `${Date.now()}`, text, done: false, createdAt: Date.now() }, ...items]);
    setDraft("");
  }

  function toggle(id: string) {
    save(items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));
  }

  function remove(id: string) {
    save(items.filter((i) => i.id !== id));
  }

  const visible = hideDone ? items.filter((i) => !i.done) : items;
  const remaining = items.filter((i) => !i.done).length;

  return (
    <div className="app-root">
      <div className="app-toolbar">
        <input
          className="todo-input"
          placeholder="Add a task…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addItem()}
        />
        <button className="app-toolbar-btn" onClick={addItem}>
          <Icon name="plus" size={14} /> Add
        </button>
        <button className="app-toolbar-btn" data-op={hideDone} onClick={() => setHideDone((v) => !v)}>
          Hide done
        </button>
      </div>
      <div className="app-content">
        <div className="todo-list">
          {visible.map((item) => (
            <div key={item.id} className="todo-row">
              <button className="todo-check" data-done={item.done} onClick={() => toggle(item.id)}>
                {item.done && <Icon name="check" size={12} />}
              </button>
              <span className="todo-text" data-done={item.done}>
                {item.text}
              </span>
              <button className="todo-remove" onClick={() => remove(item.id)} aria-label="Delete">
                <Icon name="close" size={13} />
              </button>
            </div>
          ))}
          {visible.length === 0 && (
            <EmptyState
              icon="todo"
              title={items.length === 0 ? "No tasks yet" : "Nothing left to do"}
              description={items.length === 0 ? "Add one above to get started." : undefined}
            />
          )}
        </div>
        {items.length > 0 && (
          <div className="todo-footer">{remaining} of {items.length} remaining</div>
        )}
      </div>
    </div>
  );
}
