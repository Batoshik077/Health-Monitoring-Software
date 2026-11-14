import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import "./index.css";
import { SnapshotProvider } from "./lib/snapshot";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <SnapshotProvider>
        <App />
      </SnapshotProvider>
    </BrowserRouter>
  </StrictMode>,
);
