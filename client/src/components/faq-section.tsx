import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface FAQ {
  question: string;
  answer: string;
}

interface FAQSectionProps {
  faqs?: FAQ[];
}

const defaultFAQs: FAQ[] = [
  {
    question: "What is Accute?",
    answer: "Accute is an AI-native practice management platform built specifically for accounting firms. It combines 12 specialized AI agents with complete practice management tools including client portal, document management, PKI digital signatures, invoicing, and Karbon-style workflow automation. Think of it as your AI-powered back office."
  },
  {
    question: "How do the AI agents work?",
    answer: "Our 12 AI agents are pre-trained on accounting domains using advanced models from OpenAI, Azure, and Anthropic. Luca handles tax and compliance questions, Parity analyzes documents, Trace manages HR and recruiting, Echo drafts communications, and more. They work immediately - no training required from you. Each agent stays strictly within its domain for accurate, reliable responses."
  },
  {
    question: "Is my data secure?",
    answer: "Absolutely. We use enterprise-grade security including AES-256 encryption, Azure Key Vault with HSM-backed keys, envelope encryption (KEK/DEK hierarchy), and PKI digital signatures. All data is isolated per organization with Row Level Security. We're SOC 2 Type II ready and GDPR/CCPA compliant. Your client data never trains AI models."
  },
  {
    question: "What's included in the 21-day free trial?",
    answer: "Full access to everything - no limitations. You get all 12 AI agents, unlimited clients and contacts, document management with digital signatures, workflow automation, invoicing with payment processing (test mode), and the client portal. No credit card required to start. You can cancel anytime."
  },
  {
    question: "Can I integrate with QuickBooks or Xero?",
    answer: "Integrations with QuickBooks Online and Xero are on our roadmap and coming in Q1 2025. Currently, we integrate with payment gateways (Razorpay, Cashfree), email services (Gmail, Resend, Mailgun), and AI providers (OpenAI, Azure OpenAI, Anthropic Claude). Our API also supports custom integrations."
  },
  {
    question: "How is Accute different from Karbon or Practice CS?",
    answer: "Accute is AI-native from the ground up, not AI-bolted-on. While traditional tools have basic automation, Accute has 12 specialized AI agents that understand accounting. We offer enterprise security features like Azure Key Vault and PKI signatures that most competitors don't have. Plus, our workflow engine supports all 4 dependency types for complex project management."
  },
  {
    question: "Do I need technical skills to use Accute?",
    answer: "Not at all. Accute is designed for accountants, not developers. The visual workflow builder uses drag-and-drop, AI agents respond to natural language, and the interface follows familiar patterns from tools you already use. Most firms are up and running within a day."
  },
  {
    question: "What kind of support do you offer?",
    answer: "All plans include email support with 24-hour response times. Professional and Enterprise plans include priority support with dedicated account managers, onboarding assistance, and custom training sessions. We also have extensive documentation, video tutorials, and a community forum."
  }
];

function FAQItem({ faq, isOpen, onToggle, index }: { faq: FAQ; isOpen: boolean; onToggle: () => void; index: number }) {
  return (
    <div 
      className="border-b border-white/10 last:border-0"
      data-testid={`faq-item-${index}`}
    >
      <button
        onClick={onToggle}
        className="w-full py-6 flex items-center justify-between text-left hover:bg-muted/5 transition-colors px-2 -mx-2 rounded-lg"
        aria-expanded={isOpen}
        data-testid={`faq-toggle-${index}`}
      >
        <span className="font-medium text-lg pr-8">{faq.question}</span>
        <ChevronDown 
          className={`h-5 w-5 text-muted-foreground flex-shrink-0 transition-transform duration-300 ${
            isOpen ? 'rotate-180' : ''
          }`} 
        />
      </button>
      <div 
        className={`overflow-hidden transition-all duration-300 ${
          isOpen ? 'max-h-96 pb-6' : 'max-h-0'
        }`}
      >
        <p className="text-muted-foreground leading-relaxed px-2">
          {faq.answer}
        </p>
      </div>
    </div>
  );
}

export function FAQSection({ faqs = defaultFAQs }: FAQSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  
  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };
  
  return (
    <section className="py-24 bg-muted/20" data-testid="faq-section">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-gradient-to-r from-[#e5a660]/20 to-[#d76082]/20 border-[#e5a660]/30">
              <HelpCircle className="h-3 w-3 mr-1" />
              FAQs
            </Badge>
            <h2 className="text-4xl font-display font-bold mb-4">
              Frequently Asked{" "}
              <span className="bg-gradient-to-r from-[#e5a660] to-[#d76082] bg-clip-text text-transparent">
                Questions
              </span>
            </h2>
            <p className="text-lg text-muted-foreground">
              Everything you need to know about Accute
            </p>
          </div>
          
          <div className="bg-card/50 backdrop-blur-sm border border-white/10 rounded-xl p-6 md:p-8">
            {faqs.map((faq, index) => (
              <FAQItem 
                key={index} 
                faq={faq} 
                index={index}
                isOpen={openIndex === index}
                onToggle={() => toggleFAQ(index)}
              />
            ))}
          </div>
          
          <div className="text-center mt-8">
            <p className="text-muted-foreground">
              Still have questions?{" "}
              <a href="mailto:hello@accute.ai" className="text-[#e5a660] hover:underline">
                Contact our team
              </a>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
