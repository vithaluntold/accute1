import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Sparkles, Zap, Lock, Bot, Workflow, FileText, Users, TrendingUp, Shield, ArrowRight, PlayCircle, Brain, Cpu, Network, Globe, Clock, BarChart3 } from "lucide-react";
import { Link } from "wouter";
import logoUrl from "@assets/Accute Transparent symbol_1761505804713.png";
import { FinACEverseBranding } from "@/components/finaceverse-branding";
import { ThemeToggle } from "@/components/theme-toggle";
import { AIVisualAnimation, FloatingParticles, NeuralNetworkBackground } from "@/components/ai-visual-animation";

export default function Landing() {

  const features = [
    {
      icon: Workflow,
      title: "Unified Workflow Engine",
      description: "Enterprise-grade system combining visual automation AND hierarchical project management with AI-powered triggers",
    },
    {
      icon: Bot,
      title: "10 AI Agents",
      description: "Specialized AI for every function: Luca (Tax), Penny (Invoicing), Cadence (Workflows), Parity (Documents), and more",
    },
    {
      icon: Shield,
      title: "PKI Digital Signatures",
      description: "RSA-SHA256 signatures + SHA-256 hashing for tamper-proof, legally-binding document verification",
    },
    {
      icon: Users,
      title: "Multi-Tenant RBAC",
      description: "100+ granular permissions with complete SaaS vs tenant-level separation for enterprise security",
    },
    {
      icon: FileText,
      title: "Dynamic Form Builder",
      description: "22 field types with conditional logic. Build tax organizers, intake forms, questionnaires effortlessly",
    },
    {
      icon: TrendingUp,
      title: "AI Psychology Assessment",
      description: "Unique personality profiling for team optimization and performance monitoring with privacy protection",
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

  const aiAgents = [
    { name: "Luca", domain: "Tax & Compliance", icon: "📊" },
    { name: "Penny", domain: "Invoicing", icon: "💰" },
    { name: "Cadence", domain: "Workflows", icon: "⚙️" },
    { name: "Parity", domain: "Documents", icon: "📄" },
    { name: "Forma", domain: "Forms", icon: "📝" },
    { name: "Trace", domain: "HR/Recruiting", icon: "👤" },
    { name: "Echo", domain: "Communication", icon: "💬" },
    { name: "Scribe", domain: "Content", icon: "✍️" },
    { name: "Nexus", domain: "Data", icon: "📈" },
    { name: "Sentinel", domain: "Security", icon: "🛡️" },
  ];

  const stats = [
    { value: "15+", label: "Hours Saved Weekly", icon: Clock },
    { value: "10", label: "AI Agents", icon: Brain },
    { value: "100+", label: "Permissions", icon: Shield },
    { value: "21", label: "Day Free Trial", icon: Sparkles },
  ];

  const comparisonFeatures = [
    { feature: "AI Agent Marketplace", accute: true, traditional: false },
    { feature: "Multi-Provider AI (OpenAI, Azure, Anthropic)", accute: true, traditional: false },
    { feature: "AI Personality Profiling & Performance Monitoring", accute: true, traditional: false },
    { feature: "Workflow Automation", accute: true, traditional: true },
    { feature: "Client Portal", accute: true, traditional: true },
    { feature: "Document Management", accute: true, traditional: true },
    { feature: "PKI Digital Signatures", accute: true, traditional: false },
    { feature: "Azure Key Vault Integration (HSM)", accute: true, traditional: false },
    { feature: "Envelope Encryption (KEK/DEK)", accute: true, traditional: false },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link 
            href="/"
            className="flex items-center gap-2 hover-elevate rounded-md p-2"
            data-testid="link-home-logo"
          >
            <img src={logoUrl} alt="Accute" className="h-8 w-8" />
            <span className="font-display text-xl font-bold bg-gradient-to-r from-[#e5a660] to-[#d76082] bg-clip-text text-transparent">
              Accute
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <a href="#features" className="text-sm hover-elevate px-3 py-2 rounded-md hidden md:block" data-testid="link-features">
              Features
            </a>
            <a href="#agents" className="text-sm hover-elevate px-3 py-2 rounded-md hidden md:block" data-testid="link-agents">
              AI Agents
            </a>
            <a href="#use-cases" className="text-sm hover-elevate px-3 py-2 rounded-md hidden md:block" data-testid="link-use-cases">
              Use Cases
            </a>
            <Button asChild variant="ghost" data-testid="button-login">
              <Link href="/login">Login</Link>
            </Button>
            <Button asChild data-testid="button-get-started" className="bg-gradient-to-r from-[#e5a660] to-[#d76082]">
              <Link href="/register">
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      {/* Hero Section - Futuristic Design */}
      <section className="relative overflow-hidden min-h-[90vh] flex items-center">
        {/* Animated Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a1a] via-[#1a1a2e] to-[#16213e]" />
        <NeuralNetworkBackground className="opacity-40" />
        <FloatingParticles count={40} />
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#e5a660]/10 via-transparent to-[#d76082]/10" />
        
        <div className="container mx-auto px-4 py-16 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="space-y-8">
              <Badge className="bg-white/10 backdrop-blur-sm text-white border border-white/20 px-4 py-2" data-testid="badge-new">
                <Sparkles className="h-4 w-4 mr-2 text-[#e5a660]" />
                AI-Native Practice Management
              </Badge>
              
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold leading-tight" data-testid="text-hero-title">
                <span className="text-white">Workflows that</span>
                <br />
                <span className="bg-gradient-to-r from-[#e5a660] to-[#d76082] bg-clip-text text-transparent glow-text">
                  work without you
                </span>
              </h1>
              
              <p className="text-lg md:text-xl text-white/80 max-w-xl" data-testid="text-hero-description">
                Unlock seamless efficiency as AI takes charge of your daily tasks. 
                10 specialized agents automate accounting workflows, saving you 15+ hours weekly.
              </p>

              <div className="flex flex-wrap items-center gap-4">
                <Button
                  asChild
                  size="lg"
                  className="bg-gradient-to-r from-[#e5a660] to-[#d76082] text-lg px-8 py-6 shadow-lg shadow-[#e5a660]/20"
                  data-testid="button-hero-start-trial"
                >
                  <Link href="/register">
                    Start Free Trial
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/30 text-white hover:bg-white/10 backdrop-blur-sm px-8 py-6"
                  data-testid="button-hero-watch-demo"
                >
                  <PlayCircle className="mr-2 h-5 w-5" />
                  Watch Demo
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-6 pt-4 text-sm text-white/70">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-[#e5a660] animate-pulse" />
                  No credit card required
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-[#d76082] animate-pulse" />
                  21-day free trial
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-[#e5a660] animate-pulse" />
                  Cancel anytime
                </div>
              </div>
            </div>

            {/* Right - AI Visual Animation */}
            <div className="flex justify-center lg:justify-end">
              <AIVisualAnimation variant="hero" />
            </div>
          </div>
        </div>

        {/* Bottom gradient fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
      </section>

      {/* Stats Section */}
      <section className="py-12 border-y bg-muted/30 relative -mt-16 z-20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat, index) => (
              <div key={index} className="text-center p-6" data-testid={`stat-${index}`}>
                <stat.icon className="h-8 w-8 mx-auto mb-3 text-[#e5a660]" />
                <div className="text-3xl md:text-4xl font-display font-bold bg-gradient-to-r from-[#e5a660] to-[#d76082] bg-clip-text text-transparent">
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Agents Showcase */}
      <section id="agents" className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 gradient-mesh opacity-50" />
        <div className="container mx-auto px-4 relative">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Badge className="mb-4 bg-gradient-to-r from-[#e5a660]/20 to-[#d76082]/20 border-[#e5a660]/30">
              <Brain className="h-3 w-3 mr-1" />
              AI-Powered
            </Badge>
            <h2 className="text-4xl font-display font-bold mb-4">
              Meet Your{" "}
              <span className="bg-gradient-to-r from-[#e5a660] to-[#d76082] bg-clip-text text-transparent">
                AI Team
              </span>
            </h2>
            <p className="text-lg text-muted-foreground">
              10 specialized AI agents, each an expert in their domain
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {aiAgents.map((agent, index) => (
              <Card 
                key={index} 
                className="hover-elevate futuristic-card text-center p-4 bg-card/50 backdrop-blur-sm border-white/10"
                data-testid={`agent-card-${agent.name.toLowerCase()}`}
              >
                <div className="text-3xl mb-2">{agent.icon}</div>
                <div className="font-display font-bold text-lg">{agent.name}</div>
                <div className="text-xs text-muted-foreground">{agent.domain}</div>
              </Card>
            ))}
          </div>

          <div className="text-center mt-8">
            <Button asChild variant="outline" className="border-[#e5a660]/30">
              <Link href="/ai-agents">
                <Bot className="mr-2 h-4 w-4" />
                Explore AI Agent Marketplace
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-muted/30">
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
              <Card key={index} className="hover-elevate futuristic-card" data-testid={`feature-card-${index}`}>
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
      <section id="use-cases" className="py-24">
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
              <Card key={index} className="futuristic-card" data-testid={`use-case-${index}`}>
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
      <section className="py-24 bg-muted/30">
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
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-4 font-medium">Feature</th>
                        <th className="text-center p-4 font-medium">
                          <div className="flex flex-col items-center gap-1">
                            <span className="bg-gradient-to-r from-[#e5a660] to-[#d76082] bg-clip-text text-transparent font-display">
                              Accute
                            </span>
                            <Badge variant="outline" className="text-xs border-[#e5a660]/30">AI-Native</Badge>
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
                            {item.traditional ? (
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
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-[#e5a660]/20 to-[#d76082]/20 flex items-center justify-center mx-auto mb-4">
                <Shield className="h-10 w-10 text-[#e5a660]" />
              </div>
              <h2 className="text-3xl font-display font-bold mb-4">
                Enterprise-Grade Security
              </h2>
              <p className="text-lg text-muted-foreground">
                Your client data is protected by the same security standards used by Fortune 500 companies
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <Card className="border-2 border-[#e5a660]/30 futuristic-card">
                <CardHeader>
                  <Badge className="w-fit bg-gradient-to-r from-[#e5a660] to-[#d76082] text-white border-0 mb-2">
                    Enterprise
                  </Badge>
                  <CardTitle className="text-lg">Azure Key Vault + HSM</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[#e5a660] mt-0.5 flex-shrink-0" />
                    <span>HSM-backed Key Encryption Keys (KEK)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[#e5a660] mt-0.5 flex-shrink-0" />
                    <span>Envelope encryption with DEK/KEK hierarchy</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[#e5a660] mt-0.5 flex-shrink-0" />
                    <span>Split-knowledge dual-approval for key operations</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[#e5a660] mt-0.5 flex-shrink-0" />
                    <span>Hash-chained tamper-proof audit logs</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="futuristic-card">
                <CardHeader>
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
                    <span>Legally-binding signatures (eIDAS, ESIGN Act)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[#e5a660] mt-0.5 flex-shrink-0" />
                    <span>Real-time verification detects tampering instantly</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="futuristic-card">
                <CardHeader>
                  <CardTitle className="text-lg">Enterprise RBAC</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[#e5a660] mt-0.5 flex-shrink-0" />
                    <span>Platform vs Tenant role separation</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[#e5a660] mt-0.5 flex-shrink-0" />
                    <span>100+ granular permissions with namespace isolation</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[#e5a660] mt-0.5 flex-shrink-0" />
                    <span>JWT + bcrypt (10 rounds) + MFA authentication</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[#e5a660] mt-0.5 flex-shrink-0" />
                    <span>Multi-tenant isolation with organization-scoped RLS</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="futuristic-card">
                <CardHeader>
                  <CardTitle className="text-lg">Compliance Ready</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[#e5a660] mt-0.5 flex-shrink-0" />
                    <span>SOC 2 Type II ready infrastructure</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[#e5a660] mt-0.5 flex-shrink-0" />
                    <span>GDPR/CCPA compliant data handling</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[#e5a660] mt-0.5 flex-shrink-0" />
                    <span>PCI DSS key management audit trail</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[#e5a660] mt-0.5 flex-shrink-0" />
                    <span>Complete activity logging (user, IP, timestamp)</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a1a] via-[#1a1a2e] to-[#16213e]" />
        <FloatingParticles count={25} />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-6 text-white">
              Ready to Transform Your Practice?
            </h2>
            <p className="text-lg text-white/80 mb-8 max-w-2xl mx-auto">
              Join forward-thinking accounting firms using AI to automate workflows, 
              delight clients, and grow revenue
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Button
                asChild
                size="lg"
                className="bg-gradient-to-r from-[#e5a660] to-[#d76082] text-lg px-8 py-6 shadow-lg shadow-[#e5a660]/20"
                data-testid="button-cta-start"
              >
                <Link href="/register">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white/30 text-white hover:bg-white/10 px-8 py-6"
                data-testid="button-cta-contact"
              >
                Schedule Demo
              </Button>
            </div>
            <p className="text-sm text-white/60 mt-8">
              Questions? Email us at hello@accute.ai
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted/30">
        <div className="container mx-auto px-4">
          <FinACEverseBranding />
        </div>
      </footer>
    </div>
  );
}
