import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["400", "500", "700"], subsets: ["latin"] });

interface Props { colors: Record<string, string>; }

const CAPS = [
  { icon: "◎", title: "Market Intelligence", desc: "Search that reads the market like a language" },
  { icon: "◆", title: "Property Analysis", desc: "Any listing, URL or Zillow — instant deep-dive" },
  { icon: "▤", title: "Compare Properties", desc: "Side-by-side across every metric that matters" },
  { icon: "$", title: "Financial Calculators", desc: "Buying power, mortgage, cash flow" },
  { icon: "◐", title: "Chrome Extension", desc: "Analyze any listing directly on Zillow" },
];

export const FScene3Capabilities = ({ colors }: Props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fadeIn = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [135, 149], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const op = fadeIn * fadeOut;

  const headOp = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const headY = interpolate(spring({ frame, fps, config: { damping: 22 } }), [0, 1], [24, 0]);

  return (
    <AbsoluteFill style={{ fontFamily, opacity: op, padding: "140px 40px 60px", flexDirection: "column" }}>
      <div style={{ textAlign: "center", opacity: headOp, transform: `translateY(${headY}px)`, marginBottom: 56 }}>
        <div style={{ fontSize: 20, letterSpacing: 4, textTransform: "uppercase", color: colors.accent, marginBottom: 16, fontWeight: 500 }}>
          Everything in one place
        </div>
        <div style={{ fontSize: 82, fontWeight: 700, color: colors.white, letterSpacing: -2, lineHeight: 1.1 }}>
          Five tools.{"\n"}One decision engine.
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {CAPS.map((c, i) => {
          const delay = 20 + i * 15;
          const cOp = interpolate(frame, [delay, delay + 15], [0, 1], { extrapolateRight: "clamp" });
          const cX = interpolate(spring({ frame: frame - delay, fps, config: { damping: 22 } }), [0, 1], [-40, 0]);
          return (
            <div key={c.title} style={{
              opacity: cOp, transform: `translateX(${cX}px)`,
              display: "flex", alignItems: "center", gap: 26,
              background: "rgba(255,255,255,0.06)", border: `1px solid ${colors.primary}33`,
              borderRadius: 22, padding: "30px 32px",
            }}>
              <div style={{
                width: 92, height: 92, borderRadius: 20, background: `${colors.primary}44`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 46, color: colors.accent, fontWeight: 700, flexShrink: 0,
              }}>{c.icon}</div>
              <div>
                <div style={{ fontSize: 38, fontWeight: 700, color: colors.white }}>{c.title}</div>
                <div style={{ fontSize: 24, color: colors.muted, marginTop: 6, lineHeight: 1.35 }}>{c.desc}</div>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};