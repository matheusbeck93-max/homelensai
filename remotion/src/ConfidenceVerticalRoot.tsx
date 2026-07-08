import { Composition } from "remotion";
import { ConfidenceVerticalVideo } from "./ConfidenceVerticalVideo";

export const ConfidenceVerticalRoot = () => (
  <Composition
    id="confidence-vertical"
    component={ConfidenceVerticalVideo}
    durationInFrames={900}
    fps={30}
    width={1080}
    height={1920}
  />
);