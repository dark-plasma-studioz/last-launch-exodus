import type { LocationId } from "./engine/locations";
export type { LocationId } from "./engine/locations";

// ── Specialties & Traits ──────────────────────────────────────────────────────

/**
 * Each party member has exactly one Specialty (their role in the party).
 */
export type SpecialtyId =
  | "medic"
  | "scavenger"
  | "combat"
  | "engineer"
  | "negotiator"
  | "scout";

/**
 * Event check categories used on ChoiceDef.checkType.
 * Each Specialty boosts one or more CheckTypes.
 *
 *   "combat"    → fighting, defence, brawling
 *   "medical"   → healing, sickness, first aid
 *   "scavenge"  → searching, looting, resource finding
 *   "repair"    → vehicle repairs, mechanical work
 *   "negotiate" → trade, diplomacy, persuasion
 *   "stealth"   → infiltration, sneaking, recon
 */
export type CheckType =
  | "combat"
  | "medical"
  | "scavenge"
  | "repair"
  | "negotiate"
  | "stealth";

/**
 * Small passive modifiers. Each member gets 2 traits drawn randomly.
 * A trait's `bonus` object modifies the same fields as MemberEffect.
 */
export type TraitId =
  | "tough"
  | "cautious"
  | "resourceful"
  | "lucky"
  | "hardy"
  | "quick"
  | "steady_hands"
  | "scrounge"
  | "iron_will"
  | "light_sleeper"
  | "reckless"
  | "clumsy"
  | "weak_immune"
  | "slow";

// ── Core types ────────────────────────────────────────────────────────────────

export type MemberStatus = "alive" | "injured" | "incapacitated" | "dead";

export interface SickStatus {
  name: string;
  daysLeft: number;
  totalDays: number;
}

export interface Friend {
  id: string;
  name: string;
  health: number;
  maxHealth: number;
  morale: number;
  status: MemberStatus;
  sick?: SickStatus;
  memberItems: string[];
  specialty: SpecialtyId;
  traits: TraitId[];
  deathCause?: string;
  deathDay?: number;
}

export interface RunResources {
  rations: number;
  meds: number;
  parts: number;
  fuel: number;
  caps: number;
}

// ── Item types ────────────────────────────────────────────────────────────────

export type ItemKind = "common" | "unique" | "personal";

/**
 * Per-member passive bonuses. Applied to the individual this item is assigned to.
 *
 * dailyHealBonus     — extra HP healed each rest day
 * rationReduction    — this person eats N fewer rations per day (min 0)
 * travelKmBonus      — contributes extra km per travel day
 * scavengeBonus      — +% on Search for Food roll
 * tradeBonus         — +% on Attempt to Trade roll
 * injuryResistance   — flat % reduction in daily injury chance
 */
export interface MemberEffect {
  maxHealthBonus?: number;
  moraleBonus?: number;
  sicknessResistDays?: number;
  dailyHealBonus?: number;
  rationReduction?: number;
  travelKmBonus?: number;
  scavengeBonus?: number;
  tradeBonus?: number;
  injuryResistance?: number;
}

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  description: string;
  price: number;
  tags?: string[];
  grants?: Partial<RunResources>;
  memberEffect?: MemberEffect;
}

export interface InventoryEntry {
  itemId: string;
  count: number;
}

// ── Effects ───────────────────────────────────────────────────────────────────
/**
 * EFFECT QUICK REFERENCE
 *   { type: "resource",    key: "rations", delta: -8 }
 *   { type: "rad",         delta: 12 }
 *   { type: "km",          delta: -20 }          → travel bonus (negative = closer to port)
 *   { type: "time",        days: 3 }             → burn departure days
 *   { type: "transport",   delta: -5 }
 *   { type: "portChaos",   delta: 8 }
 *   { type: "damage",      target: "random_living", amount: 20 }
 *   { type: "damage",      target: { slot: "scout" }, amount: 20 }  → named slot target
 *   { type: "heal",        target: "weakest",       amount: 15 }
 *   { type: "morale",      target: "all_living",    delta: -10 }
 *   { type: "injure",      target: "random_living" }
 *   { type: "injure",      target: { slot: "infiltrator" } }        → named slot target
 *   { type: "kill",        target: "random_living" }   ← use sparingly
 *   { type: "sicken",      target: "random_living", sickness: "Gut fever", days: 7 }
 *   { type: "cure",        target: "all_living" }
 *   { type: "flag",        key: "met_trader", value: true }
 *   { type: "item",        itemId: "c_medkit" }
 *   { type: "removeItem",  itemId: "u_signal_flare" }
 *   { type: "appendLog",   text: "Flavor text. {randomLiving} saw it first." }
 *   { type: "grantPersonal", itemId: "pi_armour_vest", target: "random_living" }
 *   { type: "fillSlot",    slot: "scout", how: "random_living" }    → auto-fill slot
 *
 * NAMED SLOTS (member picker system)
 * ─────────────────────────────────
 * Declare slots on GameEvent:
 *   memberSlots: [{ key: "infiltrator", label: "Choose infiltrator", how: "player_choice" }]
 *
 * Reference them in text with {slot:infiltrator} — resolves to that member's name.
 * Target effects at them with:   target: { slot: "infiltrator" }
 * Choices can fill slots:        fillsSlot: "infiltrator"   (shows member picker first)
 *
 * how options:
 *   "player_choice"  → player selects from party list before resolving the choice
 *   "random_living"  → auto-assigned to a random living member at event start
 *   "weakest"        → auto-assigned to lowest HP living member
 */

