import type { Effect, Friend, GameEvent, RunState } from "../types";
import { NEGATIVE_TRAITS } from "../types";
import type { LocationId } from "./locations";
import { LOCATION_LABEL, locationFromKm } from "./locations";
import { getItem } from "../config/items";
import { DIFFICULTY, partyScaling } from "../config/difficulty";
import { mulberry32, pickIndex } from "./rng";
import { ALL_EVENTS } from "../content/events";

const NEG_SET = new Set<string>(NEGATIVE_TRAITS);

export type DailyAction = "travel" | "scavenge" | "rest" | "repair" | "scout";

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

function negativeTraitMalus(s: RunState): number {
  let c = 0;
  for (const f of livingFriends(s)) {
    for (const t of f.traits) {
      if (NEG_SET.has(t)) c += 1;
    }
  }
  return Math.min(10, c * 2);
}

export function traitCheckBonus(
  s: RunState,
  trait: string | undefined,
  rng: () => number,
): { bonus: number; specialist: string } {
  if (!trait) return { bonus: 0, specialist: "" };
  const L = livingFriends(s);
  let bonus = 0;
  let specialist = "";
  for (const f of L) {
    if (f.traits.includes(trait as never)) {
      bonus += 6;
      if (!specialist || rng() > 0.5) specialist = f.name;
    }
  }
  if (hasItem(s, "u_geiger") && (trait === "radSense" || s.rads > 45)) {
    bonus += 3;
  }
  if (hasItem(s, "u_saint_patch") && trait === "mechanic") {
    const anyMorale = L.some((f) => f.morale > 40);
    if (anyMorale) bonus += 3;
  }
  if (hasItem(s, "u_dog_tags") && trait === "negotiator") bonus += 2;
  if (hasItem(s, "u_forge_kit") && s.flags.forge_kit_used !== true) {
    if (trait === "negotiator") bonus += 2;
  }
  bonus += Math.min(4, L.length);
  bonus -= negativeTraitMalus(s);
  return { bonus: Math.max(0, bonus), specialist };
}

export function rollTraitCheck(
  s: RunState,
  trait: string | undefined,
  dc: number,
  rng: () => number,
): { ok: boolean; roll: number; bonus: number; specialist: string } {
  if (!trait || dc === undefined) {
    return { ok: true, roll: 0, bonus: 0, specialist: "" };
  }
  const { bonus, specialist } = traitCheckBonus(s, trait, rng);
  const roll = Math.floor(rng() * 20) + 1;
  let ok = roll + bonus >= dc;
  if (
    !ok &&
    hasItem(s, "u_lucky_coin") &&
    s.flags.lucky_coin_used !== true
  ) {
    const roll2 = Math.floor(rng() * 20) + 1;
    ok = roll2 + bonus >= dc;
    if (ok) s.flags.lucky_coin_used = true;
  }
  return { ok, roll, bonus, specialist };
}

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
          } else if (f.health < f.maxHealth * 0.45) f.status = "injured";
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
      case "item":
        addInventory(s, e.itemId, e.count ?? 1);
        break;
      case "removeItem":
        removeInventory(s, e.itemId, e.count ?? 1);
        break;
      case "setEmbark":
        s.embarkEventsLeft = e.value;
        break;
      default:
        break;
    }
  }
  return s;
}

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

export function evaluateLoss(s: RunState): string | null {
  if (s.departureDaysRemaining <= 0)
    return "The last ship’s window closed before you arrived.";
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

  if (ev.requiresLocation)
    return s.currentLocation === ev.requiresLocation;

  if (!ev.locations?.length) return true;
  return ev.locations.includes(s.currentLocation);
}

export function pickNextEvent(
  s: RunState,
  pool: GameEvent[],
  rng: () => number,
): GameEvent | null {
  const eligible = pool.filter((ev) => eventMatchesRun(ev, s));
  if (!eligible.length) return null;
  const n = livingFriends(s).length;
  const dw =
    DIFFICULTY[s.difficulty].encounterWeight * partyScaling(n).encounterMult;
  const weights = eligible.map((e) => (e.weight ?? 1) * dw);
  return eligible[pickIndex(rng, weights)];
}

