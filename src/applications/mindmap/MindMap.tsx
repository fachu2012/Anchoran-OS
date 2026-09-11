import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { persistGet, persistSet } from "@/core/persist";
import "@/applications/apps.css";
import "./mindmap.css";

interface MindNode {
  id: string;
  text: string;
  x: number;
  y: number;
  parentId: string | null;
}

const STORAGE_KEY = "mindMap";
const ROOT: MindNode = { id: "root", text: "Central idea", x: 320, y: 220, parentId: null };

export function MindMapApp() {
  const [nodes, setNodes] = useState<MindNode[]>([ROOT]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const dragRef = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);

  useEffect(() => {
    persistGet<MindNode[]>("data", STORAGE_KEY, [ROOT]).then(setNodes);
  }, []);

  function save(next: MindNode[]) {
    setNodes(next);
    persistSet("data", STORAGE_KEY, next);
  }

  function addChild(parentId: string) {
    const parent = nodes.find((n) => n.id === parentId);
    if (!parent) return;
    const angle = Math.random() * Math.PI * 2;
    const id = `${Date.now()}`;
    save([
      ...nodes,
      { id, text: "New idea", x: parent.x + Math.cos(angle) * 140, y: parent.y + Math.sin(angle) * 100, parentId },
    ]);
    setEditingId(id);
  }

  function removeNode(id: string) {
    if (id === "root") return;
    const toRemove = new Set([id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const n of nodes) {
        if (n.parentId && toRemove.has(n.parentId) && !toRemove.has(n.id)) {
          toRemove.add(n.id);
          changed = true;
        }
      }
    }
    save(nodes.filter((n) => !toRemove.has(n.id)));
  }

  function updateText(id: string, text: string) {
    save(nodes.map((n) => (n.id === id ? { ...n, text } : n)));
  }

  function onPointerDown(e: React.PointerEvent, node: MindNode) {
    if ((e.target as HTMLElement).tagName === "INPUT") return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { id: node.id, startX: e.clientX, startY: e.clientY, origX: node.x, origY: node.y };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const { id, startX, startY, origX, origY } = dragRef.current;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, x: origX + dx, y: origY + dy } : n)));
  }

  function onPointerUp() {
    if (dragRef.current) save(nodes);
    dragRef.current = null;
  }

  return (
    <div className="app-root">
      <div className="app-content mindmap-canvas" onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
        <svg className="mindmap-lines">
          {nodes
            .filter((n) => n.parentId)
            .map((n) => {
              const parent = nodes.find((p) => p.id === n.parentId);
              if (!parent) return null;
              return (
                <line
                  key={n.id}
                  x1={parent.x}
                  y1={parent.y}
                  x2={n.x}
                  y2={n.y}
                  stroke="var(--anchoran-border-strong)"
                  strokeWidth={1.5}
                />
              );
            })}
        </svg>
        {nodes.map((n) => (
          <div
            key={n.id}
            className="mindmap-node"
            data-root={n.id === "root"}
            style={{ left: n.x, top: n.y }}
            onPointerDown={(e) => onPointerDown(e, n)}
          >
            {editingId === n.id ? (
              <input
                autoFocus
                value={n.text}
                onChange={(e) => updateText(n.id, e.target.value)}
                onBlur={() => setEditingId(null)}
                onKeyDown={(e) => e.key === "Enter" && setEditingId(null)}
              />
            ) : (
              <span onDoubleClick={() => setEditingId(n.id)}>{n.text}</span>
            )}
            <div className="mindmap-node-actions">
              <button onClick={() => addChild(n.id)} aria-label="Add child">
                <Icon name="plus" size={11} />
              </button>
              {n.id !== "root" && (
                <button onClick={() => removeNode(n.id)} aria-label="Delete">
                  <Icon name="close" size={11} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
