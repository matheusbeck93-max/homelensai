import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["700", "400", "600"], subsets: ["latin"] });

interface Props {
  colors: Record<string, string>;
}

export const Scene4Calculators = ({ colors }: Props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const bars = [
    { label: "Year 1", value: 45, color: colors.primary },
    { label: "Year 3", value: 62, color: colors.primary },
    { label: "Year 5", value: 78, color: colors.primaryLight },
    { label: "Year 10", value: 95, color: colors.accent },
  ];

  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ fontFamily, padding: 80 }}>
      <div style={{ position: "absolute", right: 80, top: 140, textAlign: "right" }}>
        <div
          style={{
            opacity: titleOpacity,
            fontSize: 52,
            fontWeight: 700,
            color: colors.white,
            lineHeight: 1.2,
          }}
        >
          Investment
          <br />
          <span style={{ color: colors.accent }}>Intelligence</span>
        </div>
        <div
          style={{
            opacity: interpolate(frame, [15, 35], [0, 1], { extrapolateRight: "clamp" }),
            fontSize: 20,
            color: colors.muted,
            marginTop: 20,
            maxWidth: 400,
            lineHeight: 1.6,
          }}
        >
          Mortgage calculators, ROI projections,
          <br />
          and buying power analysis.
        </div>

        {[
          { label: "Avg ROI", val: "8.2%", delay: 40 },
          { label: "Cap Rate", val: "5.4%", delay: 50 },
          { label: "Cash Flow", val: "$850/mo", delay: 60 },
        ].map((s, i) => {
          const op = interpolate(frame, [s.delay, s.delay + 15], [0, 1], { extrapolateRight: "clamp" });
          return (
            <div key={i} style={{ opacity: op, display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 18, alignItems: "center" }}>
              <span style={{ fontSize: 16, color: colors.muted }}>{s.label}</span>
              <span style={{ fontSize: 28, fontWeight: 700, color: colors.accent }}>{s.val}</span>
            </div>
          );
        })}
      </div>

      <div
        style={{
          position: "absolute",
          left: 80,
          top: 120,
          width: 650,
          height: 700,
          background: `rgba(58, 80, 104, 0.6)`,
          borderRadius: 24,
          border: `1px solid rgba(107, 141, 181, 0.2)`,
          padding: 40,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 600, color: colors.white, marginBottom: 30 }}>
          Property Value Growth Projection
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 30, height: 400 }}>
          {bars.map((bar, i) => {
            const delay = 25 + i * 12;
            const barHeight = interpolate(
              spring({ frame: frame - delay, fps, config: { damping: 15, stiffness: 80 } }),
              [0, 1], [0, bar.value * 3.8]
            );
            return (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, flex: 1 }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: bar.color, opacity: interpolate(frame, [delay + 10, delay + 20], [0, 1], { extrapolateRight: "clamp" }) }}>
                  {bar.value}%
                </span>
                <div
                  style={{
                    width: "100%",
                    height: barHeight,
                    background: `linear-gradient(to top, ${bar.color}, ${bar.color}88)`,
                    borderRadius: "12px 12px 4px 4px",
                  }}
                />
                <span style={{ fontSize: 14, color: colors.muted }}>{bar.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
