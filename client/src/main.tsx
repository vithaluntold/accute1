import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./styles/global-responsive.css";
import "./styles/luca-widget.css";

// Register service worker for PWA support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((registration) => {
        console.log('SW registered:', registration);
      })
      .catch((error) => {
        console.log('SW registration failed:', error);
      });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
