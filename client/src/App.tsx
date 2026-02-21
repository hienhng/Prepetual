import { Switch, Route, useLocation, Link } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QuizProvider } from "@/lib/quiz-context";
import { QuizNavigationGuardProvider } from "@/lib/quiz-navigation-guard";
import { UploadProvider } from "@/lib/upload-context";
import { AuthDialogProvider, useAuthDialog } from "@/lib/auth-context";
import { GlobalUploadIndicator } from "@/components/global-upload-indicator";
import { TopLoaderProvider } from "@/components/top-loader";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/hooks/useAuth";
import { LogIn, LogOut, User, Menu, Settings as SettingsIcon } from "lucide-react";
import logoImage from "@assets/image_1765894870887.png";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { VerificationPrompt } from "@/components/verification-prompt";
import Home from "@/pages/home";
import Dashboard from "@/pages/dashboard";
import Create from "@/pages/create";
import Feed from "@/pages/feed";
import Generate from "@/pages/generate";
import Quiz from "@/pages/quiz";
import Results from "@/pages/results";
import HistoryPage from "@/pages/history";
import Study from "@/pages/study";
import Share from "@/pages/share";
import EditQuiz from "@/pages/edit-quiz";
import VerifyEmailPage from "@/pages/verify-email";
import ResetPasswordPage from "@/pages/reset-password";
import ForgotPasswordPage from "@/pages/forgot-password";
import TermsOfService from "@/pages/terms";
import PrivacyPolicy from "@/pages/privacy";
import About from "@/pages/about";
import Contact from "@/pages/contact";
import FAQ from "@/pages/faq";
import HelpCenter from "@/pages/help-center";
import RevisionSummary from "@/pages/revision-summary";
import Settings from "@/pages/settings";
import Blog from "@/pages/blog";
import BlogPost from "@/pages/blog-post";
import FolderPage from "@/pages/folder";
import ProgressPage from "@/pages/progress";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth";
import { Footer } from "@/components/footer";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    setLocation("/auth");
    return null;
  }

  return <Component />;
}

function AuthenticatedRouter() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/create" component={Create} />
      <Route path="/feed" component={Feed} />
      <Route path="/verify-email" component={VerifyEmailPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/generate" component={Generate} />
      <Route path="/quiz" component={Quiz} />
      <Route path="/results" component={Results} />
      <Route path="/history" component={HistoryPage} />
      <Route path="/folder/:id" component={FolderPage} />
      <Route path="/study" component={Study} />
      <Route path="/share/:id" component={Share} />
      <Route path="/edit-quiz" component={EditQuiz} />
      <Route path="/revision-summary" component={RevisionSummary} />
      <Route path="/progress" component={ProgressPage} />
      <Route path="/settings" component={Settings} />
      <Route path="/blog" component={Blog} />
      <Route path="/blog/:id" component={BlogPost} />
      <Route path="/terms" component={TermsOfService} />
      <Route path="/privacy" component={PrivacyPolicy} />
      <Route path="/about" component={About} />
      <Route path="/contact" component={Contact} />
      <Route path="/faq" component={FAQ} />
      <Route path="/help" component={HelpCenter} />
      <Route component={NotFound} />
    </Switch>
  );
}

