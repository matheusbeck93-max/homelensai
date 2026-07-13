import { Composition } from "remotion";
import { SlidesVerticalVideo } from "./SlidesVerticalVideo";

export const SlidesVerticalRoot = () => (
  <Composition
    id="slides-vertical"
    component={SlidesVerticalVideo}
    durationInFrames={600}
    fps={30}
    width={1080}
    height={1920}
  />
);