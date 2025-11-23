import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Bot, 
  Workflow, 
  Shield, 
  Clock, 
  Users, 
  FileText, 
  BarChart, 
  Zap,
  CheckCircle,
  ArrowRight
} from "lucide-react";
import logoUrl from "@assets/logo.png";

export default function Features() {

  const features = [
    {
      icon: Bot,
      title: "10 Specialized AI Agents",
      description: "Dedicated agents for tax, audit, bookkeeping, payroll, client communication, and more. Each agent is trained on domain-specific knowledge.",
      benefits: ["24/7 availability", "Instant responses", "Multi-language support"]
    },
    {
      icon: Workflow,
      title: "Karbon-Style Workflow Automation",
      description: "Visual workflow builder with dependency management, auto-progression, and time-based triggers for seamless process orchestration.",
      benefits: ["Drag-drop builder", "Task dependencies", "Automated routing"]
    },
    {
      icon: Shield,
      title: "Enterprise-Grade Security",
      description: "SOC 2 compliant infrastructure with end-to-end encryption, role-based access control, and comprehensive audit trails.",
      benefits: ["AES-256 encryption", "SSO/SAML support", "Audit logging"]
    },
    {
      icon: Clock,
      title: "Time-Based Automation",
      description: "Schedule workflows with cron expressions or due-date triggers. Automatic reminders and escalations keep work on track.",
      benefits: ["Cron scheduling", "Due date alerts", "Auto-escalation"]
    },
    {
      icon: Users,
      title: "Client Portal",
      description: "Self-service portal for clients to upload documents, track progress, and communicate with your team securely.",
      benefits: ["Document upload", "Status tracking", "Secure messaging"]
    },
    {
      icon: FileText,
      title: "Document Intelligence",
      description: "AI-powered document parsing extracts data from invoices, receipts, tax forms, and financial statements automatically.",
      benefits: ["OCR extraction", "Auto-categorization", "Smart validation"]
    },
    {
      icon: BarChart,
      title: "Analytics & Insights",
      description: "Real-time dashboards track team performance, client engagement, and workflow efficiency with actionable insights.",
      benefits: ["Performance metrics", "Custom reports", "Trend analysis"]
    },
    {
      icon: Zap,
      title: "Integration Ecosystem",
      description: "Connect with QuickBooks, Xero, Stripe, Plaid, and 50+ accounting tools through our native integration marketplace.",
      benefits: ["Pre-built connectors", "API access", "Webhook support"]
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link 
            href="/"
            className="flex items-center gap-2 hover-elevate rounded-md p-2"
            data-testid="button-home"
          >
            <img src={logoUrl} alt="Accute" className="h-8 w-8" />
            <span className="font-display text-xl font-bold bg-gradient-to-r from-[#e5a660] to-[#d76082] bg-clip-text text-transparent">
              Accute
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" data-testid="button-login">
              <Link href="/login">Login</Link>
            </Button>
            <Button asChild data-testid="button-get-started" className="bg-gradient-to-r from-[#e5a660] to-[#d76082]">
              <Link href="/register">
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="gradient-hero relative overflow-hidden">
        <div className="absolute inset-0 bg-black/20" />
        <div className="container mx-auto px-4 py-20 relative">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <Badge className="bg-white/20 backdrop-blur-sm text-white border border-white/30">
              Platform Features
            </Badge>
            <h1 className="text-5xl md:text-6xl font-display font-bold text-white">
              Everything You Need to<br />
              <span className="text-white drop-shadow-lg">Scale Your Practice</span>
            </h1>
            <p className="text-xl text-white/90">
              Accute combines AI automation, workflow orchestration, and collaboration tools
              in one platform—saving your team 15+ hours per week.
            </p>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <Card key={idx} className="hover-elevate" data-testid={`card-feature-${idx}`}>
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-lg bg-gradient-to-br from-[#e5a660]/20 to-[#d76082]/20">
                        <Icon className="h-6 w-6 text-[#e5a660]" />
                      </div>
                      <CardTitle className="text-lg">{feature.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      {feature.description}
                    </p>
                    <div className="space-y-2">
                      {feature.benefits.map((benefit, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span>{benefit}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4 text-center space-y-6">
          <h2 className="text-3xl font-display font-bold">
            Ready to Transform Your Practice?
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Join hundreds of accounting firms using Accute to automate workflows, 
            improve client satisfaction, and scale effortlessly.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Button asChild size="lg" className="bg-gradient-to-r from-[#e5a660] to-[#d76082]" data-testid="button-cta-register">
              <Link href="/register">
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" data-testid="button-cta-contact-sales">
              <Link href="/contact">
                Contact Sales
                
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <Link 
                href="/"
                className="flex items-center gap-2 mb-4 hover-elevate rounded-md p-2"
                data-testid="link-footer-home"
              >
                <img src={logoUrl} alt="Accute" className="h-6 w-6" />
                <span className="font-display font-bold">Accute</span>
              </Link>
              <p className="text-sm text-muted-foreground">
                AI-powered accounting workflow automation for modern practices
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/features" className="hover-elevate" data-testid="link-footer-features">Features</Link></li>
                <li><Link href="/subscription-pricing" className="hover-elevate" data-testid="link-footer-pricing">Pricing</Link></li>
                <li><Link href="/security" className="hover-elevate" data-testid="link-footer-security">Security</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/about" className="hover-elevate" data-testid="link-footer-about">About</Link></li>
                <li><Link href="/contact" className="hover-elevate" data-testid="link-footer-contact">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Legal</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/privacy" className="hover-elevate" data-testid="link-footer-privacy">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover-elevate" data-testid="link-footer-terms">Terms of Service</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t mt-12 pt-8 text-center text-sm text-muted-foreground">
            <p>&copy; 2025 Accute. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