export type EffectTarget =
  | "random_living"
  | "weakest"
  | "all_living"
  | { slot: string };

export type Effect =
  | { type: "appendLog"; text: string }
  | { type: "resource"; key: keyof RunResources; delta: number }
  | { type: "rad"; delta: number }
  | { type: "km"; delta: number }
  | { type: "time"; days: number }
  | { type: "transport"; delta: number }
  | { type: "portChaos"; delta: number }
  | { type: "flag"; key: string; value: boolean | number }
  | { type: "damage";  target: EffectTarget; amount: number }
  | { type: "heal";    target: EffectTarget; amount: number }
  | { type: "morale";  target: "all_living"; delta: number }
  | { type: "injure";  target: Exclude<EffectTarget, "all_living"> }
  | { type: "kill";    target: Exclude<EffectTarget, "all_living"> }
  | { type: "sicken";  target: Exclude<EffectTarget, "all_living">; sickness: string; days: number }
  | { type: "cure";    target: EffectTarget }
  | { type: "item";    itemId: string; count?: number }
  | { type: "removeItem"; itemId: string; count?: number }
  | { type: "setEmbark"; value: number }
  | { type: "grantPersonal"; itemId: string; target: "random_living" | "weakest" | "specialist" }
  /** Auto-fill a named slot at effect resolution time. */
  | { type: "fillSlot"; slot: string; how: "random_living" | "weakest" };

// ── Events ────────────────────────────────────────────────────────────────────

/**
 * Named member slots let an event "hold" a reference to a specific party member
 * so that multiple choices / effects / log lines can all refer to the same person.
 *
 * how:
 *   "player_choice"  → a choice button with fillsSlot will show a member picker
 *   "random_living"  → assigned automatically when the event fires
 *   "weakest"        → assigned automatically to lowest-HP living member
 */
export interface MemberSlot {
  /** Unique key used in templates as {slot:key} and in effect targets. */
  key: string;
  /** Shown in the member-picker UI: "Choose a scout", "Who investigates?". */
  label: string;
  /** How this slot is filled. */
  how: "player_choice" | "random_living" | "weakest";
}

/**
 * Defines which specialty type benefits from a choice check.
 * The relevant party member's specialty gives a +specialtyBonus % bonus.
 *
 * checkType values mirror SpecialtyId:
 *   "combat" | "medical" | "scavenge" | "repair" | "negotiate" | "stealth"
 *
 * If fillsSlot is set, the player picks a party member first.
 * That member's specialty bonus is applied, and they are stored in the slot.
 */
export interface ChoiceDef {
  id: string;
  text: string;
  /**
   * Flat 0–100 success probability. Omit for guaranteed success.
   * basePct reference:  70% = generous  55% = fair  40% = tough  25% = brutal
   */
  basePct?: number;
  /**
   * Which specialty benefits this check.
   * The assigned member's specialty (if it matches) adds +specialtyBonus % to basePct.
   * Defaults to the global SPECIALTY_BONUS constant (15%).
   */
  checkType?: CheckType;
  /**
   * If set, this choice requires the player to select a party member first.
   * That member is stored in the named slot. Their specialty is used for the check.
   */
  fillsSlot?: string;
  requiredItem?: string;
  successEffects: Effect[];
  failureEffects: Effect[];
  alwaysEffects?: Effect[];
}

export type EventPool = "travel" | "scavenge";

/**
 * kind "choice"  → shows choice buttons; player picks one.
 * kind "ambient" → fires immediately on Continue (no player choice).
 *
 * Member slot flow:
 *   1. Event fires with memberSlots declared.
 *   2. "random_living" / "weakest" slots are auto-filled when the event is set.
 *   3. "player_choice" slots are filled when the player clicks a choice that has
 *      fillsSlot matching that slot key. A member picker appears before resolution.
 *   4. Filled slots are stored in filledSlots: Record<slotKey, friendId>.
 *   5. {slot:key} in any text resolves to that member's name.
 *   6. Effects can target { slot: "key" } instead of "random_living" etc.
 */
export interface GameEvent {
  id: string;
  kind?: "choice" | "ambient";
  eventPool?: EventPool;
  title: string;
  body: string;
  locations?: LocationId[];
  weight?: number;
  minKm?: number;
  maxKm?: number;
  requiresFlag?: string;
  requiresLocation?: LocationId;
  ambientEffects?: Effect[];
  choices?: ChoiceDef[];
  /** Named member slots this event uses. */
  memberSlots?: MemberSlot[];
  /** Filled at runtime: slot key → friend id. */
  filledSlots?: Record<string, string>;
}

// ── Game state ────────────────────────────────────────────────────────────────

export type Pace = "leisurely" | "steady" | "grueling";

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
  /** Player has manually paused auto-travel. */
  paused: boolean;
  /** Travel speed. Affects km/day and injury risk. */
  pace: Pace;
  /** Rations consumed per person per day (1 = bare, 2 = normal, 3 = filling). */
  rationsPerPerson: number;
}

export interface DepotCartLine {
  itemId: string;
  count: number;
}
