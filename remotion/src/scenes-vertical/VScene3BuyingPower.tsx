import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Img, staticFile } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["700", "400", "500"], subsets: ["latin"] });

interface Props {
  colors: Record<string, string>;
}

export const VScene3BuyingPower = ({ colors }: Props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [130, 149], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const op = fadeIn * fadeOut;

  const screenY = interpolate(spring({ frame: frame - 5, fps, config: { damping: 18, stiffness: 100 } }), [0, 1], [100, 0]);
  const screenOp = interpolate(frame, [5, 25], [0, 1], { extrapolateRight: "clamp" });

  const titleOp = interpolate(frame, [15, 35], [0, 1], { extrapolateRight: "clamp" });
  const titleY = interpolate(spring({ frame: frame - 15, fps, config: { damping: 20 } }), [0, 1], [30, 0]);

  return (
    <AbsoluteFill style={{ fontFamily, opacity: op }}>
      {/* Text on top */}
      <div style={{
        position: "absolute", left: 50, right: 50, top: 140,
        opacity: titleOp, transform: `translateY(${titleY}px)`, textAlign: "center",
      }}>
        <div style={{ fontSize: 18, color: colors.accent, fontWeight: 500, marginBottom: 14, letterSpacing: 2, textTransform: "uppercase" }}>Buying Power</div>
        <div style={{ fontSize: 36, fontWeight: 700, color: colors.white, lineHeight: 1.3 }}>
          Find out exactly how{"\n"}much home you{"\n"}can afford.
        </div>
        <div style={{
          fontSize: 16, color: colors.muted, marginTop: 20, lineHeight: 1.7,
          opacity: interpolate(frame, [40, 60], [0, 1], { extrapolateRight: "clamp" }),
        }}>
          DTI ratio, down payment, monthly limits — calculated instantly with AI insights.
        </div>
      </div>

      {/* Screenshot */}
      <div style={{
        position: "absolute", left: 30, right: 30, top: 560,
        opacity: screenOp,
        transform: `translateY(${screenY}px)`,
        borderRadius: 16, overflow: "hidden",
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        border: "1px solid rgba(107,141,181,0.2)",
      }}>
        <Img src={staticFile("images/page-calculators.png")} style={{ width: "100%", height: 1100, objectFit: "cover", objectPosition: "top" }} />
      </div>
    </AbsoluteFill>
  );
};
