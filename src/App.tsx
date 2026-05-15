import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactElement,
  type SetStateAction,
} from "react";
import type { DifficultyId, Friend, RunState, TraitId } from "./types";
import {
  DIFFICULTY,
  makeFriend,
  rollPartyTraits,
  validateRosterNames,
} from "./config/difficulty";
import { ITEMS, getItem } from "./config/items";
import {
  dismissRunModal,
  resolveChoice,
  resolveDailyTurn,
  templateString,
  type DailyAction,
} from "./engine/effects";
import { mulberry32 } from "./engine/rng";
import { applyDepotCheckout, createRunState } from "./engine/runBootstrap";
import { LOCATION_LABEL } from "./engine/locations";
import {
  clearRunAutosave,
  loadRunAutosave,
  loadRoster,
  saveRunAutosave,
  saveRoster,
} from "./engine/persistence";

type DraftFriend = { id: string; name: string; traits: TraitId[] };

const MIN_PARTY = 2;
const MAX_PARTY = 8;

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function TitleView(props: {
  onNew: () => void;
  onContinue: (s: RunState) => void;
}): ReactElement {
  const saved = useMemo(() => loadRunAutosave(), []);
  return (
    <div className="panel">
      <h1>Last Launch Exodus</h1>
      <p className="muted">
        Post-nuclear road to the last colony ship. Names at the roster, random
        strengths and flaws at the depot, then day-by-day survival toward the
        last launch window.
      </p>
      <div className="row" style={{ marginTop: "0.75rem" }}>
        <button type="button" className="btn btn-primary" onClick={props.onNew}>
          New expedition
        </button>
        {saved && saved.phase === "run" && saved.outcome === "ongoing" ? (
          <button
            type="button"
            className="btn"
            onClick={() => props.onContinue(saved)}
          >
            Continue saved run
          </button>
        ) : null}
      </div>
    </div>
  );
}

function RosterView(props: {
  difficulty: DifficultyId;
  setDifficulty: (d: DifficultyId) => void;
  partyCount: number;
  setPartyCount: (n: number) => void;
  drafts: DraftFriend[];
  setDrafts: Dispatch<SetStateAction<DraftFriend[]>>;
  onBack: () => void;
  onNext: () => void;
  error: string | null;
}): ReactElement {
  const syncDraftRows = (n: number) => {
    props.setDrafts((prev) => {
      const next = [...prev];
      while (next.length < n) {
        next.push({ id: newId(), name: "", traits: [] });
      }
      while (next.length > n) next.pop();
      return next;
    });
  };

  useEffect(() => {
    syncDraftRows(props.partyCount);
  }, [props.partyCount]);

  return (
    <div>
      <div className="panel">
        <h1>Roster</h1>
        <p className="muted">
          Difficulty sets calendar days until departure ({Object.entries(DIFFICULTY).map(([k, v]) => (
            <span key={k}>
              {v.label}: {v.years}y (
              {Math.round(v.years * 365)}d){" "}
            </span>
          ))}
          ). Traits are rolled at the depot—mix of useful instincts and costly
          flaws.
        </p>
        <div className="row" style={{ marginBottom: "0.75rem" }}>
          <label>
            Difficulty{" "}
            <select
              value={props.difficulty}
              onChange={(e) =>
                props.setDifficulty(e.target.value as DifficultyId)
              }
            >
              <option value="easier">Easier</option>
              <option value="standard">Standard</option>
              <option value="hard">Hard</option>
            </select>
          </label>
          <label>
            Party size{" "}
            <select
              value={props.partyCount}
              onChange={(e) =>
                props.setPartyCount(Number(e.target.value))
              }
            >
              {Array.from({ length: MAX_PARTY - MIN_PARTY + 1 }, (_, i) => (
                <option key={i} value={MIN_PARTY + i}>
                  {MIN_PARTY + i}
                </option>
              ))}
            </select>
          </label>
        </div>
        {props.error ? (
          <p style={{ color: "var(--danger)" }}>{props.error}</p>
        ) : null}
      </div>
      {props.drafts.map((d) => (
        <div key={d.id} className="panel">
          <label>
            Name{" "}
            <input
              value={d.name}
              onChange={(e) =>
                props.setDrafts((rows) =>
                  rows.map((r) =>
                    r.id === d.id ? { ...r, name: e.target.value } : r,
                  ),
                )
              }
              placeholder="Friend name"
            />
          </label>
        </div>
      ))}
      <div className="row">
        <button type="button" className="btn" onClick={props.onBack}>
          Back
        </button>
        <button type="button" className="btn btn-primary" onClick={props.onNext}>
          Depot
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            const json = JSON.stringify({
              difficulty: props.difficulty,
              partyCount: props.partyCount,
              drafts: props.drafts,
            });
            void navigator.clipboard.writeText(json);
            saveRoster(json);
          }}
        >
          Export roster JSON
        </button>
        <label className="btn">
          Import roster JSON
          <input
            type="file"
            accept="application/json"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const reader = new FileReader();
              reader.onload = () => {
                try {
                  const data = JSON.parse(String(reader.result)) as {
                    difficulty: DifficultyId;
                    partyCount: number;
                    drafts: DraftFriend[];
                  };
                  props.setDifficulty(data.difficulty ?? "standard");
                  props.setPartyCount(
                    Math.min(
                      MAX_PARTY,
                      Math.max(MIN_PARTY, data.partyCount ?? MIN_PARTY),
                    ),
                  );
                  props.setDrafts(data.drafts ?? []);
                } catch {
                  /* ignore */
                }
              };
              reader.readAsText(f);
            }}
          />
        </label>
      </div>
    </div>
  );
}

