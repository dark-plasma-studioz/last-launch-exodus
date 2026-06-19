import type { CheckType, Effect, EffectTarget, EventPool, Friend, GameEvent, Pace, RunState } from "../types";
import type { LocationId } from "./locations";
import { LOCATION_LABEL, locationFromKm } from "./locations";
import { getItem } from "../config/items";
import { DIFFICULTY, partyScaling } from "../config/difficulty";
import { memberCheckBonus, traitBonusFor, applyTraitBonuses, getSpecialty } from "../config/traits";
import { mulberry32, pickIndex } from "./rng";
import { TRAVEL_EVENTS } from "../content/events";
import { shopForLocation } from "../config/shops";

export type DailyAction = "travel" | "search_food" | "rest" | "trade";

// ── Pace config ───────────────────────────────────────────────────────────────

export const PACE_LABEL: Record<Pace, string> = {
  leisurely: "Leisurely",
  steady: "Steady",
  grueling: "Grueling",
};

interface PaceConfig {
  /** Base km gained per travel day (before rng variance). */
  baseKm: number;
  /** Variance added to base km (0..var). */
  kmVariance: number;
  /** Fuel burned per travel day (before item discounts). */
  fuelPerDay: number;
  /** Ration multiplier on top of rationsPerPerson setting. */
  rationMult: number;
  /** Per-day injury chance (0.0–1.0). */
  injuryChance: number;
}

const PACE_CONFIG: Record<Pace, PaceConfig> = {
  leisurely: { baseKm: 6,  kmVariance: 2, fuelPerDay: 0.2, rationMult: 0.9, injuryChance: 0.03 },
  steady:    { baseKm: 9,  kmVariance: 2, fuelPerDay: 0.4, rationMult: 1.0, injuryChance: 0.06 },
  grueling:  { baseKm: 12, kmVariance: 3, fuelPerDay: 0.6, rationMult: 1.1, injuryChance: 0.13 },
};

/** Typical km range for a travel day at this pace (before transport/items). */
export function paceKmRange(pace: Pace): { min: number; max: number } {
  const c = PACE_CONFIG[pace];
  return { min: c.baseKm, max: c.baseKm + c.kmVariance };
}

/** One-line tooltip for a single pace option. */
export function paceTravelTip(pace: Pace): string {
  const { min, max } = paceKmRange(pace);
  const fuel = PACE_CONFIG[pace].fuelPerDay;
  return `${PACE_LABEL[pace]}: ${min}–${max} km/day, ${fuel} fuel/day.`;
}

/** Overview of all pace options (pause menu / reference). */
export const PACE_ALL_TIP =
  "Travel pace sets distance and fuel per day. Leisurely 6–8 km (0.2 fuel). Steady 9–11 km (0.4 fuel). Grueling 12–15 km (0.6 fuel). Faster paces mean more road injuries.";

/**
 * Per travel day: fraction of (rationsPerPerson × party) actually consumed.
 * Lowered from 0.22 → 0.20 so food pressure is real but not relentless.
 * Increasing this makes rations drain faster; decreasing makes the game easier.
 */
const RATION_COST_SCALE = 0.20;

function roundFuel(n: number): number {
  return Math.round(n * 10) / 10;
}
/** Speed multiplier when out of fuel (0.1 = 90% slower). */
const PUSH_SPEED_MULT = 0.1;
/**
 * Extra injury chance per person when pushing the rig (out of fuel).
 * Reduced from 0.24 → 0.18; running dry is still punishing but survivable.
 */
const PUSH_INJURY_BONUS = 0.18;

// ── Helpers ───────────────────────────────────────────────────────────────────

function livingFriends(s: RunState): Friend[] {
  return s.friends.filter((f) => f.status !== "dead");
}

/** Pay ration cost or, if short, starve the party (−10 HP each). */
function consumeRationsOrStarve(out: RunState, cost: number, context: string): void {
  const rounded = Math.max(0, Math.round(cost));
  if (rounded === 0) return;

  if (out.resources.rations >= rounded) {
    out.resources.rations -= rounded;
    return;
  }

  out.resources.rations = 0;
  for (const f of livingFriends(out)) {
    f.health = Math.max(0, f.health - 10);
    if (f.health <= 0) {
      f.status = "dead";
      f.deathCause = "starvation";
      f.deathDay = out.day;
    }
  }
  pushLog(out, `Out of rations (${context}). Each survivor loses 10 HP.`);
}

function cloneState(s: RunState): RunState {
  return structuredClone(s);
}

function pushLog(s: RunState, text: string): void {
  s.log.push({ day: s.day, text });
}

function hasItem(s: RunState, itemId: string): boolean {
  return s.inventory.some((e) => e.itemId === itemId && e.count > 0);
}

