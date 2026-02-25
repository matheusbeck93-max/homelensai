import { useState, useEffect } from "react";

const placeholders = [
  "How much house can I realistically afford with $85k income?",
  "Is it better to increase my down payment or lower my rate?",
  "Can I afford a $450,000 home with $30k down?",
  "Is this house too expensive for my income?",
  "Are there any first-time homebuyer incentives available in Tampa, Florida?",
  "Does New York offer any homebuyer assistance programs for middle-income families?",
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
