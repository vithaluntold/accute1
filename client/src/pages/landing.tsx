import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Sparkles, Zap, Lock, Bot, Workflow, FileText, Users, TrendingUp, Shield, ArrowRight, PlayCircle } from "lucide-react";
import { useLocation } from "wouter";
import logoUrl from "@assets/Accute Transparent symbol_1761505804713.png";
import { MangalaWatermarks } from "@/components/mangala-watermarks";

export default function Landing() {
  const [, setLocation] = useLocation();

  const features = [
    {
      icon: Workflow,
      title: "Unified Workflow Engine",
      description: "Enterprise-grade system combining visual automation AND hierarchical project management (Stages → Steps → Tasks) with AI-powered triggers",
    },
    {
      icon: Bot,
      title: "Conversational AI Agents",
      description: "Chat with Cadence (workflows), Parity (documents), Forma (forms) using your OpenAI, Anthropic, or Azure OpenAI API keys—with full conversation history",
    },
    {
      icon: Shield,
      title: "PKI Digital Signatures",
      description: "Advanced blockchain alternative: RSA-SHA256 signatures + SHA-256 hashing ensure tamper-proof, legally-binding document verification",
    },
    {
      icon: Users,
      title: "Multi-Role RBAC System",
      description: "Complete SaaS-level vs tenant-level separation: Super Admin (platform), Admin/Employee/Client (organization) with 100+ granular permissions",
    },
    {
      icon: FileText,
      title: "Dynamic Form Builder",
      description: "22 field types with secure conditional logic (expr-eval). Build tax organizers, intake forms, questionnaires with show/hide/require rules",
    },
    {
      icon: TrendingUp,
      title: "Role-Based Dashboards",
      description: "Personal task stats (all users), team overview (managers with workflows.view), practice analytics (admins with reports.view)",
    },
  ];

  const useCases = [
    {
      title: "Tax Preparation Firms",
      description: "Automate 1040, 1065, 1120 workflows with AI data extraction and client portal",
      workflows: ["Client Onboarding", "Organizer Distribution", "Return Review", "E-Filing"],
    },
    {
      title: "Bookkeeping Services",
      description: "AI-powered reconciliation, expense categorization, and monthly close automation",
      workflows: ["Bank Reconciliation", "Invoice Processing", "Financial Reporting", "Client Review"],
    },
    {
      title: "Full-Service CPA Firms",
      description: "End-to-end practice management with AI agents for advisory, audit, and compliance",
      workflows: ["Engagement Letters", "Audit Planning", "Tax Planning", "Advisory Reports"],
    },
  ];

  const aiProviders = [
    { name: "OpenAI", model: "GPT-4 Turbo" },
    { name: "Azure OpenAI", model: "GPT-4" },
    { name: "Anthropic", model: "Claude 3.5 Sonnet" },
  ];

  const comparisonFeatures = [
    { feature: "AI Agent Marketplace", accute: true, taxdome: false },
    { feature: "Multi-Provider AI (OpenAI, Azure, Anthropic)", accute: true, taxdome: false },
    { feature: "Workflow Automation", accute: true, taxdome: true },
    { feature: "Client Portal", accute: true, taxdome: true },
    { feature: "Document Management", accute: true, taxdome: true },
    { feature: "Role-Based Permissions", accute: true, taxdome: true },
    { feature: "AI-Powered Data Extraction", accute: true, taxdome: false },
    { feature: "Predictive Analytics", accute: true, taxdome: false },
  ];

  return (
    <div className="min-h-screen bg-background">
      <MangalaWatermarks />
      {/* Navigation */}
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 relative">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={logoUrl} alt="Accute" className="h-8 w-8" />
            <span className="font-display text-xl font-bold bg-gradient-to-r from-[#e5a660] to-[#d76082] bg-clip-text text-transparent">
              Accute
            </span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#features" className="text-sm hover-elevate px-3 py-2 rounded-md" data-testid="link-features">
              Features
            </a>
            <a href="#use-cases" className="text-sm hover-elevate px-3 py-2 rounded-md" data-testid="link-use-cases">
              Use Cases
            </a>
            <Button
              variant="ghost"
              onClick={() => setLocation("/login")}
              data-testid="button-login"
            >
              Login
            </Button>
            <Button
              onClick={() => setLocation("/register")}
              data-testid="button-get-started"
              className="bg-gradient-to-r from-[#e5a660] to-[#d76082]"
            >
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden gradient-hero">
        <div className="absolute inset-0 bg-black/20" />
        <div className="container mx-auto px-4 py-24 relative">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <Badge className="bg-white/20 backdrop-blur-sm text-white border border-white/30" data-testid="badge-new">
              <Sparkles className="h-3 w-3 mr-1" />
              AI-Powered Accounting Automation
            </Badge>
            
            <h1 className="text-5xl md:text-6xl font-display font-bold leading-tight text-white" data-testid="text-hero-title">
              The First{" "}
              <span className="text-white drop-shadow-lg">
                AI-Native
              </span>
              <br />
              Practice Management Platform
            </h1>
            
            <p className="text-xl text-white/90 max-w-2xl mx-auto" data-testid="text-hero-description">
              Accute combines traditional workflow tools' power with cutting-edge AI agents. 
              Automate data entry, client communication, and compliance—saving 15+ hours per week.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
              <Button
                size="lg"
                onClick={() => setLocation("/register")}
                className="bg-gradient-to-r from-[#e5a660] to-[#d76082] text-lg px-8"
                data-testid="button-hero-start-trial"
              >
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                data-testid="button-hero-watch-demo"
              >
                <PlayCircle className="mr-2 h-5 w-5" />
                Watch Demo
              </Button>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 pt-8 text-sm text-white/90">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-white" />
                No credit card required
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-white" />
                14-day free trial
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-white" />
                Cancel anytime
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AI Providers Showcase */}
      <section className="py-12 border-y bg-muted/30">
        <div className="container mx-auto px-4">
          <p className="text-center text-sm text-muted-foreground mb-6">
            Powered by the world's leading AI providers
          </p>
          <div className="flex flex-wrap items-center justify-center gap-12">
            {aiProviders.map((provider) => (
              <div key={provider.name} className="text-center" data-testid={`provider-${provider.name.toLowerCase().replace(/\s+/g, '-')}`}>
                <div className="font-semibold">{provider.name}</div>
                <div className="text-sm text-muted-foreground">{provider.model}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-4xl font-display font-bold mb-4">
              Everything You Need, Plus{" "}
              <span className="bg-gradient-to-r from-[#e5a660] to-[#d76082] bg-clip-text text-transparent">
                AI Superpowers
              </span>
            </h2>
            <p className="text-lg text-muted-foreground">
              Built for accounting firms that want to work smarter, not harder
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="hover-elevate" data-testid={`feature-card-${index}`}>
                <CardHeader>
                  <div className="h-12 w-12 rounded-md bg-gradient-to-br from-[#e5a660]/20 to-[#d76082]/20 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-[#e5a660]" />
                  </div>
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section id="use-cases" className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-4xl font-display font-bold mb-4">
              Built for Every Type of Accounting Practice
            </h2>
            <p className="text-lg text-muted-foreground">
              Pre-configured workflows and AI agents for your specific needs
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {useCases.map((useCase, index) => (
              <Card key={index} data-testid={`use-case-${index}`}>
                <CardHeader>
                  <CardTitle>{useCase.title}</CardTitle>
                  <CardDescription>{useCase.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-muted-foreground">
                      Sample Workflows:
                    </div>
                    {useCase.workflows.map((workflow, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <Zap className="h-3 w-3 text-[#e5a660]" />
                        {workflow}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-4xl font-display font-bold mb-4">
              Accute vs Traditional Platforms
            </h2>
            <p className="text-lg text-muted-foreground">
              See how AI-native architecture gives you the edge
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-4 font-medium">Feature</th>
                        <th className="text-center p-4 font-medium">
                          <div className="flex flex-col items-center gap-1">
                            <span className="bg-gradient-to-r from-[#e5a660] to-[#d76082] bg-clip-text text-transparent">
                              Accute
                            </span>
                            <Badge variant="outline" className="text-xs">AI-Native</Badge>
                          </div>
                        </th>
                        <th className="text-center p-4 font-medium text-muted-foreground">
                          Traditional Tools
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonFeatures.map((item, index) => (
                        <tr key={index} className="border-b last:border-0" data-testid={`comparison-row-${index}`}>
                          <td className="p-4 text-sm">{item.feature}</td>
                          <td className="p-4 text-center">
                            {item.accute ? (
                              <Check className="h-5 w-5 text-[#e5a660] mx-auto" />
                            ) : (
                              <span className="text-muted-foreground text-xs">Coming Soon</span>
                            )}
                          </td>
                          <td className="p-4 text-center">
                            {item.taxdome ? (
                              <Check className="h-5 w-5 text-muted-foreground mx-auto" />
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <Shield className="h-16 w-16 text-[#e5a660] mx-auto mb-4" />
              <h2 className="text-3xl font-display font-bold mb-4">
                Enterprise-Grade Security
              </h2>
              <p className="text-lg text-muted-foreground">
                Your client data is protected by the same security standards used by Fortune 500 companies
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <Card className="border-2 border-[#e5a660]/30">
                <CardHeader>
                  <Badge className="w-fit bg-gradient-to-r from-[#e5a660] to-[#d76082] text-white border-0 mb-2">
                    Beyond Blockchain
                  </Badge>
                  <CardTitle className="text-lg">PKI Digital Signatures</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[#e5a660] mt-0.5 flex-shrink-0" />
                    <span>RSA-SHA256 cryptographic signatures on every document</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[#e5a660] mt-0.5 flex-shrink-0" />
                    <span>SHA-256 hashing for tamper-proof verification</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[#e5a660] mt-0.5 flex-shrink-0" />
                    <span>Legally-binding signatures (eIDAS, ESIGN Act compliant)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[#e5a660] mt-0.5 flex-shrink-0" />
                    <span>Real-time verification endpoint detects tampering instantly</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Data Encryption</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[#e5a660] mt-0.5 flex-shrink-0" />
                    <span>AES-256-GCM encryption for LLM API keys (ENCRYPTION_KEY)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[#e5a660] mt-0.5 flex-shrink-0" />
                    <span>Organization-isolated encryption keys</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[#e5a660] mt-0.5 flex-shrink-0" />
                    <span>Encrypted document storage with AES-256-CBC</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[#e5a660] mt-0.5 flex-shrink-0" />
                    <span>TLS 1.3 for data in transit</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Enterprise RBAC</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[#e5a660] mt-0.5 flex-shrink-0" />
                    <span>Platform vs Tenant role separation (prevents privilege escalation)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[#e5a660] mt-0.5 flex-shrink-0" />
                    <span>100+ granular permissions with namespace isolation</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[#e5a660] mt-0.5 flex-shrink-0" />
                    <span>JWT authentication with bcrypt (10 rounds) password hashing</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[#e5a660] mt-0.5 flex-shrink-0" />
                    <span>Multi-tenant isolation with organization-scoped queries</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Audit & Compliance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[#e5a660] mt-0.5 flex-shrink-0" />
                    <span>Comprehensive activity logs (user, IP, timestamp, action)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[#e5a660] mt-0.5 flex-shrink-0" />
                    <span>Document signature audit trail with signed timestamps</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[#e5a660] mt-0.5 flex-shrink-0" />
                    <span>GDPR/CCPA compliant data handling and privacy controls</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[#e5a660] mt-0.5 flex-shrink-0" />
                    <span>SOC 2 Type II ready infrastructure and controls</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <Card className="bg-gradient-to-br from-[#e5a660]/10 via-transparent to-[#d76082]/10 border-0">
            <CardContent className="p-12 text-center">
              <h2 className="text-4xl font-display font-bold mb-4">
                Ready to Transform Your Practice?
              </h2>
              <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
                Join forward-thinking accounting firms using AI to automate workflows, 
                delight clients, and grow revenue
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <Button
                  size="lg"
                  onClick={() => setLocation("/register")}
                  className="bg-gradient-to-r from-[#e5a660] to-[#d76082] text-lg px-8"
                  data-testid="button-cta-start"
                >
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  data-testid="button-cta-contact"
                >
                  Schedule Demo
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-6">
                Questions? Email us at hello@accute.ai or call (555) 123-4567
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <img src={logoUrl} alt="Accute" className="h-6 w-6" />
                <span className="font-display font-bold">Accute</span>
              </div>
              <p className="text-sm text-muted-foreground">
                AI-powered accounting workflow automation for modern practices
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover-elevate inline-block">Features</a></li>
                <li><a href="#pricing" className="hover-elevate inline-block">Pricing</a></li>
                <li><a href="#" className="hover-elevate inline-block">Integrations</a></li>
                <li><a href="#" className="hover-elevate inline-block">Security</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Resources</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover-elevate inline-block">Documentation</a></li>
                <li><a href="#" className="hover-elevate inline-block">API Reference</a></li>
                <li><a href="#" className="hover-elevate inline-block">Help Center</a></li>
                <li><a href="#" className="hover-elevate inline-block">Community</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover-elevate inline-block">About</a></li>
                <li><a href="#" className="hover-elevate inline-block">Blog</a></li>
                <li><a href="#" className="hover-elevrate inline-block">Careers</a></li>
                <li><a href="#" className="hover-elevate inline-block">Contact</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t mt-12 pt-8 flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
            <p>&copy; 2025 Accute. All rights reserved.</p>
            <div className="flex gap-6">
              <a href="#" className="hover-elevate">Privacy Policy</a>
              <a href="#" className="hover-elevate">Terms of Service</a>
              <a href="#" className="hover-elevate">Cookie Policy</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
