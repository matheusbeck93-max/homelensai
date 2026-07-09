import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Img, staticFile } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["400", "500", "700"], subsets: ["latin"] });

interface Props { colors: Record<string, string>; }

export const FScene8Close = ({ colors }: Props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fadeIn = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const logoScale = spring({ frame, fps, config: { damping: 14, stiffness: 90 } });
  const wordOp = interpolate(frame, [12, 28], [0, 1], { extrapolateRight: "clamp" });
  const ctaOp = interpolate(frame, [28, 46], [0, 1], { extrapolateRight: "clamp" });
  const ctaY = interpolate(spring({ frame: frame - 28, fps, config: { damping: 20 } }), [0, 1], [20, 0]);

  return (
    <AbsoluteFill style={{ fontFamily, opacity: fadeIn, justifyContent: "center", alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24, padding: "0 60px" }}>
        <Img src={staticFile("images/logo.png")} style={{
          width: 160, height: 160, objectFit: "contain", transform: `scale(${logoScale})`,
        }} />
        <div style={{ opacity: wordOp, textAlign: "center" }}>
          <div style={{ fontSize: 62, fontWeight: 700, color: colors.white, letterSpacing: -1 }}>HomeLens</div>
          <div style={{ fontSize: 22, color: colors.muted, marginTop: 10 }}>homelensais.com</div>
        </div>
        <div style={{
          opacity: wordOp,
          padding: "10px 18px", background: `${colors.primary}33`, borderRadius: 999,
          fontSize: 15, fontWeight: 500, color: colors.accent, letterSpacing: 1,
        }}>Available on Chrome</div>
        <div style={{
          opacity: ctaOp, transform: `translateY(${ctaY}px)`, marginTop: 20,
          fontSize: 28, fontWeight: 500, color: colors.white, textAlign: "center", lineHeight: 1.4,
        }}>Smarter home buying{"\n"}starts here.</div>
      </div>
    </AbsoluteFill>
  );
};