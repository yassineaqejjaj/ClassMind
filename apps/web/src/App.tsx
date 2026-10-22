import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import Layout from "./components/Layout";
import { Loading } from "./components/ui";
import { userManager } from "./services/auth";
import AnalysisPage from "./pages/Analysis";
import ClassDetailPage from "./pages/ClassDetail";
import ClassesPage from "./pages/Classes";
import CurriculumPage from "./pages/Curriculum";
import Dashboard from "./pages/Dashboard";
import Studio from "./pages/Studio";
import ImportCsv from "./pages/ImportCsv";
import LibraryPage from "./pages/Library";
import LoginPage from "./pages/Login";
import ProgressPage from "./pages/ProgressPage";
import SettingsPage from "./pages/Settings";

function Callback() {
  const nav = useNavigate();
  useEffect(() => {
    userManager
      .signinRedirectCallback()
      .then(() => nav("/", { replace: true }))
      .catch(() => nav("/connexion", { replace: true }));
  }, [nav]);
  return <Loading />;
}

function Protected() {
  const [state, setState] = useState<"loading" | "in" | "out">("loading");
  useEffect(() => {
    userManager.getUser().then((u) => setState(u && !u.expired ? "in" : "out"));
  }, []);
  if (state === "loading") return <Loading />;
  return state === "in" ? <Layout /> : <Navigate to="/connexion" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/connexion" element={<LoginPage />} />
      <Route path="/callback" element={<Callback />} />
      <Route element={<Protected />}>
        <Route index element={<Dashboard />} />
        <Route path="classes" element={<ClassesPage />} />
        <Route path="classes/:id" element={<ClassDetailPage />} />
        <Route path="classes/:id/import" element={<ImportCsv />} />
        <Route path="classes/:id/progression" element={<ProgressPage />} />
        <Route path="evaluations/:id" element={<AnalysisPage />} />
        <Route path="competences" element={<CurriculumPage />} />
        <Route path="exercices/nouveau" element={<Studio />} />
        <Route path="exercices/:id" element={<Studio />} />
        <Route path="bibliotheque" element={<LibraryPage />} />
        <Route path="parametres" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
