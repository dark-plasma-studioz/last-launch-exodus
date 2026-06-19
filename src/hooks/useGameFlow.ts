import { useCallback, useEffect, useState, type SetStateAction } from "react";
import type { DifficultyId, RunState } from "../types";
import { makeParty, validateRosterNames } from "../config/difficulty";
import { applyDepotCheckout, createRunState } from "../engine/runBootstrap";
import type { PersonalAssignments } from "../engine/runBootstrap";
import {
  clearRunAutosave,
  loadRoster,
  saveRunAutosave,
  saveRoster,
} from "../engine/persistence";
import { newId } from "../lib/ids";

export type Screen = "title" | "roster" | "depot" | "run" | "recap";

export interface DraftFriend {
  id: string;
  name: string;
}

const MIN_PARTY = 2;
const MAX_PARTY = 8;

export function useGameFlow() {
  const [screen, setScreen] = useState<Screen>("title");
  const [difficulty, setDifficulty] = useState<DifficultyId>("standard");
  const [partyCount, setPartyCount] = useState(4);
  const [drafts, setDrafts] = useState<DraftFriend[]>([]);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [personalAssignments, setPersonalAssignments] =
    useState<PersonalAssignments>({});
  const [run, setRun] = useState<RunState | null>(null);

  useEffect(() => {
    const raw = loadRoster();
    if (!raw) return;
    try {
      const data = JSON.parse(raw) as {
        difficulty: DifficultyId;
        partyCount: number;
        drafts: DraftFriend[];
      };
      setDifficulty(data.difficulty ?? "standard");
      setPartyCount(
        Math.min(MAX_PARTY, Math.max(MIN_PARTY, data.partyCount ?? MIN_PARTY)),
      );
      setDrafts(data.drafts ?? []);
    } catch {
      /* ignore corrupt roster */
    }
  }, []);

  const beginNewExpedition = useCallback(() => {
    setScreen("roster");
    setPartyCount(4);
    setDrafts(Array.from({ length: 4 }, () => ({ id: newId(), name: "" })));
  }, []);

  const continueRun = useCallback((saved: RunState) => {
    setRun(saved);
    setScreen("run");
  }, []);

  const backToTitle = useCallback(() => {
    setRosterError(null);
    setScreen("title");
  }, []);

  const proceedToDepot = useCallback(() => {
    const err = validateRosterNames(drafts.map((d) => d.name));
    setRosterError(err);
    if (err) return;
    saveRoster(JSON.stringify({ difficulty, partyCount, drafts }));
    setCart({});
    setPersonalAssignments({});
    setScreen("depot");
  }, [difficulty, partyCount, drafts]);

  const backToRoster = useCallback(() => setScreen("roster"), []);

  const startRun = useCallback(() => {
    const cartWithPersonal: Record<string, number> = { ...cart };
    for (const [itemId, draftId] of Object.entries(personalAssignments)) {
      if (draftId) cartWithPersonal[itemId] = 1;
    }
    const checkout = applyDepotCheckout(difficulty, partyCount, {
      lines: cartWithPersonal,
    });
    const seed = (Math.random() * 0xffffffff) >>> 0;
    const friends = makeParty(drafts, seed);
    const rs = createRunState({
      difficulty,
      friends,
      inventory: checkout.inventory,
      resources: checkout.resources,
      rngSeed: seed,
      capsSpentAtDepot: checkout.capsSpent,
      capsRemaining: checkout.capsRemaining,
      personalAssignments,
    });
    setRun(rs);
    setScreen("run");
    saveRunAutosave(rs);
  }, [cart, difficulty, drafts, partyCount, personalAssignments]);

  const updateRun = useCallback((up: SetStateAction<RunState | null>) => {
    setRun((prev) => {
      const next = typeof up === "function" ? up(prev) : up;
      if (next?.phase === "recap") setScreen("recap");
      return next;
    });
  }, []);

  const returnToMenu = useCallback(() => {
    clearRunAutosave();
    setRun(null);
    setScreen("title");
  }, []);

  return {
    screen,
    difficulty,
    setDifficulty,
    partyCount,
    setPartyCount,
    drafts,
    setDrafts,
    rosterError,
    cart,
    setCart,
    personalAssignments,
    setPersonalAssignments,
    run,
    beginNewExpedition,
    continueRun,
    backToTitle,
    proceedToDepot,
    backToRoster,
    startRun,
    updateRun,
    returnToMenu,
    minParty: MIN_PARTY,
    maxParty: MAX_PARTY,
  };
}