function PublicRouter() {
  return (
    <Switch>
      {/* Public pages accessible to guests */}
      <Route path="/" component={Home} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/blog" component={Blog} />
      <Route path="/blog/:id" component={BlogPost} />
      <Route path="/terms" component={TermsOfService} />
      <Route path="/privacy" component={PrivacyPolicy} />
      <Route path="/about" component={About} />
      <Route path="/contact" component={Contact} />
      <Route path="/faq" component={FAQ} />
      <Route path="/help" component={HelpCenter} />
      <Route path="/share/:id" component={Share} />
      {/* Guest-accessible quiz experience (from shared links) */}
      <Route path="/quiz" component={Quiz} />
      <Route path="/results" component={Results} />
      <Route path="/revision-summary" component={RevisionSummary} />
      {/* Auth flow pages */}
      <Route path="/verify-email" component={VerifyEmailPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      {/* Protected pages - redirect to home with login prompt */}
      <Route path="/dashboard">{() => <ProtectedRoute component={Dashboard} />}</Route>
      <Route path="/create">{() => <ProtectedRoute component={Create} />}</Route>
      <Route path="/feed">{() => <ProtectedRoute component={Feed} />}</Route>
      <Route path="/generate">{() => <ProtectedRoute component={Generate} />}</Route>
      <Route path="/history">{() => <ProtectedRoute component={HistoryPage} />}</Route>
      <Route path="/folder/:id">{() => <ProtectedRoute component={FolderPage} />}</Route>
      <Route path="/study">{() => <ProtectedRoute component={Study} />}</Route>
      <Route path="/edit-quiz">{() => <ProtectedRoute component={EditQuiz} />}</Route>
      <Route path="/progress">{() => <ProtectedRoute component={ProgressPage} />}</Route>
      <Route path="/settings">{() => <ProtectedRoute component={Settings} />}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function PublicHeader() {
  const { isLoading } = useAuth();
  const { openLoginDialog, openSignUpDialog } = useAuthDialog();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full flex justify-center pt-4 px-4">
      <div className="flex items-center justify-between gap-4 h-12 px-5 rounded-full border border-border/40 bg-background/50 backdrop-blur-md shadow-sm max-w-2xl w-full">
        <Link href="/" className="flex items-center gap-2" data-testid="link-logo">
          <img 
            src={logoImage} 
            alt="Prepetual Logo" 
            className="w-8 h-8 rounded-full object-cover"
          />
          <span className="pb-0.5 text-lg font-brand text-foreground hidden sm:inline">prepetual</span>
        </Link>
        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          {!isLoading && (
            <>
              <Button variant="ghost" size="sm" onClick={openLoginDialog} data-testid="button-login">
                Log in
              </Button>
              <Button variant="default" size="sm" onClick={openSignUpDialog} data-testid="button-signup">
                Sign up
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function AuthenticatedHeader() {
  const { user } = useAuth();
  const [location] = useLocation();

  const getInitials = () => {
    if (user?.username) {
      return user.username[0].toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return "U";
  };

  const getPageTitle = () => {
    switch (location) {
      case "/": return "Home";
      case "/create": return "Create Quiz";
      case "/feed": return "Community Feed";
      case "/dashboard": return "Dashboard";
      case "/history": return "Archive";
      case "/generate": return "Generate Quiz";
      case "/quiz": return "Quiz";
      case "/results": return "Results";
      case "/study": return "Study Mode";
      case "/edit-quiz": return "Edit Quiz";
      case "/progress": return "Progress";
      case "/about": return "About";
      case "/contact": return "Contact";
      case "/terms": return "Terms of Service";
      case "/privacy": return "Privacy Policy";
      default: return "Prepetual";
    }
  };

  return (
    <header className="sticky top-0 z-40 flex md:hidden h-14 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
      <SidebarTrigger data-testid="button-sidebar-toggle" />
      <div className="flex-1">
        <h1 className="text-lg font-semibold">{getPageTitle()}</h1>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full" data-testid="button-user-menu-mobile">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.profileImageUrl || undefined} alt={user?.username || "User"} className="object-cover" />
                <AvatarFallback>{getInitials()}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="text-muted-foreground" disabled>
              <User className="h-4 w-4 mr-2" />
              {user?.email || "User"}
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings" data-testid="link-settings-mobile">
                <SettingsIcon className="h-4 w-4 mr-2" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
                queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
                window.location.href = "/";
              }}
              data-testid="button-logout-mobile"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}


function AuthenticatedLayout() {
  const { user } = useAuth();
  const [location] = useLocation();
  const showFooter = location === "/about" || location === "/terms" || location === "/privacy" || location === "/contact";
  const hideSidebar = location === "/quiz" || location === "/results" || location === "/revision-summary";

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  } as React.CSSProperties;

  if (hideSidebar) {
    return (
      <>
        <div className="min-h-screen w-full">
          <main className="flex-1">
            <AuthenticatedRouter />
          </main>
        </div>
        {user && !user.emailVerified && (
          <VerificationPrompt email={user.email} open={true} />
        )}
      </>
    );
  }

  return (
    <>
      <SidebarProvider style={sidebarStyle}>
        <div className="flex min-h-screen w-full">
          <AppSidebar />
          <SidebarInset className="flex flex-col flex-1">
            <AuthenticatedHeader />
            <main className="flex-1">
              <AuthenticatedRouter />
            </main>
            {showFooter && <Footer />}
          </SidebarInset>
        </div>
      </SidebarProvider>
      {user && !user.emailVerified && (
        <VerificationPrompt email={user.email} open={true} />
      )}
    </>
  );
}

function PublicLayout() {
  const [location] = useLocation();
  const showFooter = location === "/about" || location === "/terms" || location === "/privacy" || location === "/contact";
  const isAuthPage = location === "/auth";

  if (isAuthPage) {
    return <PublicRouter />;
  }

  return (
    <div className="min-h-screen flex flex-col pt-16">
      <PublicHeader />
      <main className="flex-1">
        <PublicRouter />
      </main>
      {showFooter && <Footer />}
    </div>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return isAuthenticated ? <AuthenticatedLayout /> : <PublicLayout />;
}

function AppWithAuth() {
  const [, setLocation] = useLocation();
  
  return (
    <AuthDialogProvider navigate={setLocation}>
      <QuizProvider>
        <QuizNavigationGuardProvider>
          <UploadProvider>
            <AppContent />
            <GlobalUploadIndicator />
            <Toaster />
          </UploadProvider>
        </QuizNavigationGuardProvider>
      </QuizProvider>
    </AuthDialogProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <TopLoaderProvider>
          <AppWithAuth />
        </TopLoaderProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
