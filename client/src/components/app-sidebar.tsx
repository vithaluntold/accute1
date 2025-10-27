import { 
  Home, Workflow, Bot, FileText, Users, Settings, BarChart3, LogOut, Tag, Building2, 
  UserCircle, ClipboardList, ClipboardCheck, FolderOpen, MessageSquare, Clock, 
  Receipt, CreditCard, FileSignature, Kanban, MessagesSquare, Calendar, Mail 
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
} from "@/components/ui/sidebar";
import { clearAuth, getUser } from "@/lib/auth";
import logoUrl from "@assets/Accute Transparent symbol_1761505804713.png";

const menuItems = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: Home,
    permission: null,
  },
  {
    title: "Workflows",
    url: "/workflows",
    icon: Workflow,
    permission: "workflows.view",
  },
  {
    title: "AI Agents",
    url: "/ai-agents",
    icon: Bot,
    permission: "ai_agents.view",
  },
  {
    title: "Documents",
    url: "/documents",
    icon: FileText,
    permission: "documents.view",
  },
  {
    title: "Document Requests",
    url: "/document-requests",
    icon: ClipboardCheck,
    permission: "documents.view",
  },
  {
    title: "My Documents",
    url: "/my-documents",
    icon: FolderOpen,
    permission: null,
  },
  {
    title: "Forms",
    url: "/forms",
    icon: ClipboardList,
    permission: "forms.view",
  },
  {
    title: "Clients",
    url: "/clients",
    icon: Building2,
    permission: "clients.view",
  },
  {
    title: "Contacts",
    url: "/contacts",
    icon: UserCircle,
    permission: "contacts.view",
  },
  {
    title: "Tags",
    url: "/tags",
    icon: Tag,
    permission: "tags.view",
  },
  {
    title: "Analytics",
    url: "/analytics",
    icon: BarChart3,
    permission: "analytics.view",
  },
  {
    title: "Messages",
    url: "/messages",
    icon: MessageSquare,
    permission: "messaging.send",
  },
  {
    title: "Time Tracking",
    url: "/time-tracking",
    icon: Clock,
    permission: "time.create",
  },
  {
    title: "Invoices",
    url: "/invoices",
    icon: Receipt,
    permission: "invoices.view",
  },
  {
    title: "Payments",
    url: "/payments",
    icon: CreditCard,
    permission: "payments.view",
  },
  {
    title: "E-Signatures",
    url: "/signatures",
    icon: FileSignature,
    permission: "signatures.view",
  },
  {
    title: "Projects",
    url: "/projects",
    icon: Kanban,
    permission: "projects.view",
  },
  {
    title: "Team Chat",
    url: "/team-chat",
    icon: MessagesSquare,
    permission: null,
  },
  {
    title: "Calendar",
    url: "/calendar",
    icon: Calendar,
    permission: "appointments.view",
  },
  {
    title: "Email Templates",
    url: "/email-templates",
    icon: Mail,
    permission: "templates.view",
  },
  {
    title: "Team",
    url: "/team",
    icon: Users,
    permission: "users.view",
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
    permission: null,
  },
];

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  const user = getUser();

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
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
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
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
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
