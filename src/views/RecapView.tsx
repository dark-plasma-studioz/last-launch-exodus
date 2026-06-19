import type { ReactElement } from "react";
import type { RunState } from "../types";

export function RecapView(props: {
  state: RunState;
  onMenu: () => void;
}): ReactElement {
  const s = props.state;
  const dead = s.friends.filter((f) => f.status === "dead");

  return (
    <div className="panel">
      <h1>{s.outcome === "won" ? "You made the ship" : "Run ended"}</h1>
      {s.lostReason ? <p>{s.lostReason}</p> : null}
      <h2>Tombstones</h2>
      {dead.map((f) => (
        <p key={f.id}>
          Here lies <strong>{f.name}</strong>
          {f.deathCause ? ` — ${f.deathCause}` : ""}
          {f.deathDay !== undefined ? ` (day ${f.deathDay})` : ""}
        </p>
      ))}
      {dead.length === 0 ? (
        <p className="muted">No deaths this run.</p>
      ) : null}
      <p className="muted">
        Caps spent at depot: {s.scoreCapsSpent} · Days survived: {s.day}
      </p>
      <button type="button" className="btn btn-primary" onClick={props.onMenu}>
        Main menu
      </button>
    </div>
  );
}
