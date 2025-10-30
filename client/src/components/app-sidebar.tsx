import { 
  Home, Workflow, Bot, FileText, Users, Settings, BarChart3, LogOut, Tag, Building2, 
  UserCircle, ClipboardList, ClipboardCheck, FolderOpen, MessageSquare, Clock, 
  Receipt, CreditCard, FileSignature, Kanban, MessagesSquare, Calendar, Mail, Network, Shield, Store, ListTodo, Folder, Smartphone, ChevronRight, Inbox as InboxIcon, Plus, Package, HelpCircle
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
      { title: "Dashboard", url: "/dashboard", icon: Home, permission: null },
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
    title: "Marketplace Management",
    items: [
      { title: "Browse Marketplace", url: "/marketplace", icon: Store, permission: null },
      { title: "Create Template", url: "/admin/marketplace/create", icon: Plus, permission: null },
      { title: "My Published Items", url: "/admin/marketplace/published", icon: Package, permission: null },
    ]
  },
  {
    title: "System Templates",
    items: [
      { title: "Workflows", url: "/workflows", icon: Workflow, permission: "workflows.view" },
      { title: "Forms", url: "/forms", icon: ClipboardList, permission: "forms.view" },
      { title: "Email Templates", url: "/email-templates", icon: Mail, permission: "templates.view" },
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
      { title: "Roles & Permissions", url: "/roles", icon: Shield, permission: "roles.view" },
      { title: "Analytics", url: "/analytics", icon: BarChart3, permission: "analytics.view" },
      { title: "Settings", url: "/settings", icon: Settings, permission: null },
      { title: "Mobile Apps", url: "/mobile-apps", icon: Smartphone, permission: null },
    ]
  }
];

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  const user = getUser();

  // Determine which menu to show based on user scope
  const isPlatformScoped = !user?.organizationId;
  const menuCategories = isPlatformScoped ? platformMenuCategories : organizationMenuCategories;

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
