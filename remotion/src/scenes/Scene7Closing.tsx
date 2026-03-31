import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Img, staticFile } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["700", "400"], subsets: ["latin"] });

interface Props {
  colors: Record<string, string>;
}

export const Scene7Closing = ({ colors }: Props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const logoScale = spring({ frame: frame - 5, fps, config: { damping: 12, stiffness: 80 } });
  const logoOp = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });
  const textOp = interpolate(frame, [20, 40], [0, 1], { extrapolateRight: "clamp" });
  const textY = interpolate(spring({ frame: frame - 20, fps, config: { damping: 18 } }), [0, 1], [30, 0]);
  const tagOp = interpolate(frame, [40, 55], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ fontFamily, opacity: fadeIn, justifyContent: "center", alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
        <Img src={staticFile("images/logo.png")} style={{
          width: 160, height: 160, opacity: logoOp, transform: `scale(${logoScale})`, objectFit: "contain",
        }} />
        <div style={{ opacity: textOp, transform: `translateY(${textY}px)`, textAlign: "center" }}>
          <div style={{ fontSize: 42, fontWeight: 700, color: colors.white, lineHeight: 1.4 }}>
            Big decisions deserve{"\n"}the full picture.
          </div>
        </div>
        <div style={{ opacity: tagOp, fontSize: 28, fontWeight: 700, color: colors.accent, letterSpacing: 1 }}>
          HomeLens does this for you.
        </div>
        <div style={{
          position: "absolute", width: 500, height: 500, borderRadius: "50%",
          background: `radial-gradient(circle, rgba(107,141,181,${0.08 + Math.sin(frame * 0.1) * 0.04}) 0%, transparent 70%)`,
          zIndex: -1,
        }} />
      </div>
    </AbsoluteFill>
  );
};
