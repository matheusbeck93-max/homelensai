import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { Scene1Intro } from "./scenes/Scene1Intro";
import { Scene2AIChat } from "./scenes/Scene2AIChat";
import { Scene3Features } from "./scenes/Scene3Features";
import { Scene4Calculators } from "./scenes/Scene4Calculators";
import { Scene5Closing } from "./scenes/Scene5Closing";
import { PersistentBackground } from "./components/PersistentBackground";

const COLORS = {
  primary: "#3E8DA0",
  secondary: "#3EBF8A",
  dark: "#141B2D",
  darkMid: "#1E2A42",
  white: "#F8FAFC",
  muted: "#94A3B8",
};

export const MainVideo = () => {
  return (
    <AbsoluteFill>
      <PersistentBackground colors={COLORS} />

      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={130}>
          <Scene1Intro colors={COLORS} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: 20 })}
        />

        <TransitionSeries.Sequence durationInFrames={130}>
          <Scene2AIChat colors={COLORS} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-left" })}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: 20 })}
        />

        <TransitionSeries.Sequence durationInFrames={130}>
          <Scene3Features colors={COLORS} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: 20 })}
        />

        <TransitionSeries.Sequence durationInFrames={130}>
          <Scene4Calculators colors={COLORS} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-right" })}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: 20 })}
        />

        <TransitionSeries.Sequence durationInFrames={140}>
          <Scene5Closing colors={COLORS} />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
