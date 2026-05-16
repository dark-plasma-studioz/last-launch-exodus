/**
 * eventChunks.ts — All game events.
 *
 * HOW TO ADD A NEW EVENT
 * ─────────────────────
 * 1. Pick a pool function below (or create a new one, then add to ALL_EVENTS).
 * 2. Copy an existing event block and change the id, title, body, and choices.
 * 3. Set `locations` to restrict where the event fires (omit for anywhere).
 * 4. For choice events: use ch() helper. For ambient events: use ambient() helper.
 *
 * AUTHORING HELPERS
 * ─────────────────
 *  L("text")          → appendLog effect (flavor text in the log)
 *  ch(id, btn, trait, basePct, ok[], bad[], always?, requiredItem?)
 *  ambient(id, title, body, effects[], locations?, weight?)
 *
 * BASE PERCENT GUIDE (basePct before party trait bonuses)
 *   65% = generous   50% = fair   35% = tough   20% = brutal
 *   Each trait-holder adds ~+12%. Party size adds up to +8%.
 *   Negative traits subtract up to -15% total.
 *
 * EFFECT QUICK REFERENCE
 *   { type: "resource", key: "rations", delta: -8 }
 *   { type: "damage", target: "random_living", amount: 25 }
 *   { type: "injure", target: "weakest" }          ← prefer this over kill
 *   { type: "kill", target: "random_living" }       ← use sparingly
 *   { type: "sicken", target: "random_living", sickness: "Gut fever", days: 7 }
 *   { type: "cure", target: "all_living" }
 *   { type: "rad", delta: 20 }
 *   { type: "morale", target: "all_living", delta: -10 }
 *   { type: "heal", target: "weakest", amount: 15 }
 *   { type: "km", delta: -18 }
 *   { type: "time", days: 4 }
 *   { type: "portChaos", delta: 8 }
 *   { type: "flag", key: "met_trader", value: true }
 */

import type { ChoiceDef, Effect, GameEvent, LocationId } from "../types";
import { CAPS_EVENTS } from "./capsEvents";

const L = (t: string): Effect => ({ type: "appendLog", text: t });

/** Regions that appear during the road journey (not embark). */
const ROT: LocationId[] = [
  "open_waste",
  "abandoned_city",
  "industrial_strip",
  "dead_highway",
];

// ── ch() helper ───────────────────────────────────────────────────────────────

/**
 * Build a ChoiceDef with a trait check.
 * Leave trait undefined for a guaranteed-success choice.
 * basePct is the base % before party bonuses are applied.
 */
function ch(
  id: string,
  text: string,
  trait: ChoiceDef["trait"],
  basePct: number,
  ok: Effect[],
  bad: Effect[],
  always?: Effect[],
  requiredItem?: string,
): ChoiceDef {
  return {
    id,
    text,
    trait,
    basePct,
    successEffects: ok,
    failureEffects: bad,
    alwaysEffects: always,
    requiredItem,
  };
}

// ── ambient() helper ──────────────────────────────────────────────────────────

/**
 * Build an ambient (no-choice) event.
 * Effects fire automatically when the player clicks Continue.
 */
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
//
// Passive encounters: no player decision. Mix of windfalls and mild setbacks.
// These keep the journey feeling alive without demanding constant choices.

