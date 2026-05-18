/** Events that only fire on Search-for-Food days (scavenge pool). */
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
  basePct: number | undefined,
  ok: Effect[],
  bad: Effect[],
): ChoiceDef {
  return { id, text, basePct, successEffects: ok, failureEffects: bad };
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
      L("Canned goods loaded."),
      { type: "resource", key: "rations", delta: 10 },
    ],
    locations: ["abandoned_city", "dead_highway"],
    weight: 0.7,
  }),
  scavengeEvent({
    id: "scv-fuel-truck",
    kind: "ambient",
    title: "Dead tanker",
    body: "{randomLiving} siphons what hasn't gelled from a rusted tanker hull.",
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
    body: "A fenced yard of pre-war machinery. {randomLiving} spots usable assemblies under the rust.",
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
        45,
        [
          L("{randomLiving} finds a hidden cellar with a few supplies."),
          { type: "resource", key: "rations", delta: 5 },
          { type: "resource", key: "parts", delta: 2 },
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
        "Raid fast with improvised masks.",
        45,
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
        55,
        [
          L("Personal kit inside — someone claims it."),
          { type: "grantPersonal", itemId: "pi_armour_vest", target: "random_living" },
          { type: "resource", key: "caps", delta: 25 },
        ],
        [
          L("Booby trap. Spring blade catches {randomLiving}."),
          { type: "injure", target: "random_living" },
        ],
      ),
      ch(
        "scvp1b",
        "Leave the row alone.",
        undefined,
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
    body: "A red cross crate buried under rubble. {randomLiving} recognizes the packing.",
    choices: [
      ch(
        "scvn1a",
        "Recover everything.",
        60,
        [
          L("Meds and a personal medic kit."),
          { type: "resource", key: "meds", delta: 4 },
          { type: "grantPersonal", itemId: "pi_medic_bag", target: "weakest" },
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
    id: "scv-grocery-back",
    title: "Grocery loading dock",
    body: "Rotting pallets, but the cold room door is still sealed. {randomLiving} hears dripping inside.",
    choices: [
      ch(
        "scvg1a",
        "Breach the cold room.",
        50,
        [
          L("Frozen stock still edible."),
          { type: "resource", key: "rations", delta: 10 },
          { type: "resource", key: "meds", delta: 1 },
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
        65,
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
    body: "{randomLiving} finds a satchel under a bench — caps, a charm, and nothing identifying.",
    ambientEffects: [
      L("Caps and a lucky charm claimed."),
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
        55,
        [
          L("{randomLiving} loads the wagon with useful gear."),
          { type: "resource", key: "parts", delta: 6 },
          { type: "resource", key: "fuel", delta: 3 },
          { type: "grantPersonal", itemId: "pi_stim_injector", target: "random_living" },
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
        "Share the block — offer some caps.",
        50,
        [
          L("They take caps and point you to a good room."),
          { type: "resource", key: "caps", delta: -30 },
          { type: "resource", key: "rations", delta: 7 },
          { type: "resource", key: "parts", delta: 2 },
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
    id: "scv-hunting-kit",
    kind: "ambient",
    title: "Hunter's pack",
    body: "A hard case in a bus wreck — hunting gear, still serviceable.",
    ambientEffects: [
      L("Hunting kit goes to whoever can use it best."),
      { type: "grantPersonal", itemId: "pi_hunting_kit", target: "random_living" },
    ],
    weight: 0.32,
  }),
];
