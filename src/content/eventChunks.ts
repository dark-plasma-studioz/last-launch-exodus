/**
 * eventChunks.ts — All core game events.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * HOW TO ADD AN EVENT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * SIMPLE CHOICE EVENT
 * ───────────────────
 * Use the event() builder. Pass an array of ch() choices.
 *
 *   event({
 *     id: "my-event-id",
 *     title: "Something happens",
 *     body: "{randomLiving} spots movement on the ridge.",
 *     locations: ["open_waste"],   // omit for anywhere
 *     weight: 1.0,                 // default 1.0
 *     choices: [
 *       ch("fight",   "Fight them off",   45, [ok effects...], [fail effects...]),
 *       ch("retreat", "Pull back",        undefined, [guaranteed ok...], []),
 *     ],
 *   })
 *
 * AMBIENT EVENT (no player choice)
 * ─────────────────────────────────
 *   ambient("id", "Title", "Body text.", [effects...], locations?, weight?)
 *
 * SPECIALTY CHECK
 * ───────────────
 * Add checkType to a ch() call to apply the relevant specialist's bonus:
 *   ch("hack", "Hack the console", 40, ok, bad, undefined, undefined, "repair")
 *                                                                        ^^^
 *   checkType values: "combat" | "medical" | "scavenge" | "repair" | "negotiate" | "stealth"
 *
 * NAMED MEMBER SLOTS (member picker system)
 * ─────────────────────────────────────────
 * Named slots let you "hold" a reference to a member across multiple effects.
 *
 * 1. Declare slots on the event:
 *      memberSlots: [slot("infiltrator", "Who infiltrates the camp?", "player_choice")]
 *
 * 2. Reference the slot in text:
 *      body: "A camp is spotted. {slot:infiltrator} could sneak in.",
 *      // After slot is filled, {slot:infiltrator} → that member's name
 *
 * 3. Attach the slot to a choice so clicking it shows the member picker first:
 *      ch("sneak", "Send someone to infiltrate", 50, ok, bad,
 *         undefined, undefined, "stealth", "infiltrator")  ← fillsSlot
 *
 * 4. Target effects at the slot member:
 *      { type: "damage",  target: { slot: "infiltrator" }, amount: 20 }
 *      { type: "injure",  target: { slot: "infiltrator" } }
 *
 * 5. Auto-fill slots (no player choice):
 *      memberSlots: [slot("scout", "Who scouts?", "random_living")]
 *      // Filled automatically when event fires.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * BASE PERCENT GUIDE
 *   70% = generous   55% = fair   40% = tough   25% = brutal
 *
 * EFFECT QUICK REFERENCE
 *   { type: "resource",    key: "rations", delta: -8 }
 *   { type: "damage",      target: "random_living", amount: 25 }
 *   { type: "damage",      target: { slot: "scout" }, amount: 25 }
 *   { type: "injure",      target: "weakest" }
 *   { type: "injure",      target: { slot: "infiltrator" } }
 *   { type: "kill",        target: "random_living" }   ← use sparingly
 *   { type: "sicken",      target: "random_living", sickness: "Gut fever", days: 7 }
 *   { type: "rad",         delta: 20 }
 *   { type: "morale",      target: "all_living", delta: -10 }
 *   { type: "heal",        target: "weakest", amount: 15 }
 *   { type: "km",          delta: -18 }
 *   { type: "time",        days: 4 }
 *   { type: "portChaos",   delta: 8 }
 *   { type: "flag",        key: "met_trader", value: true }
 *   { type: "fillSlot",    slot: "scout", how: "random_living" }
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { CheckType, ChoiceDef, Effect, GameEvent, LocationId, MemberSlot } from "../types";
import { CAPS_EVENTS } from "./capsEvents";

// ── Shorthand effect builders ─────────────────────────────────────────────────

/** appendLog effect */
const L = (t: string): Effect => ({ type: "appendLog", text: t });

const ROT: LocationId[] = [
  "open_waste",
  "abandoned_city",
  "industrial_strip",
  "dead_highway",
];

// ── Authoring helpers ─────────────────────────────────────────────────────────

/**
 * Build a ChoiceDef.
 *
 * @param id          Unique choice id within this event.
 * @param text        Button label shown to player.
 * @param basePct     0–100 success %. Omit for guaranteed success.
 * @param ok          Effects on success.
 * @param bad         Effects on failure.
 * @param always      Effects always applied regardless of outcome.
 * @param requiredItem  itemId that must be in inventory, or undefined.
 * @param checkType   CheckType that benefits this check (adds SPECIALTY_BONUS %).
 * @param fillsSlot   Named slot key — shows member picker before resolving.
 */
