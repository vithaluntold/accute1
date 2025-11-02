import { 
  Home, Workflow, Bot, FileText, Users, Settings, BarChart3, LogOut, Tag, Building2, 
  UserCircle, ClipboardList, ClipboardCheck, FolderOpen, MessageSquare, Clock, 
  Receipt, CreditCard, FileSignature, Kanban, MessagesSquare, Calendar, Mail, Network, Shield, Store, ListTodo, Folder, Smartphone, ChevronRight, Inbox as InboxIcon, Plus, Package, HelpCircle, CheckSquare, DollarSign, Globe, Percent, TrendingUp
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
import { clearAuth, getUser } from "@/lib/auth";
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
      { title: "AI Roundtable", url: "/roundtable", icon: Users, permission: "roundtable.access" },
      { title: "Assignment Bot", url: "/assignment-bot", icon: MessageSquare, permission: null },
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
      { title: "Payments", url: "/payments", icon: CreditCard, permission: "payments.view" },
      { title: "Time Tracking", url: "/time-tracking", icon: Clock, permission: "time.create" },
    ]
  },
  {
    title: "Communication",
    items: [
      { title: "Messages", url: "/messages", icon: MessageSquare, permission: "messaging.send" },
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
    title: "Administration",
    items: [
      { title: "Team", url: "/team", icon: Users, permission: "users.view" },
      { title: "Teams", url: "/teams", icon: Users, permission: "teams.view" },
      { title: "Team Hierarchy", url: "/team-hierarchy", icon: Network, permission: "teams.manage" },
      { title: "Manager Dashboard", url: "/manager-dashboard", icon: BarChart3, permission: null },
      { title: "Roles & Permissions", url: "/roles", icon: Shield, permission: "roles.view" },
      { title: "Analytics", url: "/analytics", icon: BarChart3, permission: "analytics.view" },
      { title: "Subscription", url: "/subscription", icon: CreditCard, permission: null },
      { title: "Settings", url: "/settings", icon: Settings, permission: null },
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
      { title: "Assignment Bot", url: "/assignment-bot", icon: MessageSquare, permission: null },
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

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  const user = getUser();

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
          {user && (
            <SidebarMenuItem>
              <div className="px-2 py-3 border-t">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <UserCircle className="h-6 w-6 text-primary" />
                  </div>
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
