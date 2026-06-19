import { Suspense, lazy, type ReactElement } from "react";
import { useGameFlow } from "./hooks/useGameFlow";
import { TitleView } from "./views/TitleView";
import { RosterView } from "./views/RosterView";
import { DepotView } from "./views/DepotView";
import { RecapView } from "./views/RecapView";

const RunView = lazy(() =>
  import("./ui/RunView").then((m) => ({ default: m.RunView })),
);

function ScreenFallback(): ReactElement {
  return (
    <div className="panel" style={{ textAlign: "center", padding: "2rem" }}>
      <p className="muted">Loading expedition…</p>
    </div>
  );
}

export default function App(): ReactElement {
  const game = useGameFlow();

  return (
    <div
      className={`app-shell${game.screen === "run" ? " app-shell--run" : ""}`}
    >
      {game.screen === "title" ? (
        <TitleView
          onNew={game.beginNewExpedition}
          onContinue={game.continueRun}
        />
      ) : null}

      {game.screen === "roster" ? (
        <RosterView
          difficulty={game.difficulty}
          setDifficulty={game.setDifficulty}
          partyCount={game.partyCount}
          setPartyCount={game.setPartyCount}
          minParty={game.minParty}
          maxParty={game.maxParty}
          drafts={game.drafts}
          setDrafts={game.setDrafts}
          error={game.rosterError}
          onBack={game.backToTitle}
          onNext={game.proceedToDepot}
        />
      ) : null}

      {game.screen === "depot" ? (
        <DepotView
          difficulty={game.difficulty}
          drafts={game.drafts}
          cart={game.cart}
          setCart={game.setCart}
          personalAssignments={game.personalAssignments}
          setPersonalAssignments={game.setPersonalAssignments}
          onBack={game.backToRoster}
          onStart={game.startRun}
        />
      ) : null}

      {game.screen === "run" && game.run ? (
        <Suspense fallback={<ScreenFallback />}>
          <RunView state={game.run} setState={game.updateRun} />
        </Suspense>
      ) : null}

      {game.screen === "recap" && game.run ? (
        <RecapView state={game.run} onMenu={game.returnToMenu} />
      ) : null}
    </div>
  );
}
