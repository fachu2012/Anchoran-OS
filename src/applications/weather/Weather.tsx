import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { describeWeatherCode } from "./weatherCodes";
import { persistGet, persistSet } from "@/core/persist";
import "@/applications/apps.css";
import "./weather.css";

interface Forecast {
  city: string;
  country: string;
  currentTemp: number;
  currentCode: number;
  daily: { date: string; max: number; min: number; code: number }[];
}

const STORAGE_KEY = "weatherLastCity";

export function WeatherApp() {
  const [query, setQuery] = useState("");
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search(city: string) {
    if (!city.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const geoRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`
      );
      const geo = await geoRes.json();
      const place = geo.results?.[0];
      if (!place) {
        setError("City not found.");
        setForecast(null);
        return;
      }
      const wRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}` +
          `&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto`
      );
      const w = await wRes.json();
      setForecast({
        city: place.name,
        country: place.country,
        currentTemp: w.current.temperature_2m,
        currentCode: w.current.weather_code,
        daily: w.daily.time.map((date: string, i: number) => ({
          date,
          max: w.daily.temperature_2m_max[i],
          min: w.daily.temperature_2m_min[i],
          code: w.daily.weather_code[i],
        })),
      });
      persistSet("data", STORAGE_KEY, place.name);
    } catch {
      setError("Couldn't fetch weather. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    persistGet<string>("data", STORAGE_KEY, "").then((city) => {
      if (city) {
        setQuery(city);
        search(city);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="app-root">
      <div className="app-toolbar">
        <input
          className="todo-input"
          placeholder="Search a city…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search(query)}
        />
        <button className="app-toolbar-btn" onClick={() => search(query)}>
          <Icon name="search" size={13} />
        </button>
      </div>
      <div className="app-content weather-content">
        {loading && <div className="weather-status">Loading…</div>}
        {error && <div className="weather-status" style={{ color: "#E5484D" }}>{error}</div>}
        {!loading && !error && forecast && (
          <>
            <div className="weather-current">
              <Icon name="weather" size={40} />
              <div className="weather-temp">{Math.round(forecast.currentTemp)}°C</div>
              <div className="weather-place">
                {forecast.city}, {forecast.country}
              </div>
              <div className="weather-desc">{describeWeatherCode(forecast.currentCode)}</div>
            </div>
            <div className="weather-daily">
              {forecast.daily.slice(0, 5).map((d) => (
                <div key={d.date} className="weather-day">
                  <span className="weather-day-label">
                    {new Date(d.date).toLocaleDateString([], { weekday: "short" })}
                  </span>
                  <span className="weather-day-temp">
                    {Math.round(d.max)}° / {Math.round(d.min)}°
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
        {!loading && !error && !forecast && (
          <div className="weather-status">Search for a city to see its forecast.</div>
        )}
      </div>
    </div>
  );
}
