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
import EventList from "./pages/EventList";
import EventDetails from "./pages/EventDetails";
import RegistrationConfirmation from "./pages/RegistrationConfirmation";
import RegistrationView from "./pages/RegistrationView";
import PixConfirmation from "./pages/PixConfirmation";
import RegistrationSuccess from "./pages/RegistrationSuccess";
import Ticket from "./pages/Ticket";
import CheckIn from "./pages/CheckIn";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import RegistroCulto from "./pages/RegistroCulto";
import VoluntariadoPublico from "./pages/VoluntariadoPublico";
import CelulaLider from "./pages/CelulaLider";
import CelulaPresenca from "./pages/CelulaPresenca";
import PerguntasAoVivo from "./pages/PerguntasAoVivo";
import PerguntasAoVivoSala from "./pages/PerguntasAoVivoSala";
import CfmPresenca from "./pages/cfm/CfmPresenca";

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
      <Route path={"/eventos"} component={EventList} />
      <Route path={"/eventos/:id"} component={EventDetails} />
      <Route path={"/inscricao/:orderCode"} component={RegistrationConfirmation} />
      <Route path={"/inscricao/:orderCode/visualizacao"} component={RegistrationView} />
      <Route path={"/pix-confirmacao"} component={PixConfirmation} />
      <Route path={"/inscricao/:orderCode/sucesso"} component={RegistrationSuccess} />
      <Route path={"/ticket/:orderCode"} component={Ticket} />
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
      <Route path={"/perguntas"} component={() => <ProtectedRoute component={PerguntasAoVivo} />} />
      <Route path={"/perguntas/:id"} component={() => <ProtectedRoute component={PerguntasAoVivoSala} />} />
      <Route path={"/celula"} component={() => <ProtectedRoute component={CelulaLider} />} />
      <Route path={"/celula/presenca/:reuniaoId"} component={() => <ProtectedRoute component={CelulaPresenca} />} />
      <Route path={"/cfm/presenca"} component={() => <ProtectedRoute component={CfmPresenca} />} />
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
