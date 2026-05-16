import type { Effect, EventPool, Friend, GameEvent, RunState, TraitId } from "../types";
import { NEGATIVE_TRAITS } from "../types";
import type { LocationId } from "./locations";
import { LOCATION_LABEL, locationFromKm } from "./locations";
import { getItem } from "../config/items";
import { DIFFICULTY, partyScaling } from "../config/difficulty";
import { mulberry32, pickIndex } from "./rng";
import { SCAVENGE_EVENTS, TRAVEL_EVENTS } from "../content/events";
import { shopForLocation } from "../config/shops";

export type DailyAction = "travel" | "scavenge" | "rest" | "repair" | "scout";

const NEG_SET = new Set<string>(NEGATIVE_TRAITS);

function livingFriends(s: RunState): Friend[] {
  return s.friends.filter((f) => f.status !== "dead");
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
  target: "random_living" | "weakest" | "all_living",
  rng: () => number,
): Friend[] {
  const L = livingFriends(s);
  if (!L.length) return [];
  if (target === "all_living") return L;
  if (target === "weakest") {
    return [
      [...L].sort((a, b) => a.health / a.maxHealth - b.health / b.maxHealth)[0],
    ];
  }
  return [L[Math.floor(rng() * L.length)]];
}

// ── Chance system ────────────────────────────────────────────────────────────
//
// Content authors set basePct (0–100) per choice.  The engine modifies it:
//   +12% per living party member who has the required trait
//   +2%  per living member beyond the first (max +8%)
//   -3%  per negative trait across all living members (max -15%)
//   Item passive bonuses (geiger, dog_tags, etc.)
//   +checkBonus from personal items on the specialist member
//
// Final chance is clamped 0–100.

/**
 * Compute the final success percentage for a trait check.
 * Returns the chance and the name of the "specialist" (first trait holder).
 */
export function computeFinalChance(
  s: RunState,
  trait: TraitId | undefined,
  basePct: number,
): { chance: number; specialist: string } {
  if (!trait) return { chance: 100, specialist: "" };

  const L = livingFriends(s);
  let chance = basePct;
  let specialist = "";

  for (const f of L) {
    if (f.traits.includes(trait)) {
      chance += 12;
      if (!specialist) specialist = f.name;
      // Personal item bonus on this specialist
      for (const itemId of f.memberItems) {
        const def = getItem(itemId);
        if (def?.memberEffect?.checkBonus) chance += def.memberEffect.checkBonus;
      }
    }
  }

  // Party size bonus
  chance += Math.min((L.length - 1) * 2, 8);

  // Negative trait penalty
  let negCount = 0;
  for (const f of L) {
    for (const t of f.traits) {
      if (NEG_SET.has(t)) negCount++;
    }
  }
  chance -= Math.min(negCount * 3, 15);

  // Inventory item bonuses
  if (hasItem(s, "u_geiger") && (trait === "radSense" || s.rads > 45)) chance += 8;
  if (hasItem(s, "u_saint_patch") && trait === "mechanic") {
    if (L.some((f) => f.morale > 40)) chance += 8;
  }
  if (hasItem(s, "u_dog_tags") && trait === "negotiator") chance += 6;
  if (hasItem(s, "u_forge_kit") && s.flags.forge_kit_used !== true) {
    if (trait === "negotiator") chance += 6;
  }

  return { chance: Math.max(0, Math.min(100, Math.round(chance))), specialist };
}

/** Roll 0–99; succeed if draw < chance. Handles lucky coin. */
function rollPercentCheck(
  s: RunState,
  chance: number,
  rng: () => number,
): { ok: boolean; draw: number; usedCoin: boolean } {
  const draw = Math.floor(rng() * 100);
  let ok = draw < chance;
  let usedCoin = false;

  if (!ok && hasItem(s, "u_lucky_coin") && s.flags.lucky_coin_used !== true) {
    const draw2 = Math.floor(rng() * 100);
    ok = draw2 < chance;
    if (ok) {
      s.flags.lucky_coin_used = true;
      usedCoin = true;
    }
  }
  return { ok, draw, usedCoin };
}

