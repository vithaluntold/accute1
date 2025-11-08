import { ContextualNudge, useOnboardingNudge } from "./ContextualNudge";
import { useLocation } from "wouter";

/**
 * Example nudges for different pages and user scenarios
 * These demonstrate the contextual nudge system in action
 */

// Client List Page Nudges
export function ClientListNudges() {
  const { shouldShowNudge } = useOnboardingNudge('clients');
  
  return (
    <>
      {/* Day 1-3: First client creation nudge */}
      {shouldShowNudge({ minDay: 1, maxDay: 3, excludeIfCompleted: 'add-first-client' }) && (
        <ContextualNudge
          nudgeId="clients-first-add"
          type="banner"
          trigger="page_visit"
          title="Add Your First Client"
          description="Start by adding a client to see how Accute manages client relationships, documents, and workflows."
          actionLabel="Add Client"
          actionUrl="/clients/new"
          dismissible={true}
          showOnce={true}
          data-testid="nudge-add-first-client"
        />
      )}
      
      {/* Day 4-7: Import clients nudge */}
      {shouldShowNudge({ minDay: 4, maxDay: 7, requiredTask: 'add-first-client' }) && (
        <ContextualNudge
          nudgeId="clients-bulk-import"
          type="banner"
          trigger="page_visit"
          title="💡 Pro Tip: Bulk Import Clients"
          description="Save time by importing multiple clients at once from a CSV file. You can include contact details, tags, and custom fields."
          actionLabel="Learn How"
          dismissible={true}
          showOnce={true}
          delayMs={2000}
          data-testid="nudge-bulk-import-clients"
        />
      )}
    </>
  );
}

// Invoice Page Nudges
export function InvoiceNudges() {
  const { shouldShowNudge } = useOnboardingNudge('invoices');
  
  return (
    <>
      {/* Day 5-10: First invoice creation */}
      {shouldShowNudge({ minDay: 5, maxDay: 10, excludeIfCompleted: 'create-first-invoice' }) && (
        <ContextualNudge
          nudgeId="invoice-first-create"
          type="banner"
          trigger="page_visit"
          title="Create Your First Invoice"
          description="Accute automates invoice generation with AI-powered line item suggestions, payment tracking, and automated reminders."
          actionLabel="Create Invoice"
          actionUrl="/invoices/new"
          dismissible={true}
          showOnce={true}
          data-testid="nudge-create-first-invoice"
        />
      )}
      
      {/* Day 8-14: Payment gateway setup */}
      {shouldShowNudge({ minDay: 8, maxDay: 14, requiredTask: 'create-first-invoice' }) && (
        <ContextualNudge
          nudgeId="invoice-payment-gateway"
          type="banner"
          trigger="page_visit"
          title="🚀 Accept Online Payments"
          description="Connect Stripe, Razorpay, or PayU to accept payments directly through invoices. Track payment status in real-time."
          actionLabel="Setup Payments"
          actionUrl="/settings/payments"
          dismissible={true}
          showOnce={true}
          data-testid="nudge-setup-payments"
        />
      )}
    </>
  );
}

// AI Agents Page Nudges
export function AIAgentsNudges() {
  const { shouldShowNudge } = useOnboardingNudge('ai-agents');
  
  return (
    <>
      {/* Day 3-7: Try first AI agent */}
      {shouldShowNudge({ minDay: 3, maxDay: 7, excludeIfCompleted: 'chat-with-ai-agent' }) && (
        <ContextualNudge
          nudgeId="agents-try-luca"
          type="banner"
          trigger="page_visit"
          title="Meet Luca, Your AI Advisory Assistant"
          description="Luca helps with tax planning, financial analysis, and strategic advice. Try asking a question to see AI-powered accounting in action."
          actionLabel="Chat with Luca"
          actionUrl="/agents/luca"
          dismissible={true}
          showOnce={true}
          data-testid="nudge-try-luca-agent"
        />
      )}
      
      {/* Day 8-14: Explore agent marketplace */}
      {shouldShowNudge({ minDay: 8, maxDay: 14, requiredTask: 'chat-with-ai-agent' }) && (
        <ContextualNudge
          nudgeId="agents-marketplace"
          type="banner"
          trigger="page_visit"
          title="Discover More AI Agents"
          description="Browse 100+ specialized agents in our marketplace. From audit automation to tax compliance, there's an agent for every task."
          actionLabel="Explore Marketplace"
          actionUrl="/marketplace?filter=agents"
          dismissible={true}
          showOnce={true}
          delayMs={3000}
          data-testid="nudge-agent-marketplace"
        />
      )}
    </>
  );
}

