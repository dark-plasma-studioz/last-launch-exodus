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
  dc: number,
  ok: Effect[],
  bad: Effect[],
  always?: Effect[],
  requiredItem?: string,
): ChoiceDef {
  return {
    id,
    text,
    trait,
    dc,
    successEffects: ok,
    failureEffects: bad,
    alwaysEffects: always,
    requiredItem,
  };
}

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
          16 + (i % 3),
          [L("{specialist} bluffs the queue into coherence."), { type: "portChaos", delta: -4 }],
          [
            L("Wrong line. A baton finds ribs."),
            { type: "damage", target: "random_living", amount: 28 },
            { type: "portChaos", delta: 8 },
            { type: "time", days: 3 },
          ],
        ),
        ch(
          `e${i}b`,
          "Hold formation—tight, quiet, fast.",
          "calm",
          15 + (i % 4),
          [L("You slide through a gap that only existed for seconds.")],
          [
            L("Panic wins. Someone falls."),
            { type: "damage", target: "weakest", amount: 24 },
            { type: "morale", target: "all_living", delta: -14 },
            { type: "time", days: 5 },
          ],
        ),
        ch(
          `e${i}c`,
          "Forge a stamp (risky).",
          "negotiator",
          19,
          [
            L("The laminate gleams just enough. A bored clerk waves you on."),
            { type: "flag", key: "forge_kit_used", value: true },
          ],
          [
            L("Security tags the forgery. Dogs, then running."),
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
    "feral drones (cheap copies)",
    "highway kings demanding tribute",
    "a glowing crater mist",
    "refugee knot selling bad maps",
    "a cult that worships the launch flame",
  ];
  const out: GameEvent[] = [];
  for (let i = 0; i < 40; i++) {
    const spot = spots[i % spots.length];
    const th = threats[i % threats.length];
    const loc = ROT[i % ROT.length];
    out.push({
      id: `wl-${i}`,
      title: `Road beat — ${spot}`,
      locations: [loc],
      weight: 1,
      body: `You pass a ${spot}. Word says ${th}. The convoy slows anyway—something always wants paying.`,
      choices: [
        ch(
          `wl${i}a`,
          "Detour wide (costs days, may save bodies).",
          "navigator",
          13 + (i % 5),
          [
            L("The detour is ugly but empty."),
            { type: "time", days: 4 },
            { type: "resource", key: "fuel", delta: -3 },
          ],
          [
            L("You get lost in irradiated switchbacks."),
            { type: "rad", delta: 22 },
            { type: "damage", target: "random_living", amount: 22 },
            { type: "morale", target: "all_living", delta: -10 },
          ],
        ),
        ch(
          `wl${i}b`,
          "Push straight through.",
          "scavenger",
          14 + (i % 5),
          [
            L("{specialist} finds a rabbit-path between wrecks."),
            { type: "km", delta: -12 },
          ],
          [
            L("Ambush. Quick and mean."),
            { type: "damage", target: "random_living", amount: 32 },
            { type: "resource", key: "meds", delta: -3 },
            { type: "kill", target: "weakest" },
          ],
        ),
        ch(
          `wl${i}c`,
          "Camp, boil water, listen.",
          "medic",
          12,
          [
            L("{best_medic} keeps fevers down."),
            { type: "heal", target: "weakest", amount: 14 },
            { type: "time", days: 3 },
          ],
          [
            L("Quiet attracts predators anyway."),
            { type: "kill", target: "random_living" },
            { type: "resource", key: "rations", delta: -6 },
          ],
        ),
      ],
    });
  }
  return out;
}

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
          15,
          [
            L("Grease works until the next booth."),
            { type: "resource", key: "parts", delta: -6 },
            { type: "portChaos", delta: -4 },
          ],
          [
            L("They take the parts and still toss you in a pen."),
            { type: "time", days: 7 },
            { type: "damage", target: "random_living", amount: 22 },
            { type: "resource", key: "fuel", delta: -4 },
          ],
        ),
        ch(
          `ap${i}b`,
          "Sneak a maintenance tunnel.",
          "mechanic",
          16,
          [L("{best_mechanic} knows which bolts lie."), { type: "km", delta: -22 }],
          [
            L("Tripwire. Gas in the face."),
            { type: "injure", target: "random_living" },
            { type: "rad", delta: 16 },
            { type: "morale", target: "all_living", delta: -12 },
          ],
        ),
        ch(
          `ap${i}c`,
          "Signal flare: call in a favor (needs flare).",
          "negotiator",
          13,
          [
            L("A drone winks once—an escort window opens."),
            { type: "km", delta: -35 },
            { type: "portChaos", delta: -8 },
          ],
          [
            L("Wrong eyes see the flare."),
            { type: "damage", target: "all_living", amount: 14 },
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
          15,
          [
            L("{best_mechanic} rigs seals with wax and spite."),
            { type: "time", days: 5 },
          ],
          [
            L("Seals fail. Skin burns."),
            { type: "rad", delta: 32 },
            { type: "damage", target: "all_living", amount: 18 },
            { type: "resource", key: "meds", delta: -4 },
          ],
        ),
        ch(
          "sp1b",
          "March anyway.",
          "ironGut",
          14,
          [L("Guts hold. Barely."), { type: "rad", delta: 12 }],
          [
            L("Someone drops."),
            { type: "kill", target: "weakest" },
            { type: "morale", target: "all_living", delta: -18 },
          ],
        ),
      ],
    },
    {
      id: "sp-hot-cache",
      title: "Hot cache rumor",
      locations: ["abandoned_city", "industrial_strip"],
      weight: 0.55,
      body: "A trader whispers about pre-war insulin in a basement freezer farm. Could be true. Could be bait.",
      choices: [
        ch(
          "sp2a",
          "Raid fast.",
          "stalkerHunter",
          17,
          [
            L("You pull meds from the frost—and burn bridges doing it."),
            { type: "resource", key: "meds", delta: 6 },
            { type: "portChaos", delta: 6 },
          ],
          [
            L("Bait. Snipers."),
            { type: "kill", target: "random_living" },
            { type: "kill", target: "random_living" },
            { type: "damage", target: "all_living", amount: 20 },
          ],
        ),
        ch(
          "sp2b",
          "Walk away.",
          "calm",
          11,
          [L("You live with the itch of what-if.")],
          [{ type: "morale", target: "all_living", delta: -8 }],
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
          16,
          [L("They love a good story more than truth.")],
          [
            L("They search the wagons."),
            { type: "damage", target: "random_living", amount: 22 },
            { type: "resource", key: "rations", delta: -10 },
          ],
        ),
        ch(
          "sp3b",
          "Trade rations for passage.",
          "negotiator",
          12,
          [
            L("Cheap religion, expensive rice."),
            { type: "resource", key: "rations", delta: -12 },
          ],
          [
            L("They want more than rice."),
            { type: "kill", target: "random_living" },
            { type: "time", days: 4 },
          ],
        ),
      ],
    },
  ];
}

