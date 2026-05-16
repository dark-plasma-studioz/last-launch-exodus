import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactElement,
  type SetStateAction,
} from "react";
import type { RunState } from "../types";
import { getItem } from "../config/items";
import {
  dismissRunModal,
  purchaseFromShop,
  resolveAmbientEvent,
  resolveChoice,
  resolveDailyTurn,
  templateString,
  type DailyAction,
} from "../engine/effects";
import { RunShopModal } from "./RunShopModal";
import { mulberry32 } from "../engine/rng";
import { LOCATION_LABEL } from "../engine/locations";
import {
  clearRunAutosave,
  saveRunAutosave,
} from "../engine/persistence";
import { RunLogSidebar } from "./RunLogSidebar";
import { RunPartySidebar } from "./RunPartySidebar";
import { RunStatsPanel } from "./RunStatsPanel";
import {
  buildAcknowledgments,
  buildFloatDeltas,
  snapshotRun,
  type Acknowledgment,
  type FloatDelta,
  type TransitionMode,
} from "./runSnapshot";

export function RunView(props: {
  state: RunState;
  setState: Dispatch<SetStateAction<RunState | null>>;
}): ReactElement {
  const { state, setState } = props;
  const [floats, setFloats] = useState<FloatDelta[]>([]);
  const [ackQueue, setAckQueue] = useState<Acknowledgment[]>([]);
  const snapRef = useRef<ReturnType<typeof snapshotRun> | null>(null);
  const transitionRef = useRef<TransitionMode | null>(null);
  const logSliceRef = useRef(0);

  const rng = useMemo(
    () => mulberry32((state.rngSeed + state.day * 7919) >>> 0),
    [state.rngSeed, state.day],
  );

  const displayEvent = useMemo(() => {
    if (!state.currentEvent) return null;
    const ev = state.currentEvent;
    const body = templateString(state, ev.body, "", rng);
    const title = templateString(state, ev.title, "", rng);
    return { ...ev, body, title };
  }, [state, rng]);

  const needsAck = ackQueue.length > 0;
  const isPaused =
    !!state.currentEvent ||
    !!state.runModal ||
    needsAck ||
    state.outcome !== "ongoing";

  const beginTransition = (mode: TransitionMode, logStart: number) => {
    transitionRef.current = mode;
    logSliceRef.current = logStart;
  };

  const doDay = useCallback(
    (action: DailyAction) => {
      setState((prev) => {
        if (!prev || prev.currentEvent || prev.runModal || prev.outcome !== "ongoing")
          return prev;
        beginTransition("daily", prev.log.length);
        const s = resolveDailyTurn(prev, action);
        if (s.outcome === "lost" || s.outcome === "won") clearRunAutosave();
        else saveRunAutosave(s);
        return s;
      });
    },
    [setState],
  );

  const dismissModal = useCallback(() => {
    setState((prev) => {
      if (!prev?.runModal) return prev;
      const s = dismissRunModal(prev);
      saveRunAutosave(s);
      return s;
    });
  }, [setState]);

  const buyFromShop = useCallback(
    (itemId: string, friendId?: string) => {
      setState((prev) => {
        if (!prev?.runModal || prev.runModal.kind !== "shop") return prev;
        const s = purchaseFromShop(prev, prev.runModal.location, itemId, friendId);
        saveRunAutosave(s);
        return s;
      });
    },
    [setState],
  );

  const dismissAck = useCallback(() => {
    setAckQueue((q) => q.slice(1));
  }, []);

  const pickChoice = useCallback(
    (choiceId: string) => {
      setState((prev) => {
        if (!prev?.currentEvent) return prev;
        beginTransition("event", prev.log.length);
        const r = mulberry32((prev.rngSeed + prev.day * 13001) >>> 0);
        let s = resolveChoice(prev, prev.currentEvent, choiceId, r);
        s = { ...s, currentEvent: null };
        if (s.outcome === "lost" || s.outcome === "won") clearRunAutosave();
        else saveRunAutosave(s);
        return s;
      });
    },
    [setState],
  );

  const confirmAmbient = useCallback(() => {
    setState((prev) => {
      if (!prev?.currentEvent || prev.currentEvent.kind !== "ambient") return prev;
      beginTransition("event", prev.log.length);
      const r = mulberry32((prev.rngSeed + prev.day * 13007) >>> 0);
      const s = resolveAmbientEvent(prev, r);
      if (s.outcome === "lost" || s.outcome === "won") clearRunAutosave();
      else saveRunAutosave(s);
      return s;
    });
  }, [setState]);

  const toggleAuto = useCallback(
    (on: boolean) => {
      setState((prev) => (prev ? { ...prev, autoTravel: on } : prev));
    },
    [setState],
  );

  useEffect(() => {
    saveRunAutosave(state);
  }, [state]);

  useEffect(() => {
    if (!snapRef.current) {
      snapRef.current = snapshotRun(state);
      return;
    }
    const mode = transitionRef.current;
    if (!mode) return;
    transitionRef.current = null;
    const before = snapRef.current;
    const after = snapshotRun(state);
    const newLogs = state.log.slice(logSliceRef.current).map((l) => l.text);
    setFloats(buildFloatDeltas(before, after));
    const acks = buildAcknowledgments(before, after, mode, newLogs);
    if (acks.length) setAckQueue((q) => [...q, ...acks]);
    snapRef.current = after;
  }, [state]);

  useEffect(() => {
    if (!state.autoTravel || isPaused || state.phase !== "run") return;
    const id = window.setInterval(() => {
      setState((prev) => {
        if (
          !prev?.autoTravel ||
          prev.currentEvent ||
          prev.runModal ||
          prev.outcome !== "ongoing"
        )
          return prev;
        beginTransition("daily", prev.log.length);
        const s = resolveDailyTurn(prev, "travel");
        if (s.outcome === "lost" || s.outcome === "won") clearRunAutosave();
        else saveRunAutosave(s);
        return s;
      });
    }, 1150);
    return () => clearInterval(id);
  }, [state.autoTravel, isPaused, state.phase, setState]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (needsAck && e.key === "Enter") {
        dismissAck();
        return;
      }
      if (!displayEvent || state.phase !== "run") return;
      if (displayEvent.kind === "ambient" && e.key === "Enter") {
        confirmAmbient();
        return;
      }
      const choices = displayEvent.choices ?? [];
      const n = Number(e.key);
      if (n >= 1 && n <= 9) {
        const ch = choices[n - 1];
        if (ch) pickChoice(ch.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [displayEvent, pickChoice, confirmAmbient, state.phase, needsAck, dismissAck]);

  const canAct =
    state.outcome === "ongoing" &&
    !state.currentEvent &&
    !state.runModal &&
    !needsAck &&
    state.phase === "run";

  const currentAck = ackQueue[0];

  const actionRow = (label: string, action: DailyAction) => (
    <button
      type="button"
      className="btn"
      disabled={!canAct}
      onClick={() => doDay(action)}
    >
      {label}
    </button>
  );

  return (
    <div className="run-layout">
      {state.runModal?.kind === "shop" ? (
        <RunShopModal
          state={state}
          location={state.runModal.location}
          onBuy={buyFromShop}
          onClose={dismissModal}
        />
      ) : null}

      {state.runModal &&
      (state.runModal.kind === "location" || state.runModal.kind === "notice") ? (
        <div className="modal-overlay">
          <div className="panel modal-card">
            <h2 style={{ marginTop: 0 }}>
              {state.runModal.kind === "location"
                ? `New region: ${LOCATION_LABEL[state.runModal.to]}`
                : state.runModal.title}
            </h2>
            <p className="modal-body-pre">{state.runModal.body}</p>
            <button type="button" className="btn btn-primary" onClick={dismissModal}>
              Continue
            </button>
            <p className="muted" style={{ marginTop: "0.75rem", marginBottom: 0 }}>
              Auto-travel pauses until you acknowledge this.
            </p>
          </div>
        </div>
      ) : null}

      {currentAck && !state.runModal ? (
        <div className="modal-overlay">
          <div className={`panel modal-card ${currentAck.critical ? "critical" : ""}`}>
            <h2 style={{ marginTop: 0 }}>{currentAck.title}</h2>
            <p className="modal-body-pre">{currentAck.body}</p>
            <button type="button" className="btn btn-primary" onClick={dismissAck}>
              Acknowledge
            </button>
            {ackQueue.length > 1 ? (
              <p className="muted" style={{ marginTop: "0.5rem", marginBottom: 0 }}>
                {ackQueue.length - 1} more update(s) after this.
              </p>
            ) : (
              <p className="muted" style={{ marginTop: "0.75rem", marginBottom: 0 }}>
                Press Enter to continue.
              </p>
            )}
          </div>
        </div>
      ) : null}

      <RunPartySidebar friends={state.friends} floats={floats} />

      <div className="run-main">
        <RunStatsPanel
          day={state.day}
          departureDaysRemaining={state.departureDaysRemaining}
          location={state.currentLocation}
          kmRemaining={state.kmRemaining}
          rads={state.rads}
          portChaos={state.portChaos}
          transport={state.transport}
          embarkEventsLeft={state.embarkEventsLeft}
          resources={state.resources}
          floats={floats}
          autoTravel={state.autoTravel}
          onAutoTravelChange={toggleAuto}
          outcomeOngoing={state.outcome === "ongoing"}
        />

        <div className="panel convoy-inventory-panel">
          <h2 className="convoy-inventory-title">Convoy inventory</h2>
          <p className="muted convoy-inventory-body">
            {state.inventory.length
              ? state.inventory
                  .map((e) => `${getItem(e.itemId)?.name ?? e.itemId}×${e.count}`)
                  .join(", ")
              : "No shared gear yet."}
          </p>
        </div>

        {displayEvent ? (
          <div className="panel">
            <h2>{displayEvent.title}</h2>
            <p>{displayEvent.body}</p>

            {displayEvent.kind === "ambient" ? (
              <>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={confirmAmbient}
                >
                  Continue
                </button>
                <p className="muted" style={{ marginTop: "0.5rem" }}>
                  Press Enter to acknowledge and apply the outcome.
                </p>
              </>
            ) : (
              <>
                <div className="choice-list">
                  {(displayEvent.choices ?? []).map((c, idx) => {
                    const disabled =
                      !!c.requiredItem &&
                      !state.inventory.some(
                        (i) => i.itemId === c.requiredItem && i.count > 0,
                      );
                    return (
                      <button
                        key={c.id}
                        type="button"
                        className="btn choice-btn"
                        disabled={disabled}
                        onClick={() => pickChoice(c.id)}
                      >
                        <kbd>{idx + 1}</kbd> {c.text}
                        {c.trait ? (
                          <span className="muted"> [{c.trait}]</span>
                        ) : null}
                        {disabled ? (
                          <span className="muted"> (needs item)</span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
                <p className="muted" style={{ marginTop: "0.5rem" }}>
                  Auto-travel paused. Keys 1–9 to choose. Success odds appear in
                  the log only after you commit.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="panel">
            <h2 style={{ marginTop: 0 }}>Today</h2>
            <p className="muted">
              {state.kmRemaining > 0
                ? "Travel can trigger road events. Scavenge finds supplies and salvage encounters. Rest, repair, and scout do not trigger random events."
                : "Embarkation queue: each day burns supplies."}
            </p>
            <div className="row" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
              {actionRow("Travel", "travel")}
              {state.kmRemaining > 0 ? actionRow("Scavenge", "scavenge") : null}
              {state.kmRemaining > 0 ? actionRow("Rest camp", "rest") : null}
              {state.kmRemaining > 0 ? actionRow("Repair convoy", "repair") : null}
              {state.kmRemaining > 0 ? actionRow("Scout ahead", "scout") : null}
            </div>
          </div>
        )}
      </div>

      <RunLogSidebar log={state.log} />
    </div>
  );
}