function applyPersonalItemBonuses(f: Friend, itemId: string): void {
  const def = getItem(itemId);
  if (!def?.memberEffect) return;
  const me = def.memberEffect;
  if (me.maxHealthBonus) {
    f.maxHealth += me.maxHealthBonus;
    f.health += me.maxHealthBonus;
  }
  if (me.moraleBonus) {
    f.morale = Math.min(100, f.morale + me.moraleBonus);
  }
}

function grantPersonalItem(
  s: RunState,
  itemId: string,
  target: "random_living" | "weakest" | "specialist",
  rng: () => number,
  specialistName: string,
): void {
  const def = getItem(itemId);
  if (!def || def.kind !== "personal") return;

  let targets: Friend[];
  if (target === "specialist" && specialistName) {
    const f = livingFriends(s).find((x) => x.name === specialistName);
    targets = f ? [f] : pickTarget(s, "random_living", rng);
  } else if (target === "specialist") {
    targets = pickTarget(s, "random_living", rng);
  } else {
    targets = pickTarget(s, target, rng);
  }

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

// ── Sickness ─────────────────────────────────────────────────────────────────

function processSicknessDay(out: RunState): void {
  for (const f of livingFriends(out)) {
    if (!f.sick) continue;
    f.sick.daysLeft -= 1;
    if (f.sick.daysLeft === 3) {
      pushLog(out, `${f.name}'s ${f.sick.name} is worsening — 3 days left without medicine.`);
    } else if (f.sick.daysLeft <= 0) {
      const cause = f.sick.name;
      f.sick = undefined;
      f.status = "dead";
      f.health = 0;
      f.deathCause = cause;
      f.deathDay = out.day;
      pushLog(out, `${f.name} succumbed to ${cause}.`);
      if (!out.runModal) {
        out.runModal = {
          kind: "notice",
          title: "Death from illness",
          body: `${f.name} didn't make it. The ${cause} finished them before medicine arrived.`,
        };
      }
    }
  }
}

// ── applyEffects ─────────────────────────────────────────────────────────────

export function applyEffects(
  state: RunState,
  effects: Effect[],
  rng: () => number,
  specialistName = "",
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
          if (f.health > f.maxHealth * 0.55 && f.status === "injured")
            f.status = "alive";
        }
        break;
      }
      case "morale": {
        for (const f of livingFriends(s)) {
          f.morale = Math.max(0, Math.min(100, f.morale + e.delta));
        }
        break;
      }
      case "injure": {
        for (const f of pickTarget(s, e.target, rng)) {
          f.status = "injured";
          f.health = Math.min(f.health, f.maxHealth * 0.5);
        }
        break;
      }
      case "kill": {
        for (const f of pickTarget(s, e.target, rng)) {
          f.status = "dead";
          f.health = 0;
          f.deathCause = "the wastes";
          f.deathDay = s.day;
        }
        break;
      }
      case "sicken": {
        for (const f of pickTarget(s, e.target, rng)) {
          if (f.sick || f.status === "dead") break;
          let days = e.days;
          // Personal item resistance
          for (const itemId of f.memberItems) {
            const def = getItem(itemId);
            if (def?.memberEffect?.sicknessResistDays) days += def.memberEffect.sicknessResistDays;
          }
          f.sick = { name: e.sickness, daysLeft: days, totalDays: days };
          pushLog(s, `${f.name} has contracted ${e.sickness} (${days} days to treat).`);
          // Pre-war antibiotics auto-cure
          if (hasItem(s, "u_antibiotics")) {
            f.sick = undefined;
            removeInventory(s, "u_antibiotics", 1);
            pushLog(s, "Pre-war antibiotics course immediately treats the illness.");
          }
        }
        break;
      }
      case "cure": {
        for (const f of pickTarget(s, e.target, rng)) {
          if (f.sick) {
            const name = f.sick.name;
            f.sick = undefined;
            pushLog(s, `${f.name} has recovered from ${name}.`);
          }
        }
        break;
      }
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
        grantPersonalItem(s, e.itemId, e.target, rng, specialistName);
        break;
      default:
        break;
    }
  }
  return s;
}

