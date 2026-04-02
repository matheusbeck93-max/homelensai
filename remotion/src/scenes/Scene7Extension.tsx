import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Img, staticFile } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["700", "400", "500"], subsets: ["latin"] });

interface Props {
  colors: Record<string, string>;
}

export const Scene7Extension = ({ colors }: Props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [80, 99], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const op = fadeIn * fadeOut;

  const screenScale = interpolate(spring({ frame: frame - 5, fps, config: { damping: 14, stiffness: 80 } }), [0, 1], [0.92, 1]);
  const screenOp = interpolate(frame, [5, 25], [0, 1], { extrapolateRight: "clamp" });

  const titleOp = interpolate(frame, [15, 35], [0, 1], { extrapolateRight: "clamp" });
  const titleY = interpolate(spring({ frame: frame - 15, fps, config: { damping: 20 } }), [0, 1], [30, 0]);

  const badgeScale = spring({ frame: frame - 50, fps, config: { damping: 12 } });
  const badgeOp = interpolate(frame, [45, 55], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ fontFamily, opacity: op }}>
      {/* Left: screenshot */}
      <div style={{
        position: "absolute", left: 40, top: 100,
        opacity: screenOp,
        transform: `scale(${screenScale})`,
        borderRadius: 16, overflow: "hidden",
        boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
        border: "1px solid rgba(107,141,181,0.2)",
      }}>
        <Img src={staticFile("images/page-extension.png")} style={{ width: 1050, height: 600, objectFit: "cover", objectPosition: "center" }} />
      </div>

      {/* Right: text */}
      <div style={{
        position: "absolute", right: 80, top: 180,
        opacity: titleOp, transform: `translateY(${titleY}px)`, textAlign: "right",
      }}>
        <div style={{ fontSize: 22, color: colors.accent, fontWeight: 500, marginBottom: 16, letterSpacing: 2, textTransform: "uppercase" }}>
          Chrome Extension
        </div>
        <div style={{ fontSize: 42, fontWeight: 700, color: colors.white, lineHeight: 1.3, maxWidth: 500 }}>
          Your real estate{"\n"}assistant, right where{"\n"}you search.
        </div>
        <div style={{
          fontSize: 18, color: colors.muted, marginTop: 24, maxWidth: 440, lineHeight: 1.7,
          opacity: interpolate(frame, [35, 55], [0, 1], { extrapolateRight: "clamp" }),
        }}>
          Get AI-powered insights on any listing site — Zillow, Redfin, Realtor.com, and beyond.
        </div>

        {/* Badge */}
        <div style={{
          marginTop: 28, display: "inline-flex", alignItems: "center", gap: 10,
          padding: "10px 20px", borderRadius: 24,
          background: "rgba(107,141,181,0.15)", border: "1px solid rgba(107,141,181,0.3)",
          opacity: badgeOp, transform: `scale(${badgeScale})`,
        }}>
          <div style={{ width: 10, height: 10, borderRadius: 5, background: "#4ADE80" }} />
          <span style={{ color: colors.accent, fontSize: 15, fontWeight: 500 }}>Works on any listing website</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
