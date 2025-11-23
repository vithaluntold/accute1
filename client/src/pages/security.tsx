import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Shield, 
  Lock, 
  Key, 
  FileCheck, 
  Eye, 
  Server,
  CheckCircle,
  ArrowRight
} from "lucide-react";
import logoUrl from "@assets/logo.png";

export default function Security() {
  const [, setLocation] = useLocation();

  const securityFeatures = [
    {
      icon: Lock,
      title: "End-to-End Encryption",
      description: "All data encrypted at rest with AES-256 and in transit with TLS 1.3. Your client data is protected at every layer.",
      certifications: ["SOC 2 Type II", "ISO 27001", "GDPR Compliant"]
    },
    {
      icon: Key,
      title: "Enterprise SSO/SAML",
      description: "Integrate with Okta, Azure AD, Google Workspace, and other identity providers for seamless, secure authentication.",
      certifications: ["SAML 2.0", "OAuth 2.0", "OIDC"]
    },
    {
      icon: FileCheck,
      title: "Comprehensive Audit Trails",
      description: "Every action logged with timestamp, user, IP address, and change details. Full compliance with professional standards.",
      certifications: ["AICPA", "IRS e-file", "SOC 2"]
    },
    {
      icon: Eye,
      title: "Role-Based Access Control",
      description: "Granular permissions ensure users only see what they need. 4-tier RBAC system with custom role creation.",
      certifications: ["NIST Framework", "CIS Controls"]
    },
    {
      icon: Server,
      title: "Infrastructure Security",
      description: "Hosted on SOC 2 certified cloud infrastructure with 99.9% uptime SLA, automated backups, and disaster recovery.",
      certifications: ["AWS SOC 2", "ISO 27001", "PCI DSS"]
    },
    {
      icon: Shield,
      title: "Data Privacy",
      description: "Your data is yours. We never sell client data, train AI models on your information, or share with third parties.",
      certifications: ["GDPR", "CCPA", "PIPEDA"]
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <button 
            onClick={() => setLocation("/")}
            className="flex items-center gap-2 hover-elevate rounded-md p-2"
            data-testid="button-home"
          >
            <img src={logoUrl} alt="Accute" className="h-8 w-8" />
            <span className="font-display text-xl font-bold bg-gradient-to-r from-[#e5a660] to-[#d76082] bg-clip-text text-transparent">
              Accute
            </span>
          </button>
          <div className="flex items-center gap-4">
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

      {/* Hero */}
      <section className="gradient-hero relative overflow-hidden">
        <div className="absolute inset-0 bg-black/20" />
        <div className="container mx-auto px-4 py-20 relative">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <Badge className="bg-white/20 backdrop-blur-sm text-white border border-white/30">
              Security & Compliance
            </Badge>
            <h1 className="text-5xl md:text-6xl font-display font-bold text-white">
              Enterprise-Grade<br />
              <span className="text-white drop-shadow-lg">Security Built In</span>
            </h1>
            <p className="text-xl text-white/90">
              Your clients trust you with their most sensitive financial data.
              We take that responsibility seriously.
            </p>
          </div>
        </div>
      </section>

      {/* Security Features */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {securityFeatures.map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <Card key={idx} className="hover-elevate" data-testid={`card-security-${idx}`}>
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
                    <div className="flex flex-wrap gap-2">
                      {feature.certifications.map((cert, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {cert}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Compliance Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-display font-bold mb-4">Compliance Standards</h2>
              <p className="text-lg text-muted-foreground">
                Accute meets or exceeds industry-leading security and compliance standards
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    SOC 2 Type II Certified
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Annual audits verify our security controls, availability, confidentiality, and privacy practices.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    GDPR & CCPA Compliant
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Full compliance with global data privacy regulations, including data portability and right to erasure.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    IRS e-file Approved
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Authorized IRS e-file provider with secure data transmission protocols for tax filings.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    ISO 27001 Certified
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    International standard for information security management systems (ISMS).
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Penetration Testing */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h2 className="text-3xl font-display font-bold">Continuous Security Testing</h2>
            <p className="text-lg text-muted-foreground">
              We conduct regular penetration testing, vulnerability scanning, and security audits
              to ensure your data stays protected against evolving threats.
            </p>
            <div className="grid md:grid-cols-3 gap-6 mt-8">
              <Card>
                <CardContent className="p-6 text-center">
                  <div className="text-3xl font-bold text-[#e5a660] mb-2">Quarterly</div>
                  <p className="text-sm text-muted-foreground">Penetration Tests</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 text-center">
                  <div className="text-3xl font-bold text-[#e5a660] mb-2">24/7</div>
                  <p className="text-sm text-muted-foreground">Vulnerability Monitoring</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 text-center">
                  <div className="text-3xl font-bold text-[#e5a660] mb-2">Annual</div>
                  <p className="text-sm text-muted-foreground">SOC 2 Audits</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4 text-center space-y-6">
          <h2 className="text-3xl font-display font-bold">
            Questions About Security?
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Our security team is happy to answer any questions and provide detailed documentation.
          </p>
          <Button
            size="lg"
            onClick={() => setLocation("/contact")}
            className="bg-gradient-to-r from-[#e5a660] to-[#d76082]"
            data-testid="button-cta-contact"
          >
            Contact Security Team
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <button 
                onClick={() => setLocation("/")}
                className="flex items-center gap-2 mb-4 hover-elevate rounded-md p-2"
              >
                <img src={logoUrl} alt="Accute" className="h-6 w-6" />
                <span className="font-display font-bold">Accute</span>
              </button>
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
