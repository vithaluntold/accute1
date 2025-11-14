import { 
  Home, Workflow, Bot, FileText, Users, Settings, BarChart3, LogOut, Tag, Building2, 
  UserCircle, ClipboardList, ClipboardCheck, FolderOpen, MessageSquare, Clock, 
  Receipt, CreditCard, FileSignature, Kanban, MessagesSquare, Calendar, Mail, Network, Shield, Store, ListTodo, Folder, Smartphone, ChevronRight, Inbox as InboxIcon, Plus, Package, HelpCircle, CheckSquare, DollarSign, Globe, Percent, TrendingUp, Rocket, ChevronsUpDown, Check, GanttChartSquare, FileBarChart2, CalendarDays, UserCog, Video
} from "lucide-react";
import { useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { clearAuth, getUser } from "@/lib/auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import logoUrl from "@assets/Accute Transparent symbol_1761505804713.png";

// Platform-scoped menu (Super Admin) - SaaS provider features
const platformMenuCategories = [
  {
    title: "Platform Overview",
    items: [
      { title: "Dashboard", url: "/admin/dashboard", icon: Home, permission: null },
    ]
  },
  {
    title: "User Management",
    items: [
      { title: "Organizations", url: "/admin/organizations", icon: Building2, permission: null },
      { title: "Subscriptions", url: "/admin/subscriptions", icon: CreditCard, permission: null },
      { title: "All Users", url: "/admin/users", icon: Users, permission: null },
    ]
  },
  {
    title: "Subscription Management",
    items: [
      { title: "Pricing Management", url: "/admin/pricing", icon: DollarSign, permission: null },
      { title: "Analytics", url: "/admin/subscription-analytics", icon: TrendingUp, permission: null },
      { title: "Plans", url: "/admin/subscription-plans", icon: Package, permission: null },
      { title: "Pricing Regions", url: "/admin/pricing-regions", icon: Globe, permission: null },
      { title: "Coupons", url: "/admin/coupons", icon: Percent, permission: null },
      { title: "Platform Settings", url: "/admin/platform-settings", icon: Settings, permission: null },
    ]
  },
  {
    title: "Marketplace Management",
    items: [
      { title: "My Published Items", url: "/admin/marketplace/published", icon: Package, permission: null },
      { title: "Agent Foundry", url: "/admin/agent-foundry", icon: Bot, permission: null },
      { title: "Agent Integration Guide", url: "/agent-integration-guide", icon: FileText, permission: null },
    ]
  },
  {
    title: "Support",
    items: [
      { title: "Support Tickets", url: "/admin/tickets", icon: HelpCircle, permission: null },
    ]
  },
  {
    title: "Platform Settings",
    items: [
      { title: "Settings", url: "/settings", icon: Settings, permission: null },
    ]
  }
];

// Organization-scoped menu (regular users) - full feature set
const organizationMenuCategories = [
  {
    title: "Overview",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: Home, permission: null },
      { title: "Onboarding", url: "/onboarding", icon: Rocket, permission: null },
    ]
  },
  {
    title: "Workflow Management",
    items: [
      { title: "Workflows", url: "/workflows", icon: Workflow, permission: "workflows.view" },
      { title: "Assignments", url: "/assignments", icon: ListTodo, permission: "workflows.view" },
      { title: "Kanban Board", url: "/kanban", icon: Kanban, permission: "workflows.view" },
      { title: "Projects", url: "/projects", icon: Network, permission: "projects.view" },
    ]
  },
  {
    title: "AI & Automation",
    items: [
      { title: "AI Agents", url: "/ai-agents", icon: Bot, permission: "ai_agents.view" },
      { title: "Agent Integration Guide", url: "/agent-integration-guide", icon: FileText, permission: null },
      { title: "AI Roundtable", url: "/roundtable", icon: Users, permission: "roundtable.access" },
      { title: "Marketplace", url: "/marketplace", icon: Store, permission: null },
    ]
  },
  {
    title: "Documents",
    items: [
      { title: "Documents", url: "/documents", icon: FileText, permission: "documents.view" },
      { title: "Document Requests", url: "/document-requests", icon: ClipboardCheck, permission: "documents.view" },
      { title: "My Documents", url: "/my-documents", icon: FolderOpen, permission: null },
      { title: "Forms", url: "/forms", icon: ClipboardList, permission: "forms.view" },
      { title: "Folders", url: "/folders", icon: Folder, permission: "folders.view" },
      { title: "E-Signatures", url: "/signatures", icon: FileSignature, permission: "signatures.view" },
    ]
  },
  {
    title: "Financial",
    items: [
      { title: "Invoices", url: "/invoices", icon: Receipt, permission: "invoices.view" },
      { title: "Automated Invoicing", url: "/automated-invoicing", icon: DollarSign, permission: "invoices.view" },
      { title: "Payments", url: "/payments", icon: CreditCard, permission: "payments.view" },
      { title: "Time Tracking", url: "/time-tracking", icon: Clock, permission: "time.create" },
    ]
  },
  {
    title: "Communication",
    items: [
      { title: "Messages", url: "/messages", icon: MessageSquare, permission: "messaging.send" },
      { title: "Message Templates", url: "/message-templates", icon: MessageSquare, permission: "templates.view" },
      { title: "Team Chat", url: "/team-chat", icon: MessagesSquare, permission: null },
      { title: "Calendar", url: "/calendar", icon: Calendar, permission: "appointments.view" },
      { title: "Inbox", url: "/inbox", icon: InboxIcon, permission: null },
      { title: "Email Accounts", url: "/email-accounts", icon: Mail, permission: null },
      { title: "Email Templates", url: "/email-templates", icon: Mail, permission: "templates.view" },
    ]
  },
  {
    title: "Client Management",
    items: [
      { title: "Clients", url: "/clients", icon: Building2, permission: "clients.view" },
      { title: "AI Client Onboarding", url: "/client-onboarding", icon: Bot, permission: "clients.create" },
      { title: "Contacts", url: "/contacts", icon: UserCircle, permission: "contacts.view" },
      { title: "Tags", url: "/tags", icon: Tag, permission: "tags.view" },
    ]
  },
  {
    title: "Analytics & Insights",
    items: [
      { title: "Unified Inbox", url: "/unified-inbox", icon: InboxIcon, permission: null },
      { title: "Calendar View", url: "/calendar-view", icon: CalendarDays, permission: null },
      { title: "Timeline View", url: "/timeline-view", icon: GanttChartSquare, permission: null },
      { title: "Gantt Chart", url: "/gantt-view", icon: GanttChartSquare, permission: null },
      { title: "Workload View", url: "/workload-view", icon: Users, permission: null },
      { title: "Resource Allocation", url: "/resource-allocation", icon: UserCog, permission: null },
      { title: "Executive Dashboard", url: "/executive-dashboard", icon: BarChart3, permission: "analytics.view" },
      { title: "Report Builder", url: "/report-builder", icon: FileBarChart2, permission: "analytics.view" },
      { title: "Profitability View", url: "/profitability-view", icon: TrendingUp, permission: "analytics.view" },
      { title: "Forecasting", url: "/forecasting", icon: TrendingUp, permission: "analytics.view" },
      { title: "Scheduled Reports", url: "/scheduled-reports", icon: FileText, permission: "analytics.view" },
    ]
  },
  {
    title: "Meetings & Collaboration",
    items: [
      { title: "Video Conferencing", url: "/video-conferencing", icon: Video, permission: null },
    ]
  },
  {
    title: "Administration",
    items: [
      { title: "Employees", url: "/team", icon: Users, permission: "users.view" },
      { title: "Teams", url: "/teams", icon: Users, permission: "teams.view" },
      { title: "Team Hierarchy", url: "/team-hierarchy", icon: Network, permission: "teams.manage" },
      { title: "Manager Dashboard", url: "/manager-dashboard", icon: BarChart3, permission: null },
      { title: "Roles & Permissions", url: "/roles", icon: Shield, permission: "roles.view" },
      { title: "Analytics", url: "/analytics", icon: BarChart3, permission: "analytics.view" },
      { title: "Subscription", url: "/subscription", icon: CreditCard, permission: null },
      { title: "Workspace Settings", url: "/organization-settings", icon: Building2, permission: null },
      { title: "My Settings", url: "/settings", icon: Settings, permission: null },
      { title: "Mobile Apps", url: "/mobile-apps", icon: Smartphone, permission: null },
    ]
  }
];

