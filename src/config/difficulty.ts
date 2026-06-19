import type { DifficultyId, Friend, RunResources, SpecialtyId, TraitId } from "../types";
import { mulberry32 } from "../engine/rng";
import { assignSpecialties, rollTraits } from "./traits";

export interface DifficultyConfig {
  label: string;
  years: number;
  startingCaps: number;
  baseRations: number;
  baseMeds: number;
  baseParts: number;
  baseFuel: number;
  encounterWeight: number;
  rationStress: number;
}

/**
 * Difficulty tuning notes:
 *
 * "Hard" is designed to punish every bad decision. You must scavenge constantly
 * and cannot afford to rest much. The goal is still achievable with good choices.
 *
 * "Standard" is the intended experience — tight resources but not hopeless.
 * Players should feel pressure without feeling cheated.
 *
 * "Easier" is forgiving. Bad events hurt but rarely cascade into runs ending.
 * It's a good mode to learn the event landscape on.
 *
 * Rule of thumb: baseMeds should cover at least 2–3 sicknesses before foraging.
 * Fuel should last roughly the first third of the journey on steady pace.
 * Caps should afford one or two meaningful depot upgrades.
 */
export const DIFFICULTY: Record<DifficultyId, DifficultyConfig> = {
  hard: {
    label: "Hard",
    years: 1.5,
    startingCaps: 800,      // up from 750 — still brutal but not impossible to equip
    baseRations: 52,
    baseMeds: 6,            // up from 4 — was too easy to die from first sickness
    baseParts: 7,           // up from 5
    baseFuel: 32,           // up from 28 — steady pace burns 0.4/day, this buys ~80 days
    encounterWeight: 1.25,
    rationStress: 1.2,
  },
  standard: {
    label: "Standard",
    years: 2,
    startingCaps: 1100,     // up from 1000
    baseRations: 75,
    baseMeds: 8,            // up from 6 — sickness hits hard; this lets you handle two before foraging
    baseParts: 9,           // up from 7
    baseFuel: 44,           // up from 38 — covers ~110 days steady before refuelling
    encounterWeight: 1,
    rationStress: 1,
  },
  easier: {
    label: "Easier",
    years: 3,
    startingCaps: 1400,     // up from 1250
    baseRations: 115,
    baseMeds: 12,           // up from 8
    baseParts: 11,          // up from 8
    baseFuel: 65,           // up from 55
    encounterWeight: 0.88,
    rationStress: 0.88,
  },
};

export const START_KM = 3500;

export function daysFromYears(years: number): number {
  return Math.round(years * 365);
}

export interface PartyScaling {
  rationMult: number;
  encounterMult: number;
  embarkDcAdd: number;
  targetPressure: number;
}

export function partyScaling(partySize: number): PartyScaling {
  const delta = partySize - 4;
  return {
    rationMult: 1 + Math.max(0, delta) * 0.11 + Math.min(0, delta) * -0.06,
    encounterMult: 1 + Math.max(0, delta) * 0.07 + Math.min(0, delta) * -0.05,
    embarkDcAdd: Math.max(0, partySize - 3) * 2,
    targetPressure: 1 + Math.max(0, partySize - 3) * 0.08,
  };
}

/**
 * Create a basic Friend with placeholder specialty/traits.
 * Call makeParty() instead when building a full party so specialties are unique.
 */
export function makeFriend(
  id: string,
  name: string,
  specialty: SpecialtyId = "combat",
  traits: TraitId[] = [],
): Friend {
  return {
    id,
    name: name.trim() || "Unknown",
    health: 100,
    maxHealth: 100,
    morale: 70,
    status: "alive",
    sick: undefined,
    memberItems: [],
    specialty,
    traits,
  };
}

/**
 * Create a full party of Friends with unique specialties and rolled traits.
 * Specialties are assigned in seeded random order so no two members share one.
 */
export function makeParty(
  members: { id: string; name: string }[],
  seed: number,
): Friend[] {
  const specialties = assignSpecialties(members.length, seed);
  return members.map((m, i) => {
    const traits = rollTraits(seed ^ (i * 0x9e3779b9));
    return makeFriend(m.id, m.name, specialties[i], traits);
  });
}

// Kept for seeded name-shuffling at roster screen
export { mulberry32 };

export function validateRosterNames(names: string[]): string | null {
  for (const n of names) {
    if (!n.trim()) return "Every party member needs a name.";
  }
  return null;
}

export function initialResources(
  diff: DifficultyId,
  partySize: number,
): RunResources {
  const d = DIFFICULTY[diff];
  const ps = partyScaling(partySize);
  return {
    rations: Math.round(d.baseRations * ps.rationMult),
    meds: Math.max(2, Math.round(d.baseMeds * ps.rationMult)),
    parts: Math.max(3, Math.round(d.baseParts * ps.rationMult)),
    fuel: Math.max(4, Math.round(d.baseFuel * ps.rationMult)),
    caps: 0,
  };
}