export function resolveChoice(
  s: RunState,
  ev: GameEvent,
  choiceId: string,
  rng: () => number,
): RunState {
  const ch = ev.choices.find((c) => c.id === choiceId);
  if (!ch) return s;
  let next = cloneState(s);
  const spec = traitCheckBonus(next, ch.trait, rng).specialist;
  const tpl = (t: string) => templateString(next, t, spec, rng);
  if (ch.requiredItem && !hasItem(next, ch.requiredItem)) {
    pushLog(next, "You lack the required gear for that choice.");
    return next;
  }
  const always = (ch.alwaysEffects ?? []).map((e) =>
    e.type === "appendLog" ? { ...e, text: tpl(e.text) } : e,
  );
  next = applyEffects(next, always, rng);
  let ok = true;
  if (ch.trait !== undefined && ch.dc !== undefined) {
    const dc =
      ch.dc +
      (next.kmRemaining <= 0
        ? partyScaling(livingFriends(next).length).embarkDcAdd
        : 0);
    const r = rollTraitCheck(next, ch.trait, dc, rng);
    ok = r.ok;
    pushLog(
      next,
      tpl(
        `Check (${ch.trait}): rolled ${r.roll} + ${r.bonus} vs ${dc} → ${ok ? "success" : "failure"}.`,
      ),
    );
  }
  const branch = ok ? ch.successEffects : ch.failureEffects;
  const mapped = branch.map((e) =>
    e.type === "appendLog" ? { ...e, text: tpl(e.text) } : e,
  );
  next = applyEffects(next, mapped, rng);
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
    pushLog(
      next,
      "You clear final processing. Cold airlock light—then silence. You made the ship.",
    );
  }
  return next;
}

function dailyEventChance(action: DailyAction): number {
  switch (action) {
    case "travel":
      return 0.38;
    case "scavenge":
      return 0.32;
    case "scout":
      return 0.28;
    case "repair":
      return 0.12;
    case "rest":
      return 0.14;
    default:
      return 0.2;
  }
}

function applyEmbarkDay(out: RunState, rng: () => number): void {
  const n = livingFriends(out).length;
  const ps = partyScaling(n);
  const diffStress =
    out.difficulty === "hard" ? 1.15 : out.difficulty === "easier" ? 0.92 : 1;
  const er = Math.max(1, Math.round((1.2 * n * ps.rationMult * diffStress) / 7));
  const ew = Math.max(1, Math.round((1.0 * n * ps.rationMult * diffStress) / 7));
  out.resources.rations = Math.max(0, out.resources.rations - er);
  out.resources.water = Math.max(0, out.resources.water - ew);
  out.portChaos = Math.min(100, out.portChaos + 0.12 + rng() * 0.2);
  pushLog(
    out,
    `Embark queue: −${er} rations, −${ew} water. Chaos grinds another notch.`,
  );
}

function applyTravelDay(out: RunState, rng: () => number): void {
  const n = livingFriends(out).length;
  const ps = partyScaling(n);
  const diffStress =
    out.difficulty === "hard" ? 1.15 : out.difficulty === "easier" ? 0.92 : 1;

  const rationCost = Math.max(
    1,
    Math.round((2.2 * n * ps.rationMult * diffStress) / 7),
  );
  const waterCost = Math.max(
    1,
    Math.round((1.8 * n * ps.rationMult * diffStress) / 7),
  );
  out.resources.rations = Math.max(0, out.resources.rations - rationCost);
  out.resources.water = Math.max(0, out.resources.water - waterCost);
  const fuelUse = Math.max(
    1,
    Math.round(
      ((hasItem(out, "u_maps") ? 0.85 : 1) * (3 + n * 0.4) * diffStress) / 7,
    ),
  );
  out.resources.fuel = Math.max(0, out.resources.fuel - fuelUse);
  const kmGain =
    5 +
    Math.floor(rng() * 5) +
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
    pushLog(
      out,
      "The cracked rebreather eats a surge of rads. It will not do that again.",
    );
  }
  out.rads += radTick;
  const chaosRise = 0.08 + rng() * (out.kmRemaining < 900 ? 0.25 : 0.1);
  out.portChaos = Math.min(100, out.portChaos + chaosRise);
  if (rng() < 0.012 * ps.targetPressure) {
    out.transport = Math.max(0, out.transport - (1 + Math.floor(rng() * 2)));
    pushLog(out, "Convoy shudders: another breakdown on scorched asphalt.");
  }
  pushLog(
    out,
    `Travel: −${rationCost} rations, −${waterCost} water, −${fuelUse} fuel, −${kmGain} km, +${radTick} rads.`,
  );
  if (
    out.kmRemaining <= 0 &&
    out.embarkEventsLeft === 0 &&
    !out.flags.embark_chain_started
  ) {
    out.flags.embark_chain_started = true;
    out.embarkEventsLeft = 6 + Math.min(4, n);
    pushLog(
      out,
      "The launch complex looms. Embarkation is not mercy—only another gauntlet.",
    );
  }
}

