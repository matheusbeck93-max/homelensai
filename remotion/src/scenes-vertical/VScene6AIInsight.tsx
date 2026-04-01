import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Img, staticFile } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["700", "400", "500"], subsets: ["latin"] });

interface Props {
  colors: Record<string, string>;
}

export const VScene6AIInsight = ({ colors }: Props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [60, 79], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const op = fadeIn * fadeOut;

  const scale = interpolate(spring({ frame, fps, config: { damping: 14 } }), [0, 1], [0.95, 1]);
  const screenOp = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ fontFamily, opacity: op, justifyContent: "center", alignItems: "center" }}>
      <div style={{ transform: `scale(${scale})`, textAlign: "center", padding: "0 50px" }}>
        <div style={{ fontSize: 18, color: colors.accent, fontWeight: 500, letterSpacing: 2, textTransform: "uppercase", marginBottom: 14 }}>AI Insights</div>
        <div style={{ fontSize: 38, fontWeight: 700, color: colors.white, lineHeight: 1.3, marginBottom: 36 }}>
          Then let AI put it all{"\n"}together for you.
        </div>
        <div style={{
          opacity: screenOp, borderRadius: 16, overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)", border: "1px solid rgba(107,141,181,0.2)",
        }}>
          <Img src={staticFile("images/page-console.png")} style={{ width: 980, height: 700, objectFit: "cover", objectPosition: "top" }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};
