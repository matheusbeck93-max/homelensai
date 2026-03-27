import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["700", "500", "400"], subsets: ["latin"] });

interface Props {
  colors: Record<string, string>;
}

export const Scene3Features = ({ colors }: Props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const titleX = interpolate(
    spring({ frame, fps, config: { damping: 20, stiffness: 150 } }),
    [0, 1], [80, 0]
  );

  const features = [
    { icon: "🤖", label: "AI Property Analysis", delay: 20 },
    { icon: "🗺️", label: "Interactive Map View", delay: 30 },
    { icon: "🏘️", label: "Neighborhood Insights", delay: 40 },
    { icon: "🎭", label: "Neighborhood Personality", delay: 50 },
    { icon: "📄", label: "PDF Export", delay: 60 },
    { icon: "🔗", label: "External Links & Sources", delay: 70 },
  ];

  // Mockup property card
  const cardOpacity = interpolate(frame, [15, 35], [0, 1], { extrapolateRight: "clamp" });
  const cardScale = spring({ frame: frame - 15, fps, config: { damping: 14 } });

  return (
    <AbsoluteFill style={{ fontFamily, padding: 80 }}>
      {/* Title */}
      <div style={{ position: "absolute", right: 80, top: 100, textAlign: "right" }}>
        <div
          style={{
            opacity: titleOpacity,
            transform: `translateX(${titleX}px)`,
            fontSize: 50,
            fontWeight: 700,
            color: colors.white,
            lineHeight: 1.2,
          }}
        >
          Property
          <br />
          <span style={{ color: colors.accent }}>Deep Dive</span>
        </div>
        <div
          style={{
            opacity: interpolate(frame, [15, 35], [0, 1], { extrapolateRight: "clamp" }),
            fontSize: 19,
            color: colors.muted,
            marginTop: 16,
            maxWidth: 380,
            lineHeight: 1.6,
          }}
        >
          Every listing gets AI-powered analysis,
          <br />
          neighborhood insights, and export tools.
        </div>
      </div>

      {/* Property Card Mock */}
      <div
        style={{
          position: "absolute",
          left: 80,
          top: 100,
          width: 680,
          opacity: cardOpacity,
          transform: `scale(${cardScale})`,
        }}
      >
        <div
          style={{
            background: `rgba(58, 80, 104, 0.7)`,
            borderRadius: 20,
            border: `1px solid rgba(107, 141, 181, 0.25)`,
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div style={{ padding: "24px 28px", borderBottom: `1px solid rgba(107, 141, 181, 0.15)` }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: colors.white }}>123 Oak Street, Austin TX</div>
            <div style={{ fontSize: 18, color: colors.accent, marginTop: 6 }}>$385,000 • 3 bed • 2 bath • 1,850 sqft</div>
          </div>

          {/* AI Score */}
          <div style={{ padding: "20px 28px", display: "flex", gap: 20, alignItems: "center", borderBottom: `1px solid rgba(107, 141, 181, 0.15)` }}>
            <div style={{
              width: 64, height: 64, borderRadius: 32,
              background: `linear-gradient(135deg, ${colors.primary}, ${colors.accent})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 24, fontWeight: 700, color: colors.white,
            }}>
              87
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: colors.white }}>AI Investment Score</div>
              <div style={{ fontSize: 14, color: colors.muted }}>Strong buy signal • Above market average</div>
            </div>
          </div>

          {/* Feature list */}
          <div style={{ padding: "20px 28px", display: "flex", flexWrap: "wrap", gap: 12 }}>
            {features.map((f, i) => {
              const op = interpolate(frame, [f.delay, f.delay + 12], [0, 1], { extrapolateRight: "clamp" });
              const s = spring({ frame: frame - f.delay, fps, config: { damping: 14, stiffness: 120 } });
              return (
                <div
                  key={i}
                  style={{
                    opacity: op,
                    transform: `scale(${s})`,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 16px",
                    borderRadius: 10,
                    background: `rgba(107, 141, 181, 0.15)`,
                    border: `1px solid rgba(107, 141, 181, 0.2)`,
                  }}
                >
                  <span style={{ fontSize: 20 }}>{f.icon}</span>
                  <span style={{ fontSize: 14, color: colors.white, fontWeight: 500 }}>{f.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
