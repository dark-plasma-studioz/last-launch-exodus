import type { LocationId } from "./engine/locations";

export type { LocationId } from "./engine/locations";

/** Positive / skill traits — used in event checks and bonuses. */
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

/** Flaws — random alongside positives; penalize stats and checks. */
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

export type MemberStatus = "alive" | "injured" | "incapacitated" | "dead";

export interface Friend {
  id: string;
  name: string;
  traits: TraitId[];
  health: number;
  maxHealth: number;
  morale: number;
  status: MemberStatus;
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

export type ItemKind = "common" | "unique";

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  description: string;
  /** Caps price in depot (0 = not sold at depot) */
  price: number;
  /** Passive flags consumed by engine / events */
  tags?: string[];
  /** If set, purchasing adds to starting resources (commons) */
  grants?: Partial<RunResources>;
}

export interface InventoryEntry {
  itemId: string;
  count: number;
}

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
  | { type: "item"; itemId: string; count?: number }
  | { type: "removeItem"; itemId: string; count?: number }
  | { type: "setEmbark"; value: number };

export interface ChoiceDef {
  id: string;
  text: string;
  trait?: TraitId;
  dc?: number;
  requiredItem?: string;
  successEffects: Effect[];
  failureEffects: Effect[];
  alwaysEffects?: Effect[];
}

export interface GameEvent {
  id: string;
  title: string;
  body: string;
  /** If set, only offered in these map bands */
  locations?: LocationId[];
  weight?: number;
  minKm?: number;
  maxKm?: number;
  requiresFlag?: string;
  /** If set, require this location (single-tag convenience) */
  requiresLocation?: LocationId;
  choices: ChoiceDef[];
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
  | { kind: "notice"; title: string; body: string };

export interface RunState {
  phase: GamePhase;
  difficulty: DifficultyId;
  /** Days until departure window closes */
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
  /** When a location popup is showing, the encounter waits here */
  pendingEventAfterModal: GameEvent | null;
  runModal: RunModal;
  /** When km hits 0, run embark chain counter */
  embarkEventsLeft: number;
  day: number;
  rngSeed: number;
  outcome: Outcome;
  lostReason?: string;
  /** Caps unspent after depot — tracked for score */
  scoreCapsSpent: number;
  autoTravel: boolean;
}

export interface DepotCartLine {
  itemId: string;
  count: number;
}
