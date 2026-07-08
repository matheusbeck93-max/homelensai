import { AbsoluteFill, Sequence } from "remotion";
import { VerticalBackground } from "./components/VerticalBackground";
import { CScene1Hook } from "./scenes-confidence/CScene1Hook";
import { CScene2Problem } from "./scenes-confidence/CScene2Problem";
import { CScene3Introduce } from "./scenes-confidence/CScene3Introduce";
import { CScene4Features } from "./scenes-confidence/CScene4Features";
import { CScene5Payoff } from "./scenes-confidence/CScene5Payoff";
import { CScene6Logo } from "./scenes-confidence/CScene6Logo";

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

export const ConfidenceVerticalVideo = () => {
  return (
    <AbsoluteFill>
      <VerticalBackground colors={COLORS} />

      <Sequence from={0} durationInFrames={90}>
        <CScene1Hook colors={COLORS} />
      </Sequence>
      <Sequence from={90} durationInFrames={150}>
        <CScene2Problem colors={COLORS} />
      </Sequence>
      <Sequence from={240} durationInFrames={120}>
        <CScene3Introduce colors={COLORS} />
      </Sequence>
      <Sequence from={360} durationInFrames={300}>
        <CScene4Features colors={COLORS} />
      </Sequence>
      <Sequence from={660} durationInFrames={180}>
        <CScene5Payoff colors={COLORS} />
      </Sequence>
      <Sequence from={840} durationInFrames={60}>
        <CScene6Logo colors={COLORS} />
      </Sequence>
    </AbsoluteFill>
  );
};