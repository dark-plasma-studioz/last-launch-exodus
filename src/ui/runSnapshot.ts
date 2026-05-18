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

const RES_KEYS: (keyof RunResources)[] = ["rations", "meds", "parts", "fuel", "caps"];

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Deltas for on-screen stat badges (top bar + party HP only). */
export function buildFloatDeltas(before: RunSnapshot, after: RunSnapshot): FloatDelta[] {
  const out: FloatDelta[] = [];
  const push = (statKey: string, delta: number) => {
    if (delta === 0) return;
    out.push({ id: uid(), statKey, delta });
  };
  for (const k of RES_KEYS) push(k, after.resources[k] - before.resources[k]);
  push("rads", Math.round(after.rads - before.rads));
  for (const af of after.friends) {
    const bf = before.friends.find((f) => f.id === af.id);
    if (!bf) continue;
    push(`hp:${af.id}`, af.health - bf.health);
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

  if (mode === "event") {
    const lines = newLogTexts.map((t) => t.trim()).filter((t) => t.length > 0);
    if (lines.length > 0) {
      const oddsLine = lines.find((t) => /% odds/i.test(t));
      const rest = lines.filter((t) => t !== oddsLine);
      const body = oddsLine ? [oddsLine, ...rest].join("\n\n") : lines.join("\n\n");
      acks.push({ id: uid(), title: "Outcome", body });
    }
  }

  for (const af of after.friends) {
    const bf = before.friends.find((f) => f.id === af.id);
    if (!bf) continue;

    if (af.status === "dead" && bf.status !== "dead") {
      acks.push({ id: uid(), title: "Lost", body: `${af.name} did not make it.`, critical: true });
      continue;
    }

    if (af.sick && !bf.sick && af.status !== "dead") {
      acks.push({
        id: uid(),
        title: "Sickness",
        body: `${af.name} has contracted ${af.sickName ?? "an illness"}. Rest with meds to treat.`,
      });
    }
    if (af.status === "injured" && bf.status === "alive") {
      acks.push({ id: uid(), title: "Injured", body: `${af.name} is hurt and needs care.` });
    } else if (af.status === "incapacitated" && bf.status !== "incapacitated") {
      acks.push({ id: uid(), title: "Down", body: `${af.name} cannot keep up without help.` });
    }
    const hpLoss = bf.health - af.health;
    if (hpLoss >= Math.max(12, bf.maxHealth * 0.18) && af.status !== "dead") {
      const already = acks.some((a) => a.title === "Injured" && a.body.includes(af.name));
      if (!already) {
        acks.push({
          id: uid(),
          title: "Badly hurt",
          body: `${af.name} took serious damage (−${hpLoss} HP).`,
        });
      }
    }
  }

  if (mode === "daily" && before.resources.fuel > 0 && after.resources.fuel <= 0) {
    acks.push({
      id: uid(),
      title: "Out of fuel",
      body: "The convoy is pushing the rig by hand. Travel is slow and the road is dangerous.",
    });
  }

  return acks;
}