function ch(
  id: string,
  text: string,
  basePct: number | undefined,
  ok: Effect[],
  bad: Effect[],
  always?: Effect[],
  requiredItem?: string,
  checkType?: CheckType,
  fillsSlot?: string,
): ChoiceDef {
  return {
    id,
    text,
    basePct,
    successEffects: ok,
    failureEffects: bad,
    alwaysEffects: always,
    requiredItem,
    checkType,
    fillsSlot,
  };
}

/**
 * Build a MemberSlot declaration.
 * @param key   Unique slot identifier (used in {slot:key} templates and effect targets).
 * @param label Shown in member picker: "Who scouts ahead?".
 * @param how   "player_choice" | "random_living" | "weakest"
 */
function slot(key: string, label: string, how: MemberSlot["how"] = "player_choice"): MemberSlot {
  return { key, label, how };
}

/**
 * Build a full choice-style GameEvent.
 * Most fields are optional — only id, title, body, and choices are required.
 */
function event(opts: {
  id: string;
  title: string;
  body: string;
  choices: ChoiceDef[];
  locations?: LocationId[];
  weight?: number;
  minKm?: number;
  maxKm?: number;
  requiresFlag?: string;
  memberSlots?: MemberSlot[];
  eventPool?: "travel" | "scavenge";
}): GameEvent {
  return {
    id: opts.id,
    kind: "choice",
    eventPool: opts.eventPool ?? "travel",
    title: opts.title,
    body: opts.body,
    choices: opts.choices,
    locations: opts.locations,
    weight: opts.weight ?? 1.0,
    minKm: opts.minKm,
    maxKm: opts.maxKm,
    requiresFlag: opts.requiresFlag,
    memberSlots: opts.memberSlots,
  };
}

function ambient(
  id: string,
  title: string,
  body: string,
  effects: Effect[],
  locations?: LocationId[],
  weight = 0.5,
): GameEvent {
  return {
    id,
    kind: "ambient",
    eventPool: "travel",
    title,
    body,
    ambientEffects: effects,
    locations,
    weight,
  };
}

// ── Ambient pool ──────────────────────────────────────────────────────────────

function ambientPool(): GameEvent[] {
  return [
    ambient(
      "amb-found-rations",
      "Cache of rations",
      "{randomLiving} finds a small camp with supplies just off the road and pries them open.",
      [L("Extra food loaded."), { type: "resource", key: "rations", delta: 12 }],
      ["abandoned_city", "industrial_strip", "dead_highway"],
      0.6,
    ),
    ambient(
      "amb-found-fuel",
      "Buried jerrycans",
      "{randomLiving} spots a crashed convoy. It's mostly empty, but the tank was still full.",
      [L("Man, gas prices these days..."), { type: "resource", key: "fuel", delta: 5 }],
      ["dead_highway", "industrial_strip"],
      0.45,
    ),
    ambient(
      "amb-found-meds",
      "Aid station remnants",
      "{randomLiving} finds a collapsed field aid post. Most supplies rotted, but a sealed pouch is intact.",
      [L("Medical supplies salvaged."), { type: "resource", key: "meds", delta: 1 }],
      ["abandoned_city", "port_sprawl"],
      0.4,
    ),
    ambient(
      "amb-broken-leg",
      "Stumble on rubble",
      "{randomLiving} trips and breaks their leg. What an idiot.",
      [
        L("{randomLiving} is hurt. Watch them carefully."),
        { type: "injure", target: "random_living" },
      ],
      ROT,
      0.4,
    ),
    ambient(
      "amb-supply-rot",
      "Spoiled rations",
      "{randomLiving} forgot to seal the food. Three rations are moldy. Great job.",
      [
        L("Rations spoiled and discarded."),
        { type: "resource", key: "rations", delta: -3 },
        { type: "morale", target: "all_living", delta: -5 },
      ],
      undefined,
      0.4,
    ),
    ambient(
      "amb-minor-breakdown",
      "Seized belt drive",
      "The convoy grinds to a halt. {randomLiving} digs out the toolbox with a sigh.",
      [
        L("Parts burned keeping the convoy moving."),
        { type: "transport", delta: -6 },
        { type: "resource", key: "parts", delta: -2 },
      ],
      ROT,
      0.45,
    ),
    ambient(
      "amb-salvage-caps",
      "Looted register",
      "{randomLiving} searches a dead body. Finds caps somehow. Always loot your bodies.",
      [L("Caps recovered."), { type: "resource", key: "caps", delta: 35 }],
      ["abandoned_city", "industrial_strip"],
      0.4,
    ),
    ambient(
      "amb-sick-contact",
      "Coughing stranger",
      "A sick wanderer climbs into the convoy looking for help. Possible exposure for everyone.",
      [
        L("Possible exposure. Watch for symptoms. It's like Covid 19 all over again."),
        { type: "sicken", target: "random_living", sickness: "Ash lung", days: 8 },
      ],
      ["port_sprawl", "dead_highway"],
      0.3,
    ),
    ambient(
      "amb-storm-delay",
      "Dust wall",
      "A brown wall of grit swallows the road for hours. You wait it out sealed tight.",
      [
        L("Storm costs time and rads."),
        { type: "time", days: 2 },
        { type: "rad", delta: 8 },
      ],
      ["open_waste"],
      0.45,
    ),
    ambient(
      "amb-roadside-gambling",
      "Roadside gambling",
      "Two strangers are seen playing some sort of game off the road. {randomLiving} jumps in and somehow wins big?",
      [
        L("Good job I guess?"),
        { type: "resource", key: "caps", delta: 100 },
      ],
      ["port_sprawl", "dead_highway"],
      0.3,
    ),
    ambient(
      "amb-lucky-caps",
      "Scattered loot",
      "A wrecked scavenger rig spilled its cargo. Most is ash, but the cap-belt survived.",
      [L("Caps recovered from the wreck."), { type: "resource", key: "caps", delta: 75 }],
      ["open_waste", "dead_highway"],
      0.3,
    ),
    ambient(
      "amb-found-parts",
      "Scattered wreckage",
      "{randomLiving} spots useful components in a burned-out convoy along the road.",
      [L("Machine parts recovered."), { type: "resource", key: "parts", delta: 4 }],
      ROT,
      0.35,
    ),
  ];
}

