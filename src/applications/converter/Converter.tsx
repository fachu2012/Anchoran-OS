import { useMemo, useState } from "react";
import "@/applications/apps.css";
import "./converter.css";

type Category = "length" | "weight" | "temperature" | "data";

// Linear units are expressed as a factor to a base unit; temperature
// needs its own conversion functions since it isn't a simple ratio.
const LINEAR_UNITS: Record<Exclude<Category, "temperature">, { label: string; toBase: number }[]> = {
  length: [
    { label: "Millimeters", toBase: 0.001 },
    { label: "Centimeters", toBase: 0.01 },
    { label: "Meters", toBase: 1 },
    { label: "Kilometers", toBase: 1000 },
    { label: "Inches", toBase: 0.0254 },
    { label: "Feet", toBase: 0.3048 },
    { label: "Miles", toBase: 1609.344 },
  ],
  weight: [
    { label: "Grams", toBase: 1 },
    { label: "Kilograms", toBase: 1000 },
    { label: "Ounces", toBase: 28.3495 },
    { label: "Pounds", toBase: 453.592 },
  ],
  data: [
    { label: "Bytes", toBase: 1 },
    { label: "Kilobytes", toBase: 1024 },
    { label: "Megabytes", toBase: 1024 ** 2 },
    { label: "Gigabytes", toBase: 1024 ** 3 },
  ],
};

const TEMPERATURE_UNITS = ["Celsius", "Fahrenheit", "Kelvin"] as const;

function celsiusFrom(unit: (typeof TEMPERATURE_UNITS)[number], value: number): number {
  if (unit === "Celsius") return value;
  if (unit === "Fahrenheit") return ((value - 32) * 5) / 9;
  return value - 273.15;
}
function celsiusTo(unit: (typeof TEMPERATURE_UNITS)[number], celsius: number): number {
  if (unit === "Celsius") return celsius;
  if (unit === "Fahrenheit") return (celsius * 9) / 5 + 32;
  return celsius + 273.15;
}

const CATEGORY_LABELS: Record<Category, string> = {
  length: "Length",
  weight: "Weight",
  temperature: "Temperature",
  data: "Data Size",
};

export function ConverterApp() {
  const [category, setCategory] = useState<Category>("length");
  const [fromUnit, setFromUnit] = useState(0);
  const [toUnit, setToUnit] = useState(1);
  const [input, setInput] = useState("1");

  const options = category === "temperature" ? TEMPERATURE_UNITS : LINEAR_UNITS[category].map((u) => u.label);

  const result = useMemo(() => {
    const value = parseFloat(input);
    if (Number.isNaN(value)) return "";
    if (category === "temperature") {
      const celsius = celsiusFrom(TEMPERATURE_UNITS[fromUnit], value);
      return String(Math.round(celsiusTo(TEMPERATURE_UNITS[toUnit], celsius) * 1000) / 1000);
    }
    const units = LINEAR_UNITS[category];
    const base = value * units[fromUnit].toBase;
    return String(Math.round((base / units[toUnit].toBase) * 100000) / 100000);
  }, [category, fromUnit, toUnit, input]);

  function onCategoryChange(next: Category) {
    setCategory(next);
    setFromUnit(0);
    setToUnit(1);
  }

  return (
    <div className="app-root">
      <div className="app-toolbar">
        {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
          <button key={c} className="app-toolbar-btn" data-op={category === c} onClick={() => onCategoryChange(c)}>
            {CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>
      <div className="app-content converter-content">
        <div className="converter-row">
          <input
            className="converter-input"
            type="number"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <select className="converter-select" value={fromUnit} onChange={(e) => setFromUnit(Number(e.target.value))}>
            {options.map((label, i) => (
              <option key={label} value={i}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="converter-equals">=</div>
        <div className="converter-row">
          <div className="converter-result">{result}</div>
          <select className="converter-select" value={toUnit} onChange={(e) => setToUnit(Number(e.target.value))}>
            {options.map((label, i) => (
              <option key={label} value={i}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
