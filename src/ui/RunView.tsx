import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactElement,
  type SetStateAction,
} from "react";
import { createPortal } from "react-dom";
import type { Friend, GameEvent, MemberSlot, Pace, RunState } from "../types";
import {
  PACE_ALL_TIP,
  PACE_LABEL,
  paceTravelTip,
  resolveDailyTurn,
  resolveChoice,
  resolveAmbientEvent,
  dismissRunModal,
  purchaseFromShop,
  fillSlot,
} from "../engine/effects";
import { getSpecialty, getTrait } from "../config/traits";
import { mulberry32 } from "../engine/rng";
import { LOCATION_LABEL } from "../engine/locations";
import { getItem } from "../config/items";
import { saveRunAutosave } from "../engine/persistence";
import { snapshotRun, buildFloatDeltas, buildAcknowledgments, type FloatDelta, type Acknowledgment } from "./runSnapshot";
import { RunShopModal } from "./RunShopModal";
import { ConvoyScene } from "./ConvoyScene";
import { HoverTip } from "./HoverTip";

// ── Interval (ms per auto-travel day) ────────────────────────────────────────
const TRAVEL_MS = 1800;

/** Resolve template tokens in event body text for display (client-side, no RNG needed). */
function resolveEventBody(
  body: string,
  filledSlots: Record<string, string> | undefined,
  living: { id: string; name: string }[],
): string {
  let result = body;
  // {slot:key} → member name
  result = result.replace(/\{slot:(\w+)\}/g, (_m, key: string) => {
    const id = filledSlots?.[key];
    return living.find((f) => f.id === id)?.name ?? "someone";
  });
  // {randomLiving} → first living member (deterministic display; actual rng is in engine)
  result = result.replace(/\{randomLiving\}/g, living[0]?.name ?? "someone");
  return result;
}

const RATIONS_LEVEL_TIPS: Record<1 | 2 | 3, string> = {
  1: "Bare (1/person/day): lightest food use, but −2 morale per travel day.",
  2: "Normal (2/person/day): balanced consumption and morale.",
  3: "Filling (3/person/day): heavier food use, but +1 morale per travel day.",
};

function rationsStockTip(s: RunState, living: number): string {
  const perDay = s.rationsPerPerson * living;
  return `Food stockpile (${s.resources.rations} on hand). Currently ${s.rationsPerPerson}/person/day — about ${perDay} rations per travel day with ${living} survivor${living === 1 ? "" : "s"}. Starvation begins if you run out.`;
}

const RESOURCE_TIPS = {
  meds: "Medical supplies. Resting spends 2 meds to cure one sick party member. Events and trades can add or cost meds.",
  fuel: "Fuel for the convoy. Burned each travel day based on pace. Without fuel the party pushes the rig — very slow progress and high injury risk.",
  caps: "Bottle caps — wasteland currency. Spend at shops on fuel, rations, meds, parts, and gear. Earn them through events and successful trades.",
  rads: "Radiation exposure from travel, storms, and the wasteland. Rises each day on the road (worse near the port). Some gear reduces rad gain. High rads foreshadow harsher conditions ahead.",
} as const;

// ── Types ─────────────────────────────────────────────────────────────────────

interface RunViewProps {
  state: RunState;
  setState: Dispatch<SetStateAction<RunState | null>>;
}

// ── Floating stat delta badges ────────────────────────────────────────────────

function FloatBadges(props: { deltas: FloatDelta[] }): ReactElement | null {
  const [active, setActive] = useState<FloatDelta[]>([]);
  const seenRef = useRef<Set<string>>(new Set());
  const deltaKey = props.deltas.map((d) => d.id).join(",");

  useEffect(() => {
    const fresh = props.deltas.filter((d) => !seenRef.current.has(d.id));
    if (!fresh.length) return;
    for (const d of fresh) seenRef.current.add(d.id);
    setActive((prev) => [...prev, ...fresh]);
    const t = window.setTimeout(() => {
      setActive((prev) => prev.filter((f) => !fresh.some((x) => x.id === f.id)));
      for (const d of fresh) seenRef.current.delete(d.id);
    }, 1300);
    return () => clearTimeout(t);
  }, [deltaKey]);

  if (!active.length) return null;

  return (
    <>
      {active.map((f) => (
        <span key={f.id} className={`stat-float ${f.delta > 0 ? "positive" : "negative"}`}>
          {f.delta > 0 ? "+" : ""}
          {f.delta}
        </span>
      ))}
    </>
  );
}

