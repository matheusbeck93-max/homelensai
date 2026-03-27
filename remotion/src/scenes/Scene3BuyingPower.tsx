import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["700", "400", "600"], subsets: ["latin"] });

interface Props {
  colors: Record<string, string>;
}

export const Scene3BuyingPower = ({ colors }: Props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOp = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });

  const tagOp = interpolate(frame, [12, 30], [0, 1], { extrapolateRight: "clamp" });

  const cardScale = spring({ frame: frame - 15, fps, config: { damping: 14 } });
  const cardOp = interpolate(frame, [15, 30], [0, 1], { extrapolateRight: "clamp" });

  const metrics = [
    { label: "Annual Income", value: "$95,000", delay: 25 },
    { label: "Monthly Debts", value: "$650", delay: 32 },
    { label: "Down Payment", value: "$45,000", delay: 39 },
    { label: "Max Purchase Price", value: "$425,000", highlight: true, delay: 48 },
    { label: "Comfortable Monthly", value: "$2,800/mo", highlight: true, delay: 55 },
  ];

  const aiOp = interpolate(frame, [70, 85], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ fontFamily, padding: 80 }}>
      <div style={{ display: "flex", height: "100%", gap: 60 }}>
        {/* Left text */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{
            opacity: titleOp, fontSize: 50, fontWeight: 700, color: colors.white, lineHeight: 1.15,
          }}>
            Find Out How Much<br />
            <span style={{ color: colors.accent }}>You Can Afford</span>
          </div>
          <div style={{
            opacity: tagOp, fontSize: 20, color: colors.muted, marginTop: 24, lineHeight: 1.7, maxWidth: 440,
          }}>
            Find out exactly how much home you can afford — personalized to your income, debts, and goals.
          </div>

          <div style={{
            opacity: aiOp, marginTop: 32, display: "inline-flex", alignItems: "center", gap: 10,
            padding: "12px 20px", borderRadius: 12,
            background: `rgba(107, 141, 181, 0.15)`, border: `1px solid rgba(107, 141, 181, 0.2)`,
          }}>
            <span style={{ fontSize: 18 }}>🤖</span>
            <span style={{ fontSize: 15, color: colors.accent }}>AI Insights analyze your buying power</span>
          </div>
        </div>

        {/* Right card */}
        <div style={{
          flex: 1, opacity: cardOp, transform: `scale(${cardScale})`,
          background: `rgba(58, 80, 104, 0.65)`, borderRadius: 24,
          border: `1px solid rgba(163, 196, 224, 0.25)`, padding: 36,
          display: "flex", flexDirection: "column", justifyContent: "center",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
            <span style={{ fontSize: 28 }}>💰</span>
            <span style={{ fontSize: 24, fontWeight: 700, color: colors.white }}>Buying Power Calculator</span>
          </div>

          {metrics.map((m, i) => {
            const op = interpolate(frame, [m.delay, m.delay + 12], [0, 1], { extrapolateRight: "clamp" });
            const x = interpolate(
              spring({ frame: frame - m.delay, fps, config: { damping: 18 } }),
              [0, 1], [30, 0]
            );
            return (
              <div key={i} style={{
                opacity: op, transform: `translateX(${x}px)`,
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "14px 0",
                borderBottom: i < metrics.length - 1 ? `1px solid rgba(107, 141, 181, 0.12)` : "none",
              }}>
                <span style={{ fontSize: 17, color: colors.muted }}>{m.label}</span>
                <span style={{
                  fontSize: m.highlight ? 26 : 20, fontWeight: 700,
                  color: m.highlight ? colors.accent : colors.white,
                }}>{m.value}</span>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
