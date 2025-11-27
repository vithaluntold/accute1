import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Calculator, BookOpen, Shield, Lightbulb, Building2, Briefcase } from "lucide-react";

interface IndustryFeature {
  text: string;
  integration?: string;
}

interface Industry {
  id: string;
  label: string;
  icon: typeof Calculator;
  description: string;
  features: IndustryFeature[];
}

interface IndustryTabsProps {
  industries?: Industry[];
}

const defaultIndustries: Industry[] = [
  {
    id: "tax",
    label: "Tax Preparation",
    icon: Calculator,
    description: "Automate tax season workflows and delight clients with a seamless experience",
    features: [
      { text: "Automate 1040, 1065, 1120 workflows with AI", integration: "IRS e-File" },
      { text: "IRS compliance checks via Luca AI agent", integration: "Tax Code DB" },
      { text: "Client document collection portal", integration: "Secure Upload" },
      { text: "E-signature for engagement letters", integration: "PKI Signatures" },
      { text: "Automated organizer distribution", integration: "Email/Portal" },
    ]
  },
  {
    id: "bookkeeping",
    label: "Bookkeeping",
    icon: BookOpen,
    description: "AI-powered reconciliation and monthly close automation",
    features: [
      { text: "Bank reconciliation automation", integration: "Bank Feeds" },
      { text: "Invoice processing with AI extraction", integration: "Parity Agent" },
      { text: "Expense categorization with ML", integration: "Smart Rules" },
      { text: "Real-time financial dashboards", integration: "Analytics" },
      { text: "Client collaboration portal", integration: "Portal" },
    ]
  },
  {
    id: "audit",
    label: "Audit & Assurance",
    icon: Shield,
    description: "Enterprise-grade security and compliance for audit engagements",
    features: [
      { text: "Hash-chained tamper-proof audit trails", integration: "Crypto Audit" },
      { text: "Digital signatures for workpapers", integration: "PKI" },
      { text: "Dual-approval for sensitive operations", integration: "Split Knowledge" },
      { text: "SOC 2 Type II ready infrastructure", integration: "Compliance" },
      { text: "Evidence collection workflows", integration: "Workflows" },
    ]
  },
  {
    id: "advisory",
    label: "Advisory Services",
    icon: Lightbulb,
    description: "AI-powered insights to deliver exceptional client advisory",
    features: [
      { text: "AI-powered financial analysis", integration: "Radar Agent" },
      { text: "Client meeting preparation", integration: "Scribe Agent" },
      { text: "Proposal and report generation", integration: "Templates" },
      { text: "Performance benchmarking", integration: "Analytics" },
      { text: "Strategic planning tools", integration: "Dashboards" },
    ]
  },
  {
    id: "firms",
    label: "Multi-Partner Firms",
    icon: Building2,
    description: "Enterprise features for larger accounting practices",
    features: [
      { text: "Multi-tenant organization support", integration: "RBAC" },
      { text: "100+ granular permissions", integration: "Security" },
      { text: "AI Psychology team assessment", integration: "OmniSpectra" },
      { text: "Resource allocation optimization", integration: "Cadence" },
      { text: "Partner dashboard and reporting", integration: "Analytics" },
    ]
  },
];

function IndustryContent({ industry }: { industry: Industry }) {
  const Icon = industry.icon;
  
  return (
    <Card className="bg-card/50 backdrop-blur-sm border-white/10">
      <CardContent className="p-8">
        <div className="flex items-start gap-6">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-[#e5a660]/20 to-[#d76082]/20 flex items-center justify-center flex-shrink-0">
            <Icon className="h-8 w-8 text-[#e5a660]" />
          </div>
          <div className="flex-1">
            <h3 className="text-2xl font-display font-bold mb-2">{industry.label}</h3>
            <p className="text-muted-foreground mb-6">{industry.description}</p>
            
            <div className="grid md:grid-cols-2 gap-4">
              {industry.features.map((feature, index) => (
                <div key={index} className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-[#e5a660] mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-sm">{feature.text}</span>
                    {feature.integration && (
                      <Badge variant="outline" className="ml-2 text-xs border-[#e5a660]/30 text-[#e5a660]">
                        {feature.integration}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function IndustryTabs({ industries = defaultIndustries }: IndustryTabsProps) {
  const [activeTab, setActiveTab] = useState(industries[0].id);
  
  return (
    <section className="py-24 bg-muted/20" data-testid="industry-tabs">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <Badge className="mb-4 bg-gradient-to-r from-[#e5a660]/20 to-[#d76082]/20 border-[#e5a660]/30">
            <Briefcase className="h-3 w-3 mr-1" />
            Industry Solutions
          </Badge>
          <h2 className="text-4xl font-display font-bold mb-4">
            Transforming{" "}
            <span className="bg-gradient-to-r from-[#e5a660] to-[#d76082] bg-clip-text text-transparent">
              Every Practice
            </span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Accute adapts to your specific accounting specialty with pre-built workflows and AI agents
          </p>
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex justify-center mb-8">
            <TabsList className="bg-card/50 backdrop-blur-sm border border-white/10 p-1 h-auto flex-wrap gap-1">
              {industries.map((industry) => {
                const Icon = industry.icon;
                return (
                  <TabsTrigger
                    key={industry.id}
                    value={industry.id}
                    className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#e5a660] data-[state=active]:to-[#d76082] data-[state=active]:text-white px-4 py-2 gap-2"
                    data-testid={`industry-tab-${industry.id}`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{industry.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>
          
          {industries.map((industry) => (
            <TabsContent key={industry.id} value={industry.id} className="mt-0">
              <IndustryContent industry={industry} />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  );
}
