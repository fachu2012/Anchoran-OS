import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import "@/applications/apps.css";
import "./currencyconverter.css";

const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "ARS", "BRL", "CAD", "AUD", "CHF", "CNY", "MXN"];

export function CurrencyConverterApp() {
  const [amount, setAmount] = useState("100");
  const [from, setFrom] = useState("USD");
  const [to, setTo] = useState("EUR");
  const [rate, setRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`)
      .then((r) => {
        if (!r.ok) throw new Error("Request failed");
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        setRate(data.rates[to]);
        setUpdatedAt(data.date);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't fetch exchange rates. Check your connection.");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  const numericAmount = Number(amount) || 0;
  const converted = rate !== null ? numericAmount * rate : null;

  return (
    <div className="app-root">
      <div className="app-content currency-content">
        <input
          className="currency-amount"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <div className="currency-row">
          <select value={from} onChange={(e) => setFrom(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            className="app-toolbar-btn"
            onClick={() => {
              setFrom(to);
              setTo(from);
            }}
            aria-label="Swap"
          >
            <Icon name="converter" size={14} />
          </button>
          <select value={to} onChange={(e) => setTo(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {error ? (
          <div className="currency-error">{error}</div>
        ) : loading ? (
          <div className="currency-loading">Fetching rates…</div>
        ) : (
          converted !== null && (
            <div className="currency-result">
              <div className="currency-result-value">
                {converted.toLocaleString(undefined, { maximumFractionDigits: 2 })} {to}
              </div>
              <div className="currency-result-meta">
                1 {from} = {rate?.toFixed(4)} {to} · {updatedAt}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