function TopbarStat(props: {
  label: string;
  value: string | number;
  statKey: string;
  floats: FloatDelta[];
  tip?: string;
  warn?: boolean;
  danger?: boolean;
}): ReactElement {
  const hits = props.floats.filter((f) => f.statKey === props.statKey);
  const wrapClass = [
    "tstat-value-wrap",
    props.danger ? "danger" : props.warn ? "warn" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <HoverTip tip={props.tip ?? ""} className="topbar-stat">
      <span className="tstat-label">{props.label}</span>
      <span className={wrapClass}>
        <span className="tstat-value">{props.value}</span>
        <FloatBadges deltas={hits} />
      </span>
    </HoverTip>
  );
}

// ── Health bar ────────────────────────────────────────────────────────────────

function HealthBar(props: { hp: number; max: number; warn?: boolean }): ReactElement {
  const pct = Math.max(0, Math.min(100, (props.hp / props.max) * 100));
  const color = pct < 30 ? "var(--danger)" : pct < 55 ? "var(--warn)" : "var(--ok)";
  return (
    <div className="hp-bar-wrap" style={{ width: "100%", height: 6, background: "#222", borderRadius: 3 }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.3s" }} />
    </div>
  );
}

// ── Party member card (top row) ────────────────────────────────────────────────

function MemberHoverPanel(props: { friend: Friend }): ReactElement {
  const f = props.friend;
  const statusLabel =
    f.status === "dead"
      ? "Deceased"
      : f.sick
        ? `Sick — ${f.sick.name} (${f.sick.daysLeft}d left)`
        : f.status === "injured"
          ? "Injured"
          : f.status === "incapacitated"
            ? "Incapacitated"
            : "Healthy";

  const spec = f.specialty ? getSpecialty(f.specialty) : null;
  const traits = (f.traits ?? []).map(getTrait);

  return (
    <div className="member-hover-panel">
      <div className="member-hover-name">{f.name}</div>
      <div className="member-hover-row">
        <span className="member-hover-label">Status</span>
        <span>{statusLabel}</span>
      </div>
      {spec && (
        <div className="member-hover-row">
          <span className="member-hover-label">Specialty</span>
          <span title={spec.description}><strong>{spec.name}</strong></span>
        </div>
      )}
      {traits.length > 0 && (
        <div className="member-hover-section">
          <span className="member-hover-label">Traits</span>
          <ul className="member-hover-items">
            {traits.map((t) => (
              <li key={t.id} className={t.positive ? "trait-pos" : "trait-neg"}>
                <strong>{t.name}</strong> — {t.description}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="member-hover-section">
        <span className="member-hover-label">Personal items</span>
        {f.memberItems.length === 0 ? (
          <span className="muted">None equipped</span>
        ) : (
          <ul className="member-hover-items">
            {f.memberItems.map((id) => {
              const def = getItem(id);
              return (
                <li key={id}>
                  <strong>{def?.name ?? id}</strong>
                  {def?.description ? <span> — {def.description}</span> : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function MemberCard(props: { friend: Friend; floats: FloatDelta[] }): ReactElement {
  const f = props.friend;
  const dead = f.status === "dead";
  const sick = !!f.sick;
  const injured = f.status === "injured" || f.status === "incapacitated";
  const anchorRef = useRef<HTMLDivElement>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const openPanel = () => {
    const el = anchorRef.current;
    if (!el || dead) return;
    const r = el.getBoundingClientRect();
    setPos({ top: r.bottom + 6, left: r.left + r.width / 2 });
    setPanelOpen(true);
  };

  return (
    <>
    <div
      ref={anchorRef}
      className={`member-card-top ${dead ? "dead" : sick ? "sick" : injured ? "injured" : ""}`}
      onMouseEnter={openPanel}
      onMouseLeave={() => setPanelOpen(false)}
      onFocus={openPanel}
      onBlur={() => setPanelOpen(false)}
      tabIndex={dead ? undefined : 0}
    >
      <div className="member-card-name">
        {f.name}
        {f.specialty && (
          <span className="member-specialty-badge" title={getSpecialty(f.specialty).description}>
            {getSpecialty(f.specialty).name.split(" ")[0]}
          </span>
        )}
      </div>
      {!dead && (
        <>
          <HealthBar hp={f.health} max={f.maxHealth} />
          <div className="member-card-stats">
            <span className="member-stat-wrap">
              {f.health}/{f.maxHealth} HP
              <FloatBadges deltas={props.floats.filter((d) => d.statKey === `hp:${f.id}`)} />
            </span>
            {sick && <span className="sick-tag">⚕ {f.sick!.name} ({f.sick!.daysLeft}d)</span>}
            {injured && !sick && <span className="inj-tag">⚠ hurt</span>}
          </div>
          {f.memberItems.length > 0 && (
            <div className="member-card-items">
              {f.memberItems.map((id) => {
                const def = getItem(id);
                return def ? <span key={id} className="item-pip" title={def.description}>{def.name.split(" ")[0]}</span> : null;
              })}
            </div>
          )}
        </>
      )}
      {dead && <div className="member-card-dead">✝ {f.deathCause ?? "the wastes"}</div>}
    </div>
    {panelOpen && !dead
      ? createPortal(
          <div
            className="member-hover-popup"
            style={{ top: pos.top, left: pos.left, transform: "translateX(-50%)" }}
            onMouseEnter={() => setPanelOpen(true)}
            onMouseLeave={() => setPanelOpen(false)}
          >
            <MemberHoverPanel friend={f} />
          </div>,
          document.body,
        )
      : null}
    </>
  );
}

// ── Map view ──────────────────────────────────────────────────────────────────

function MapView(props: { state: RunState; onClose: () => void }): ReactElement {
  const s = props.state;
  const traveled = s.startKm - s.kmRemaining;
  const pct = Math.round((traveled / s.startKm) * 100);

  const biomes = [
    { label: "Open Wastes", start: 0, end: 750 },
    { label: "Abandoned City", start: 750, end: 1500 },
    { label: "Industrial Ruins", start: 1500, end: 2065 },
    { label: "Dead Highway", start: 2065, end: 3080 },
    { label: "Port Sprawl", start: 3080, end: 3500 },
  ];

  return (
    <div className="modal-overlay" onClick={props.onClose}>
      <div className="modal-box map-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Journey Map</h2>
        <div className="map-progress-bar">
          <div className="map-progress-fill" style={{ width: `${pct}%` }} />
          <div className="map-you-marker" style={{ left: `${pct}%` }}>▲</div>
        </div>
        <div className="map-biomes">
          {biomes.map((b) => {
            const bStart = (b.start / s.startKm) * 100;
            const bWidth = ((b.end - b.start) / s.startKm) * 100;
            const active = traveled >= b.start && traveled < b.end;
            return (
              <div key={b.label} className={`map-biome ${active ? "active" : ""}`} style={{ left: `${bStart}%`, width: `${bWidth}%` }}>
                <span>{b.label}</span>
              </div>
            );
          })}
        </div>
        <p className="map-stats">
          {traveled} km traveled of {s.startKm} km total · {s.kmRemaining} km remaining
        </p>
        <p className="map-stats">Currently: <strong>{LOCATION_LABEL[s.currentLocation]}</strong></p>
        <button className="btn btn-primary" onClick={props.onClose}>Close map</button>
      </div>
    </div>
  );
}

// ── Pause menu ────────────────────────────────────────────────────────────────

interface PauseMenuProps {
  state: RunState;
  onResume: () => void;
  onAction: (action: "search_food" | "rest" | "trade") => void;
  onSetPace: (p: Pace) => void;
  onSetRations: (n: number) => void;
  onShowMap: () => void;
}

function PauseMenu(props: PauseMenuProps): ReactElement {
  const s = props.state;
  const [tab, setTab] = useState<"actions" | "convoy">("actions");
  const living = s.friends.filter((f) => f.status !== "dead").length;
  const totalRations = s.rationsPerPerson * living;
  const convoyItems = s.inventory
    .map((entry) => ({ entry, def: getItem(entry.itemId) }))
    .filter((row) => row.def && row.def.kind !== "personal");

  return (
    <div className="modal-overlay pause-overlay" onClick={props.onResume}>
      <div className="pause-menu" onClick={(e) => e.stopPropagation()}>
        <div className="pause-header">⏸ JOURNEY PAUSED</div>

        <div className="pause-tabs">
          <button
            type="button"
            className={`pause-tab ${tab === "actions" ? "active" : ""}`}
            onClick={() => setTab("actions")}
          >
            Actions
          </button>
          <button
            type="button"
            className={`pause-tab ${tab === "convoy" ? "active" : ""}`}
            onClick={() => setTab("convoy")}
          >
            Convoy supplies
          </button>
        </div>

        {tab === "actions" ? (
        <div className="pause-options">
          {/* Search for food */}
          <button
            className="pause-btn"
            onClick={() => props.onAction("search_food")}
          >
            <span className="pause-key">[F]</span>
            <span className="pause-label">Search for food</span>
            <span className="pause-hint">Uses a day · finds rations/supplies</span>
          </button>

          {/* Change rations */}
          <div className="pause-btn pause-setting">
            <span className="pause-key">[R]</span>
            <HoverTip tip={rationsStockTip(s, living)} className="pause-label-wrap">
              <span className="pause-label">Change rations</span>
            </HoverTip>
            <span className="pause-hint">
              Currently: <strong>{s.rationsPerPerson}/person/day</strong> ({totalRations} total)
            </span>
            <div className="pause-sub-btns">
              {([1, 2, 3] as const).map((n) => (
                <HoverTip key={n} tip={RATIONS_LEVEL_TIPS[n]}>
                  <button
                    type="button"
                    className={`pace-btn ${s.rationsPerPerson === n ? "active" : ""}`}
                    onClick={() => props.onSetRations(n)}
                  >
                    {n} {n === 1 ? "(bare)" : n === 2 ? "(normal)" : "(filling)"}
                  </button>
                </HoverTip>
              ))}
            </div>
          </div>

          {/* Change pace */}
          <div className="pause-btn pause-setting">
            <span className="pause-key">[P]</span>
            <HoverTip tip={PACE_ALL_TIP} className="pause-label-wrap">
              <span className="pause-label">Change pace</span>
            </HoverTip>
            <span className="pause-hint">Currently: <strong>{PACE_LABEL[s.pace]}</strong></span>
            <div className="pause-sub-btns">
              {(["leisurely", "steady", "grueling"] as Pace[]).map((p) => (
                <HoverTip key={p} tip={paceTravelTip(p)}>
                  <button
                    type="button"
                    className={`pace-btn ${s.pace === p ? "active" : ""}`}
                    onClick={() => props.onSetPace(p)}
                  >
                    {PACE_LABEL[p]}
                  </button>
                </HoverTip>
              ))}
            </div>
          </div>

          {/* Attempt to trade */}
          <button
            className="pause-btn"
            onClick={() => props.onAction("trade")}
          >
            <span className="pause-key">[T]</span>
            <span className="pause-label">Attempt to trade</span>
            <span className="pause-hint">Uses a day · chance to find a shop</span>
          </button>

          {/* Look at map */}
          <button className="pause-btn" onClick={props.onShowMap}>
            <span className="pause-key">[M]</span>
            <span className="pause-label">Look at map</span>
            <span className="pause-hint">See your journey progress</span>
          </button>

          {/* Stop to rest */}
          <button
            className="pause-btn"
            onClick={() => props.onAction("rest")}
          >
            <span className="pause-key">[Z]</span>
            <span className="pause-label">Stop to rest</span>
            <span className="pause-hint">Uses a day · heals the party</span>
          </button>
        </div>
        ) : (
          <div className="pause-convoy-tab">
            {convoyItems.length === 0 ? (
              <p className="muted pause-convoy-empty">No convoy-wide items in stock.</p>
            ) : (
              <ul className="convoy-item-list">
                {convoyItems.map(({ entry, def }) => (
                  <li key={entry.itemId} className="convoy-item-row">
                    <div className="convoy-item-name">
                      {def!.name}
                      {entry.count > 1 ? <span className="convoy-item-qty"> ×{entry.count}</span> : null}
                    </div>
                    <p className="convoy-item-desc">{def!.description}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <button className="pause-btn pause-continue" onClick={props.onResume}>
          <span className="pause-key">[SPACE]</span>
          <span className="pause-label">Continue journey</span>
        </button>
      </div>
    </div>
  );
}

// ── Acknowledgment overlay ────────────────────────────────────────────────────

function AckOverlay(props: { ack: Acknowledgment; onDismiss: () => void }): ReactElement {
  return (
    <div className="modal-overlay" onClick={props.onDismiss}>
      <div className={`ack-box ${props.ack.critical ? "critical" : ""}`} onClick={(e) => e.stopPropagation()}>
        <h3>{props.ack.title}</h3>
        <div className="ack-box-body">
          <p style={{ whiteSpace: "pre-line", margin: 0 }}>{props.ack.body}</p>
        </div>
        <button className="btn btn-primary" onClick={props.onDismiss}>Continue</button>
      </div>
    </div>
  );
}

// ── Main RunView ──────────────────────────────────────────────────────────────

export function RunView(props: RunViewProps): ReactElement {
  const s = props.state;
  const [floats, setFloats] = useState<FloatDelta[]>([]);
  const [pendingAcks, setPendingAcks] = useState<Acknowledgment[]>([]);
  /** While waiting for a member pick: {choiceId, slot} */
  const [pendingSlotPick, setPendingSlotPick] = useState<{ choiceId: string; slot: MemberSlot } | null>(null);
  const [paused, setPaused] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const floatTimerRef = useRef<number | undefined>(undefined);

  function showFloats(deltas: FloatDelta[]) {
    if (!deltas.length) return;
    setFloats(deltas);
    if (floatTimerRef.current) window.clearTimeout(floatTimerRef.current);
    floatTimerRef.current = window.setTimeout(() => setFloats([]), 1400);
  }

  // Scroll log to top when new entries arrive
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = 0;
  }, [s.log.length]);

  // ── Auto-travel timer ──────────────────────────────────────────────────────
  const travelRef = useRef<number>(0);

  const canAutoTravel =
    !paused &&
    !s.currentEvent &&
    !s.runModal &&
    s.outcome === "ongoing" &&
    pendingAcks.length === 0;

  useEffect(() => {
    if (!canAutoTravel) return;
    const id = window.setTimeout(() => {
      const snap = snapshotRun(s);
      const next = resolveDailyTurn(s, "travel");
      const afterSnap = snapshotRun(next);
      const newLogs = next.log.slice(s.log.length).map((l) => l.text);
      const acks = buildAcknowledgments(snap, afterSnap, "daily", newLogs);
      if (acks.length) setPendingAcks(acks);
      props.setState(next);
      saveRunAutosave(next);
      travelRef.current++;
    }, TRAVEL_MS);
    return () => clearTimeout(id);
  }, [s, canAutoTravel]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;

      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        if (pendingAcks.length > 0) return;
        if (s.currentEvent || s.runModal) return;
        if (s.outcome !== "ongoing") return;
        setPaused((p) => !p);
        return;
      }

      if (paused && !s.currentEvent && !s.runModal) {
        if (e.key === "f" || e.key === "F") { handlePauseAction("search_food"); return; }
        if (e.key === "t" || e.key === "T") { handlePauseAction("trade"); return; }
        if (e.key === "z" || e.key === "Z") { handlePauseAction("rest"); return; }
        if (e.key === "m" || e.key === "M") { setShowMap(true); return; }
      }

      // Event choice keys
      if (s.currentEvent?.kind !== "ambient" && s.currentEvent?.choices) {
        const idx = parseInt(e.key) - 1;
        const choice = s.currentEvent.choices[idx];
        if (choice) handleChoice(s.currentEvent, choice.id);
        return;
      }
      // Ambient event dismiss
      if (s.currentEvent?.kind === "ambient" && (e.key === "Enter" || e.code === "Space")) {
        e.preventDefault();
        handleAmbientConfirm();
        return;
      }

      if (pendingAcks.length > 0 && (e.key === "Enter" || e.code === "Space")) {
        e.preventDefault();
        dismissAck();
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [s, paused, pendingAcks]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function applyAndSave(
    next: RunState,
    mode: "daily" | "event" = "daily",
    withFloats = mode === "event",
  ) {
    const snap = snapshotRun(s);
    const afterSnap = snapshotRun(next);
    const newLogs = next.log.slice(s.log.length).map((l) => l.text);
    const acks = buildAcknowledgments(snap, afterSnap, mode, newLogs);
    if (withFloats) showFloats(buildFloatDeltas(snap, afterSnap));
    if (acks.length) setPendingAcks(acks);
    props.setState(next);
    saveRunAutosave(next);
  }

  function handlePauseAction(action: "search_food" | "rest" | "trade") {
    setPaused(false);
    const next = resolveDailyTurn(s, action);
    applyAndSave(next, "daily", true);
  }

  function handleChoice(ev: GameEvent, choiceId: string) {
    const rng = mulberry32((s.rngSeed + s.day * 7001) >>> 0);
    const next = resolveChoice(s, ev, choiceId, rng);
    const cleared = { ...next, currentEvent: null };
    applyAndSave(cleared, "event");
  }

  /** Fill a slot with a chosen friend, then resolve the choice immediately. */
  function handleSlotChoice(ev: GameEvent, choiceId: string, slotKey: string, friendId: string) {
    const rng = mulberry32((s.rngSeed + s.day * 7001) >>> 0);
    const withSlot = fillSlot(s, slotKey, friendId);
    const next = resolveChoice(withSlot, { ...ev, filledSlots: withSlot.currentEvent?.filledSlots }, choiceId, rng);
    const cleared = { ...next, currentEvent: null };
    applyAndSave(cleared, "event");
  }

  function handleAmbientConfirm() {
    const rng = mulberry32((s.rngSeed + s.day * 7001) >>> 0);
    const next = resolveAmbientEvent(s, rng);
    applyAndSave(next, "event");
  }

  function handleDismissModal() {
    const next = dismissRunModal(s);
    props.setState(next);
    saveRunAutosave(next);
  }

  function handleBuyFromShop(itemId: string, friendId?: string) {
    if (!s.runModal || s.runModal.kind !== "shop") return;
    const next = purchaseFromShop(s, s.runModal.location, itemId, friendId);
    props.setState(next);
    saveRunAutosave(next);
  }

  function dismissAck() {
    setPendingAcks((prev) => {
      const remaining = prev.slice(1);
      if (remaining.length === 0 && s.outcome === "ongoing") {
        // Auto-resume if no more acks
      }
      return remaining;
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const kmTraveled = s.startKm - s.kmRemaining;
  const progressPct = Math.min(100, Math.round((kmTraveled / s.startKm) * 100));
  const living = s.friends.filter((f) => f.status !== "dead");

  return (
    <div className="run-view">
      {/* ── TOP STATS BAR ── */}
      <div className="run-topbar">
        <div className="topbar-row1">
          <span className="topbar-stat">
            <span className="tstat-label">Day</span>
            <span className="tstat-value">{s.day}</span>
          </span>
          <span className="topbar-divider" />
          <span className="topbar-stat">
            <span className="tstat-label">Departure</span>
            <span className={`tstat-value ${s.departureDaysRemaining < 30 ? "warn" : ""}`}>
              {s.departureDaysRemaining}d left
            </span>
          </span>
          <span className="topbar-divider" />
          <span className="topbar-stat">
            <span className="tstat-label">Distance</span>
            <span className="tstat-value">{kmTraveled}/{s.startKm} km</span>
          </span>
          <span className="topbar-divider" />
          <HoverTip tip={paceTravelTip(s.pace)} className="topbar-stat">
            <span className="tstat-label">Pace</span>
            <span className="tstat-value">{PACE_LABEL[s.pace]}</span>
          </HoverTip>
          <span className="topbar-divider" />
          <TopbarStat
            label="Rations"
            value={s.resources.rations}
            statKey="rations"
            floats={floats}
            tip={rationsStockTip(s, living.length)}
            danger={s.resources.rations === 0}
            warn={s.resources.rations > 0 && s.resources.rations < 5 * living.length}
          />
          <span className="topbar-divider" />
          <TopbarStat
            label="Meds"
            value={s.resources.meds}
            statKey="meds"
            floats={floats}
            tip={RESOURCE_TIPS.meds}
          />
          <span className="topbar-divider" />
          <TopbarStat
            label="Fuel"
            value={Number(s.resources.fuel.toFixed(1))}
            statKey="fuel"
            floats={floats}
            tip={RESOURCE_TIPS.fuel}
            warn={s.resources.fuel < 4}
          />
          <span className="topbar-divider" />
          <TopbarStat
            label="Caps"
            value={s.resources.caps}
            statKey="caps"
            floats={floats}
            tip={RESOURCE_TIPS.caps}
          />
          <span className="topbar-divider" />
          <TopbarStat
            label="Rads"
            value={Math.round(s.rads)}
            statKey="rads"
            floats={floats}
            tip={RESOURCE_TIPS.rads}
            warn={s.rads > 60}
          />
        </div>

        {/* Progress bar */}
        <div className="topbar-progress">
          <div className="topbar-progress-fill" style={{ width: `${progressPct}%` }} />
          <span className="topbar-progress-label">{LOCATION_LABEL[s.currentLocation]}</span>
        </div>

        {/* Party row */}
        <div className="topbar-party">
          {s.friends.map((f) => (
            <MemberCard key={f.id} friend={f} floats={floats} />
          ))}
        </div>
      </div>

      {/* ── CONVOY SCENE (centre, takes remaining height) ── */}
      <ConvoyScene
        location={s.currentLocation}
        stopped={paused || !!s.currentEvent || !!s.runModal || pendingAcks.length > 0}
      >
        {/* Event panel — overlaid on top of the scene */}
        {s.currentEvent && (
          <div className="event-panel">
            <h2 className="event-title">{s.currentEvent.title}</h2>
            <p className="event-body">
              {resolveEventBody(s.currentEvent.body, s.currentEvent.filledSlots, living)}
            </p>

            {/* Member picker overlay — shown when a choice needs a slot filled */}
            {pendingSlotPick ? (
              <div className="slot-picker">
                <p className="slot-picker-label">{pendingSlotPick.slot.label}</p>
                <div className="slot-picker-members">
                  {living.map((f) => (
                    <button
                      key={f.id}
                      className="slot-pick-btn"
                      onClick={() => {
                        const pick = pendingSlotPick;
                        setPendingSlotPick(null);
                        handleSlotChoice(s.currentEvent!, pick.choiceId, pick.slot.key, f.id);
                      }}
                    >
                      <strong>{f.name}</strong>
                      {f.specialty && (
                        <span className="slot-pick-spec"> — {getSpecialty(f.specialty).name}</span>
                      )}
                      <span className="slot-pick-hp"> {f.health}/{f.maxHealth} HP</span>
                    </button>
                  ))}
                </div>
                <button
                  className="btn"
                  style={{ marginTop: "0.5rem" }}
                  onClick={() => setPendingSlotPick(null)}
                >
                  Cancel
                </button>
              </div>
            ) : s.currentEvent.kind === "ambient" ? (
              <button className="btn btn-primary" onClick={handleAmbientConfirm}>
                Continue [Enter]
              </button>
            ) : (
              <div className="choice-list">
                {(s.currentEvent.choices ?? []).map((ch, i) => {
                  const needsSlot = ch.fillsSlot;
                  const slotDef = needsSlot
                    ? s.currentEvent!.memberSlots?.find((sl) => sl.key === needsSlot)
                    : undefined;
                  return (
                    <button
                      key={ch.id}
                      className="choice-btn"
                      onClick={() => {
                        if (slotDef) {
                          // Show member picker first
                          setPendingSlotPick({ choiceId: ch.id, slot: slotDef });
                        } else {
                          handleChoice(s.currentEvent!, ch.id);
                        }
                      }}
                    >
                      <span className="choice-num">[{i + 1}]</span>
                      {ch.text}
                      {slotDef && <span className="choice-req"> (pick a member)</span>}
                      {ch.requiredItem && !slotDef ? <span className="choice-req"> (needs item)</span> : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </ConvoyScene>

      {/* ── LOG (scrollable panel at bottom) ── */}
      <div className="run-log-panel">
        <div className="run-log-strip" ref={logRef}>
          {[...s.log].slice(-12).reverse().map((entry, i) => (
            <div key={`${entry.day}-${i}-${entry.text.slice(0, 12)}`} className={`log-entry ${entry.day === 0 ? "log-entry--intro" : ""}`}>
              {entry.day > 0 && <span className="log-day">Day {entry.day}</span>}
              <span className="log-text">{entry.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── BOTTOM BAR ── */}
      <div className="run-bottombar">
        {s.outcome === "ongoing" ? (
          <button
            className={`pause-toggle-btn ${paused ? "paused" : ""}`}
            onClick={() => setPaused((p) => !p)}
          >
            {paused ? "▶ RESUME [SPACE]" : "⏸ PAUSE [SPACE]"}
          </button>
        ) : (
          <span className="muted">Run complete</span>
        )}
        <span className="run-status-hint">
          {s.outcome === "ongoing"
            ? paused
              ? "Journey paused"
              : canAutoTravel
              ? "Traveling..."
              : "Waiting..."
            : s.outcome === "won"
            ? "You made the ship"
            : "Run ended"}
        </span>
      </div>

      {/* ── MODALS ── */}

      {/* Pause menu */}
      {paused && !s.currentEvent && !s.runModal && pendingAcks.length === 0 && s.outcome === "ongoing" && (
        <PauseMenu
          state={s}
          onResume={() => setPaused(false)}
          onAction={handlePauseAction}
          onSetPace={(p) => {
            props.setState({ ...s, pace: p });
          }}
          onSetRations={(n) => {
            props.setState({ ...s, rationsPerPerson: n });
          }}
          onShowMap={() => setShowMap(true)}
        />
      )}

      {/* Map view */}
      {showMap && <MapView state={s} onClose={() => setShowMap(false)} />}

      {/* Acknowledgment */}
      {pendingAcks.length > 0 && (
        <AckOverlay ack={pendingAcks[0]} onDismiss={dismissAck} />
      )}

      {/* Run modal (location notice / shop) */}
      {s.runModal && s.runModal.kind === "location" && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h2>Entering: {LOCATION_LABEL[s.runModal.to]}</h2>
            <p>{s.runModal.body}</p>
            <button className="btn btn-primary" onClick={handleDismissModal}>
              Continue
            </button>
          </div>
        </div>
      )}

      {s.runModal && s.runModal.kind === "notice" && (
        <div className="modal-overlay">
          <div className="modal-box critical">
            <h2>{s.runModal.title}</h2>
            <p>{s.runModal.body}</p>
            <button className="btn btn-primary" onClick={handleDismissModal}>
              Continue
            </button>
          </div>
        </div>
      )}

      {s.runModal && s.runModal.kind === "shop" && (
        <RunShopModal
          state={s}
          location={s.runModal.location}
          onBuy={handleBuyFromShop}
          onClose={handleDismissModal}
        />
      )}
    </div>
  );
}

