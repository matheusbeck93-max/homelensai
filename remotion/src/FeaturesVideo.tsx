import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Img,
  staticFile,
  Sequence,
} from "remotion";
import {
  TransitionSeries,
  linearTiming,
  springTiming,
} from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { loadFont } from "@remotion/google-fonts/Inter";
import { loadFont as loadDisplay } from "@remotion/google-fonts/PlusJakartaSans";
import { PersistentBackground } from "./components/PersistentBackground";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "700"],
  subsets: ["latin"],
});
const { fontFamily: displayFont } = loadDisplay("normal", {
  weights: ["600", "700", "800"],
  subsets: ["latin"],
});

export const COLORS = {
  primary: "#6B8DB5",
  primaryLight: "#8AADD0",
  primaryDark: "#4A6E94",
  accent: "#A3C4E0",
  dark: "#2C3E55",
  darkMid: "#3A5068",
  white: "#FFFFFF",
  offWhite: "#F0F4F8",
  muted: "#B0C4D8",
  mutedDark: "#7A95AD",
};

// ---------- Device frame ----------
const DeviceFrame: React.FC<{ src: string; aspectRatio: number }> = ({
  src,
  aspectRatio,
}) => {
  // Compute display size: max width 1300, max height 720
  const maxW = 1300;
  const maxH = 720;
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
        borderRadius: 18,
        overflow: "hidden",
        boxShadow:
          "0 40px 100px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.08)",
      }}
    >
      {/* Window chrome */}
      <div
        style={{
          height: 32,
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
            fontFamily,
            letterSpacing: 0.3,
          }}
        >
          homelensais.com
        </div>
      </div>
      <div style={{ width: "100%", height: h }}>
        <Img
          src={staticFile(src)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            objectPosition: "top",
            background: "#fff",
            display: "block",
          }}
        />
      </div>
    </div>
  );
};

// ---------- Feature slide ----------
interface SlideProps {
  eyebrow: string;
  title: string;
  description: string;
  image: string;
  aspectRatio: number;
  layout?: "left" | "right";
  accentColor?: string;
}

const FeatureSlide: React.FC<SlideProps> = ({
  eyebrow,
  title,
  description,
  image,
  aspectRatio,
  layout = "left",
  accentColor = COLORS.accent,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const textIn = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 110 },
  });
  const textY = interpolate(textIn, [0, 1], [40, 0]);
  const textOp = interpolate(frame, [0, 18], [0, 1], {
    extrapolateRight: "clamp",
  });

  const descOp = interpolate(frame, [14, 32], [0, 1], {
    extrapolateRight: "clamp",
  });

  const imgIn = spring({
    frame: frame - 8,
    fps,
    config: { damping: 22, stiffness: 90 },
  });
  const imgX = interpolate(imgIn, [0, 1], [layout === "left" ? 120 : -120, 0]);
  const imgOp = interpolate(frame, [8, 28], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Subtle continuous float
  const float = Math.sin(frame * 0.05) * 6;

  const isLeft = layout === "left";

  return (
    <AbsoluteFill
      style={{
        fontFamily,
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        padding: 80,
        gap: 60,
      }}
    >
      {/* Text panel */}
      <div
        style={{
          width: 520,
          order: isLeft ? 0 : 1,
          opacity: textOp,
          transform: `translateY(${textY}px)`,
        }}
      >
        <div
          style={{
            fontSize: 20,
            color: accentColor,
            fontWeight: 600,
            letterSpacing: 3,
            textTransform: "uppercase",
            marginBottom: 22,
          }}
        >
          {eyebrow}
        </div>
        <div
          style={{
            fontFamily: displayFont,
            fontSize: 64,
            fontWeight: 700,
            color: COLORS.white,
            lineHeight: 1.05,
            letterSpacing: -1.5,
            marginBottom: 28,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 22,
            color: COLORS.muted,
            lineHeight: 1.55,
            opacity: descOp,
          }}
        >
          {description}
        </div>
      </div>

      {/* Image */}
      <div
        style={{
          order: isLeft ? 1 : 0,
          opacity: imgOp,
          transform: `translate(${imgX}px, ${float}px)`,
        }}
      >
        <DeviceFrame src={image} aspectRatio={aspectRatio} />
      </div>
    </AbsoluteFill>
  );
};

