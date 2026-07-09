import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["400", "500", "700"], subsets: ["latin"] });

interface Props { colors: Record<string, string>; }

const CARDS = [
  { title: "Investor Brief", lines: [["Cap Rate", "6.8%"], ["Cash Flow", "$412/mo"]] },
  { title: "My Properties", lines: [["Est. Value", "$824,600"], ["Equity", "43%"]] },
  { title: "Saved Analyses", lines: [["1247 Oak Ave", "8.2"], ["82 Elm St", "7.4"]] },
  { title: "Investor Calculator", lines: [["CoC Return", "9.1%"], ["DSCR", "1.42"]] },
];

export const FScene5Investor = ({ colors }: Props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fadeIn = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [150, 164], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const op = fadeIn * fadeOut;

  const headOp = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const headY = interpolate(spring({ frame, fps, config: { damping: 22 } }), [0, 1], [24, 0]);

  return (
    <AbsoluteFill style={{ fontFamily, opacity: op, padding: "160px 60px 80px", flexDirection: "column" }}>
      <div style={{ textAlign: "center", opacity: headOp, transform: `translateY(${headY}px)`, marginBottom: 50 }}>
        <div style={{ fontSize: 14, letterSpacing: 3, textTransform: "uppercase", color: colors.accent, marginBottom: 12, fontWeight: 500 }}>
          For Investors
        </div>
        <div style={{ fontSize: 54, fontWeight: 700, color: colors.white, letterSpacing: -1, lineHeight: 1.15 }}>
          Everything investors{"\n"}need in one place.
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
        {CARDS.map((c, i) => {
          const delay = 25 + i * 18;
          const cOp = interpolate(frame, [delay, delay + 15], [0, 1], { extrapolateRight: "clamp" });
          const cScale = interpolate(spring({ frame: frame - delay, fps, config: { damping: 20 } }), [0, 1], [0.9, 1]);
          return (
            <div key={c.title} style={{
              opacity: cOp, transform: `scale(${cScale})`,
              background: "rgba(255,255,255,0.07)", border: `1px solid ${colors.primary}33`,
              borderRadius: 20, padding: 24, minHeight: 240,
            }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: colors.white, marginBottom: 18 }}>{c.title}</div>
              {c.lines.map(([k, v]) => (
                <div key={k} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 0", borderBottom: `1px solid ${colors.primary}22`,
                }}>
                  <div style={{ fontSize: 16, color: colors.muted }}>{k}</div>
                  <div style={{ fontSize: 20, color: colors.white, fontWeight: 700 }}>{v}</div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};