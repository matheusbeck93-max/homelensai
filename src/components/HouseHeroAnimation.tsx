import React from "react";
import "./house-hero-animation.css";

export const HouseHeroAnimation: React.FC = () => {
  return (
    <div className="homelens-hero-animation" aria-hidden="true">
      <svg
        viewBox="0 0 120 120"
        className="homelens-hero-svg"
        role="img"
      >
        {/* Walls */}
        <rect
          x="25"
          y="50"
          width="70"
          height="50"
          rx="4"
          className="hero-house-walls"
        />

        {/* Roof */}
        <polygon
          points="60,25 20,55 100,55"
          className="hero-house-roof"
        />

        {/* Door */}
        <rect
          x="52"
          y="65"
          width="16"
          height="35"
          rx="2"
          className="hero-house-door"
        />

        {/* Left window */}
        <rect
          x="30"
          y="60"
          width="14"
          height="12"
          rx="2"
          className="hero-house-window hero-house-window-left"
        />

        {/* Right window */}
        <rect
          x="76"
          y="60"
          width="14"
          height="12"
          rx="2"
          className="hero-house-window hero-house-window-right"
        />
      </svg>
    </div>
  );
};