function addInventory(s: RunState, itemId: string, count: number): void {
  const def = getItem(itemId);
  if (!def) return;
  const max = def.kind === "unique" ? 1 : 999;
  const row = s.inventory.find((e) => e.itemId === itemId);
  if (row) {
    row.count = Math.min(max, row.count + count);
  } else if (count > 0) {
    s.inventory.push({ itemId, count: Math.min(max, count) });
  }
}

function removeInventory(s: RunState, itemId: string, count: number): void {
  const row = s.inventory.find((e) => e.itemId === itemId);
  if (!row) return;
  row.count -= count;
  if (row.count <= 0) {
    s.inventory = s.inventory.filter((e) => e.itemId !== itemId || e.count > 0);
  }
}

function pickTarget(
  s: RunState,
  target: EffectTarget,
  rng: () => number,
): Friend[] {
  const L = livingFriends(s);
  if (!L.length) return [];

  // Named slot target
  if (typeof target === "object" && "slot" in target) {
    const friendId = s.currentEvent?.filledSlots?.[target.slot];
    if (!friendId) return [];
    const f = s.friends.find((m) => m.id === friendId && m.status !== "dead");
    return f ? [f] : [];
  }

  if (target === "all_living") return L;
  if (target === "weakest")
    return [[...L].sort((a, b) => a.health / a.maxHealth - b.health / b.maxHealth)[0]];
  return [L[Math.floor(rng() * L.length)]];
}

/** Resolve a named slot to a friendId, or null if not filled. */
function resolveSlot(s: RunState, slotKey: string): Friend | null {
  const id = s.currentEvent?.filledSlots?.[slotKey];
  if (!id) return null;
  return s.friends.find((f) => f.id === id && f.status !== "dead") ?? null;
}

/** Auto-fill all non-player-choice slots on an event. */
export function autoFillEventSlots(event: GameEvent, s: RunState, rng: () => number): GameEvent {
  const slots = event.memberSlots;
  if (!slots?.length) return event;

  const filled: Record<string, string> = { ...(event.filledSlots ?? {}) };
  const L = livingFriends(s);
  if (!L.length) return event;

  for (const slot of slots) {
    if (filled[slot.key]) continue; // already filled (player choice)
    if (slot.how === "player_choice") continue; // will be filled interactively
    if (slot.how === "weakest") {
      const f = [...L].sort((a, b) => a.health / a.maxHealth - b.health / b.maxHealth)[0];
      filled[slot.key] = f.id;
    } else {
      // random_living
      filled[slot.key] = L[Math.floor(rng() * L.length)].id;
    }
  }

  return { ...event, filledSlots: filled };
}

// ── Trait & specialty bonuses ─────────────────────────────────────────────────

/** Apply all trait stat bonuses to friends at run start. Called in runBootstrap. */
export function applyAllTraitBonuses(friends: Friend[]): void {
  for (const f of friends) {
    applyTraitBonuses(f, f.traits ?? []);
  }
}

/** Compute total scavenge/trade/injury resistance from a friend's traits + items. */
export function memberPassiveBonus(f: Friend, field: "scavengeBonus" | "tradeBonus" | "injuryResistance"): number {
  let total = 0;
  // Item bonuses
  for (const itemId of f.memberItems) {
    const def = getItem(itemId);
    if (def?.memberEffect) {
      total += (def.memberEffect[field] ?? 0) as number;
    }
  }
  // Trait bonuses
  total += traitBonusFor(f.traits ?? [], field);
  return total;
}

// ── Personal items ────────────────────────────────────────────────────────────

function applyPersonalItemBonuses(f: Friend, itemId: string): void {
  const def = getItem(itemId);
  if (!def?.memberEffect) return;
  const me = def.memberEffect;
  if (me.maxHealthBonus) {
    f.maxHealth += me.maxHealthBonus;
    f.health = Math.min(f.maxHealth, f.health + me.maxHealthBonus);
  }
  if (me.moraleBonus) f.morale = Math.min(100, f.morale + me.moraleBonus);
}

function grantPersonalItem(
  s: RunState,
  itemId: string,
  target: "random_living" | "weakest" | "specialist",
  rng: () => number,
): void {
  const def = getItem(itemId);
  if (!def || def.kind !== "personal") return;

  const targets =
    target === "specialist"
      ? pickTarget(s, "random_living", rng)
      : pickTarget(s, target, rng);

  for (const f of targets) {
    if (f.memberItems.includes(itemId)) {
      pushLog(s, `${f.name} already carries ${def.name}.`);
      continue;
    }
    f.memberItems.push(itemId);
    applyPersonalItemBonuses(f, itemId);
    pushLog(s, `${f.name} receives ${def.name}.`);
  }
}

// ── Sickness ──────────────────────────────────────────────────────────────────