// ---------- Intro ----------
const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logoScale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 80 },
  });
  const textOp = interpolate(frame, [20, 40], [0, 1], {
    extrapolateRight: "clamp",
  });
  const textY = interpolate(
    spring({ frame: frame - 20, fps, config: { damping: 18 } }),
    [0, 1],
    [30, 0],
  );

  return (
    <AbsoluteFill
      style={{
        fontFamily: displayFont,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 32,
        }}
      >
        <Img
          src={staticFile("images/logo.png")}
          style={{
            width: 180,
            height: 180,
            transform: `scale(${logoScale})`,
            objectFit: "contain",
          }}
        />
        <div
          style={{
            opacity: textOp,
            transform: `translateY(${textY}px)`,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 78,
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
              fontFamily,
              fontWeight: 500,
              letterSpacing: 0.5,
            }}
          >
            Every feature, one platform.
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------- Outro ----------
const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const op = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const y = interpolate(
    spring({ frame, fps, config: { damping: 18 } }),
    [0, 1],
    [40, 0],
  );
  return (
    <AbsoluteFill
      style={{
        fontFamily: displayFont,
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
        padding: 80,
      }}
    >
      <div style={{ opacity: op, transform: `translateY(${y}px)` }}>
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: COLORS.white,
            lineHeight: 1.1,
            letterSpacing: -1.5,
            maxWidth: 1500,
          }}
        >
          Big decisions deserve{" "}
          <span style={{ color: COLORS.accent }}>the full picture.</span>
        </div>
        <div
          style={{
            fontFamily,
            fontSize: 28,
            color: COLORS.muted,
            marginTop: 36,
            letterSpacing: 1,
          }}
        >
          homelensais.com
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------- Slide content ----------
const slides: SlideProps[] = [
  {
    eyebrow: "01 — AI Home Search",
    title: "Ask anything. Get real answers.",
    description:
      "Search homes in natural language and let your AI copilot guide every step.",
    image: "features/f02.png",
    aspectRatio: 952 / 497,
    layout: "left",
  },
  {
    eyebrow: "02 — Property Analysis",
    title: "Listings, decoded in seconds.",
    description:
      "Paste any URL — get a Match Score, price check, and full breakdown right in chat.",
    image: "features/f03.png",
    aspectRatio: 2998 / 1364,
    layout: "right",
  },
  {
    eyebrow: "03 — Chrome Extension",
    title: "HomeLens, on every listing.",
    description:
      "Analyze Redfin, Zillow, and more without leaving the page you're already on.",
    image: "features/f01.png",
    aspectRatio: 3002 / 1566,
    layout: "left",
  },
  {
    eyebrow: "04 — Personal Preferences",
    title: "An AI that learns what matters.",
    description:
      "Tell HomeLens your goals, budget, and must-haves — every answer adapts to you.",
    image: "features/f10.png",
    aspectRatio: 802 / 567,
    layout: "right",
  },
  {
    eyebrow: "05 — Financial Calculators",
    title: "Know your number.",
    description:
      "Buying power, mortgage, and full PITI breakdown — no spreadsheets required.",
    image: "features/f04.png",
    aspectRatio: 2792 / 1394,
    layout: "left",
  },
  {
    eyebrow: "06 — Investor Calculator",
    title: "Run the numbers like a pro.",
    description:
      "Cash flow, DSCR, cap rate, returns and risk — advanced investment analysis in one place.",
    image: "features/f09.png",
    aspectRatio: 762 / 545,
    layout: "right",
  },
  {
    eyebrow: "07 — Investor Brief",
    title: "Your portfolio, grounded.",
    description:
      "Daily insights on equity, alerts, and opportunities across every property you own.",
    image: "features/f06.png",
    aspectRatio: 1119 / 538,
    layout: "left",
  },
  {
    eyebrow: "08 — My Properties",
    title: "Track what you own.",
    description:
      "Equity, monthly cash flow, cap rate and appreciation — all on one dashboard.",
    image: "features/f07.png",
    aspectRatio: 860 / 560,
    layout: "right",
  },
  {
    eyebrow: "09 — Saved Analyses",
    title: "Never lose a great find.",
    description:
      "Every AI analysis saved with notes, scores, and history — your investment diligence log.",
    image: "features/f08.png",
    aspectRatio: 767 / 535,
    layout: "left",
  },
];

// ---------- Composition ----------
// 30fps. Intro 80, each slide 90, transitions 14 (overlap). Outro 90.
// Total = 80 + 9*90 + 90 - 10*14  =  80 + 810 + 90 - 140 = 840
const SLIDE = 90;
const TR = 14;

export const FeaturesVideo: React.FC = () => {
  return (
    <AbsoluteFill>
      <PersistentBackground colors={COLORS} />
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={80}>
          <Intro />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TR })}
        />

        {slides.map((s, i) => (
          <>
            <TransitionSeries.Sequence
              key={`slide-${i}`}
              durationInFrames={SLIDE}
            >
              <FeatureSlide {...s} />
            </TransitionSeries.Sequence>
            <TransitionSeries.Transition
              key={`tr-${i}`}
              presentation={
                i % 3 === 0
                  ? slide({ direction: "from-right" })
                  : i % 3 === 1
                    ? wipe({ direction: "from-left" })
                    : fade()
              }
              timing={
                i % 2 === 0
                  ? springTiming({
                      config: { damping: 200 },
                      durationInFrames: TR,
                    })
                  : linearTiming({ durationInFrames: TR })
              }
            />
          </>
        ))}

        <TransitionSeries.Sequence durationInFrames={90}>
          <Outro />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};

export const FEATURES_DURATION =
  80 + slides.length * SLIDE + 90 - (slides.length + 1) * TR;