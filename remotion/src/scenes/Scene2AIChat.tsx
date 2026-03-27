import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Sequence } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["700", "400", "500"], subsets: ["latin"] });

interface Props {
  colors: Record<string, string>;
}

export const Scene2AIChat = ({ colors }: Props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const titleX = interpolate(
    spring({ frame, fps, config: { damping: 20, stiffness: 150 } }),
    [0, 1], [-80, 0]
  );

  // Chat messages appear one by one
  const messages = [
    { text: "Find 3-bed homes in Austin under $400k", isUser: true, delay: 20 },
    { text: "I found 12 properties matching your criteria in Austin, TX. Here are the top 3 with best investment potential...", isUser: false, delay: 45 },
    { text: "What's the ROI on the second one?", isUser: true, delay: 75 },
    { text: "Estimated ROI: 8.2% annually with rental income of $2,100/mo. Cap rate: 5.4%", isUser: false, delay: 95 },
  ];

  return (
    <AbsoluteFill style={{ fontFamily, padding: 80 }}>
      {/* Left side - title */}
      <div style={{ position: "absolute", left: 80, top: 100 }}>
        <div
          style={{
            opacity: titleOpacity,
            transform: `translateX(${titleX}px)`,
            fontSize: 52,
            fontWeight: 700,
            color: colors.white,
            lineHeight: 1.2,
          }}
        >
          AI-Powered
          <br />
          <span style={{ color: colors.primary }}>Property Search</span>
        </div>
        <div
          style={{
            opacity: interpolate(frame, [15, 35], [0, 1], { extrapolateRight: "clamp" }),
            fontSize: 20,
            color: colors.muted,
            marginTop: 20,
            maxWidth: 400,
            lineHeight: 1.6,
          }}
        >
          Ask questions in natural language.
          <br />
          Get instant, intelligent answers.
        </div>
      </div>

      {/* Right side - chat mockup */}
      <div
        style={{
          position: "absolute",
          right: 80,
          top: 80,
          width: 700,
          height: 800,
          background: "rgba(30, 42, 66, 0.8)",
          borderRadius: 24,
          border: `1px solid rgba(62, 141, 160, 0.3)`,
          padding: 30,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          overflow: "hidden",
        }}
      >
        {/* Chat header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 18, background: colors.primary, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 18, color: "white" }}>🤖</span>
          </div>
          <span style={{ color: colors.white, fontWeight: 600, fontSize: 18 }}>HomeLens AI</span>
        </div>

        {messages.map((msg, i) => {
          const msgOpacity = interpolate(frame, [msg.delay, msg.delay + 15], [0, 1], { extrapolateRight: "clamp" });
          const msgY = interpolate(
            spring({ frame: frame - msg.delay, fps, config: { damping: 18 } }),
            [0, 1], [30, 0]
          );
          return (
            <div
              key={i}
              style={{
                opacity: msgOpacity,
                transform: `translateY(${msgY}px)`,
                alignSelf: msg.isUser ? "flex-end" : "flex-start",
                maxWidth: "80%",
                padding: "14px 20px",
                borderRadius: msg.isUser ? "20px 20px 4px 20px" : "20px 20px 20px 4px",
                background: msg.isUser ? colors.primary : "rgba(255,255,255,0.08)",
                color: colors.white,
                fontSize: 16,
                lineHeight: 1.5,
                fontWeight: 400,
              }}
            >
              {msg.text}
            </div>
          );
        })}

        {/* Typing indicator */}
        {frame > 110 && (
          <div
            style={{
              opacity: interpolate(frame, [110, 120], [0, 1], { extrapolateRight: "clamp" }),
              alignSelf: "flex-start",
              padding: "14px 20px",
              borderRadius: "20px 20px 20px 4px",
              background: "rgba(255,255,255,0.08)",
              display: "flex",
              gap: 6,
            }}
          >
            {[0, 1, 2].map((d) => (
              <div
                key={d}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  background: colors.muted,
                  opacity: 0.4 + Math.sin((frame - 110) * 0.15 + d * 1.5) * 0.4,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