function processSicknessDay(out: RunState): void {
  for (const f of livingFriends(out)) {
    if (!f.sick) continue;
    f.sick.daysLeft -= 1;
    if (f.sick.daysLeft === 3)
      pushLog(out, `${f.name}'s ${f.sick.name} is worsening — 3 days left without medicine.`);
    else if (f.sick.daysLeft <= 0) {
      const cause = f.sick.name;
      f.sick = undefined;
      f.status = "dead";
      f.health = 0;
      f.deathCause = cause;
      f.deathDay = out.day;
      pushLog(out, `${f.name} succumbed to ${cause}.`);
      if (!out.runModal)
        out.runModal = {
          kind: "notice",
          title: "Death from illness",
          body: `${f.name} didn't make it. The ${cause} finished them before medicine arrived.`,
        };
    }
  }
}

// ── applyEffects ──────────────────────────────────────────────────────────────

export function applyEffects(
  state: RunState,
  effects: Effect[],
  rng: () => number,
): RunState {
  const s = cloneState(state);
  for (const e of effects) {
    switch (e.type) {
      case "appendLog":
        pushLog(s, e.text);
        break;
      case "resource": {
        const v = s.resources[e.key] + e.delta;
        s.resources[e.key] = Math.max(0, v);
        break;
      }
      case "rad":
        s.rads = Math.max(0, s.rads + e.delta);
        break;
      case "km":
        s.kmRemaining = Math.max(0, s.kmRemaining + e.delta);
        break;
      case "time": {
        const d = Math.max(0, e.days);
        s.departureDaysRemaining -= d;
        s.day += d;
        break;
      }
      case "transport":
        s.transport = Math.max(0, Math.min(100, s.transport + e.delta));
        break;
      case "portChaos":
        s.portChaos = Math.max(0, Math.min(100, s.portChaos + e.delta));
        break;
      case "flag":
        s.flags[e.key] = e.value;
        break;
      case "damage": {
        for (const f of pickTarget(s, e.target, rng)) {
          f.health = Math.max(0, f.health - e.amount);
          if (f.health <= 0) {
            f.status = "dead";
            f.deathCause = "injuries";
            f.deathDay = s.day;
          } else if (f.health < f.maxHealth * 0.45) {
            f.status = "injured";
          }
        }
        break;
      }
      case "heal": {
        for (const f of pickTarget(s, e.target, rng)) {
          f.health = Math.min(f.maxHealth, f.health + e.amount);
          if (f.health > f.maxHealth * 0.55 && f.status === "injured") f.status = "alive";
        }
        break;
      }
      case "morale":
        for (const f of livingFriends(s))
          f.morale = Math.max(0, Math.min(100, f.morale + e.delta));
        break;
      case "injure":
        for (const f of pickTarget(s, e.target, rng)) {
          f.status = "injured";
          f.health = Math.min(f.health, f.maxHealth * 0.5);
        }
        break;
      case "kill":
        for (const f of pickTarget(s, e.target, rng)) {
          f.status = "dead";
          f.health = 0;
          f.deathCause = "the wastes";
          f.deathDay = s.day;
        }
        break;
      case "sicken":
        for (const f of pickTarget(s, e.target, rng)) {
          if (f.sick || f.status === "dead") break;
          let days = e.days;
          for (const itemId of f.memberItems) {
            const def = getItem(itemId);
            if (def?.memberEffect?.sicknessResistDays) days += def.memberEffect.sicknessResistDays;
          }
          f.sick = { name: e.sickness, daysLeft: days, totalDays: days };
          pushLog(s, `${f.name} contracted ${e.sickness} (${days} days to treat).`);
          if (hasItem(s, "u_antibiotics")) {
            f.sick = undefined;
            removeInventory(s, "u_antibiotics", 1);
            pushLog(s, "Pre-war antibiotics immediately neutralise the illness.");
          }
        }
        break;
      case "cure":
        for (const f of pickTarget(s, e.target, rng)) {
          if (f.sick) {
            pushLog(s, `${f.name} recovered from ${f.sick.name}.`);
            f.sick = undefined;
          }
        }
        break;
      case "item":
        addInventory(s, e.itemId, e.count ?? 1);
        break;
      case "removeItem":
        removeInventory(s, e.itemId, e.count ?? 1);
        break;
      case "setEmbark":
        s.embarkEventsLeft = e.value;
        break;
      case "grantPersonal":
        grantPersonalItem(s, e.itemId, e.target, rng);
        break;
      case "fillSlot": {
        const L2 = livingFriends(s);
        if (!L2.length) break;
        const target2 = e.how === "weakest"
          ? [...L2].sort((a, b) => a.health / a.maxHealth - b.health / b.maxHealth)[0]
          : L2[Math.floor(rng() * L2.length)];
        if (s.currentEvent) {
          s.currentEvent = {
            ...s.currentEvent,
            filledSlots: { ...(s.currentEvent.filledSlots ?? {}), [e.slot]: target2.id },
          };
        }
        break;
      }
      default:
        break;
    }
  }
  return s;
}

// ── Template strings ──────────────────────────────────────────────────────────

