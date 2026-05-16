/** Travel-pool events focused on earning or trading caps. */
import type { ChoiceDef, Effect, GameEvent, LocationId } from "../types";

const L = (t: string): Effect => ({ type: "appendLog", text: t });

const ROT: LocationId[] = [
  "open_waste",
  "abandoned_city",
  "industrial_strip",
  "dead_highway",
  "port_sprawl",
];

function ch(
  id: string,
  text: string,
  trait: ChoiceDef["trait"],
  basePct: number,
  ok: Effect[],
  bad: Effect[],
): ChoiceDef {
  return { id, text, trait, basePct, successEffects: ok, failureEffects: bad };
}

function travel(ev: Omit<GameEvent, "eventPool">): GameEvent {
  return { ...ev, eventPool: "travel" };
}

export const CAPS_EVENTS: GameEvent[] = [
  travel({
    id: "cap-card-game",
    title: "Roadside cards",
    body: "Refugees run a card game under a tarp. Buy-in is caps; the house is friendly until it isn't.",
    choices: [
      ch(
        "cap1a",
        "Play careful (small stake).",
        "lucky",
        50,
        [
          L("You walk away ahead."),
          { type: "resource", key: "caps", delta: 55 },
        ],
        [
          L("The deck was cold."),
          { type: "resource", key: "caps", delta: -25 },
        ],
      ),
      ch(
        "cap1b",
        "Decline and move on.",
        undefined,
        0,
        [L("No caps lost. No friends made.")],
        [],
      ),
    ],
    locations: ROT,
    weight: 0.45,
  }),
  travel({
    id: "cap-escort-job",
    title: "Escort offer",
    body: "A trader offers caps to ride alongside your convoy for two days—claims bandits target loners.",
    choices: [
      ch(
        "cap2a",
        "Accept the contract.",
        "negotiator",
        55,
        [
          L("Payment on delivery to the junction."),
          { type: "resource", key: "caps", delta: 80 },
          { type: "resource", key: "rations", delta: -4 },
        ],
        [
          L("The trader was the bait. Ambush."),
          { type: "resource", key: "caps", delta: 20 },
          { type: "injure", target: "random_living" },
        ],
      ),
      ch(
        "cap2b",
        "Refuse.",
        undefined,
        0,
        [L("You keep your pace.")],
        [],
      ),
    ],
    weight: 0.4,
  }),
  travel({
    id: "cap-sell-scrap",
    title: "Scrap buyer",
    body: "A buyer with a portable scale waves you down. They pay caps for clean metal and intact electronics.",
    choices: [
      ch(
        "cap3a",
        "Sell spare parts.",
        "negotiator",
        60,
        [
          L("Fair weight, fair price."),
          { type: "resource", key: "parts", delta: -4 },
          { type: "resource", key: "caps", delta: 70 },
        ],
        [
          L("They short the weight."),
          { type: "resource", key: "parts", delta: -4 },
          { type: "resource", key: "caps", delta: 35 },
        ],
      ),
      ch(
        "cap3b",
        "Keep the parts.",
        undefined,
        0,
        [L("Metal stays with the convoy.")],
        [],
      ),
    ],
    locations: ROT,
    weight: 0.42,
  }),
  travel({
    id: "cap-bounty-board",
    title: "Bounty notice",
    body: "A nailed board lists faces and cap rewards. One name matches someone you saw two days back.",
    choices: [
      ch(
        "cap4a",
        "Track and turn them in.",
        "stalkerHunter",
        40,
        [
          L("Reward collected at the next checkpoint."),
          { type: "resource", key: "caps", delta: 95 },
          { type: "portChaos", delta: 5 },
        ],
        [
          L("Wrong person. Almost cost you."),
          { type: "morale", target: "all_living", delta: -8 },
        ],
      ),
      ch(
        "cap4b",
        "Tear the notice down.",
        undefined,
        0,
        [L("Not your problem.")],
        [],
      ),
    ],
    locations: ["port_sprawl", "dead_highway"],
    weight: 0.35,
  }),
  travel({
    id: "cap-heirloom",
    title: "Family heirloom",
    body: "A widow offers caps for safe passage to the port. She carries a sealed locket—won't say what's inside.",
    choices: [
      ch(
        "cap5a",
        "Escort her.",
        "calm",
        55,
        [
          L("She pays at the arcology fringe."),
          { type: "resource", key: "caps", delta: 65 },
          { type: "time", days: 2 },
        ],
        [
          L("Bandits target the wagon. She survives; you bleed caps on meds."),
          { type: "resource", key: "caps", delta: 25 },
          { type: "resource", key: "meds", delta: -2 },
        ],
      ),
    ],
    weight: 0.38,
  }),
  travel({
    id: "cap-cache-caps",
    kind: "ambient",
    title: "Buried strongbox",
    body: "{randomLiving} kicks a rusted strongbox half-buried in a culvert. Combination still spins.",
    ambientEffects: [
      L("Pre-war caps, still honored in the sprawl."),
      { type: "resource", key: "caps", delta: 60 },
    ],
    locations: ROT,
    weight: 0.4,
  }),
  travel({
    id: "cap-gift-trader",
    title: "Grateful trader",
    body: "You shared water with a stranded trader last week—they remember. Today they flag you down with a pouch.",
    requiresFlag: "shared_water_trader",
    choices: [
      ch(
        "cap6a",
        "Accept thanks.",
        undefined,
        0,
        [
          L("Caps and a personal charm."),
          { type: "resource", key: "caps", delta: 50 },
          { type: "grantPersonal", itemId: "pi_dog_tags_charm", target: "random_living" },
        ],
        [],
      ),
    ],
    weight: 0.5,
  }),
  travel({
    id: "cap-share-water",
    title: "Stranded merchant",
    body: "A merchant's cart is axle-deep in silt. Their water is gone; yours isn't.",
    choices: [
      ch(
        "cap7a",
        "Share water.",
        undefined,
        0,
        [
          L("They promise to remember."),
          { type: "resource", key: "water", delta: -4 },
          { type: "flag", key: "shared_water_trader", value: true },
          { type: "morale", target: "all_living", delta: 5 },
        ],
        [],
      ),
      ch(
        "cap7b",
        "Trade water for caps now.",
        "negotiator",
        50,
        [
          L("Immediate payment."),
          { type: "resource", key: "water", delta: -3 },
          { type: "resource", key: "caps", delta: 40 },
        ],
        [
          L("They haggle ugly."),
          { type: "resource", key: "water", delta: -3 },
          { type: "resource", key: "caps", delta: 15 },
        ],
      ),
    ],
    locations: ROT,
    weight: 0.44,
  }),
  travel({
    id: "cap-sell-rations",
    title: "Hungry checkpoint",
    body: "Guards at a pop-up checkpoint buy rations at inflated cap prices—illegal, but they're hungry.",
    choices: [
      ch(
        "cap8a",
        "Sell a crate.",
        "negotiator",
        55,
        [
          L("Caps change hands under a tarp."),
          { type: "resource", key: "rations", delta: -8 },
          { type: "resource", key: "caps", delta: 85 },
        ],
        [
          L("Confiscated. Fined anyway."),
          { type: "resource", key: "rations", delta: -8 },
          { type: "resource", key: "caps", delta: -20 },
        ],
      ),
    ],
    locations: ["port_sprawl", "dead_highway"],
    weight: 0.36,
  }),
  travel({
    id: "cap-armour-sale",
    title: "Armour peddler",
    body: "A peddler unrolls vests from a dead convoy. One still fits. Price is caps, not conversation.",
    choices: [
      ch(
        "cap9a",
        "Buy a vest for {randomLiving}.",
        undefined,
        0,
        [
          L("Caps spent; vest assigned."),
          { type: "resource", key: "caps", delta: -55 },
          { type: "grantPersonal", itemId: "pi_armour_vest", target: "random_living" },
        ],
        [],
      ),
      ch(
        "cap9b",
        "Haggle down.",
        "negotiator",
        45,
        [
          L("Better price."),
          { type: "resource", key: "caps", delta: -40 },
          { type: "grantPersonal", itemId: "pi_armour_vest", target: "random_living" },
        ],
        [L("He walks. No deal.")],
      ),
    ],
    weight: 0.32,
  }),
];
