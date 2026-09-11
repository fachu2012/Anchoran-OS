import { useEffect, useState } from "react";

export function Clock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000 * 15);
    return () => clearInterval(timer);
  }, []);

  const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return <span className="system-clock">{time}</span>;
}

export function DateLabel() {
  const [now] = useState(new Date());
  return (
    <span className="system-clock">
      {now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
    </span>
  );
}
