import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ProtectedRoute } from "@/components/protected-route";
import { RoleGuard } from "@/components/role-guard";
import { OrganizationRoute } from "@/components/organization-route";
import { isAuthenticated, getUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, Bell, User, Building2, ChevronDown, Settings as SettingsIcon, HelpCircle } from "lucide-react";
import { FinACEverseFooter } from "@/components/finaceverse-footer";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { LucaChatWidget } from "@/components/luca-chat-widget";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { useMobileDetect } from "@/hooks/use-mobile-detect";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

const Landing = lazy(() => import("@/pages/landing"));
const Login = lazy(() => import("@/pages/login"));
const Register = lazy(() => import("@/pages/register"));
const PublicFormPage = lazy(() => import("@/pages/public-form"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const OnboardingPage = lazy(() => import("@/pages/onboarding"));
const Settings = lazy(() => import("@/pages/settings"));
const Analytics = lazy(() => import("@/pages/analytics"));
const Workflows = lazy(() => import("@/pages/workflows"));
const WorkflowDetail = lazy(() => import("@/pages/workflow-detail"));
const WorkflowBuilder = lazy(() => import("@/pages/workflow-builder"));
const AIAgents = lazy(() => import("@/pages/ai-agents"));
const AgentDetail = lazy(() => import("@/pages/agent-detail"));
const Marketplace = lazy(() => import("@/pages/marketplace"));
const Assignments = lazy(() => import("@/pages/assignments"));
const AssignmentDetail = lazy(() => import("@/pages/assignment-detail"));
const AssignmentBot = lazy(() => import("@/pages/assignment-bot"));
const ClientOnboarding = lazy(() => import("@/pages/client-onboarding"));
const Kanban = lazy(() => import("@/pages/kanban"));
const Team = lazy(() => import("@/pages/team"));
const Roles = lazy(() => import("@/pages/roles"));
const Documents = lazy(() => import("@/pages/documents"));
const Forms = lazy(() => import("@/pages/forms"));
const FormBuilder = lazy(() => import("@/pages/form-builder"));
const FormPreview = lazy(() => import("@/pages/form-preview"));
const FormSubmissions = lazy(() => import("@/pages/form-submissions"));
const FormAnalytics = lazy(() => import("@/pages/form-analytics"));
const SubmissionDetail = lazy(() => import("@/pages/submission-detail"));
const Clients = lazy(() => import("@/pages/clients"));
const Contacts = lazy(() => import("@/pages/contacts"));
const Tags = lazy(() => import("@/pages/tags"));
const Folders = lazy(() => import("@/pages/folders"));
const DocumentRequests = lazy(() => import("@/pages/document-requests"));
const MyDocumentRequests = lazy(() => import("@/pages/my-document-requests"));
const Messages = lazy(() => import("@/pages/messages"));
const TimeTracking = lazy(() => import("@/pages/time-tracking"));
const Invoices = lazy(() => import("@/pages/invoices"));
const Payments = lazy(() => import("@/pages/payments"));
const Signatures = lazy(() => import("@/pages/signatures"));
const Projects = lazy(() => import("@/pages/projects"));
const ProjectDetail = lazy(() => import("@/pages/project-detail"));
const TeamChat = lazy(() => import("@/pages/team-chat"));
const Calendar = lazy(() => import("@/pages/calendar"));
const EmailTemplates = lazy(() => import("@/pages/email-templates"));
const MessageTemplates = lazy(() => import("@/pages/message-templates"));
const EmailAccounts = lazy(() => import("@/pages/email-accounts"));
const Inbox = lazy(() => import("@/pages/inbox"));
const NotFound = lazy(() => import("@/pages/not-found"));
const MobileApps = lazy(() => import("@/pages/mobile-apps"));
const OrganizationsPage = lazy(() => import("@/pages/admin/organizations"));
const SubscriptionsPage = lazy(() => import("@/pages/admin/subscriptions"));
const SubscriptionAnalyticsPage = lazy(() => import("@/pages/admin/subscription-analytics"));
const SubscriptionPlansPage = lazy(() => import("@/pages/admin/subscription-plans"));
const PricingRegionsPage = lazy(() => import("@/pages/admin/pricing-regions"));
const CouponsPage = lazy(() => import("@/pages/admin/coupons"));
const PlatformSettingsPage = lazy(() => import("@/pages/admin/platform-settings"));
const AllUsersPage = lazy(() => import("@/pages/admin/users"));
const KycVerificationPage = lazy(() => import("@/pages/admin/kyc-verification"));
const PricingManagementPage = lazy(() => import("@/pages/admin/pricing-management"));
const SubscriptionSelectPage = lazy(() => import("@/pages/subscription-select"));
const AdminTicketsPage = lazy(() => import("@/pages/admin/tickets"));
const MarketplaceCreatePage = lazy(() => import("@/pages/admin/marketplace-create"));
const MarketplacePublishedPage = lazy(() => import("@/pages/admin/marketplace-published"));
const AdminDashboard = lazy(() => import("@/pages/admin/admin-dashboard"));
const AgentFoundryPage = lazy(() => import("@/pages/admin/agent-foundry"));
const ClientPortalDashboard = lazy(() => import("@/pages/client-portal/dashboard"));
const ClientMyDocuments = lazy(() => import("@/pages/client-portal/my-documents"));
const ClientMyTasks = lazy(() => import("@/pages/client-portal/my-tasks"));
const ClientMyForms = lazy(() => import("@/pages/client-portal/my-forms"));
const ClientMySignatures = lazy(() => import("@/pages/client-portal/my-signatures"));
const ClientPortalMessages = lazy(() => import("@/pages/client-portal/messages"));
const RoundtablePage = lazy(() => import("@/pages/roundtable"));
const RoundtableDetail = lazy(() => import("@/pages/roundtable-detail"));
const TeamsPage = lazy(() => import("@/pages/teams"));
const TeamDetailPage = lazy(() => import("@/pages/team-detail"));
const TeamHierarchyPage = lazy(() => import("@/pages/team-hierarchy"));
const ManagerDashboardPage = lazy(() => import("@/pages/manager-dashboard"));
const AutomatedInvoicing = lazy(() => import("@/pages/automated-invoicing"));
const SubscriptionPricing = lazy(() => import("@/pages/subscription-pricing"));
const EmployeeProfile = lazy(() => import("@/pages/employee-profile"));
const LiveChat = lazy(() => import("@/pages/live-chat"));
const AgentIntegrationGuide = lazy(() => import("@/pages/agent-integration-guide"));
const Help = lazy(() => import("@/pages/help"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-screen" data-testid="page-loader">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const user = getUser();
  const { isMobile } = useMobileDetect();
  const [, setLocation] = useLocation();

  const { data: notifications = [] } = useQuery<any[]>({
    queryKey: ["/api/notifications"],
    enabled: !!user,
  });

  const unreadCount = notifications.filter((n: any) => !n.isRead).length;

  return (
    <>
      <SidebarProvider>
        <div className="flex h-screen w-full">
          <AppSidebar />
          <div className="flex flex-col flex-1 overflow-hidden">
            <header className="flex items-center justify-between gap-4 px-4 py-3 border-b bg-background">
              <div className="flex items-center gap-4 flex-1">
                <SidebarTrigger data-testid="button-sidebar-toggle" />
                
                <div className="relative max-w-md flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search workflows, clients, documents..."
                    className="pl-9"
                    data-testid="input-global-search"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
              <ThemeToggle />
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" data-testid="button-workspace-switcher" className="gap-2">
                    <Building2 className="h-4 w-4" />
                    <span className="hidden md:inline">Workspace</span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Switch Workspace</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem data-testid="menu-item-current-workspace">
                    Current Organization
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem data-testid="menu-item-create-workspace">
                    Create New Workspace
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Badge variant="outline" data-testid="badge-role-indicator" className="hidden md:flex">
                {user?.role || 'User'}
              </Badge>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative" data-testid="button-notifications">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center" data-testid="badge-notification-count">
                        {unreadCount}
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground" data-testid="text-no-notifications">
                      No notifications
                    </div>
                  ) : (
                    notifications.slice(0, 5).map((notif: any) => (
                      <DropdownMenuItem key={notif.id} data-testid={`notification-${notif.id}`}>
                        <div className="flex flex-col gap-1">
                          <p className="text-sm font-medium">{notif.title}</p>
                          <p className="text-xs text-muted-foreground">{notif.message}</p>
                        </div>
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" data-testid="button-profile-menu">
                    <User className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>
                    <div className="flex flex-col">
                      <span className="font-medium" data-testid="text-user-name">{user?.username || 'User'}</span>
                      <span className="text-xs text-muted-foreground" data-testid="text-user-email">{user?.email}</span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => setLocation('/settings')} 
                    data-testid="menu-item-settings"
                  >
                    <SettingsIcon className="h-4 w-4 mr-2" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => setLocation('/profile')} 
                    data-testid="menu-item-profile"
                  >
                    <User className="h-4 w-4 mr-2" />
                    Profile Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => setLocation('/settings?tab=preferences')} 
                    data-testid="menu-item-preferences"
                  >
                    <SettingsIcon className="h-4 w-4 mr-2" />
                    Preferences
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => setLocation('/help')} 
                    data-testid="menu-item-help"
                  >
                    <HelpCircle className="h-4 w-4 mr-2" />
                    Help & Support
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main className={`flex-1 overflow-auto ${isMobile ? 'pb-16' : ''}`}>
            {children}
          </main>
        </div>
        <FinACEverseFooter />
        {isMobile && <MobileBottomNav />}
        <PWAInstallPrompt />
      </div>
    </SidebarProvider>
    
    {/* Luca Chat Widget - Outside SidebarProvider for true fixed positioning */}
    <LucaChatWidget />
  </>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      {/* DISABLED: Subscription pricing removed */}
      {/* <Route path="/subscription-pricing" component={SubscriptionPricing} /> */}
      
      {/* Public route - NO authentication required */}
      <Route path="/public/:shareToken" component={PublicFormPage} />

      <Route path="/dashboard">
        <OrganizationRoute>
          <AppLayout>
            <Dashboard />
          </AppLayout>
        </OrganizationRoute>
      </Route>
      <Route path="/onboarding">
        <OrganizationRoute>
          <AppLayout>
            <OnboardingPage />
          </AppLayout>
        </OrganizationRoute>
      </Route>
      <Route path="/settings">
        <OrganizationRoute>
          <AppLayout>
            <Settings />
          </AppLayout>
        </OrganizationRoute>
      </Route>
      <Route path="/profile">
        <ProtectedRoute>
          <AppLayout>
            <EmployeeProfile />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/help">
        <OrganizationRoute>
          <AppLayout>
            <Help />
          </AppLayout>
        </OrganizationRoute>
      </Route>
      <Route path="/subscription">
        <ProtectedRoute>
          <RoleGuard allowedRoles={["Super Admin", "Admin"]}>
            <AppLayout>
              <SubscriptionSelectPage />
            </AppLayout>
          </RoleGuard>
        </ProtectedRoute>
      </Route>
      <Route path="/subscription-pricing">
        <ProtectedRoute>
          <RoleGuard allowedRoles={["Super Admin", "Admin"]}>
            <AppLayout>
              <SubscriptionPricing />
            </AppLayout>
          </RoleGuard>
        </ProtectedRoute>
      </Route>
      <Route path="/mobile-apps">
        <OrganizationRoute>
          <AppLayout>
            <MobileApps />
          </AppLayout>
        </OrganizationRoute>
      </Route>
      {/* Super Admin Routes - Platform-Scoped Only */}
      <Route path="/admin/dashboard">
        <ProtectedRoute>
          <RoleGuard allowedRoles={["Super Admin"]}>
            <AppLayout>
              <AdminDashboard />
            </AppLayout>
          </RoleGuard>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/organizations">
        <ProtectedRoute>
          <RoleGuard allowedRoles={["Super Admin"]}>
            <AppLayout>
              <OrganizationsPage />
            </AppLayout>
          </RoleGuard>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/pricing">
        <ProtectedRoute>
          <RoleGuard allowedRoles={["Super Admin"]}>
            <AppLayout>
              <PricingManagementPage />
            </AppLayout>
          </RoleGuard>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/subscriptions">
        <ProtectedRoute>
          <RoleGuard allowedRoles={["Super Admin"]}>
            <AppLayout>
              <SubscriptionsPage />
            </AppLayout>
          </RoleGuard>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/subscription-analytics">
        <ProtectedRoute>
          <RoleGuard allowedRoles={["Super Admin"]}>
            <AppLayout>
              <SubscriptionAnalyticsPage />
            </AppLayout>
          </RoleGuard>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/subscription-plans">
        <ProtectedRoute>
          <RoleGuard allowedRoles={["Super Admin"]}>
            <AppLayout>
              <SubscriptionPlansPage />
            </AppLayout>
          </RoleGuard>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/pricing-regions">
        <ProtectedRoute>
          <RoleGuard allowedRoles={["Super Admin"]}>
            <AppLayout>
              <PricingRegionsPage />
            </AppLayout>
          </RoleGuard>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/coupons">
        <ProtectedRoute>
          <RoleGuard allowedRoles={["Super Admin"]}>
            <AppLayout>
              <CouponsPage />
            </AppLayout>
          </RoleGuard>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/platform-settings">
        <ProtectedRoute>
          <RoleGuard allowedRoles={["Super Admin"]}>
            <AppLayout>
              <PlatformSettingsPage />
            </AppLayout>
          </RoleGuard>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/users">
        <ProtectedRoute>
          <RoleGuard allowedRoles={["Super Admin"]}>
            <AppLayout>
              <AllUsersPage />
            </AppLayout>
          </RoleGuard>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/kyc-verification">
        <ProtectedRoute>
          <RoleGuard allowedRoles={["Super Admin"]}>
            <AppLayout>
              <KycVerificationPage />
            </AppLayout>
          </RoleGuard>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/tickets">
        <ProtectedRoute>
          <RoleGuard allowedRoles={["Super Admin"]}>
            <AppLayout>
              <AdminTicketsPage />
            </AppLayout>
          </RoleGuard>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/marketplace/create">
        <ProtectedRoute>
          <RoleGuard allowedRoles={["Super Admin"]}>
            <AppLayout>
              <MarketplaceCreatePage />
            </AppLayout>
          </RoleGuard>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/marketplace/published">
        <ProtectedRoute>
          <RoleGuard allowedRoles={["Super Admin"]}>
            <AppLayout>
              <MarketplacePublishedPage />
            </AppLayout>
          </RoleGuard>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/agent-foundry">
        <ProtectedRoute>
          <RoleGuard allowedRoles={["Super Admin"]}>
            <AppLayout>
              <AgentFoundryPage />
            </AppLayout>
          </RoleGuard>
        </ProtectedRoute>
      </Route>
      <Route path="/analytics">
        <ProtectedRoute>
          <RoleGuard allowedRoles={["Admin", "Super Admin"]}>
            <AppLayout>
              <Analytics />
            </AppLayout>
          </RoleGuard>
        </ProtectedRoute>
      </Route>
      <Route path="/assignment-bot">
        <OrganizationRoute>
          <AppLayout>
            <AssignmentBot />
          </AppLayout>
        </OrganizationRoute>
      </Route>
      <Route path="/client-onboarding">
        <ProtectedRoute>
          <RoleGuard allowedRoles={["Admin", "Super Admin"]}>
            <AppLayout>
              <ClientOnboarding />
            </AppLayout>
          </RoleGuard>
        </ProtectedRoute>
      </Route>
      <Route path="/workflows">
        <OrganizationRoute>
          <AppLayout>
            <Workflows />
          </AppLayout>
        </OrganizationRoute>
      </Route>
      <Route path="/workflows/:id">
        <OrganizationRoute>
          <AppLayout>
            <WorkflowDetail />
          </AppLayout>
        </OrganizationRoute>
      </Route>
      <Route path="/workflow-builder">
        <ProtectedRoute>
          <RoleGuard allowedRoles={["Admin", "Super Admin"]}>
            <AppLayout>
              <WorkflowBuilder />
            </AppLayout>
          </RoleGuard>
        </ProtectedRoute>
      </Route>
      <Route path="/workflows/new">
        <ProtectedRoute>
          <RoleGuard allowedRoles={["Admin", "Super Admin"]}>
            <AppLayout>
              <WorkflowBuilder />
            </AppLayout>
          </RoleGuard>
        </ProtectedRoute>
      </Route>
      <Route path="/workflows/:id/edit">
        <ProtectedRoute>
          <RoleGuard allowedRoles={["Admin", "Super Admin"]}>
            <AppLayout>
              <WorkflowBuilder />
            </AppLayout>
          </RoleGuard>
        </ProtectedRoute>
      </Route>
      <Route path="/ai-agents/:slug">
        <OrganizationRoute>
          <AppLayout>
            <AgentDetail />
          </AppLayout>
        </OrganizationRoute>
      </Route>
      <Route path="/agent-integration-guide">
        <ProtectedRoute>
          <AppLayout>
            <AgentIntegrationGuide />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/ai-agents">
        <OrganizationRoute>
          <AppLayout>
            <AIAgents />
          </AppLayout>
        </OrganizationRoute>
      </Route>
      <Route path="/roundtable/:id">
        <OrganizationRoute>
          <AppLayout>
            <RoundtableDetail />
          </AppLayout>
        </OrganizationRoute>
      </Route>
      <Route path="/roundtable">
        <OrganizationRoute>
          <AppLayout>
            <RoundtablePage />
          </AppLayout>
        </OrganizationRoute>
      </Route>
      <Route path="/marketplace">
        <OrganizationRoute>
          <AppLayout>
            <Marketplace />
          </AppLayout>
        </OrganizationRoute>
      </Route>
      <Route path="/assignments/:id">
        <OrganizationRoute>
          <AppLayout>
            <AssignmentDetail />
          </AppLayout>
        </OrganizationRoute>
      </Route>
      <Route path="/kanban">
        <OrganizationRoute>
          <AppLayout>
            <Kanban />
          </AppLayout>
        </OrganizationRoute>
      </Route>
      <Route path="/assignments">
        <OrganizationRoute>
          <AppLayout>
            <Assignments />
          </AppLayout>
        </OrganizationRoute>
      </Route>
      <Route path="/team">
        <ProtectedRoute>
          <RoleGuard allowedRoles={["Admin", "Super Admin"]}>
            <AppLayout>
              <Team />
            </AppLayout>
          </RoleGuard>
        </ProtectedRoute>
      </Route>
      <Route path="/teams/:id">
        <OrganizationRoute>
          <AppLayout>
            <TeamDetailPage />
          </AppLayout>
        </OrganizationRoute>
      </Route>
      <Route path="/teams">
        <OrganizationRoute>
          <AppLayout>
            <TeamsPage />
          </AppLayout>
        </OrganizationRoute>
      </Route>
      <Route path="/team-hierarchy">
        <ProtectedRoute>
          <RoleGuard allowedRoles={["Admin", "Super Admin"]}>
            <AppLayout>
              <TeamHierarchyPage />
            </AppLayout>
          </RoleGuard>
        </ProtectedRoute>
      </Route>
      <Route path="/manager-dashboard">
        <OrganizationRoute>
          <AppLayout>
            <ManagerDashboardPage />
          </AppLayout>
        </OrganizationRoute>
      </Route>
      <Route path="/roles">
        <ProtectedRoute>
          <RoleGuard allowedRoles={["Admin", "Super Admin"]}>
            <AppLayout>
              <Roles />
            </AppLayout>
          </RoleGuard>
        </ProtectedRoute>
      </Route>
      <Route path="/documents">
        <OrganizationRoute>
          <AppLayout>
            <Documents />
          </AppLayout>
        </OrganizationRoute>
      </Route>
      <Route path="/forms">
        <OrganizationRoute>
          <AppLayout>
            <Forms />
          </AppLayout>
        </OrganizationRoute>
      </Route>
      <Route path="/forms/:id/builder">
        <OrganizationRoute>
          <AppLayout>
            <FormBuilder />
          </AppLayout>
        </OrganizationRoute>
      </Route>
      <Route path="/forms/:id/preview">
        <OrganizationRoute>
          <AppLayout>
            <FormPreview />
          </AppLayout>
        </OrganizationRoute>
      </Route>
      <Route path="/forms/:formId/submissions">
        <OrganizationRoute>
          <AppLayout>
            <FormSubmissions />
          </AppLayout>
        </OrganizationRoute>
      </Route>
      <Route path="/forms/:formId/analytics">
        <OrganizationRoute>
          <AppLayout>
            <FormAnalytics />
          </AppLayout>
        </OrganizationRoute>
      </Route>
      <Route path="/submissions/:id">
        <OrganizationRoute>
          <AppLayout>
            <SubmissionDetail />
          </AppLayout>
        </OrganizationRoute>
      </Route>
      <Route path="/clients">
        <OrganizationRoute>
          <AppLayout>
            <Clients />
          </AppLayout>
        </OrganizationRoute>
      </Route>
      <Route path="/contacts">
        <OrganizationRoute>
          <AppLayout>
            <Contacts />
          </AppLayout>
        </OrganizationRoute>
      </Route>
      <Route path="/tags">
        <OrganizationRoute>
          <AppLayout>
            <Tags />
          </AppLayout>
        </OrganizationRoute>
      </Route>
      <Route path="/folders">
        <OrganizationRoute>
          <AppLayout>
            <Folders />
          </AppLayout>
        </OrganizationRoute>
      </Route>
      <Route path="/document-requests">
        <OrganizationRoute>
          <AppLayout>
            <DocumentRequests />
          </AppLayout>
        </OrganizationRoute>
      </Route>
      <Route path="/my-documents">
        <OrganizationRoute>
          <AppLayout>
            <MyDocumentRequests />
          </AppLayout>
        </OrganizationRoute>
      </Route>
      <Route path="/messages">
        <OrganizationRoute>
          <AppLayout>
            <Messages />
          </AppLayout>
        </OrganizationRoute>
      </Route>
      <Route path="/time-tracking">
        <OrganizationRoute>
          <AppLayout>
            <TimeTracking />
          </AppLayout>
        </OrganizationRoute>
      </Route>
      <Route path="/invoices">
        <OrganizationRoute>
          <AppLayout>
            <Invoices />
          </AppLayout>
        </OrganizationRoute>
      </Route>
      <Route path="/automated-invoicing">
        <OrganizationRoute>
          <AppLayout>
            <AutomatedInvoicing />
          </AppLayout>
        </OrganizationRoute>
      </Route>
      {/* DISABLED: Subscription pricing route removed */}
      {/* <Route path="/pricing">
        <SubscriptionPricing />
      </Route> */}
      <Route path="/payments">
        <OrganizationRoute>
          <AppLayout>
            <Payments />
          </AppLayout>
        </OrganizationRoute>
      </Route>
      <Route path="/signatures">
        <OrganizationRoute>
          <AppLayout>
            <Signatures />
          </AppLayout>
        </OrganizationRoute>
      </Route>
      <Route path="/projects/:id">
        <OrganizationRoute>
          <AppLayout>
            <ProjectDetail />
          </AppLayout>
        </OrganizationRoute>
      </Route>
      <Route path="/projects">
        <OrganizationRoute>
          <AppLayout>
            <Projects />
          </AppLayout>
        </OrganizationRoute>
      </Route>
      <Route path="/team-chat">
        <OrganizationRoute>
          <AppLayout>
            <TeamChat />
          </AppLayout>
        </OrganizationRoute>
      </Route>
      <Route path="/live-chat">
        <ProtectedRoute>
          <AppLayout>
            <LiveChat />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/calendar">
        <OrganizationRoute>
          <AppLayout>
            <Calendar />
          </AppLayout>
        </OrganizationRoute>
      </Route>
      <Route path="/email-templates">
        <OrganizationRoute>
          <AppLayout>
            <EmailTemplates />
          </AppLayout>
        </OrganizationRoute>
      </Route>
      <Route path="/message-templates">
        <OrganizationRoute>
          <AppLayout>
            <MessageTemplates />
          </AppLayout>
        </OrganizationRoute>
      </Route>
      <Route path="/email-accounts">
        <OrganizationRoute>
          <AppLayout>
            <EmailAccounts />
          </AppLayout>
        </OrganizationRoute>
      </Route>
      <Route path="/inbox">
        <OrganizationRoute>
          <AppLayout>
            <Inbox />
          </AppLayout>
        </OrganizationRoute>
      </Route>

      {/* Client Portal Routes - Client Role Only */}
      <Route path="/client-portal/dashboard">
        <ProtectedRoute>
          <RoleGuard allowedRoles={["Client"]}>
            <AppLayout>
              <ClientPortalDashboard />
            </AppLayout>
          </RoleGuard>
        </ProtectedRoute>
      </Route>
      <Route path="/client-portal/documents">
        <ProtectedRoute>
          <RoleGuard allowedRoles={["Client"]}>
            <AppLayout>
              <ClientMyDocuments />
            </AppLayout>
          </RoleGuard>
        </ProtectedRoute>
      </Route>
      <Route path="/client-portal/tasks">
        <ProtectedRoute>
          <RoleGuard allowedRoles={["Client"]}>
            <AppLayout>
              <ClientMyTasks />
            </AppLayout>
          </RoleGuard>
        </ProtectedRoute>
      </Route>
      <Route path="/client-portal/forms">
        <ProtectedRoute>
          <RoleGuard allowedRoles={["Client"]}>
            <AppLayout>
              <ClientMyForms />
            </AppLayout>
          </RoleGuard>
        </ProtectedRoute>
      </Route>
      <Route path="/client-portal/signatures">
        <ProtectedRoute>
          <RoleGuard allowedRoles={["Client"]}>
            <AppLayout>
              <ClientMySignatures />
            </AppLayout>
          </RoleGuard>
        </ProtectedRoute>
      </Route>
      <Route path="/client-portal/messages">
        <ProtectedRoute>
          <RoleGuard allowedRoles={["Client"]}>
            <AppLayout>
              <ClientPortalMessages />
            </AppLayout>
          </RoleGuard>
        </ProtectedRoute>
      </Route>

      <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="accute-theme">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