/**
 * Resolve template placeholders in event text.
 *
 * Supported tokens:
 *   {randomLiving}      — random living member name (each call picks independently)
 *   {slot:key}          — name of the member in named slot "key"
 *   {specialty:key}     — specialty name of the member in named slot "key"
 */
export function templateString(s: RunState, text: string, rng: () => number): string {
  let result = text;

  // {randomLiving} — independent picks each time it appears
  result = result.replace(/\{randomLiving\}/g, () => {
    const living = livingFriends(s);
    return living.length ? living[Math.floor(rng() * living.length)].name : "someone";
  });

  // {slot:key} → member name
  result = result.replace(/\{slot:(\w+)\}/g, (_match, key: string) => {
    const f = resolveSlot(s, key);
    return f?.name ?? "someone";
  });

  // {specialty:key} → specialty name of the member in the slot
  result = result.replace(/\{specialty:(\w+)\}/g, (_match, key: string) => {
    const f = resolveSlot(s, key);
    if (!f?.specialty) return "unknown";
    return getSpecialty(f.specialty).name;
  });

  return result;
}

// ── Win / loss evaluation ─────────────────────────────────────────────────────

export function evaluateLoss(s: RunState): string | null {
  if (s.departureDaysRemaining <= 0)
    return "The last ship's window closed before you arrived.";
  if (!livingFriends(s).length) return "Your entire party is gone.";
  if (s.transport <= 0 && s.kmRemaining > 80)
    return "Your convoy seized — no viable transport across the dead highways.";
  return null;
}

export function evaluateWin(s: RunState): boolean {
  return s.kmRemaining <= 0 && s.embarkEventsLeft <= 0 && livingFriends(s).length > 0;
}

// ── Event eligibility ─────────────────────────────────────────────────────────

function eventMatchesRun(ev: GameEvent, s: RunState): boolean {
  if (ev.requiresFlag && !s.flags[ev.requiresFlag]) return false;
  if (ev.minKm !== undefined && s.kmRemaining < ev.minKm) return false;
  if (ev.maxKm !== undefined && s.kmRemaining > ev.maxKm) return false;

  const embarkQueue = s.kmRemaining <= 0 && s.embarkEventsLeft > 0;
  const finished = s.kmRemaining <= 0 && s.embarkEventsLeft <= 0;
  if (finished) return false;
  if (embarkQueue) return ev.locations?.includes("embark") === true;
  if (s.kmRemaining <= 0) return false;
  if (ev.locations?.includes("embark")) return false;

  if (ev.requiresLocation) return s.currentLocation === ev.requiresLocation;
  if (!ev.locations?.length) return true;
  return ev.locations.includes(s.currentLocation);
}

export function pickNextEvent(
  s: RunState,
  pool: GameEvent[],
  rng: () => number,
  poolTag: EventPool = "travel",
): GameEvent | null {
  const eligible = pool.filter(
    (ev) => (ev.eventPool ?? "travel") === poolTag && eventMatchesRun(ev, s),
  );
  if (!eligible.length) return null;
  const n = livingFriends(s).length;
  const dw = DIFFICULTY[s.difficulty].encounterWeight * partyScaling(n).encounterMult;
  const weights = eligible.map((e) => (e.weight ?? 1) * dw);
  return eligible[pickIndex(rng, weights)];
}

// ── Choice resolution ──────────────────────────────────────────────────────────

/**
 * Fill a player-choice slot and store the chosen friend id into the event.
 * Called from RunView when the player selects a member in the member picker.
 */
export function fillSlot(s: RunState, slotKey: string, friendId: string): RunState {
  if (!s.currentEvent) return s;
  const next = cloneState(s);
  next.currentEvent = {
    ...next.currentEvent!,
    filledSlots: { ...(next.currentEvent!.filledSlots ?? {}), [slotKey]: friendId },
  };
  return next;
}

