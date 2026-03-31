import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Img, staticFile } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["700", "400", "500"], subsets: ["latin"] });

interface Props {
  colors: Record<string, string>;
}

export const Scene2AIChat = ({ colors }: Props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [160, 179], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const op = fadeIn * fadeOut;

  const titleY = interpolate(spring({ frame, fps, config: { damping: 20 } }), [0, 1], [-40, 0]);

  // Screenshot slides in from right
  const screenX = interpolate(spring({ frame: frame - 10, fps, config: { damping: 16, stiffness: 100 } }), [0, 1], [200, 0]);
  const screenOp = interpolate(frame, [10, 30], [0, 1], { extrapolateRight: "clamp" });

  // Highlight cursor animation on the screenshot
  const cursorY = interpolate(frame, [60, 120], [350, 420], { extrapolateRight: "clamp" });
  const cursorOp = interpolate(frame, [50, 60, 130, 140], [0, 0.8, 0.8, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ fontFamily, opacity: op, padding: 80 }}>
      {/* Left text */}
      <div style={{
        position: "absolute", left: 80, top: 200,
        transform: `translateY(${titleY}px)`,
      }}>
        <div style={{ fontSize: 22, color: colors.accent, fontWeight: 500, marginBottom: 16, letterSpacing: 2, textTransform: "uppercase" }}>
          AI-Powered Chat
        </div>
        <div style={{ fontSize: 48, fontWeight: 700, color: colors.white, lineHeight: 1.3, maxWidth: 500 }}>
          Your real estate{"\n"}expert, available{"\n"}whenever you need one.
        </div>
        <div style={{
          fontSize: 18, color: colors.muted, marginTop: 28, maxWidth: 440, lineHeight: 1.7,
          opacity: interpolate(frame, [30, 50], [0, 1], { extrapolateRight: "clamp" }),
        }}>
          Search by text, paste any listing URL, analyze neighborhoods — all through natural conversation.
        </div>
      </div>

      {/* Screenshot */}
      <div style={{
        position: "absolute", right: 60, top: 60,
        opacity: screenOp,
        transform: `translateX(${screenX}px)`,
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
        border: "1px solid rgba(107,141,181,0.2)",
      }}>
        <Img
          src={staticFile("images/page-chats.png")}
          style={{ width: 900, height: 560, objectFit: "cover", objectPosition: "top" }}
        />
        {/* Animated highlight cursor */}
        <div style={{
          position: "absolute", left: 620, top: cursorY,
          width: 18, height: 18, borderRadius: 9,
          background: colors.primary,
          opacity: cursorOp,
          boxShadow: `0 0 20px ${colors.primary}`,
        }} />
      </div>
    </AbsoluteFill>
  );
};
