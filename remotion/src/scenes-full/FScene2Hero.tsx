import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["400", "500", "700"], subsets: ["latin"] });

interface Props { colors: Record<string, string>; }

const TYPED = "homes near top schools under $600k";

export const FScene2Hero = ({ colors }: Props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fadeIn = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [92, 104], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const op = fadeIn * fadeOut;

  const titleY = interpolate(spring({ frame, fps, config: { damping: 20 } }), [0, 1], [30, 0]);
  const barY = interpolate(spring({ frame: frame - 15, fps, config: { damping: 22 } }), [0, 1], [30, 0]);
  const barOp = interpolate(frame, [15, 32], [0, 1], { extrapolateRight: "clamp" });

  const chars = Math.min(TYPED.length, Math.max(0, Math.floor((frame - 30) * 0.9)));
  const typed = TYPED.slice(0, chars);
  const caret = Math.floor(frame / 12) % 2 === 0;

  return (
    <AbsoluteFill style={{ fontFamily, opacity: op, justifyContent: "center", alignItems: "center", padding: "0 60px" }}>
      <div style={{ textAlign: "center", transform: `translateY(${titleY}px)` }}>
        <div style={{ fontSize: 15, letterSpacing: 3, textTransform: "uppercase", color: colors.accent, marginBottom: 16, fontWeight: 500 }}>
          Your AI Real Estate Advisor
        </div>
        <div style={{ fontSize: 68, fontWeight: 700, color: colors.white, lineHeight: 1.1, letterSpacing: -1.5 }}>
          Meet your{"\n"}real estate advisor.
        </div>
      </div>
      <div style={{
        marginTop: 60, width: "100%", opacity: barOp, transform: `translateY(${barY}px)`,
        background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 20, padding: "26px 28px", display: "flex", alignItems: "center", gap: 16,
        boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, background: colors.primary,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: colors.white,
        }}>⌕</div>
        <div style={{ flex: 1, fontSize: 28, color: colors.white, fontWeight: 400 }}>
          {typed}<span style={{ opacity: caret ? 1 : 0, color: colors.accent }}>|</span>
        </div>
      </div>
      <div style={{ marginTop: 20, fontSize: 18, color: colors.mutedDark }}>
        Powered by AI · Search in natural language
      </div>
    </AbsoluteFill>
  );
};