function applyScavengeDay(out: RunState, rng: () => number): void {
  const n = livingFriends(out).length;
  const water = Math.max(1, Math.round(0.35 * n));
  out.resources.water = Math.max(0, out.resources.water - water);
  out.rads += 1 + Math.floor(rng() * 3);
  if (rng() < 0.45) {
    const found = 1 + Math.floor(rng() * 3);
    out.resources.rations += found;
    pushLog(
      out,
      `Scavenge: +${found} rations, −${water} water; dust in the lungs.`,
    );
  } else if (rng() < 0.72) {
    pushLog(out, `Scavenge: scraps only (−${water} water).`);
  } else {
    const tgt = pickTarget(out, "random_living", rng)[0];
    if (tgt) {
      tgt.health = Math.max(1, tgt.health - (8 + Math.floor(rng() * 14)));
      tgt.status = "injured";
      pushLog(
        out,
        `Scavenge gone wrong — ${tgt.name} is hurt (collapsed structure or fouled air).`,
      );
      out.runModal = {
        kind: "notice",
        title: "Injury on the scav line",
        body: `${tgt.name} took a bad hit. Auto-travel pauses until you continue.`,
      };
    }
  }
}

function applyRestDay(out: RunState, rng: () => number): void {
  const n = livingFriends(out).length;
  const rationCost = Math.max(1, Math.round((1.1 * n) / 7));
  const waterCost = Math.max(1, Math.round((0.9 * n) / 7));
  out.resources.rations = Math.max(0, out.resources.rations - rationCost);
  out.resources.water = Math.max(0, out.resources.water - waterCost);
  for (const f of livingFriends(out)) {
    f.health = Math.min(f.maxHealth, f.health + 4 + Math.floor(rng() * 6));
    if (f.health > f.maxHealth * 0.55 && f.status === "injured") f.status = "alive";
    f.morale = Math.min(100, f.morale + 2 + Math.floor(rng() * 4));
  }
  pushLog(
    out,
    `Rest: −${rationCost} rations, −${waterCost} water. Bodies recover a little.`,
  );
}

function applyRepairDay(out: RunState, rng: () => number): void {
  if (out.resources.parts < 2) {
    pushLog(out, "Repair skipped — not enough parts.");
    return;
  }
  const use = 1 + Math.floor(rng() * 2);
  out.resources.parts = Math.max(0, out.resources.parts - use);
  out.transport = Math.min(100, out.transport + 4 + Math.floor(rng() * 8));
  pushLog(
    out,
    `Repair: −${use} parts, convoy condition improves.`,
  );
}

function applyScoutDay(out: RunState, rng: () => number): void {
  const n = livingFriends(out).length;
  out.resources.water = Math.max(0, out.resources.water - Math.max(1, Math.round(0.25 * n)));
  if (rng() < 0.55) {
    out.flags.scout_route_bonus = true;
    pushLog(
      out,
      `${livingFriends(out)[0]?.name ?? "Scout"} maps a safer thread for the next march.`,
    );
  } else {
    out.rads += 2 + Math.floor(rng() * 4);
    pushLog(out, "Scouting pushes into a hot drift.");
  }
}

