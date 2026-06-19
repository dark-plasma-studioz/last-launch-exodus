import { useMemo, type Dispatch, type ReactElement, type SetStateAction } from "react";
import type { DifficultyId } from "../types";
import { DIFFICULTY } from "../config/difficulty";
import { ITEMS, getItem } from "../config/items";
import type { PersonalAssignments } from "../engine/runBootstrap";
import type { DraftFriend } from "../hooks/useGameFlow";

export function DepotView(props: {
  difficulty: DifficultyId;
  drafts: DraftFriend[];
  cart: Record<string, number>;
  setCart: Dispatch<SetStateAction<Record<string, number>>>;
  personalAssignments: PersonalAssignments;
  setPersonalAssignments: Dispatch<SetStateAction<PersonalAssignments>>;
  onBack: () => void;
  onStart: () => void;
}): ReactElement {
  const caps = DIFFICULTY[props.difficulty].startingCaps;

  const commonItems = useMemo(() => ITEMS.filter((i) => i.kind === "common"), []);
  const uniqueItems = useMemo(() => ITEMS.filter((i) => i.kind === "unique"), []);
  const personalItems = useMemo(() => ITEMS.filter((i) => i.kind === "personal"), []);

  const spent = useMemo(() => {
    let s = 0;
    for (const [id, c] of Object.entries(props.cart)) {
      const def = getItem(id);
      if (!def) continue;
      s += def.price * (c ?? 0);
    }
    for (const it of personalItems) {
      if (props.personalAssignments[it.id]) s += it.price;
    }
    return s;
  }, [props.cart, props.personalAssignments, personalItems]);

  const remaining = caps - spent;

  const setLine = (id: string, val: number) =>
    props.setCart((prev) => ({ ...prev, [id]: Math.max(0, val) }));

  const assignPersonal = (itemId: string, draftId: string) =>
    props.setPersonalAssignments((prev) => ({ ...prev, [itemId]: draftId }));

  return (
    <div>
      <div className="panel">
        <h1>Starting depot</h1>
        <p className="muted">
          Caps: <strong>{caps}</strong> · Spent: <strong>{spent}</strong> · Left:{" "}
          <strong style={{ color: remaining < 0 ? "var(--danger)" : "inherit" }}>
            {remaining}
          </strong>
        </p>
        <p className="muted">
          Common supplies add starting resources. Unique gear changes how the
          convoy handles encounters. Personal items are assigned to one party
          member and give them individual bonuses throughout the run.
        </p>
      </div>

      <div className="panel">
        <h2>Common supplies</h2>
        {commonItems.map((it) => (
          <div
            key={it.id}
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.5rem",
              alignItems: "center",
              marginBottom: "0.55rem",
            }}
          >
            <div style={{ flex: "1 1 220px" }}>
              <strong>{it.name}</strong>{" "}
              <span className="muted">
                ({it.price}c) — {it.description}
              </span>
            </div>
            <label>
              Qty{" "}
              <input
                type="number"
                min={0}
                max={99}
                value={props.cart[it.id] ?? 0}
                onChange={(e) => setLine(it.id, Number(e.target.value))}
                style={{ width: "4rem" }}
              />
            </label>
          </div>
        ))}
      </div>

      <div className="panel">
        <h2>Unique gear</h2>
        {uniqueItems.map((it) => (
          <div
            key={it.id}
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.5rem",
              alignItems: "center",
              marginBottom: "0.55rem",
            }}
          >
            <div style={{ flex: "1 1 220px" }}>
              <strong>{it.name}</strong>{" "}
              <span className="muted">
                ({it.price}c) — {it.description}
              </span>
            </div>
            <label>
              Qty{" "}
              <input
                type="number"
                min={0}
                max={1}
                value={props.cart[it.id] ?? 0}
                onChange={(e) => setLine(it.id, Number(e.target.value))}
                style={{ width: "4rem" }}
              />
            </label>
          </div>
        ))}
      </div>

      <div className="panel">
        <h2>Personal equipment</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Each item is assigned to one party member. Select them from the
          dropdown to purchase it for them.
        </p>
        {personalItems.map((it) => {
          const assignedId = props.personalAssignments[it.id] ?? "";
          return (
            <div
              key={it.id}
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.5rem",
                alignItems: "center",
                marginBottom: "0.55rem",
              }}
            >
              <div style={{ flex: "1 1 220px" }}>
                <strong>{it.name}</strong>{" "}
                <span className="muted">
                  ({it.price}c) — {it.description}
                </span>
              </div>
              <label>
                Assign to{" "}
                <select
                  value={assignedId}
                  onChange={(e) => assignPersonal(it.id, e.target.value)}
                >
                  <option value="">— not purchased —</option>
                  {props.drafts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name.trim() || "(unnamed)"}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          );
        })}
      </div>

      <div className="row">
        <button type="button" className="btn" onClick={props.onBack}>
          Back
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={remaining < 0}
          onClick={props.onStart}
        >
          Begin run
        </button>
      </div>
    </div>
  );
}
