import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppHeader from "./components/AppHeader";
import InstallPWA from "./components/InstallPWA";
import ProfileSheet from "./components/ProfileSheet";
import { HeaderProvider } from "./contexts/HeaderContext";
import { ProfileSheetProvider } from "./contexts/ProfileSheetContext";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Login from "./pages/Login";
import Events from "./pages/Events";
import CheckIn from "./pages/CheckIn";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import RegistroCulto from "./pages/RegistroCulto";
import VoluntariadoPublico from "./pages/VoluntariadoPublico";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Carregando...</div>;
  }

  if (!user) {
    window.location.href = '/login';
    return null;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path={"/login"} component={Login} />
      <Route path={"/events"} component={() => <ProtectedRoute component={Events} />} />
      <Route path={"/home"} component={() => <ProtectedRoute component={Home} />} />
      <Route path={"/profile"} component={() => <ProtectedRoute component={Profile} />} />
      <Route path={"/checkin/:eventId"} component={() => <ProtectedRoute component={CheckIn} />} />
      <Route path={"/cultos"} component={() => <ProtectedRoute component={RegistroCulto} />} />
      <Route path={"/cultos/:id"} component={() => <ProtectedRoute component={RegistroCulto} />} />
      <Route path={"/voluntariado"} component={VoluntariadoPublico} />
      <Route path={"/voluntariado/"} component={VoluntariadoPublico} />
      <Route path={"/voluntariado/cadastro"} component={VoluntariadoPublico} />
      <Route path={"/cadastro-voluntariado"} component={VoluntariadoPublico} />
      <Route path={"/:eventId"} component={() => <ProtectedRoute component={CheckIn} />} />
      <Route path={"/:eventId/checkin"} component={() => <ProtectedRoute component={CheckIn} />} />
      <Route path={"/"} component={Login} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ProfileSheetProvider>
          <HeaderProvider>
            <ThemeProvider defaultTheme="light">
              <TooltipProvider>
                <Toaster />
                <AppHeader />
                <Router />
                <ProfileSheet />
                <InstallPWA />
              </TooltipProvider>
            </ThemeProvider>
          </HeaderProvider>
        </ProfileSheetProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