function ambientPool(): GameEvent[] {
  return [
    ambient(
      "amb-found-rations",
      "Cache of rations",
      "{randomLiving} found a small camp with supplies just off the road! {randomLiving} pries them open to find food!",
      [L("Extra food loaded."), { type: "resource", key: "rations", delta: 6 }],
      ["abandoned_city", "industrial_strip", "dead_highway"],
      0.6,
    ),
    ambient(
      "amb-found-water",
      "Rain catchment",
      "Rains bring water into collection basin.",
      [L("+water collected."), { type: "resource", key: "water", delta: 7 }],
      ["open_waste", "abandoned_city", "dead_highway"],
      0.55,
    ),
    ambient(
      "amb-found-fuel",
      "Buried jerrycan",
      "Digging a latrine trench, {randomLiving} hits metal. Three jerrycans of ethanol mix - old, but it does work...",
      [L("Fuel recovered from beneath the dirt."), { type: "resource", key: "fuel", delta: 5 }],
      ["dead_highway", "industrial_strip"],
      0.45,
    ),
    ambient(
      "amb-found-meds",
      "Aid station remnants",
      "{randomLiving} finds a collapsed field aid post. Most supplies rotted, but a sealed pouch of antibiotics is intact.",
      [L("Medical supplies salvaged."), { type: "resource", key: "meds", delta: 3 }],
      ["abandoned_city", "port_sprawl"],
      0.4,
    ),
    ambient(
      "amb-broken-leg",
      "Stumble on rubble",
      "{randomLiving} trips hard and breaks their leg. What a loser.",
      [
        L("{randomLiving} is hurt, better be careful with them."),
        { type: "injure", target: "random_living" },
        { type: "morale", target: "all_living", delta: -6 },
      ],
      ROT,
      0.4,
    ),
    ambient(
      "amb-rad-pocket",
      "Hot pocket",
      "The Geiger counter spikes. No warning, no landmark, just a buried hot spot in the road.",
      [
        L("Rads absorbed. Move quickly."),
        { type: "rad", delta: 14 },
        { type: "damage", target: "random_living", amount: 8 },
      ],
      ["open_waste", "industrial_strip"],
      0.5,
    ),
    ambient(
      "amb-morale-sunrise",
      "Burning sky",
      "The sky burns with the remnants of the explosions. It looks cool I guess.",
      [
        L("A moment of strange beauty."),
        { type: "morale", target: "all_living", delta: 15 },
      ],
      undefined,
      0.45,
    ),
    ambient(
      "amb-supply-rot",
      "Spoiled rations",
      "{randomLiving} forgot to seal the food after going for a midnight snack. 3 rations are spoiled and moldy. Great job.",
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
      "STUPID CAR! {randomLiving}, what happened? We are so screwed.",
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
      "{randomLiving} loots a dead body. Finds caps somehow. Always loot your bodies kids.",
      [L("Caps recovered."), { type: "resource", key: "caps", delta: 35 }],
      ["abandoned_city", "industrial_strip"],
      0.4,
    ),
    ambient(
      "amb-sick-contact",
      "Coughing stranger",
      "Sick guy roams up to the convoy door and bursts in looking for help. It's Covid all over again...",
      [
        L("Possible exposure. Watch for symptoms."),
        { type: "sicken", target: "random_living", sickness: "Ash lung", days: 8 },
      ],
      ["port_sprawl", "dead_highway"],
      0.3,
    ),
    ambient(
      "amb-gut-water",
      "Suspect water source",
      "The drums ran low and someone filled from an unverified cistern. It was not a good idea.",
      [
        L("Gut infection spreading."),
        { type: "resource", key: "water", delta: 4 },
        { type: "sicken", target: "random_living", sickness: "Gut fever", days: 7 },
      ],
      ["open_waste", "dead_highway"],
      0.3,
    ),
    ambient(
      "amb-storm-delay",
      "Dust wall",
      "A brown wall of grit swallows the road for hours. Needles in every crevice. You wait it out sealed tight.",
      [
        L("Storm costs a day and some rads."),
        { type: "time", days: 2 },
        { type: "rad", delta: 8 },
      ],
      ["open_waste"],
      0.45,
    ),
    ambient(
      "amb-refugee-trade",
      "Roadside trade",
      "Two little buggers from a camp nearby steals some parts. Luckily, {randomLiving} has no problem beating up a child. Stragler had some meds on him.",
      [
        L("Traded parts for medicine."),
        { type: "resource", key: "meds", delta: 3 },
        { type: "resource", key: "parts", delta: -3 },
      ],
      ["port_sprawl", "dead_highway"],
      0.4,
    ),
    ambient(
      "amb-heat-exhaustion",
      "Heat collapse",
      "Heat stroke. {randomLiving} couldn't take it and chugs as much water as they can.",
      [
        L("{randomLiving} needs water and shade."),
        { type: "damage", target: "random_living", amount: 12 },
        { type: "resource", key: "water", delta: -3 },
      ],
      ["open_waste", "dead_highway"],
      0.35,
    ),
    ambient(
      "amb-lucky-caps",
      "Scattered loot",
      "A wrecked scavenger rig spilled its cargo. Most of it is ash, but the cap-belt survived.",
      [L("Caps recovered from the wreck."), { type: "resource", key: "caps", delta: 55 }],
      ["open_waste", "dead_highway"],
      0.3,
    ),
    ambient(
      "amb-morale-song",
      "An old song",
      "Someone starts humming something from before. Nobody remembers the words, but everyone knows the tune.",
      [
        L("The melody carries for an hour."),
        { type: "morale", target: "all_living", delta: 10 },
      ],
      undefined,
      0.4,
    ),
  ];
}

