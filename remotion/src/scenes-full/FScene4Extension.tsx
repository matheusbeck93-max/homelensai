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
        position: "absolute", left: 40, top: 340, right: 40, height: 820,
        background: "rgba(255,255,255,0.05)", borderRadius: 20, border: "1px solid rgba(255,255,255,0.08)",
        overflow: "hidden",
      }}>
        <Img src={staticFile("images/listing-house.jpg")} style={{
          width: "100%", height: 560, objectFit: "cover", display: "block",
        }} />
        <div style={{ padding: "28px 32px" }}>
          <div style={{ fontSize: 48, fontWeight: 700, color: colors.white, letterSpacing: -1 }}>$620,000</div>
          <div style={{ fontSize: 26, color: colors.muted, marginTop: 8 }}>4 bd · 3 ba · 2,180 sqft</div>
          <div style={{ fontSize: 22, color: colors.mutedDark, marginTop: 6 }}>742 Maple Ave · Austin, TX</div>
        </div>
      </div>

      {/* Extension panel */}
      <div style={{
        position: "absolute", right: 30, top: 640, width: 780,
        transform: `translateX(${panelX}px)`,
        background: colors.dark, borderRadius: 20, border: `1px solid ${colors.primary}66`,
        boxShadow: "0 24px 100px rgba(0,0,0,0.7)", padding: 34,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 22 }}>
          <Img src={staticFile("images/logo.png")} style={{ width: 60, height: 60, objectFit: "contain" }} />
          <div style={{ fontSize: 32, fontWeight: 700, color: colors.white }}>HomeLens</div>
          <div style={{
            marginLeft: "auto", fontSize: 16, fontWeight: 500, color: colors.accent,
            padding: "6px 14px", background: `${colors.primary}33`, borderRadius: 999,
          }}>Chrome</div>
        </div>
        <div style={{ height: 1, background: `${colors.primary}33`, marginBottom: 22 }} />
        <div style={{ fontSize: 18, color: colors.accent, fontWeight: 500, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>
          Match Score
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 20 }}>
          <div style={{ fontSize: 104, fontWeight: 700, color: colors.success, letterSpacing: -2 }}>8.4</div>
          <div style={{ fontSize: 28, color: colors.muted }}>/ 10</div>
        </div>
        <div style={{ fontSize: 24, color: colors.offWhite, lineHeight: 1.45 }}>
          Fair-priced 4-bed near top-rated schools. Low crime area.
        </div>
      </div>

      <div style={{
        position: "absolute", left: 40, right: 40, top: 130, textAlign: "center",
        opacity: textOp, transform: `translateY(${textY}px)`,
      }}>
        <div style={{ fontSize: 72, fontWeight: 700, color: colors.white, lineHeight: 1.1, letterSpacing: -2 }}>
          Analyze any listing{"\n"}without leaving the page.
        </div>
      </div>
    </AbsoluteFill>
  );
};