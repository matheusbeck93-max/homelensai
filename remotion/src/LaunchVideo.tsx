import {
  AbsoluteFill,
  Sequence,
  Img,
  Video,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "600", "700", "800"],
  subsets: ["latin"],
});

const COLORS = {
  primary: "#6B8DB5",
  primaryLight: "#8AADD0",
  primaryDark: "#4A6E94",
  dark: "#2C3E55",
  darkMid: "#3A5068",
  white: "#FFFFFF",
  offWhite: "#F0F4F8",
  muted: "#B0C4D8",
};

// ---------- Persistent background ----------
const Background = () => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 80) * 30;
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at ${50 + drift / 4}% 30%, ${COLORS.primary} 0%, ${COLORS.dark} 70%)`,
      }}
    >
      {/* soft floating blobs */}
      {[0, 1, 2].map((i) => {
        const x = 200 + i * 600 + Math.sin((frame + i * 60) / 60) * 80;
        const y = 200 + i * 220 + Math.cos((frame + i * 90) / 70) * 60;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: 480,
              height: 480,
              borderRadius: "50%",
              background: i % 2 === 0 ? COLORS.primaryLight : COLORS.primaryDark,
              opacity: 0.18,
              filter: "blur(80px)",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// ---------- Caption pill ----------
const Caption = ({
  eyebrow,
  title,
  durationInFrames,
}: {
  eyebrow?: string;
  title: string;
  durationInFrames: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inSpring = spring({ frame, fps, config: { damping: 18, stiffness: 90 } });
  const out = interpolate(
    frame,
    [durationInFrames - 15, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  return (
    <div
      style={{
        position: "absolute",
        top: 70,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        fontFamily,
        opacity: inSpring * out,
        transform: `translateY(${interpolate(inSpring, [0, 1], [-30, 0])}px)`,
      }}
    >
      <div
        style={{
          background: "rgba(15, 23, 36, 0.78)",
          backdropFilter: "blur(8px)",
          border: `1px solid ${COLORS.primaryLight}55`,
          padding: "18px 36px",
          borderRadius: 999,
          color: COLORS.white,
          textAlign: "center",
          maxWidth: 1100,
        }}
      >
        {eyebrow && (
          <div
            style={{
              fontSize: 18,
              letterSpacing: 4,
              fontWeight: 600,
              color: COLORS.primaryLight,
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            {eyebrow}
          </div>
        )}
        <div style={{ fontSize: 34, fontWeight: 700 }}>{title}</div>
      </div>
    </div>
  );
};

// ---------- Scene: Intro ----------
const Intro = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logoScale = spring({ frame, fps, config: { damping: 14, stiffness: 80 } });
  const logoOp = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const textOp = interpolate(frame, [22, 42], [0, 1], { extrapolateRight: "clamp" });
  const textY = interpolate(
    spring({ frame: frame - 22, fps, config: { damping: 18 } }),
    [0, 1],
    [40, 0]
  );
  const fadeOut = interpolate(frame, [75, 90], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{
        fontFamily,
        alignItems: "center",
        justifyContent: "center",
        opacity: fadeOut,
      }}
    >
      <Img
        src={staticFile("images/logo.png")}
        style={{
          width: 220,
          height: 220,
          objectFit: "contain",
          opacity: logoOp,
          transform: `scale(${logoScale})`,
        }}
      />
      <div
        style={{
          marginTop: 28,
          textAlign: "center",
          opacity: textOp,
          transform: `translateY(${textY}px)`,
        }}
      >
        <div
          style={{
            fontSize: 86,
            fontWeight: 800,
            color: COLORS.white,
            letterSpacing: -2,
          }}
        >
          HomeLens
        </div>
        <div
          style={{
            fontSize: 26,
            color: COLORS.muted,
            marginTop: 14,
            letterSpacing: 1,
          }}
        >
          Big decisions deserve the full picture.
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------- Scene: Screenshot zoom ----------
const ScreenshotScene = ({
  src,
  durationInFrames,
  caption,
  eyebrow,
}: {
  src: string;
  durationInFrames: number;
  caption: string;
  eyebrow?: string;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inS = spring({ frame, fps, config: { damping: 22, stiffness: 70 } });
  const out = interpolate(
    frame,
    [durationInFrames - 15, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const scale = interpolate(frame, [0, durationInFrames], [1.0, 1.08]);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          width: 1500,
          height: 880,
          borderRadius: 24,
          overflow: "hidden",
          boxShadow: "0 50px 120px rgba(0,0,0,0.55)",
          border: `1px solid ${COLORS.primaryLight}33`,
          opacity: inS * out,
          transform: `translateY(${interpolate(inS, [0, 1], [40, 0])}px) scale(${scale})`,
        }}
      >
        <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
      <Caption eyebrow={eyebrow} title={caption} durationInFrames={durationInFrames} />
    </AbsoluteFill>
  );
};

// ---------- Scene: Video clip ----------
const VideoScene = ({
  src,
  startFrom,
  durationInFrames,
  caption,
  eyebrow,
}: {
  src: string;
  startFrom: number;
  durationInFrames: number;
  caption: string;
  eyebrow?: string;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inS = spring({ frame, fps, config: { damping: 22, stiffness: 70 } });
  const out = interpolate(
    frame,
    [durationInFrames - 15, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          width: 1500,
          height: 860,
          borderRadius: 24,
          overflow: "hidden",
          boxShadow: "0 50px 120px rgba(0,0,0,0.55)",
          border: `1px solid ${COLORS.primaryLight}44`,
          background: "#000",
          opacity: inS * out,
          transform: `translateY(${interpolate(inS, [0, 1], [40, 0])}px)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Video
          src={src}
          startFrom={startFrom}
          muted
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
      <Caption eyebrow={eyebrow} title={caption} durationInFrames={durationInFrames} />
    </AbsoluteFill>
  );
};

