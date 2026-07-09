import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Img, staticFile } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["400", "500", "700"], subsets: ["latin"] });

interface Props { colors: Record<string, string>; }

export const FScene1Logo = ({ colors }: Props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fadeIn = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [62, 74], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const op = fadeIn * fadeOut;
  const logoScale = spring({ frame, fps, config: { damping: 14, stiffness: 90 } });
  const wordOp = interpolate(frame, [12, 30], [0, 1], { extrapolateRight: "clamp" });
  const tagY = interpolate(spring({ frame: frame - 24, fps, config: { damping: 22 } }), [0, 1], [20, 0]);
  const tagOp = interpolate(frame, [24, 44], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ fontFamily, opacity: op, justifyContent: "center", alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
        <Img src={staticFile("images/logo.png")} style={{
          width: 180, height: 180, objectFit: "contain", transform: `scale(${logoScale})`,
        }} />
        <div style={{
          opacity: wordOp, fontSize: 78, fontWeight: 700, color: colors.white, letterSpacing: -1.5,
        }}>HomeLens</div>
        <div style={{
          opacity: tagOp, transform: `translateY(${tagY}px)`,
          fontSize: 26, color: colors.muted, textAlign: "center", padding: "0 60px", lineHeight: 1.4,
        }}>Big decisions deserve{"\n"}the full picture.</div>
      </div>
    </AbsoluteFill>
  );
};