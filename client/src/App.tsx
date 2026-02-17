import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ProjectProvider } from "@/contexts/ProjectContext";
import { ScreenRecorderProvider } from "@/contexts/ScreenRecorderContext";
import Header from "@/components/Header";
import ProjectManager from "@/pages/ProjectManager";
import VideoCreator from "@/pages/VideoCreator";
import ImageCreator from "@/pages/ImageCreator";
import ListingCopyCreator from "@/pages/ListingCopyCreator";
import VideoLibrary from "@/pages/VideoLibrary";
import VideoEditor from "@/pages/VideoEditor";
import Canvas from "@/pages/Canvas";
import AIAgent from "@/pages/AIAgent";
import Ideas from "@/pages/Ideas";
import PODWorkflows from "@/pages/PODWorkflows";
import Uploads from "@/pages/Uploads";
import Auth from "@/pages/Auth";
import BetaLogin from "@/pages/BetaLogin";
import Account from "@/pages/Account";
import AdminLogin from "@/pages/AdminLogin";
import Landing from "@/pages/Landing";
import Contact from "@/pages/Contact";
import Pricing from "@/pages/Pricing";
import CreateAdmin from "@/pages/CreateAdmin";
import BetaConfirmation from "@/pages/BetaConfirmation";
import Blog from "@/pages/Blog";
import BlogPost from "@/pages/BlogPost";
import LeadMagnet from "@/pages/LeadMagnet";
import LeadMagnetResults from "@/pages/LeadMagnetResults";
import NotFound from "@/pages/not-found";
import { useEffect } from "react";
import { useLocation } from "wouter";

function HomeRoute() {
  const { loading } = useAuth();

  if (loading) {
    return null;
  }

  // Always show landing page - no auto-redirect for authenticated users
  return <Landing />;
}

function Router() {
  const [location] = useLocation();

  // Scroll to top when route changes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);

  return (
    <Switch>
      <Route path="/" component={HomeRoute} />
      <Route path="/contact" component={Contact} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/auth" component={Auth} />
      <Route path="/beta-login" component={BetaLogin} />
      <Route path="/beta-confirmation" component={BetaConfirmation} />
      <Route path="/create-admin" component={CreateAdmin} />
      <Route path="/dashboard">
        {() => (
          <ProtectedRoute>
            <ProjectManager />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/create-video">
        {() => (
          <ProtectedRoute>
            <VideoCreator />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/images">
        {() => (
          <ProtectedRoute>
            <ImageCreator />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/copy">
        {() => (
          <ProtectedRoute>
            <ListingCopyCreator />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/library">
        {() => (
          <ProtectedRoute>
            <VideoLibrary />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/video-editor/:projectId">
        {() => (
          <ProtectedRoute>
            <VideoEditor />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/canvas">
        {() => (
          <ProtectedRoute>
            <Canvas />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/ai-agent">
        {() => (
          <ProtectedRoute>
            <AIAgent />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/ideas">
        {() => (
          <ProtectedRoute>
            <Ideas />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/pod-workflows">
        {() => (
          <ProtectedRoute>
            <PODWorkflows />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/uploads">
        {() => (
          <ProtectedRoute>
            <Uploads />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/account">
        {() => (
          <ProtectedRoute>
            <Account />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/admin" component={AdminLogin} />
      <Route path="/blog" component={Blog} />
      <Route path="/blog/:slug" component={BlogPost} />
      <Route path="/lead-magnet" component={LeadMagnet} />
      <Route path="/lead-magnet/results/:token" component={LeadMagnetResults} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [location] = useLocation();
  
  // Hide header and navigation on lead magnet pages
  const isLeadMagnetPage = location.startsWith('/lead-magnet');

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <AuthProvider>
            <ScreenRecorderProvider>
              <ProjectProvider>
                <div className="min-h-screen bg-background">
                  {!isLeadMagnetPage && <Header />}
                  <Router />
                </div>
                <Toaster />
              </ProjectProvider>
            </ScreenRecorderProvider>
          </AuthProvider>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
