import type { LocationId } from "./engine/locations";

export type { LocationId } from "./engine/locations";

export const POSITIVE_TRAITS = [
  "scavenger",
  "medic",
  "mechanic",
  "navigator",
  "negotiator",
  "stalkerHunter",
  "radSense",
  "ironGut",
  "lucky",
  "calm",
  "hype",
  "engineer",
] as const;

export const NEGATIVE_TRAITS = [
  "weakLungs",
  "nightBlind",
  "panicProne",
  "softHands",
  "thinSkin",
  "reckless",
  "pessimist",
  "addict",
] as const;

export const TRAIT_CATALOG = [
  ...POSITIVE_TRAITS,
  ...NEGATIVE_TRAITS,
] as const;

export type TraitId = (typeof TRAIT_CATALOG)[number];

export const TRAIT_DESCRIPTIONS: Record<TraitId, string> = {
  scavenger: "Knows wrecks and shortcuts; strong on salvage runs.",
  medic: "Treats injuries and sickness when camp goes quiet.",
  mechanic: "Keeps rigs moving; bypasses locks and jury-rigs fixes.",
  navigator: "Reads terrain and picks routes that waste less fuel.",
  negotiator: "Talks past guards and traders without drawing blood.",
  stalkerHunter: "Tracks targets and smells ambushes before they fire.",
  radSense: "Spots hotspots early; stacks with rad gear in checks.",
  ironGut: "Hardier gut—more HP and tolerance for bad water.",
  lucky: "Tiny edges when odds slide; lifts baseline morale.",
  calm: "Steadies the party under pressure.",
  hype: "Raises spirits when everyone wants to quit.",
  engineer: "Power, electronics, and sealed doors bend faster.",
  weakLungs: "Dust and rads settle harder—hurts risky odds.",
  nightBlind: "Poor dark/smoke vision; rough in blind pushes.",
  panicProne: "Stress eats focus—hurts percentage checks.",
  softHands: "Not built for brute labor or rough climbs.",
  thinSkin: "Takes morale hits harder than most.",
  reckless: "Charges first—sometimes brave, sometimes costly.",
  pessimist: "Expects the worst; morale dips faster.",
  addict: "Needs what's scarce—fragile when rationed.",
};

export type MemberStatus = "alive" | "injured" | "incapacitated" | "dead";

/** Active illness on a party member. Hits 0 daysLeft = death. */
export interface SickStatus {
  name: string;
  daysLeft: number;
  totalDays: number;
}

export interface Friend {
  id: string;
  name: string;
  traits: TraitId[];
  health: number;
  maxHealth: number;
  morale: number;
  status: MemberStatus;
  sick?: SickStatus;
  /** Personal item ids assigned to this member at depot. */
  memberItems: string[];
  deathCause?: string;
  deathDay?: number;
}

export interface RunResources {
  rations: number;
  water: number;
  meds: number;
  parts: number;
  fuel: number;
  caps: number;
}

export type ItemKind = "common" | "unique" | "personal";

/** Passive bonuses applied to the party member this item is assigned to. */
export interface MemberEffect {
  /** Flat HP added to maxHealth at run start. */
  maxHealthBonus?: number;
  /** Extra days added to sickness timer when the member is inflicted. */
  sicknessResistDays?: number;
  /** Flat % bonus added to any check where this member is the specialist. */
  checkBonus?: number;
  /** Flat morale bonus at run start. */
  moraleBonus?: number;
}

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  description: string;
  price: number;
  tags?: string[];
  /** Common items: starting resources granted at depot checkout. */
  grants?: Partial<RunResources>;
  /** Personal items: bonuses applied to the assigned member. */
  memberEffect?: MemberEffect;
}

export interface InventoryEntry {
  itemId: string;
  count: number;
}

/**
 * All effect types that can appear in successEffects, failureEffects,
 * alwaysEffects, or ambientEffects.
 *
 * Authoring guide:
 *   { type: "resource", key: "rations", delta: -8 }   → change supplies
 *   { type: "rad", delta: 12 }                         → radiation
 *   { type: "km", delta: -20 }                         → closer to port
 *   { type: "time", days: 3 }                          → burn departure days
 *   { type: "transport", delta: -5 }                   → convoy wear
 *   { type: "portChaos", delta: 8 }                    → queue chaos
 *   { type: "damage", target: "random_living", amount: 20 }
 *   { type: "heal", target: "weakest", amount: 15 }
 *   { type: "morale", target: "all_living", delta: -10 }
 *   { type: "injure", target: "random_living" }        → set injured status
 *   { type: "kill", target: "weakest" }                → death (use sparingly)
 *   { type: "sicken", target: "random_living", sickness: "Gut fever", days: 7 }
 *   { type: "cure", target: "all_living" }             → clear sickness
 *   { type: "flag", key: "met_trader", value: true }   → set a flag
 *   { type: "item", itemId: "c_medkit" }               → give item
 *   { type: "removeItem", itemId: "u_signal_flare" }   → consume item
 *   { type: "appendLog", text: "Flavor text." }        → log only, no stats
 */