export function resolveChoice(
  s: RunState,
  ev: GameEvent,
  choiceId: string,
  rng: () => number,
): RunState {
  const ch = (ev.choices ?? []).find((c) => c.id === choiceId);
  if (!ch) return s;
  let next = cloneState(s);

  if (ch.requiredItem && !hasItem(next, ch.requiredItem)) {
    pushLog(next, "You lack the required gear for that choice.");
    return next;
  }

  const always = (ch.alwaysEffects ?? []).map((e) =>
    e.type === "appendLog" ? { ...e, text: templateString(next, e.text, rng) } : e,
  );
  next = applyEffects(next, always, rng);

  // Flat percent roll with specialty + trait bonuses
  let ok = true;
  if (ch.basePct !== undefined) {
    let chance = ch.basePct;

    // Specialty bonus: find the member assigned to fillsSlot (if any), else best in party
    if (ch.checkType) {
      const ct = ch.checkType as CheckType;
      let bestBonus = 0;
      if (ch.fillsSlot) {
        const chosen = resolveSlot(next, ch.fillsSlot);
        if (chosen) bestBonus = memberCheckBonus(chosen.specialty, chosen.traits ?? [], ct);
      } else {
        for (const f of livingFriends(next)) {
          const b = memberCheckBonus(f.specialty, f.traits ?? [], ct);
          if (b > bestBonus) bestBonus = b;
        }
      }
      chance = Math.min(95, chance + bestBonus);
    }

    // Lucky coin reroll
    const draw = Math.floor(rng() * 100);
    ok = draw < chance;
    if (!ok && hasItem(next, "u_lucky_coin") && next.flags.lucky_coin_used !== true) {
      const draw2 = Math.floor(rng() * 100);
      ok = draw2 < chance;
      if (ok) {
        next.flags.lucky_coin_used = true;
        pushLog(next, `Lucky coin redraws — success! (${chance}% odds)`);
      }
    }

    if (!next.flags.lucky_coin_used || !ok)
      pushLog(next, `${chance}% odds — ${ok ? "success" : "failure"}.`);
  }

  const branch = ok ? ch.successEffects : ch.failureEffects;
  const mapped = branch.map((e) =>
    e.type === "appendLog" ? { ...e, text: templateString(next, e.text, rng) } : e,
  );
  next = applyEffects(next, mapped, rng);

  if (ev.locations?.includes("embark") && next.kmRemaining <= 0 && next.embarkEventsLeft > 0)
    next.embarkEventsLeft -= 1;

  const lost = evaluateLoss(next);
  if (lost) {
    next.outcome = "lost";
    next.lostReason = lost;
    next.phase = "recap";
    pushLog(next, lost);
  } else if (evaluateWin(next)) {
    next.outcome = "won";
    next.phase = "recap";
    pushLog(next, "You clear final processing. Cold airlock light — then silence. You made the ship.");
  }
  return next;
}

export function resolveAmbientEvent(s: RunState, rng: () => number): RunState {
  if (!s.currentEvent || s.currentEvent.kind !== "ambient") return cloneState(s);
  let next = cloneState(s);
  next = applyEffects(next, s.currentEvent.ambientEffects ?? [], rng);
  next.currentEvent = null;
  const lost = evaluateLoss(next);
  if (lost) {
    next.outcome = "lost";
    next.lostReason = lost;
    next.phase = "recap";
    pushLog(next, lost);
  } else if (evaluateWin(next)) {
    next.outcome = "won";
    next.phase = "recap";
    pushLog(next, "You clear final processing. Cold airlock light — then silence. You made the ship.");
  }
  return next;
}

export function dismissRunModal(s: RunState): RunState {
  const out = cloneState(s);
  if (!out.runModal) return out;
  const was = out.runModal;
  out.runModal = null;

  if (was.kind === "location" && was.to !== "embark") {
    const listings = shopForLocation(was.to);
    if (listings.length > 0) {
      out.runModal = { kind: "shop", location: was.to };
      pushLog(out, `Traders open stalls in ${LOCATION_LABEL[was.to]}.`);
      return out;
    }
  }

  if (out.pendingEventAfterModal) {
    const rng = mulberry32((out.rngSeed + out.day * 7331) >>> 0);
    out.currentEvent = autoFillEventSlots(out.pendingEventAfterModal, out, rng);
    out.pendingEventAfterModal = null;
  }
  return out;
}

export function purchaseFromShop(
  s: RunState,
  location: LocationId,
  itemId: string,
  friendId?: string,
): RunState {
  const out = cloneState(s);
  const listing = shopForLocation(location).find((l) => l.itemId === itemId);
  const def = getItem(itemId);
  if (!listing || !def) return out;

  const price = listing.price;
  if (out.resources.caps < price) {
    pushLog(out, "Not enough caps.");
    return out;
  }

  if (def.kind === "personal") {
    if (!friendId) return out;
    const f = out.friends.find((x) => x.id === friendId);
    if (!f || f.status === "dead") return out;
    if (f.memberItems.includes(itemId)) {
      pushLog(out, `${f.name} already has that item.`);
      return out;
    }
    out.resources.caps -= price;
    f.memberItems.push(itemId);
    applyPersonalItemBonuses(f, itemId);
    pushLog(out, `${f.name} bought ${def.name} (−${price} caps).`);
    return out;
  }

  if (def.kind === "unique") {
    if (hasItem(out, itemId)) {
      pushLog(out, "Convoy already carries that unique item.");
      return out;
    }
    out.resources.caps -= price;
    addInventory(out, itemId, 1);
    pushLog(out, `Purchased ${def.name} (−${price} caps).`);
    return out;
  }

  // common — apply grants
  out.resources.caps -= price;
  if (def.grants) {
    if (def.grants.rations) out.resources.rations += def.grants.rations;
    if (def.grants.meds)    out.resources.meds    += def.grants.meds;
    if (def.grants.parts)   out.resources.parts   += def.grants.parts;
    if (def.grants.fuel)    out.resources.fuel    += def.grants.fuel;
  }
  pushLog(out, `Purchased ${def.name} (−${price} caps).`);
  return out;
}

