import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactElement,
  type SetStateAction,
} from "react";
import { type DifficultyId, type RunState } from "./types";
import {
  DIFFICULTY,
  makeParty,
  validateRosterNames,
} from "./config/difficulty";
import { getSpecialty, SPECIALTIES } from "./config/traits";

// Fixed preview order so each roster slot shows a different specialty hint
const PREVIEW_SPECIALTIES = SPECIALTIES.map((s) => s.id);
import { ITEMS, getItem } from "./config/items";
import { applyDepotCheckout, createRunState } from "./engine/runBootstrap";
import type { PersonalAssignments } from "./engine/runBootstrap";
import { RunView } from "./ui/RunView";
import {
  clearRunAutosave,
  loadRunAutosave,
  loadRoster,
  saveRunAutosave,
  saveRoster,
} from "./engine/persistence";

type DraftFriend = { id: string; name: string };

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
        Post-nuclear road to the last colony ship. Name your party at the
        roster, stock up at the depot, then survive the journey to the last
        launch window.
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
      while (next.length < n) next.push({ id: newId(), name: "" });
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
          Difficulty sets the calendar window until departure (
          {Object.entries(DIFFICULTY).map(([k, v]) => (
            <span key={k}>
              {v.label}: {Math.round(v.years * 365)}d{" "}
            </span>
          ))}
          ). Name your party, then head to the depot to stock up.
        </p>
        <div className="row" style={{ marginBottom: "0.75rem" }}>
          <label>
            Difficulty{" "}
            <select
              value={props.difficulty}
              onChange={(e) => props.setDifficulty(e.target.value as DifficultyId)}
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
              onChange={(e) => props.setPartyCount(Number(e.target.value))}
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
      <p className="muted" style={{ marginTop: "0.25rem" }}>
        Specialties and traits are assigned randomly when you start. Each member gets a unique specialty.
      </p>
      {props.drafts.map((d, idx) => {
        const previewSpecialty = PREVIEW_SPECIALTIES[idx % PREVIEW_SPECIALTIES.length];
        const spec = getSpecialty(previewSpecialty);
        return (
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
            <span className="muted" style={{ fontSize: "0.75rem", marginLeft: "0.75rem" }}>
              Preview specialty: <strong>{spec.name}</strong> — {spec.description}
            </span>
          </div>
        );
      })}
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
                    Math.min(MAX_PARTY, Math.max(MIN_PARTY, data.partyCount ?? MIN_PARTY)),
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
  cart: Record<string, number>;
  setCart: Dispatch<SetStateAction<Record<string, number>>>;
  personalAssignments: PersonalAssignments;
  setPersonalAssignments: Dispatch<SetStateAction<PersonalAssignments>>;
  onBack: () => void;
  onStart: () => void;
}): ReactElement {
  const caps = DIFFICULTY[props.difficulty].startingCaps;

  const commonItems = useMemo(() => ITEMS.filter((i) => i.kind === "common"), []);
  const uniqueItems = useMemo(() => ITEMS.filter((i) => i.kind === "unique"), []);
  const personalItems = useMemo(() => ITEMS.filter((i) => i.kind === "personal"), []);

  const spent = useMemo(() => {
    let s = 0;
    for (const [id, c] of Object.entries(props.cart)) {
      const def = getItem(id);
      if (!def) continue;
      s += def.price * (c ?? 0);
    }
    for (const it of personalItems) {
      if (props.personalAssignments[it.id]) s += it.price;
    }
    return s;
  }, [props.cart, props.personalAssignments, personalItems]);
  const remaining = caps - spent;

  const setLine = (id: string, val: number) =>
    props.setCart((prev) => ({ ...prev, [id]: Math.max(0, val) }));

  const assignPersonal = (itemId: string, draftId: string) =>
    props.setPersonalAssignments((prev) => ({ ...prev, [itemId]: draftId }));

  return (
    <div>
      <div className="panel">
        <h1>Starting depot</h1>
        <p className="muted">
          Caps: <strong>{caps}</strong> · Spent: <strong>{spent}</strong> · Left:{" "}
          <strong style={{ color: remaining < 0 ? "var(--danger)" : "inherit" }}>
            {remaining}
          </strong>
        </p>
        <p className="muted">
          Common supplies add starting resources. Unique gear changes how the
          convoy handles encounters. Personal items are assigned to one party
          member and give them individual bonuses throughout the run.
        </p>
      </div>

      {/* Common items */}
      <div className="panel">
        <h2>Common supplies</h2>
        {commonItems.map((it) => (
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
              <span className="muted">({it.price}c) — {it.description}</span>
            </div>
            <label>
              Qty{" "}
              <input
                type="number"
                min={0}
                max={99}
                value={props.cart[it.id] ?? 0}
                onChange={(e) => setLine(it.id, Number(e.target.value))}
                style={{ width: "4rem" }}
              />
            </label>
          </div>
        ))}
      </div>

      {/* Unique items */}
      <div className="panel">
        <h2>Unique gear</h2>
        {uniqueItems.map((it) => (
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
              <span className="muted">({it.price}c) — {it.description}</span>
            </div>
            <label>
              Qty{" "}
              <input
                type="number"
                min={0}
                max={1}
                value={props.cart[it.id] ?? 0}
                onChange={(e) => setLine(it.id, Number(e.target.value))}
                style={{ width: "4rem" }}
              />
            </label>
          </div>
        ))}
      </div>

      {/* Personal items */}
      <div className="panel">
        <h2>Personal equipment</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Each item is assigned to one party member. Select them from the
          dropdown to purchase it for them.
        </p>
        {personalItems.map((it) => {
          const assignedId = props.personalAssignments[it.id] ?? "";
          return (
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
                Assign to{" "}
                <select
                  value={assignedId}
                  onChange={(e) => assignPersonal(it.id, e.target.value)}
                >
                  <option value="">— not purchased —</option>
                  {props.drafts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name.trim() || "(unnamed)"}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          );
        })}
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

function RecapView(props: { state: RunState; onMenu: () => void }): ReactElement {
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

export default function App(): ReactElement {
  const [screen, setScreen] = useState<"title" | "roster" | "depot" | "run" | "recap">("title");
  const [difficulty, setDifficulty] = useState<DifficultyId>("standard");
  const [partyCount, setPartyCount] = useState(4);
  const [drafts, setDrafts] = useState<DraftFriend[]>([]);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [personalAssignments, setPersonalAssignments] = useState<PersonalAssignments>({});
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
      setPartyCount(Math.min(MAX_PARTY, Math.max(MIN_PARTY, data.partyCount ?? MIN_PARTY)));
      setDrafts(data.drafts ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  const validateRoster = (): string | null =>
    validateRosterNames(drafts.map((d) => d.name));

  const startRun = () => {
    const cartWithPersonal: Record<string, number> = { ...cart };
    for (const [itemId, draftId] of Object.entries(personalAssignments)) {
      if (draftId) cartWithPersonal[itemId] = 1;
    }
    const checkout = applyDepotCheckout(difficulty, partyCount, { lines: cartWithPersonal });
    const seed = (Math.random() * 0xffffffff) >>> 0;
    const friends = makeParty(drafts, seed);
    const rs = createRunState({
      difficulty,
      friends,
      inventory: checkout.inventory,
      resources: checkout.resources,
      rngSeed: seed,
      capsSpentAtDepot: checkout.capsSpent,
      capsRemaining: checkout.capsRemaining,
      personalAssignments,
    });
    setRun(rs);
    setScreen("run");
    saveRunAutosave(rs);
  };

  return (
    <div className={`app-shell${screen === "run" ? " app-shell--run" : ""}`}>
      {screen === "title" ? (
        <TitleView
          onNew={() => {
            setScreen("roster");
            setPartyCount(4);
            setDrafts(Array.from({ length: 4 }, () => ({ id: newId(), name: "" })));
          }}
          onContinue={(s) => { setRun(s); setScreen("run"); }}
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
          onBack={() => { setRosterError(null); setScreen("title"); }}
          onNext={() => {
            const err = validateRoster();
            setRosterError(err);
            if (!err) {
              saveRoster(JSON.stringify({ difficulty, partyCount, drafts }));
              setCart({});
              setPersonalAssignments({});
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
          cart={cart}
          setCart={setCart}
          personalAssignments={personalAssignments}
          setPersonalAssignments={setPersonalAssignments}
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
