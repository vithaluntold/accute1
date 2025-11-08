import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GradientHero } from "@/components/gradient-hero";
import { Button } from "@/components/ui/button";
import { 
  HelpCircle, 
  MessageSquare, 
  FileText, 
  Mail,
  ExternalLink,
  BookOpen,
  Video,
  Users
} from "lucide-react";
import { useLocation } from "wouter";

export default function Help() {
  const [, setLocation] = useLocation();

  const helpResources = [
    {
      icon: BookOpen,
      title: "Documentation",
      description: "Browse our comprehensive guides and tutorials",
      action: "View Docs",
      onClick: () => window.open('https://docs.accute.io', '_blank'),
      testId: "button-documentation"
    },
    {
      icon: Video,
      title: "Video Tutorials",
      description: "Watch step-by-step video guides",
      action: "Watch Videos",
      onClick: () => window.open('https://tutorials.accute.io', '_blank'),
      testId: "button-tutorials"
    },
    {
      icon: MessageSquare,
      title: "Live Chat",
      description: "Chat with our support team in real-time",
      action: "Start Chat",
      onClick: () => setLocation('/live-chat'),
      testId: "button-live-chat"
    },
    {
      icon: Mail,
      title: "Email Support",
      description: "Send us an email and we'll respond within 24 hours",
      action: "Send Email",
      onClick: () => window.location.href = 'mailto:support@accute.io',
      testId: "button-email-support"
    },
    {
      icon: Users,
      title: "Community Forum",
      description: "Connect with other users and share knowledge",
      action: "Visit Forum",
      onClick: () => window.open('https://community.accute.io', '_blank'),
      testId: "button-community"
    },
    {
      icon: FileText,
      title: "Submit a Ticket",
      description: "Create a support ticket for technical issues",
      action: "Create Ticket",
      onClick: () => setLocation('/support-tickets/new'),
      testId: "button-submit-ticket"
    }
  ];

  const faqs = [
    {
      question: "How do I reset my password?",
      answer: "Go to Settings > Security and click 'Change Password' to update your password."
    },
    {
      question: "How do I invite team members?",
      answer: "Navigate to Settings > Team and click 'Invite Member' to send invitations."
    },
    {
      question: "How do I upgrade my subscription?",
      answer: "Visit Settings > Billing to view available plans and upgrade your subscription."
    },
    {
      question: "How do I access AI agents?",
      answer: "AI agents are available in the main navigation. Click on 'AI Agents' to see all available agents."
    }
  ];

  return (
    <div className="h-full overflow-auto">
      <GradientHero
        icon={HelpCircle}
        title="Help & Support"
        description="Get the help you need to make the most of Accute"
        testId="help-hero"
      />

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Help Resources */}
        <div>
          <h2 className="text-2xl font-semibold mb-4" data-testid="text-help-resources-title">
            How can we help you?
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {helpResources.map((resource) => (
              <Card 
                key={resource.title} 
                className="hover-elevate cursor-pointer" 
                onClick={resource.onClick}
                data-testid={`card-${resource.testId}`}
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <resource.icon className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-lg">{resource.title}</CardTitle>
                  </div>
                  <CardDescription>{resource.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    variant="outline" 
                    className="w-full" 
                    onClick={(e) => {
                      e.stopPropagation();
                      resource.onClick();
                    }}
                    data-testid={resource.testId}
                  >
                    {resource.action}
                    <ExternalLink className="h-4 w-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* FAQs */}
        <Card data-testid="card-faqs">
          <CardHeader>
            <CardTitle>Frequently Asked Questions</CardTitle>
            <CardDescription>Quick answers to common questions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {faqs.map((faq, index) => (
                <div 
                  key={index} 
                  className="p-4 rounded-lg border hover-elevate"
                  data-testid={`faq-${index}`}
                >
                  <h3 className="font-semibold mb-2">{faq.question}</h3>
                  <p className="text-sm text-muted-foreground">{faq.answer}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card data-testid="card-contact">
          <CardHeader>
            <CardTitle>Still need help?</CardTitle>
            <CardDescription>Our support team is here to assist you</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">Email Support</p>
                <p className="text-sm text-muted-foreground">support@accute.io</p>
                <p className="text-xs text-muted-foreground mt-1">Response time: Within 24 hours</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MessageSquare className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">Live Chat</p>
                <p className="text-sm text-muted-foreground">Available Monday-Friday, 9 AM - 6 PM EST</p>
                <Button 
                  variant="link" 
                  className="p-0 h-auto" 
                  onClick={() => setLocation('/live-chat')}
                  data-testid="button-start-live-chat"
                >
                  Start a conversation
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
