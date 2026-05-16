/**
 * Events that only fire on Scavenge days (not travel / rest / repair / scout).
 */
import type { ChoiceDef, Effect, GameEvent, LocationId } from "../types";

const L = (t: string): Effect => ({ type: "appendLog", text: t });

const ROT: LocationId[] = [
  "open_waste",
  "abandoned_city",
  "industrial_strip",
  "dead_highway",
];

function ch(
  id: string,
  text: string,
  trait: ChoiceDef["trait"],
  basePct: number,
  ok: Effect[],
  bad: Effect[],
): ChoiceDef {
  return {
    id,
    text,
    trait,
    basePct,
    successEffects: ok,
    failureEffects: bad,
  };
}

function scavengeEvent(ev: Omit<GameEvent, "eventPool">): GameEvent {
  return { ...ev, eventPool: "scavenge" };
}

export const SCAVENGE_EVENTS: GameEvent[] = [
  scavengeEvent({
    id: "scv-sealed-pantry",
    kind: "ambient",
    title: "Sealed pantry",
    body: "A collapsed diner still has a walk-in pantry. The door groans but holds vacuum.",
    ambientEffects: [
      L("Canned goods and bottled water."),
      { type: "resource", key: "rations", delta: 8 },
      { type: "resource", key: "water", delta: 6 },
    ],
    locations: ["abandoned_city", "dead_highway"],
    weight: 0.7,
  }),
  scavengeEvent({
    id: "scv-fuel-truck",
    kind: "ambient",
    title: "Dead tanker",
    body: "{best_mechanic} siphons what hasn't gelled from a rusted tanker hull.",
    ambientEffects: [
      L("Fuel drained into jerrycans."),
      { type: "resource", key: "fuel", delta: 7 },
      { type: "rad", delta: 4 },
    ],
    locations: ["dead_highway", "industrial_strip"],
    weight: 0.55,
  }),
  scavengeEvent({
    id: "scv-parts-yard",
    kind: "ambient",
    title: "Scrap yard windfall",
    body: "A fenced yard of pre-war machinery—most is slag, but {specialist} spots usable assemblies.",
    ambientEffects: [
      L("Parts stripped from dead engines."),
      { type: "resource", key: "parts", delta: 5 },
    ],
    locations: ROT,
    weight: 0.6,
  }),
  scavengeEvent({
    id: "scv-empty",
    title: "Picked clean",
    body: "Every obvious cache in this block has already been gutted. Footprints overlap yours.",
    choices: [
      ch(
        "scve1a",
        "Dig deeper anyway.",
        "scavenger",
        45,
        [
          L("{specialist} finds a hidden cellar."),
          { type: "resource", key: "rations", delta: 4 },
          { type: "resource", key: "water", delta: 3 },
        ],
        [
          L("Collapse. Dust and disappointment."),
          { type: "injure", target: "random_living" },
          { type: "rad", delta: 8 },
        ],
      ),
      ch(
        "scve1b",
        "Cut losses and leave.",
        undefined,
        0,
        [L("You save daylight for the road.")],
        [{ type: "morale", target: "all_living", delta: -4 }],
      ),
    ],
    weight: 0.5,
  }),
  scavengeEvent({
    id: "scv-toxic-shed",
    title: "Marked chemical shed",
    body: "Warning placards peel off a corrugated shed. Smells like solvents and regret.",
    choices: [
      ch(
        "scvt1a",
        "Raid fast with masks.",
        "scavenger",
        40,
        [
          L("Fuel stabilizer and med-grade solvent."),
          { type: "resource", key: "fuel", delta: 5 },
          { type: "resource", key: "meds", delta: 2 },
        ],
        [
          L("Fumes get through."),
          { type: "sicken", target: "random_living", sickness: "Chemical burn", days: 6 },
          { type: "rad", delta: 10 },
        ],
      ),
      ch(
        "scvt1b",
        "Skip it.",
        undefined,
        0,
        [L("Not worth the cough.")],
        [],
      ),
    ],
    locations: ["industrial_strip"],
    weight: 0.45,
  }),
  scavengeEvent({
    id: "scv-personal-locker",
    title: "Military locker row",
    body: "A barracks row still has lockers. Most are empty. One still clicks shut.",
    choices: [
      ch(
        "scvp1a",
        "Pry it open.",
        "stalkerHunter",
        50,
        [
          L("Personal kit for whoever claims it."),
          { type: "grantPersonal", itemId: "pi_field_knife", target: "random_living" },
          { type: "resource", key: "caps", delta: 25 },
        ],
        [
          L("Booby trap. Spring blade."),
          { type: "injure", target: "random_living" },
        ],
      ),
      ch(
        "scvp1b",
        "Leave the row alone.",
        undefined,
        0,
        [L("You move on.")],
        [],
      ),
    ],
    locations: ROT,
    weight: 0.4,
  }),
  scavengeEvent({
    id: "scv-nurse-cache",
    title: "Field nurse cache",
    body: "A red cross crate buried under rubble. {best_medic} recognizes the packing.",
    choices: [
      ch(
        "scvn1a",
        "Recover everything.",
        "medic",
        55,
        [
          L("Meds and a personal kit."),
          { type: "resource", key: "meds", delta: 4 },
          { type: "grantPersonal", itemId: "pi_pharmacist_satchel", target: "weakest" },
        ],
        [
          L("Glass cuts. Supplies still worth it."),
          { type: "resource", key: "meds", delta: 2 },
          { type: "damage", target: "random_living", amount: 10 },
        ],
      ),
    ],
    weight: 0.38,
  }),
  scavengeEvent({
    id: "scv-water-tower",
    kind: "ambient",
    title: "Intact water tower",
    body: "A municipal tower still holds a bladder of filtered runoff—murky but drinkable after boil.",
    ambientEffects: [
      L("Water hauled to the convoy."),
      { type: "resource", key: "water", delta: 12 },
      { type: "time", days: 1 },
    ],
    locations: ROT,
    weight: 0.55,
  }),
  scavengeEvent({
    id: "scv-grocery-back",
    title: "Grocery loading dock",
    body: "Rotting pallets, but the cold room door is still sealed. {randomLiving} hears dripping inside.",
    choices: [
      ch(
        "scvg1a",
        "Breach the cold room.",
        "ironGut",
        48,
        [
          L("Frozen stock still edible."),
          { type: "resource", key: "rations", delta: 10 },
          { type: "resource", key: "water", delta: 4 },
        ],
        [
          L("Spoilage wins. Someone retches."),
          { type: "resource", key: "rations", delta: 2 },
          { type: "sicken", target: "random_living", sickness: "Gut fever", days: 5 },
        ],
      ),
      ch(
        "scvg1b",
        "Take only dry goods from the dock.",
        "scavenger",
        60,
        [
          L("Safe, modest haul."),
          { type: "resource", key: "rations", delta: 5 },
        ],
        [
          L("Floor gives way."),
          { type: "injure", target: "random_living" },
        ],
      ),
    ],
    locations: ["abandoned_city", "port_sprawl"],
    weight: 0.5,
  }),
  scavengeEvent({
    id: "scv-charm-find",
    kind: "ambient",
    title: "Someone's stash",
    body: "{randomLiving} finds a satchel under a bench—caps, a charm, and nothing identifying.",
    ambientEffects: [
      L("Caps and a charm claimed."),
      { type: "resource", key: "caps", delta: 45 },
      { type: "grantPersonal", itemId: "pi_lucky_charm", target: "random_living" },
    ],
    weight: 0.35,
  }),
  scavengeEvent({
    id: "scv-garage-tools",
    title: "Garage workshop",
    body: "An intact garage bay. Lifts are dead but tool chests remain.",
    choices: [
      ch(
        "scvg2a",
        "Strip tools and parts.",
        "mechanic",
        55,
        [
          L("{best_mechanic} loads the wagon."),
          { type: "resource", key: "parts", delta: 6 },
          { type: "resource", key: "fuel", delta: 3 },
          { type: "grantPersonal", itemId: "pi_tool_belt", target: "specialist" },
        ],
        [
          L("Shelf collapses."),
          { type: "injure", target: "random_living" },
          { type: "resource", key: "parts", delta: 2 },
        ],
      ),
    ],
    locations: ["industrial_strip", "dead_highway"],
    weight: 0.42,
  }),
  scavengeEvent({
    id: "scv-ambush-scrap",
    title: "Competing scavengers",
    body: "Another crew is picking the same block. They haven't seen you yet.",
    choices: [
      ch(
        "scva1a",
        "Share the block—offer caps.",
        "negotiator",
        50,
        [
          L("They take caps and point you to a good room."),
          { type: "resource", key: "caps", delta: -30 },
          { type: "resource", key: "rations", delta: 6 },
          { type: "resource", key: "water", delta: 5 },
        ],
        [
          L("They take caps and still get ugly."),
          { type: "resource", key: "caps", delta: -40 },
          { type: "damage", target: "random_living", amount: 18 },
        ],
      ),
      ch(
        "scva1b",
        "Grab what's nearest and run.",
        "scavenger",
        45,
        [
          L("Quick grab: mixed supplies."),
          { type: "resource", key: "rations", delta: 4 },
          { type: "resource", key: "parts", delta: 2 },
        ],
        [
          L("Chase across rubble."),
          { type: "injure", target: "random_living" },
          { type: "resource", key: "rations", delta: -3 },
        ],
      ),
    ],
    weight: 0.48,
  }),
  scavengeEvent({
    id: "scv-goggles-case",
    kind: "ambient",
    title: "Optics case",
    body: "A hard case in a bus wreck—welding goggles, still intact.",
    ambientEffects: [
      L("Goggles go to whoever needs them."),
      { type: "grantPersonal", itemId: "pi_goggles", target: "random_living" },
    ],
    weight: 0.32,
  }),
];
