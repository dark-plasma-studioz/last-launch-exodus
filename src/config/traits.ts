/**
 * traits.ts — Specialties and traits for party members.
 *
 * ── SPECIALTIES ─────────────────────────────────────────────────────────────
 * Each member has exactly one specialty, assigned at party creation and unique
 * across the party (no duplicates). A specialty adds +SPECIALTY_BONUS % to
 * any event check whose checkType matches.
 *
 * ── TRAITS ──────────────────────────────────────────────────────────────────
 * Each member gets 2 random traits from POSITIVE_TRAITS + NEGATIVE_TRAITS.
 * Traits are purely passive stat modifiers applied at run start.
 * Roughly 1 positive and 1 negative per member (weighted roll).
 *
 * TO ADD A SPECIALTY: add entry to SPECIALTIES, add id to SpecialtyId in types.ts.
 * TO ADD A TRAIT: add entry to TRAIT_CATALOG, add id to TraitId in types.ts.
 */

import type { CheckType, MemberEffect, SpecialtyId, TraitId } from "../types";

// ── Specialty bonus applied to matching event checks ─────────────────────────
export const SPECIALTY_BONUS = 18; // % added to basePct when specialty matches

export interface SpecialtyDef {
  id: SpecialtyId;
  name: string;
  description: string;
  /** Which event CheckTypes this specialty boosts. */
  checkTypes: CheckType[];
}

export const SPECIALTIES: SpecialtyDef[] = [
  {
    id: "medic",
    name: "Field Medic",
    description: `+${SPECIALTY_BONUS}% on medical event checks. Better rest healing and sickness treatment.`,
    checkTypes: ["medical"],
  },
  {
    id: "scavenger",
    name: "Scavenger",
    description: `+${SPECIALTY_BONUS}% on scavenge event checks. Finds more supplies when searching.`,
    checkTypes: ["scavenge"],
  },
  {
    id: "combat",
    name: "Combat Veteran",
    description: `+${SPECIALTY_BONUS}% on combat event checks. Harder to injure in fights.`,
    checkTypes: ["combat"],
  },
  {
    id: "engineer",
    name: "Engineer",
    description: `+${SPECIALTY_BONUS}% on repair event checks. Keeps the convoy running longer.`,
    checkTypes: ["repair"],
  },
  {
    id: "negotiator",
    name: "Negotiator",
    description: `+${SPECIALTY_BONUS}% on negotiation event checks. Better trade and diplomacy outcomes.`,
    checkTypes: ["negotiate"],
  },
  {
    id: "scout",
    name: "Scout",
    description: `+${SPECIALTY_BONUS}% on stealth and recon event checks. Spots danger early.`,
    checkTypes: ["stealth"],
  },
];

export function getSpecialty(id: SpecialtyId): SpecialtyDef {
  return SPECIALTIES.find((s) => s.id === id) ?? SPECIALTIES[0];
}

// ── Trait definitions ─────────────────────────────────────────────────────────

export interface TraitDef {
  id: TraitId;
  name: string;
  description: string;
  positive: boolean;
  /** Passive stat modifiers applied when the run starts. Same fields as MemberEffect. */
  bonus: Partial<MemberEffect> & { maxHealthDelta?: number };
}

export const TRAIT_CATALOG: TraitDef[] = [
  // ── Positive traits ────────────────────────────────────────────────────
  {
    id: "tough",
    name: "Tough",
    description: "+15 max HP.",
    positive: true,
    bonus: { maxHealthBonus: 15 },
  },
  {
    id: "cautious",
    name: "Cautious",
    description: "−8% daily injury chance.",
    positive: true,
    bonus: { injuryResistance: 8 },
  },
  {
    id: "resourceful",
    name: "Resourceful",
    description: "+10% on scavenge checks.",
    positive: true,
    bonus: { scavengeBonus: 10 },
  },
  {
    id: "lucky",
    name: "Lucky",
    description: "Slightly better outcomes on borderline rolls (passive +3% everywhere).",
    positive: true,
    // Implemented as a small universal check bonus applied in resolveChoice
    bonus: {},
  },
  {
    id: "hardy",
    name: "Hardy",
    description: "+3 days sickness resistance (illness takes longer to become lethal).",
    positive: true,
    bonus: { sicknessResistDays: 3 },
  },
  {
    id: "quick",
    name: "Quick",
    description: "+1 km contributed per travel day.",
    positive: true,
    bonus: { travelKmBonus: 1 },
  },
  {
    id: "steady_hands",
    name: "Steady Hands",
    description: "+4 HP healed each rest day.",
    positive: true,
    bonus: { dailyHealBonus: 4 },
  },
  {
    id: "scrounge",
    name: "Scrounger",
    description: "+8% on trade checks.",
    positive: true,
    bonus: { tradeBonus: 8 },
  },
  {
    id: "iron_will",
    name: "Iron Will",
    description: "+10 starting morale.",
    positive: true,
    bonus: { moraleBonus: 10 },
  },
  {
    id: "light_sleeper",
    name: "Light Sleeper",
    description: "Spots ambushes and night threats. Passive +5% on stealth/combat checks.",
    positive: true,
    bonus: {},
  },

  // ── Negative traits ────────────────────────────────────────────────────
  {
    id: "reckless",
    name: "Reckless",
    description: "+6% daily injury chance.",
    positive: false,
    bonus: { injuryResistance: -6 },
  },
  {
    id: "clumsy",
    name: "Clumsy",
    description: "−6% on scavenge checks.",
    positive: false,
    bonus: { scavengeBonus: -6 },
  },
  {
    id: "weak_immune",
    name: "Weak Immune System",
    description: "−2 days sickness resistance (gets sick faster).",
    positive: false,
    bonus: { sicknessResistDays: -2 },
  },
  {
    id: "slow",
    name: "Slow",
    description: "−1 km contributed per travel day.",
    positive: false,
    bonus: { travelKmBonus: -1 },
  },
];

