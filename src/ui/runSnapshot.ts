import type { Friend, RunResources, RunState } from "../types";

export interface FriendSnap {
  id: string;
  name: string;
  health: number;
  maxHealth: number;
  morale: number;
  status: Friend["status"];
  sick: boolean;
  sickName?: string;
}

export interface RunSnapshot {
  day: number;
  departureDaysRemaining: number;
  kmRemaining: number;
  rads: number;
  portChaos: number;
  transport: number;
  resources: RunResources;
  friends: FriendSnap[];
  logLength: number;
}

export function snapshotRun(s: RunState): RunSnapshot {
  return {
    day: s.day,
    departureDaysRemaining: s.departureDaysRemaining,
    kmRemaining: s.kmRemaining,
    rads: s.rads,
    portChaos: s.portChaos,
    transport: s.transport,
    resources: { ...s.resources },
    friends: s.friends.map((f) => ({
      id: f.id,
      name: f.name,
      health: f.health,
      maxHealth: f.maxHealth,
      morale: f.morale,
      status: f.status,
      sick: !!f.sick,
      sickName: f.sick?.name,
    })),
    logLength: s.log.length,
  };
}

export interface FloatDelta {
  id: string;
  statKey: string;
  delta: number;
}

export interface Acknowledgment {
  id: string;
  title: string;
  body: string;
  critical?: boolean;
}

const RES_KEYS: (keyof RunResources)[] = [
  "rations",
  "water",
  "meds",
  "parts",
  "fuel",
  "caps",
];

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function buildFloatDeltas(
  before: RunSnapshot,
  after: RunSnapshot,
): FloatDelta[] {
  const out: FloatDelta[] = [];
  const push = (statKey: string, delta: number) => {
    if (delta === 0) return;
    out.push({ id: uid(), statKey, delta });
  };

  for (const k of RES_KEYS) {
    push(k, after.resources[k] - before.resources[k]);
  }
  push("km", Math.round(after.kmRemaining - before.kmRemaining));
  push("rads", Math.round(after.rads - before.rads));
  push("transport", Math.round(after.transport - before.transport));
  push("portChaos", Math.round(after.portChaos - before.portChaos));

  for (const af of after.friends) {
    const bf = before.friends.find((f) => f.id === af.id);
    if (!bf) continue;
    push(`hp:${af.id}`, af.health - bf.health);
    push(`morale:${af.id}`, af.morale - bf.morale);
  }

  return out;
}

export type TransitionMode = "daily" | "event";

export function buildAcknowledgments(
  before: RunSnapshot,
  after: RunSnapshot,
  mode: TransitionMode,
  newLogTexts: string[],
): Acknowledgment[] {
  const acks: Acknowledgment[] = [];

  if (mode === "event" && newLogTexts.length > 0) {
    const body = newLogTexts.filter((t) => t.trim().length > 0).join("\n\n");
    if (body) {
      acks.push({
        id: uid(),
        title: "Outcome",
        body,
      });
    }
  }

  for (const af of after.friends) {
    const bf = before.friends.find((f) => f.id === af.id);
    if (!bf) continue;

    if (af.status === "dead" && bf.status !== "dead") {
      acks.push({
        id: uid(),
        title: "Killed",
        body: `${af.name} did not make it.`,
        critical: true,
      });
      continue;
    }

    if (af.sick && !bf.sick && af.status !== "dead") {
      acks.push({
        id: uid(),
        title: "Sickness",
        body: `${af.name} has contracted ${af.sickName ?? "an illness"}. Treat with meds while resting.`,
        critical: true,
      });
    }

    if (af.status === "injured" && bf.status === "alive") {
      acks.push({
        id: uid(),
        title: "Injured",
        body: `${af.name} is hurt and needs care.`,
        critical: true,
      });
    } else if (af.status === "incapacitated" && bf.status !== "incapacitated") {
      acks.push({
        id: uid(),
        title: "Down",
        body: `${af.name} cannot keep up without help.`,
        critical: true,
      });
    }

    const hpLoss = bf.health - af.health;
    if (hpLoss >= Math.max(12, bf.maxHealth * 0.18) && af.status !== "dead") {
      const already = acks.some((a) => a.title === "Injured" && a.body.includes(af.name));
      if (!already) {
        acks.push({
          id: uid(),
          title: "Badly hurt",
          body: `${af.name} took serious damage (−${hpLoss} HP).`,
          critical: true,
        });
      }
    }
  }

  const lossLines: string[] = [];
  for (const k of RES_KEYS) {
    const d = after.resources[k] - before.resources[k];
    if (d < 0) lossLines.push(`${labelRes(k)} ${d}`);
  }

  const majorLoss = RES_KEYS.some(
    (k) => after.resources[k] - before.resources[k] <= -4,
  );

  if (mode === "daily" && majorLoss) {
    acks.push({
      id: uid(),
      title: "Supplies hit",
      body: lossLines.join(" · "),
    });
  }

  if (mode === "daily") {
    const theftHints = newLogTexts.some((t) =>
      /stolen|lost|raiders|taken|seized|robbed|missing/i.test(t),
    );
    if (theftHints && lossLines.length > 0) {
      const dup = acks.some((a) => a.title === "Supplies hit");
      if (!dup) {
        acks.push({
          id: uid(),
          title: "Losses",
          body: `${lossLines.join(" · ")}\n\n${newLogTexts.slice(-2).join(" ")}`,
        });
      }
    }
  }

  return acks;
}

function labelRes(k: keyof RunResources): string {
  const labels: Record<keyof RunResources, string> = {
    rations: "Rations",
    water: "Water",
    meds: "Meds",
    parts: "Parts",
    fuel: "Fuel",
    caps: "Caps",
  };
  return labels[k];
}
