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
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Register from "@/pages/register";
import PublicFormPage from "@/pages/public-form";
import Dashboard from "@/pages/dashboard";
import Settings from "@/pages/settings";
import Analytics from "@/pages/analytics";
import Workflows from "@/pages/workflows";
import WorkflowDetail from "@/pages/workflow-detail";
import WorkflowBuilder from "@/pages/workflow-builder";
import AIAgents from "@/pages/ai-agents";
import AgentDetail from "@/pages/agent-detail";
import Marketplace from "@/pages/marketplace";
import Assignments from "@/pages/assignments";
import AssignmentDetail from "@/pages/assignment-detail";
import AssignmentBot from "@/pages/assignment-bot";
import ClientOnboarding from "@/pages/client-onboarding";
import Kanban from "@/pages/kanban";
import Team from "@/pages/team";
import Roles from "@/pages/roles";
import Documents from "@/pages/documents";
import Forms from "@/pages/forms";
import FormBuilder from "@/pages/form-builder";
import FormPreview from "@/pages/form-preview";
import FormSubmissions from "@/pages/form-submissions";
import FormAnalytics from "@/pages/form-analytics";
import SubmissionDetail from "@/pages/submission-detail";
import Clients from "@/pages/clients";
import Contacts from "@/pages/contacts";
import Tags from "@/pages/tags";
import Folders from "@/pages/folders";
import DocumentRequests from "@/pages/document-requests";
import MyDocumentRequests from "@/pages/my-document-requests";
import Messages from "@/pages/messages";
import TimeTracking from "@/pages/time-tracking";
import Invoices from "@/pages/invoices";
import Payments from "@/pages/payments";
import Signatures from "@/pages/signatures";
import Projects from "@/pages/projects";
import ProjectDetail from "@/pages/project-detail";
import TeamChat from "@/pages/team-chat";
import Calendar from "@/pages/calendar";
import EmailTemplates from "@/pages/email-templates";
import MessageTemplates from "@/pages/message-templates";
import EmailAccounts from "@/pages/email-accounts";
import Inbox from "@/pages/inbox";
import NotFound from "@/pages/not-found";
import MobileApps from "@/pages/mobile-apps";
import OrganizationsPage from "@/pages/admin/organizations";
// DISABLED: Subscription features removed per user request
// import SubscriptionsPage from "@/pages/admin/subscriptions";
// import SubscriptionAnalyticsPage from "@/pages/admin/subscription-analytics";
// import SubscriptionPlansPage from "@/pages/admin/subscription-plans";
import PricingRegionsPage from "@/pages/admin/pricing-regions";
// import CouponsPage from "@/pages/admin/coupons";
import PlatformSettingsPage from "@/pages/admin/platform-settings";
import AllUsersPage from "@/pages/admin/users";
import KycVerificationPage from "@/pages/admin/kyc-verification";
import PricingManagementPage from "@/pages/admin/pricing-management";
// import SubscriptionSelectPage from "@/pages/subscription-select";
import AdminTicketsPage from "@/pages/admin/tickets";
import MarketplaceCreatePage from "@/pages/admin/marketplace-create";
import MarketplacePublishedPage from "@/pages/admin/marketplace-published";
import AdminDashboard from "@/pages/admin/admin-dashboard";
import AgentFoundryPage from "@/pages/admin/agent-foundry";
import ClientPortalDashboard from "@/pages/client-portal/dashboard";
import ClientMyDocuments from "@/pages/client-portal/my-documents";
import ClientMyTasks from "@/pages/client-portal/my-tasks";
import ClientMyForms from "@/pages/client-portal/my-forms";
import ClientMySignatures from "@/pages/client-portal/my-signatures";
import ClientPortalMessages from "@/pages/client-portal/messages";
import RoundtablePage from "@/pages/roundtable";
import RoundtableDetail from "@/pages/roundtable-detail";
import TeamsPage from "@/pages/teams";
import TeamDetailPage from "@/pages/team-detail";
import TeamHierarchyPage from "@/pages/team-hierarchy";
import ManagerDashboardPage from "@/pages/manager-dashboard";
import AutomatedInvoicing from "@/pages/automated-invoicing";
// DISABLED: Subscription pricing removed
// import SubscriptionPricing from "@/pages/subscription-pricing";
import EmployeeProfile from "@/pages/employee-profile";
import LiveChat from "@/pages/live-chat";
import AgentIntegrationGuide from "@/pages/agent-integration-guide";
import Help from "@/pages/help";

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
      {/* DISABLED: Subscription select removed */}
      {/* <Route path="/subscription">
        <ProtectedRoute>
          <RoleGuard allowedRoles={["Super Admin", "Admin"]}>
            <AppLayout>
              <SubscriptionSelectPage />
            </AppLayout>
          </RoleGuard>
        </ProtectedRoute>
      </Route> */}
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
      {/* DISABLED: All subscription admin pages removed */}
      {/* <Route path="/admin/subscriptions">
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
      </Route> */}
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
