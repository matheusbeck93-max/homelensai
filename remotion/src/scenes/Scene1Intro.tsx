import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Img, staticFile } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["700", "400"], subsets: ["latin"] });

interface Props {
  colors: Record<string, string>;
}

export const Scene1Intro = ({ colors }: Props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({ frame, fps, config: { damping: 12, stiffness: 80 } });
  const logoOp = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const textOp = interpolate(frame, [25, 45], [0, 1], { extrapolateRight: "clamp" });
  const textY = interpolate(spring({ frame: frame - 25, fps, config: { damping: 18 } }), [0, 1], [40, 0]);
  const fadeOut = interpolate(frame, [80, 99], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ fontFamily, opacity: fadeOut, justifyContent: "center", alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 30 }}>
        <Img
          src={staticFile("images/logo.png")}
          style={{
            width: 200, height: 200,
            opacity: logoOp,
            transform: `scale(${logoScale})`,
            objectFit: "contain",
          }}
        />
        <div style={{ opacity: textOp, transform: `translateY(${textY}px)`, textAlign: "center" }}>
          <div style={{ fontSize: 64, fontWeight: 700, color: colors.white, letterSpacing: -1 }}>HomeLens</div>
          <div style={{ fontSize: 24, color: colors.muted, marginTop: 12 }}>Your Home Buying Copilot</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
