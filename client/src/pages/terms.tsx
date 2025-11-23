import { Link } from "wouter";
import { Button} from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import logoUrl from "@assets/logo.png";
import { FinACEverseBranding } from "@/components/finaceverse-branding";

export default function Terms() {

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

      {/* Content */}
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <h1 className="text-4xl font-display font-bold mb-8">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: November 23, 2025</p>

        <div className="prose prose-slate dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground mb-4">
              By accessing or using Accute's AI-powered accounting workflow automation platform
              (the "Service"), you agree to be bound by these Terms of Service ("Terms"). If you
              do not agree to these Terms, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Description of Service</h2>
            <p className="text-muted-foreground mb-4">
              Accute provides an AI-native practice management platform for accounting firms,
              including workflow automation, AI agents, client portals, document management,
              and related tools. We reserve the right to modify, suspend, or discontinue any
              part of the Service at any time with or without notice.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. User Accounts</h2>
            
            <h3 className="text-xl font-semibold mb-3 mt-4">3.1 Account Creation</h3>
            <p className="text-muted-foreground mb-4">
              You must create an account to use the Service. You agree to provide accurate,
              current, and complete information during registration and to update such information
              to keep it accurate, current, and complete.
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-4">3.2 Account Security</h3>
            <p className="text-muted-foreground mb-4">
              You are responsible for maintaining the confidentiality of your account credentials
              and for all activities that occur under your account. You agree to notify us immediately
              of any unauthorized use of your account.
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-4">3.3 Account Termination</h3>
            <p className="text-muted-foreground mb-4">
              We reserve the right to suspend or terminate your account if you violate these Terms
              or engage in fraudulent, abusive, or illegal activities.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Acceptable Use</h2>
            <p className="text-muted-foreground mb-4">You agree NOT to:</p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Use the Service for any illegal purpose or in violation of any laws</li>
              <li>Attempt to gain unauthorized access to any part of the Service</li>
              <li>Interfere with or disrupt the Service or servers/networks connected to it</li>
              <li>Upload viruses, malware, or other malicious code</li>
              <li>Scrape, crawl, or use automated tools to extract data without permission</li>
              <li>Reverse engineer, decompile, or disassemble any part of the Service</li>
              <li>Resell or redistribute the Service without our written consent</li>
              <li>Impersonate any person or entity or misrepresent your affiliation</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Subscription and Payment</h2>
            
            <h3 className="text-xl font-semibold mb-3 mt-4">5.1 Fees</h3>
            <p className="text-muted-foreground mb-4">
              Certain features of the Service require a paid subscription. You agree to pay all
              fees associated with your selected plan. All fees are non-refundable except as
              required by law or expressly stated in these Terms.
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-4">5.2 Billing</h3>
            <p className="text-muted-foreground mb-4">
              Subscription fees are billed in advance on a monthly or annual basis. Your subscription
              will automatically renew unless you cancel before the renewal date. We reserve the
              right to change our pricing with 30 days' notice.
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-4">5.3 Free Trial</h3>
            <p className="text-muted-foreground mb-4">
              We may offer a free trial period. At the end of the trial, your subscription will
              automatically convert to a paid plan unless you cancel. We reserve the right to
              modify or cancel free trial offers at any time.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Intellectual Property</h2>
            
            <h3 className="text-xl font-semibold mb-3 mt-4">6.1 Our IP</h3>
            <p className="text-muted-foreground mb-4">
              The Service, including all content, features, and functionality, is owned by Accute
              and is protected by copyright, trademark, and other intellectual property laws.
              You may not copy, modify, distribute, or create derivative works without our permission.
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-4">6.2 Your Content</h3>
            <p className="text-muted-foreground mb-4">
              You retain all rights to the data and content you upload to the Service ("Your Content").
              By uploading Your Content, you grant us a limited license to store, process, and display
              it solely to provide the Service. We will not use Your Content to train AI models or
              for any other purpose without your explicit consent.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Data Privacy and Security</h2>
            <p className="text-muted-foreground mb-4">
              We take data privacy and security seriously. Our collection, use, and protection of
              your data is governed by our Privacy Policy, which is incorporated into these Terms
              by reference. You are responsible for ensuring that any data you upload complies with
              applicable privacy laws.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Warranties and Disclaimers</h2>
            
            <h3 className="text-xl font-semibold mb-3 mt-4">8.1 Service Availability</h3>
            <p className="text-muted-foreground mb-4">
              We strive to maintain 99.9% uptime but do not guarantee uninterrupted or error-free
              operation. We are not liable for downtime, data loss, or other issues resulting from
              force majeure events, third-party services, or factors outside our control.
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-4">8.2 AI Accuracy</h3>
            <p className="text-muted-foreground mb-4">
              Our AI agents are designed to assist with accounting tasks but may not always be
              accurate. You are responsible for reviewing all AI-generated outputs and ensuring
              compliance with professional standards. We are not liable for errors or omissions
              in AI-generated content.
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-4">8.3 Disclaimer</h3>
            <p className="text-muted-foreground mb-4">
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND,
              EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY,
              FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Limitation of Liability</h2>
            <p className="text-muted-foreground mb-4">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, ACCUTE SHALL NOT BE LIABLE FOR ANY INDIRECT,
              INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR
              REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL,
              OR OTHER INTANGIBLE LOSSES, RESULTING FROM:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Your use or inability to use the Service</li>
              <li>Any unauthorized access to or use of our servers and/or any personal information stored therein</li>
              <li>Any bugs, viruses, or other harmful code transmitted through the Service</li>
              <li>Any errors or omissions in any content or for any loss or damage incurred as a result of the use of any content</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              IN NO EVENT SHALL OUR TOTAL LIABILITY EXCEED THE AMOUNT YOU PAID US IN THE 12 MONTHS
              PRECEDING THE CLAIM.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. Indemnification</h2>
            <p className="text-muted-foreground mb-4">
              You agree to indemnify, defend, and hold harmless Accute and its officers, directors,
              employees, and agents from any claims, losses, damages, liabilities, and expenses
              (including legal fees) arising from your use of the Service, violation of these Terms,
              or infringement of any third-party rights.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">11. Governing Law</h2>
            <p className="text-muted-foreground mb-4">
              These Terms shall be governed by and construed in accordance with the laws of the
              State of California, without regard to its conflict of law principles. Any disputes
              shall be resolved in the state or federal courts located in San Francisco County,
              California.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">12. Changes to Terms</h2>
            <p className="text-muted-foreground mb-4">
              We reserve the right to modify these Terms at any time. We will notify you of material
              changes by posting the updated Terms on this page and updating the "Last updated" date.
              Your continued use of the Service after changes constitutes acceptance of the new Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">13. Contact Information</h2>
            <p className="text-muted-foreground mb-4">
              If you have any questions about these Terms, please contact us:
            </p>
            <ul className="list-none space-y-2 text-muted-foreground">
              <li>Email: legal@accute.ai</li>
              <li>Mail: Accute, 123 Innovation Drive, San Francisco, CA 94105</li>
            </ul>
          </section>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t py-12 bg-muted/30 mt-16">
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
