import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["400", "500", "700"], subsets: ["latin"] });

interface Props { colors: Record<string, string>; }

const FEATURES = [
  { label: "AI Summary", desc: "Every listing, decoded in seconds.", icon: "sparkle" },
  { label: "Neighborhood Insights", desc: "Schools, safety, and vibe at a glance.", icon: "map" },
  { label: "Property Analysis", desc: "Fair price, red flags, hidden risks.", icon: "shield" },
  { label: "Investment Score", desc: "Cap rate, cash flow, deal grade.", icon: "chart" },
  { label: "Market History", desc: "Price cuts and days on market.", icon: "clock" },
  { label: "Ask AI Anything", desc: "Your real estate expert, on demand.", icon: "chat" },
];

const CARD_DURATION = 50;

const Icon = ({ name, color }: { name: string; color: string }) => {
  const s = { width: 56, height: 56, stroke: color, strokeWidth: 2.2, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "sparkle": return (<svg viewBox="0 0 24 24" style={s}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/></svg>);
    case "map": return (<svg viewBox="0 0 24 24" style={s}><path d="M9 3L3 6v15l6-3 6 3 6-3V3l-6 3-6-3zM9 3v15M15 6v15"/></svg>);
    case "shield": return (<svg viewBox="0 0 24 24" style={s}><path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z"/><path d="M9 12l2 2 4-4"/></svg>);
    case "chart": return (<svg viewBox="0 0 24 24" style={s}><path d="M3 20h18M6 20V10M11 20V4M16 20v-8M21 20v-6"/></svg>);
    case "clock": return (<svg viewBox="0 0 24 24" style={s}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>);
    case "chat": return (<svg viewBox="0 0 24 24" style={s}><path d="M4 4h16v12H8l-4 4V4z"/><path d="M8 10h8M8 13h5"/></svg>);
    default: return null;
  }
};

export const CScene4Features = ({ colors }: Props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [285, 299], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const op = fadeIn * fadeOut;

  // Eyebrow header persistent
  const headerOp = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ fontFamily, opacity: op }}>
      <div style={{
        position: "absolute", top: 200, left: 60, right: 60, textAlign: "center", opacity: headerOp,
      }}>
        <div style={{ fontSize: 16, color: colors.accent, fontWeight: 500, letterSpacing: 2, textTransform: "uppercase" }}>
          What you get
        </div>
      </div>

      {FEATURES.map((f, i) => {
        const start = i * CARD_DURATION;
        const localFrame = frame - start;
        if (localFrame < -10 || localFrame > CARD_DURATION + 5) return null;

        const cardIn = interpolate(localFrame, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const cardOut = interpolate(localFrame, [CARD_DURATION - 12, CARD_DURATION], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const cOp = cardIn * cardOut;
        const s = interpolate(spring({ frame: localFrame, fps, config: { damping: 20, stiffness: 100 } }), [0, 1], [0.94, 1]);
        // Subtle zoom over its life
        const zoom = interpolate(localFrame, [0, CARD_DURATION], [1, 1.04]);

        return (
          <div key={i} style={{
            position: "absolute", left: 80, right: 80, top: 640,
            opacity: cOp, transform: `scale(${s * zoom})`,
            background: "rgba(255,255,255,0.06)",
            border: `1px solid ${colors.primary}44`,
            borderRadius: 24,
            padding: 44,
            display: "flex", flexDirection: "column", alignItems: "center", gap: 24,
            boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
          }}>
            <div style={{
              width: 120, height: 120, borderRadius: 30,
              background: `${colors.primary}33`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Icon name={f.icon} color={colors.white} />
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 46, fontWeight: 700, color: colors.white, letterSpacing: -0.5 }}>{f.label}</div>
              <div style={{ fontSize: 22, color: colors.muted, marginTop: 14, lineHeight: 1.5 }}>{f.desc}</div>
            </div>
            <div style={{
              marginTop: 10, fontSize: 14, color: colors.mutedDark, letterSpacing: 2,
            }}>
              {String(i + 1).padStart(2, "0")} / {String(FEATURES.length).padStart(2, "0")}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};