// ── Sickness events ───────────────────────────────────────────────────────────

function sicknessEvents(): GameEvent[] {
  return [
    {
      id: "sick-rat-stores",
      title: "Rat infiltration",
      locations: ROT,
      weight: 0.42,
      body: "{randomLiving} hears noises from the food storage and checks to find it half-eaten by rats.",
      choices: [
        ch(
          "srs-a",
          "Burn the contaminated stock and eat the loss.",
          60,
          [
            L("The gnawed bundles are separated. You eat less but stay healthy."),
            { type: "resource", key: "rations", delta: -6 },
          ],
          [
            L("You miss a contaminated bundle. Someone pays for it."),
            { type: "resource", key: "rations", delta: -8 },
            { type: "sicken", target: "random_living", sickness: "Rat fever", days: 6 },
          ],
        ),
        ch(
          "srs-b",
          "EAT IT! BE A MAN.",
          undefined,
          [
            L("The party eats and waits. Maybe nothing happens?"),
            { type: "sicken", target: "random_living", sickness: "Rat fever", days: 8 },
          ],
          [],
        ),
      ],
    },
    {
      id: "sick-rad-cough",
      title: "Rad cough",
      locations: ["industrial_strip", "open_waste"],
      weight: 0.38,
      body: "{randomLiving} has been coughing metallic phlegm for two days. The rads are ticking.",
      choices: [
        ch(
          "src-a",
          "Rest a day and push meds.",
          55,
          [
            L("Rest slows the progression. For now."),
            { type: "resource", key: "meds", delta: -2 },
            { type: "time", days: 2 },
          ],
          [
            L("The lungs are already compromised. It becomes something worse."),
            { type: "resource", key: "meds", delta: -2 },
            { type: "sicken", target: "weakest", sickness: "Rad lung", days: 9 },
            { type: "time", days: 1 },
          ],
        ),
        ch(
          "src-b",
          "Keep going, they will surely be fine.",
          undefined,
          [
            L("They keep up. For now."),
            { type: "rad", delta: 5 },
            { type: "sicken", target: "weakest", sickness: "Rad lung", days: 10 },
          ],
          [],
        ),
      ],
    },
    {
      id: "sick-fevercamp",
      title: "Fever camp",
      locations: ["dead_highway", "port_sprawl"],
      weight: 0.35,
      body: "A camp of people burning with fever blocks the road. They beg for medicine. Some of them are clearly contagious.",
      choices: [
        ch(
          "sf-a",
          "Help them — share two meds.",
          50,
          [
            L("They recover enough to wave you on. One leaves a pouch of caps."),
            { type: "resource", key: "meds", delta: -2 },
            { type: "resource", key: "caps", delta: 40 },
            { type: "morale", target: "all_living", delta: 8 },
          ],
          [
            L("The fever spreads before you can leave."),
            { type: "resource", key: "meds", delta: -2 },
            { type: "sicken", target: "random_living", sickness: "Road fever", days: 7 },
          ],
        ),
        ch(
          "sf-b",
          "Drive around and keep moving.",
          undefined,
          [L("No exposure. No delay. Guilt is free.")],
          [],
        ),
      ],
    },
  ];
}

// ── Embark pool ───────────────────────────────────────────────────────────────

