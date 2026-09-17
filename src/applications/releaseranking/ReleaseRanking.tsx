import { useMemo, useState } from "react";
import { RANKING_ROWS, windowsEquivalent, bestPerWindowsEra, type RankingRow } from "./releaseRankingData";
import { simplifiedLabelFor } from "@/core/buildNumber";
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
  const [sortBy, setSortBy] = useState<"score" | "date">("score");
  const [scoreFilter, setScoreFilter] = useState<"all" | "good" | "mid" | "low">("all");
  const eraPicks = useMemo(() => bestPerWindowsEra(RANKING_ROWS), []);
  const sorted = useMemo(() => {
    const rows = [...RANKING_ROWS];
    // Score sort keeps ties in the data's own order (used to group rows
    // by band below); date sort is newest-first, matching how someone
    // scanning "what came out recently" would expect to read it.
    if (sortBy === "date") rows.sort((a, b) => b[1].localeCompare(a[1]));
    else rows.sort((a, b) => b[2] - a[2]);
    return rows;
  }, [sortBy]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sorted
      .filter(([version]) => !q || version.toLowerCase().includes(q))
      .filter((row) => scoreFilter === "all" || scoreBand(row[2]) === scoreFilter);
  }, [sorted, query, scoreFilter]);

  let lastBand: string | null = null;

  return (
    <div className="app-root">
      <div className="app-toolbar">
        <span style={{ fontSize: 13, fontWeight: 500 }}>Anchoran OS Release Ranking</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "score" | "date")}
            aria-label="Sort by"
            style={{
              border: "1px solid var(--anchoran-border)",
              borderRadius: 6,
              padding: "5px 7px",
              background: "var(--anchoran-bg)",
              color: "var(--anchoran-text-primary)",
              fontSize: 12.5,
            }}
          >
            <option value="score">Sort: Score</option>
            <option value="date">Sort: Date (newest first)</option>
          </select>
          <select
            value={scoreFilter}
            onChange={(e) => setScoreFilter(e.target.value as "all" | "good" | "mid" | "low")}
            aria-label="Filter by score"
            style={{
              border: "1px solid var(--anchoran-border)",
              borderRadius: 6,
              padding: "5px 7px",
              background: "var(--anchoran-bg)",
              color: "var(--anchoran-text-primary)",
              fontSize: 12.5,
            }}
          >
            <option value="all">All scores</option>
            <option value="good">8–10 only</option>
            <option value="mid">5–7 only</option>
            <option value="low">1–4 only</option>
          </select>
          <input
            placeholder="Filter by version…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
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
            { k: "Best recommendation today", v: `${simplifiedLabelFor("3.4.0")} — 9/10`, d: "the newest stable, no known open bugs" },
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

        <div style={{ margin: "22px 0" }}>
          <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.06, color: "var(--anchoran-text-secondary)", marginBottom: 8 }}>
            Best Anchoran pick, per Windows-era comparison
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {eraPicks.map(({ windowsEra, row }) => {
              const band = scoreBand(row[2]);
              return (
                <div
                  key={windowsEra}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: "var(--anchoran-surface)",
                    border: "1px solid var(--anchoran-border)",
                    borderRadius: 999,
                    padding: "6px 12px 6px 6px",
                    fontSize: 12,
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minWidth: 24,
                      height: 22,
                      padding: "0 6px",
                      borderRadius: 999,
                      fontFamily: "Cascadia Code, Consolas, monospace",
                      fontWeight: 700,
                      fontSize: 11,
                      color: BAND_COLOR[band],
                      background: `color-mix(in srgb, ${BAND_COLOR[band]} 16%, transparent)`,
                    }}
                  >
                    {row[2]}
                  </span>
                  <span style={{ color: "var(--anchoran-text-secondary)" }}>{windowsEra}</span>
                  <span style={{ fontFamily: "Cascadia Code, Consolas, monospace", fontWeight: 600 }}>
                    {simplifiedLabelFor(row[0])}
                  </span>
                </div>
              );
            })}
          </div>
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
                // Band group headers only make sense when the list is
                // actually grouped by score — sorting by date interleaves
                // bands, and a search/score filter already narrows things
                // down enough that a repeated header would just be noise.
                const showGroup = sortBy === "score" && !query.trim() && scoreFilter === "all" && bandLabel !== lastBand;
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
          Updated through v3.8.17. Left out of the ranking: versions that never got a stable release of their own to
          install and stay on — v2.9.9, v3.3.6, v3.5.0, v3.5.1, v3.5.2, v3.5.3, v3.5.4, v3.5.5, v3.5.6, v3.8.0, v3.8.1, v3.8.2, v3.8.3, v3.8.4, v3.8.5, v3.8.6, v3.8.7, v3.8.8, v3.8.9, v3.8.10, v3.8.11, v3.8.12, v3.8.13, v3.8.14, v3.8.15 and v3.8.16 (each
          existed only as an I.P.U., superseded before going stable; each one's content ended up folded into the
          next version that actually did go stable). From v3.0.0 onward, every version ships first as an I.P.U.
          (prerelease, only for devices with "Insider Preview updates" enabled) and only later as a stable release
          — this ranking only scores the stable ones, since those are what someone can actually install and stay
          on forever in the sense the question above asks. v3.8.17 is listed for reference (the Quick Settings
          volume sliders never visually moved when dragged) but is still I.P.U.-only as of this update, so it isn't
          yet the top recommendation. v3.5.4/v3.5.5 score 1/10 —
          both fail to boot at all, see their own rows.
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
          {/* Old-style versions (v3.0.0 and earlier) never had a build-number
              form to begin with, so simplifiedLabelFor keeps showing those as
              plain "vX.Y.Z" — only versions after v3.0.0 switch to "Build-#H#.#". */}
          {simplifiedLabelFor(version)}
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
