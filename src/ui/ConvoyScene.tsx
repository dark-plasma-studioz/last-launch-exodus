import type { ReactElement } from "react";
import type { LocationId } from "../engine/locations";
import { ConvoyVehicle } from "./ConvoyVehicle";

// ── SVG builder ───────────────────────────────────────────────────────────────
function svg(w: number, h: number, body: string): string {
  const raw = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${body}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(raw)}")`;
}

// ── Biome theme definitions ───────────────────────────────────────────────────
interface SceneTheme {
  sky: string;
  farImg: string;
  midImg: string;
  groundTop: string;
  groundBot: string;
}

const THEMES: Record<LocationId, SceneTheme> = {
  // ── OPEN WASTES ──────────────────────────────────────────────────────────
  open_waste: {
    sky: "linear-gradient(180deg, #7a3808 0%, #bf6a18 38%, #d49030 68%, #c8a040 100%)",
    farImg: svg(800, 80, `
      <polygon points="0,80 55,22 108,52 168,8 245,36 336,4 412,32 500,12 578,42 648,18 752,48 800,28 800,80" fill="#5a2808"/>
      <polygon points="0,80 88,64 178,75 270,61 360,70 450,62 540,72 632,62 720,73 800,64 800,80" fill="#8a5015" opacity="0.65"/>
    `),
    midImg: svg(500, 72, `
      <rect x="28" y="18" width="16" height="54" fill="#4e2205"/>
      <rect x="35" y="8" width="10" height="14" fill="#4e2205"/>
      <rect x="138" y="28" width="32" height="44" fill="#4e2205"/>
      <rect x="150" y="16" width="12" height="16" fill="#4e2205"/>
      <rect x="288" y="12" width="13" height="60" fill="#4e2205"/>
      <rect x="295" y="3" width="8" height="13" fill="#4e2205"/>
      <rect x="400" y="34" width="42" height="38" fill="#4e2205"/>
      <ellipse cx="100" cy="74" rx="75" ry="16" fill="#965a18" opacity="0.55"/>
      <ellipse cx="350" cy="76" rx="65" ry="13" fill="#965a18" opacity="0.45"/>
    `),
    groundTop: "#9a6018",
    groundBot: "#7a4810",
  },

  // ── ABANDONED CITY ───────────────────────────────────────────────────────
  abandoned_city: {
    sky: "linear-gradient(180deg, #060610 0%, #0d0d1c 50%, #121228 100%)",
    farImg: svg(800, 100, `
      <rect x="20" y="8" width="42" height="92" fill="#0e0e1e"/>
      <rect x="78" y="30" width="28" height="70" fill="#0e0e1e"/>
      <rect x="125" y="0" width="52" height="100" fill="#0c0c1a"/>
      <rect x="193" y="22" width="38" height="78" fill="#0e0e1e"/>
      <rect x="255" y="5" width="58" height="95" fill="#0a0a18"/>
      <rect x="338" y="18" width="33" height="82" fill="#0e0e1e"/>
      <rect x="393" y="38" width="52" height="62" fill="#0e0e1e"/>
      <rect x="463" y="3" width="68" height="97" fill="#0a0a18"/>
      <rect x="543" y="28" width="40" height="72" fill="#0e0e1e"/>
      <rect x="603" y="13" width="33" height="87" fill="#0e0e1e"/>
      <rect x="653" y="0" width="48" height="100" fill="#0a0a18"/>
      <rect x="718" y="42" width="28" height="58" fill="#0e0e1e"/>
      <rect x="760" y="22" width="38" height="78" fill="#0e0e1e"/>
      <rect x="140" y="12" width="6" height="4" fill="#151540" opacity="0.6"/>
      <rect x="272" y="20" width="6" height="4" fill="#151540" opacity="0.5"/>
      <rect x="480" y="16" width="6" height="4" fill="#151540" opacity="0.6"/>
      <rect x="30" y="30" width="5" height="3" fill="#151540" opacity="0.4"/>
      <rect x="670" y="18" width="5" height="3" fill="#151540" opacity="0.4"/>
    `),
    midImg: svg(500, 72, `
      <rect x="10" y="18" width="23" height="54" fill="#0b0b1a"/>
      <rect x="67" y="32" width="18" height="40" fill="#0b0b1a"/>
      <rect x="157" y="23" width="28" height="49" fill="#0b0b1a"/>
      <rect x="238" y="38" width="20" height="34" fill="#0b0b1a"/>
      <rect x="297" y="13" width="37" height="59" fill="#0b0b1a"/>
      <rect x="398" y="28" width="26" height="44" fill="#0b0b1a"/>
      <rect x="447" y="18" width="33" height="54" fill="#0b0b1a"/>
      <rect x="18" y="22" width="5" height="4" fill="#0f0f38" opacity="0.7"/>
      <rect x="307" y="20" width="5" height="4" fill="#0f0f38" opacity="0.6"/>
    `),
    groundTop: "#0f0f18",
    groundBot: "#0b0b12",
  },

  // ── INDUSTRIAL STRIP ─────────────────────────────────────────────────────
  industrial_strip: {
    sky: "linear-gradient(180deg, #120404 0%, #1e0a0a 45%, #281010 100%)",
    farImg: svg(800, 90, `
      <rect x="38" y="0" width="18" height="90" fill="#180606"/>
      <rect x="33" y="0" width="28" height="6" fill="#200a0a"/>
      <rect x="148" y="13" width="12" height="77" fill="#180606"/>
      <rect x="143" y="13" width="22" height="5" fill="#200a0a"/>
      <rect x="298" y="0" width="22" height="90" fill="#180606"/>
      <rect x="293" y="0" width="32" height="7" fill="#200a0a"/>
      <rect x="448" y="9" width="16" height="81" fill="#180606"/>
      <rect x="443" y="9" width="26" height="5" fill="#200a0a"/>
      <rect x="598" y="0" width="20" height="90" fill="#180606"/>
      <rect x="593" y="0" width="30" height="6" fill="#200a0a"/>
      <rect x="698" y="18" width="14" height="72" fill="#180606"/>
      <rect x="100" y="30" width="40" height="60" fill="#180606"/>
      <rect x="380" y="25" width="55" height="65" fill="#180606"/>
      <rect x="520" y="35" width="60" height="55" fill="#180606"/>
      <ellipse cx="47" cy="6" rx="14" ry="5" fill="#2e0f0f" opacity="0.55"/>
      <ellipse cx="307" cy="6" rx="16" ry="6" fill="#2e0f0f" opacity="0.5"/>
      <ellipse cx="607" cy="6" rx="14" ry="5" fill="#2e0f0f" opacity="0.5"/>
    `),
    midImg: svg(500, 72, `
      <rect x="18" y="28" width="75" height="18" fill="#160505"/>
      <rect x="93" y="32" width="18" height="16" fill="#160505"/>
      <circle cx="145" cy="38" r="16" fill="#160505"/>
      <rect x="198" y="18" width="10" height="54" fill="#160505"/>
      <rect x="217" y="23" width="55" height="13" fill="#160505"/>
      <circle cx="315" cy="36" r="18" fill="#160505"/>
      <rect x="348" y="28" width="65" height="16" fill="#160505"/>
      <rect x="428" y="13" width="10" height="59" fill="#160505"/>
      <rect x="456" y="26" width="28" height="12" fill="#160505"/>
    `),
    groundTop: "#0e0404",
    groundBot: "#0a0303",
  },

  // ── DEAD HIGHWAY ─────────────────────────────────────────────────────────
  dead_highway: {
    sky: "linear-gradient(180deg, #040408 0%, #08080f 55%, #0c0c15 100%)",
    farImg: svg(800, 80, `
      <line x1="58" y1="80" x2="58" y2="18" stroke="#181818" stroke-width="4"/>
      <line x1="58" y1="28" x2="43" y2="13" stroke="#181818" stroke-width="2"/>
      <line x1="58" y1="38" x2="73" y2="23" stroke="#181818" stroke-width="2"/>
      <line x1="198" y1="80" x2="198" y2="13" stroke="#181818" stroke-width="3"/>
      <line x1="198" y1="23" x2="183" y2="8" stroke="#181818" stroke-width="2"/>
      <line x1="198" y1="33" x2="213" y2="18" stroke="#181818" stroke-width="2"/>
      <line x1="498" y1="80" x2="498" y2="20" stroke="#181818" stroke-width="3"/>
      <line x1="498" y1="30" x2="483" y2="12" stroke="#181818" stroke-width="2"/>
      <line x1="498" y1="40" x2="513" y2="22" stroke="#181818" stroke-width="2"/>
      <line x1="698" y1="80" x2="698" y2="22" stroke="#181818" stroke-width="3"/>
      <line x1="698" y1="32" x2="683" y2="14" stroke="#181818" stroke-width="2"/>
      <polygon points="378,80 373,38 388,38" fill="none" stroke="#141420" stroke-width="2"/>
      <polygon points="388,38 383,8 393,8" fill="none" stroke="#141420" stroke-width="1.5"/>
      <line x1="368" y1="38" x2="398" y2="38" stroke="#141420" stroke-width="1.5"/>
      <polygon points="558,80 553,38 568,38" fill="none" stroke="#141420" stroke-width="2"/>
      <line x1="548" y1="38" x2="578" y2="38" stroke="#141420" stroke-width="1.5"/>
      <polygon points="658,80 653,38 668,38" fill="none" stroke="#141420" stroke-width="2"/>
      <line x1="648" y1="38" x2="678" y2="38" stroke="#141420" stroke-width="1.5"/>
    `),
    midImg: svg(500, 65, `
      <rect x="28" y="18" width="4" height="47" fill="#10101a"/>
      <rect x="18" y="18" width="20" height="13" fill="#10101a"/>
      <rect x="148" y="28" width="37" height="20" rx="3" fill="#10101a"/>
      <rect x="153" y="13" width="4" height="18" fill="#10101a"/>
      <rect x="278" y="33" width="55" height="18" rx="2" fill="#10101a"/>
      <rect x="358" y="23" width="4" height="42" fill="#10101a"/>
      <rect x="348" y="23" width="20" height="13" fill="#10101a"/>
      <rect x="428" y="36" width="47" height="16" rx="2" fill="#10101a"/>
    `),
    groundTop: "#0d0d14",
    groundBot: "#09090e",
  },

  // ── PORT SPRAWL ──────────────────────────────────────────────────────────
  port_sprawl: {
    sky: "linear-gradient(180deg, #020508 0%, #050b14 55%, #070d1a 100%)",
    farImg: svg(800, 90, `
      <rect x="78" y="8" width="7" height="82" fill="#080f1c"/>
      <rect x="68" y="8" width="26" height="5" fill="#080f1c"/>
      <rect x="83" y="8" width="4" height="28" fill="#0a1220"/>
      <rect x="248" y="4" width="9" height="86" fill="#080f1c"/>
      <rect x="233" y="4" width="33" height="6" fill="#080f1c"/>
      <rect x="253" y="4" width="4" height="33" fill="#0a1220"/>
      <rect x="480" y="40" width="245" height="50" fill="#070d18"/>
      <rect x="490" y="25" width="58" height="20" fill="#070d18"/>
      <rect x="558" y="20" width="48" height="25" fill="#070d18"/>
      <rect x="598" y="18" width="97" height="72" fill="#060c18"/>
      <rect x="648" y="8" width="10" height="12" fill="#060c18"/>
      <rect x="718" y="38" width="82" height="52" fill="#060c18"/>
    `),
    midImg: svg(500, 72, `
      <rect x="8" y="28" width="52" height="28" fill="#060d18" rx="2"/>
      <rect x="66" y="33" width="52" height="24" fill="#060d18" rx="2"/>
      <line x1="34" y1="28" x2="34" y2="56" stroke="#080f1e" stroke-width="1"/>
      <rect x="158" y="23" width="52" height="33" fill="#060d18" rx="2"/>
      <rect x="216" y="28" width="52" height="28" fill="#060d18" rx="2"/>
      <rect x="318" y="30" width="52" height="26" fill="#060d18" rx="2"/>
      <rect x="376" y="26" width="52" height="30" fill="#060d18" rx="2"/>
      <rect x="448" y="38" width="33" height="23" fill="#060d18"/>
      <rect x="453" y="28" width="5" height="13" fill="#060d18"/>
      <rect x="453" y="26" width="13" height="4" fill="#060d18"/>
    `),
    groundTop: "#050a14",
    groundBot: "#030710",
  },

  // ── EMBARK ───────────────────────────────────────────────────────────────
  embark: {
    sky: "linear-gradient(180deg, #010306 0%, #020608 60%, #030810 100%)",
    farImg: svg(800, 100, `
      <rect x="98" y="0" width="13" height="100" fill="#060d18"/>
      <rect x="88" y="18" width="33" height="5" fill="#060d18"/>
      <rect x="88" y="43" width="33" height="5" fill="#060d18"/>
      <rect x="88" y="68" width="33" height="5" fill="#060d18"/>
      <rect x="298" y="0" width="18" height="100" fill="#060d18"/>
      <rect x="285" y="23" width="42" height="5" fill="#060d18"/>
      <rect x="285" y="53" width="42" height="5" fill="#060d18"/>
      <rect x="285" y="78" width="42" height="5" fill="#060d18"/>
      <rect x="448" y="28" width="77" height="72" fill="#050c16"/>
      <rect x="468" y="18" width="38" height="13" fill="#050c16"/>
      <rect x="598" y="0" width="4" height="100" fill="#050c16"/>
      <rect x="593" y="38" width="13" height="3" fill="#050c16"/>
      <rect x="591" y="58" width="17" height="3" fill="#050c16"/>
      <rect x="648" y="48" width="117" height="52" fill="#050c16"/>
      <rect x="658" y="28" width="28" height="23" fill="#050c16"/>
      <rect x="718" y="18" width="38" height="32" fill="#050c16"/>
      <circle cx="104" cy="2" r="3" fill="#203060" opacity="0.8"/>
      <circle cx="307" cy="2" r="4" fill="#203060" opacity="0.7"/>
    `),
    midImg: svg(500, 72, `
      <rect x="0" y="50" width="500" height="3" fill="#040a14"/>
      <rect x="28" y="33" width="4" height="21" fill="#050b16"/>
      <rect x="78" y="36" width="4" height="18" fill="#050b16"/>
      <rect x="128" y="33" width="4" height="21" fill="#050b16"/>
      <rect x="178" y="36" width="4" height="18" fill="#050b16"/>
      <rect x="228" y="33" width="4" height="21" fill="#050b16"/>
      <rect x="278" y="36" width="4" height="18" fill="#050b16"/>
      <rect x="328" y="33" width="4" height="21" fill="#050b16"/>
      <rect x="378" y="36" width="4" height="18" fill="#050b16"/>
      <rect x="428" y="33" width="4" height="21" fill="#050b16"/>
      <rect x="478" y="36" width="4" height="18" fill="#050b16"/>
      <rect x="48" y="52" width="57" height="14" rx="2" fill="#050b16"/>
      <rect x="198" y="50" width="77" height="17" rx="2" fill="#050b16"/>
      <rect x="348" y="48" width="67" height="19" rx="2" fill="#050b16"/>
    `),
    groundTop: "#030810",
    groundBot: "#02060c",
  },
};

