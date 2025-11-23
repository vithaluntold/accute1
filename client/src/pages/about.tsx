import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Target, Users, Lightbulb, Award } from "lucide-react";
import logoUrl from "@assets/logo.png";
import { FinACEverseBranding } from "@/components/finaceverse-branding";

export default function About() {

  const values = [
    {
      icon: Target,
      title: "Mission-Driven",
      description: "Democratize enterprise-grade AI automation for accounting firms of all sizes."
    },
    {
      icon: Users,
      title: "Client-Focused",
      description: "Build tools that accountants actually want to use, informed by real practitioner feedback."
    },
    {
      icon: Lightbulb,
      title: "Innovation First",
      description: "Push the boundaries of what's possible with AI in professional services."
    },
    {
      icon: Award,
      title: "Quality Obsessed",
      description: "Target Six Sigma quality (99.99966% defect-free) in every feature we ship."
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

      {/* Hero */}
      <section className="gradient-hero relative overflow-hidden">
        <div className="absolute inset-0 bg-black/20" />
        <div className="container mx-auto px-4 py-20 relative">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <Badge className="bg-white/20 backdrop-blur-sm text-white border border-white/30">
              About Accute
            </Badge>
            <h1 className="text-5xl md:text-6xl font-display font-bold text-white">
              Building the Future of<br />
              <span className="text-white drop-shadow-lg">Accounting Automation</span>
            </h1>
            <p className="text-xl text-white/90">
              We're on a mission to empower accounting firms with AI-native tools
              that save time, reduce errors, and delight clients.
            </p>
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto space-y-6 text-lg">
            <h2 className="text-3xl font-display font-bold">Our Story</h2>
            <p className="text-muted-foreground">
              Accute was founded in 2024 by a team of software engineers and CPAs who were frustrated
              by the lack of modern, AI-powered tools in accounting. While other industries embraced
              automation, accountants were still stuck with clunky legacy software that required
              endless manual data entry.
            </p>
            <p className="text-muted-foreground">
              We set out to build the first truly AI-native practice management platform—one that
              combines the workflow power of tools like Karbon with cutting-edge AI agents trained
              on accounting knowledge. The result is Accute: a platform that saves firms 15+ hours
              per week while improving accuracy and client satisfaction.
            </p>
            <p className="text-muted-foreground">
              Today, we serve hundreds of accounting firms across North America, from solo practitioners
              to mid-sized practices. Our platform processes millions of documents, automates thousands
              of workflows, and helps accountants focus on high-value advisory work instead of repetitive tasks.
            </p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-display font-bold mb-4">Our Values</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              The principles that guide everything we build
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value, idx) => {
              const Icon = value.icon;
              return (
                <Card key={idx} className="hover-elevate" data-testid={`card-value-${idx}`}>
                  <CardContent className="p-6 space-y-4">
                    <div className="p-3 rounded-lg bg-gradient-to-br from-[#e5a660]/20 to-[#d76082]/20 inline-block">
                      <Icon className="h-6 w-6 text-[#e5a660]" />
                    </div>
                    <h3 className="font-semibold text-lg">{value.title}</h3>
                    <p className="text-sm text-muted-foreground">{value.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container mx-auto px-4 text-center space-y-6">
          <h2 className="text-3xl font-display font-bold">
            Join Us on This Journey
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Whether you're looking to join our team or become a customer,
            we'd love to hear from you.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Button asChild size="lg" className="bg-gradient-to-r from-[#e5a660] to-[#d76082]" data-testid="button-cta-start-trial">
              <Link href="/register">
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" data-testid="button-cta-contact">
              <Link href="/contact">
                Contact Us
                
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
          
          <FinACEverseBranding />

          <div className="mt-8 text-center text-sm text-muted-foreground">
            <p>&copy; 2025 Accute. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
