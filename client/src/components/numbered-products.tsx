import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowRight, Bot, FileText, CreditCard, Workflow, Users, BarChart3 } from "lucide-react";
import { Link } from "wouter";

interface ProductFeature {
  text: string;
}

interface Product {
  number: string;
  title: string;
  description: string;
  features: ProductFeature[];
  cta: {
    text: string;
    href: string;
  };
  badge?: string;
  icon: typeof Bot;
}

interface NumberedProductsProps {
  products?: Product[];
}

const defaultProducts: Product[] = [
  {
    number: "01",
    title: "AI Practice Management",
    description: "Complete practice management powered by 12 specialized AI agents",
    features: [
      { text: "12 domain-specific AI agents" },
      { text: "Client portal with secure document sharing" },
      { text: "Automated workflow triggers" },
      { text: "Multi-tenant organization support" },
    ],
    cta: { text: "Start Free Trial", href: "/register" },
    icon: Bot,
  },
  {
    number: "02",
    title: "Secure Document Hub",
    description: "Enterprise-grade document management with legally-binding signatures",
    features: [
      { text: "PKI digital signatures (RSA-SHA256)" },
      { text: "Azure Key Vault encryption" },
      { text: "Tamper-proof audit trails" },
      { text: "Client self-upload portal" },
    ],
    cta: { text: "Explore Features", href: "/features" },
    icon: FileText,
  },
  {
    number: "03",
    title: "Smart Invoicing",
    description: "Automated billing with multi-gateway payment processing",
    features: [
      { text: "Razorpay & Cashfree integration" },
      { text: "Automated payment reminders" },
      { text: "Time-based billing sync" },
      { text: "Revenue analytics dashboard" },
    ],
    cta: { text: "See Pricing", href: "/pricing" },
    icon: CreditCard,
  },
];

function ProductCard({ product }: { product: Product }) {
  const Icon = product.icon;
  
  return (
    <Card 
      className="relative overflow-hidden bg-card/50 backdrop-blur-sm border-white/10 hover-elevate group"
      data-testid={`product-card-${product.number}`}
    >
      <div className="absolute top-4 right-4 text-7xl font-display font-bold text-[#e5a660]/10 select-none">
        {product.number}
      </div>
      
      <CardContent className="p-8 relative">
        <div className="flex items-start gap-4 mb-6">
          <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-[#e5a660]/20 to-[#d76082]/20 flex items-center justify-center group-hover:from-[#e5a660]/30 group-hover:to-[#d76082]/30 transition-all">
            <Icon className="h-7 w-7 text-[#e5a660]" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-bold text-[#e5a660]">{product.number}.</span>
              {product.badge && (
                <Badge className="bg-gradient-to-r from-[#e5a660] to-[#d76082] text-white border-0 text-xs">
                  {product.badge}
                </Badge>
              )}
            </div>
            <h3 className="text-xl font-display font-bold">{product.title}</h3>
          </div>
        </div>
        
        <p className="text-muted-foreground mb-6">
          {product.description}
        </p>
        
        <ul className="space-y-3 mb-8">
          {product.features.map((feature, index) => (
            <li key={index} className="flex items-start gap-3 text-sm">
              <Check className="h-4 w-4 text-[#e5a660] mt-0.5 flex-shrink-0" />
              <span>{feature.text}</span>
            </li>
          ))}
        </ul>
        
        <Button 
          asChild 
          className="w-full bg-gradient-to-r from-[#e5a660] to-[#d76082] group-hover:shadow-lg group-hover:shadow-[#e5a660]/20 transition-shadow"
        >
          <Link href={product.cta.href}>
            {product.cta.text}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function NumberedProducts({ products = defaultProducts }: NumberedProductsProps) {
  return (
    <section className="py-24" data-testid="numbered-products">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Badge className="mb-4 bg-gradient-to-r from-[#e5a660]/20 to-[#d76082]/20 border-[#e5a660]/30">
            Our Products
          </Badge>
          <h2 className="text-4xl font-display font-bold mb-4">
            Know Our{" "}
            <span className="bg-gradient-to-r from-[#e5a660] to-[#d76082] bg-clip-text text-transparent">
              Products
            </span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Accute's versatile solution adapts to various accounting needs. 
            Discover how we can revolutionize your practice.
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-6">
          {products.map((product) => (
            <ProductCard key={product.number} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function ComingSoonProduct() {
  return (
    <Card 
      className="relative overflow-hidden bg-card/30 backdrop-blur-sm border-white/10 border-dashed"
      data-testid="product-card-coming-soon"
    >
      <div className="absolute top-4 right-4 text-7xl font-display font-bold text-muted/20 select-none">
        04
      </div>
      
      <CardContent className="p-8 relative">
        <div className="flex items-start gap-4 mb-6">
          <div className="h-14 w-14 rounded-xl bg-muted/20 flex items-center justify-center">
            <Workflow className="h-7 w-7 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-bold text-muted-foreground">04.</span>
              <Badge variant="outline" className="text-xs">
                Coming Soon
              </Badge>
            </div>
            <h3 className="text-xl font-display font-bold text-muted-foreground">Chrome Extension</h3>
          </div>
        </div>
        
        <p className="text-muted-foreground/60 mb-6">
          Browser extension for task capture and quick actions from any webpage
        </p>
        
        <ul className="space-y-3 mb-8 opacity-60">
          <li className="flex items-start gap-3 text-sm text-muted-foreground">
            <Check className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>Quick-add tasks from any page</span>
          </li>
          <li className="flex items-start gap-3 text-sm text-muted-foreground">
            <Check className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>Time tracking widget</span>
          </li>
          <li className="flex items-start gap-3 text-sm text-muted-foreground">
            <Check className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>Natural language commands</span>
          </li>
        </ul>
        
        <Button variant="outline" className="w-full" disabled>
          Join Waitlist
        </Button>
      </CardContent>
    </Card>
  );
}
