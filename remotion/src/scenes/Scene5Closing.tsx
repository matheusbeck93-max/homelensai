import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Img, staticFile } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["700", "400", "500"], subsets: ["latin"] });

interface Props {
  colors: Record<string, string>;
}

export const Scene5Closing = ({ colors }: Props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phase 1: Comparison feature (frames 0-80)
  const compTitle = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });

  const properties = [
    { addr: "123 Oak St", price: "$385,000", beds: "3 bed", score: "87" },
    { addr: "456 Elm Ave", price: "$412,000", beds: "4 bed", score: "82" },
    { addr: "789 Pine Dr", price: "$365,000", beds: "3 bed", score: "91" },
  ];

  // Phase 2: Closing (frames 80+)
  const closingPhase = frame > 80;
  const closingOpacity = interpolate(frame, [80, 100], [0, 1], { extrapolateRight: "clamp" });

  const logoScale = spring({ frame: frame - 85, fps, config: { damping: 12, stiffness: 100 } });
  const ctaOpacity = interpolate(frame, [110, 130], [0, 1], { extrapolateRight: "clamp" });
  const ctaScale = spring({ frame: frame - 110, fps, config: { damping: 14 } });
  const glowOpacity = 0.12 + Math.sin(frame * 0.05) * 0.06;

  const lineWidth = interpolate(
    spring({ frame: frame - 100, fps, config: { damping: 200 } }),
    [0, 1], [0, 500]
  );

  return (
    <AbsoluteFill style={{ fontFamily }}>
      {/* Comparison section */}
      {!closingPhase && (
        <div style={{ padding: 80, height: "100%", display: "flex", flexDirection: "column" }}>
          <div style={{ opacity: compTitle, fontSize: 48, fontWeight: 700, color: colors.white, textAlign: "center", marginBottom: 16 }}>
            Side-by-Side{" "}
            <span style={{ color: colors.accent }}>Comparison</span>
          </div>
          <div style={{
            opacity: interpolate(frame, [10, 25], [0, 1], { extrapolateRight: "clamp" }),
            fontSize: 19, color: colors.muted, textAlign: "center", marginBottom: 40,
          }}>
            Compare properties instantly via the floating bar
          </div>

          <div style={{ display: "flex", gap: 24, flex: 1, alignItems: "stretch" }}>
            {properties.map((p, i) => {
              const delay = 15 + i * 12;
              const op = interpolate(frame, [delay, delay + 15], [0, 1], { extrapolateRight: "clamp" });
              const y = interpolate(
                spring({ frame: frame - delay, fps, config: { damping: 14 } }),
                [0, 1], [60, 0]
              );
              return (
                <div
                  key={i}
                  style={{
                    opacity: op,
                    transform: `translateY(${y}px)`,
                    flex: 1,
                    background: `rgba(58, 80, 104, 0.7)`,
                    borderRadius: 20,
                    border: `1px solid rgba(107, 141, 181, 0.25)`,
                    padding: 28,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 16,
                  }}
                >
                  <div style={{
                    width: 70, height: 70, borderRadius: 35,
                    background: `linear-gradient(135deg, ${colors.primary}, ${colors.accent})`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 26, fontWeight: 700, color: colors.white,
                  }}>
                    {p.score}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: colors.white }}>{p.addr}</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: colors.accent }}>{p.price}</div>
                  <div style={{ fontSize: 16, color: colors.muted }}>{p.beds} • 2 bath</div>
                </div>
              );
            })}
          </div>

          {/* Floating bar mock */}
          <div
            style={{
              opacity: interpolate(frame, [55, 70], [0, 1], { extrapolateRight: "clamp" }),
              transform: `translateY(${interpolate(spring({ frame: frame - 55, fps, config: { damping: 14 } }), [0, 1], [30, 0])}px)`,
              marginTop: 24,
              padding: "16px 32px",
              borderRadius: 16,
              background: `rgba(44, 62, 85, 0.9)`,
              border: `1px solid rgba(107, 141, 181, 0.3)`,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 20,
            }}
          >
            <span style={{ fontSize: 16, color: colors.muted }}>3 properties selected</span>
            <div style={{ padding: "8px 24px", borderRadius: 10, background: colors.primary, fontSize: 16, fontWeight: 600, color: colors.white }}>
              Compare Now
            </div>
          </div>
        </div>
      )}

      {/* Closing */}
      {closingPhase && (
        <div style={{ opacity: closingOpacity, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%" }}>
          <div
            style={{
              position: "absolute",
              width: 600, height: 600,
              borderRadius: "50%",
              background: colors.primary,
              opacity: glowOpacity,
              filter: "blur(120px)",
            }}
          />

          <div style={{ transform: `scale(${logoScale})`, marginBottom: 20 }}>
            <Img
              src={staticFile("images/logo.png")}
              style={{ width: 140, height: 140, objectFit: "contain" }}
            />
          </div>

          <div style={{ fontSize: 68, fontWeight: 700, color: colors.white, letterSpacing: -2 }}>
            Home<span style={{ color: colors.primaryLight }}>Lens</span>
          </div>

          <div
            style={{
              width: lineWidth,
              height: 2,
              background: `linear-gradient(90deg, transparent, ${colors.accent}, transparent)`,
              margin: "18px 0",
            }}
          />

          <div style={{ fontSize: 26, color: colors.muted, textAlign: "center", lineHeight: 1.5 }}>
            Smarter Real Estate Decisions,
            <br />
            Powered by AI
          </div>

          <div
            style={{
              opacity: ctaOpacity,
              transform: `scale(${ctaScale})`,
              marginTop: 36,
              padding: "14px 44px",
              borderRadius: 50,
              background: `linear-gradient(135deg, ${colors.primary}, ${colors.primaryLight})`,
              fontSize: 20,
              fontWeight: 700,
              color: colors.white,
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            Try HomeLens Today
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
