import { useState } from "react";
import { Icon } from "@/components/Icon";
import "@/applications/apps.css";
import "./coinflip.css";

export function CoinFlipApp() {
  const [side, setSide] = useState<"heads" | "tails">("heads");
  const [flipping, setFlipping] = useState(false);
  const [tally, setTally] = useState({ heads: 0, tails: 0 });

  function flip() {
    if (flipping) return;
    setFlipping(true);
    window.setTimeout(() => {
      const result = Math.random() < 0.5 ? "heads" : "tails";
      setSide(result);
      setTally((t) => ({ ...t, [result]: t[result] + 1 }));
      setFlipping(false);
    }, 500);
  }

  return (
    <div className="app-root">
      <div className="app-toolbar">
        <button className="app-toolbar-btn" onClick={flip} disabled={flipping}>
          <Icon name="coinFlip" size={14} /> Flip
        </button>
        <div className="coinflip-tally">
          Heads {tally.heads} · Tails {tally.tails}
        </div>
      </div>
      <div className="app-content coinflip-content">
        <div className="coinflip-coin" data-flipping={flipping} data-side={side}>
          {flipping ? "" : side === "heads" ? "H" : "T"}
        </div>
        <div className="coinflip-result">{flipping ? "Flipping…" : side === "heads" ? "Heads" : "Tails"}</div>
      </div>
    </div>
  );
}