// ── Template strings ──────────────────────────────────────────────────────────

export function templateString(
  s: RunState,
  text: string,
  specialist: string,
  rng: () => number,
): string {
  const L = livingFriends(s);
  const random = L.length ? L[Math.floor(rng() * L.length)].name : "nobody";
  const best = (trait: string) => {
    const fs = L.filter((f) => f.traits.includes(trait as never));
    if (!fs.length) return random;
    return fs.reduce((a, b) => (a.health >= b.health ? a : b)).name;
  };
  return text
    .replaceAll("{randomLiving}", random)
    .replaceAll("{specialist}", specialist || random)
    .replaceAll("{best_medic}", best("medic"))
    .replaceAll("{best_mechanic}", best("mechanic"))
    .replaceAll("{best_navigator}", best("navigator"));
}

// ── Win / loss evaluation ────────────────────────────────────────────────────

export function evaluateLoss(s: RunState): string | null {
  if (s.departureDaysRemaining <= 0)
    return "The last ship's window closed before you arrived.";
  if (!livingFriends(s).length) return "Your entire party is gone.";
  if (s.transport <= 0 && s.kmRemaining > 80)
    return "Your convoy seized—no viable transport across the dead highways.";
  if (s.resources.rations <= 0 && s.resources.water <= 0)
    return "Starvation and thirst finished what the bombs started.";
  return null;
}

export function evaluateWin(s: RunState): boolean {
  return (
    s.kmRemaining <= 0 &&
    s.embarkEventsLeft <= 0 &&
    livingFriends(s).length > 0
  );
}

// ── Event eligibility ────────────────────────────────────────────────────────

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
  const dw =
    DIFFICULTY[s.difficulty].encounterWeight * partyScaling(n).encounterMult;
  const weights = eligible.map((e) => (e.weight ?? 1) * dw);
  return eligible[pickIndex(rng, weights)];
}

// ── Choice resolution ─────────────────────────────────────────────────────────

export function resolveChoice(
  s: RunState,
  ev: GameEvent,
  choiceId: string,
  rng: () => number,
): RunState {
  const ch = (ev.choices ?? []).find((c) => c.id === choiceId);
  if (!ch) return s;
  let next = cloneState(s);
  const { specialist: spec } = computeFinalChance(next, ch.trait, ch.basePct ?? 100);
  const tpl = (t: string) => templateString(next, t, spec, rng);

  if (ch.requiredItem && !hasItem(next, ch.requiredItem)) {
    pushLog(next, "You lack the required gear for that choice.");
    return next;
  }

  // Apply always-effects
  const always = (ch.alwaysEffects ?? []).map((e) =>
    e.type === "appendLog" ? { ...e, text: tpl(e.text) } : e,
  );
  next = applyEffects(next, always, rng, spec);

  let ok = true;
  if (ch.trait !== undefined && ch.basePct !== undefined) {
    const { chance } = computeFinalChance(next, ch.trait, ch.basePct);
    const { ok: rolled, draw, usedCoin } = rollPercentCheck(next, chance, rng);
    ok = rolled;
    pushLog(
      next,
      tpl(
        `${ch.trait}: ${chance}% odds. Drew ${draw} — need under ${chance}${usedCoin ? " · lucky coin" : ""} → ${ok ? "success" : "failure"}.`,
      ),
    );
  }

  const branch = ok ? ch.successEffects : ch.failureEffects;
  const mapped = branch.map((e) =>
    e.type === "appendLog" ? { ...e, text: tpl(e.text) } : e,
  );
  next = applyEffects(next, mapped, rng, spec);

  if (ev.locations?.includes("embark") && next.kmRemaining <= 0 && next.embarkEventsLeft > 0) {
    next.embarkEventsLeft -= 1;
  }

  const lost = evaluateLoss(next);
  if (lost) {
    next.outcome = "lost";
    next.lostReason = lost;
    next.phase = "recap";
    pushLog(next, lost);
  } else if (evaluateWin(next)) {
    next.outcome = "won";
    next.phase = "recap";
    pushLog(next, "You clear final processing. Cold airlock light—then silence. You made the ship.");
  }
  return next;
}

