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
 *     id: "my-event-id",              ← must be globally unique
 *     title: "Something happens",
 *     body: "{randomLiving} spots movement on the ridge.",
 *     locations: ["open_waste"],      ← omit for any location
 *     weight: 1.0,                    ← relative frequency (default 1.0)
 *     choices: [
 *       ch("fight",   "Fight them off",   45, [ok effects...], [fail effects...]),
 *       ch("retreat", "Pull back",        undefined, [guaranteed...], []),
 *     ],
 *   })
 *
 * AMBIENT EVENT (no player choice, auto-resolves on Continue)
 * ─────────────────────────────────────────────────────────────
 *   ambient("id", "Title", "Body text.", [effects...], locations?, weight?)
 *
 * SPECIALTY CHECK
 * ───────────────
 * Add checkType to ch() to apply the relevant specialist's bonus:
 *   ch("hack", "Hack the console", 40, ok, bad, undefined, undefined, "repair")
 *
 *   checkType values:
 *     "combat"    → fighting, brawling, force
 *     "medical"   → healing, triage, sickness
 *     "scavenge"  → searching, looting, finding resources
 *     "repair"    → vehicles, machines, electronics
 *     "negotiate" → trade, diplomacy, persuasion
 *     "stealth"   → sneaking, infiltration, recon
 *
 * NAMED MEMBER SLOTS (member picker system)
 * ─────────────────────────────────────────
 * Slots let you "hold" a reference to one party member across multiple effects.
 *
 * 1. Declare slots on the event:
 *      memberSlots: [slot("point", "Who takes point?", "player_choice")]
 *
 * 2. Reference the slot in text:
 *      body: "{slot:point} goes ahead while the rest wait."
 *
 * 3. Attach the slot to a choice so clicking it shows the member picker first:
 *      ch("send", "Send someone ahead", 55, ok, bad,
 *         undefined, undefined, "stealth", "point")  ← fillsSlot
 *
 * 4. Target effects at the slot member:
 *      { type: "damage",  target: { slot: "point" }, amount: 20 }
 *      { type: "injure",  target: { slot: "point" } }
 *
 * 5. Auto-fill slots (assigned at event start, no player choice):
 *      memberSlots: [slot("scout", "Who scouts?", "random_living")]
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * BASE PERCENT GUIDE
 *   70%+ = generous   55% = fair   40% = tough   25% = brutal
 *
 * Keep in mind: specialty bonuses add 10–25% on top. A "40%" check with the
 * right specialist in the party effectively becomes a 55–65% check.
 *
 * EFFECT QUICK REFERENCE
 *   { type: "resource",    key: "rations", delta: -8 }
 *   { type: "damage",      target: "random_living", amount: 25 }
 *   { type: "damage",      target: { slot: "point" }, amount: 25 }
 *   { type: "damage",      target: "all_living", amount: 12 }
 *   { type: "injure",      target: "weakest" }
 *   { type: "injure",      target: { slot: "infiltrator" } }
 *   { type: "kill",        target: "random_living" }   ← use very sparingly
 *   { type: "sicken",      target: "random_living", sickness: "Gut fever", days: 7 }
 *   { type: "rad",         delta: 20 }
 *   { type: "morale",      target: "all_living", delta: -10 }
 *   { type: "heal",        target: "weakest", amount: 15 }
 *   { type: "km",          delta: -18 }     ← negative = progress toward port
 *   { type: "time",        days: 4 }        ← burns departure calendar
 *   { type: "portChaos",   delta: 8 }       ← complicates embarkation
 *   { type: "transport",   delta: -5 }      ← damages convoy (0 = breakdown/loss)
 *   { type: "flag",        key: "met_trader", value: true }
 *   { type: "fillSlot",    slot: "scout", how: "random_living" }
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { CheckType, ChoiceDef, Effect, GameEvent, LocationId, MemberSlot } from "../types";
import { CAPS_EVENTS } from "./capsEvents";

// ── Shorthand effect builders ─────────────────────────────────────────────────

/** Appends a line to the run log. */
const L = (t: string): Effect => ({ type: "appendLog", text: t });

/** All non-port, non-embark locations — used when an event can fire anywhere. */
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
 * @param basePct     0–100 success %. Omit (undefined) for guaranteed success.
 * @param ok          Effects on success.
 * @param bad         Effects on failure.
 * @param always      Effects always applied regardless of outcome.
 * @param requiredItem  itemId that must be in inventory, or undefined.
 * @param checkType   CheckType that gives the relevant specialty a bonus.
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
 * @param label Shown in member picker, e.g. "Who scouts ahead?".
 * @param how   "player_choice" | "random_living" | "weakest"
 */
function slot(key: string, label: string, how: MemberSlot["how"] = "player_choice"): MemberSlot {
  return { key, label, how };
}