// Employee-scoped menu (limited organization features)
const employeeMenuCategories = [
  {
    title: "Overview",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: Home, permission: null },
    ]
  },
  {
    title: "My Work",
    items: [
      { title: "Assignments", url: "/assignments", icon: ListTodo, permission: null },
      { title: "Kanban Board", url: "/kanban", icon: Kanban, permission: null },
      { title: "Projects", url: "/projects", icon: Network, permission: "projects.view" },
      { title: "My Documents", url: "/my-documents", icon: FolderOpen, permission: null },
      { title: "Time Tracking", url: "/time-tracking", icon: Clock, permission: "time.create" },
    ]
  },
  {
    title: "AI & Tools",
    items: [
      { title: "AI Agents", url: "/ai-agents", icon: Bot, permission: "ai_agents.view" },
    ]
  },
  {
    title: "Documents & Forms",
    items: [
      { title: "Documents", url: "/documents", icon: FileText, permission: "documents.view" },
      { title: "Forms", url: "/forms", icon: ClipboardList, permission: "forms.view" },
      { title: "E-Signatures", url: "/signatures", icon: FileSignature, permission: "signatures.view" },
    ]
  },
  {
    title: "Communication",
    items: [
      { title: "Messages", url: "/messages", icon: MessageSquare, permission: "messaging.send" },
      { title: "Team Chat", url: "/team-chat", icon: MessagesSquare, permission: null },
      { title: "Calendar", url: "/calendar", icon: Calendar, permission: "appointments.view" },
    ]
  },
  {
    title: "Analytics & Insights",
    items: [
      { title: "Unified Inbox", url: "/unified-inbox", icon: InboxIcon, permission: null },
      { title: "Calendar View", url: "/calendar-view", icon: CalendarDays, permission: null },
      { title: "Workload View", url: "/workload-view", icon: Users, permission: null },
    ]
  },
  {
    title: "Settings",
    items: [
      { title: "My Settings", url: "/settings", icon: Settings, permission: null },
    ]
  }
];

