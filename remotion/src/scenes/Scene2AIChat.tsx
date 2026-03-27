import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["700", "400", "500"], subsets: ["latin"] });

interface Props {
  colors: Record<string, string>;
}

export const Scene2AIChat = ({ colors }: Props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const titleX = interpolate(
    spring({ frame, fps, config: { damping: 20, stiffness: 150 } }),
    [0, 1], [-60, 0]
  );

  const tagline = "With HomeLens, you have a real estate\nexpert available whenever you need one.";
  const tagOp = interpolate(frame, [15, 35], [0, 1], { extrapolateRight: "clamp" });

  const messages = [
    { text: "Find 3-bed homes in Austin under $400k", isUser: true, delay: 25 },
    { text: "I found 12 properties matching your criteria. Here are the top picks with best ROI…", isUser: false, delay: 50 },
    { text: "What about the neighborhood safety?", isUser: true, delay: 75 },
    { text: "This area scores 8.4/10 for safety with low crime rates and top-rated schools nearby.", isUser: false, delay: 95 },
  ];

  return (
    <AbsoluteFill style={{ fontFamily, padding: 80 }}>
      {/* Left title */}
      <div style={{ position: "absolute", left: 80, top: 120 }}>
        <div style={{
          opacity: titleOpacity, transform: `translateX(${titleX}px)`,
          fontSize: 48, fontWeight: 700, color: colors.white, lineHeight: 1.2,
        }}>
          AI-Powered<br />
          <span style={{ color: colors.accent }}>Property Search</span>
        </div>
        <div style={{
          opacity: tagOp, fontSize: 19, color: colors.muted, marginTop: 24,
          maxWidth: 420, lineHeight: 1.7, whiteSpace: "pre-line",
        }}>
          {tagline}
        </div>

        <div style={{
          opacity: interpolate(frame, [100, 115], [0, 1], { extrapolateRight: "clamp" }),
          marginTop: 28, display: "inline-flex", alignItems: "center", gap: 10,
          padding: "10px 20px", borderRadius: 12,
          background: `rgba(107, 141, 181, 0.2)`, border: `1px solid rgba(107, 141, 181, 0.3)`,
        }}>
          <span style={{ fontSize: 18 }}>🔗</span>
          <span style={{ fontSize: 15, color: colors.accent }}>Paste any URL → Instant AI Analysis</span>
        </div>
      </div>

      {/* Chat mockup */}
      <div style={{
        position: "absolute", right: 80, top: 80, width: 680, height: 780,
        background: `rgba(44, 62, 85, 0.85)`, borderRadius: 24,
        border: `1px solid rgba(107, 141, 181, 0.25)`, padding: 28,
        display: "flex", flexDirection: "column", gap: 14, overflow: "hidden",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <div style={{ width: 34, height: 34, borderRadius: 17, background: colors.primary, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 16, color: "white" }}>🏠</span>
          </div>
          <span style={{ color: colors.white, fontWeight: 600, fontSize: 17 }}>HomeLens AI</span>
        </div>

        {messages.map((msg, i) => {
          const msgOp = interpolate(frame, [msg.delay, msg.delay + 12], [0, 1], { extrapolateRight: "clamp" });
          const msgY = interpolate(
            spring({ frame: frame - msg.delay, fps, config: { damping: 16 } }),
            [0, 1], [25, 0]
          );
          return (
            <div key={i} style={{
              opacity: msgOp, transform: `translateY(${msgY}px)`,
              alignSelf: msg.isUser ? "flex-end" : "flex-start", maxWidth: "80%",
              padding: "13px 18px", fontSize: 15, lineHeight: 1.5, color: colors.white,
              borderRadius: msg.isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
              background: msg.isUser ? colors.primary : "rgba(255,255,255,0.08)",
            }}>
              {msg.text}
            </div>
          );
        })}

        {frame > 110 && (
          <div style={{
            opacity: interpolate(frame, [110, 120], [0, 1], { extrapolateRight: "clamp" }),
            alignSelf: "flex-start", padding: "12px 18px",
            borderRadius: "18px 18px 18px 4px", background: "rgba(255,255,255,0.08)",
            display: "flex", gap: 6,
          }}>
            {[0, 1, 2].map(d => (
              <div key={d} style={{
                width: 7, height: 7, borderRadius: 4, background: colors.muted,
                opacity: 0.4 + Math.sin((frame - 110) * 0.15 + d * 1.5) * 0.4,
              }} />
            ))}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