// Documents Page Nudges
export function DocumentsNudges() {
  const { shouldShowNudge } = useOnboardingNudge('documents');
  
  return (
    <>
      {/* Day 2-5: Upload first document */}
      {shouldShowNudge({ minDay: 2, maxDay: 5, excludeIfCompleted: 'upload-first-document' }) && (
        <ContextualNudge
          nudgeId="documents-first-upload"
          type="banner"
          trigger="page_visit"
          title="Upload Your First Document"
          description="Accute provides secure document storage with e-signatures, AI-powered classification, and automatic client organization."
          actionLabel="Upload Document"
          dismissible={true}
          showOnce={true}
          data-testid="nudge-upload-first-document"
        />
      )}
      
      {/* Day 7-14: Folder organization tip */}
      {shouldShowNudge({ minDay: 7, maxDay: 14, requiredTask: 'upload-first-document' }) && (
        <ContextualNudge
          nudgeId="documents-folders"
          type="banner"
          trigger="page_visit"
          title="💡 Organize with Smart Folders"
          description="Create hierarchical folder structures and apply AI-powered auto-classification rules to keep documents organized automatically."
          actionLabel="Setup Folders"
          actionUrl="/documents/folders"
          dismissible={true}
          showOnce={true}
          delayMs={2000}
          data-testid="nudge-organize-folders"
        />
      )}
    </>
  );
}

// Workflows Page Nudges
export function WorkflowsNudges() {
  const { shouldShowNudge } = useOnboardingNudge('workflows');
  
  return (
    <>
      {/* Day 6-12: Create first workflow */}
      {shouldShowNudge({ minDay: 6, maxDay: 12, excludeIfCompleted: 'create-first-workflow' }) && (
        <ContextualNudge
          nudgeId="workflows-first-create"
          type="banner"
          trigger="page_visit"
          title="Automate with Your First Workflow"
          description="Workflows automate repetitive tasks like client onboarding, tax prep, and audit processes. Build visually with our drag-and-drop editor."
          actionLabel="Create Workflow"
          actionUrl="/workflows/builder"
          dismissible={true}
          showOnce={true}
          data-testid="nudge-create-first-workflow"
        />
      )}
      
      {/* Day 10-16: Use workflow templates */}
      {shouldShowNudge({ minDay: 10, maxDay: 16, requiredTask: 'create-first-workflow' }) && (
        <ContextualNudge
          nudgeId="workflows-templates"
          type="banner"
          trigger="page_visit"
          title="🚀 Save Time with Workflow Templates"
          description="Browse 50+ pre-built workflow templates for common accounting tasks. Customize them to match your firm's process."
          actionLabel="Browse Templates"
          actionUrl="/marketplace?filter=workflows"
          dismissible={true}
          showOnce={true}
          delayMs={3000}
          data-testid="nudge-workflow-templates"
        />
      )}
    </>
  );
}

// Dashboard Nudges (idle time trigger)
export function DashboardNudges() {
  const { shouldShowNudge, onboardingProgress } = useOnboardingNudge('dashboard');
  
  return (
    <>
      {/* Day 1-3: Complete profile nudge (appears after 30s idle) */}
      {shouldShowNudge({ minDay: 1, maxDay: 3, excludeIfCompleted: 'complete-profile' }) && (
        <ContextualNudge
          nudgeId="dashboard-complete-profile"
          type="banner"
          trigger="idle_time"
          title="Complete Your Profile"
          description="Add your firm details, logo, and regional settings to personalize Accute for your practice."
          actionLabel="Update Profile"
          actionUrl="/settings/profile"
          dismissible={true}
          showOnce={true}
          delayMs={30000}
          data-testid="nudge-complete-profile"
        />
      )}
      
      {/* Day 5+: Check onboarding progress (appears after 60s idle) */}
      {shouldShowNudge({ minDay: 5 }) && onboardingProgress && onboardingProgress.currentDay < 21 && (
        <ContextualNudge
          nudgeId="dashboard-check-progress"
          type="banner"
          trigger="idle_time"
          title={`Day ${onboardingProgress.currentDay} of 21 Journey`}
          description={`You've earned ${onboardingProgress.totalScore} points! Complete today's tasks to maintain your ${onboardingProgress.currentStreak}-day streak.`}
          actionLabel="View Tasks"
          actionUrl="/onboarding"
          dismissible={true}
          showOnce={false}
          delayMs={60000}
          data-testid="nudge-onboarding-progress"
        />
      )}
    </>
  );
}
