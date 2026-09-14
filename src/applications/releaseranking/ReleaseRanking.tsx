import { useMemo, useState } from "react";
import { RANKING_ROWS, windowsEquivalent, type RankingRow } from "./releaseRankingData";
import "@/applications/apps.css";

function scoreBand(score: number): "good" | "mid" | "low" {
  return score >= 8 ? "good" : score >= 5 ? "mid" : "low";
}

const BAND_COLOR: Record<"good" | "mid" | "low", string> = {
  good: "var(--anchoran-success, #1c7a4d)",
  mid: "var(--anchoran-warning, #9a6a12)",
  low: "var(--anchoran-danger, #a83c34)",
};

/**
 * Anchoran's own "which version to install" ranking, straight from the
 * same-named published Artifact (kept in sync by hand — see the memory
 * note that every CHANGELOG.md edit should also touch
 * releaseRankingData.ts). A core, unremovable app: this is Anchoran
 * grading its own history, so it stays available the same way Settings
 * → About's own changelog viewer does.
 */
export function ReleaseRankingApp() {
  const [query, setQuery] = useState("");
  const sorted = useMemo(() => [...RANKING_ROWS].sort((a, b) => b[2] - a[2]), []);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(([version]) => version.toLowerCase().includes(q));
  }, [sorted, query]);

  let lastBand: string | null = null;

  return (
    <div className="app-root">
      <div className="app-toolbar">
        <span style={{ fontSize: 13, fontWeight: 500 }}>Anchoran OS Release Ranking</span>
        <input
          placeholder="Filter by version…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            marginLeft: "auto",
            border: "1px solid var(--anchoran-border)",
            borderRadius: 6,
            padding: "5px 9px",
            background: "var(--anchoran-bg)",
            color: "var(--anchoran-text-primary)",
            fontSize: 12.5,
            width: 160,
          }}
        />
      </div>
      <div className="app-content" style={{ padding: 20, overflowY: "auto" }}>
        <p style={{ maxWidth: "68ch", color: "var(--anchoran-text-secondary)", fontSize: 13.5, lineHeight: 1.6, marginTop: 0 }}>
          Same history, a different question: not "how much did it add" but{" "}
          <b style={{ color: "var(--anchoran-text-primary)" }}>
            "if I had to stay on this version forever, with no more updates, how well off would I be?"
          </b>{" "}
          — the same logic behind picking Windows 7 over 10 or 11 because it accumulated patches without yet
          carrying the next big move's own problems.
        </p>
        <p style={{ maxWidth: "68ch", color: "var(--anchoran-text-secondary)", fontSize: 13.5, lineHeight: 1.6 }}>
          For each version, this reconstructs which bugs — already documented by some <i>later</i> version's own
          "Fixed" section — were still unfixed at that exact point, and how complete the app already was. A version
          can ship a huge batch and still score badly if it shipped alongside an active security hole, or a boot
          crash so severe the release itself ended up disabled.
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, margin: "22px 0" }}>
          {[
            { k: "Best of the whole history", v: "2.6.13 — 10/10", d: "zero documented open bugs, and the (still shaky) app embed doesn't exist yet" },
            { k: "Best recommendation today", v: "3.4.0 — 9/10", d: "the newest stable, no known open bugs" },
            { k: "Avoid at all costs", v: "2.8.9 → 2.9.1", d: "6 versions in a row with a real boot crash — disabled on GitHub" },
            { k: "Rock bottom (tie)", v: "alpha.5 & 2.8.9–2.9.1", d: "1/10 · Settings broken + non-silent updates, or an app that just doesn't boot" },
          ].map((s) => (
            <div
              key={s.k}
              style={{
                flex: "1 1 210px",
                background: "var(--anchoran-surface)",
                border: "1px solid var(--anchoran-border)",
                borderRadius: 10,
                padding: "12px 14px",
              }}
            >
              <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.06, color: "var(--anchoran-text-secondary)", marginBottom: 5 }}>
                {s.k}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, fontFamily: "Cascadia Code, Consolas, monospace" }}>{s.v}</div>
              <div style={{ fontSize: 11.5, color: "var(--anchoran-text-secondary)", marginTop: 3 }}>{s.d}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12, color: "var(--anchoran-text-secondary)", margin: "8px 0 14px" }}>
          <span>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: BAND_COLOR.good, marginRight: 6 }} />
            8–10 — confidently installable, no active known issues
          </span>
          <span>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: BAND_COLOR.mid, marginRight: 6 }} />
            5–7 — usable, but something (minor) was open at the time
          </span>
          <span>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: BAND_COLOR.low, marginRight: 6 }} />
            1–4 — avoid: an active serious/security bug, still very incomplete, or outright disabled
          </span>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["#", "Version", "Equivalent to", "Score", "State of the app at the time", "Open if you stayed"].map((h, i) => (
                  <th
                    key={h}
                    style={{
                      position: "sticky",
                      top: 0,
                      background: "var(--anchoran-bg)",
                      textAlign: i === 0 || i === 3 ? "center" : "left",
                      fontSize: 10.5,
                      textTransform: "uppercase",
                      letterSpacing: 0.05,
                      color: "var(--anchoran-text-secondary)",
                      fontWeight: 600,
                      padding: "8px 8px",
                      borderBottom: "2px solid var(--anchoran-border)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r: RankingRow, i) => {
                const band = scoreBand(r[2]);
                const bandLabel = band === "good" ? "8–10" : band === "mid" ? "5–7" : "1–4";
                const showGroup = bandLabel !== lastBand && !query.trim();
                lastBand = bandLabel;
                return (
                  <RowGroup key={r[0] + r[1]} showGroup={showGroup} bandLabel={bandLabel} rank={i + 1} row={r} band={band} />
                );
              })}
            </tbody>
          </table>
        </div>

        <div
          style={{
            marginTop: 30,
            paddingTop: 16,
            borderTop: "1px solid var(--anchoran-border)",
            fontSize: 11.5,
            color: "var(--anchoran-text-secondary)",
            lineHeight: 1.7,
          }}
        >
          Methodology: for each version, this reconstructs, in chronological order, which documented bugs (fixed by
          some later version) were already introduced but not yet fixed at that exact point — that's the "open if you
          stayed" column. The score weighs the count and severity of those open bugs (an active security hole or boot
          crash weighs far more than a mis-colored icon) alongside how complete the app already was. Built from the
          full CHANGELOG.md, not user reports beyond what's documented there — a retrospective reconstruction, not a
          live audit of each version.
          <br />
          <br />
          Updated through v3.0.3. Left out of the ranking: versions that never got a stable release of their own to
          install and stay on — v2.9.9 (existed only as an I.P.U., superseded before going stable; its content ended
          up folded into the v3.0.0 stable release). From v3.0.0 onward, every version ships first as an I.P.U.
          (prerelease, only for devices with "Insider Preview updates" enabled) and only later as a stable release —
          this ranking only scores the stable ones, since those are what someone can actually install and stay on
          forever in the sense the question above asks.
        </div>
      </div>
    </div>
  );
}

