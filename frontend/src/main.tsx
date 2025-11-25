import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./index.css";
import ClientAppPage from "./pages/ClientApp";
import AdminPage from "./pages/AdminPage";
import HealthPage from "./pages/HealthPage";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/app" element={<ClientAppPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/health" element={<HealthPage />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