export type Effect =
  | { type: "appendLog"; text: string }
  | { type: "resource"; key: keyof RunResources; delta: number }
  | { type: "rad"; delta: number }
  | { type: "km"; delta: number }
  | { type: "time"; days: number }
  | { type: "transport"; delta: number }
  | { type: "portChaos"; delta: number }
  | { type: "flag"; key: string; value: boolean | number }
  | { type: "damage"; target: "random_living" | "weakest" | "all_living"; amount: number }
  | { type: "heal"; target: "random_living" | "weakest" | "all_living"; amount: number }
  | { type: "morale"; target: "all_living"; delta: number }
  | { type: "injure"; target: "random_living" | "weakest" }
  | { type: "kill"; target: "random_living" | "weakest" }
  | { type: "sicken"; target: "random_living" | "weakest"; sickness: string; days: number }
  | { type: "cure"; target: "random_living" | "weakest" | "all_living" }
  | { type: "item"; itemId: string; count?: number }
  | { type: "removeItem"; itemId: string; count?: number }
  | { type: "setEmbark"; value: number }
  | {
      type: "grantPersonal";
      itemId: string;
      target: "random_living" | "weakest" | "specialist";
    };

/**
 * One player choice in a GameEvent.
 *
 * trait + basePct: trait to check, base % success before bonuses.
 *   Final % = basePct
 *     + 12% per party member with the trait
 *     + 2% per living member beyond first (max +8%)
 *     - 3% per negative trait across all members (max -15%)
 *     + item bonuses
 *   Clamped 0–100.
 *
 * Leave trait undefined for a guaranteed-success choice.
 * basePct reference:
 *   65% = easy     35% = hard
 *   50% = fair     20% = brutal
 */
export interface ChoiceDef {
  id: string;
  text: string;
  trait?: TraitId;
  /** 0–100 base success chance. Only used when trait is also set. */
  basePct?: number;
  requiredItem?: string;
  successEffects: Effect[];
  failureEffects: Effect[];
  alwaysEffects?: Effect[];
}

/**
 * A game event.
 *
 * kind "choice" (default): shows choice buttons; player picks one.
 * kind "ambient": no choices; effects fire immediately on Continue.
 *   Use for passive encounters: finding supplies, minor accidents, weather.
 */
/** Which daily action can roll this event. Defaults to travel. */
export type EventPool = "travel" | "scavenge";

export interface GameEvent {
  id: string;
  kind?: "choice" | "ambient";
  /** travel = road/encounter pool (default). scavenge = salvage-day pool only. */
  eventPool?: EventPool;
  title: string;
  body: string;
  locations?: LocationId[];
  weight?: number;
  minKm?: number;
  maxKm?: number;
  requiresFlag?: string;
  requiresLocation?: LocationId;
  /** Used by ambient events (kind === "ambient"). Applied on Continue. */
  ambientEffects?: Effect[];
  /** Used by choice events (kind === "choice" or undefined). */
  choices?: ChoiceDef[];
}

export type DifficultyId = "hard" | "standard" | "easier";

export type GamePhase = "title" | "roster" | "depot" | "run" | "recap";

export type Outcome = "ongoing" | "won" | "lost";

export interface LogEntry {
  day: number;
  text: string;
}

export type RunModal =
  | null
  | { kind: "location"; to: LocationId; body: string }
  | { kind: "notice"; title: string; body: string }
  | { kind: "shop"; location: LocationId };

export interface RunState {
  phase: GamePhase;
  difficulty: DifficultyId;
  departureDaysRemaining: number;
  departureDaysTotal: number;
  kmRemaining: number;
  startKm: number;
  currentLocation: LocationId;
  portChaos: number;
  rads: number;
  transport: number;
  resources: RunResources;
  friends: Friend[];
  inventory: InventoryEntry[];
  flags: Record<string, number | boolean>;
  log: LogEntry[];
  currentEvent: GameEvent | null;
  pendingEventAfterModal: GameEvent | null;
  runModal: RunModal;
  embarkEventsLeft: number;
  day: number;
  rngSeed: number;
  outcome: Outcome;
  lostReason?: string;
  scoreCapsSpent: number;
  autoTravel: boolean;
}

export interface DepotCartLine {
  itemId: string;
  count: number;
}