/** Resolve an ambient event: apply its effects and clear currentEvent. */
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
    pushLog(next, "You clear final processing. Cold airlock light—then silence. You made the ship.");
  }
  return next;
}

/** After dismissing runModal, surface shop or staged encounter if any. */
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
    out.currentEvent = out.pendingEventAfterModal;
    out.pendingEventAfterModal = null;
  }
  return out;
}

/** Buy from a biome shop using run caps. */
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

  out.resources.caps -= price;
  if (def.grants) {
    const g = def.grants;
    if (g.rations) out.resources.rations += g.rations;
    if (g.water) out.resources.water += g.water;
    if (g.meds) out.resources.meds += g.meds;
    if (g.parts) out.resources.parts += g.parts;
    if (g.fuel) out.resources.fuel += g.fuel;
  }
  pushLog(out, `Purchased ${def.name} (−${price} caps).`);
  return out;
}

// ── Daily action helpers ──────────────────────────────────────────────────────

/** Only travel and scavenge can trigger random events. */
function dailyEventChance(action: DailyAction): number {
  if (action === "travel") return 0.35;
  if (action === "scavenge") return 0.4;
  return 0;
}

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
      return "Floodlights, cordons, and the last honest fear—too close to turn back.";
    default:
      return "The horizon thins. Another stretch of poisoned nowhere claims the road.";
  }
}

function applyEmbarkDay(out: RunState, rng: () => number): void {
  const n = livingFriends(out).length;
  const ps = partyScaling(n);
  const stress = out.difficulty === "hard" ? 1.15 : out.difficulty === "easier" ? 0.92 : 1;
  const er = Math.max(1, Math.round((1.2 * n * ps.rationMult * stress) / 7));
  const ew = Math.max(1, Math.round((1.0 * n * ps.rationMult * stress) / 7));
  out.resources.rations = Math.max(0, out.resources.rations - er);
  out.resources.water = Math.max(0, out.resources.water - ew);
  out.portChaos = Math.min(100, out.portChaos + 0.12 + rng() * 0.2);
  pushLog(out, `Embark queue: −${er} rations, −${ew} water. Chaos grinds another notch.`);
}

function applyTravelDay(out: RunState, rng: () => number): void {
  const n = livingFriends(out).length;
  const ps = partyScaling(n);
  const stress = out.difficulty === "hard" ? 1.15 : out.difficulty === "easier" ? 0.92 : 1;

  const rationCost = Math.max(1, Math.round((2.2 * n * ps.rationMult * stress) / 7));
  const waterCost  = Math.max(1, Math.round((1.8 * n * ps.rationMult * stress) / 7));
  out.resources.rations = Math.max(0, out.resources.rations - rationCost);
  out.resources.water   = Math.max(0, out.resources.water   - waterCost);

  const fuelUse = Math.max(1, Math.round(
    ((hasItem(out, "u_maps") ? 0.85 : 1) * (3 + n * 0.4) * stress) / 7,
  ));
  out.resources.fuel = Math.max(0, out.resources.fuel - fuelUse);

  const kmGain =
    5 + Math.floor(rng() * 5) +
    Math.floor((out.transport / 100) * 6) -
    (out.portChaos > 60 ? 2 : 0);
  out.kmRemaining = Math.max(0, out.kmRemaining - kmGain);

  let radTick = 1 + Math.floor(rng() * 2) + Math.floor(out.portChaos / 35);
  if (hasItem(out, "u_rad_blanket")) radTick = Math.max(0, Math.floor(radTick * 0.85));
  if (
    hasItem(out, "u_rebreather") &&
    out.flags.rebreather_rad_soaked !== true &&
    radTick > 4
  ) {
    radTick -= 3;
    out.flags.rebreather_rad_soaked = true;
    pushLog(out, "The cracked rebreather eats a surge of rads. It will not do that again.");
  }
  out.rads += radTick;

  const chaosRise = 0.08 + rng() * (out.kmRemaining < 900 ? 0.25 : 0.1);
  out.portChaos = Math.min(100, out.portChaos + chaosRise);

  if (rng() < 0.012 * ps.targetPressure) {
    out.transport = Math.max(0, out.transport - (1 + Math.floor(rng() * 2)));
    pushLog(out, "Convoy shudders: another breakdown on scorched asphalt.");
  }
  pushLog(out, `Travel: −${rationCost} rations, −${waterCost} water, −${fuelUse} fuel, −${kmGain} km, +${radTick} rads.`);

  if (out.kmRemaining <= 0 && out.embarkEventsLeft === 0 && !out.flags.embark_chain_started) {
    out.flags.embark_chain_started = true;
    out.embarkEventsLeft = 6 + Math.min(4, n);
    pushLog(out, "The launch complex looms. Embarkation is not mercy—only another gauntlet.");
  }
}