function embarkPool(): GameEvent[] {
  const out: GameEvent[] = [];
  const titles = [
    "Credential booth",
    "Rad screening",
    "Faction shakedown",
    "Medical triage",
    "Cargo lottery",
    "Stampede rumor",
    "Final stairwell",
  ];
  for (let i = 0; i < 14; i++) {
    const t = titles[i % titles.length];
    const escalation = Math.max(0, Math.floor(i / 3));
    out.push({
      id: `emb-${i}`,
      title: `${t} (${i + 1})`,
      locations: ["embark"],
      weight: 1.1,
      body: "Floodlights and shouting marshals. {randomLiving} is singled out in the crush. Papers shake. Clocks do not care.",
      choices: [
        ch(
          `e${i}a`,
          "Talk your way through.",
          Math.max(20, 50 - escalation * 5),
          [L("You bluff the queue into coherence."), { type: "portChaos", delta: -4 }],
          [
            L("Wrong line. A baton finds ribs."),
            { type: "damage", target: "random_living", amount: 20 },
            { type: "injure", target: "random_living" },
            { type: "portChaos", delta: 8 },
            { type: "time", days: 3 },
          ],
        ),
        ch(
          `e${i}b`,
          "Hold formation — tight, quiet, fast.",
          Math.max(20, 45 - escalation * 5),
          [L("You slide through a gap that only existed for seconds.")],
          [
            L("Panic wins. Someone goes down."),
            { type: "injure", target: "weakest" },
            { type: "morale", target: "all_living", delta: -14 },
            { type: "time", days: 4 },
          ],
        ),
        ch(
          `e${i}c`,
          "Forge a stamp (risky).",
          20,
          [
            L("The laminate gleams just enough. A bored clerk waves you on."),
            { type: "flag", key: "forge_kit_used", value: true },
          ],
          [
            L("Security tags the forgery. Dogs, then running. Someone doesn't make it."),
            { type: "kill", target: "random_living" },
            { type: "portChaos", delta: 16 },
            { type: "resource", key: "caps", delta: -40 },
          ],
          undefined,
          "u_forge_kit",
        ),
      ],
    });
  }
  return out;
}

// ── Wasteland bulk ────────────────────────────────────────────────────────────

function wastelandBulk(): GameEvent[] {
  const spots = [
    "radioactive swamp",
    "open plain",
    "old training facility",
    "collapsed aqueduct",
    "black orchard",
    "rail spine",
    "graveyard",
  ];
  const threats = [
    "bandits lurk here...",
    "high radiation levels",
    "feral drones",
    "highway kings demanding tribute",
    "mutants",
    "infected animals hunt here",
    "The endtimes cult have a camp here.",
  ];
  const out: GameEvent[] = [];
  for (let i = 0; i < 40; i++) {
    const spot = spots[i % spots.length];
    const th = threats[i % threats.length];
    const loc = ROT[i % ROT.length];
    const pctA = [60, 55, 50, 45, 40][i % 5];
    const pctB = [55, 50, 45, 40, 35][i % 5];
    out.push({
      id: `wl-${i}`,
      title: `Road beat — ${spot}`,
      locations: [loc],
      weight: 1,
      body: `You pass a ${spot}. Word says ${th}.`,
      choices: [
        ch(
          `wl${i}a`,
          "Detour wide (costs time, may save bodies).",
          pctA,
          [
            L("The detour is ugly but empty."),
            { type: "time", days: 3 },
            { type: "resource", key: "fuel", delta: -2 },
          ],
          [
            L("The party gets lost :("),
            { type: "rad", delta: 18 },
            { type: "morale", target: "all_living", delta: -10 },
          ],
        ),
        ch(
          `wl${i}b`,
          "Push straight through.",
          pctB,
          [
            L("Calm, somehow..."),
            { type: "km", delta: -10 },
          ],
          [
            L("The convoy attracts unwanted attention."),
            { type: "damage", target: "random_living", amount: 28 },
            { type: "injure", target: "weakest" },
            { type: "resource", key: "meds", delta: -2 },
          ],
        ),
        ch(
          `wl${i}c`,
          "Make camp and wait it out.",
          75,
          [
            L("Bodies recover a little. The threat drifts past."),
            { type: "heal", target: "weakest", amount: 14 },
            { type: "time", days: 2 },
          ],
          [
            L("Quiet attracts unwanted visitors."),
            { type: "injure", target: "random_living" },
            { type: "resource", key: "rations", delta: -6 },
            { type: "morale", target: "all_living", delta: -8 },
          ],
          undefined,
          undefined,
          undefined,
          "victim",
        ),
      ],
    });
  }
  return out;
}

// ── Approach bulk ─────────────────────────────────────────────────────────────

