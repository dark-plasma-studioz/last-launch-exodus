import { useEffect, useState, type ReactElement } from "react";
import type { LocationId, RunResources } from "../types";
import { LOCATION_LABEL } from "../engine/locations";
import type { FloatDelta } from "./runSnapshot";

interface RunStatsPanelProps {
  day: number;
  departureDaysRemaining: number;
  location: LocationId;
  kmRemaining: number;
  rads: number;
  portChaos: number;
  transport: number;
  embarkEventsLeft: number;
  resources: RunResources;
  floats: FloatDelta[];
  autoTravel: boolean;
  onAutoTravelChange: (on: boolean) => void;
  outcomeOngoing: boolean;
}

function StatCell(props: {
  statKey: string;
  label: string;
  value: string | number;
  floats: FloatDelta[];
  warn?: boolean;
}): ReactElement {
  const [active, setActive] = useState<FloatDelta[]>([]);

  useEffect(() => {
    const hits = props.floats.filter((f) => f.statKey === props.statKey);
    if (!hits.length) return;
    setActive((prev) => [...prev, ...hits]);
    const t = window.setTimeout(() => {
      setActive((prev) =>
        prev.filter((f) => !hits.some((h) => h.id === f.id)),
      );
    }, 1300);
    return () => clearTimeout(t);
  }, [props.floats, props.statKey]);

  return (
    <div className={`stat-cell ${props.warn ? "stat-warn" : ""}`}>
      <span className="stat-label">{props.label}</span>
      <span className="stat-value-wrap">
        <span className="stat-value">{props.value}</span>
        {active.map((f) => (
          <span
            key={f.id}
            className={`stat-float ${f.delta > 0 ? "positive" : "negative"}`}
          >
            {f.delta > 0 ? "+" : ""}
            {f.delta}
          </span>
        ))}
      </span>
    </div>
  );
}

export function RunStatsPanel(props: RunStatsPanelProps): ReactElement {
  const { floats } = props;
  const lowRations = props.resources.rations <= 5;

  return (
    <div className="panel run-stats-panel">
      <div className="run-stats-header">
        <h1 style={{ margin: 0 }}>Journey</h1>
        <label className="auto-travel-toggle">
          <input
            type="checkbox"
            checked={props.autoTravel}
            onChange={(e) => props.onAutoTravelChange(e.target.checked)}
            disabled={!props.outcomeOngoing}
          />
          Auto-travel
        </label>
      </div>

      <section className="stat-section">
        <h3 className="stat-section-title">Time & route</h3>
        <div className="stat-grid-organized">
          <StatCell statKey="day" label="Day" value={props.day} floats={floats} />
          <StatCell
            statKey="departure"
            label="Departure"
            value={`${props.departureDaysRemaining}d`}
            floats={floats}
            warn={props.departureDaysRemaining < 60}
          />
          <StatCell
            statKey="location"
            label="Region"
            value={LOCATION_LABEL[props.location]}
            floats={floats}
          />
          <StatCell
            statKey="km"
            label="Distance"
            value={`${Math.round(props.kmRemaining)} km`}
            floats={floats}
          />
        </div>
      </section>

      <section className="stat-section">
        <h3 className="stat-section-title">Convoy</h3>
        <div className="stat-grid-organized">
          <StatCell
            statKey="transport"
            label="Transport"
            value={Math.round(props.transport)}
            floats={floats}
            warn={props.transport < 35}
          />
          <StatCell
            statKey="portChaos"
            label="Port chaos"
            value={Math.round(props.portChaos)}
            floats={floats}
          />
          <StatCell
            statKey="rads"
            label="Rads"
            value={Math.round(props.rads)}
            floats={floats}
            warn={props.rads > 50}
          />
          <StatCell
            statKey="embark"
            label="Embark steps"
            value={props.embarkEventsLeft}
            floats={floats}
          />
        </div>
      </section>

      <section className="stat-section">
        <h3 className="stat-section-title">Supplies</h3>
        <div className="stat-grid-organized">
          <StatCell
            statKey="rations"
            label="Rations"
            value={props.resources.rations}
            floats={floats}
            warn={lowRations}
          />
          <StatCell
            statKey="meds"
            label="Meds"
            value={props.resources.meds}
            floats={floats}
          />
          <StatCell
            statKey="parts"
            label="Parts"
            value={props.resources.parts}
            floats={floats}
          />
          <StatCell
            statKey="fuel"
            label="Fuel"
            value={props.resources.fuel}
            floats={floats}
          />
          <StatCell
            statKey="caps"
            label="Caps"
            value={props.resources.caps}
            floats={floats}
          />
        </div>
      </section>
    </div>
  );
}
