import { useState, useEffect } from "react";

const placeholders = [
  "Ask about properties dropping a link from any real estate - calculate mortgage, analyze investment, compare and get unlimited insights...",
  "Find 3-bedroom homes under $650k with ROI over 15%...",
  "Compare investment properties in Arlington...",
  "Calculate mortgage for a $500k property with 20% down...",
  "Analyze rental income potential for multi-family homes...",
  "What are the best neighborhoods for investment properties?",
];

export function useTypingPlaceholder() {
  const [placeholder, setPlaceholder] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentText = placeholders[currentIndex];
    const typingSpeed = isDeleting ? 30 : 50;
    const pauseTime = isDeleting ? 500 : 2000;

    const timeout = setTimeout(() => {
      if (!isDeleting && placeholder === currentText) {
        // Finished typing, pause then start deleting
        setTimeout(() => setIsDeleting(true), pauseTime);
        return;
      }

      if (isDeleting && placeholder === "") {
        // Finished deleting, move to next placeholder
        setIsDeleting(false);
        setCurrentIndex((prev) => (prev + 1) % placeholders.length);
        return;
      }

      if (isDeleting) {
        // Delete one character
        setPlaceholder(currentText.substring(0, placeholder.length - 1));
      } else {
        // Type one character
        setPlaceholder(currentText.substring(0, placeholder.length + 1));
      }
    }, typingSpeed);

    return () => clearTimeout(timeout);
  }, [placeholder, currentIndex, isDeleting]);

  return placeholder;
}
