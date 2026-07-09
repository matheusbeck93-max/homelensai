import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Img, staticFile } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["400", "500", "700"], subsets: ["latin"] });

interface Props { colors: Record<string, string>; }

export const FScene4Extension = ({ colors }: Props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fadeIn = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [105, 119], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const op = fadeIn * fadeOut;

  const panelX = interpolate(spring({ frame, fps, config: { damping: 22, stiffness: 90 } }), [0, 1], [700, 0]);
  const textOp = interpolate(frame, [40, 60], [0, 1], { extrapolateRight: "clamp" });
  const textY = interpolate(spring({ frame: frame - 40, fps, config: { damping: 22 } }), [0, 1], [24, 0]);

  return (
    <AbsoluteFill style={{ fontFamily, opacity: op }}>
      {/* faux listing behind */}
      <div style={{
        position: "absolute", left: 60, top: 280, right: 60, height: 620,
        background: "rgba(255,255,255,0.05)", borderRadius: 20, border: "1px solid rgba(255,255,255,0.08)",
        overflow: "hidden",
      }}>
        <div style={{ height: 360, background: `linear-gradient(135deg, ${colors.primary}88, ${colors.primaryDark}88)` }} />
        <div style={{ padding: 24 }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: colors.white }}>$620,000</div>
          <div style={{ fontSize: 20, color: colors.muted, marginTop: 6 }}>4 bd · 3 ba · 2,180 sqft</div>
        </div>
      </div>

      {/* Extension panel */}
      <div style={{
        position: "absolute", right: 40, top: 380, width: 620,
        transform: `translateX(${panelX}px)`,
        background: colors.dark, borderRadius: 20, border: `1px solid ${colors.primary}66`,
        boxShadow: "0 20px 80px rgba(0,0,0,0.6)", padding: 28,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
          <Img src={staticFile("images/logo.png")} style={{ width: 44, height: 44, objectFit: "contain" }} />
          <div style={{ fontSize: 24, fontWeight: 700, color: colors.white }}>HomeLens</div>
          <div style={{
            marginLeft: "auto", fontSize: 12, fontWeight: 500, color: colors.accent,
            padding: "4px 10px", background: `${colors.primary}33`, borderRadius: 999,
          }}>Chrome</div>
        </div>
        <div style={{ height: 1, background: `${colors.primary}33`, marginBottom: 18 }} />
        <div style={{ fontSize: 13, color: colors.accent, fontWeight: 500, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>
          Match Score
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 68, fontWeight: 700, color: colors.success }}>8.4</div>
          <div style={{ fontSize: 20, color: colors.muted }}>/ 10</div>
        </div>
        <div style={{ fontSize: 18, color: colors.offWhite, lineHeight: 1.5 }}>
          Fair-priced 4-bed near top-rated schools. Low crime area.
        </div>
      </div>

      <div style={{
        position: "absolute", left: 60, right: 60, top: 120, textAlign: "center",
        opacity: textOp, transform: `translateY(${textY}px)`,
      }}>
        <div style={{ fontSize: 48, fontWeight: 700, color: colors.white, lineHeight: 1.15, letterSpacing: -1 }}>
          Analyze any listing{"\n"}without leaving the page.
        </div>
      </div>
    </AbsoluteFill>
  );
};