/** Location-locked heavy beats */
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
          18,
          [
            L("{specialist} times the sweep blind spots. You leave heavier than you arrived."),
            { type: "item", itemId: "c_parts", count: 4 },
            { type: "resource", key: "caps", delta: 120 },
            { type: "portChaos", delta: 10 },
          ],
          [
            L("Alarms sing. A chokepoint becomes a killing funnel."),
            { type: "kill", target: "random_living" },
            { type: "damage", target: "all_living", amount: 26 },
            { type: "resource", key: "meds", delta: -5 },
          ],
        ),
        ch(
          "lg1b",
          "Bypass electronics quietly.",
          "engineer",
          17,
          [
            L("{specialist} spoofs the panel with jury-rigged caps and shame."),
            { type: "item", itemId: "c_medkit", count: 1 },
            { type: "resource", key: "parts", delta: -2 },
          ],
          [
            L("The panel fights back. Arc flash."),
            { type: "injure", target: "random_living" },
            { type: "resource", key: "fuel", delta: -6 },
          ],
        ),
        ch(
          "lg1c",
          "Walk away from the glitter.",
          "calm",
          12,
          [L("You keep blood inside the convoy. For now.")],
          [
            L("Someone sneaks back alone anyway—and does not return."),
            { type: "kill", target: "random_living" },
            { type: "morale", target: "all_living", delta: -16 },
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
      body: "A tank farm breathes yellow vapor. Valves are either salvation or a lungful of legacy war chemistry.",
      choices: [
        ch(
          "lg2a",
          "Vent and harvest stabilizer barrels.",
          "mechanic",
          18,
          [
            L("{best_mechanic} threads the sequence. You roll out with tradeable chems."),
            { type: "resource", key: "meds", delta: 8 },
            { type: "resource", key: "fuel", delta: 10 },
          ],
          [
            L("Wrong valve. Cloud hugs the convoy."),
            { type: "damage", target: "all_living", amount: 30 },
            { type: "rad", delta: 28 },
            { type: "kill", target: "weakest" },
          ],
        ),
        ch(
          "lg2b",
          "Burn it closed with fuel you can spare.",
          "engineer",
          15,
          [
            L("Controlled burn. Ugly, loud, alive."),
            { type: "resource", key: "fuel", delta: -8 },
            { type: "portChaos", delta: 8 },
          ],
          [
            L("Fire climbs faster than fear."),
            { type: "kill", target: "random_living" },
            { type: "resource", key: "rations", delta: -10 },
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
          16,
          [
            L("Maps in dust. You pull water stills and wire."),
            { type: "resource", key: "water", delta: 14 },
            { type: "item", itemId: "c_parts", count: 2 },
          ],
          [
            L("The ceiling calendars its revenge."),
            { type: "kill", target: "random_living" },
            { type: "time", days: 6 },
          ],
        ),
        ch(
          "lg3b",
          "Collapse the entrance behind you as you leave.",
          "engineer",
          14,
          [
            L("No followers. No second chances."),
            { type: "morale", target: "all_living", delta: 6 },
          ],
          [
            L("Charges were wet. Something follows."),
            { type: "damage", target: "weakest", amount: 24 },
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
          17,
          [
            L("You buy a window measured in minutes."),
            { type: "resource", key: "caps", delta: -80 },
            { type: "resource", key: "parts", delta: -5 },
            { type: "km", delta: -30 },
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
          19,
          [
            L("Greed is predictable. The line surges the wrong direction."),
            { type: "portChaos", delta: 12 },
            { type: "km", delta: -18 },
          ],
          [
            L("They decide you are the richer convoy."),
            { type: "damage", target: "all_living", amount: 18 },
            { type: "injure", target: "random_living" },
          ],
        ),
      ],
    },
  ];
}

export const ALL_EVENTS: GameEvent[] = [
  ...wastelandBulk(),
  ...approachBulk(),
  ...specials(),
  ...locationLegends(),
  ...embarkPool(),
];