function DepotView(props: {
  difficulty: DifficultyId;
  partyCount: number;
  drafts: DraftFriend[];
  setDrafts: Dispatch<SetStateAction<DraftFriend[]>>;
  cart: Record<string, number>;
  setCart: Dispatch<SetStateAction<Record<string, number>>>;
  onBack: () => void;
  onStart: () => void;
}): ReactElement {
  const caps = DIFFICULTY[props.difficulty].startingCaps;
  const spent = useMemo(() => {
    let s = 0;
    for (const [id, c] of Object.entries(props.cart)) {
      const def = getItem(id);
      if (!def) continue;
      s += def.price * (c ?? 0);
    }
    return s;
  }, [props.cart]);
  const remaining = caps - spent;

  const setLine = (id: string, val: number) => {
    props.setCart((prev) => ({ ...prev, [id]: Math.max(0, val) }));
  };

  return (
    <div>
      <div className="panel">
        <h1>Starting depot</h1>
        <p className="muted">
          Caps: <strong>{caps}</strong> · Cart: <strong>{spent}</strong> · Left:{" "}
          <strong style={{ color: remaining < 0 ? "var(--danger)" : "inherit" }}>
            {remaining}
          </strong>
        </p>
        <p className="muted">
          Commons add rations, water, meds, parts, or fuel. Uniques go in your
          inventory and change rules during encounters.
        </p>
      </div>
      <div className="panel">
        <h2>Party traits</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Random mix of strengths and flaws. Reroll if you want another draw
          before launch.
        </p>
        {props.drafts.map((d) => (
          <div key={d.id} style={{ marginBottom: "0.75rem" }}>
            <strong>{d.name.trim() || "—"}</strong>
            <div style={{ marginTop: "0.25rem" }}>
              {d.traits.length ? (
                d.traits.map((t) => (
                  <span key={t} className="trait-chip on">
                    {t}
                  </span>
                ))
              ) : (
                <span className="muted">Not rolled yet</span>
              )}
            </div>
          </div>
        ))}
        <button
          type="button"
          className="btn"
          onClick={() => {
            const seed = (Math.random() * 0xffffffff) >>> 0;
            const rolls = rollPartyTraits(seed, props.drafts.length);
            props.setDrafts((prev) =>
              prev.map((row, i) => ({ ...row, traits: rolls[i] ?? [] })),
            );
          }}
        >
          Reroll all traits
        </button>
      </div>
      <div className="panel">
        {ITEMS.map((it) => (
          <div
            key={it.id}
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.5rem",
              alignItems: "center",
              marginBottom: "0.55rem",
            }}
          >
            <div style={{ flex: "1 1 220px" }}>
              <strong>{it.name}</strong>{" "}
              <span className="muted">
                ({it.price}c) — {it.description}
              </span>
            </div>
            <label>
              Qty{" "}
              <input
                type="number"
                min={0}
                max={it.kind === "unique" ? 1 : 99}
                value={props.cart[it.id] ?? 0}
                onChange={(e) => setLine(it.id, Number(e.target.value))}
                style={{ width: "4rem" }}
              />
            </label>
          </div>
        ))}
      </div>
      <div className="row">
        <button type="button" className="btn" onClick={props.onBack}>
          Back
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={remaining < 0}
          onClick={props.onStart}
        >
          Begin run
        </button>
      </div>
    </div>
  );
}

