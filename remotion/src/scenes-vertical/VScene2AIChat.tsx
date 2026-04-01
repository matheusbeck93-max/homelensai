import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Img, staticFile } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["700", "400", "500"], subsets: ["latin"] });

interface Props {
  colors: Record<string, string>;
}

export const VScene2AIChat = ({ colors }: Props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [160, 179], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const op = fadeIn * fadeOut;

  const titleY = interpolate(spring({ frame, fps, config: { damping: 20 } }), [0, 1], [-30, 0]);
  const screenY = interpolate(spring({ frame: frame - 10, fps, config: { damping: 16, stiffness: 100 } }), [0, 1], [100, 0]);
  const screenOp = interpolate(frame, [10, 30], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ fontFamily, opacity: op }}>
      {/* Top text */}
      <div style={{
        position: "absolute", left: 50, right: 50, top: 140,
        transform: `translateY(${titleY}px)`, textAlign: "center",
      }}>
        <div style={{ fontSize: 18, color: colors.accent, fontWeight: 500, marginBottom: 14, letterSpacing: 2, textTransform: "uppercase" }}>
          AI-Powered Chat
        </div>
        <div style={{ fontSize: 36, fontWeight: 700, color: colors.white, lineHeight: 1.3 }}>
          Your real estate{"\n"}expert, available{"\n"}whenever you need one.
        </div>
        <div style={{
          fontSize: 16, color: colors.muted, marginTop: 20, lineHeight: 1.7,
          opacity: interpolate(frame, [30, 50], [0, 1], { extrapolateRight: "clamp" }),
        }}>
          Search by text, paste any listing URL, analyze neighborhoods — all through natural conversation.
        </div>
      </div>

      {/* Screenshot below */}
      <div style={{
        position: "absolute", left: 30, right: 30, top: 560,
        opacity: screenOp,
        transform: `translateY(${screenY}px)`,
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        border: "1px solid rgba(107,141,181,0.2)",
      }}>
        <Img
          src={staticFile("images/page-chats.png")}
          style={{ width: "100%", height: 1100, objectFit: "cover", objectPosition: "top" }}
        />
      </div>
    </AbsoluteFill>
  );
};
