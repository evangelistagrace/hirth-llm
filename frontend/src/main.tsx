import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
// Suppress TypeScript error for side-effect CSS import when no type declarations are present
// @ts-ignore: Implicit any module for CSS
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
