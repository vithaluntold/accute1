import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Home,
  Users,
  FileText,
  Settings,
  Bot,
  CheckSquare,
  Building2,
  Clock,
  Plus,
  Calendar,
  Workflow,
  Folder,
  Receipt,
  Zap,
  Video,
  Mail,
  Send,
  Brain,
  Sparkles,
  ArrowRight,
  LogIn,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { useAuthState } from "@/lib/auth-context";

interface CommandAction {
  id: string;
  label: string;
  icon: React.ElementType;
  action: () => void;
  keywords?: string[];
  shortcut?: string;
  category: "navigation" | "actions" | "ai" | "recent";
}

interface RecentItem {
  type: string;
  id: string;
  title: string;
  path: string;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { status } = useAuthState();
  
  const isAuthenticated = status === "authenticated";
  const isLoading = status === "loading";

  const { data: recentItems } = useQuery<RecentItem[]>({
    queryKey: ["/api/recent-activity"],
    enabled: open && isAuthenticated,
    retry: false,
    staleTime: 30000,
  });

  useEffect(() => {
    if (isLoading) return;
    
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prevOpen) => !prevOpen);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [isLoading]);

  const navigate = useCallback((path: string) => {
    if (!isAuthenticated && !path.startsWith("/login") && !path.startsWith("/register") && path !== "/" && path !== "/features") {
      setLocation(`/login?redirect=${encodeURIComponent(path)}`);
    } else {
      setLocation(path);
    }
    setOpen(false);
    setInputValue("");
  }, [setLocation, isAuthenticated]);

  const handleAICommand = useCallback(async (query: string) => {
    const cleanQuery = query.replace(/^(\/|ask |help )/i, "").trim();
    const targetPath = `/ai-agents/luca?query=${encodeURIComponent(cleanQuery)}`;
    
    if (!isAuthenticated) {
      toast({
        title: "Login Required",
        description: "Please log in to use AI features.",
        variant: "destructive",
      });
      setOpen(false);
      setInputValue("");
      setLocation(`/login?redirect=${encodeURIComponent(targetPath)}`);
      return;
    }
    
    toast({
      title: "AI Processing",
      description: `Sending to AI: "${cleanQuery}"`,
    });
    setLocation(targetPath);
    setOpen(false);
    setInputValue("");
  }, [toast, isAuthenticated, setLocation]);

  const navigationCommands: CommandAction[] = [
    { id: "nav-dashboard", label: "Go to Dashboard", icon: Home, action: () => navigate("/dashboard"), keywords: ["home", "overview"], shortcut: "⌘D", category: "navigation" },
    { id: "nav-clients", label: "Go to Clients", icon: Users, action: () => navigate("/clients"), keywords: ["customers", "contacts"], category: "navigation" },
    { id: "nav-tasks", label: "Go to Tasks", icon: CheckSquare, action: () => navigate("/tasks"), keywords: ["todos", "work"], shortcut: "⌘T", category: "navigation" },
    { id: "nav-documents", label: "Go to Documents", icon: FileText, action: () => navigate("/documents"), keywords: ["files", "papers"], category: "navigation" },
    { id: "nav-workflows", label: "Go to Workflows", icon: Workflow, action: () => navigate("/workflows"), keywords: ["processes", "automation"], category: "navigation" },
    { id: "nav-automation", label: "Go to Automation", icon: Zap, action: () => navigate("/automation"), keywords: ["triggers", "rules"], category: "navigation" },
    { id: "nav-recordings", label: "Go to Recordings", icon: Video, action: () => navigate("/recordings"), keywords: ["screen", "capture"], category: "navigation" },
    { id: "nav-projects", label: "Go to Projects", icon: Folder, action: () => navigate("/projects"), keywords: ["work", "cases"], category: "navigation" },
    { id: "nav-invoices", label: "Go to Invoices", icon: Receipt, action: () => navigate("/invoices"), keywords: ["billing", "payments"], category: "navigation" },
    { id: "nav-calendar", label: "Go to Calendar", icon: Calendar, action: () => navigate("/calendar"), keywords: ["schedule", "dates"], category: "navigation" },
    { id: "nav-ai-agents", label: "Go to AI Agents", icon: Bot, action: () => navigate("/ai-agents"), keywords: ["assistant", "chat"], category: "navigation" },
    { id: "nav-team", label: "Go to Team", icon: Users, action: () => navigate("/team"), keywords: ["members", "staff"], category: "navigation" },
    { id: "nav-settings", label: "Go to Settings", icon: Settings, action: () => navigate("/settings"), keywords: ["preferences", "config"], shortcut: "⌘,", category: "navigation" },
  ];

  const actionCommands: CommandAction[] = [
    { id: "action-new-task", label: "Create New Task", icon: Plus, action: () => navigate("/tasks?action=new"), keywords: ["add task", "new todo"], shortcut: "⌘N", category: "actions" },
    { id: "action-new-client", label: "Add New Client", icon: Plus, action: () => navigate("/clients?action=new"), keywords: ["add customer", "new contact"], category: "actions" },
    { id: "action-new-document", label: "Upload Document", icon: Plus, action: () => navigate("/documents?action=upload"), keywords: ["add file", "new doc"], category: "actions" },
    { id: "action-new-invoice", label: "Create Invoice", icon: Plus, action: () => navigate("/invoices?action=new"), keywords: ["new bill", "billing"], category: "actions" },
    { id: "action-new-recording", label: "Start Recording", icon: Video, action: () => navigate("/recordings?action=new"), keywords: ["screen capture", "record"], category: "actions" },
    { id: "action-email-templates", label: "Email Templates", icon: Mail, action: () => navigate("/email-templates"), keywords: ["send mail", "write", "compose"], category: "actions" },
  ];

  const aiCommands: CommandAction[] = [
    { id: "ai-luca", label: "Ask Luca (Tax Expert)", icon: Brain, action: () => navigate("/ai-agents/luca"), keywords: ["tax", "accounting", "help"], category: "ai" },
    { id: "ai-nova", label: "Talk to Nova (Assistant)", icon: Sparkles, action: () => navigate("/ai-agents/nova"), keywords: ["help", "assistant"], category: "ai" },
    { id: "ai-trace", label: "Use Trace (Hiring)", icon: Users, action: () => navigate("/ai-agents/trace"), keywords: ["recruit", "hiring", "resume"], category: "ai" },
    { id: "ai-compass", label: "Ask Compass (Practice)", icon: Building2, action: () => navigate("/ai-agents/compass"), keywords: ["strategy", "advisory"], category: "ai" },
    { id: "ai-scribe", label: "Use Scribe (Writing)", icon: FileText, action: () => navigate("/ai-agents/scribe"), keywords: ["write", "draft", "content"], category: "ai" },
  ];

  const publicCommands: CommandAction[] = [
    { id: "public-home", label: "Go to Home", icon: Home, action: () => { setLocation("/"); setOpen(false); }, keywords: ["landing", "main"], category: "navigation" },
    { id: "public-login", label: "Sign In", icon: LogIn, action: () => { setLocation("/login"); setOpen(false); }, keywords: ["login", "auth"], category: "navigation" },
    { id: "public-register", label: "Create Account", icon: Plus, action: () => { setLocation("/register"); setOpen(false); }, keywords: ["signup", "register"], category: "navigation" },
    { id: "public-features", label: "View Features", icon: Sparkles, action: () => { setLocation("/features"); setOpen(false); }, keywords: ["capabilities"], category: "navigation" },
  ];

  const isAIQuery = inputValue.startsWith("/") || 
                    inputValue.toLowerCase().startsWith("ask ") ||
                    inputValue.toLowerCase().startsWith("help ");

  return (
    <div data-testid="dialog-command-palette">
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput 
          placeholder="Type a command or search..." 
          value={inputValue}
          onValueChange={setInputValue}
          data-testid="input-command-palette"
        />
      <CommandList>
        <CommandEmpty>
          {isAIQuery ? (
            <div className="flex flex-col items-center gap-2 py-4">
              <Sparkles className="h-8 w-8 text-primary" />
              <p className="font-medium">Send to AI</p>
              <p className="text-muted-foreground text-sm">
                Press Enter to ask the AI: "{inputValue}"
              </p>
              <button
                onClick={() => handleAICommand(inputValue)}
                className="mt-2 flex items-center gap-2 text-sm text-primary hover:underline"
                data-testid="button-send-ai-query"
              >
                <Send className="h-4 w-4" />
                Send to AI Agent
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="py-4 text-center">
              <p>No results found.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Try searching or start with "/" to ask AI
              </p>
            </div>
          )}
        </CommandEmpty>

        {!isAuthenticated && (
          <CommandGroup heading="Get Started">
            {publicCommands
              .filter(cmd => {
                if (!inputValue) return true;
                const search = inputValue.toLowerCase();
                return cmd.label.toLowerCase().includes(search) ||
                       cmd.keywords?.some(k => k.includes(search));
              })
              .map((cmd) => (
                <CommandItem
                  key={cmd.id}
                  onSelect={cmd.action}
                  data-testid={`command-${cmd.id}`}
                >
                  <cmd.icon className="mr-2 h-4 w-4" />
                  <span>{cmd.label}</span>
                </CommandItem>
              ))}
          </CommandGroup>
        )}

        {isAuthenticated && !inputValue && recentItems && recentItems.length > 0 && (
          <CommandGroup heading="Recent">
            {recentItems.slice(0, 5).map((item) => (
              <CommandItem
                key={`${item.type}-${item.id}`}
                onSelect={() => navigate(item.path)}
                data-testid={`command-recent-${item.id}`}
              >
                <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>{item.title}</span>
                <Badge variant="secondary" className="ml-2">
                  {item.type}
                </Badge>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {isAuthenticated && (
          <>
            <CommandGroup heading="Navigation">
              {navigationCommands
                .filter(cmd => {
                  if (!inputValue) return true;
                  const search = inputValue.toLowerCase();
                  return cmd.label.toLowerCase().includes(search) ||
                         cmd.keywords?.some(k => k.includes(search));
                })
                .slice(0, 8)
                .map((cmd) => (
                  <CommandItem
                    key={cmd.id}
                    onSelect={cmd.action}
                    data-testid={`command-${cmd.id}`}
                  >
                    <cmd.icon className="mr-2 h-4 w-4" />
                    <span>{cmd.label}</span>
                    {cmd.shortcut && (
                      <CommandShortcut>{cmd.shortcut}</CommandShortcut>
                    )}
                  </CommandItem>
                ))}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Quick Actions">
              {actionCommands
                .filter(cmd => {
                  if (!inputValue) return true;
                  const search = inputValue.toLowerCase();
                  return cmd.label.toLowerCase().includes(search) ||
                         cmd.keywords?.some(k => k.includes(search));
                })
                .slice(0, 6)
                .map((cmd) => (
                  <CommandItem
                    key={cmd.id}
                    onSelect={cmd.action}
                    data-testid={`command-${cmd.id}`}
                  >
                    <cmd.icon className="mr-2 h-4 w-4" />
                    <span>{cmd.label}</span>
                    {cmd.shortcut && (
                      <CommandShortcut>{cmd.shortcut}</CommandShortcut>
                    )}
                  </CommandItem>
                ))}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="AI Assistants">
              {aiCommands
                .filter(cmd => {
                  if (!inputValue) return true;
                  const search = inputValue.toLowerCase();
                  return cmd.label.toLowerCase().includes(search) ||
                         cmd.keywords?.some(k => k.includes(search));
                })
                .map((cmd) => (
                  <CommandItem
                    key={cmd.id}
                    onSelect={cmd.action}
                    data-testid={`command-${cmd.id}`}
                  >
                    <cmd.icon className="mr-2 h-4 w-4" />
                    <span>{cmd.label}</span>
                  </CommandItem>
                ))}
            </CommandGroup>

            {isAIQuery && (
              <>
                <CommandSeparator />
                <CommandGroup heading="AI Query">
                  <CommandItem
                    onSelect={() => handleAICommand(inputValue)}
                    data-testid="command-ai-query"
                  >
                    <Sparkles className="mr-2 h-4 w-4 text-primary" />
                    <span>Ask AI: "{inputValue}"</span>
                    <CommandShortcut>↵</CommandShortcut>
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </>
        )}
      </CommandList>
      </CommandDialog>
    </div>
  );
}
