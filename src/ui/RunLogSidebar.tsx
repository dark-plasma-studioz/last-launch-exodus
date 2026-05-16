import { useEffect, useRef, type ReactElement } from "react";
import type { LogEntry } from "../types";

export function RunLogSidebar(props: { log: LogEntry[] }): ReactElement {
  const scrollRef = useRef<HTMLDivElement>(null);
  const latestKey =
    props.log.length > 0
      ? `${props.log.length}:${props.log[props.log.length - 1]?.day}:${props.log[props.log.length - 1]?.text.slice(0, 40)}`
      : "empty";

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Newest entries are rendered first — keep scroll at top
    el.scrollTop = 0;
  }, [latestKey]);

  const entries = props.log.slice().reverse();

  return (
    <aside className="run-log-sidebar panel">
      <h2 className="run-sidebar-title">Log</h2>
      <div ref={scrollRef} className="log log-sidebar">
        {entries.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No entries yet.
          </p>
        ) : (
          entries.map((l, i) => (
            <div
              key={`${l.day}-${entries.length - i}-${l.text.slice(0, 24)}`}
              className="log-entry"
            >
              <span className="log-day">Day {l.day}</span>
              <span className="log-text">{l.text}</span>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
