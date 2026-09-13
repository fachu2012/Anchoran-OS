import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { IconTile } from "@/components/IconTile";
import { AnchoranFilePicker } from "@/core/AnchoranFilePicker";
import { iconForFile } from "./fileTypes";

type Status = "only-a" | "only-b" | "different" | "same";
interface Row {
  name: string;
  isDirectory: boolean;
  status: Status;
}

const STATUS_LABEL: Record<Status, string> = {
  "only-a": "Only in this folder",
  "only-b": "Only in the other folder",
  different: "Different",
  same: "Identical",
};

/**
 * A real, working folder comparison — top-level entries only (not a
 * recursive tree diff), matched by name, categorized by whether each
 * name exists in one side, both with matching size, or both with a
 * different size/modified time.
 */
export function FolderCompare({ folderA, onClose }: { folderA: string; onClose: () => void }) {
  const [pickerOpen, setPickerOpen] = useState(true);
  const [folderB, setFolderB] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Status | "all">("all");

  useEffect(() => {
    if (!folderB || !window.anchoran) return;
    let cancelled = false;
    (async () => {
      const [resultA, resultB] = await Promise.all([window.anchoran!.fsListDir(folderA), window.anchoran!.fsListDir(folderB)]);
      if (cancelled) return;
      if ("error" in resultA || "error" in resultB) {
        setError("Could not read one of the two folders.");
        return;
      }
      const mapA = new Map(resultA.entries.map((e) => [e.name, e]));
      const mapB = new Map(resultB.entries.map((e) => [e.name, e]));
      const names = new Set([...mapA.keys(), ...mapB.keys()]);
      const result: Row[] = [];
      for (const name of names) {
        const a = mapA.get(name);
        const b = mapB.get(name);
        if (a && !b) result.push({ name, isDirectory: a.isDirectory, status: "only-a" });
        else if (b && !a) result.push({ name, isDirectory: b.isDirectory, status: "only-b" });
        else if (a && b) {
          const same = a.isDirectory === b.isDirectory && (a.isDirectory || (a.size === b.size && a.modifiedAt === b.modifiedAt));
          result.push({ name, isDirectory: a.isDirectory, status: same ? "same" : "different" });
        }
      }
      result.sort((x, y) => x.name.localeCompare(y.name));
      setRows(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [folderA, folderB]);

  const visibleRows = rows?.filter((r) => filter === "all" || r.status === filter) ?? [];

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 55, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      {pickerOpen ? (
        <div onClick={(e) => e.stopPropagation()}>
          <AnchoranFilePicker
            mode="folder"
            title="Compare with…"
            startPath={folderA}
            onCancel={onClose}
            onConfirm={(result) => {
              if ("path" in result) {
                setFolderB(result.path);
                setPickerOpen(false);
              }
            }}
          />
        </div>
      ) : (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ width: "min(92%, 640px)", maxHeight: "80vh", display: "flex", flexDirection: "column", background: "var(--anchoran-surface)", borderRadius: "var(--anchoran-radius-lg)", boxShadow: "var(--anchoran-shadow-window)", padding: 20 }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Compare folders</div>
            <button className="wm-control-btn" onClick={onClose} aria-label="Close">
              <Icon name="close" size={14} />
            </button>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--anchoran-text-secondary)", marginBottom: 12 }}>
            {folderA} ↔ {folderB}
          </div>
          {error && <div style={{ color: "#E5484D", fontSize: 12.5 }}>{error}</div>}
          {!error && (
            <>
              <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                {(["all", "only-a", "only-b", "different", "same"] as const).map((f) => (
                  <button key={f} className="app-toolbar-btn" data-op={filter === f} onClick={() => setFilter(f)}>
                    {f === "all" ? "All" : STATUS_LABEL[f]}
                  </button>
                ))}
              </div>
              <div style={{ overflowY: "auto", flex: 1, fontSize: 12.5 }}>
                {rows === null ? (
                  <div style={{ color: "var(--anchoran-text-secondary)" }}>Comparing…</div>
                ) : visibleRows.length === 0 ? (
                  <div style={{ color: "var(--anchoran-text-secondary)" }}>No entries match this filter.</div>
                ) : (
                  visibleRows.map((r) => (
                    <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderTop: "1px solid var(--anchoran-border)" }}>
                      <IconTile name={r.isDirectory ? "folder" : iconForFile(r.name)} size={20} glyphScale={0.6} />
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                      <span
                        style={{
                          fontSize: 11,
                          color:
                            r.status === "same"
                              ? "#30A46C"
                              : r.status === "different"
                                ? "#F5A524"
                                : "var(--anchoran-text-secondary)",
                        }}
                      >
                        {STATUS_LABEL[r.status]}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
