
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import Index from "./pages/Index";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import MatchesPage from "./pages/MatchesPage";
import MatchPage from "./pages/MatchPage";
import ProfilePage from "./pages/ProfilePage";
import CreateMatchPage from "./pages/CreateMatchPage";
import LeaderboardPage from "./pages/LeaderboardPage";
import NotFound from "./pages/NotFound";
import { Layout } from "./components/Layout";
import WalletPage from "./pages/WalletPage";
import { LichessCallback } from "./components/LichessCallback";
import EmailConfirmationPage from "./pages/EmailConfirmationPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/matches" element={<MatchesPage />} />
              <Route path="/match/:id" element={<MatchPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/create-match" element={<CreateMatchPage />} />
              <Route path="/leaderboard" element={<LeaderboardPage />} />
              <Route path="/wallet" element={<WalletPage />} />
              <Route path="/match/callback" element={<LichessCallback />} />
              <Route path="/auth/callback" element={<EmailConfirmationPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
