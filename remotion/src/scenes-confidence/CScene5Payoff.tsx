import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["400", "500", "700"], subsets: ["latin"] });

interface Props { colors: Record<string, string>; }

export const CScene5Payoff = ({ colors }: Props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [165, 179], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const op = fadeIn * fadeOut;

  const drift = Math.sin(frame * 0.03) * 8;
  const cardScale = interpolate(spring({ frame, fps, config: { damping: 26, stiffness: 70 } }), [0, 1], [0.9, 1]);

  const line1Op = interpolate(frame, [40, 65], [0, 1], { extrapolateRight: "clamp" });
  const line1Y = interpolate(spring({ frame: frame - 40, fps, config: { damping: 22 } }), [0, 1], [24, 0]);

  const line2Op = interpolate(frame, [85, 110], [0, 1], { extrapolateRight: "clamp" });
  const line2Y = interpolate(spring({ frame: frame - 85, fps, config: { damping: 22 } }), [0, 1], [24, 0]);

  return (
    <AbsoluteFill style={{ fontFamily, opacity: op, justifyContent: "center", alignItems: "center", flexDirection: "column", gap: 60 }}>
      {/* Glow */}
      <div style={{
        position: "absolute", width: 900, height: 900, borderRadius: "50%",
        background: `radial-gradient(circle, ${colors.primary}25 0%, transparent 60%)`,
        top: 300,
      }} />

      {/* Calm listing card */}
      <div style={{
        width: 520, transform: `translateY(${drift}px) scale(${cardScale})`,
        background: "rgba(255,255,255,0.08)", borderRadius: 24,
        border: "1px solid rgba(255,255,255,0.1)", overflow: "hidden",
        boxShadow: "0 30px 80px rgba(0,0,0,0.4)",
        marginTop: -80,
      }}>
        <div style={{
          width: "100%", height: 320,
          background: `linear-gradient(135deg, ${colors.primaryLight}, ${colors.primary})`,
          position: "relative",
        }}>
          <div style={{
            position: "absolute", left: "50%", top: 90, transform: "translateX(-50%)",
            width: 0, height: 0,
            borderLeft: "100px solid transparent",
            borderRight: "100px solid transparent",
            borderBottom: `70px solid ${colors.offWhite}33`,
          }} />
          <div style={{
            position: "absolute", left: "50%", bottom: 50, transform: "translateX(-50%)",
            width: 160, height: 110, background: `${colors.offWhite}33`, borderRadius: 4,
          }} />
        </div>
        <div style={{ padding: 28, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 30, fontWeight: 700, color: colors.white }}>$542,000</div>
            <div style={{ fontSize: 18, color: colors.muted, marginTop: 6 }}>Right price · Right area</div>
          </div>
          <div style={{
            padding: "10px 16px", background: "#4A9E7A", borderRadius: 999,
            fontSize: 18, fontWeight: 700, color: colors.white,
          }}>9.1</div>
        </div>
      </div>

      <div style={{ textAlign: "center", marginTop: 20 }}>
        <div style={{
          fontSize: 62, fontWeight: 700, color: colors.white, letterSpacing: -1,
          opacity: line1Op, transform: `translateY(${line1Y}px)`, lineHeight: 1.1,
        }}>Buy with confidence.</div>
        <div style={{
          fontSize: 62, fontWeight: 700, color: colors.accent, letterSpacing: -1,
          opacity: line2Op, transform: `translateY(${line2Y}px)`, lineHeight: 1.1, marginTop: 12,
        }}>Not stress.</div>
      </div>
    </AbsoluteFill>
  );
};