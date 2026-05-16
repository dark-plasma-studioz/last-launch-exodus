import { useEffect, useState, type ReactElement } from "react";
import type { Friend, TraitId } from "../types";
import { TRAIT_DESCRIPTIONS } from "../types";
import { getItem } from "../config/items";
import { HoverTip } from "./HoverTip";
import type { FloatDelta } from "./runSnapshot";

function traitTip(trait: TraitId): string {
  return TRAIT_DESCRIPTIONS[trait] ?? trait;
}

function PartyStatInline(props: {
  label: string;
  value: string;
  floats: FloatDelta[];
}): ReactElement {
  const [active, setActive] = useState<FloatDelta[]>([]);
  useEffect(() => {
    if (!props.floats.length) return;
    setActive((p) => [...p, ...props.floats]);
    const t = window.setTimeout(() => {
      setActive((p) => p.filter((f) => !props.floats.some((x) => x.id === f.id)));
    }, 1300);
    return () => clearTimeout(t);
  }, [props.floats]);
  return (
    <span className="party-stat-inline">
      {props.label} {props.value}
      {active.map((f) => (
        <span
          key={f.id}
          className={`stat-float ${f.delta > 0 ? "positive" : "negative"}`}
        >
          {f.delta > 0 ? "+" : ""}
          {f.delta}
        </span>
      ))}
    </span>
  );
}

function SickBadge(props: { sick: NonNullable<Friend["sick"]> }): ReactElement {
  const { sick } = props;
  const urgency =
    sick.daysLeft <= 2 ? "var(--danger)" :
    sick.daysLeft <= 4 ? "#e8a020" :
    "#c0a030";
  const tip = `${sick.name}: ${sick.daysLeft} day${sick.daysLeft === 1 ? "" : "s"} left. Cure with meds while resting.`;
  return (
    <HoverTip tip={tip}>
      <span
        className="sick-badge"
        style={{ color: urgency, borderColor: urgency }}
      >
        {sick.name} ({sick.daysLeft}d)
      </span>
    </HoverTip>
  );
}

function PartyMemberCard(props: {
  friend: Friend;
  floats: FloatDelta[];
}): ReactElement {
  const { friend: f, floats } = props;
  const hpFloats = floats.filter((d) => d.statKey === `hp:${f.id}`);
  const moraleFloats = floats.filter((d) => d.statKey === `morale:${f.id}`);
  const gear = (f.memberItems ?? [])
    .map((id) => getItem(id))
    .filter((it): it is NonNullable<typeof it> => !!it);

  return (
    <article className={`party-card ${f.status === "dead" ? "dead" : ""}`}>
      <div className="party-card-header">
        <strong className="party-card-name">{f.name}</strong>
        {f.sick ? <SickBadge sick={f.sick} /> : null}
        {f.status !== "alive" && f.status !== "dead" ? (
          <span className="party-status-tag">{f.status}</span>
        ) : null}
        {f.status === "dead" ? (
          <span className="muted party-status-tag">dead</span>
        ) : null}
      </div>

      {f.status !== "dead" ? (
        <div className="party-stat-line">
          <PartyStatInline
            label="HP"
            value={`${f.health}/${f.maxHealth}`}
            floats={hpFloats}
          />
          <PartyStatInline
            label="Morale"
            value={String(f.morale)}
            floats={moraleFloats}
          />
        </div>
      ) : null}

      <div className="party-card-section">
        <span className="party-section-label">Traits</span>
        <div className="party-chip-row">
          {f.traits.map((t) => (
            <HoverTip key={t} tip={traitTip(t)} className="hover-tip-anchor trait-chip on">
              {t}
            </HoverTip>
          ))}
        </div>
      </div>

      <div className="party-card-section">
        <span className="party-section-label">Inventory</span>
        {gear.length ? (
          <ul className="member-gear-list">
            {gear.map((it) => (
              <li key={it.id}>
                <HoverTip tip={it.description}>
                  <span className="member-gear-item">{it.name}</span>
                </HoverTip>
              </li>
            ))}
          </ul>
        ) : (
          <span className="muted member-gear-empty">No personal gear</span>
        )}
      </div>
    </article>
  );
}

export function RunPartySidebar(props: {
  friends: Friend[];
  floats: FloatDelta[];
}): ReactElement {
  return (
    <aside className="run-party-sidebar panel">
      <h2 className="run-sidebar-title">Party</h2>
      <div className="party-sidebar-scroll">
        {props.friends.map((f) => (
          <PartyMemberCard key={f.id} friend={f} floats={props.floats} />
        ))}
      </div>
    </aside>
  );
}
