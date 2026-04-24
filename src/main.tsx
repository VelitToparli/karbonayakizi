import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./style.css";

const rootElement = document.querySelector<HTMLDivElement>("#app");
if (!rootElement) {
  throw new Error("Uygulama kapsayicisi bulunamadi.");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
