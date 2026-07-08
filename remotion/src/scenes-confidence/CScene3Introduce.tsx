import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Img, staticFile } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["400", "500", "700"], subsets: ["latin"] });

interface Props { colors: Record<string, string>; }

export const CScene3Introduce = ({ colors }: Props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [105, 119], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const op = fadeIn * fadeOut;

  // Panel slides in from the right
  const panelX = interpolate(
    spring({ frame, fps, config: { damping: 22, stiffness: 90 } }),
    [0, 1], [600, 0]
  );

  const textOp = interpolate(frame, [35, 55], [0, 1], { extrapolateRight: "clamp" });
  const textY = interpolate(spring({ frame: frame - 35, fps, config: { damping: 20 } }), [0, 1], [30, 0]);

  return (
    <AbsoluteFill style={{ fontFamily, opacity: op }}>
      {/* Dim background listing hint */}
      <div style={{
        position: "absolute", left: 80, top: 240, right: 80, height: 900,
        background: "rgba(255,255,255,0.04)", borderRadius: 20,
        border: "1px solid rgba(255,255,255,0.06)",
      }} />

      {/* Extension panel */}
      <div style={{
        position: "absolute", right: 60, top: 320,
        width: 620,
        transform: `translateX(${panelX}px)`,
        background: colors.dark,
        borderRadius: 20,
        border: `1px solid ${colors.primary}55`,
        boxShadow: "0 20px 80px rgba(0,0,0,0.6)",
        padding: 28,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
          <Img src={staticFile("images/logo.png")} style={{ width: 46, height: 46, objectFit: "contain" }} />
          <div style={{ fontSize: 26, fontWeight: 700, color: colors.white }}>HomeLens</div>
          <div style={{
            marginLeft: "auto", fontSize: 12, fontWeight: 500, color: colors.accent,
            padding: "4px 10px", background: `${colors.primary}33`, borderRadius: 999,
          }}>Chrome Extension</div>
        </div>
        <div style={{ height: 1, background: `${colors.primary}33`, marginBottom: 20 }} />
        <div style={{ fontSize: 14, color: colors.accent, fontWeight: 500, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>
          AI Summary
        </div>
        <div style={{ fontSize: 20, color: colors.offWhite, lineHeight: 1.5 }}>
          Fair-priced 4-bed near top-rated schools. Long DOM likely due to seasonal slowdown.
        </div>
        <div style={{ marginTop: 24, display: "flex", gap: 10, flexWrap: "wrap" }}>
          {["Deal Score 8.4", "Low crime", "Great schools"].map((c) => (
            <div key={c} style={{
              padding: "8px 14px", background: `${colors.primary}44`, borderRadius: 999,
              fontSize: 15, color: colors.white, fontWeight: 500,
            }}>{c}</div>
          ))}
        </div>
      </div>

      {/* Bottom text */}
      <div style={{
        position: "absolute", left: 60, right: 60, bottom: 200, textAlign: "center",
        opacity: textOp, transform: `translateY(${textY}px)`,
      }}>
        <div style={{ fontSize: 16, color: colors.accent, fontWeight: 500, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>
          Introducing
        </div>
        <div style={{ fontSize: 68, fontWeight: 700, color: colors.white, letterSpacing: -1 }}>
          Meet HomeLens.
        </div>
      </div>
    </AbsoluteFill>
  );
};