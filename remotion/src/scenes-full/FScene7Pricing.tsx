import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["400", "500", "700"], subsets: ["latin"] });

interface Props { colors: Record<string, string>; }

const TIERS = [
  { name: "Free", price: "$0", note: "Get started", feats: ["Property analysis", "AI chat basics"] },
  { name: "Buyer", price: "$9.97", note: "Most popular", feats: ["Unlimited analyses", "Match scores", "Compare homes"], highlight: true },
  { name: "Investor", price: "$24.97", note: "For pros", feats: ["Investor brief", "Advanced calculators", "Saved analyses"] },
];

export const FScene7Pricing = ({ colors }: Props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fadeIn = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [90, 104], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const op = fadeIn * fadeOut;

  const headOp = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const headY = interpolate(spring({ frame, fps, config: { damping: 22 } }), [0, 1], [24, 0]);

  return (
    <AbsoluteFill style={{ fontFamily, opacity: op, padding: "140px 40px 60px", flexDirection: "column" }}>
      <div style={{ textAlign: "center", opacity: headOp, transform: `translateY(${headY}px)`, marginBottom: 56 }}>
        <div style={{ fontSize: 82, fontWeight: 700, color: colors.white, letterSpacing: -2, lineHeight: 1.1 }}>
          Simple, transparent{"\n"}pricing.
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {TIERS.map((t, i) => {
          const delay = 20 + i * 14;
          const cOp = interpolate(frame, [delay, delay + 15], [0, 1], { extrapolateRight: "clamp" });
          const cScale = interpolate(spring({ frame: frame - delay, fps, config: { damping: 20 } }), [0, 1], [0.92, 1]);
          return (
            <div key={t.name} style={{
              opacity: cOp, transform: `scale(${cScale})`,
              background: t.highlight ? colors.primary : "rgba(255,255,255,0.06)",
              border: t.highlight ? `2px solid ${colors.accent}` : `1px solid ${colors.primary}44`,
              borderRadius: 22, padding: 34,
              display: "flex", alignItems: "center", gap: 24,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 18, letterSpacing: 3, textTransform: "uppercase", color: t.highlight ? colors.white : colors.accent, fontWeight: 500 }}>
                  {t.note}
                </div>
                <div style={{ fontSize: 44, fontWeight: 700, color: colors.white, marginTop: 6 }}>{t.name}</div>
                <div style={{ fontSize: 20, color: t.highlight ? colors.offWhite : colors.muted, marginTop: 10, lineHeight: 1.35 }}>
                  {t.feats.join(" · ")}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 64, fontWeight: 700, color: colors.white, letterSpacing: -1.5 }}>{t.price}</div>
                <div style={{ fontSize: 18, color: t.highlight ? colors.offWhite : colors.mutedDark }}>/mo</div>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};