export function getTrait(id: TraitId): TraitDef {
  return TRAIT_CATALOG.find((t) => t.id === id) ?? TRAIT_CATALOG[0];
}

// ── Trait rolling ─────────────────────────────────────────────────────────────

const POSITIVE_IDS = TRAIT_CATALOG.filter((t) => t.positive).map((t) => t.id);
const NEGATIVE_IDS = TRAIT_CATALOG.filter((t) => !t.positive).map((t) => t.id);

/**
 * Roll 2 traits for a member: 1 positive + 1 negative (seeded).
 * Uses a simple LCG so traits are deterministic from the seed.
 */
export function rollTraits(seed: number): TraitId[] {
  const rng = lcg(seed);
  const pos = POSITIVE_IDS[Math.floor(rng() * POSITIVE_IDS.length)];
  const neg = NEGATIVE_IDS[Math.floor(rng() * NEGATIVE_IDS.length)];
  return [pos, neg];
}

/**
 * Assign specialties to a party, ensuring no two members share one.
 * Specialties cycle through the list in seeded order.
 */
export function assignSpecialties(count: number, seed: number): SpecialtyId[] {
  const rng = lcg(seed);
  const pool = [...SPECIALTIES.map((s) => s.id)];
  // Shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  // Cycle if more members than specialties
  return Array.from({ length: count }, (_, i) => pool[i % pool.length]);
}

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

// ── Apply trait bonuses to a Friend's stats ───────────────────────────────────
/**
 * Call once at run start for each member.
 * Mutates friend in place.
 */
export function applyTraitBonuses(
  friend: { health: number; maxHealth: number; morale: number; memberItems: string[] },
  traits: TraitId[],
): void {
  for (const id of traits) {
    const def = getTrait(id);
    const b = def.bonus;
    if (b.maxHealthBonus) {
      friend.maxHealth += b.maxHealthBonus;
      friend.health += b.maxHealthBonus;
    }
    if (b.moraleBonus) friend.morale = Math.min(100, friend.morale + b.moraleBonus);
  }
}

/**
 * Compute the combined trait bonus for a given MemberEffect field across a member's traits.
 */
export function traitBonusFor(
  traits: TraitId[],
  field: keyof Omit<TraitDef["bonus"], "maxHealthBonus">,
): number {
  return traits.reduce((acc, id) => {
    const b = getTrait(id).bonus as Record<string, number | undefined>;
    return acc + (b[field] ?? 0);
  }, 0);
}

/**
 * Compute the total specialty-based check bonus for a member on a given checkType.
 * Returns SPECIALTY_BONUS if their specialty matches, else 0.
 * Also adds small trait bonuses for traits that universally help.
 */
export function memberCheckBonus(
  specialty: SpecialtyId,
  traits: TraitId[],
  checkType: CheckType,
): number {
  const spec = getSpecialty(specialty);
  let bonus = spec.checkTypes.includes(checkType) ? SPECIALTY_BONUS : 0;

  // "lucky" gives +3 on all checks
  if (traits.includes("lucky")) bonus += 3;
  // "light_sleeper" gives +5 on stealth/combat
  if (traits.includes("light_sleeper") && (checkType === "stealth" || checkType === "combat"))
    bonus += 5;

  return bonus;
}