function approachBulk(): GameEvent[] {
  const out: GameEvent[] = [];
  for (let i = 0; i < 20; i++) {
    out.push({
      id: `ap-${i}`,
      title: `Approach corridor - sector ${i + 1}`,
      locations: ["port_sprawl"],
      weight: 1.05,
      minKm: 0,
      maxKm: 900,
      body: "The sky bruises toward the spaceport arcology. Checkpoints multiply. {randomLiving} counts rations again.",
      choices: [
        ch(
          `ap${i}a`,
          "Bribe a checkpoint with parts.",
          50,
          [
            L("Grease works until the next booth."),
            { type: "resource", key: "parts", delta: -5 },
            { type: "portChaos", delta: -4 },
          ],
          [
            L("They take the parts and invent a new toll."),
            { type: "time", days: 5 },
            { type: "injure", target: "random_living" },
            { type: "resource", key: "fuel", delta: -3 },
          ],
        ),
        ch(
          `ap${i}b`,
          "Find a service tunnel and slip through.",
          40,
          [
            L("{randomLiving} knows which bolts lie. You cut past the checkpoint."),
            { type: "km", delta: -20 },
          ],
          [
            L("Tripwire. Gas in the face."),
            { type: "injure", target: "random_living" },
            { type: "rad", delta: 14 },
            { type: "morale", target: "all_living", delta: -10 },
          ],
        ),
        ch(
          `ap${i}c`,
          "Signal flare: call in a favor (needs flare).",
          60,
          [
            L("A drone winks once — an escort window opens."),
            { type: "km", delta: -30 },
            { type: "portChaos", delta: -8 },
          ],
          [
            L("Wrong eyes see the flare."),
            { type: "damage", target: "all_living", amount: 12 },
            { type: "portChaos", delta: 10 },
          ],
          undefined,
          "u_signal_flare",
        ),
      ],
    });
  }
  return out;
}

// ── Specials ──────────────────────────────────────────────────────────────────

