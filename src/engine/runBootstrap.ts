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
  makeFriend,
  makeParty,
} from "../config/difficulty";
import { getItem } from "../config/items";
import { applyTraitBonuses } from "../config/traits";
import { locationFromKm } from "./locations";

export interface DepotCart {
  lines: Record<string, number>;
}

export type PersonalAssignments = Record<string, string>;

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
    if (def.kind === "unique" || def.kind === "personal") {
      inventory.push({ itemId, count: 1 });
    }
    if (def.grants) {
      const g = def.grants;
      if (g.rations) res.rations += g.rations * count;
      if (g.meds)    res.meds    += g.meds    * count;
      if (g.parts)   res.parts   += g.parts   * count;
      if (g.fuel)    res.fuel    += g.fuel    * count;
    }
  }

  return { inventory, resources: res, capsRemaining: caps, capsSpent: cap0 - caps };
}

export function createRunState(opts: {
  difficulty: DifficultyId;
  friends: Friend[];
  inventory: InventoryEntry[];
  resources: RunResources;
  rngSeed: number;
  capsSpentAtDepot: number;
  capsRemaining?: number;
  personalAssignments?: PersonalAssignments;
}): RunState {
  const diff = DIFFICULTY[opts.difficulty];
  const days = daysFromYears(diff.years);
  const ps = partyScaling(opts.friends.length);
  const transport = Math.max(
    38,
    Math.round(64 - (ps.rationMult - 1) * 18 - (ps.encounterMult - 1) * 10),
  );

  const friends: Friend[] = structuredClone(opts.friends).map((f) => {
    const friend = { ...f, sick: undefined, memberItems: [] as string[] };
    // Apply trait stat bonuses (maxHealth, morale, etc.)
    applyTraitBonuses(friend, friend.traits ?? []);
    return friend;
  });

  const assignments = opts.personalAssignments ?? {};
  for (const [itemId, friendId] of Object.entries(assignments)) {
    const def = getItem(itemId);
    if (!def || def.kind !== "personal") continue;
    const friend = friends.find((f) => f.id === friendId);
    if (!friend) continue;
    friend.memberItems.push(itemId);
    if (def.memberEffect) {
      const me = def.memberEffect;
      if (me.maxHealthBonus) {
        friend.maxHealth += me.maxHealthBonus;
        friend.health = Math.min(friend.maxHealth, friend.health + me.maxHealthBonus);
      }
      if (me.moraleBonus)
        friend.morale = Math.min(100, friend.morale + me.moraleBonus);
    }
  }

  const inventory = structuredClone(opts.inventory).filter((e) => {
    const def = getItem(e.itemId);
    return def?.kind !== "personal";
  });

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
    resources: { ...opts.resources, caps: opts.capsRemaining ?? opts.resources.caps },
    friends,
    inventory,
    flags: { embark_chain_started: false },
    log: [
      {
        day: 0,
        text: "The ash highway remembers nothing useful. Only distance, rads, and rumour of a last ship.",
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
    paused: false,
    pace: "steady",
    rationsPerPerson: 2,
  };
}

// Re-export so other modules can use these without importing difficulty directly
export { makeFriend, makeParty };
