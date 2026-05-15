import type { RunState } from "../types";

const ROSTER_KEY = "lle-roster-v1";
const AUTOSAVE_KEY = "lle-autosave-v2";

export function saveRoster(json: string): void {
  try {
    localStorage.setItem(ROSTER_KEY, json);
  } catch {
    /* ignore */
  }
}

export function loadRoster(): string | null {
  try {
    return localStorage.getItem(ROSTER_KEY);
  } catch {
    return null;
  }
}

export function saveRunAutosave(state: RunState): void {
  try {
    if (state.phase === "run") {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(state));
    }
  } catch {
    /* ignore */
  }
}

export function loadRunAutosave(): RunState | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as RunState;
  } catch {
    return null;
  }
}

export function clearRunAutosave(): void {
  try {
    localStorage.removeItem(AUTOSAVE_KEY);
  } catch {
    /* ignore */
  }
}
