import type { ReactElement } from "react";

function SmokeParticle({ delay }: { delay: number }): ReactElement {
  return (
    <div
      className="convoy-smoke-particle"
      style={{ animationDelay: `${delay}s` }}
    />
  );
}

function Wheel({ r }: { r: number }): ReactElement {
  return (
    <>
      <circle r={r} fill="#14181c" stroke="#2a3238" strokeWidth="1.5" />
      <circle r={r * 0.62} fill="#1e2428" stroke="#333" strokeWidth="0.8" />
      <circle r={r * 0.22} fill="#4a5560" />
      {[0, 45, 90, 135].map((deg) => (
        <line
          key={deg}
          x1={0}
          y1={-r * 0.55}
          x2={0}
          y2={-r * 0.2}
          stroke="#2a3038"
          strokeWidth="0.8"
          transform={`rotate(${deg})`}
        />
      ))}
    </>
  );
}

interface ConvoyVehicleProps {
  stopped: boolean;
}

export function ConvoyVehicle({ stopped }: ConvoyVehicleProps): ReactElement {
  const wheelClass = stopped ? "convoy-wheel" : "convoy-wheel convoy-wheel--spin";

  return (
    <div className={`convoy-unit ${stopped ? "convoy-unit--stopped" : ""}`}>
      <div className="convoy-exhaust">
        {!stopped && (
          <>
            <SmokeParticle delay={0} />
            <SmokeParticle delay={-0.45} />
            <SmokeParticle delay={-0.9} />
            <SmokeParticle delay={-1.35} />
          </>
        )}
      </div>

      <svg className="convoy-svg" viewBox="0 0 340 100" role="img" aria-label="Convoy on the road">
        <defs>
          <linearGradient id="cv-metal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4a6278" />
            <stop offset="55%" stopColor="#2e3f4f" />
            <stop offset="100%" stopColor="#1a2630" />
          </linearGradient>
          <linearGradient id="cv-metal-dark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#354858" />
            <stop offset="100%" stopColor="#182228" />
          </linearGradient>
          <linearGradient id="cv-rust" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#9a5c32" />
            <stop offset="100%" stopColor="#5c3418" />
          </linearGradient>
          <linearGradient id="cv-glass" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#1a3048" />
            <stop offset="40%" stopColor="#0e1a28" />
            <stop offset="100%" stopColor="#060c14" />
          </linearGradient>
          <linearGradient id="cv-tarp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3d4a38" />
            <stop offset="100%" stopColor="#252e22" />
          </linearGradient>
          <filter id="cv-shadow" x="-8%" y="-8%" width="116%" height="120%">
            <feDropShadow dx="0" dy="3" stdDeviation="2" floodColor="#000" floodOpacity="0.55" />
          </filter>
        </defs>

        {/* Escort pickup (trails behind) */}
        <g className="convoy-escort" filter="url(#cv-shadow)">
          <rect x="8" y="52" width="72" height="22" rx="2" fill="url(#cv-metal-dark)" />
          <rect x="12" y="48" width="38" height="18" rx="2" fill="url(#cv-metal)" />
          <rect x="14" y="50" width="18" height="10" rx="1" fill="url(#cv-glass)" opacity="0.9" />
          <rect x="34" y="50" width="14" height="8" fill="url(#cv-rust)" opacity="0.7" />
          <rect x="18" y="44" width="28" height="3" fill="#2a3540" />
          <rect x="38" y="40" width="8" height="8" rx="1" fill="#3d4a38" stroke="#556" strokeWidth="0.5" />
          <rect x="40" y="42" width="4" height="4" fill="#c45c20" opacity="0.8" />
          <rect x="6" y="62" width="4" height="10" fill="#1e2830" />
          <rect x="6" y="70" width="14" height="3" rx="1" fill="#2a3540" />
          <rect x="4" y="64" width="3" height="4" rx="0.5" fill="#ffe566" className="convoy-headlight" />
          <g transform="translate(22, 76)">
            <g className={wheelClass}><Wheel r={7} /></g>
          </g>
          <g transform="translate(62, 76)">
            <g className={wheelClass}><Wheel r={7} /></g>
          </g>
        </g>

        {/* Lead semi + cargo trailer */}
        <g className="convoy-lead" filter="url(#cv-shadow)">
          <rect x="88" y="38" width="168" height="36" rx="2" fill="url(#cv-metal-dark)" />
          <rect x="92" y="42" width="160" height="28" fill="url(#cv-metal)" />
          {[108, 124, 140, 156, 172, 188, 204, 220, 236].map((x) => (
            <line key={x} x1={x} y1="44" x2={x} y2="68" stroke="#1a2630" strokeWidth="0.6" opacity="0.5" />
          ))}
          <rect x="98" y="48" width="28" height="14" fill="url(#cv-rust)" opacity="0.55" rx="1" />
          <rect x="200" y="52" width="22" height="10" fill="url(#cv-rust)" opacity="0.4" rx="1" />
          <text x="118" y="60" fill="#3d5568" fontSize="7" fontFamily="monospace" fontWeight="700" letterSpacing="2">
            EXODUS
          </text>
          <path d="M 108 42 Q 148 28 188 42 L 188 48 L 108 48 Z" fill="url(#cv-tarp)" />
          <path d="M 108 42 Q 148 28 188 42" fill="none" stroke="#4a5a44" strokeWidth="0.8" />
          <line x1="120" y1="42" x2="120" y2="48" stroke="#556650" strokeWidth="0.5" />
          <line x1="148" y1="35" x2="148" y2="48" stroke="#556650" strokeWidth="0.5" />
          <line x1="176" y1="42" x2="176" y2="48" stroke="#556650" strokeWidth="0.5" />
          <ellipse cx="210" cy="58" rx="7" ry="5" fill="#3a4548" />
          <ellipse cx="210" cy="56" rx="7" ry="4" fill="#4a5a5e" />
          <rect x="228" y="52" width="14" height="12" fill="#3a4540" stroke="#2a3228" strokeWidth="0.5" />
          <rect x="230" y="54" width="4" height="4" fill="#5a4030" opacity="0.6" />
          <g transform="translate(248, 50)">
            <circle r="9" fill="#1a2028" stroke="#2a3540" strokeWidth="1.2" />
            <circle r="5" fill="#252d35" />
            <circle r="2" fill="#3a4550" />
          </g>
          <rect x="82" y="58" width="12" height="10" rx="1" fill="#1e2830" />
          <rect x="78" y="62" width="8" height="6" fill="#2a3540" />

          <rect x="52" y="32" width="44" height="42" rx="2" fill="url(#cv-metal)" />
          <rect x="48" y="38" width="8" height="30" fill="url(#cv-metal-dark)" />
          <rect x="52" y="28" width="28" height="10" rx="1" fill="url(#cv-metal-dark)" />
          <rect x="54" y="30" width="8" height="4" fill="#1a2838" opacity="0.6" />
          <path d="M 56 36 L 88 36 L 90 52 L 54 52 Z" fill="url(#cv-glass)" />
          <path d="M 56 36 L 88 36 L 90 52 L 54 52 Z" fill="none" stroke="#3a5068" strokeWidth="0.8" />
          <line x1="72" y1="38" x2="72" y2="50" stroke="#2a4058" strokeWidth="0.5" opacity="0.6" />
          <rect x="58" y="38" width="10" height="5" fill="#4a6888" opacity="0.25" rx="0.5" />
          <line x1="68" y1="52" x2="68" y2="70" stroke="#1a2630" strokeWidth="0.8" />
          <rect x="70" y="58" width="3" height="2" fill="#4a5a68" />
          <path d="M 48 58 L 52 52 L 56 58 Z" fill="#2a3848" />
          <rect x="44" y="58" width="10" height="14" fill="url(#cv-metal-dark)" />
          <rect x="38" y="66" width="4" height="12" fill="#252f38" />
          <rect x="38" y="74" width="18" height="4" rx="1" fill="#303c48" />
          <rect x="52" y="74" width="4" height="4" rx="1" fill="#303c48" />
          <rect x="40" y="62" width="5" height="6" rx="1" fill="#1a2028" />
          <rect x="41" y="63" width="3" height="4" rx="0.5" fill="#ffe566" className="convoy-headlight" />
          <rect x="48" y="64" width="6" height="8" fill="#1a2228" />
          {[50, 52, 54].map((x) => (
            <line key={x} x1={x} y1="66" x2={x} y2="72" stroke="#2a3848" strokeWidth="0.8" />
          ))}
          <rect x="78" y="18" width="5" height="16" rx="1" fill="#2a3540" />
          <rect x="76" y="16" width="9" height="3" rx="1" fill="#3a4858" />
          <rect x="86" y="22" width="4" height="12" rx="1" fill="#2a3540" />
          <line x1="58" y1="28" x2="58" y2="14" stroke="#4a5a68" strokeWidth="0.8" />
          <circle cx="58" cy="13" r="1.2" fill="#6a7a88" />
          <line x1="252" y1="42" x2="252" y2="72" stroke="#3a4858" strokeWidth="1" />
          {[48, 54, 60, 66].map((y) => (
            <line key={y} x1="250" y1={y} x2="254" y2={y} stroke="#3a4858" strokeWidth="0.6" />
          ))}

          <g transform="translate(62, 78)"><g className={wheelClass}><Wheel r={9} /></g></g>
          <g transform="translate(78, 78)"><g className={wheelClass}><Wheel r={9} /></g></g>
          <g transform="translate(128, 78)"><g className={wheelClass}><Wheel r={9} /></g></g>
          <g transform="translate(144, 78)"><g className={wheelClass}><Wheel r={9} /></g></g>
          <g transform="translate(198, 78)"><g className={wheelClass}><Wheel r={9} /></g></g>
          <g transform="translate(214, 78)"><g className={wheelClass}><Wheel r={9} /></g></g>
        </g>

        {!stopped && (
          <g className="convoy-dust" opacity="0.35">
            <ellipse cx="30" cy="88" rx="18" ry="4" fill="#6a5848" />
            <ellipse cx="55" cy="90" rx="12" ry="3" fill="#5a4838" />
          </g>
        )}
      </svg>
    </div>
  );
}