// ---------- Scene: Closing ----------
const Closing = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inS = spring({ frame, fps, config: { damping: 18, stiffness: 80 } });
  return (
    <AbsoluteFill
      style={{
        fontFamily,
        alignItems: "center",
        justifyContent: "center",
        opacity: interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" }),
      }}
    >
      <Img
        src={staticFile("images/logo.png")}
        style={{
          width: 150,
          height: 150,
          objectFit: "contain",
          transform: `scale(${inS})`,
        }}
      />
      <div
        style={{
          fontSize: 72,
          fontWeight: 800,
          color: COLORS.white,
          marginTop: 18,
          letterSpacing: -1.5,
        }}
      >
        HomeLens
      </div>
      <div
        style={{
          fontSize: 28,
          color: COLORS.muted,
          marginTop: 14,
          letterSpacing: 1,
        }}
      >
        Big decisions deserve the full picture.
      </div>
      <div
        style={{
          marginTop: 36,
          padding: "14px 32px",
          borderRadius: 999,
          background: COLORS.white,
          color: COLORS.dark,
          fontWeight: 700,
          fontSize: 24,
          letterSpacing: 0.5,
        }}
      >
        homelensais.com
      </div>
    </AbsoluteFill>
  );
};

// ---------- Main composition ----------
// 900 frames @ 30fps = 30s
// 0-90    (3s)  Intro
// 90-240  (5s)  Hello Matthew home screen
// 240-540 (10s) Platform demo video
// 540-660 (4s)  Chrome extension popup mockup
// 660-840 (6s)  Zillow + extension video
// 840-900 (2s)  Closing
export const LaunchVideo = () => {
  return (
    <AbsoluteFill style={{ fontFamily }}>
      <Background />

      <Sequence from={0} durationInFrames={90}>
        <Intro />
      </Sequence>

      <Sequence from={90} durationInFrames={150}>
        <ScreenshotScene
          src={staticFile("launch-images/hello-matthew.jpg")}
          durationInFrames={150}
          eyebrow="Your AI copilot"
          caption="Ask anything about any home — in plain English."
        />
      </Sequence>

      <Sequence from={240} durationInFrames={300}>
        <VideoScene
          src={staticFile("videos/platform.mp4")}
          startFrom={90}
          durationInFrames={300}
          eyebrow="Inside HomeLens"
          caption="Analyze listings, run the numbers, decide with confidence."
        />
      </Sequence>

      <Sequence from={540} durationInFrames={120}>
        <ScreenshotScene
          src={staticFile("launch-images/ext-mockup.png")}
          durationInFrames={120}
          eyebrow="Chrome extension"
          caption="One click on any listing — instant Match Score."
        />
      </Sequence>

      <Sequence from={660} durationInFrames={180}>
        <VideoScene
          src={staticFile("videos/zillow-ext.mp4")}
          startFrom={30}
          durationInFrames={180}
          eyebrow="Works everywhere"
          caption="Zillow, Redfin, Realtor.com — zero copy-paste."
        />
      </Sequence>

      <Sequence from={840} durationInFrames={60}>
        <Closing />
      </Sequence>
    </AbsoluteFill>
  );
};