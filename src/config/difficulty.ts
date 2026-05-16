import type { DifficultyId, Friend, RunResources, TraitId } from "../types";
import { NEGATIVE_TRAITS, TRAIT_CATALOG } from "../types";
import { mulberry32 } from "../engine/rng";

export interface DifficultyConfig {
  label: string;
  years: number;
  /** Starting caps for depot */
  startingCaps: number;
  /** Base rations at run start (after depot) */
  baseRations: number;
  baseWater: number;
  baseMeds: number;
  baseParts: number;
  baseFuel: number;
  encounterWeight: number;
  /** Multiplier on daily ration burn while traveling */
  rationStress: number;
}

export const DIFFICULTY: Record<DifficultyId, DifficultyConfig> = {
  hard: {
    label: "Hard",
    years: 1.5,
    startingCaps: 750,
    baseRations: 18,
    baseWater: 18,
    baseMeds: 4,
    baseParts: 5,
    baseFuel: 8,
    encounterWeight: 1.25,
    rationStress: 1.2,
  },
  standard: {
    label: "Standard",
    years: 2,
    startingCaps: 1000,
    baseRations: 24,
    baseWater: 24,
    baseMeds: 6,
    baseParts: 7,
    baseFuel: 11,
    encounterWeight: 1,
    rationStress: 1,
  },
  easier: {
    label: "Easier",
    years: 3,
    startingCaps: 1250,
    baseRations: 48,
    baseWater: 48,
    baseMeds: 8,
    baseParts: 8,
    baseFuel: 16,
    encounterWeight: 0.88,
    rationStress: 0.88,
  },
};

/** Thousands of km — tuned so daily travel + encounters fill the departure budget on Standard */
export const START_KM = 3500;

export function daysFromYears(years: number): number {
  return Math.round(years * 365);
}

const NEG_SET = new Set<string>(NEGATIVE_TRAITS);

/** 4–6 traits: mix of positive and at least one negative on average */
export function rollTraitsForMember(rng: () => number): TraitId[] {
  const count = 4 + Math.floor(rng() * 3);
  const pool = [...TRAIT_CATALOG];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const picked = pool.slice(0, count);
  const negCount = picked.filter((t) => NEG_SET.has(t)).length;
  if (negCount === 0) {
    const swapIdx = picked.findIndex((t) => !NEG_SET.has(t));
    const neg = NEGATIVE_TRAITS[Math.floor(rng() * NEGATIVE_TRAITS.length)];
    if (swapIdx >= 0) picked[swapIdx] = neg;
    else picked.push(neg);
  }
  return picked.slice(0, count);
}

export function rollPartyTraits(seed: number, partySize: number): TraitId[][] {
  const out: TraitId[][] = [];
  for (let i = 0; i < partySize; i++) {
    const rng = mulberry32((seed + i * 0x9e3779b9) >>> 0);
    out.push(rollTraitsForMember(rng));
  }
  return out;
}

export interface PartyScaling {
  rationMult: number;
  encounterMult: number;
  embarkDcAdd: number;
  targetPressure: number;
}

/** Larger parties eat more and draw heavier encounter tables / embark checks. */
export function partyScaling(partySize: number): PartyScaling {
  const delta = partySize - 4;
  return {
    rationMult: 1 + Math.max(0, delta) * 0.11 + Math.min(0, delta) * -0.06,
    encounterMult: 1 + Math.max(0, delta) * 0.07 + Math.min(0, delta) * -0.05,
    embarkDcAdd: Math.max(0, partySize - 3) * 2,
    targetPressure: 1 + Math.max(0, partySize - 3) * 0.08,
  };
}

export function makeFriend(
  id: string,
  name: string,
  traits: TraitId[],
): Friend {
  let maxBonus = 0;
  let morale = 70;
  for (const t of traits) {
    if (t === "ironGut") maxBonus += 8;
    if (t === "calm") morale += 10;
    if (t === "lucky") morale += 4;
    if (t === "pessimist") morale -= 12;
    if (t === "reckless") morale += 6;
    if (NEG_SET.has(t)) {
      maxBonus -= 7;
      morale -= 5;
    }
  }
  const base = 100;
  const mh = Math.max(72, base + maxBonus);
  return {
    id,
    name: name.trim() || "Unknown",
    traits: [...traits],
    health: mh,
    maxHealth: mh,
    morale: Math.max(25, Math.min(100, morale)),
    status: "alive",
    sick: undefined,
    memberItems: [],
  };
}

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
    water: Math.round(d.baseWater * ps.rationMult),
    meds: Math.max(2, Math.round(d.baseMeds * ps.rationMult)),
    parts: Math.max(3, Math.round(d.baseParts * ps.rationMult)),
    fuel: Math.max(4, Math.round(d.baseFuel * ps.rationMult)),
    caps: 0,
  };
}
