import { Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "./routes/LoginPage";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { SchedulePage } from "./routes/SchedulePage";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/schedule" element={<SchedulePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/schedule" replace />} />
    </Routes>
  );
}