function RunView(props: {
  state: RunState;
  setState: Dispatch<SetStateAction<RunState | null>>;
}): ReactElement {
  const { state, setState } = props;
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

  const doDay = useCallback(
    (action: DailyAction) => {
      setState((prev) => {
        if (!prev || prev.currentEvent || prev.runModal || prev.outcome !== "ongoing")
          return prev;
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

  const pickChoice = useCallback(
    (choiceId: string) => {
      setState((prev) => {
        if (!prev?.currentEvent) return prev;
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
    if (
      !state.autoTravel ||
      state.currentEvent ||
      state.runModal ||
      state.phase !== "run" ||
      state.outcome !== "ongoing"
    )
      return;
    const id = window.setInterval(() => {
      setState((prev) => {
        if (
          !prev?.autoTravel ||
          prev.currentEvent ||
          prev.runModal ||
          prev.outcome !== "ongoing"
        )
          return prev;
        const s = resolveDailyTurn(prev, "travel");
        if (s.outcome === "lost" || s.outcome === "won") clearRunAutosave();
        else saveRunAutosave(s);
        return s;
      });
    }, 1150);
    return () => clearInterval(id);
  }, [
    state.autoTravel,
    state.currentEvent,
    state.runModal,
    state.phase,
    state.outcome,
    setState,
  ]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!displayEvent || state.phase !== "run") return;
      const n = Number(e.key);
      if (n >= 1 && n <= 9) {
        const ch = displayEvent.choices[n - 1];
        if (ch) pickChoice(ch.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [displayEvent, pickChoice, state.phase]);

  const canAct =
    state.outcome === "ongoing" &&
    !state.currentEvent &&
    !state.runModal &&
    state.phase === "run";

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
    <div>
      {state.runModal ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: "1rem",
          }}
        >
          <div className="panel" style={{ maxWidth: "32rem", width: "100%" }}>
            <h2 style={{ marginTop: 0 }}>
              {state.runModal.kind === "location"
                ? `New region: ${LOCATION_LABEL[state.runModal.to]}`
                : state.runModal.title}
            </h2>
            <p>{state.runModal.body}</p>
            <button type="button" className="btn btn-primary" onClick={dismissModal}>
              Continue
            </button>
            <p className="muted" style={{ marginTop: "0.75rem", marginBottom: 0 }}>
              Auto-travel pauses until you dismiss this.
            </p>
          </div>
        </div>
      ) : null}

      <div className="panel">
        <h1>Journey</h1>
        <div className="stat-grid">
          <div className="stat">Day {state.day}</div>
          <div className="stat">
            Departure in {state.departureDaysRemaining}d
          </div>
          <div className="stat">Location {LOCATION_LABEL[state.currentLocation]}</div>
          <div className="stat">Km {Math.round(state.kmRemaining)}</div>
          <div className="stat">Rads {Math.round(state.rads)}</div>
          <div className="stat">Port chaos {Math.round(state.portChaos)}</div>
          <div className="stat">Transport {Math.round(state.transport)}</div>
          <div className="stat">Embark left {state.embarkEventsLeft}</div>
        </div>
        <div className="stat-grid" style={{ marginTop: "0.5rem" }}>
          <div className="stat">Rations {state.resources.rations}</div>
          <div className="stat">Water {state.resources.water}</div>
          <div className="stat">Meds {state.resources.meds}</div>
          <div className="stat">Parts {state.resources.parts}</div>
          <div className="stat">Fuel {state.resources.fuel}</div>
          <div className="stat">Caps {state.resources.caps}</div>
        </div>
        <div style={{ marginTop: "0.5rem" }} className="muted">
          Inventory:{" "}
          {state.inventory.length
            ? state.inventory
                .map((e) => `${getItem(e.itemId)?.name ?? e.itemId}×${e.count}`)
                .join(", ")
            : "—"}
        </div>
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            marginTop: "0.75rem",
          }}
        >
          <input
            type="checkbox"
            checked={state.autoTravel}
            onChange={(e) => toggleAuto(e.target.checked)}
            disabled={state.outcome !== "ongoing"}
          />
          Auto-travel (each tick does <strong>Travel</strong>; pauses for events,
          injuries, and region changes)
        </label>
      </div>

      <div className="panel">
        <h2>Party</h2>
        {state.friends.map((f) => (
          <div key={f.id} style={{ marginBottom: "0.35rem" }}>
            <strong>{f.name}</strong>{" "}
            <span className="muted">
              HP {f.health}/{f.maxHealth} · Morale {f.morale} · {f.status}
            </span>
            <div>
              {f.traits.map((t) => (
                <span key={t} className="trait-chip on">
                  {t}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {displayEvent ? (
        <div className="panel">
          <h2>{displayEvent.title}</h2>
          <p>{displayEvent.body}</p>
          <div className="choice-list">
            {displayEvent.choices.map((c, idx) => {
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
                  {c.trait && c.dc !== undefined ? (
                    <span className="muted"> · {c.trait} DC{c.dc}</span>
                  ) : null}
                  {disabled ? (
                    <span className="muted"> (needs item)</span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <p className="muted" style={{ marginTop: "0.5rem" }}>
            Auto-travel is paused until you resolve this. Keyboard 1–9 picks a
            choice.
          </p>
        </div>
      ) : (
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>Today</h2>
          <p className="muted">
            {state.kmRemaining > 0
              ? "Pick one action for the day. Travel advances distance; scavenge can find food; rest heals; repair spends parts on transport; scout can set up a safer next travel leg."
              : "Embarkation queue: each day still burns supplies. Travel action is the only option on the sheet—use auto-travel if you want to grind the queue."}
          </p>
          <div className="row" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
            {actionRow("Travel", "travel")}
            {state.kmRemaining > 0 ? actionRow("Scavenge for food", "scavenge") : null}
            {state.kmRemaining > 0 ? actionRow("Rest camp", "rest") : null}
            {state.kmRemaining > 0 ? actionRow("Repair convoy", "repair") : null}
            {state.kmRemaining > 0 ? actionRow("Scout ahead", "scout") : null}
          </div>
        </div>
      )}

      <div className="panel">
        <h2>Log</h2>
        <div className="log">
          {state.log
            .slice()
            .reverse()
            .map((l, i) => (
              <div key={i} className="log-entry">
                [day {l.day}] {l.text}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function RecapView(props: {
  state: RunState;
  onMenu: () => void;
}): ReactElement {
  const s = props.state;
  return (
    <div className="panel">
      <h1>{s.outcome === "won" ? "You made the ship" : "Run ended"}</h1>
      {s.lostReason ? <p>{s.lostReason}</p> : null}
      <h2>Tombstones</h2>
      {s.friends
        .filter((f) => f.status === "dead")
        .map((f) => (
          <p key={f.id}>
            Here lies <strong>{f.name}</strong>
            {f.deathCause ? ` — ${f.deathCause}` : ""}
            {f.deathDay !== undefined ? ` (day ${f.deathDay})` : ""}
          </p>
        ))}
      {s.friends.every((f) => f.status !== "dead") ? (
        <p className="muted">No deaths this run. Miracles happen. Suspicious ones.</p>
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

export default function App(): ReactElement {
  const [screen, setScreen] = useState<
    "title" | "roster" | "depot" | "run" | "recap"
  >("title");
  const [difficulty, setDifficulty] = useState<DifficultyId>("standard");
  const [partyCount, setPartyCount] = useState(4);
  const [drafts, setDrafts] = useState<DraftFriend[]>([]);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [run, setRun] = useState<RunState | null>(null);

  useEffect(() => {
    const raw = loadRoster();
    if (!raw) return;
    try {
      const data = JSON.parse(raw) as {
        difficulty: DifficultyId;
        partyCount: number;
        drafts: DraftFriend[];
      };
      setDifficulty(data.difficulty ?? "standard");
      setPartyCount(
        Math.min(MAX_PARTY, Math.max(MIN_PARTY, data.partyCount ?? MIN_PARTY)),
      );
      setDrafts(data.drafts ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  const validateRoster = (): string | null =>
    validateRosterNames(drafts.map((d) => d.name));

  const friendsFromDrafts = (): Friend[] => {
    const seed = (Math.random() * 0xffffffff) >>> 0;
    const rolls = rollPartyTraits(seed, drafts.length);
    return drafts.map((d, i) =>
      makeFriend(d.id, d.name, d.traits.length ? d.traits : (rolls[i] ?? [])),
    );
  };

  const startRun = () => {
    const checkout = applyDepotCheckout(difficulty, partyCount, { lines: cart });
    const friends = friendsFromDrafts();
    const rs = createRunState({
      difficulty,
      friends,
      inventory: checkout.inventory,
      resources: checkout.resources,
      rngSeed: (Math.random() * 0xffffffff) >>> 0,
      capsSpentAtDepot: checkout.capsSpent,
    });
    setRun(rs);
    setScreen("run");
    saveRunAutosave(rs);
  };

  return (
    <div className="app-shell">
      {screen === "title" ? (
        <TitleView
          onNew={() => {
            setScreen("roster");
            setPartyCount(4);
            setDrafts(
              Array.from({ length: 4 }, () => ({
                id: newId(),
                name: "",
                traits: [],
              })),
            );
          }}
          onContinue={(s) => {
            setRun(s);
            setScreen("run");
          }}
        />
      ) : null}
      {screen === "roster" ? (
        <RosterView
          difficulty={difficulty}
          setDifficulty={setDifficulty}
          partyCount={partyCount}
          setPartyCount={setPartyCount}
          drafts={drafts}
          setDrafts={setDrafts}
          error={rosterError}
          onBack={() => {
            setRosterError(null);
            setScreen("title");
          }}
          onNext={() => {
            const err = validateRoster();
            setRosterError(err);
            if (!err) {
              const seed = (Math.random() * 0xffffffff) >>> 0;
              const rolls = rollPartyTraits(seed, drafts.length);
              const nextDrafts = drafts.map((row, i) => ({
                ...row,
                traits: rolls[i] ?? [],
              }));
              setDrafts(nextDrafts);
              saveRoster(
                JSON.stringify({
                  difficulty,
                  partyCount,
                  drafts: nextDrafts,
                }),
              );
              setScreen("depot");
            }
          }}
        />
      ) : null}
      {screen === "depot" ? (
        <DepotView
          difficulty={difficulty}
          partyCount={partyCount}
          drafts={drafts}
          setDrafts={setDrafts}
          cart={cart}
          setCart={setCart}
          onBack={() => setScreen("roster")}
          onStart={startRun}
        />
      ) : null}
      {screen === "run" && run ? (
        <RunView
          state={run}
          setState={(up) => {
            setRun((prev) => {
              if (!prev) return prev;
              const next = typeof up === "function" ? up(prev) : up;
              if (next?.phase === "recap") setScreen("recap");
              return next;
            });
          }}
        />
      ) : null}
      {screen === "recap" && run ? (
        <RecapView
          state={run}
          onMenu={() => {
            clearRunAutosave();
            setRun(null);
            setScreen("title");
          }}
        />
      ) : null}
    </div>
  );
}
