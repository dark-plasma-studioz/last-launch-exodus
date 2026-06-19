import { useMemo, type ReactElement } from "react";
import type { RunState } from "../types";
import { loadRunAutosave } from "../engine/persistence";

export function TitleView(props: {
  onNew: () => void;
  onContinue: (s: RunState) => void;
}): ReactElement {
  const saved = useMemo(() => loadRunAutosave(), []);
  const canContinue =
    saved && saved.phase === "run" && saved.outcome === "ongoing";

  return (
    <div className="panel">
      <h1>Last Launch Exodus</h1>
      <p className="muted">
        Post-nuclear road to the last colony ship. Name your party at the
        roster, stock up at the depot, then survive the journey to the last
        launch window.
      </p>
      <div className="row" style={{ marginTop: "0.75rem" }}>
        <button type="button" className="btn btn-primary" onClick={props.onNew}>
          New expedition
        </button>
        {canContinue ? (
          <button
            type="button"
            className="btn"
            onClick={() => props.onContinue(saved!)}
          >
            Continue saved run
          </button>
        ) : null}
      </div>
    </div>
  );
}