/**
 * Build a full choice-style GameEvent.
 * Only id, title, body, and choices are required.
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

/**
 * Build an ambient GameEvent (auto-resolves, no player choice).
 * Default weight 0.5 — quieter than choice events.
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
// Small, fast-resolving events. Low weight — they fill gaps between real events.
// Good for world-building, minor resource swings, and morale colour.

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
      [L("Man, gas prices these days..."), { type: "resource", key: "fuel", delta: 6 }],
      ["dead_highway", "industrial_strip"],
      0.45,
    ),
    ambient(
      "amb-found-meds",
      "Aid station remnants",
      "{randomLiving} finds a collapsed field aid post. Most supplies rotted, but a sealed pouch is intact.",
      [L("Medical supplies salvaged."), { type: "resource", key: "meds", delta: 2 }],
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
      0.35, // Reduced from 0.4 — already covered by wasteland events
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
        { type: "transport", delta: -5 },
        { type: "resource", key: "parts", delta: -2 },
      ],
      ROT,
      0.4,
    ),
    ambient(
      "amb-salvage-caps",
      "Looted register",
      "{randomLiving} searches a dead body. Finds caps somehow. Always loot your bodies.",
      [L("Caps recovered."), { type: "resource", key: "caps", delta: 40 }],
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
      0.28, // Slightly lower — sickness is punishing, ambient death should be rarer
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
      0.28,
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
    // New ambient events added for variety
    ambient(
      "amb-clean-spring",
      "Flowing spring",
      "{randomLiving} spots something impossible: a clean spring just off the highway. They fill every container twice.",
      [
        L("Morale skyrockets. Water does that."),
        { type: "morale", target: "all_living", delta: 16 },
        { type: "resource", key: "rations", delta: 6 },
      ],
      ["open_waste"],
      0.22, // Rare — this is a genuinely lucky find
    ),
    ambient(
      "amb-ghost-broadcast",
      "Ghost broadcast",
      "{randomLiving} catches a few words on the radio — coordinates, a voice, then static. When they try to find it again it's gone.",
      [
        L("Nothing actionable. But morale ticks from the reminder that someone is still out there, broadcasting."),
        { type: "morale", target: "all_living", delta: 6 },
      ],
      ROT,
      0.32,
    ),
    ambient(
      "amb-empty-settlement",
      "Abandoned town",
      "A whole town, intact, empty. Not ruined — just empty. No bodies. No signs of violence. The calendar on the wall reads four years ago.",
      [
        L("You grab what's near the entrance and leave fast. Questions unanswered."),
        { type: "resource", key: "rations", delta: 8 },
        { type: "morale", target: "all_living", delta: -5 },
      ],
      ["abandoned_city", "dead_highway"],
      0.28,
    ),
    ambient(
      "amb-found-caps-culvert",
      "Buried strongbox",
      "{randomLiving} kicks a rusted strongbox half-buried in a culvert. Combination still spins.",
      [L("Pre-war caps, still honored in the sprawl."), { type: "resource", key: "caps", delta: 65 }],
      ROT,
      0.35,
    ),
  ];
}

// ── Sickness events ───────────────────────────────────────────────────────────
// These fire from the travel pool and introduce sick mechanics.
// Sickness kills if not treated by rest + 2 meds before the timer hits 0.
// Keep days high enough (6+) that players have a fighting chance to treat.

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
            { type: "sicken", target: "random_living", sickness: "Rat fever", days: 7 },
          ],
        ),
        ch(
          "srs-b",
          "EAT IT! BE A MAN.",
          undefined,
          [
            // Guaranteed bad — this choice exists to punish overconfidence
            L("The party eats and waits. Nobody feels great."),
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
          "Keep going. They will surely be fine.",
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
            { type: "resource", key: "caps", delta: 50 },
            { type: "morale", target: "all_living", delta: 10 },
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
    // Sickness event you can add more of here — same format as above.
    {
      id: "sick-contaminated-water",
      title: "Tainted water source",
      locations: ["open_waste", "abandoned_city"],
      weight: 0.33,
      body: "{randomLiving} notices the water supply smells off. Someone's already been drinking from it.",
      choices: [
        ch(
          "stw-a",
          "Purify it and use it carefully.",
          55,
          [
            L("Boiling kills most of what was in there. Probably."),
            { type: "resource", key: "rations", delta: 4 },
            { type: "time", days: 1 },
          ],
          [
            L("Not quite purified enough. Someone gets it."),
            { type: "sicken", target: "random_living", sickness: "Gut sickness", days: 6 },
            { type: "time", days: 1 },
          ],
          undefined, undefined, "medical",
        ),
        ch(
          "stw-b",
          "Dump it and move on.",
          undefined,
          [L("The right call. Boring but correct.")],
          [],
        ),
      ],
    },
  ];
}

// ── Embark pool ───────────────────────────────────────────────────────────────
// Fires once km reaches 0. The party must survive N embark events to board.
// These escalate in difficulty. Keep the momentum tense — port chaos rises fast.

function embarkPool(): GameEvent[] {
  // Each embark event is a unique scenario in the crush of the port.
  // 14 slots: the player must clear all of them to board.
  const titles = [
    "Credential booth",
    "Rad screening",
    "Faction shakedown",
    "Medical triage",
    "Cargo lottery",
    "Stampede rumor",
    "Final stairwell",
  ];

  const bodies = [
    "Floodlights and shouting marshals. {randomLiving} is singled out in the crush. Papers shake. Clocks do not care.",
    "A med-scanner flags the convoy for secondary testing. The tech looks at {randomLiving} with something that is definitely not sympathy.",
    "A faction checkpoint materialises out of nowhere, demanding tribute. {randomLiving} counts exit options. There aren't many.",
    "Triage staff are pulling people from the line for 'medical holds'. {randomLiving} looks healthy enough — for now.",
    "A lottery system decides who boards next. {randomLiving} has to argue your way past the clipboard. The numbers don't add up.",
    "Word spreads of a stampede two gates over. {randomLiving} watches the crowd for which way it'll shift.",
    "The final stairwell is packed. One guard, one log, and a thousand people with the same destination as you.",
  ];

  const out: GameEvent[] = [];
  for (let i = 0; i < 14; i++) {
    // Escalation: choices get harder after embark event 3 and again after 8
    const escalation = Math.max(0, Math.floor(i / 3));
    const t = titles[i % titles.length];
    const b = bodies[i % bodies.length];

    out.push({
      id: `emb-${i}`,
      title: `${t} (${i + 1})`,
      locations: ["embark"],
      weight: 1.1,
      body: b,
      choices: [
        ch(
          `e${i}a`,
          "Talk your way through.",
          // Gets harder each escalation tier
          Math.max(20, 55 - escalation * 5),
          [L("You bluff the queue into coherence."), { type: "portChaos", delta: -4 }],
          [
            L("Wrong line. A baton finds ribs."),
            { type: "damage", target: "random_living", amount: 18 },
            { type: "injure", target: "random_living" },
            { type: "portChaos", delta: 8 },
            { type: "time", days: 3 },
          ],
          undefined, undefined, "negotiate",
        ),
        ch(
          `e${i}b`,
          "Hold formation — tight, quiet, fast.",
          Math.max(20, 48 - escalation * 5),
          [L("You slide through a gap that only existed for seconds.")],
          [
            L("Panic wins. Someone goes down."),
            { type: "injure", target: "weakest" },
            { type: "morale", target: "all_living", delta: -14 },
            { type: "time", days: 4 },
          ],
          undefined, undefined, "stealth",
        ),
        ch(
          `e${i}c`,
          // The risky forgery option — requires the item and still has low odds
          "Forge a stamp (risky — needs forge kit).",
          22,
          [
            L("The laminate gleams just enough. A bored clerk waves you on."),
            { type: "flag", key: "forge_kit_used", value: true },
            { type: "portChaos", delta: -6 },
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

// ── Wasteland events ──────────────────────────────────────────────────────────
// Hand-crafted events spread across all non-port, non-embark locations.
// These replace generic template-generated events with real scenarios.
//
// HOW TO ADD MORE:
//   Add a new event() or ambient() call inside the array below.
//   Keep id strings unique (prefix "we-" for wasteland events).
//   Set locations: ROT for "anywhere" or specific zones.
//   Weight 0.6–1.0 for common events, 0.35–0.55 for rarer ones.

function wastelandEvents(): GameEvent[] {
  return [
    // ── Road hazards / travel decisions ───────────────────────────────────────

    event({
      id: "we-toll-booth",
      title: "Roadside toll",
      locations: ROT,
      weight: 0.95,
      body: "A rusted barrier across the road. Three armed people behind it. A sign reads: TOLL — 30 CAPS OR 10 RATIONS. Neither amount is negotiable. Apparently.",
      choices: [
        ch("wb-pay", "Pay the toll (30 caps).", undefined,
          [L("You pay. They lift the barrier without a word. Worth it."), { type: "resource", key: "caps", delta: -30 }],
          [],
        ),
        ch("wb-food", "Pay in rations instead.", undefined,
          [L("Food changes hands. Road opens."), { type: "resource", key: "rations", delta: -10 }],
          [],
        ),
        ch("wb-bluff", "Talk your way out of it.", 45,
          [L("You cite a nonexistent regulation. They buy it somehow."), { type: "morale", target: "all_living", delta: 6 }],
          [L("They call the bluff. Costs more now."), { type: "resource", key: "caps", delta: -50 }, { type: "morale", target: "all_living", delta: -6 }],
          undefined, undefined, "negotiate",
        ),
        ch("wb-ram", "Ram through the barrier.", 40,
          [L("The barrier splinters. You're through. Probably fine."), { type: "transport", delta: -4 }],
          [L("They shoot the engine block. Parts and pride lost."), { type: "resource", key: "parts", delta: -3 }, { type: "transport", delta: -10 }, { type: "damage", target: "random_living", amount: 14 }],
          undefined, undefined, "combat",
        ),
      ],
    }),

    event({
      id: "we-bridge",
      title: "Questionable bridge",
      locations: ["open_waste", "dead_highway"],
      weight: 0.8,
      body: "The only crossing. Cables look wrong. The concrete is cracked and has a hand-painted sign: WARNING — USE AT OWN RISK. Encouraging.",
      choices: [
        ch("webr-a", "Cross carefully — slow and steady.", 60,
          [L("Took forever. Made it. Morale is technically up."), { type: "time", days: 1 }, { type: "morale", target: "all_living", delta: 5 }],
          [L("The middle section decides it's done. Parts and time lost."), { type: "transport", delta: -12 }, { type: "resource", key: "parts", delta: -4 }, { type: "time", days: 2 }],
          undefined, undefined, "repair",
        ),
        ch("webr-b", "Gun it across.", 45,
          [L("Speed over safety. It works this time."), { type: "morale", target: "all_living", delta: 8 }],
          [L("{randomLiving} screams. Something buckles."), { type: "damage", target: "random_living", amount: 22 }, { type: "transport", delta: -8 }, { type: "time", days: 3 }],
        ),
        ch("webr-c", "Find another route.", undefined,
          [L("Two hours gone. Bridge survived without you."), { type: "time", days: 2 }, { type: "resource", key: "fuel", delta: -2 }],
          [],
        ),
      ],
    }),

    event({
      id: "we-overpass",
      title: "Collapsed overpass",
      locations: ["dead_highway", "abandoned_city"],
      weight: 0.75,
      body: "Forty tonnes of concrete has given up and taken the road with it. The detour adds hours. OR {randomLiving} could look for a gap. Note: {randomLiving} is not a structural engineer.",
      choices: [
        ch("weop-a", "Take the long way around.", undefined,
          [L("Safe. Boring. Correct."), { type: "time", days: 2 }, { type: "resource", key: "fuel", delta: -3 }],
          [],
        ),
        ch("weop-b", "Find a gap and push through.", 50,
          [L("{randomLiving} navigates the ruins. The convoy squeezes through."), { type: "morale", target: "all_living", delta: 7 }, { type: "km", delta: -6 }],
          [L("Not as much gap as it looked. Bodywork damage."), { type: "resource", key: "parts", delta: -5 }, { type: "transport", delta: -8 }],
          undefined, undefined, "repair",
        ),
        ch("weop-c", "Clear a path and grab parts from the rubble.", 40,
          [L("Hard work. Worth it."), { type: "resource", key: "parts", delta: 4 }, { type: "km", delta: -5 }, { type: "time", days: 1 }],
          [L("A block shifts. The cleared path becomes less cleared."), { type: "injure", target: "random_living" }, { type: "time", days: 2 }],
          undefined, undefined, "repair",
        ),
      ],
    }),

    event({
      id: "we-gas-station",
      title: "Last petrol stand",
      locations: ["open_waste", "dead_highway"],
      weight: 0.7,
      body: "A functioning gas station. Hand-painted prices. The attendant waves a shotgun in greeting — don't read too much into it, that's just how he says hello.",
      choices: [
        ch("wegs-a", "Buy fuel at posted price.", undefined,
          [L("Expensive. The convoy moves. He reloads the shotgun as you leave. Still just hello."), { type: "resource", key: "fuel", delta: 20 }, { type: "resource", key: "caps", delta: -90 }],
          [],
        ),
        ch("wegs-b", "Haggle the price down.", 45,
          [L("He respects the negotiation. Twenty percent off."), { type: "resource", key: "fuel", delta: 20 }, { type: "resource", key: "caps", delta: -72 }],
          [L("He does not respect the negotiation. Standard price plus insult tax."), { type: "resource", key: "fuel", delta: 20 }, { type: "resource", key: "caps", delta: -115 }],
          undefined, undefined, "negotiate",
        ),
        ch("wegs-c", "Check if there's anything out back.", 50,
          [L("{randomLiving} finds two unlocked jerrycans. The attendant didn't notice."), { type: "resource", key: "fuel", delta: 14 }, { type: "morale", target: "all_living", delta: 5 }],
          [L("He noticed. Shotgun was not just hello."), { type: "damage", target: "random_living", amount: 18 }, { type: "resource", key: "caps", delta: -40 }],
          undefined, undefined, "stealth",
        ),
      ],
    }),

    // ── Encounters with people ────────────────────────────────────────────────

    event({
      id: "we-highway-kings",
      title: "Highway kings",
      locations: ["dead_highway", "industrial_strip"],
      weight: 0.85,
      body: "Three chromed bikes form a wall across the road. The riders dismount slow — deliberate. 'This is our road now,' says the one with the megaphone. 'Was' is doing a lot of work in that sentence.",
      choices: [
        ch("wehw-a", "Negotiate a passage fee.", 55,
          [L("They settle for a reasonable amount. Caps flow; road opens."), { type: "resource", key: "caps", delta: -55 }, { type: "morale", target: "all_living", delta: 3 }],
          [L("They want everything. You barely escape with your people."), { type: "resource", key: "caps", delta: -80 }, { type: "resource", key: "rations", delta: -10 }, { type: "injure", target: "random_living" }],
          undefined, undefined, "negotiate",
        ),
        ch("wehw-b", "Hit the gas and scatter them.", 45,
          [L("The lead bike clips the grille. The others scatter. Exhilarating and stupid."), { type: "resource", key: "fuel", delta: -3 }, { type: "transport", delta: -5 }, { type: "morale", target: "all_living", delta: 10 }],
          [L("They were ready for that. Gunfire. {randomLiving} catches a round."), { type: "damage", target: "random_living", amount: 28 }, { type: "injure", target: "random_living" }, { type: "resource", key: "meds", delta: -2 }],
          undefined, undefined, "combat",
        ),
        ch("wehw-c", "Pay the fuel toll instead.", undefined,
          [L("Practical people. Fuel for passage. The math works."), { type: "resource", key: "fuel", delta: -6 }],
          [],
        ),
      ],
    }),

    event({
      id: "we-night-ambush",
      title: "Night ambush",
      locations: ROT,
      weight: 0.8,
      body: "Camp fires lit. {randomLiving} is on watch when movement in the dark starts getting closer. A lot of movement.",
      choices: [
        ch("wena-a", "Wake everyone and fight.", 50,
          [L("They expected a sleeping convoy. They get a furious one instead. Caps recovered."), { type: "resource", key: "caps", delta: 50 }, { type: "morale", target: "all_living", delta: 10 }],
          [L("Outnumbered in the dark. {randomLiving} takes the worst of it."), { type: "damage", target: "random_living", amount: 30 }, { type: "injure", target: "weakest" }, { type: "resource", key: "meds", delta: -2 }],
          undefined, undefined, "combat",
        ),
        ch("wena-b", "Kill the fires and go silent.", 60,
          [L("They sweep through an empty camp. You were already gone."), { type: "resource", key: "fuel", delta: -2 }, { type: "morale", target: "all_living", delta: 5 }],
          [L("They see you. Running in the dark costs everyone."), { type: "damage", target: "random_living", amount: 16 }, { type: "time", days: 1 }, { type: "resource", key: "parts", delta: -2 }],
          undefined, undefined, "stealth",
        ),
        ch("wena-c", "Bribe them to leave.", 40,
          [L("Enough caps to make them think twice. They go."), { type: "resource", key: "caps", delta: -65 }],
          [L("They take the caps and don't leave. Then take more."), { type: "resource", key: "caps", delta: -90 }, { type: "resource", key: "rations", delta: -8 }, { type: "injure", target: "random_living" }],
          undefined, undefined, "negotiate",
        ),
      ],
    }),

    event({
      id: "we-crying-child",
      title: "Roadside figure",
      locations: ROT,
      weight: 0.55,
      body: "A small figure stands alone next to a dead vehicle. Not moving. Not waving. Just watching. {randomLiving} has a bad feeling about this.",
      choices: [
        ch("wecc-a", "Stop and help.", 50,
          [L("An actual child. Lost family. You leave them at the next settlement and feel okay about it."), { type: "resource", key: "rations", delta: -4 }, { type: "morale", target: "all_living", delta: 14 }],
          [L("Trap. Adults with weapons. You escape, but not cleanly."), { type: "damage", target: "random_living", amount: 20 }, { type: "resource", key: "rations", delta: -8 }, { type: "resource", key: "caps", delta: -30 }],
          undefined, undefined, "negotiate",
        ),
        ch("wecc-b", "Scout from a distance first.", 65,
          [L("{randomLiving} circles around. It's just a kid. You take them in."), { type: "resource", key: "rations", delta: -3 }, { type: "morale", target: "all_living", delta: 12 }],
          [L("The scout is spotted, blowing the ambush early. You scatter."), { type: "resource", key: "fuel", delta: -3 }, { type: "morale", target: "all_living", delta: -5 }],
          undefined, undefined, "stealth",
        ),
        ch("wecc-c", "Drive past. You have your own problems.", undefined,
          [L("You drive past. No one says anything for a while."), { type: "morale", target: "all_living", delta: -10 }],
          [],
        ),
      ],
    }),

    event({
      id: "we-stranded-convoy",
      title: "Stranded convoy",
      locations: ROT,
      weight: 0.65,
      body: "A loaded convoy sits dead on the shoulder. Driver waves you down. Engine failure — they have parts but not know-how. Or so they say.",
      choices: [
        ch("wesc-a", "Help them fix it.", 55,
          [L("{randomLiving} diagnoses the issue fast. They pay in fuel and rations. Good humans exist."), { type: "resource", key: "fuel", delta: 7 }, { type: "resource", key: "rations", delta: 9 }, { type: "morale", target: "all_living", delta: 8 }],
          [L("They were signaling someone. Ambush."), { type: "injure", target: "random_living" }, { type: "resource", key: "parts", delta: -3 }, { type: "time", days: 2 }],
          undefined, undefined, "repair",
        ),
        ch("wesc-b", "Sell them the parts they need.", undefined,
          [L("Good price. Business in the wasteland."), { type: "resource", key: "parts", delta: -3 }, { type: "resource", key: "caps", delta: 60 }],
          [],
        ),
        ch("wesc-c", "Don't stop.", undefined,
          [L("Not your problem."), { type: "morale", target: "all_living", delta: -5 }],
          [],
        ),
      ],
    }),

    // Faction checkpoint — uses forge kit if available
    event({
      id: "we-faction-checkpoint",
      title: "Faction checkpoint",
      locations: ["dead_highway", "port_sprawl", "industrial_strip"],
      weight: 0.9,
      body: "Armed uniforms. Not raiders — organized, patched, and bored. They flag you down. Compliance is expected. Arguing is an option, technically.",
      choices: [
        ch("wefc-a", "Show papers and comply.", 60,
          [L("Papers checked. Convoy waved through. Authority functions as intended."), { type: "time", days: 1 }],
          [L("The paperwork is incomplete. A fee is invented."), { type: "resource", key: "caps", delta: -45 }, { type: "time", days: 2 }],
        ),
        ch("wefc-b", "Bribe the inspector.", 55,
          [L("Caps speak louder than regulations. Surprise."), { type: "resource", key: "caps", delta: -40 }],
          [L("Wrong inspector — this one's clean. They flag you for suspicion."), { type: "resource", key: "caps", delta: -40 }, { type: "portChaos", delta: 8 }, { type: "time", days: 2 }],
          undefined, undefined, "negotiate",
        ),
        ch("wefc-c", "Use the forge kit.", 65,
          [L("Freshly laminated credentials. He barely glances at them."), { type: "portChaos", delta: -5 }],
          [L("He's seen that laminate before. Detention tent."), { type: "time", days: 3 }, { type: "portChaos", delta: 12 }, { type: "morale", target: "all_living", delta: -10 }],
          undefined, "u_forge_kit", "negotiate",
        ),
      ],
    }),

    event({
      id: "we-mutant",
      title: "Glowing traveller",
      locations: ["industrial_strip", "open_waste"],
      weight: 0.42,
      body: "Someone tries to flag you down. They're glowing slightly. Not metaphorically — actual rad-induced bioluminescence. Their smile is genuine enough.",
      choices: [
        ch("wemt-a", "Stop and trade.", 55,
          [L("Friendly, lucid, and carrying useful things. You leave with supplies and an unsettling memory."), { type: "resource", key: "meds", delta: 3 }, { type: "resource", key: "parts", delta: 2 }, { type: "resource", key: "caps", delta: -20 }],
          [L("The friendliness evaporates when you lowball them. Rad exposure in the argument."), { type: "rad", delta: 12 }, { type: "morale", target: "all_living", delta: -8 }],
          undefined, undefined, "negotiate",
        ),
        ch("wemt-b", "Help them medically.", 50,
          [L("You stabilize what's happening to them. They give you everything they have."), { type: "resource", key: "meds", delta: -2 }, { type: "resource", key: "caps", delta: 70 }, { type: "morale", target: "all_living", delta: 12 }],
          [L("Their biology is beyond normal triage. Rad exposure for the medic."), { type: "rad", delta: 8 }, { type: "resource", key: "meds", delta: -2 }, { type: "injure", target: "weakest" }],
          undefined, undefined, "medical",
        ),
        ch("wemt-c", "Keep moving.", undefined,
          [L("They glow smaller in the mirror."), { type: "morale", target: "all_living", delta: -5 }],
          [],
        ),
      ],
    }),

    event({
      id: "we-propaganda",
      title: "Faction broadcast",
      locations: ["dead_highway", "port_sprawl"],
      weight: 0.45,
      body: "A truck with a roof-mounted speaker rolling slowly down the highway, broadcasting faction slogans on loop. Very loud. {randomLiving} counts how many times the word 'glorious' gets used. Fourteen.",
      choices: [
        ch("wepb-a", "Disable the truck's broadcast.", 45,
          [L("{randomLiving} shorts the speaker. Blissful silence. Also now the faction knows."), { type: "morale", target: "all_living", delta: 10 }, { type: "portChaos", delta: 8 }],
          [L("The speaker fights back — arc flash. Still being broadcast at."), { type: "damage", target: "random_living", amount: 12 }, { type: "morale", target: "all_living", delta: -6 }],
          undefined, undefined, "repair",
        ),
        ch("wepb-b", "Cheer along ironically.", undefined,
          [L("You drive alongside yelling 'GLORIOUS' every time the truck does. Morale is technically up."), { type: "morale", target: "all_living", delta: 7 }],
          [],
        ),
        ch("wepb-c", "Overtake and ignore it.", undefined,
          [L("Gone in two minutes. Time well spent."), { type: "resource", key: "fuel", delta: -1 }],
          [],
        ),
      ],
    }),

    // ── Scavenge opportunities ────────────────────────────────────────────────

    event({
      id: "we-crash-site",
      title: "Fresh crash site",
      locations: ROT,
      weight: 0.65,
      body: "Smoke still rising. A convoy vehicle came to rest across a ditch. Supplies are spilling out. Survivors might still be inside.",
      choices: [
        ch("wecs-a", "Search for survivors first.", 55,
          [L("One alive. Badly hurt. You patch them up and take their fuel."), { type: "resource", key: "meds", delta: -2 }, { type: "resource", key: "fuel", delta: 10 }, { type: "morale", target: "all_living", delta: 8 }],
          [L("Nobody left. You still get the supplies but nobody feels great."), { type: "resource", key: "rations", delta: 8 }, { type: "morale", target: "all_living", delta: -7 }],
          undefined, undefined, "medical",
        ),
        ch("wecs-b", "Grab what you can and go.", undefined,
          [L("Pragmatic. The supplies are claimed. So is the guilt."), { type: "resource", key: "rations", delta: 10 }, { type: "resource", key: "parts", delta: 3 }, { type: "morale", target: "all_living", delta: -9 }],
          [],
        ),
        ch("wecs-c", "Check if it's a trap first.", 60,
          [L("{randomLiving} circles the wreck. You move in safely."), { type: "resource", key: "rations", delta: 8 }, { type: "resource", key: "fuel", delta: 6 }, { type: "morale", target: "all_living", delta: 3 }],
          [L("It IS a trap. Well spotted, badly timed."), { type: "damage", target: "random_living", amount: 20 }, { type: "injure", target: "random_living" }],
          undefined, undefined, "stealth",
        ),
      ],
    }),

    event({
      id: "we-underground-market",
      title: "Black market crawl",
      locations: ["abandoned_city", "industrial_strip"],
      weight: 0.55,
      body: "{randomLiving} finds a chalk arrow on a wall — the wasteland's review system. Follows it three blocks to a basement market. Everything is for sale. Some of it might even be real.",
      choices: [
        ch("weum-a", "Shop carefully.", 60,
          [L("Good deals. Fuel and meds from someone who doesn't want to be taxed."), { type: "resource", key: "fuel", delta: 9 }, { type: "resource", key: "meds", delta: 3 }, { type: "resource", key: "caps", delta: -65 }],
          [L("The 'meds' are chalk. The fuel is diluted. Lesson learned."), { type: "resource", key: "caps", delta: -65 }, { type: "morale", target: "all_living", delta: -8 }],
          undefined, undefined, "negotiate",
        ),
        ch("weum-b", "Just browse and leave.", undefined,
          [L("Window shopping in the apocalypse. Nothing spent, nothing gained."), { type: "morale", target: "all_living", delta: 3 }],
          [],
        ),
      ],
    }),

    // ── Environmental / atmospheric ───────────────────────────────────────────

    event({
      id: "we-sandstorm-shelter",
      title: "Sandstorm shelter",
      locations: ["open_waste", "industrial_strip"],
      weight: 0.72,
      body: "A brown wall of grit rises to the west. You and another group reach the same abandoned overpass at the same time. Not enough space for two convoys. Awkward.",
      choices: [
        ch("wess-a", "Share the space — keep to your side.", 60,
          [L("Tense hours. Nobody starts anything. When the storm passes, you nod and part. Civilisation."), { type: "time", days: 2 }],
          [L("Things get heated around midnight. Someone swings first."), { type: "damage", target: "random_living", amount: 16 }, { type: "resource", key: "rations", delta: -5 }, { type: "time", days: 2 }],
          undefined, undefined, "negotiate",
        ),
        ch("wess-b", "Claim the shelter — push them out.", 45,
          [L("They back down. You have shelter, they have grievances."), { type: "portChaos", delta: 4 }, { type: "morale", target: "all_living", delta: -5 }],
          [L("They don't back down. You fight in a sandstorm."), { type: "damage", target: "all_living", amount: 10 }, { type: "injure", target: "random_living" }, { type: "time", days: 2 }],
          undefined, undefined, "combat",
        ),
        ch("wess-c", "Ride through the storm.", 35,
          [L("The convoy is battered but intact. Your pride costs parts and rads."), { type: "rad", delta: 14 }, { type: "resource", key: "parts", delta: -3 }, { type: "transport", delta: -6 }],
          [L("The storm wins completely. Someone gets hurt."), { type: "rad", delta: 22 }, { type: "injure", target: "random_living" }, { type: "transport", delta: -10 }, { type: "time", days: 2 }],
        ),
      ],
    }),

    event({
      id: "we-wild-dogs",
      title: "Dog pack",
      locations: ["open_waste", "abandoned_city"],
      weight: 0.55,
      body: "Fifteen irradiated dogs, maybe twenty. The lead one has two tails. Not a metaphor. They're interested in the food smell.",
      choices: [
        ch("wewd-a", "Make noise and scare them off.", 65,
          [L("Horns, shouting, engine revving. They break and scatter. Good dogs? No."), { type: "resource", key: "fuel", delta: -1 }],
          [L("They don't scare. They rush. {randomLiving} is bitten."), { type: "damage", target: "random_living", amount: 14 }, { type: "sicken", target: "random_living", sickness: "Rad fever", days: 6 }],
        ),
        ch("wewd-b", "Throw rations to distract them.", undefined,
          [L("Food buys freedom. The math works."), { type: "resource", key: "rations", delta: -6 }],
          [],
        ),
        ch("wewd-c", "Kill the alpha — the rest will scatter.", 50,
          [L("{randomLiving} drops the lead dog. Pack scatters. {randomLiving} feels weird about it."), { type: "morale", target: "all_living", delta: -3 }, { type: "resource", key: "caps", delta: 15 }],
          [L("Taking down the alpha just made the pack angrier. They pile in."), { type: "damage", target: "all_living", amount: 10 }, { type: "injure", target: "weakest" }],
          undefined, undefined, "combat",
        ),
      ],
    }),

    event({
      id: "we-sniper",
      title: "The watcher",
      locations: ["abandoned_city", "dead_highway", "open_waste"],
      weight: 0.5,
      body: "{randomLiving} spots glint on a ridge — lens flare, maybe a scope. The convoy hasn't been shot at yet. That might not be a permanent situation.",
      choices: [
        ch("wesn-a", "Send a scout to flank.", 45,
          [L("{randomLiving} circles wide and comes back with a nod. Just a lookout. They're gone."), { type: "morale", target: "all_living", delta: 5 }],
          [L("{randomLiving} is spotted. Shot in the shoulder. They limp back."), { type: "injure", target: "random_living" }, { type: "damage", target: "random_living", amount: 20 }],
          undefined, undefined, "stealth",
        ),
        ch("wesn-b", "Stop and offer a trade signal.", 55,
          [L("They were watching, not hunting. They descend and swap intel for fuel."), { type: "resource", key: "fuel", delta: -4 }, { type: "km", delta: -15 }, { type: "morale", target: "all_living", delta: 6 }],
          [L("No response. Then a crack overhead. Not a warning shot."), { type: "damage", target: "random_living", amount: 22 }, { type: "time", days: 2 }],
          undefined, undefined, "negotiate",
        ),
        ch("wesn-c", "Keep moving, heads down.", 70,
          [L("They let you go. Watchers, not hunters."), { type: "morale", target: "all_living", delta: 2 }],
          [L("A parting shot. Glancing. Still hurts."), { type: "damage", target: "random_living", amount: 16 }, { type: "rad", delta: 5 }],
        ),
      ],
    }),

    event({
      id: "we-old-soldier",
      title: "Dead soldier's gear",
      locations: ROT,
      weight: 0.5,
      body: "{randomLiving} finds a body in partial uniform — old military, pre-collapse. Their kit is scattered nearby. Still serviceable.",
      choices: [
        ch("weos-a", "Take everything useful.", 55,
          [L("Parts, caps, and a personal piece of gear. Respectfully."), { type: "resource", key: "parts", delta: 3 }, { type: "resource", key: "caps", delta: 40 }, { type: "grantPersonal", itemId: "pi_armour_vest", target: "random_living" }],
          [L("Booby-trapped. Someone planned for this exact scenario."), { type: "damage", target: "random_living", amount: 25 }, { type: "injure", target: "random_living" }],
          undefined, undefined, "scavenge",
        ),
        ch("weos-b", "Take the caps and leave the rest.", undefined,
          [L("Quick and practical. Some things stay where they fell."), { type: "resource", key: "caps", delta: 30 }],
          [],
        ),
        ch("weos-c", "Bury them properly.", undefined,
          [L("It takes time. The party feels better about itself."), { type: "time", days: 1 }, { type: "morale", target: "all_living", delta: 12 }],
          [],
        ),
      ],
    }),
  ];
}

// ── Approach events ───────────────────────────────────────────────────────────
// Fires in port_sprawl only. The port is chaos: checkpoints, crowds, rivals.
// These events should feel increasingly tense — you're so close.
//
// HOW TO ADD MORE:
//   Add a new event() call below with locations: ["port_sprawl"].
//   Use portChaos effects to reward or punish choices.
//   Weight 0.8–1.1 — these should come up regularly in the final stretch.

function approachEvents(): GameEvent[] {
  return [
    event({
      id: "ap-press-gang",
      title: "Conscription drive",
      locations: ["port_sprawl"],
      weight: 1.0,
      body: "Uniformed recruiters with clipboards moving through the crowd. They are looking for 'volunteers' to offload cargo. The quotes are implied by the weapons they carry.",
      choices: [
        ch("apg-a", "Comply — just do the work.", undefined,
          [L("Two hours of labour. You're released, tired but untouched."), { type: "time", days: 1 }, { type: "resource", key: "parts", delta: -2 }],
          [],
        ),
        ch("apg-b", "Disappear into the crowd.", 55,
          [L("{randomLiving} knows how to not exist in public. Gone before they turn around."), { type: "km", delta: -8 }],
          [L("Not gone enough. They grab someone."), { type: "injure", target: "random_living" }, { type: "time", days: 2 }, { type: "portChaos", delta: 6 }],
          undefined, undefined, "stealth",
        ),
        ch("apg-c", "Talk your way out with papers.", 50,
          [L("Official exemption, plausibly presented. They move to an easier target."), { type: "portChaos", delta: -3 }],
          [L("They've seen better forgeries. You lose time and someone loses face."), { type: "time", days: 3 }, { type: "portChaos", delta: 8 }],
          undefined, undefined, "negotiate",
        ),
      ],
    }),

    event({
      id: "ap-refugee-crush",
      title: "Crush zone",
      locations: ["port_sprawl"],
      weight: 1.0,
      body: "The checkpoint approach has become a surge — hundreds of people moving as one body toward the gate. The convoy is caught in the tide.",
      choices: [
        ch("aprc-a", "Protect the convoy — hold formation.", 60,
          [L("You lock up and let the crush move around you. Slow, noisy, effective."), { type: "time", days: 2 }, { type: "morale", target: "all_living", delta: -5 }],
          [L("The convoy is separated. Reuniting costs a day and supplies."), { type: "resource", key: "rations", delta: -6 }, { type: "time", days: 3 }, { type: "morale", target: "all_living", delta: -10 }],
          undefined, undefined, "combat",
        ),
        ch("aprc-b", "Push through the crowd.", 45,
          [L("Aggressive driving. You make progress."), { type: "km", delta: -12 }, { type: "portChaos", delta: 5 }, { type: "morale", target: "all_living", delta: -8 }],
          [L("Pushing makes it worse. A vehicle blocks you; the crowd closes in."), { type: "injure", target: "random_living" }, { type: "time", days: 3 }],
        ),
        ch("aprc-c", "Wait it out at the edge.", undefined,
          [L("Two hours later the surge passes. Boring, safe, expensive in time."), { type: "time", days: 2 }],
          [],
        ),
      ],
    }),

    event({
      id: "ap-rival-convoy",
      title: "Rival convoy",
      locations: ["port_sprawl"],
      weight: 0.9,
      body: "A well-armed convoy pulls up alongside and matches pace. Their leader leans out. They have passage documents that expire in eight hours. So do yours. One gate. One slot.",
      choices: [
        ch("aprc2-a", "Race for the gate.", 50,
          [L("You hit the gas. So do they. You arrive first, breathing hard."), { type: "resource", key: "fuel", delta: -5 }, { type: "km", delta: -18 }, { type: "morale", target: "all_living", delta: 12 }],
          [L("They're faster. You arrive second and renegotiate your documents for an ugly fee."), { type: "resource", key: "caps", delta: -90 }, { type: "morale", target: "all_living", delta: -10 }],
        ),
        ch("aprc2-b", "Offer to share passage and split the cost.", 55,
          [L("Both get through. Expensive but civilised."), { type: "resource", key: "caps", delta: -45 }, { type: "km", delta: -10 }, { type: "morale", target: "all_living", delta: 5 }],
          [L("They say yes, then cut ahead anyway. Some lessons are expensive."), { type: "resource", key: "caps", delta: -45 }, { type: "time", days: 3 }, { type: "morale", target: "all_living", delta: -12 }],
          undefined, undefined, "negotiate",
        ),
        ch("aprc2-c", "Disable their vehicle while they sleep.", 35,
          [L("{randomLiving} gets to their engine block before they notice. Their problem now."), { type: "km", delta: -20 }, { type: "portChaos", delta: 5 }, { type: "morale", target: "all_living", delta: 8 }],
          [L("They catch {randomLiving} in the act. Brief and painful."), { type: "damage", target: "random_living", amount: 25 }, { type: "injure", target: "random_living" }, { type: "time", days: 3 }],
          undefined, undefined, "stealth",
        ),
      ],
    }),

    event({
      id: "ap-cargo-inspection",
      title: "Cargo inspection",
      locations: ["port_sprawl"],
      weight: 1.0,
      body: "Mandatory inspectors. They will search the convoy. Everything you're carrying that shouldn't be in their records will be a problem.",
      choices: [
        ch("apci-a", "Cooperate fully.", 65,
          [L("Clean bill of cargo. Minor fee for 'administrative processing'. Of course."), { type: "resource", key: "caps", delta: -30 }, { type: "time", days: 1 }],
          [L("Something flagged. Not illegal but suspicious. Lengthy secondary inspection."), { type: "time", days: 4 }, { type: "morale", target: "all_living", delta: -8 }],
        ),
        ch("apci-b", "Hide the sensitive items.", 55,
          [L("{randomLiving} stashes things fast and well. Inspectors find nothing to care about."), { type: "portChaos", delta: -4 }],
          [L("They find the hidden compartment. Now they're looking harder."), { type: "time", days: 3 }, { type: "portChaos", delta: 10 }, { type: "resource", key: "caps", delta: -60 }],
          undefined, undefined, "stealth",
        ),
        ch("apci-c", "Bribe the lead inspector.", 50,
          [L("Efficient. The inspector has a payment arriving. Inspection: done."), { type: "resource", key: "caps", delta: -75 }],
          [L("Wrong inspector to bribe. They add a 'bribery surcharge' to the fine."), { type: "resource", key: "caps", delta: -110 }, { type: "portChaos", delta: 8 }, { type: "time", days: 2 }],
          undefined, undefined, "negotiate",
        ),
      ],
    }),

    event({
      id: "ap-black-market-pass",
      title: "Black market credentials",
      locations: ["port_sprawl"],
      weight: 0.8,
      body: "A contact approaches: forged passage stamps, genuine-looking, one-time use. The price is steep, but having the right paper here is worth more than fuel.",
      choices: [
        ch("apbm-a", "Buy the stamps.", undefined,
          [L("Documents acquired. Better numbers on paper."), { type: "resource", key: "caps", delta: -120 }, { type: "portChaos", delta: -10 }],
          [],
        ),
        ch("apbm-b", "Haggle for a lower price.", 45,
          [L("You get the stamps for less. The contact is annoyed but paid."), { type: "resource", key: "caps", delta: -90 }, { type: "portChaos", delta: -10 }],
          [L("They walk. The deal is gone."), { type: "morale", target: "all_living", delta: -5 }],
          undefined, undefined, "negotiate",
        ),
        ch("apbm-c", "Decline — too risky.", undefined,
          [L("Might have been legit. Might have been a sting. Will never know."), { type: "morale", target: "all_living", delta: 2 }],
          [],
        ),
      ],
    }),

    event({
      id: "ap-fuel-crisis",
      title: "Running dry — final stretch",
      locations: ["port_sprawl"],
      weight: 0.85,
      body: "The port is close — close enough to smell. The fuel gauge is not close to full. The gate is 40 km of crawl-traffic ahead.",
      choices: [
        ch("apfc-a", "Buy emergency fuel at price-gouged rates.", undefined,
          [L("It hurts. The convoy moves."), { type: "resource", key: "caps", delta: -100 }, { type: "resource", key: "fuel", delta: 16 }],
          [],
        ),
        ch("apfc-b", "Siphon from abandoned vehicles.", 55,
          [L("{randomLiving} finds three workable tanks. Enough for the last stretch."), { type: "resource", key: "fuel", delta: 13 }, { type: "time", days: 1 }],
          [L("Dry as the rest of the wastes. You push the rig on fumes."), { type: "transport", delta: -8 }, { type: "time", days: 2 }],
          undefined, undefined, "scavenge",
        ),
        ch("apfc-c", "Push it — you're so close.", undefined,
          [L("The convoy pushes on pure will and empty tanks. Brutal. Effective. Barely."), { type: "transport", delta: -15 }, { type: "damage", target: "all_living", amount: 10 }, { type: "morale", target: "all_living", delta: -12 }],
          [],
        ),
      ],
    }),

    event({
      id: "ap-gate-marshal",
      title: "Port marshal",
      locations: ["port_sprawl"],
      weight: 1.0,
      body: "A port marshal with a clipboard and an attitude. He decides who gets in next. Technically he has a procedure. Practically he has a price.",
      choices: [
        ch("apgm-a", "Wait in line like everyone else.", 55,
          [L("Eventually — eventually — your turn. Two days of queue culture."), { type: "time", days: 2 }, { type: "km", delta: -14 }],
          [L("Queue jumpers. You're bumped back. Three days of queue culture."), { type: "time", days: 3 }, { type: "morale", target: "all_living", delta: -10 }],
        ),
        ch("apgm-b", "Pay the marshal directly.", undefined,
          [L("The price is written in his eyes before you reach the desk. You pay it."), { type: "resource", key: "caps", delta: -85 }, { type: "km", delta: -20 }, { type: "portChaos", delta: -6 }],
          [],
        ),
        ch("apgm-c", "Have your best talker handle it.", 60,
          [L("{randomLiving} finds the right words. The marshal bumps you up."), { type: "km", delta: -22 }, { type: "portChaos", delta: -8 }, { type: "resource", key: "caps", delta: -20 }],
          [L("{randomLiving} finds the wrong tone. The marshal bumps you down."), { type: "time", days: 3 }, { type: "portChaos", delta: 6 }],
          undefined, undefined, "negotiate",
        ),
      ],
    }),

    event({
      id: "ap-launch-countdown",
      title: "Launch window closing",
      locations: ["port_sprawl"],
      weight: 0.9,
      body: "A public announcement: the launch window closes in 72 hours. This information was better an hour ago. The crowd starts moving faster. A lot faster.",
      choices: [
        ch("aplc-a", "Push hard to the gate.", 55,
          [L("Aggressive movement in a crowd of aggressive people. You gain ground."), { type: "km", delta: -16 }, { type: "damage", target: "random_living", amount: 12 }, { type: "morale", target: "all_living", delta: -8 }],
          [L("The crowd is a wall. Someone gets hurt in the surge."), { type: "injure", target: "random_living" }, { type: "time", days: 2 }],
          undefined, undefined, "combat",
        ),
        ch("aplc-b", "Find a side route.", 50,
          [L("{randomLiving} knows someone who knows someone. A maintenance corridor gets you ahead."), { type: "km", delta: -22 }, { type: "portChaos", delta: -6 }],
          [L("The 'route' ends in a locked gate and a wasted hour."), { type: "time", days: 2 }],
          undefined, undefined, "stealth",
        ),
        ch("aplc-c", "Stay calm and steady.", 70,
          [L("Panic is contagious but so is calm. You move at a sustainable pace while others stumble."), { type: "km", delta: -10 }, { type: "morale", target: "all_living", delta: 5 }],
          [L("Staying calm gets you trampled. The crowd does not care."), { type: "damage", target: "all_living", amount: 8 }, { type: "time", days: 1 }],
        ),
      ],
    }),
  ];
}

// ── Specials ──────────────────────────────────────────────────────────────────
// Unique scenarios with richer mechanics: named slots, rare items, or
// dramatic consequences. Lower weight — these should feel like events.

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
            L("{slot:sealer} failed to seal the compartments correctly. A shame they are so STUPID."),
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
          "Continue driving.",
          50,
          [L("The engine creaks, but holds."), { type: "rad", delta: 10 }],
          [
            L("The engine fails, the acid burning it."),
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
        slot("leader", "Who leads the team?", "player_choice"),
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
          undefined, undefined, "scavenge", "leader",
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
          "Fry it with a parts sacrifice.",
          40,
          [L("You kill the transponder. It drops into a field."), { type: "resource", key: "parts", delta: -2 }],
          [
            L("Jamming spikes the IFF. It stops being subtle."),
            { type: "damage", target: "random_living", amount: 30 },
            { type: "injure", target: "random_living" },
          ],
          undefined, undefined, "repair",
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
            L("Confirmed genuine."),
            { type: "resource", key: "meds", delta: -2 },
            { type: "km", delta: -25 },
          ],
          [
            L("Outdated. Not worth the meds."),
            { type: "resource", key: "meds", delta: -2 },
            { type: "time", days: 2 },
          ],
          undefined, undefined, "negotiate",
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

    // Convoy raid — fight back uses combat specialty
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
          [L("You find a gap and gun it through."), { type: "resource", key: "fuel", delta: -4 }, { type: "km", delta: -8 }],
          [L("They flank you. Side impact."), { type: "injure", target: "random_living" }, { type: "resource", key: "fuel", delta: -3 }, { type: "transport", delta: -8 }],
        ),
        ch(
          "sp7b",
          "Fight back.",
          40,
          [L("You drop the lead driver. They scatter."), { type: "resource", key: "caps", delta: 45 }, { type: "morale", target: "all_living", delta: 8 }],
          [L("Outnumbered and outgunned."), { type: "damage", target: "random_living", amount: 30 }, { type: "injure", target: "weakest" }, { type: "resource", key: "rations", delta: -10 }],
          undefined, undefined, "combat",
        ),
        ch(
          "sp7c",
          "Negotiate — give them a share.",
          55,
          [L("They're practical. They take the offer and wave you through."), { type: "resource", key: "rations", delta: -8 }, { type: "resource", key: "caps", delta: -30 }],
          [L("They take the offering and take more."), { type: "resource", key: "rations", delta: -14 }, { type: "resource", key: "meds", delta: -3 }, { type: "damage", target: "random_living", amount: 16 }],
          undefined, undefined, "negotiate",
        ),
      ],
    }),

    // Bandit camp — infiltrator chosen by player, slot persists across effects
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
          "Send someone to infiltrate the camp.",
          50,
          [
            L("{slot:infiltrator} slips through the perimeter. They return with supplies and intel."),
            { type: "resource", key: "rations", delta: 12 },
            { type: "resource", key: "parts", delta: 3 },
            { type: "resource", key: "caps", delta: 55 },
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
          "Approach openly and try to trade.",
          55,
          [L("They're wary but willing. You leave with a deal."), { type: "resource", key: "rations", delta: 8 }, { type: "resource", key: "caps", delta: -30 }],
          [L("They mistake the approach for aggression. Gunfire starts."), { type: "damage", target: "random_living", amount: 25 }, { type: "injure", target: "random_living" }, { type: "resource", key: "fuel", delta: -5 }],
          undefined, undefined, "negotiate",
        ),
        ch(
          "sbc-avoid",
          "Steer well clear and continue.",
          undefined,
          [L("Cautious. Nothing gained, nothing risked.")],
          [],
        ),
      ],
    }),

    // Injured scout — slot auto-filled, follow-up effects target same person
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
            { type: "heal", target: { slot: "scout" }, amount: 22 },
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

    // New: engineering challenge with repair specialist bonus
    event({
      id: "sp-engine-failure",
      title: "Engine catastrophe",
      locations: ROT,
      weight: 0.5,
      body: "The lead vehicle seizes completely — a catastrophic failure. {randomLiving} opens the hood and stares into the abyss of mechanical disaster.",
      choices: [
        ch(
          "spef-a",
          "Full emergency repair.",
          55,
          [
            L("Three hours of work and a lot of parts. She runs again."),
            { type: "resource", key: "parts", delta: -6 },
            { type: "time", days: 1 },
            { type: "morale", target: "all_living", delta: 8 },
          ],
          [
            L("Not fixable here. You limp on at reduced capacity."),
            { type: "resource", key: "parts", delta: -4 },
            { type: "transport", delta: -15 },
            { type: "time", days: 2 },
          ],
          undefined, undefined, "repair",
        ),
        ch(
          "spef-b",
          "Scavenge parts from the surrounding area.",
          50,
          [
            L("{randomLiving} finds what's needed. Improvised fix, but it holds."),
            { type: "transport", delta: -5 },
            { type: "km", delta: -8 },
          ],
          [
            L("Nothing useful nearby. You lose time and the problem gets worse."),
            { type: "transport", delta: -20 },
            { type: "time", days: 2 },
            { type: "morale", target: "all_living", delta: -10 },
          ],
          undefined, undefined, "scavenge",
        ),
        ch(
          "spef-c",
          "Abandon the vehicle and distribute the load.",
          undefined,
          [
            L("The rig stays. The party moves. Transport takes a hit."),
            { type: "transport", delta: -20 },
            { type: "resource", key: "caps", delta: 20 },
            { type: "morale", target: "all_living", delta: -8 },
          ],
          [],
        ),
      ],
    }),
  ];
}

// ── Location legends ──────────────────────────────────────────────────────────
// Rare, location-specific landmark events. Low weight — feel like discoveries.
// requiresLocation ensures they only fire in the right zone.

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
          undefined, undefined, "stealth",
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
          undefined, undefined, "repair",
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
          undefined, undefined, "repair",
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
          undefined, undefined, "negotiate",
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
          undefined, undefined, "repair",
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
            { type: "resource", key: "rations", delta: 14 },
            { type: "resource", key: "parts", delta: 4 },
          ],
          [
            L("The ceiling exacts its revenge."),
            { type: "injure", target: "random_living" },
            { type: "damage", target: "random_living", amount: 20 },
            { type: "time", days: 5 },
          ],
          undefined, undefined, "scavenge",
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
// Order determines tie-breaking weight priority (earlier = slightly preferred).
// Each sub-pool is independent — pool tag ("travel", "scavenge") filters them.

export const ALL_EVENTS: GameEvent[] = [
  ...ambientPool(),
  ...sicknessEvents(),
  ...wastelandEvents(),   // replaces generic bulk — 18 hand-crafted road events
  ...approachEvents(),    // replaces generic bulk — 8 hand-crafted port events
  ...specials(),
  ...locationLegends(),
  ...embarkPool(),
  ...CAPS_EVENTS,
];

export const TRAVEL_EVENTS: GameEvent[] = ALL_EVENTS.filter(
  (e) => (e.eventPool ?? "travel") === "travel",
);
