import React from "react";
import Lottie from "lottie-react";
import houseBuildAnimation from "@/assets/house-build-animation.json";

export const HouseBuildAnimation: React.FC = () => {
  return (
    <div className="w-full max-w-[300px] mx-auto animate-fade-in">
      <Lottie
        animationData={houseBuildAnimation}
        loop={true}
        autoplay={true}
        style={{
          width: "100%",
          height: "auto",
        }}
      />
    </div>
  );
};