// ── Daily action helpers ──────────────────────────────────────────────────────

function locationModalBody(to: LocationId): string {
  switch (to) {
    case "abandoned_city":
      return "Tower husks and dead traffic lights. Every window is a possible rifle port.";
    case "industrial_strip":
      return "Chemical ghosts cling to cracked pipeways. Old industry still bites.";
    case "dead_highway":
      return "Melted onramps and toll shrines to nothing. The port's glow stains the horizon.";
    case "port_sprawl":
      return "Checkpoints, shanty markets, and the arcology's rib cage swallowing the sky.";
    case "embark":
      return "Floodlights, cordons, and the last honest fear — too close to turn back.";
    default:
      return "The horizon thins. Another stretch of poisoned nowhere claims the road.";
  }
}

function applyEmbarkDay(out: RunState, rng: () => number): void {
  const n = livingFriends(out).length;
  const ps = partyScaling(n);
  const stress = out.difficulty === "hard" ? 1.15 : out.difficulty === "easier" ? 0.92 : 1;
  const er = Math.max(1, Math.round((1.2 * n * ps.rationMult * stress) / 7));
  out.resources.rations = Math.max(0, out.resources.rations - er);
  out.portChaos = Math.min(100, out.portChaos + 0.12 + rng() * 0.2);
  pushLog(out, `Embark queue: −${er} rations. Chaos grinds another notch.`);
}

function applyTravelDay(out: RunState, rng: () => number): void {
  const n = livingFriends(out).length;
  const ps = partyScaling(n);
  const diff = out.difficulty;
  const stress = diff === "hard" ? 1.15 : diff === "easier" ? 0.92 : 1;
  const pace = PACE_CONFIG[out.pace];

  // Ration consumption (scaled down — no minimum floor)
  const rationCost = Math.round(out.rationsPerPerson * n * pace.rationMult * stress * RATION_COST_SCALE);
  if (rationCost > 0) consumeRationsOrStarve(out, rationCost, "daily travel");

  // Morale from rations
  if (out.rationsPerPerson >= 3) {
    for (const f of livingFriends(out)) f.morale = Math.min(100, f.morale + 1);
  } else if (out.rationsPerPerson === 1) {
    for (const f of livingFriends(out)) f.morale = Math.max(0, f.morale - 2);
  }

  // Fuel consumption (pace-based; fractional barrels per day)
  const fuelMult = hasItem(out, "u_maps") ? 0.85 : 1;
  const fuelCost = roundFuel(pace.fuelPerDay * fuelMult);
  if (fuelCost > 0 && out.resources.fuel >= fuelCost) {
    out.resources.fuel = roundFuel(out.resources.fuel - fuelCost);
  } else if (fuelCost > 0 && out.resources.fuel > 0) {
    out.resources.fuel = 0;
  }
  const pushing = out.resources.fuel <= 0;
  if (pushing && fuelCost > 0) {
    pushLog(out, "No fuel — the convoy pushes the rig. Progress crawls; the road is brutal.");
  }

  // km gained: pace base + variance + transport bonus + personal item bonus
  let kmBonus = 0;
  for (const f of livingFriends(out)) {
    for (const itemId of f.memberItems) {
      const def = getItem(itemId);
      if (def?.memberEffect?.travelKmBonus) kmBonus += def.memberEffect.travelKmBonus;
    }
  }
  let kmGain =
    pace.baseKm +
    Math.floor(rng() * (pace.kmVariance + 1)) +
    Math.floor((out.transport / 100) * 6) +
    kmBonus -
    (out.portChaos > 60 ? 2 : 0);
  if (pushing) kmGain = Math.max(1, Math.round(kmGain * PUSH_SPEED_MULT));
  out.kmRemaining = Math.max(0, out.kmRemaining - kmGain);

  // Radiation
  let radTick = 1 + Math.floor(rng() * 2) + Math.floor(out.portChaos / 35);
  if (hasItem(out, "u_rad_blanket")) radTick = Math.max(0, Math.floor(radTick * 0.85));
  if (hasItem(out, "u_geiger")) radTick = Math.max(0, Math.floor(radTick * 0.85));
  if (
    hasItem(out, "u_rebreather") &&
    out.flags.rebreather_rad_soaked !== true &&
    radTick > 4
  ) {
    radTick -= 3;
    out.flags.rebreather_rad_soaked = true;
    pushLog(out, "The cracked rebreather absorbs a rad surge. It won't do that again.");
  }
  out.rads += radTick;

  // Port chaos drift
  out.portChaos = Math.min(100, out.portChaos + 0.08 + rng() * (out.kmRemaining < 900 ? 0.25 : 0.1));

  // Random breakdown
  if (rng() < 0.012 * ps.targetPressure) {
    out.transport = Math.max(0, out.transport - (1 + Math.floor(rng() * 2)));
    pushLog(out, "Convoy shudders: another breakdown on scorched asphalt.");
  }

  // Pace-based injury (much higher while pushing without fuel)
  const injuryChance = pace.injuryChance + (pushing ? PUSH_INJURY_BONUS : 0);
  for (const f of livingFriends(out)) {
    // Combine item + trait injury resistance
    const resistPct = memberPassiveBonus(f, "injuryResistance");
    const resist = resistPct / 100;
    const effectiveChance = Math.max(0, injuryChance - resist);
    if (rng() < effectiveChance && f.status === "alive") {
      f.status = "injured";
      f.health = Math.min(f.health, Math.round(f.maxHealth * 0.6));
      pushLog(
        out,
        pushing
          ? `${f.name} was hurt while pushing the convoy.`
          : `${f.name} was hurt on the road.`,
      );
    }
  }

  const rationNote = rationCost > 0 ? `−${rationCost} rations` : "rations unchanged";
  const fuelNote = pushing
    ? "out of fuel (pushing)"
    : fuelCost > 0
      ? `−${fuelCost.toFixed(1)} fuel`
      : "fuel unchanged";
  pushLog(
    out,
    `Travel (${PACE_LABEL[out.pace]}${pushing ? ", pushing rig" : ""}): ${rationNote}, ${fuelNote}, −${kmGain} km, +${radTick} rads.`,
  );

  if (out.kmRemaining <= 0 && out.embarkEventsLeft === 0 && !out.flags.embark_chain_started) {
    out.flags.embark_chain_started = true;
    out.embarkEventsLeft = 6 + Math.min(4, n);
    pushLog(out, "The launch complex looms. Embarkation is not mercy — only another gauntlet.");
  }
}

