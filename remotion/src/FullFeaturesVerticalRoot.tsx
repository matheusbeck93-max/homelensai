import { Composition } from "remotion";
import { FullFeaturesVerticalVideo } from "./FullFeaturesVerticalVideo";

export const FullFeaturesVerticalRoot = () => (
  <Composition
    id="full-features-vertical"
    component={FullFeaturesVerticalVideo}
    durationInFrames={900}
    fps={30}
    width={1080}
    height={1920}
  />
);