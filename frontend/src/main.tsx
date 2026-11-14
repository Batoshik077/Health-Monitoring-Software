import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import "./index.css";
import { LangProvider } from "./lib/i18n";
import { SnapshotProvider } from "./lib/snapshot";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LangProvider>
      <BrowserRouter>
        <SnapshotProvider>
          <App />
        </SnapshotProvider>
      </BrowserRouter>
    </LangProvider>
  </StrictMode>,
);
