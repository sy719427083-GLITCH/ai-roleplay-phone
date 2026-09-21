import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import "./styles.css";
import { OfficeWorkProvider } from "./OfficeWorkContext.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <OfficeWorkProvider><App /></OfficeWorkProvider>
  </React.StrictMode>,
);
