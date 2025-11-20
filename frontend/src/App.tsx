import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Activity from "./pages/Activity";
import NewCertificate from "./pages/ssl-agent/NewCertificate";
import RenewCertificate from "./pages/ssl-agent/RenewCertificate";
import PfxGenerator from "./pages/ssl-agent/PfxGenerator";
import CrtKeyUploader from "./pages/ssl-agent/CrtKeyUploader";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/activity" element={
              <ProtectedRoute>
                <Layout>
                  <Activity />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/ssl-agent" element={<Navigate to="/ssl-agent/new" replace />} />
            <Route path="/ssl-agent/new" element={
              <ProtectedRoute>
                <Layout>
                  <NewCertificate />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/ssl-agent/renew" element={
              <ProtectedRoute>
                <Layout>
                  <RenewCertificate />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/ssl-agent/pfx" element={
              <ProtectedRoute>
                <Layout>
                  <PfxGenerator />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/ssl-agent/upload" element={
              <ProtectedRoute>
                <Layout>
                  <CrtKeyUploader />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
