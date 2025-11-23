import { useLocation, Link } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Mail, Phone, MapPin, MessageSquare } from "lucide-react";
import logoUrl from "@assets/logo.png";

export default function Contact() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    phone: "",
    message: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate form submission
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    toast({
      title: "Message sent!",
      description: "We'll get back to you within 24 hours.",
    });
    
    setFormData({ name: "", email: "", company: "", phone: "", message: "" });
    setIsSubmitting(false);
  };

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
              Get in Touch
            </Badge>
            <h1 className="text-5xl md:text-6xl font-display font-bold text-white">
              Let's Talk About<br />
              <span className="text-white drop-shadow-lg">Your Practice</span>
            </h1>
            <p className="text-xl text-white/90">
              Our team is here to answer questions, provide demos, and help you
              get started with Accute.
            </p>
          </div>
        </div>
      </section>

      {/* Contact Content */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 max-w-6xl mx-auto">
            {/* Contact Info */}
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-display font-bold mb-4">Contact Information</h2>
                <p className="text-muted-foreground mb-8">
                  Have questions? We're here to help. Reach out through any of these channels.
                </p>
              </div>

              <div className="space-y-6">
                <Card className="hover-elevate">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-lg bg-gradient-to-br from-[#e5a660]/20 to-[#d76082]/20">
                        <Mail className="h-5 w-5 text-[#e5a660]" />
                      </div>
                      <div>
                        <h3 className="font-semibold mb-1">Email</h3>
                        <p className="text-sm text-muted-foreground">support@accute.ai</p>
                        <p className="text-sm text-muted-foreground">sales@accute.ai</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="hover-elevate">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-lg bg-gradient-to-br from-[#e5a660]/20 to-[#d76082]/20">
                        <Phone className="h-5 w-5 text-[#e5a660]" />
                      </div>
                      <div>
                        <h3 className="font-semibold mb-1">Phone</h3>
                        <p className="text-sm text-muted-foreground">+1 (555) 123-4567</p>
                        <p className="text-xs text-muted-foreground mt-1">Mon-Fri 9am-6pm EST</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="hover-elevate">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-lg bg-gradient-to-br from-[#e5a660]/20 to-[#d76082]/20">
                        <MapPin className="h-5 w-5 text-[#e5a660]" />
                      </div>
                      <div>
                        <h3 className="font-semibold mb-1">Office</h3>
                        <p className="text-sm text-muted-foreground">
                          123 Innovation Drive<br />
                          San Francisco, CA 94105
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="hover-elevate">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-lg bg-gradient-to-br from-[#e5a660]/20 to-[#d76082]/20">
                        <MessageSquare className="h-5 w-5 text-[#e5a660]" />
                      </div>
                      <div>
                        <h3 className="font-semibold mb-1">Live Chat</h3>
                        <p className="text-sm text-muted-foreground">
                          Chat with our support team instantly
                        </p>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="mt-2"
                          data-testid="button-live-chat"
                        >
                          Start Chat
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Contact Form */}
            <Card>
              <CardHeader>
                <CardTitle>Send Us a Message</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      data-testid="input-name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                      data-testid="input-email"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="company">Company</Label>
                    <Input
                      id="company"
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                      data-testid="input-company"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      data-testid="input-phone"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message">Message *</Label>
                    <Textarea
                      id="message"
                      rows={6}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      required
                      data-testid="input-message"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-[#e5a660] to-[#d76082]"
                    disabled={isSubmitting}
                    data-testid="button-submit"
                  >
                    {isSubmitting ? "Sending..." : "Send Message"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
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
