import React from "react";
import Lottie from "lottie-react";
import { Home } from "lucide-react";
import houseBuildAnimation from "@/assets/house-build-animation.json";

export const HouseBuildAnimation: React.FC = () => {
  const [error, setError] = React.useState(false);

  if (error) {
    return (
      <div className="w-full max-w-[220px] mx-auto animate-fade-in">
        <div className="flex items-center justify-center p-8">
          <Home className="h-24 w-24 text-primary animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[220px] md:max-w-[260px] mx-auto animate-fade-in">
      <Lottie
        animationData={houseBuildAnimation}
        loop={true}
        autoplay={true}
        onLoadedImages={() => setError(false)}
        onError={() => setError(true)}
        style={{
          width: "100%",
          height: "auto",
        }}
      />
    </div>
  );
};
