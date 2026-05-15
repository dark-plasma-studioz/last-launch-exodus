import type {
  DifficultyId,
  Friend,
  InventoryEntry,
  RunResources,
  RunState,
} from "../types";
import {
  DIFFICULTY,
  initialResources,
  partyScaling,
  START_KM,
  daysFromYears,
} from "../config/difficulty";
import { getItem } from "../config/items";
import { locationFromKm } from "./locations";

export interface DepotCart {
  /** itemId -> count */
  lines: Record<string, number>;
}

export function applyDepotCheckout(
  difficulty: DifficultyId,
  partySize: number,
  cart: DepotCart,
): {
  inventory: InventoryEntry[];
  resources: RunResources;
  capsRemaining: number;
  capsSpent: number;
} {
  const cap0 = DIFFICULTY[difficulty].startingCaps;
  let caps = cap0;
  const inventory: InventoryEntry[] = [];
  const base = initialResources(difficulty, partySize);
  const res: RunResources = { ...base };

  for (const [itemId, rawCount] of Object.entries(cart.lines)) {
    const count = Math.max(0, Math.floor(rawCount ?? 0));
    if (!count) continue;
    const def = getItem(itemId);
    if (!def || def.price <= 0) continue;
    const cost = def.price * count;
    if (cost > caps) continue;
    caps -= cost;
    if (def.kind === "unique") {
      inventory.push({ itemId, count: 1 });
    }
    if (def.grants) {
      const g = def.grants;
      if (g.rations) res.rations += g.rations * count;
      if (g.water) res.water += g.water * count;
      if (g.meds) res.meds += g.meds * count;
      if (g.parts) res.parts += g.parts * count;
      if (g.fuel) res.fuel += g.fuel * count;
    }
  }

  return {
    inventory,
    resources: res,
    capsRemaining: caps,
    capsSpent: cap0 - caps,
  };
}

export function createRunState(opts: {
  difficulty: DifficultyId;
  friends: Friend[];
  inventory: InventoryEntry[];
  resources: RunResources;
  rngSeed: number;
  capsSpentAtDepot: number;
}): RunState {
  const diff = DIFFICULTY[opts.difficulty];
  const days = daysFromYears(diff.years);
  const ps = partyScaling(opts.friends.length);
  const transport = Math.max(
    38,
    Math.round(64 - (ps.rationMult - 1) * 18 - (ps.encounterMult - 1) * 10),
  );

  return {
    phase: "run",
    difficulty: opts.difficulty,
    departureDaysRemaining: days,
    departureDaysTotal: days,
    kmRemaining: START_KM,
    startKm: START_KM,
    currentLocation: locationFromKm(START_KM),
    portChaos: 6 + Math.round((ps.encounterMult - 1) * 12),
    rads: 10,
    transport,
    resources: { ...opts.resources },
    friends: structuredClone(opts.friends),
    inventory: structuredClone(opts.inventory),
    flags: { embark_chain_started: false },
    log: [
      {
        day: 0,
        text: "The ash highway remembers nothing useful. Only distance, rads, and rumor of a last ship.",
      },
    ],
    currentEvent: null,
    pendingEventAfterModal: null,
    runModal: null,
    embarkEventsLeft: 0,
    day: 0,
    rngSeed: opts.rngSeed >>> 0,
    outcome: "ongoing",
    scoreCapsSpent: opts.capsSpentAtDepot,
    autoTravel: false,
  };
}