/**
 * "Search for Food" — pause-menu action.
 * Base 55% success, boosted by party members' scavengeBonus items.
 */
function applySearchFoodDay(out: RunState, rng: () => number): void {
  const n = livingFriends(out).length;
  const rationCost = Math.round(out.rationsPerPerson * n * 0.35);
  if (rationCost > 0) consumeRationsOrStarve(out, rationCost, "searching for food");
  out.rads += 1 + Math.floor(rng() * 3);

  // Compute success chance: base 55% + scavengeBonus (items + traits) + best specialty
  let chance = 55;
  let bestScavengeSpec = 0;
  for (const f of livingFriends(out)) {
    chance += memberPassiveBonus(f, "scavengeBonus");
    const specBonus = memberCheckBonus(f.specialty, f.traits ?? [], "scavenge" as CheckType);
    if (specBonus > bestScavengeSpec) bestScavengeSpec = specBonus;
  }
  chance += bestScavengeSpec;
  chance = Math.min(90, chance);

  const roll = Math.floor(rng() * 100);
  if (roll < chance) {
    const roll2 = rng();
    let result = "";
    // Rations are the most common find; other resources appear less often.
    if (roll2 < 0.5) {
      const rations = 10 + Math.floor(rng() * 16); // 10–25, slightly more generous
      out.resources.rations += rations;
      result = `+${rations} rations`;
    } else if (roll2 < 0.72) {
      const rations = 6 + Math.floor(rng() * 9);
      const parts = 1 + Math.floor(rng() * 3);
      out.resources.rations += rations;
      out.resources.parts += parts;
      result = `+${rations} rations, +${parts} parts`;
    } else if (roll2 < 0.88) {
      const fuel = 7 + Math.floor(rng() * 11); // 7–17
      out.resources.fuel += fuel;
      result = `+${fuel} fuel`;
    } else {
      const meds = 1 + Math.floor(rng() * 3); // 1–3, slightly more meds
      out.resources.meds += meds;
      result = `+${meds} meds`;
    }
    pushLog(out, `Search: found supplies — ${result}.`);
  } else {
    pushLog(out, `Search: nothing useful out there (−${rationCost} rations used searching).`);
  }
}

