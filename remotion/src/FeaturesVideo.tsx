import {
  AbsoluteFill,
  Sequence,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
});

const COLORS = {
  primary: "#6B8DB5",
  primaryLight: "#8AADD0",
  primaryDark: "#4A6E94",
  accent: "#A3C4E0",
  dark: "#2C3E55",
  darkMid: "#3A5068",
  white: "#FFFFFF",
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
      {[0, 1, 2, 3].map((i) => {
        const x = 100 + i * 500 + Math.sin((frame + i * 60) / 60) * 80;
        const y = 120 + i * 200 + Math.cos((frame + i * 90) / 70) * 60;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: 520,
              height: 520,
              borderRadius: "50%",
              background:
                i % 2 === 0 ? COLORS.primaryLight : COLORS.primaryDark,
              opacity: 0.16,
              filter: "blur(90px)",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// ---------- Device frame (full uncropped image) ----------
const DeviceFrame = ({
  src,
  aspectRatio,
}: {
  src: string;
  aspectRatio: number;
}) => {
  const maxW = 1500;
  const maxH = 820;
  let w = maxW;
  let h = w / aspectRatio;
  if (h > maxH) {
    h = maxH;
    w = h * aspectRatio;
  }
  return (
    <div
      style={{
        width: w,
        background: "#fff",
        borderRadius: 22,
        overflow: "hidden",
        boxShadow:
          "0 50px 120px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06)",
      }}
    >
      <div
        style={{
          height: 34,
          background: "#F5F7FA",
          display: "flex",
          alignItems: "center",
          paddingLeft: 14,
          gap: 8,
          borderBottom: "1px solid #E2E8F0",
        }}
      >
        {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
          <div
            key={c}
            style={{ width: 12, height: 12, borderRadius: 6, background: c }}
          />
        ))}
        <div
          style={{
            marginLeft: 18,
            fontSize: 12,
            color: "#8898A8",
            letterSpacing: 0.3,
          }}
        >
          homelensais.com
        </div>
      </div>
      <div style={{ width: "100%", height: h, background: "#fff" }}>
        <Img
          src={staticFile(src)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            objectPosition: "top",
            display: "block",
          }}
        />
      </div>
    </div>
  );
};

// ---------- Caption pill ----------
const Caption = ({
  eyebrow,
  title,
  durationInFrames,
}: {
  eyebrow: string;
  title: string;
  durationInFrames: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inSpring = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 90 },
  });
  const out = interpolate(
    frame,
    [durationInFrames - 15, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  return (
    <div
      style={{
        position: "absolute",
        top: 60,
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
          border: `1px solid ${COLORS.primaryLight}55`,
          padding: "18px 40px",
          borderRadius: 999,
          color: COLORS.white,
          textAlign: "center",
          maxWidth: 1300,
        }}
      >
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
        <div style={{ fontSize: 34, fontWeight: 700 }}>{title}</div>
      </div>
    </div>
  );
};

// ---------- Feature scene ----------
const FeatureScene = ({
  src,
  aspectRatio,
  durationInFrames,
  eyebrow,
  caption,
}: {
  src: string;
  aspectRatio: number;
  durationInFrames: number;
  eyebrow: string;
  caption: string;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inS = spring({ frame, fps, config: { damping: 22, stiffness: 70 } });
  const out = interpolate(
    frame,
    [durationInFrames - 15, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const scale = interpolate(frame, [0, durationInFrames], [1.0, 1.05]);
  const y = interpolate(inS, [0, 1], [40, 0]);
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        paddingTop: 80,
      }}
    >
      <div
        style={{
          opacity: inS * out,
          transform: `translateY(${y}px) scale(${scale})`,
        }}
      >
        <DeviceFrame src={src} aspectRatio={aspectRatio} />
      </div>
      <Caption
        eyebrow={eyebrow}
        title={caption}
        durationInFrames={durationInFrames}
      />
    </AbsoluteFill>
  );
};

// ---------- Intro ----------
const Intro = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logoScale = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 80 },
  });
  const logoOp = interpolate(frame, [0, 18], [0, 1], {
    extrapolateRight: "clamp",
  });
  const textOp = interpolate(frame, [22, 42], [0, 1], {
    extrapolateRight: "clamp",
  });
  const textY = interpolate(
    spring({ frame: frame - 22, fps, config: { damping: 18 } }),
    [0, 1],
    [40, 0],
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
            fontSize: 28,
            color: COLORS.muted,
            marginTop: 14,
            letterSpacing: 1,
          }}
        >
          Every feature, one platform.
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------- Closing ----------
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
        opacity: interpolate(frame, [0, 12], [0, 1], {
          extrapolateRight: "clamp",
        }),
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
          fontSize: 32,
          color: COLORS.muted,
          marginTop: 14,
          letterSpacing: 0.5,
          textAlign: "center",
          maxWidth: 1400,
          lineHeight: 1.3,
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