function RowGroup({
  showGroup,
  bandLabel,
  rank,
  row,
  band,
}: {
  showGroup: boolean;
  bandLabel: string;
  rank: number;
  row: RankingRow;
  band: "good" | "mid" | "low";
}) {
  const [version, date, score, what, bugs] = row;
  return (
    <>
      {showGroup && (
        <tr>
          <td
            colSpan={6}
            style={{
              padding: "18px 8px 6px",
              fontSize: 10.5,
              textTransform: "uppercase",
              letterSpacing: 0.06,
              color: "var(--anchoran-text-secondary)",
            }}
          >
            {bandLabel}
          </td>
        </tr>
      )}
      <tr style={{ borderBottom: "1px solid var(--anchoran-border)" }}>
        <td style={{ padding: "9px 8px", fontFamily: "Cascadia Code, Consolas, monospace", fontSize: 11.5, color: "var(--anchoran-text-secondary)", verticalAlign: "top" }}>
          {rank}
        </td>
        <td style={{ padding: "9px 8px", fontFamily: "Cascadia Code, Consolas, monospace", fontWeight: 600, whiteSpace: "nowrap", verticalAlign: "top" }}>
          {version}
          <span style={{ display: "block", fontWeight: 400, color: "var(--anchoran-text-secondary)", fontSize: 10.5, marginTop: 2 }}>{date}</span>
        </td>
        <td style={{ padding: "9px 8px", fontSize: 11.5, color: "var(--anchoran-text-secondary)", whiteSpace: "nowrap", verticalAlign: "top" }}>
          {windowsEquivalent(version)}
        </td>
        <td style={{ padding: "9px 8px", textAlign: "center", verticalAlign: "top" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: 28,
              height: 24,
              padding: "0 6px",
              borderRadius: 7,
              fontFamily: "Cascadia Code, Consolas, monospace",
              fontWeight: 700,
              fontSize: 12,
              color: BAND_COLOR[band],
              background: `color-mix(in srgb, ${BAND_COLOR[band]} 16%, transparent)`,
            }}
          >
            {score}
          </span>
        </td>
        <td style={{ padding: "9px 8px", lineHeight: 1.5, verticalAlign: "top" }} dangerouslySetInnerHTML={{ __html: what }} />
        <td
          style={{ padding: "9px 8px", fontSize: 12, color: "var(--anchoran-text-secondary)", lineHeight: 1.5, verticalAlign: "top" }}
          dangerouslySetInnerHTML={{ __html: bugs }}
        />
      </tr>
    </>
  );
}
