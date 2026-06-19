import {
  useEffect,
  type Dispatch,
  type ReactElement,
  type SetStateAction,
} from "react";
import type { DifficultyId } from "../types";
import { DIFFICULTY } from "../config/difficulty";
import { getSpecialty, SPECIALTIES } from "../config/traits";
import { saveRoster } from "../engine/persistence";
import { newId } from "../lib/ids";
import type { DraftFriend } from "../hooks/useGameFlow";

const PREVIEW_SPECIALTIES = SPECIALTIES.map((s) => s.id);

export function RosterView(props: {
  difficulty: DifficultyId;
  setDifficulty: (d: DifficultyId) => void;
  partyCount: number;
  setPartyCount: (n: number) => void;
  minParty: number;
  maxParty: number;
  drafts: DraftFriend[];
  setDrafts: Dispatch<SetStateAction<DraftFriend[]>>;
  onBack: () => void;
  onNext: () => void;
  error: string | null;
}): ReactElement {
  useEffect(() => {
    props.setDrafts((prev) => {
      const next = [...prev];
      while (next.length < props.partyCount) next.push({ id: newId(), name: "" });
      while (next.length > props.partyCount) next.pop();
      return next;
    });
  }, [props.partyCount, props.setDrafts]);

  const exportRoster = () => {
    const json = JSON.stringify({
      difficulty: props.difficulty,
      partyCount: props.partyCount,
      drafts: props.drafts,
    });
    void navigator.clipboard.writeText(json);
    saveRoster(json);
  };

  return (
    <div>
      <div className="panel">
        <h1>Roster</h1>
        <p className="muted">
          Difficulty sets the calendar window until departure (
          {Object.entries(DIFFICULTY).map(([k, v]) => (
            <span key={k}>
              {v.label}: {Math.round(v.years * 365)}d{" "}
            </span>
          ))}
          ). Name your party, then head to the depot to stock up.
        </p>
        <div className="row" style={{ marginBottom: "0.75rem" }}>
          <label>
            Difficulty{" "}
            <select
              value={props.difficulty}
              onChange={(e) =>
                props.setDifficulty(e.target.value as DifficultyId)
              }
            >
              <option value="easier">Easier</option>
              <option value="standard">Standard</option>
              <option value="hard">Hard</option>
            </select>
          </label>
          <label>
            Party size{" "}
            <select
              value={props.partyCount}
              onChange={(e) => props.setPartyCount(Number(e.target.value))}
            >
              {Array.from(
                { length: props.maxParty - props.minParty + 1 },
                (_, i) => (
                  <option key={i} value={props.minParty + i}>
                    {props.minParty + i}
                  </option>
                ),
              )}
            </select>
          </label>
        </div>
        {props.error ? (
          <p style={{ color: "var(--danger)" }}>{props.error}</p>
        ) : null}
      </div>
      <p className="muted" style={{ marginTop: "0.25rem" }}>
        Specialties and traits are assigned randomly when you start. Each member
        gets a unique specialty.
      </p>
      {props.drafts.map((d, idx) => {
        const previewSpecialty =
          PREVIEW_SPECIALTIES[idx % PREVIEW_SPECIALTIES.length];
        const spec = getSpecialty(previewSpecialty);
        return (
          <div key={d.id} className="panel">
            <label>
              Name{" "}
              <input
                value={d.name}
                onChange={(e) =>
                  props.setDrafts((rows) =>
                    rows.map((r) =>
                      r.id === d.id ? { ...r, name: e.target.value } : r,
                    ),
                  )
                }
                placeholder="Friend name"
              />
            </label>
            <span
              className="muted"
              style={{ fontSize: "0.75rem", marginLeft: "0.75rem" }}
            >
              Preview specialty: <strong>{spec.name}</strong> —{" "}
              {spec.description}
            </span>
          </div>
        );
      })}
      <div className="row">
        <button type="button" className="btn" onClick={props.onBack}>
          Back
        </button>
        <button type="button" className="btn btn-primary" onClick={props.onNext}>
          Depot
        </button>
        <button type="button" className="btn" onClick={exportRoster}>
          Export roster JSON
        </button>
        <label className="btn">
          Import roster JSON
          <input
            type="file"
            accept="application/json"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const reader = new FileReader();
              reader.onload = () => {
                try {
                  const data = JSON.parse(String(reader.result)) as {
                    difficulty: DifficultyId;
                    partyCount: number;
                    drafts: DraftFriend[];
                  };
                  props.setDifficulty(data.difficulty ?? "standard");
                  props.setPartyCount(
                    Math.min(
                      props.maxParty,
                      Math.max(props.minParty, data.partyCount ?? props.minParty),
                    ),
                  );
                  props.setDrafts(data.drafts ?? []);
                } catch {
                  /* ignore */
                }
              };
              reader.readAsText(f);
            }}
          />
        </label>
      </div>
    </div>
  );
}