// ---------- Scene list ----------
const scenes = [
  {
    src: "features/f02.png",
    aspect: 952 / 497,
    eyebrow: "01 — AI Home Search",
    caption: "Ask anything. Get real answers.",
    duration: 120,
  },
  {
    src: "features/f03.png",
    aspect: 2998 / 1364,
    eyebrow: "02 — Property Analysis",
    caption: "Listings, decoded in seconds.",
    duration: 130,
  },
  {
    src: "features/f01.png",
    aspect: 3002 / 1566,
    eyebrow: "03 — Chrome Extension",
    caption: "HomeLens, on every listing.",
    duration: 130,
  },
  {
    src: "features/f10.png",
    aspect: 802 / 567,
    eyebrow: "04 — Personal Preferences",
    caption: "An AI that learns what matters to you.",
    duration: 120,
  },
  {
    src: "features/f04.png",
    aspect: 2792 / 1394,
    eyebrow: "05 — Financial Calculators",
    caption: "Know your number.",
    duration: 120,
  },
  {
    src: "features/f09.png",
    aspect: 762 / 545,
    eyebrow: "06 — Investor Calculator",
    caption: "Run the numbers like a pro.",
    duration: 130,
  },
  {
    src: "features/f06.png",
    aspect: 1119 / 538,
    eyebrow: "07 — Investor Brief",
    caption: "Your portfolio, grounded.",
    duration: 120,
  },
  {
    src: "features/f07.png",
    aspect: 860 / 560,
    eyebrow: "08 — My Properties",
    caption: "Track what you own.",
    duration: 120,
  },
  {
    src: "features/f08.png",
    aspect: 767 / 535,
    eyebrow: "09 — Saved Analyses",
    caption: "Never lose a great find.",
    duration: 130,
  },
];

const INTRO = 90;
const CLOSING = 90;
export const FEATURES_DURATION =
  INTRO + scenes.reduce((a, s) => a + s.duration, 0) + CLOSING;

export const FeaturesVideo = () => {
  let cursor = 0;
  return (
    <AbsoluteFill style={{ fontFamily }}>
      <Background />
      <Sequence from={0} durationInFrames={INTRO}>
        <Intro />
      </Sequence>
      {(() => {
        cursor = INTRO;
        return scenes.map((s, i) => {
          const from = cursor;
          cursor += s.duration;
          return (
            <Sequence
              key={i}
              from={from}
              durationInFrames={s.duration}
            >
              <FeatureScene
                src={s.src}
                aspectRatio={s.aspect}
                durationInFrames={s.duration}
                eyebrow={s.eyebrow}
                caption={s.caption}
              />
            </Sequence>
          );
        });
      })()}
      <Sequence
        from={FEATURES_DURATION - CLOSING}
        durationInFrames={CLOSING}
      >
        <Closing />
      </Sequence>
    </AbsoluteFill>
  );
};