function applyScavengeDay(out: RunState, rng: () => number): void {
  const n = livingFriends(out).length;
  const waterCost = Math.max(1, Math.round(0.35 * n));
  out.resources.water = Math.max(0, out.resources.water - waterCost);
  out.rads += 1 + Math.floor(rng() * 3);

  const roll = rng();
  if (roll < 0.28) {
    const rations = 2 + Math.floor(rng() * 4);
    out.resources.rations += rations;
    pushLog(out, `Scavenge: +${rations} rations (−${waterCost} water).`);
  } else if (roll < 0.52) {
    const w = 2 + Math.floor(rng() * 5);
    out.resources.water += w;
    pushLog(out, `Scavenge: +${w} water (net after −${waterCost} search cost).`);
  } else if (roll < 0.68) {
    const rations = 1 + Math.floor(rng() * 3);
    const w = 1 + Math.floor(rng() * 3);
    out.resources.rations += rations;
    out.resources.water += w;
    pushLog(
      out,
      `Scavenge: +${rations} rations, +${w} water (−${waterCost} water).`,
    );
  } else if (roll < 0.78) {
    const parts = 1 + Math.floor(rng() * 4);
    out.resources.parts += parts;
    pushLog(out, `Scavenge: +${parts} parts (−${waterCost} water).`);
  } else if (roll < 0.86) {
    const fuel = 1 + Math.floor(rng() * 4);
    out.resources.fuel += fuel;
    pushLog(out, `Scavenge: +${fuel} fuel (−${waterCost} water).`);
  } else if (roll < 0.92) {
    out.resources.rations += 1;
    out.resources.water += 2;
    out.resources.parts += 1;
    pushLog(
      out,
      `Scavenge: mixed haul (+1 rations, +2 water, +1 parts, −${waterCost} water).`,
    );
  } else if (roll < 0.97) {
    pushLog(out, `Scavenge: nothing useful (−${waterCost} water).`);
  } else {
    const tgt = pickTarget(out, "random_living", rng)[0];
    if (tgt) {
      tgt.health = Math.max(1, tgt.health - (8 + Math.floor(rng() * 12)));
      tgt.status = "injured";
      pushLog(out, `Scavenge accident — ${tgt.name} is hurt.`);
    } else {
      pushLog(out, `Scavenge: empty (−${waterCost} water).`);
    }
  }
}

function applyRestDay(out: RunState, rng: () => number): void {
  const n = livingFriends(out).length;
  const rationCost = Math.max(1, Math.round((1.1 * n) / 7));
  const waterCost  = Math.max(1, Math.round((0.9 * n) / 7));
  out.resources.rations = Math.max(0, out.resources.rations - rationCost);
  out.resources.water   = Math.max(0, out.resources.water   - waterCost);

  for (const f of livingFriends(out)) {
    f.health = Math.min(f.maxHealth, f.health + 4 + Math.floor(rng() * 6));
    if (f.health > f.maxHealth * 0.55 && f.status === "injured") f.status = "alive";
    f.morale = Math.min(100, f.morale + 2 + Math.floor(rng() * 4));
  }

  // Attempt to treat sick members with meds during rest
  for (const f of livingFriends(out)) {
    if (!f.sick) continue;
    if (out.resources.meds >= 2) {
      const sicknessName = f.sick.name;
      out.resources.meds -= 2;
      f.sick = undefined;
      pushLog(out, `Meds and rest drive ${sicknessName} out of ${f.name}.`);
    } else {
      pushLog(out, `${f.name} is ill (${f.sick.name}, ${f.sick.daysLeft}d left) but there are no meds.`);
    }
  }

  pushLog(out, `Rest: −${rationCost} rations, −${waterCost} water. Bodies recover a little.`);
}