function specials(): GameEvent[] {
  return [
    {
      id: "sp-black-rain",
      title: "Black rain",
      locations: ["open_waste", "industrial_strip", "dead_highway"],
      weight: 0.75,
      memberSlots: [
        slot("sealer", "Who seals the compartments?", "player_choice"),
      ],
      body: "Oil-black rain hisses on the convoy tarp, the acid burning skin.",
      choices: [
        ch(
          "sp1a",
          "Seal the convoy and wait it out.",
          80,
          [L("Seals hold. You wait it out."), { type: "time", days: 2 }],
          [
            L("{slot:sealer} failed to seal the compartments correctly, a shame they are so STUPID."),
            { type: "rad", delta: 26 },
            { type: "damage", target: { slot: "sealer" }, amount: 16 },
            { type: "resource", key: "meds", delta: -3 },
          ],
          undefined,
          undefined,
          undefined,
          "sealer",
        ),
        ch(
          "sp1b",
          "Continue driving",
          50,
          [L("The engine creaks, but holds."), { type: "rad", delta: 10 }],
          [
            L("The engine fails, the acid burning it. "),
            { type: "injure", target: "weakest" },
            { type: "morale", target: "all_living", delta: -14 },
          ],
        ),
      ],
    },
    {
      id: "sp-hot-cache",
      title: "Hot cache rumor",
      locations: ["abandoned_city", "industrial_strip"],
      weight: 0.55,
      body: "{randomLiving} hears rumors of a nearby cache. Word is, another group is already heading there. This could be a trap, and even if it isn't, it could be dangerous.",
      memberSlots: [
        slot("leader", "Who is leading the group?", "player_choice"),
      ],
      choices: [
        ch(
          "sp2a",
          "Move fast and grab it first.",
          65,
          [
            L("You pull meds, parts, food, and fuel. The other group arrives to nothing."),
            { type: "resource", key: "meds", delta: 9 },
            { type: "resource", key: "fuel", delta: 6 },
            { type: "resource", key: "rations", delta: 10 },
            { type: "portChaos", delta: 6 },
            { type: "morale", target: "all_living", delta: 20 },
          ],
          [
            L("Bait. Snipers. You scatter and someone doesn't come back."),
            { type: "kill", target: "random_living" },
            { type: "damage", target: "all_living", amount: 18 },
          ],
          undefined,
          undefined,
          "scavenge",
          "leader",
        ),
        ch(
          "sp2b",
          "Walk away — not worth the risk.",
          undefined,
          [L("The cautious choice. Nothing gained, nothing lost.")],
          [],
        ),
      ],
    },
    {
      id: "sp-cult",
      title: "Cult of the launch flame",
      locations: ["port_sprawl", "dead_highway"],
      weight: 0.52,
      maxKm: 900,
      body: "They wear mirrored masks and beg you to burn your maps as offerings.",
      choices: [
        ch(
          "sp3a",
          "Lie — claim you already burned them.",
          45,
          [L("They love a good story more than truth.")],
          [
            L("They search the wagons. You resist; someone takes a cut."),
            { type: "damage", target: "random_living", amount: 20 },
            { type: "resource", key: "rations", delta: -10 },
          ],
        ),
        ch(
          "sp3b",
          "Trade rations for safe passage.",
          65,
          [L("Cheap religion, expensive rations."), { type: "resource", key: "rations", delta: -12 }],
          [
            L("They want more than rations. The standoff gets ugly."),
            { type: "injure", target: "random_living" },
            { type: "time", days: 3 },
          ],
        ),
      ],
    },
    {
      id: "sp-drone-swarm",
      title: "Autonomous sweep",
      locations: ["open_waste", "industrial_strip", "dead_highway"],
      weight: 0.5,
      body: "A cheap autonomous recon swarm passes overhead, still executing its last orders. It sees the convoy.",
      choices: [
        ch(
          "sp4a",
          "Hold still — let it scan and pass.",
          55,
          [L("It classifies you as low-threat and banks away."), { type: "morale", target: "all_living", delta: 5 }],
          [
            L("A trigger flag fires one last strike package."),
            { type: "damage", target: "all_living", amount: 20 },
            { type: "injure", target: "random_living" },
            { type: "transport", delta: -10 },
          ],
        ),
        ch(
          "sp4b",
          "Kill the drone with a parts sacrifice.",
          40,
          [L("You fry the transponder. It drops into a field."), { type: "resource", key: "parts", delta: -2 }],
          [
            L("Jamming spikes the IFF. It stops being subtle."),
            { type: "damage", target: "random_living", amount: 30 },
            { type: "injure", target: "random_living" },
          ],
        ),
      ],
    },
    {
      id: "sp-med-shortage",
      title: "Medicine for maps",
      locations: ["open_waste", "abandoned_city"],
      weight: 0.45,
      body: "A field surgeon is trading detailed regional maps for medicines. Paper is expensive out here.",
      choices: [
        ch(
          "sp6a",
          "Trade meds for the maps.",
          undefined,
          [
            L("The maps look genuine. Quality intel."),
            { type: "resource", key: "meds", delta: -3 },
            { type: "km", delta: -20 },
            { type: "morale", target: "all_living", delta: 4 },
          ],
          [],
        ),
        ch(
          "sp6b",
          "Inspect the maps before paying.",
          55,
          [
            L("You confirm they're worth the price."),
            { type: "resource", key: "meds", delta: -2 },
            { type: "km", delta: -25 },
          ],
          [
            L("They're outdated. Not worth the meds."),
            { type: "resource", key: "meds", delta: -2 },
            { type: "time", days: 2 },
          ],
        ),
        ch(
          "sp6c",
          "Keep the meds. Move on.",
          undefined,
          [L("Meds stay in the kit. The surgeon watches you leave.")],
          [],
        ),
      ],
    },
    // ── Convoy raid — fight back uses combat specialty ─────────────────────────
    event({
      id: "sp-convoy-attack",
      title: "Scavenger raid",
      locations: ROT,
      weight: 0.55,
      body: "Engine sounds from both sides of the road. Stripped rigs, no flag. {randomLiving} reaches for a weapon.",
      choices: [
        ch(
          "sp7a",
          "Scatter and speed through.",
          50,
          [L("You find a gap and gun it through."),
            { type: "resource", key: "fuel", delta: -4 },
            { type: "km", delta: -8 }],
          [L("They flank you. Side impact."),
            { type: "injure", target: "random_living" },
            { type: "resource", key: "fuel", delta: -3 },
            { type: "transport", delta: -8 }],
        ),
        ch(
          "sp7b",
          "Fight back.",
          40,
          [L("You drop the lead driver. They scatter."),
            { type: "resource", key: "caps", delta: 40 },
            { type: "morale", target: "all_living", delta: 8 }],
          [L("Outnumbered and outgunned."),
            { type: "damage", target: "random_living", amount: 30 },
            { type: "injure", target: "weakest" },
            { type: "resource", key: "rations", delta: -10 }],
          undefined, undefined, "combat",
        ),
        ch(
          "sp7c",
          "Negotiate — give them a share.",
          55,
          [L("They're practical. They take the offer and wave you through."),
            { type: "resource", key: "rations", delta: -8 },
            { type: "resource", key: "caps", delta: -30 }],
          [L("They take the offering and take more."),
            { type: "resource", key: "rations", delta: -14 },
            { type: "resource", key: "meds", delta: -3 },
            { type: "damage", target: "random_living", amount: 16 }],
          undefined, undefined, "negotiate",
        ),
      ],
    }),

    // ── Bandit camp — infiltrator chosen by player, slot persists across effects ─
    event({
      id: "sp-bandit-camp",
      title: "Fortified camp",
      locations: ["open_waste", "abandoned_city", "industrial_strip"],
      weight: 0.45,
      memberSlots: [
        slot("infiltrator", "Who sneaks into the camp?", "player_choice"),
      ],
      body: "A stockaded camp sits two hundred metres off the road. Armed figures, a cook-fire, and what looks like stolen supplies. {randomLiving} marks it on the map.",
      choices: [
        ch(
          "sbc-sneak",
          "Send someone to infiltrate the camp",
          50,
          [
            L("{slot:infiltrator} slips through the perimeter. They return with supplies and intel."),
            { type: "resource", key: "rations", delta: 12 },
            { type: "resource", key: "parts", delta: 3 },
            { type: "resource", key: "caps", delta: 50 },
            { type: "morale", target: "all_living", delta: 8 },
          ],
          [
            L("{slot:infiltrator} is caught. They manage to escape, but barely."),
            { type: "injure", target: { slot: "infiltrator" } },
            { type: "morale", target: "all_living", delta: -12 },
            { type: "time", days: 2 },
          ],
          undefined, undefined, "stealth", "infiltrator",
        ),
        ch(
          "sbc-talk",
          "Approach openly and try to trade",
          55,
          [L("They're wary but willing. You leave with a deal."),
            { type: "resource", key: "rations", delta: 8 },
            { type: "resource", key: "caps", delta: -30 }],
          [L("They mistake the approach for aggression. Gunfire starts."),
            { type: "damage", target: "random_living", amount: 25 },
            { type: "injure", target: "random_living" },
            { type: "resource", key: "fuel", delta: -5 }],
          undefined, undefined, "negotiate",
        ),
        ch(
          "sbc-avoid",
          "Steer well clear and continue",
          undefined,
          [L("Cautious. Nothing gained, nothing risked.")],
          [],
        ),
      ],
    }),

    // ── Injured scout — slot auto-filled, follow-up effects target same person ──
    event({
      id: "sp-wounded-scout",
      title: "Bad fall",
      locations: ROT,
      weight: 0.4,
      memberSlots: [
        slot("scout", "Who was scouting?", "random_living"),
      ],
      body: "{slot:scout} was ranging ahead of the convoy and didn't come back on schedule. Two hours later they limp in — something went wrong out there.",
      choices: [
        ch(
          "wsca",
          "Treat their wounds now.",
          65,
          [
            L("{slot:scout} is patched up and back on their feet."),
            { type: "heal", target: { slot: "scout" }, amount: 20 },
            { type: "resource", key: "meds", delta: -2 },
          ],
          [
            L("The wound is worse than it looked."),
            { type: "injure", target: { slot: "scout" } },
            { type: "resource", key: "meds", delta: -3 },
          ],
          undefined, undefined, "medical",
        ),
        ch(
          "wscb",
          "Stabilise and keep moving — treat later.",
          undefined,
          [
            L("{slot:scout} grits it out. They'll need proper rest later."),
            { type: "damage", target: { slot: "scout" }, amount: 12 },
          ],
          [],
        ),
      ],
    }),
  ];
}