function locationModalBody(to: LocationId): string {
  switch (to) {
    case "abandoned_city":
      return "Tower husks and dead traffic lights. Every window is a possible rifle port.";
    case "industrial_strip":
      return "Chemical ghosts cling to cracked pipeways. Old industry still bites.";
    case "dead_highway":
      return "Melted onramps and toll shrines to nothing. The port’s glow stains the horizon.";
    case "port_sprawl":
      return "Checkpoints, shanty markets, and the arcology’s rib cage swallowing the sky.";
    case "embark":
      return "Floodlights, cordons, and the last honest fear—too close to turn back.";
    default:
      return "The horizon thins. Another stretch of poisoned nowhere claims the road.";
  }
}

/**
 * One calendar day: apply the chosen action, advance the clock, sync location,
 * optionally queue an encounter or a blocking notice / location modal.
 */
export function resolveDailyTurn(
  s: RunState,
  action: DailyAction,
): RunState {
  if (s.currentEvent || s.runModal || s.outcome !== "ongoing") return cloneState(s);

  const rng = mulberry32((s.rngSeed + s.day * 9973 + action.length * 31) >>> 0);
  const out = cloneState(s);
  const prevLoc = s.currentLocation;

  out.day += 1;
  out.departureDaysRemaining -= 1;
  pushLog(out, `— Day ${out.day}: ${action} —`);

  if (out.kmRemaining <= 0) {
    applyEmbarkDay(out, rng);
  } else {
    const travelBoost =
      out.flags.scout_route_bonus === true && action === "travel";
    if (travelBoost) out.flags.scout_route_bonus = false;
    switch (action) {
      case "travel":
        applyTravelDay(out, rng);
        if (travelBoost) {
          out.kmRemaining = Math.max(
            0,
            out.kmRemaining - (2 + Math.floor(rng() * 4)),
          );
          pushLog(out, "Scouted route pays off: a few extra km shaved.");
        }
        break;
      case "scavenge":
        applyScavengeDay(out, rng);
        break;
      case "rest":
        applyRestDay(out, rng);
        break;
      case "repair":
        applyRepairDay(out, rng);
        break;
      case "scout":
        applyScoutDay(out, rng);
        break;
      default:
        break;
    }
  }

  out.currentLocation = locationFromKm(out.kmRemaining);
  const locationChanged = out.currentLocation !== prevLoc;

  const lost0 = evaluateLoss(out);
  if (lost0) {
    out.outcome = "lost";
    out.lostReason = lost0;
    out.phase = "recap";
    pushLog(out, lost0);
    return out;
  }

  const skipRandomEvent = !!out.runModal;
  const rngEv = mulberry32((out.rngSeed + out.day * 11003) >>> 0);
  let maybeEvent: GameEvent | null = null;
  if (!skipRandomEvent && rngEv() < dailyEventChance(action)) {
    maybeEvent = pickNextEvent(out, ALL_EVENTS, rngEv);
  }

  if (locationChanged && !out.runModal) {
    out.runModal = {
      kind: "location",
      to: out.currentLocation,
      body: locationModalBody(out.currentLocation),
    };
    out.pendingEventAfterModal = maybeEvent;
    out.currentEvent = null;
  } else if (locationChanged && out.runModal) {
    pushLog(
      out,
      `Entered ${LOCATION_LABEL[out.currentLocation]} — too much else is going on for a full stop.`,
    );
    if (maybeEvent) {
      out.pendingEventAfterModal = maybeEvent;
    }
  } else if (maybeEvent) {
    out.currentEvent = maybeEvent;
    out.pendingEventAfterModal = null;
  }

  const lost = evaluateLoss(out);
  if (lost && out.outcome === "ongoing") {
    out.outcome = "lost";
    out.lostReason = lost;
    out.phase = "recap";
    pushLog(out, lost);
  } else if (evaluateWin(out)) {
    out.outcome = "won";
    out.phase = "recap";
    pushLog(
      out,
      "You clear final processing. Cold airlock light—then silence. You made the ship.",
    );
  }

  return out;
}

/** After dismissing runModal, surface a staged encounter if any. */
export function dismissRunModal(s: RunState): RunState {
  const out = cloneState(s);
  if (!out.runModal) return out;
  out.runModal = null;
  if (out.pendingEventAfterModal) {
    out.currentEvent = out.pendingEventAfterModal;
    out.pendingEventAfterModal = null;
  }
  return out;
}
