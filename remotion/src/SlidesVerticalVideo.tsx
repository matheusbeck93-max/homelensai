import { AbsoluteFill, Sequence, useCurrentFrame, interpolate } from "remotion";
import { SSlide1 } from "./scenes-slides/SSlide1";
import { SSlide2 } from "./scenes-slides/SSlide2";
import { SSlide3 } from "./scenes-slides/SSlide3";

export const SlidesVerticalVideo = () => {
  const frame = useCurrentFrame();
  // soft off-white gradient background (only visible during transitions)
  const bgShift = interpolate(frame, [0, 600], [0, 40]);
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, #F4F7FB 0%, #E9EFF7 50%, #F4F7FB 100%)`,
        backgroundPosition: `0 ${bgShift}px`,
      }}
    >
      <Sequence from={0} durationInFrames={190}>
        <SSlide1 />
      </Sequence>
      <Sequence from={180} durationInFrames={210}>
        <SSlide2 />
      </Sequence>
      <Sequence from={380} durationInFrames={220}>
        <SSlide3 />
      </Sequence>
    </AbsoluteFill>
  );
};