function applyRepairDay(out: RunState, rng: () => number): void {
  if (out.resources.parts < 2) {
    pushLog(out, "Repair skipped — not enough parts.");
    return;
  }
  const use = 1 + Math.floor(rng() * 2);
  out.resources.parts = Math.max(0, out.resources.parts - use);
  out.transport = Math.min(100, out.transport + 4 + Math.floor(rng() * 8));
  pushLog(out, `Repair: −${use} parts, convoy condition improves.`);
}

function applyScoutDay(out: RunState, rng: () => number): void {
  const n = livingFriends(out).length;
  out.resources.water = Math.max(0, out.resources.water - Math.max(1, Math.round(0.25 * n)));
  if (rng() < 0.55) {
    out.flags.scout_route_bonus = true;
    pushLog(out, `${livingFriends(out)[0]?.name ?? "Scout"} maps a safer thread for the next march.`);
  } else {
    out.rads += 2 + Math.floor(rng() * 4);
    pushLog(out, "Scouting pushes into a hot drift.");
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
  pushLog(out, `— Day ${out.day}: ${action} —`);

  // Sickness tick happens before the action
  processSicknessDay(out);

  if (out.kmRemaining <= 0) {
    applyEmbarkDay(out, rng);
  } else {
    const travelBoost = out.flags.scout_route_bonus === true && action === "travel";
    if (travelBoost) out.flags.scout_route_bonus = false;
    switch (action) {
      case "travel":
        applyTravelDay(out, rng);
        if (travelBoost) {
          out.kmRemaining = Math.max(0, out.kmRemaining - (2 + Math.floor(rng() * 4)));
          pushLog(out, "Scouted route pays off: a few extra km shaved.");
        }
        break;
      case "scavenge": applyScavengeDay(out, rng); break;
      case "rest":     applyRestDay(out, rng);     break;
      case "repair":   applyRepairDay(out, rng);   break;
      case "scout":    applyScoutDay(out, rng);    break;
    }
  }

  out.currentLocation = locationFromKm(out.kmRemaining);
  const locationChanged = out.currentLocation !== prevLoc;

  // Early loss check (starvation, etc.)
  const lost0 = evaluateLoss(out);
  if (lost0) {
    out.outcome = "lost";
    out.lostReason = lost0;
    out.phase = "recap";
    pushLog(out, lost0);
    return out;
  }

  // Random events: travel → road pool; scavenge → salvage pool; rest/repair/scout → none
  const rngEv = mulberry32((out.rngSeed + out.day * 11003) >>> 0);
  let maybeEvent: GameEvent | null = null;
  const skipRandom = !!out.runModal;
  const evChance = dailyEventChance(action);
  if (!skipRandom && evChance > 0 && rngEv() < evChance) {
    if (action === "scavenge") {
      maybeEvent = pickNextEvent(out, SCAVENGE_EVENTS, rngEv, "scavenge");
    } else if (action === "travel") {
      maybeEvent = pickNextEvent(out, TRAVEL_EVENTS, rngEv, "travel");
    }
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
    out.currentEvent = maybeEvent;
    out.pendingEventAfterModal = null;
  }

  // Final win/loss check
  const lost = evaluateLoss(out);
  if (lost && out.outcome === "ongoing") {
    out.outcome = "lost";
    out.lostReason = lost;
    out.phase = "recap";
    pushLog(out, lost);
  } else if (evaluateWin(out)) {
    out.outcome = "won";
    out.phase = "recap";
    pushLog(out, "You clear final processing. Cold airlock light—then silence. You made the ship.");
  }

  return out;
}
