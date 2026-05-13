import React from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { initSentry } from "./lib/sentry";

// Initialize Sentry error monitoring
initSentry();

// If the app boots successfully, clear the stale-chunk reload guard so that
// the next time a *different* dynamic chunk fails (after a future deploy)
// we are allowed to do one fresh reload again. Without this, the first
// chunk failure consumes the only reload, and any subsequent chunk failure
// hits the ErrorBoundary instead of self-recovering.
try {
  sessionStorage.removeItem("homelens:chunk-reload");
} catch {
  // ignore (private mode / storage disabled)
}

const rootElement = document.getElementById("root")!;

// Apply saved theme on load (default to light mode)
const savedTheme = localStorage.getItem('theme') || 'light';
if (savedTheme === 'dark') {
  document.documentElement.classList.add('dark');
} else {
  document.documentElement.classList.remove('dark');
  localStorage.setItem('theme', 'light');
}

createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <HelmetProvider>
        <App />
      </HelmetProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