// ── Location legends ──────────────────────────────────────────────────────────

function locationLegends(): GameEvent[] {
  return [
    {
      id: "lg-gun-mall",
      title: "Sealed arms annex",
      requiresLocation: "abandoned_city",
      locations: ["abandoned_city"],
      weight: 0.42,
      body: "A tilted mall sign: CLOSED FOREVER. Behind buckled shutters: pre-war longarms under vacuum glass — and active motion sensors.",
      choices: [
        ch(
          "lg1a",
          "Breach fast, grab crates, leave.",
          35,
          [
            L("You time the sweep blind spots and leave heavier than you arrived."),
            { type: "resource", key: "parts", delta: 4 },
            { type: "resource", key: "caps", delta: 120 },
            { type: "portChaos", delta: 10 },
          ],
          [
            L("Alarms sing. A chokepoint becomes a killing funnel."),
            { type: "injure", target: "random_living" },
            { type: "damage", target: "all_living", amount: 22 },
            { type: "resource", key: "meds", delta: -4 },
          ],
        ),
        ch(
          "lg1b",
          "Bypass the electronics.",
          40,
          [
            L("You spoof the panel. Meds and parts inside."),
            { type: "resource", key: "meds", delta: 3 },
            { type: "resource", key: "parts", delta: -2 },
          ],
          [
            L("The panel fights back. Arc flash."),
            { type: "injure", target: "random_living" },
            { type: "resource", key: "fuel", delta: -4 },
          ],
        ),
        ch(
          "lg1c",
          "Walk away from the glitter.",
          65,
          [L("You keep blood inside the convoy. For now.")],
          [
            L("Someone sneaks back alone — and doesn't return."),
            { type: "kill", target: "random_living" },
            { type: "morale", target: "all_living", delta: -18 },
          ],
        ),
      ],
    },
    {
      id: "lg-tank-farm",
      title: "Chemical cathedral",
      requiresLocation: "industrial_strip",
      locations: ["industrial_strip"],
      weight: 0.4,
      body: "A tank farm breathes yellow vapour. Valves are either salvation or a lungful of legacy war chemistry.",
      choices: [
        ch(
          "lg2a",
          "Vent and harvest stabilizer barrels.",
          35,
          [
            L("You thread the sequence. Tradeable chems loaded."),
            { type: "resource", key: "meds", delta: 8 },
            { type: "resource", key: "fuel", delta: 10 },
          ],
          [
            L("Wrong valve. Cloud hugs the convoy."),
            { type: "damage", target: "all_living", amount: 28 },
            { type: "rad", delta: 24 },
            { type: "injure", target: "weakest" },
          ],
        ),
        ch(
          "lg2b",
          "Burn it closed with spare fuel.",
          50,
          [
            L("Controlled burn. Ugly, loud, alive."),
            { type: "resource", key: "fuel", delta: -7 },
            { type: "portChaos", delta: 8 },
          ],
          [
            L("Fire climbs faster than fear."),
            { type: "injure", target: "random_living" },
            { type: "damage", target: "all_living", amount: 16 },
            { type: "resource", key: "rations", delta: -8 },
          ],
        ),
      ],
    },
    {
      id: "lg-checkpoint-auction",
      title: "Checkpoint auction block",
      requiresLocation: "port_sprawl",
      locations: ["port_sprawl"],
      weight: 0.45,
      maxKm: 900,
      body: "Marshals auction passage slots to the highest bitter bidder. Hunger and guns share the same microphone.",
      choices: [
        ch(
          "lg4a",
          "Outbid with caps and parts.",
          40,
          [
            L("You buy a window measured in minutes."),
            { type: "resource", key: "caps", delta: -80 },
            { type: "resource", key: "parts", delta: -5 },
            { type: "km", delta: -28 },
          ],
          [
            L("They take the fee and invent a new fee."),
            { type: "resource", key: "caps", delta: -120 },
            { type: "time", days: 5 },
            { type: "morale", target: "all_living", delta: -14 },
          ],
        ),
        ch(
          "lg4b",
          "Rumor a richer convoy coming behind you.",
          25,
          [
            L("Greed is predictable. The line surges the wrong direction."),
            { type: "portChaos", delta: 12 },
            { type: "km", delta: -18 },
          ],
          [
            L("They decide you are the richer convoy."),
            { type: "damage", target: "all_living", amount: 16 },
            { type: "injure", target: "random_living" },
          ],
        ),
      ],
    },
    {
      id: "lg-industrial-salvage",
      title: "Machine graveyard",
      requiresLocation: "industrial_strip",
      locations: ["industrial_strip"],
      weight: 0.38,
      body: "A row of dead industrial crawlers. Stripping them would take hours and risk whoever crawls inside.",
      choices: [
        ch(
          "lg5a",
          "Strip salvageable parts.",
          50,
          [
            L("{randomLiving} comes out greased and grinning."),
            { type: "resource", key: "parts", delta: 8 },
            { type: "transport", delta: 6 },
          ],
          [
            L("A pressurised line gives. Hydraulic fluid, everywhere."),
            { type: "injure", target: "random_living" },
            { type: "resource", key: "parts", delta: 3 },
          ],
        ),
        ch(
          "lg5b",
          "Siphon fuel from the dead tanks.",
          55,
          [
            L("You drain the last drops from three crawlers."),
            { type: "resource", key: "fuel", delta: 9 },
          ],
          [
            L("Fuel ignites on sparks. Not ideal."),
            { type: "damage", target: "random_living", amount: 22 },
            { type: "transport", delta: -5 },
          ],
        ),
      ],
    },
    {
      id: "lg-buried-depot",
      title: "Buried supply depot",
      requiresLocation: "open_waste",
      locations: ["open_waste"],
      weight: 0.38,
      body: "A sand spine cracks open to reveal a buried logistics bay — dark, echoing, full of salvage legends and collapse dice.",
      choices: [
        ch(
          "lg3a",
          "Send a rope team down.",
          45,
          [
            L("You pull rations, parts, and emergency gear from the vault."),
            { type: "resource", key: "rations", delta: 12 },
            { type: "resource", key: "parts", delta: 4 },
          ],
          [
            L("The ceiling exacts its revenge."),
            { type: "injure", target: "random_living" },
            { type: "damage", target: "random_living", amount: 20 },
            { type: "time", days: 5 },
          ],
        ),
        ch(
          "lg3b",
          "Seal the entrance and move on.",
          undefined,
          [L("No followers. No second chances."), { type: "morale", target: "all_living", delta: 4 }],
          [],
        ),
      ],
    },
  ];
}

// ── All events ────────────────────────────────────────────────────────────────

export const ALL_EVENTS: GameEvent[] = [
  ...ambientPool(),
  ...sicknessEvents(),
  ...wastelandBulk(),
  ...approachBulk(),
  ...specials(),
  ...locationLegends(),
  ...embarkPool(),
  ...CAPS_EVENTS,
];

export const TRAVEL_EVENTS: GameEvent[] = ALL_EVENTS.filter(
  (e) => (e.eventPool ?? "travel") === "travel",
);