// ── ConvoyScene ───────────────────────────────────────────────────────────────
interface ConvoySceneProps {
  location: LocationId;
  stopped: boolean;
  children?: React.ReactNode;
}

export function ConvoyScene({ location, stopped, children }: ConvoySceneProps): ReactElement {
  const theme = THEMES[location];
  const animState = stopped ? "paused" : "running";

  return (
    <div className="convoy-scene" style={{ background: theme.sky }}>
      {/* Far parallax layer */}
      <div
        className="convoy-layer convoy-layer-far"
        style={{
          backgroundImage: theme.farImg,
          animationPlayState: animState,
        }}
      />

      {/* Mid parallax layer */}
      <div
        className="convoy-layer convoy-layer-mid"
        style={{
          backgroundImage: theme.midImg,
          animationPlayState: animState,
        }}
      />

      {/* Ground strip */}
      <div
        className="convoy-ground"
        style={{
          background: `linear-gradient(180deg, ${theme.groundTop} 0%, ${theme.groundBot} 100%)`,
        }}
      />

      {/* Road surface + dashes */}
      <div
        className="convoy-road"
        style={{ animationPlayState: animState }}
      />

      {/* The convoy vehicle */}
      <div className="convoy-vehicle-anchor">
        <ConvoyVehicle stopped={stopped} />
      </div>

      {/* Overlay content (event panel, etc.) */}
      {children && (
        <div className="convoy-overlay-content">{children}</div>
      )}
    </div>
  );
}
