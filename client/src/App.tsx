import { Switch, Route, useLocation } from "wouter";
import { queryClient, apiRequest } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ProtectedRoute } from "@/components/protected-route";
import { RoleGuard } from "@/components/role-guard";
import { OrganizationRoute } from "@/components/organization-route";
import { isAuthenticated, getUser } from "@/lib/auth";
import { NotificationBell } from "@/components/notification-bell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
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
import { lazy, Suspense, useState } from "react";
import { Loader2 } from "lucide-react";

const Landing = lazy(() => import("@/pages/landing"));
const Login = lazy(() => import("@/pages/login"));
const Register = lazy(() => import("@/pages/register"));
const PublicFormPage = lazy(() => import("@/pages/public-form"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const OnboardingPage = lazy(() => import("@/pages/onboarding"));
const Settings = lazy(() => import("@/pages/settings"));
const OrganizationSettings = lazy(() => import("@/pages/organization-settings"));
const Analytics = lazy(() => import("@/pages/analytics"));
const Workflows = lazy(() => import("@/pages/workflows"));
const WorkflowDetail = lazy(() => import("@/pages/workflow-detail"));
const WorkflowBuilder = lazy(() => import("@/pages/workflow-builder"));
const AIAgents = lazy(() => import("@/pages/ai-agents"));
const AgentDetail = lazy(() => import("@/pages/agent-detail"));
const Marketplace = lazy(() => import("@/pages/marketplace"));
const Assignments = lazy(() => import("@/pages/assignments"));
const AssignmentDetail = lazy(() => import("@/pages/assignment-detail"));
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
const Proposals = lazy(() => import("@/pages/proposals"));
const Payments = lazy(() => import("@/pages/payments"));
const PaymentCollect = lazy(() => import("@/pages/payment-collect"));
const ClientPaymentPortal = lazy(() => import("@/pages/client-payment-portal"));
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
const AdminPersonalityProfilingPage = lazy(() => import("@/pages/admin/personality-profiling"));
const ClientPortalDashboard = lazy(() => import("@/pages/client-portal/dashboard"));
const ClientMyDocuments = lazy(() => import("@/pages/client-portal/my-documents"));
const ClientMyTasks = lazy(() => import("@/pages/client-portal/my-tasks"));
const ClientMyForms = lazy(() => import("@/pages/client-portal/my-forms"));
const ClientMySignatures = lazy(() => import("@/pages/client-portal/my-signatures"));
const ClientPortalMessages = lazy(() => import("@/pages/client-portal/messages"));
const ActionCenter = lazy(() => import("@/pages/client-portal/action-center"));
const RoundtablePage = lazy(() => import("@/pages/roundtable"));
const RoundtableDetail = lazy(() => import("@/pages/roundtable-detail"));
const TeamsPage = lazy(() => import("@/pages/teams"));
const TeamDetailPage = lazy(() => import("@/pages/team-detail"));
const TeamHierarchyPage = lazy(() => import("@/pages/team-hierarchy"));
const ManagerDashboardPage = lazy(() => import("@/pages/manager-dashboard"));
const AutomatedInvoicing = lazy(() => import("@/pages/automated-invoicing"));

// MVP Score 9.0 Features - Visualization
const CalendarView = lazy(() => import("@/pages/calendar-view"));
const TimelineView = lazy(() => import("@/pages/timeline-view"));
const GanttView = lazy(() => import("@/pages/gantt-view"));
const WorkloadView = lazy(() => import("@/pages/workload-view"));
const UnifiedInbox = lazy(() => import("@/pages/unified-inbox"));
const ExecutiveDashboard = lazy(() => import("@/pages/executive-dashboard"));
const ReportBuilder = lazy(() => import("@/pages/report-builder"));
const ProfitabilityView = lazy(() => import("@/pages/profitability-view"));
const ResourceAllocation = lazy(() => import("@/pages/resource-allocation"));
const SkillsManagement = lazy(() => import("@/pages/skills-management"));
const SubscriptionPricing = lazy(() => import("@/pages/subscription-pricing"));
const EmployeeProfile = lazy(() => import("@/pages/employee-profile"));
const PersonalityProfile = lazy(() => import("@/pages/personality-profile"));
const LiveChat = lazy(() => import("@/pages/live-chat"));
const AgentIntegrationGuide = lazy(() => import("@/pages/agent-integration-guide"));
const Help = lazy(() => import("@/pages/help"));
const AgentHealth = lazy(() => import("@/pages/agent-health"));

// Competitive Gap Features
const Forecasting = lazy(() => import("@/pages/forecasting"));
const ScheduledReports = lazy(() => import("@/pages/scheduled-reports"));
const VideoConferencing = lazy(() => import("@/pages/video-conferencing"));

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
  const { toast } = useToast();
  const [workspaceDialogOpen, setWorkspaceDialogOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceSlug, setWorkspaceSlug] = useState("");

  const { data: notifications = [] } = useQuery<any[]>({
    queryKey: ["/api/notifications"],
    enabled: !!user,
  });

  // Fetch current organization data
  const { data: currentOrg } = useQuery<any>({
    queryKey: ["/api/organizations", user?.organizationId],
    enabled: !!user?.organizationId,
  });

  const unreadCount = notifications.filter((n: any) => !n.isRead).length;

  const createWorkspaceMutation = useMutation({
    mutationFn: async (data: { name: string; slug: string }) => {
      return apiRequest("POST", "/api/organizations", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      toast({
        title: "Workspace created",
        description: "Your new workspace has been created successfully. Switching to it now...",
      });
      setWorkspaceDialogOpen(false);
      setWorkspaceName("");
      setWorkspaceSlug("");
      // Redirect to login to refresh auth state with new workspace
      window.location.href = "/auth/login";
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create workspace",
        variant: "destructive",
      });
    },
  });

  const handleCreateWorkspace = () => {
    if (!workspaceName.trim()) {
      toast({
        title: "Error",
        description: "Workspace name is required",
        variant: "destructive",
      });
      return;
    }
    createWorkspaceMutation.mutate({ 
      name: workspaceName.trim(), 
      slug: workspaceSlug.trim() || workspaceName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    });
  };

  const handleWorkspaceNameChange = (value: string) => {
    setWorkspaceName(value);
    // Auto-generate slug from name
    if (!workspaceSlug) {
      const generatedSlug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      setWorkspaceSlug(generatedSlug);
    }
  };

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
              <NotificationBell />
              <ThemeToggle />
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" data-testid="button-workspace-switcher" className="gap-2">
                    <Building2 className="h-4 w-4" />
                    <span className="hidden md:inline">{currentOrg?.name || 'Workspace'}</span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Current Workspace</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem data-testid="menu-item-current-workspace" disabled>
                    <div className="flex flex-col">
                      <span className="font-medium">{currentOrg?.name || 'Loading...'}</span>
                      <span className="text-xs text-muted-foreground">/{currentOrg?.slug}</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    data-testid="menu-item-create-workspace"
                    onClick={() => setWorkspaceDialogOpen(true)}
                  >
                    <Building2 className="h-4 w-4 mr-2" />
                    Create New Workspace
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Dialog open={workspaceDialogOpen} onOpenChange={setWorkspaceDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Workspace</DialogTitle>
                    <DialogDescription>
                      Create a new workspace to organize your team and clients
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="workspace-name">Workspace Name *</Label>
                      <Input
                        id="workspace-name"
                        placeholder="e.g., Acme Accounting"
                        value={workspaceName}
                        onChange={(e) => handleWorkspaceNameChange(e.target.value)}
                        data-testid="input-workspace-name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="workspace-slug">Workspace URL Slug</Label>
                      <Input
                        id="workspace-slug"
                        placeholder="acme-accounting"
                        value={workspaceSlug}
                        onChange={(e) => setWorkspaceSlug(e.target.value)}
                        data-testid="input-workspace-slug"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Auto-generated from workspace name. Must be unique.
                      </p>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setWorkspaceDialogOpen(false)}
                        data-testid="button-cancel-workspace"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleCreateWorkspace}
                        disabled={createWorkspaceMutation.isPending}
                        data-testid="button-submit-workspace"
                      >
                        Create Workspace
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

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
      <Route path="/personality-profile">
        <ProtectedRoute>
          <OrganizationRoute>
            <AppLayout>
              <PersonalityProfile />
            </AppLayout>
          </OrganizationRoute>
        </ProtectedRoute>
      </Route>
      <Route path="/organization-settings">
        <ProtectedRoute>
          <OrganizationRoute>
            <RoleGuard allowedRoles={["Super Admin", "Admin"]}>
              <AppLayout>
                <OrganizationSettings />
              </AppLayout>
            </RoleGuard>
          </OrganizationRoute>
        </ProtectedRoute>
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
      <Route path="/admin/personality-profiling">
        <ProtectedRoute>
          <RoleGuard allowedRoles={["Super Admin", "Admin"]}>
            <AppLayout>
              <AdminPersonalityProfilingPage />
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
      
      {/* MVP Score 9.0 Features */}
      <Route path="/calendar-view">
        <OrganizationRoute>
          <AppLayout>
            <CalendarView />
          </AppLayout>
        </OrganizationRoute>
      </Route>
      <Route path="/timeline-view">
        <OrganizationRoute>
          <AppLayout>
            <TimelineView />
          </AppLayout>
        </OrganizationRoute>
      </Route>
      <Route path="/gantt-view">
        <OrganizationRoute>
          <AppLayout>
            <GanttView />
          </AppLayout>
        </OrganizationRoute>
      </Route>
      <Route path="/workload-view">
        <OrganizationRoute>
          <AppLayout>
            <WorkloadView />
          </AppLayout>
        </OrganizationRoute>
      </Route>
      <Route path="/unified-inbox">
        <OrganizationRoute>
          <AppLayout>
            <UnifiedInbox />
          </AppLayout>
        </OrganizationRoute>
      </Route>
      <Route path="/executive-dashboard">
        <ProtectedRoute>
          <RoleGuard allowedRoles={["Admin", "Super Admin"]}>
            <AppLayout>
              <ExecutiveDashboard />
            </AppLayout>
          </RoleGuard>
        </ProtectedRoute>
      </Route>
      <Route path="/report-builder">
        <ProtectedRoute>
          <RoleGuard allowedRoles={["Admin", "Super Admin"]}>
            <AppLayout>
              <ReportBuilder />
            </AppLayout>
          </RoleGuard>
        </ProtectedRoute>
      </Route>
      <Route path="/profitability-view">
        <ProtectedRoute>
          <RoleGuard allowedRoles={["Admin", "Super Admin"]}>
            <AppLayout>
              <ProfitabilityView />
            </AppLayout>
          </RoleGuard>
        </ProtectedRoute>
      </Route>
      <Route path="/resource-allocation">
        <OrganizationRoute>
          <AppLayout>
            <ResourceAllocation />
          </AppLayout>
        </OrganizationRoute>
      </Route>
      <Route path="/skills-management">
        <OrganizationRoute>
          <AppLayout>
            <SkillsManagement />
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
      <Route path="/workflow-builder/:id">
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
      <Route path="/agent-health">
        <ProtectedRoute>
          <RoleGuard allowedRoles={["Admin", "Super Admin"]}>
            <AppLayout>
              <AgentHealth />
            </AppLayout>
          </RoleGuard>
        </ProtectedRoute>
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
      <Route path="/proposals">
        <OrganizationRoute>
          <AppLayout>
            <Proposals />
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
      <Route path="/payments/collect">
        <OrganizationRoute>
          <AppLayout>
            <PaymentCollect />
          </AppLayout>
        </OrganizationRoute>
      </Route>
      {/* Public client payment portal - no authentication required */}
      <Route path="/pay/:invoiceId">
        <ClientPaymentPortal />
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

      <Route path="/client-portal/action-center">
        <ProtectedRoute>
          <RoleGuard allowedRoles={["Client"]}>
            <AppLayout>
              <ActionCenter />
            </AppLayout>
          </RoleGuard>
        </ProtectedRoute>
      </Route>

      {/* Competitive Gap Features */}
      <Route path="/forecasting">
        <OrganizationRoute>
          <AppLayout>
            <Forecasting />
          </AppLayout>
        </OrganizationRoute>
      </Route>
      <Route path="/scheduled-reports">
        <OrganizationRoute>
          <AppLayout>
            <ScheduledReports />
          </AppLayout>
        </OrganizationRoute>
      </Route>
      <Route path="/video-conferencing">
        <OrganizationRoute>
          <AppLayout>
            <VideoConferencing />
          </AppLayout>
        </OrganizationRoute>
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
