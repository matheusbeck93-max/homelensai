import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const rootElement = document.getElementById("root")!;

// Set dark mode as default before React renders
if (!localStorage.getItem('theme')) {
  localStorage.setItem('theme', 'dark');
  document.documentElement.classList.add('dark');
} else if (localStorage.getItem('theme') === 'dark') {
  document.documentElement.classList.add('dark');
}

createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
