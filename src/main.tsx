import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

// Centralized suppression of benign aborts and cancelled async operations from triggering global error alerts
if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    if (
      reason?.name === "AbortError" ||
      reason?.code === "ABORT_ERR" ||
      reason?.code === 20 ||
      (typeof reason?.message === "string" && (
        reason.message.includes("aborted") ||
        reason.message.includes("signal is aborted") ||
        reason.message.includes("The user aborted a request") ||
        reason.message.includes("ResizeObserver loop")
      ))
    ) {
      event.preventDefault();
      return;
    }
  });

  window.addEventListener("error", (event) => {
    if (
      typeof event?.message === "string" && (
        event.message.includes("ResizeObserver loop") ||
        event.message.includes("AbortError") ||
        event.message.includes("The user aborted a request")
      )
    ) {
      event.preventDefault();
      return;
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

