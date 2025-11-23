import React from "react";
import "./house-hero-animation.css";

export const HouseHeroAnimation: React.FC = () => {
  return (
    <div className="homelens-hero-animation" aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        className="homelens-hero-svg"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* House outline - matches lucide Home icon exactly */}
        <path
          d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
          className="hero-logo-outline"
        />
        {/* Door - matches lucide Home icon exactly */}
        <path
          d="M9 22V12h6v10"
          className="hero-logo-door"
        />
      </svg>
    </div>
  );
};
