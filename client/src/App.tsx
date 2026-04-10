import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Login from "./pages/Login";
import Events from "./pages/Events";
import CheckIn from "./pages/CheckIn";
import Home from "./pages/Home";
import RegistroCulto from "./pages/RegistroCulto";

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
      <Route path={"/checkin/:eventId"} component={() => <ProtectedRoute component={CheckIn} />} />
      <Route path={"/cultos"} component={() => <ProtectedRoute component={RegistroCulto} />} />
      <Route path={"/cultos/:id"} component={() => <ProtectedRoute component={RegistroCulto} />} />
      <Route path={"/:eventId"} component={() => <ProtectedRoute component={CheckIn} />} />
      <Route path={"/:eventId/checkin"} component={() => <ProtectedRoute component={CheckIn} />} />
      <Route path={"/"} component={Login} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider
          defaultTheme="light"
          // switchable
        >
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