// ── Sickness events (choice events that involve contagion) ────────────────────

function sicknessEvents(): GameEvent[] {
  return [
    {
      id: "sick-tainted-spring",
      title: "Tainted spring",
      locations: ["open_waste", "industrial_strip"],
      weight: 0.4,
      body: "A spring flows clear and cold. {randomLiving} want to drink immediately. {best_medic} eyes it with suspicion.",
      choices: [
        ch(
          "sts-a",
          "Boil and filter carefully (takes time).",
          "medic",
          55,
          [
            L("{best_medic} treats the water properly. Safe enough."),
            { type: "resource", key: "water", delta: 10 },
            { type: "time", days: 2 },
          ],
          [
            L("Something survives the boil. Stomach cramps that night."),
            { type: "resource", key: "water", delta: 8 },
            { type: "sicken", target: "random_living", sickness: "Gut fever", days: 6 },
          ],
        ),
        ch(
          "sts-b",
          "Fill the drums and move on without boiling.",
          undefined,
          0,
          [
            L("Everyone drinks. It tastes fine. You'll know in 48 hours."),
            { type: "resource", key: "water", delta: 14 },
            { type: "sicken", target: "random_living", sickness: "Gut fever", days: 7 },
          ],
          [],
        ),
        ch(
          "sts-c",
          "Leave it. The risk is not worth it.",
          "calm",
          55,
          [L("{specialist} talks people down from the water. Smart call.")],
          [
            L("Consensus fails, {randomLiving} sneaks back."),
            { type: "resource", key: "water", delta: 4 },
            { type: "sicken", target: "random_living", sickness: "Gut fever", days: 8 },
          ],
        ),
      ],
    },
    {
      id: "sick-refugee-nurse",
      title: "Sick refugee",
      locations: ["port_sprawl", "dead_highway"],
      weight: 0.38,
      body: "A woman waves from a ditch—barely standing, feverish, wearing faction colours that don't matter anymore. She's asking for water.",
      choices: [
        ch(
          "srn-a",
          "Help her—share water and a med.",
          "medic",
          45,
          [
            L("{best_medic} stabilises her. She gives you whatever she had."),
            { type: "resource", key: "water", delta: -3 },
            { type: "resource", key: "meds", delta: -1 },
            { type: "resource", key: "caps", delta: 40 },
            { type: "morale", target: "all_living", delta: 6 },
          ],
          [
            L("You try your best. The fever spreads anyway."),
            { type: "resource", key: "water", delta: -3 },
            { type: "resource", key: "meds", delta: -2 },
            { type: "sicken", target: "random_living", sickness: "Road fever", days: 7 },
          ],
        ),
        ch(
          "srn-b",
          "Toss water from distance and drive on.",
          undefined,
          0,
          [
            L("Clean conscience, uncertain safety."),
            { type: "resource", key: "water", delta: -2 },
          ],
          [],
        ),
        ch(
          "srn-c",
          "Keep moving. Can't afford it.",
          "calm",
          50,
          [L("Hard call. {specialist} reminds the party why.")],
          [
            L("Guilt eats the evening."),
            { type: "morale", target: "all_living", delta: -8 },
          ],
        ),
      ],
    },
    {
      id: "sick-rat-stores",
      title: "Rat infiltration",
      locations: ROT,
      weight: 0.42,
      body: "Night sounds: scratching, gnawing. At dawn the rations crate is chewed through and the rats are gone — leaving something else behind.",
      choices: [
        ch(
          "srs-a",
          "Burn the contaminated stock and eat the loss.",
          "medic",
          55,
          [
            L("{best_medic} separates the gnawed from the clean. You eat half what you hoped."),
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
          "Eat the gnawed rations — waste nothing.",
          undefined,
          0,
          [
            L("You eat and wait. Maybe nothing happens."),
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
      body: "{randomLiving} has been coughing metallic phlegm for two days. The rads are ticking. {best_medic} looks worried.",
      choices: [
        ch(
          "src-a",
          "Rest a day and push meds.",
          "medic",
          50,
          [
            L("{best_medic} slows the progression. For now."),
            { type: "resource", key: "meds", delta: -3 },
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
          "Keep marching — there's no time.",
          undefined,
          0,
          [
            L("They keep up. For now."),
            { type: "rad", delta: 5 },
            { type: "sicken", target: "weakest", sickness: "Rad lung", days: 10 },
          ],
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
    // Difficulty steps upward as embark progresses
    const baseDiff = Math.max(0, Math.floor(i / 3));
    out.push({
      id: `emb-${i}`,
      title: `${t} (${i + 1})`,
      locations: ["embark"],
      weight: 1.1,
      body: "Floodlights and shouting marshals. {randomLiving} is singled out in the crush. Papers shake. Clocks do not care.",
      choices: [
        ch(
          `e${i}a`,
          "Talk your way into the correct line.",
          "negotiator",
          40 - baseDiff * 5,
          [L("{specialist} bluffs the queue into coherence."), { type: "portChaos", delta: -4 }],
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
          "Hold formation—tight, quiet, fast.",
          "calm",
          45 - baseDiff * 5,
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
          "negotiator",
          20,
          [
            L("The laminate gleams just enough. A bored clerk waves you on."),
            { type: "flag", key: "forge_kit_used", value: true },
          ],
          [
            L("Security tags the forgery. Dogs, then running. Someone doesn't make it out."),
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
    "melted overpass",
    "glassed suburb",
    "salt pan convoy graveyard",
    "collapsed aqueduct",
    "black orchard",
    "rail spine",
    "radio-tower mausoleum",
    "cinder school",
    "toll cathedral of rust",
    "basement bazaar",
  ];
  const threats = [
    "dust cholera rumors",
    "cinder lightning",
    "feral drones",
    "highway kings demanding tribute",
    "a glowing crater mist",
    "refugee maps of nowhere",
    "a cult that worships the launch flame",
  ];
  const out: GameEvent[] = [];
  for (let i = 0; i < 40; i++) {
    const spot = spots[i % spots.length];
    const th = threats[i % threats.length];
    const loc = ROT[i % ROT.length];
    // Cycle basePct across a range so events feel varied
    const pctA = [55, 50, 45, 40, 35][i % 5];
    const pctB = [50, 45, 40, 35, 30][i % 5];
    out.push({
      id: `wl-${i}`,
      title: `Road beat — ${spot}`,
      locations: [loc],
      weight: 1,
      body: `You pass a ${spot}. Word says ${th}.`,
      choices: [
        ch(
          `wl${i}a`,
          "Detour wide (costs days, may save bodies).",
          "navigator",
          pctA,
          [
            L("The detour is ugly but empty."),
            { type: "time", days: 3 },
            { type: "resource", key: "fuel", delta: -2 },
          ],
          [
            L("You get lost in irradiated switchbacks."),
            { type: "rad", delta: 18 },
            { type: "injure", target: "random_living" },
            { type: "morale", target: "all_living", delta: -10 },
          ],
        ),
        ch(
          `wl${i}b`,
          "Push straight through.",
          "scavenger",
          pctB,
          [
            L("{specialist} finds a rabbit-path between wrecks."),
            { type: "km", delta: -10 },
          ],
          [
            L("Ambush. Quick and mean."),
            { type: "damage", target: "random_living", amount: 28 },
            { type: "injure", target: "weakest" },
            { type: "resource", key: "meds", delta: -2 },
          ],
        ),
        ch(
          `wl${i}c`,
          "Camp, boil water, listen.",
          "medic",
          80,
          [
            L("{best_medic} keeps fevers down."),
            { type: "heal", target: "weakest", amount: 14 },
            { type: "time", days: 2 },
          ],
          [
            L("Quiet attracts unwanted visitors."),
            { type: "injure", target: "random_living" },
            { type: "resource", key: "rations", delta: -6 },
            { type: "morale", target: "all_living", delta: -8 },
          ],
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
      title: `Approach corridor — sector ${i + 1}`,
      locations: ["port_sprawl"],
      weight: 1.05,
      minKm: 0,
      maxKm: 900,
      body: "The sky bruises toward the spaceport arcology. Checkpoints multiply. {best_navigator} studies routes while {randomLiving} counts rations again.",
      choices: [
        ch(
          `ap${i}a`,
          "Bribe a checkpoint with parts.",
          "negotiator",
          45,
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
          "Sneak a maintenance tunnel.",
          "mechanic",
          40,
          [
            L("{best_mechanic} knows which bolts lie."),
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
          "negotiator",
          55,
          [
            L("A drone winks once—an escort window opens."),
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
      body: "Oil-black rain hisses on the convoy tarp. {randomLiving} coughs metal taste.",
      choices: [
        ch(
          "sp1a",
          "Seal the wagons and wait it out.",
          "mechanic",
          75,
          [
            L("{best_mechanic} rigs seals with wax and spite."),
            { type: "time", days: 4 },
          ],
          [
            L("Seals fail. Skin burns."),
            { type: "rad", delta: 26 },
            { type: "damage", target: "all_living", amount: 16 },
            { type: "resource", key: "meds", delta: -3 },
          ],
        ),
        ch(
          "sp1b",
          "March anyway.",
          "ironGut",
          60,
          [L("Guts hold. Barely."), { type: "rad", delta: 10 }],
          [
            L("Someone collapses in the rain."),
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
      body: "{randomLiving} hears rumors of a cache of supplies. Sounds like a few groups are planning to get it. {randomLiving} thinks that we can get it first...",
      choices: [
        ch(
          "sp2a",
          "Raid fast.",
          "stalkerHunter",
          75,
          [
            L("You pull meds, parts, food, water, and some fuel from the frost, {best_stalkerHunter} uses some some of it to light the place up, killing the group chasing behind."),
            { type: "resource", key: "meds", delta: 9 },
            { type: "resource", key: "fuel", delta: 6},
            { type: "resource", key: "rations", delta: 10},
            { type: "resource", key: "water", delta: 10},
            { type: "portChaos", delta: 6 },
            { type: "morale", target: "all_living", delta: 25},
            { type: "item", itemId: "pi_armour_vest" , count: 1},
          ],
          [
            L("Bait. Snipers. You scatter and someone doesn't come back."),
            { type: "kill", target: "random_living" },
            { type: "damage", target: "all_living", amount: 18 },
          ],
        ),
        ch(
          "sp2b",
          "Walk away.",
          "calm",
          65,
          [L("It's no worth the risk, is it?")],
          [{ type: "morale", target: "all_living", delta: -5 }],
        ),
      ],
    },
    {
      id: "sp-cult",
      title: "Cult of the launch flame",
      locations: ["port_sprawl", "dead_highway"],
      weight: 0.52,
      maxKm: 900,
      body: "They wear mirrored masks and beg you to burn your maps as offerings. {best_navigator} sweats.",
      choices: [
        ch(
          "sp3a",
          "Lie that you already burned them.",
          "negotiator",
          40,
          [L("They love a good story more than truth.")],
          [
            L("They search the wagons. You resist; someone takes a cut."),
            { type: "damage", target: "random_living", amount: 20 },
            { type: "resource", key: "rations", delta: -10 },
          ],
        ),
        ch(
          "sp3b",
          "Trade rations for passage.",
          "negotiator",
          60,
          [
            L("Cheap religion, expensive rice."),
            { type: "resource", key: "rations", delta: -12 },
          ],
          [
            L("They want more than rice. The standoff gets ugly."),
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
      body: "A cheap autonomous recon swarm from an old war passes overhead, still executing its last orders. It sees the convoy.",
      choices: [
        ch(
          "sp4a",
          "Hold still—let it scan and pass.",
          "calm",
          50,
          [
            L("It classifies you as low-threat and banks away."),
            { type: "morale", target: "all_living", delta: 5 },
          ],
          [
            L("A trigger flag fires one last strike package."),
            { type: "damage", target: "all_living", amount: 20 },
            { type: "injure", target: "random_living" },
            { type: "transport", delta: -10 },
          ],
        ),
        ch(
          "sp4b",
          "Jam it (needs engineer).",
          "engineer",
          40,
          [
            L("{specialist} fries the transponder. It drops into a field."),
            { type: "resource", key: "parts", delta: -2 },
          ],
          [
            L("Jamming spikes the IFF. It stops trying to be subtle."),
            { type: "damage", target: "random_living", amount: 30 },
            { type: "injure", target: "random_living" },
          ],
        ),
      ],
    },
    {
      id: "sp-water-trade",
      title: "Caravan water market",
      locations: ["dead_highway", "port_sprawl"],
      weight: 0.48,
      body: "A convoy is selling purified water at extortionate rates. A queue of desperate buyers stretches back half a kilometre.",
      choices: [
        ch(
          "sp5a",
          "Buy at their price.",
          undefined,
          0,
          [
            L("Clean water, ugly price tag."),
            { type: "resource", key: "water", delta: 12 },
            { type: "resource", key: "caps", delta: -55 },
          ],
          [],
        ),
        ch(
          "sp5b",
          "Negotiate a better rate.",
          "negotiator",
          45,
          [
            L("{specialist} shaves the price to something almost fair."),
            { type: "resource", key: "water", delta: 12 },
            { type: "resource", key: "caps", delta: -30 },
          ],
          [
            L("They laugh and quote a higher price as insult tax."),
            { type: "resource", key: "caps", delta: -70 },
            { type: "resource", key: "water", delta: 10 },
          ],
        ),
        ch(
          "sp5c",
          "Skip it. Ration what you have.",
          undefined,
          0,
          [
            L("No clean water today. You manage."),
            { type: "morale", target: "all_living", delta: -5 },
          ],
          [],
        ),
      ],
    },
    {
      id: "sp-med-shortage",
      title: "Medicine for maps",
      locations: ["open_waste", "abandoned_city"],
      weight: 0.45,
      body: "A field surgeon outside a collapsed settlement is trading detailed regional maps for medicines. Paper is expensive here.",
      choices: [
        ch(
          "sp6a",
          "Trade meds for the maps.",
          undefined,
          0,
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
          "Check the maps before paying.",
          "navigator",
          50,
          [
            L("{best_navigator} confirms they're worth the price."),
            { type: "resource", key: "meds", delta: -2 },
            { type: "km", delta: -25 },
          ],
          [
            L("They're outdated. Decent enough, not worth the meds paid."),
            { type: "resource", key: "meds", delta: -2 },
            { type: "time", days: 2 },
          ],
        ),
        ch(
          "sp6c",
          "Keep the meds. Move on.",
          undefined,
          0,
          [L("Meds stay in the kit. The surgeon watches you leave.")],
          [],
        ),
      ],
    },
    {
      id: "sp-convoy-attack",
      title: "Scavenger raid",
      locations: ROT,
      weight: 0.55,
      body: "Engine sounds from both sides of the road. They fly no flag and drive stripped rigs. {randomLiving} reaches for a weapon.",
      choices: [
        ch(
          "sp7a",
          "Scatter and speed through.",
          "navigator",
          45,
          [
            L("{best_navigator} finds a gap and you gun it through."),
            { type: "resource", key: "fuel", delta: -4 },
            { type: "km", delta: -8 },
          ],
          [
            L("They flank you. Side impact—{randomLiving} is hurt."),
            { type: "injure", target: "random_living" },
            { type: "resource", key: "fuel", delta: -3 },
            { type: "transport", delta: -8 },
          ],
        ),
        ch(
          "sp7b",
          "Fight back.",
          "stalkerHunter",
          40,
          [
            L("{specialist} drops the lead driver. They scatter."),
            { type: "resource", key: "caps", delta: 40 },
            { type: "morale", target: "all_living", delta: 8 },
          ],
          [
            L("Outnumbered and outgunned."),
            { type: "damage", target: "random_living", amount: 30 },
            { type: "injure", target: "weakest" },
            { type: "resource", key: "rations", delta: -10 },
          ],
        ),
        ch(
          "sp7c",
          "Give them a share—buy safe passage.",
          "negotiator",
          50,
          [
            L("They're practical bandits; they take the offer."),
            { type: "resource", key: "rations", delta: -8 },
            { type: "resource", key: "caps", delta: -30 },
          ],
          [
            L("They take the offering and take more."),
            { type: "resource", key: "rations", delta: -14 },
            { type: "resource", key: "meds", delta: -3 },
            { type: "damage", target: "random_living", amount: 16 },
          ],
        ),
      ],
    },
  ];
}

// ── Location legends ──────────────────────────────────────────────────────────
// High-stakes, location-locked events. More flavour, higher consequences.

function locationLegends(): GameEvent[] {
  return [
    {
      id: "lg-gun-mall",
      title: "Sealed arms annex",
      requiresLocation: "abandoned_city",
      locations: ["abandoned_city"],
      weight: 0.42,
      body: "A tilted mall sign reads CLOSED FOREVER. Behind buckled security shutters: racks of pre-war longarms under vacuum glass—and active motion sensors.",
      choices: [
        ch(
          "lg1a",
          "Breach fast, grab crates, leave.",
          "stalkerHunter",
          30,
          [
            L("{specialist} times the sweep blind spots. You leave heavier than you arrived."),
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
          "Bypass electronics quietly.",
          "engineer",
          35,
          [
            L("{specialist} spoofs the panel with jury-rigged caps and shame."),
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
          "calm",
          60,
          [L("You keep blood inside the convoy. For now.")],
          [
            L("Someone sneaks back alone—and doesn't return."),
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
          "mechanic",
          30,
          [
            L("{best_mechanic} threads the sequence. You roll out with tradeable chems."),
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
          "Burn it closed with fuel you can spare.",
          "engineer",
          45,
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
      id: "lg-dune-ark",
      title: "Buried transit ark",
      requiresLocation: "open_waste",
      locations: ["open_waste"],
      weight: 0.38,
      body: "A sand spine cracks open to show a buried metro mouth—dark, echoing, full of salvage legends and collapse dice.",
      choices: [
        ch(
          "lg3a",
          "Send a rope team.",
          "navigator",
          40,
          [
            L("Maps in dust. You pull water stills and wire."),
            { type: "resource", key: "water", delta: 14 },
            { type: "resource", key: "parts", delta: 2 },
          ],
          [
            L("The ceiling calendars its revenge."),
            { type: "injure", target: "random_living" },
            { type: "damage", target: "random_living", amount: 20 },
            { type: "time", days: 5 },
          ],
        ),
        ch(
          "lg3b",
          "Collapse the entrance behind you as you leave.",
          "engineer",
          50,
          [
            L("No followers. No second chances."),
            { type: "morale", target: "all_living", delta: 6 },
          ],
          [
            L("Charges were wet. Something follows you."),
            { type: "damage", target: "weakest", amount: 20 },
            { type: "portChaos", delta: 6 },
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
          "negotiator",
          35,
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
          "negotiator",
          20,
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
      body: "A row of dead industrial crawlers. {best_mechanic} practically vibrates with interest. Stripping them would take hours and risk whoever crawls inside.",
      choices: [
        ch(
          "lg5a",
          "Strip salvageable parts.",
          "mechanic",
          45,
          [
            L("{best_mechanic} comes out greased and grinning."),
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
          "scavenger",
          50,
          [
            L("{specialist} drains the last drops from three crawlers."),
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
      id: "lg-rad-spring",
      title: "Glowing aquifer",
      requiresLocation: "open_waste",
      locations: ["open_waste"],
      weight: 0.35,
      body: "Something seeps up from deep aquifer fractures—clear, cold, and softly luminescent. {best_medic} warns against it. {randomLiving} hesitates.",
      choices: [
        ch(
          "lg6a",
          "Filter and boil; still collect it.",
          "medic",
          40,
          [
            L("{best_medic} runs what passes for decontam. Mostly safe."),
            { type: "resource", key: "water", delta: 16 },
            { type: "rad", delta: 10 },
          ],
          [
            L("The rads passed the filter stage. Everybody burns a little."),
            { type: "resource", key: "water", delta: 10 },
            { type: "rad", delta: 22 },
            { type: "sicken", target: "weakest", sickness: "Rad fever", days: 9 },
          ],
        ),
        ch(
          "lg6b",
          "Leave it alone.",
          undefined,
          0,
          [L("Wisdom is free; clean water is not.")],
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

/** Road/travel random encounters (excludes scavenge-day pool). */
export const TRAVEL_EVENTS: GameEvent[] = ALL_EVENTS.filter(
  (e) => (e.eventPool ?? "travel") === "travel",
);