/** "Stop to Rest" — pause-menu action. Heals party, treats sick. */
function applyRestDay(out: RunState, rng: () => number): void {
  const n = livingFriends(out).length;
  const rationCost = Math.round(out.rationsPerPerson * n * 0.55);
  if (rationCost > 0) consumeRationsOrStarve(out, rationCost, "resting");

  for (const f of livingFriends(out)) {
    // Base rest heal raised (8–13 → 12–19) so a rest day is a meaningful recovery.
    let heal = 12 + Math.floor(rng() * 8);
    // Personal item heal bonus (medic bag, stim injector, etc.)
    for (const itemId of f.memberItems) {
      const def = getItem(itemId);
      if (def?.memberEffect?.dailyHealBonus) heal += def.memberEffect.dailyHealBonus;
    }
    f.health = Math.min(f.maxHealth, f.health + heal);
    if (f.health > f.maxHealth * 0.55 && f.status === "injured") f.status = "alive";
    f.morale = Math.min(100, f.morale + 4 + Math.floor(rng() * 5));
  }

  // Treat sick with meds
  for (const f of livingFriends(out)) {
    if (!f.sick) continue;
    if (out.resources.meds >= 2) {
      const sicknessName = f.sick.name;
      out.resources.meds -= 2;
      f.sick = undefined;
      pushLog(out, `Meds and rest clear ${sicknessName} from ${f.name}.`);
    } else {
      pushLog(out, `${f.name} is ill (${f.sick.name}, ${f.sick.daysLeft}d) but no meds available.`);
    }
  }

  pushLog(out, `Rest: −${rationCost} rations. The party recovers.`);
}

/**
 * "Attempt to Trade" — pause-menu action.
 * Spends a day. Base 50% success (+tradeBonus from personal items).
 * On success: opens shop modal. On failure: nothing.
 */
function applyTradeAttemptDay(out: RunState, rng: () => number): void {
  const n = livingFriends(out).length;
  const rationCost = Math.round(out.rationsPerPerson * n * 0.35);
  if (rationCost > 0) consumeRationsOrStarve(out, rationCost, "attempting to trade");

  let chance = 50;
  let bestTradeSpec = 0;
  for (const f of livingFriends(out)) {
    chance += memberPassiveBonus(f, "tradeBonus");
    const specBonus = memberCheckBonus(f.specialty, f.traits ?? [], "negotiate" as CheckType);
    if (specBonus > bestTradeSpec) bestTradeSpec = specBonus;
  }
  chance += bestTradeSpec;
  chance = Math.min(85, chance);

  const roll = Math.floor(rng() * 100);
  if (roll < chance) {
    pushLog(out, "A trader's banner at the next ruin — they're willing to deal.");
    if (!out.runModal)
      out.runModal = { kind: "shop", location: out.currentLocation };
  } else {
    pushLog(out, `Attempt to trade: no traders found (−${rationCost} rations wasted).`);
  }
}

// ── Daily turn ────────────────────────────────────────────────────────────────

export function resolveDailyTurn(s: RunState, action: DailyAction): RunState {
  if (s.currentEvent || s.runModal || s.outcome !== "ongoing") return cloneState(s);

  const rng = mulberry32((s.rngSeed + s.day * 9973 + action.length * 31) >>> 0);
  const out = cloneState(s);
  const prevLoc = s.currentLocation;

  out.day += 1;
  out.departureDaysRemaining -= 1;

  // Sickness tick
  processSicknessDay(out);

  if (out.kmRemaining <= 0) {
    applyEmbarkDay(out, rng);
  } else {
    switch (action) {
      case "travel":      applyTravelDay(out, rng);      break;
      case "search_food": applySearchFoodDay(out, rng);  break;
      case "rest":        applyRestDay(out, rng);        break;
      case "trade":       applyTradeAttemptDay(out, rng); break;
    }
  }

  out.currentLocation = locationFromKm(out.kmRemaining);
  const locationChanged = out.currentLocation !== prevLoc;

  // Early loss check
  const lost0 = evaluateLoss(out);
  if (lost0) {
    out.outcome = "lost";
    out.lostReason = lost0;
    out.phase = "recap";
    pushLog(out, lost0);
    return out;
  }

  // Random travel events (travel action only)
  const rngEv = mulberry32((out.rngSeed + out.day * 11003) >>> 0);
  let maybeEvent: GameEvent | null = null;
  if (!out.runModal && action === "travel" && rngEv() < 0.35) {
    maybeEvent = pickNextEvent(out, TRAVEL_EVENTS, rngEv, "travel");
  }

  // Location change takes modal priority
  if (locationChanged && !out.runModal) {
    out.runModal = {
      kind: "location",
      to: out.currentLocation,
      body: locationModalBody(out.currentLocation),
    };
    out.pendingEventAfterModal = maybeEvent;
    out.currentEvent = null;
  } else if (locationChanged && out.runModal) {
    pushLog(out, `Entered ${LOCATION_LABEL[out.currentLocation]}.`);
    if (maybeEvent) out.pendingEventAfterModal = maybeEvent;
  } else if (maybeEvent) {
    out.currentEvent = autoFillEventSlots(maybeEvent, out, rngEv);
    out.pendingEventAfterModal = null;
  }

  // Final win/loss
  const lost = evaluateLoss(out);
  if (lost && out.outcome === "ongoing") {
    out.outcome = "lost";
    out.lostReason = lost;
    out.phase = "recap";
    pushLog(out, lost);
  } else if (evaluateWin(out)) {
    out.outcome = "won";
    out.phase = "recap";
    pushLog(out, "You clear final processing. Cold airlock light — then silence. You made the ship.");
  }

  return out;
}
