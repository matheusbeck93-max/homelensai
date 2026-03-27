import { AbsoluteFill } from "remotion";
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

export const MainVideo = () => {
  return (
    <AbsoluteFill>
      <PersistentBackground colors={COLORS} />

      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={140}>
          <Scene1Intro colors={COLORS} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: 25 })}
        />

        <TransitionSeries.Sequence durationInFrames={150}>
          <Scene2AIChat colors={COLORS} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-left" })}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: 25 })}
        />

        <TransitionSeries.Sequence durationInFrames={140}>
          <Scene3Features colors={COLORS} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: 25 })}
        />

        <TransitionSeries.Sequence durationInFrames={160}>
          <Scene4Calculators colors={COLORS} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-right" })}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: 25 })}
        />

        <TransitionSeries.Sequence durationInFrames={170}>
          <Scene5Closing colors={COLORS} />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