// Client Portal menu (client-facing only)
const clientPortalMenuCategories = [
  {
    title: "My Portal",
    items: [
      { title: "Dashboard", url: "/client-portal/dashboard", icon: Home, permission: null },
    ]
  },
  {
    title: "Documents & Tasks",
    items: [
      { title: "My Documents", url: "/client-portal/documents", icon: FileText, permission: null },
      { title: "My Tasks", url: "/client-portal/tasks", icon: CheckSquare, permission: null },
      { title: "My Forms", url: "/client-portal/forms", icon: ClipboardList, permission: null },
      { title: "My Signatures", url: "/client-portal/signatures", icon: FileSignature, permission: null },
    ]
  },
  {
    title: "Communication",
    items: [
      { title: "Messages", url: "/client-portal/messages", icon: MessageSquare, permission: null },
    ]
  },
  {
    title: "Settings",
    items: [
      { title: "My Settings", url: "/settings", icon: Settings, permission: null },
    ]
  }
];

// Workspace Switcher Component
function WorkspaceSwitcher({ user }: { user: any }) {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();

  // Fetch user's workspaces (always fetch for authenticated users)
  const { data: memberships, isLoading } = useQuery<any[]>({
    queryKey: ["/api/user/workspaces"],
    select: (data) => data ?? [], // Ensure we always have an array
  });

  // Determine current workspace using cascading fallback
  const currentWorkspaceId = 
    user?.defaultOrganizationId ||  // 1. Prefer defaultOrganizationId
    memberships?.find(m => m.isDefault)?.organizationId || // 2. Find membership marked isDefault
    memberships?.[0]?.organizationId; // 3. Fall back to first membership

  // Get current organization from memberships (no separate fetch needed)
  const currentOrg = memberships?.find(m => m.organizationId === currentWorkspaceId)?.organization;

  // Switch workspace mutation
  const switchWorkspace = useMutation({
    mutationFn: async (organizationId: string) => {
      return await apiRequest("POST", `/api/user/workspaces/${organizationId}/switch`);
    },
    onSuccess: async () => {
      // Invalidate all relevant caches
      await queryClient.invalidateQueries({ queryKey: ["/api/users/me"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/user/workspaces"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
      
      toast({
        title: "Workspace switched",
        description: "Your workspace has been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to switch workspace",
        description: error.message || "An error occurred",
      });
    },
  });

  const handleSwitchWorkspace = (organizationId: string) => {
    if (organizationId === currentWorkspaceId) return; // Already on this workspace
    switchWorkspace.mutate(organizationId);
  };

  // Loading state
  if (isLoading) {
    return (
      <SidebarMenuItem>
        <div className="px-2 py-2">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Loading workspaces...</span>
          </div>
        </div>
      </SidebarMenuItem>
    );
  }

  // No workspaces - show Create Workspace CTA
  if (memberships.length === 0) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton 
          onClick={() => setLocation("/organizations/create")}
          data-testid="create-first-workspace-button"
        >
          <Plus className="h-4 w-4" />
          <span>Create Workspace</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  // Single workspace - show simple label
  if (memberships.length === 1) {
    return (
      <SidebarMenuItem>
        <div className="px-2 py-2">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {currentOrg?.logoUrl ? (
                <Avatar className="h-5 w-5 shrink-0">
                  <AvatarImage src={currentOrg.logoUrl} alt={currentOrg.name} />
                  <AvatarFallback className="text-xs bg-primary/10">
                    {currentOrg.name?.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <span className="text-sm font-medium truncate" data-testid="current-workspace-name">
                {currentOrg?.name || "Loading..."}
              </span>
            </div>
          </div>
        </div>
      </SidebarMenuItem>
    );
  }

  // Show dropdown for multiple workspaces
  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton 
            className="w-full" 
            data-testid="workspace-switcher-trigger"
            disabled={switchWorkspace.isPending}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {currentOrg?.logoUrl ? (
                <Avatar className="h-5 w-5 shrink-0">
                  <AvatarImage src={currentOrg.logoUrl} alt={currentOrg.name} />
                  <AvatarFallback className="text-xs bg-primary/10">
                    {currentOrg.name?.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <Building2 className="h-4 w-4 shrink-0" />
              )}
              <span className="flex-1 truncate text-left">{currentOrg?.name || "Select Workspace"}</span>
            </div>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56" data-testid="workspace-switcher-menu">
          <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {memberships.map((membership: any) => (
            <DropdownMenuItem
              key={membership.organizationId}
              onClick={() => handleSwitchWorkspace(membership.organizationId)}
              data-testid={`workspace-option-${membership.organizationId}`}
              className="cursor-pointer"
              disabled={switchWorkspace.isPending}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {membership.organization?.logoUrl ? (
                  <Avatar className="h-5 w-5 shrink-0">
                    <AvatarImage src={membership.organization.logoUrl} alt={membership.organization.name} />
                    <AvatarFallback className="text-xs bg-primary/10">
                      {membership.organization.name?.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <Building2 className="h-4 w-4 shrink-0" />
                )}
                <span className="flex-1 truncate">{membership.organization?.name}</span>
                {membership.organizationId === currentWorkspaceId && (
                  <Check className="h-4 w-4 text-primary shrink-0" data-testid="current-workspace-check" />
                )}
              </div>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setLocation("/organization-settings")}
            data-testid="manage-workspace-button"
            disabled={switchWorkspace.isPending}
          >
            <Settings className="h-4 w-4 mr-2" />
            Manage Workspace
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setLocation("/organizations/create")}
            data-testid="create-workspace-button"
            disabled={switchWorkspace.isPending}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  
  // Use React Query to make sidebar reactive to user data changes
  const { data: queryUser } = useQuery<any>({
    queryKey: ["/api/users/me"],
    enabled: !!getUser(), // Only fetch if user is logged in
    staleTime: 0, // Always check for updates
  });
  
  // Fall back to localStorage if query hasn't loaded yet
  const user = queryUser || getUser();

  // Determine which menu to show based on user role
  const getMenuCategories = () => {
    if (!user) return organizationMenuCategories;
    
    // Platform-scoped Super Admin
    if (!user.organizationId) {
      return platformMenuCategories;
    }
    
    // Role-based menu selection
    const userRole = user.role || user.roleName;
    switch (userRole) {
      case "Client":
        return clientPortalMenuCategories;
      case "Employee":
        return employeeMenuCategories;
      case "Admin":
      case "Super Admin":
        return organizationMenuCategories;
      default:
        return organizationMenuCategories;
    }
  };

  const menuCategories = getMenuCategories();

  const handleLogout = () => {
    clearAuth();
    setLocation("/login");
  };

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <div className="flex items-center gap-2 px-2 py-4">
            <img src={logoUrl} alt="Accute" className="h-8 w-8" />
            <span className="font-display text-lg">Accute</span>
          </div>
          
          {menuCategories.map((category) => (
            <Collapsible key={category.title} defaultOpen className="group/collapsible">
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="w-full">
                  {category.title}
                  <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {category.items.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          isActive={location === item.url}
                          data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          <a href={item.url} onClick={(e) => {
                            e.preventDefault();
                            setLocation(item.url);
                          }}>
                            <item.icon />
                            <span>{item.title}</span>
                          </a>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          {/* Workspace Switcher - Multi-Workspace Support */}
          {user && (
            <WorkspaceSwitcher user={user} />
          )}

          {/* User Info */}
          {user && (
            <SidebarMenuItem>
              <div className="px-2 py-3 border-t">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user.avatarUrl || ''} alt={`${user.firstName} ${user.lastName}`} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {user.firstName?.[0]}{user.lastName?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" data-testid="user-display-name">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate" data-testid="user-role-name">
                      {user.roleName || 'User'}
                    </p>
                    {!user.organizationId && (
                      <p className="text-xs text-primary font-medium" data-testid="user-scope">
                        Platform-scoped
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </SidebarMenuItem>
          )}

          {/* Logout */}
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} data-testid="button-logout">
              <LogOut />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
