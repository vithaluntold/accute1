# Accute - Team Collaboration E2E Test Scenarios

## Real-World Scenarios Testing Multi-User Workflows

These scenarios simulate actual accounting firm workflows with multiple users collaborating in real-time. Each scenario involves coordination between different user roles working together on shared objectives.

---

## Scenario 1: Complete Tax Preparation Workflow
**Duration**: 30-45 minutes  
**Users**: Admin, Employee, Client  
**Objective**: Test complete tax preparation process from client intake to filing

### Participants Setup
- **Admin** (admin@sterling.com): Tax Partner, creates workflow
- **Employee** (employee@sterling.com): Tax Preparer, executes work
- **Client** (david@technova.com): Business owner, provides documents

### Step-by-Step Workflow

#### Phase 1: Workflow Setup (Admin)
1. Login as Admin
2. Navigate to /workflow-builder/new
3. Create "Corporate Tax Return 2024" workflow:
   
   **Stage 1: Client Intake**
   - Step: Request Tax Organizer
     - Action: send_email to client
     - Action: request_documents ["W2", "1099", "Receipts"]
   
   **Stage 2: Document Review**
   - Step: Verify Documents
     - Assign to: Employee
     - Checklist: ["Check W2 accuracy", "Verify 1099 amounts", "Review receipts"]
   - Step: Request Missing Items
     - Conditional: IF documents incomplete THEN send_email to client
   
   **Stage 3: Preparation**
   - Step: Prepare Tax Return
     - Assign to: Employee
     - Time estimate: 4 hours
   - Step: Partner Review
     - Assign to: Admin
     - Action: run_ai_agent (Parity - compliance check)
   
   **Stage 4: Client Approval**
   - Step: Send for Client Review
     - Action: send_email with preview
   - Step: Obtain Signature
     - Action: Digital signature request
   
   **Stage 5: Filing**
   - Step: E-File Return
     - Assign to: Employee
   - Step: Send Confirmation
     - Action: send_email to client

4. Save workflow as template
5. Assign to client: david@technova.com
6. Set due date: 15 days from now
7. Verify assignment email sent to client

#### Phase 2: Client Document Upload (Client)
1. Logout Admin, Login as Client
2. Check email for workflow assignment notification
3. Navigate to /client-portal/tasks
4. Find task: "Upload Tax Documents"
5. Click task to view requirements
6. Upload documents:
   - W2: W2_TechNova_2024.pdf
   - 1099: 1099_Contractors_2024.pdf
   - Receipts: Business_Receipts_2024.xlsx
7. Fill tax organizer form:
   - Business information
   - Income details
   - Deduction information
   - Dependents
8. Submit form and documents
9. Verify submission confirmation
10. Check task status changes to "Submitted"
11. Verify email confirmation received

#### Phase 3: Document Review (Employee)
1. Logout Client, Login as Employee
2. Check notifications for new assignment
3. Navigate to /assignments
4. Find assignment: "Corporate Tax Return 2024 - TechNova"
5. Click assignment to open
6. Navigate to "Document Review" stage
7. Download client documents:
   - Review W2 for accuracy
   - Verify 1099 amounts
   - Check receipts against organizer
8. Find issue: Missing depreciation schedule
9. Add comment with @mention:
   - "@admin@sterling.com Client is missing depreciation schedule for equipment"
10. Navigate to /team-chat
11. Send message: "Need clarification on TechNova deductions"
12. Wait for Admin response (or simulate)

#### Phase 4: Request Additional Documents (Admin)
1. Logout Employee, Login as Admin
2. Check notification for @mention from Employee
3. Click notification to jump to assignment
4. Review employee's comment
5. Reply to comment: "Good catch, I'll request from client"
6. Navigate to assignment actions
7. Click "Request Additional Documents"
8. Add document request:
   - Document: "Equipment Depreciation Schedule"
   - Instructions: "Please provide depreciation details for all business equipment"
9. Send request to client
10. Verify client receives email notification

#### Phase 5: Client Provides Additional Documents (Client)
1. Logout Admin, Login as Client
2. Check email for document request
3. Navigate to /client-portal/documents
4. See new document request
5. Upload: Depreciation_Schedule_2024.xlsx
6. Add note: "All equipment purchases included"
7. Submit document
8. Verify employee notified of new upload

#### Phase 6: Tax Preparation (Employee)
1. Logout Client, Login as Employee
2. Check notification for new document upload
3. Navigate back to assignment
4. Download depreciation schedule
5. Navigate to "Preparation" stage
6. Start time tracking:
   - Task: "Prepare Tax Return"
   - Start timer
7. Work on tax return (simulate):
   - Review all documents
   - Calculate deductions
   - Prepare forms
8. After 5 minutes, stop timer (simulating work)
9. Upload completed draft: "TechNova_Tax_Return_Draft.pdf"
10. Add note: "Ready for partner review"
11. Mark task complete
12. Verify workflow auto-advances to "Partner Review"
13. Verify Admin receives notification

#### Phase 7: Partner Review & AI Compliance Check (Admin)
1. Logout Employee, Login as Admin
2. Check notification for partner review
3. Navigate to assignment
4. Navigate to "Partner Review" stage
5. Download tax return draft
6. Trigger AI agent:
   - Select "Parity" agent (compliance check)
   - Run compliance analysis
   - Wait for AI results
7. Review Parity agent output:
   - Check for compliance flags
   - Review risk assessment
   - Verify calculations
8. Find minor issue: "Consider R&D tax credit eligibility"
9. Add comment to employee:
   - "@employee@sterling.com Please research R&D credit for software development costs"
10. Mark review task as "Needs Revision"
11. Verify Employee notified

#### Phase 8: Employee Revisions (Employee)
1. Logout Admin, Login as Employee
2. Check notification for revision request
3. Navigate to assignment
4. Read Admin's comment about R&D credit
5. Research R&D credit eligibility
6. Calculate R&D credit: $15,000
7. Update tax return with R&D credit
8. Upload revised draft: "TechNova_Tax_Return_Final.pdf"
9. Reply to Admin's comment:
   - "R&D credit added - $15k for software development. Total refund increased to $28k"
10. Mark revision complete
11. Verify Admin notified

#### Phase 9: Final Approval & Client Signature (Admin)
1. Logout Employee, Login as Admin
2. Review revised tax return
3. Approve final version
4. Navigate to "Client Approval" stage
5. Send tax return to client for review:
   - Attach: TechNova_Tax_Return_Final.pdf
   - Message: "Your 2024 tax return is ready for review. Total refund: $28,000"
6. Create digital signature request:
   - Document: Tax Return 2024
   - Signature fields: ["Taxpayer Signature", "Date"]
   - Send to: david@technova.com
7. Verify client receives email notification

#### Phase 10: Client Review & Signature (Client)
1. Logout Admin, Login as Client
2. Check email for signature request
3. Navigate to /client-portal/signatures
4. Find document: "Tax Return 2024"
5. Click "Review and Sign"
6. Read tax return summary:
   - Total income: $250,000
   - Total deductions: $85,000
   - R&D credit: $15,000
   - Refund: $28,000
7. Scroll to signature section
8. Sign electronically
9. Submit signature
10. Verify signing confirmation
11. Download signed copy
12. Verify workflow advances to "Filing" stage

#### Phase 11: E-Filing (Employee)
1. Logout Client, Login as Employee
2. Navigate to assignment
3. Navigate to "Filing" stage
4. Download signed tax return
5. Simulate e-filing:
   - Upload to IRS system (simulated)
   - Mark as "E-Filed"
   - Add filing confirmation number: "2024-123456789"
6. Mark filing task complete
7. Verify workflow advances to final stage

#### Phase 12: Completion & Analytics (Admin)
1. Logout Employee, Login as Admin
2. Navigate to assignment
3. Verify all stages complete
4. Mark workflow as "Complete"
5. Navigate to /analytics
6. View workflow metrics:
   - Total time spent (from time tracking)
   - Stages completed
   - Documents exchanged
   - Team collaboration events
7. Generate completion report:
   - Export to PDF
   - Send to client
8. Navigate to /invoices
9. Create invoice for tax preparation:
   - Client: TechNova Solutions
   - Service: Tax Preparation
   - Amount: $2,500 (based on time tracked)
10. Send invoice to client
11. Verify client receives invoice

### Expected Results
✅ Complete workflow executed across all user types  
✅ Document requests and uploads work end-to-end  
✅ @mentions trigger notifications correctly  
✅ Team chat facilitates collaboration  
✅ AI agent (Parity) provides compliance insights  
✅ Revision workflow operates smoothly  
✅ Digital signatures captured securely  
✅ Time tracking records accurately  
✅ Workflow auto-advances at each stage  
✅ Analytics capture complete workflow metrics  
✅ Invoice generation based on completed work  

### Success Metrics
- Workflow completion time: < 15 days
- Number of collaborations: 10+ interactions
- Document exchanges: 8+ documents
- Notifications sent: 15+ notifications
- Time tracked: Accurate to actual work
- Client satisfaction: Signature obtained

---

## Scenario 2: Urgent Audit Response with Team Escalation
**Duration**: 20-30 minutes  
**Users**: Admin, Employee, Client  
**Objective**: Test high-priority workflow with escalation and real-time collaboration

### Scenario Setup
Client receives IRS audit notice. Firm must respond within 48 hours with supporting documentation.

### Phase 1: Urgent Task Creation (Admin)
1. Login as Admin
2. Receive email from client about IRS audit
3. Navigate to /workflows
4. Create URGENT workflow: "IRS Audit Response - TechNova"
5. Set priority: HIGH
6. Set due date: 48 hours from now
7. Add stages:
   - "Document Gathering" (Client)
   - "Document Review" (Employee - 4 hour deadline)
   - "Response Preparation" (Employee)
   - "Partner Review" (Admin - 2 hour deadline)
   - "Submission" (Admin)
8. Add auto-escalation rule:
   - IF task overdue by 2 hours THEN notify Admin
9. Assign to Employee
10. Notify client via Email + SMS
11. Start workflow

### Phase 2: Concurrent Document Gathering (Client + Employee)
**Client Actions:**
1. Login as Client
2. See URGENT notification
3. Navigate to /client-portal/tasks
4. See countdown timer: "46 hours remaining"
5. Upload requested documents rapidly:
   - Bank statements (6 files)
   - Invoice records (3 files)
   - Expense reports (4 files)
6. Mark each upload complete
7. See progress: 13/13 documents uploaded

**Employee Actions (Simultaneous):**
1. Login as Employee (different browser/session)
2. See URGENT notification
3. Navigate to /assignments
4. Open audit response assignment
5. See real-time updates as client uploads documents
6. Download documents as they arrive:
   - Start reviewing bank statements immediately
   - Don't wait for all uploads
7. Create checklist in real-time:
   - [x] Bank statements Jan-Mar
   - [x] Bank statements Apr-Jun
   - [ ] Bank statements Jul-Sep (still uploading)
8. Open /team-chat
9. Create "IRS Audit - TechNova" channel
10. @mention Admin: "@admin@sterling.com Audit docs coming in, reviewing now"

### Phase 3: Real-Time Document Review with Live Chat
**Employee Actions:**
1. Continue reviewing documents
2. Find discrepancy in June bank statement
3. Navigate to document annotation
4. Highlight discrepancy
5. @mention client in annotation: "@david@technova.com Please explain $5k transfer on 6/15"
6. Open live chat with client
7. Start chat conversation

**Client Actions:**
1. Receive @mention notification
2. Click to jump to annotation
3. Read employee's question
4. Reply in annotation: "That's lease payment for new office"
5. See live chat invitation
6. Join chat
7. Provide additional context in real-time:
   - "We moved offices in June"
   - "Here's the lease agreement"
8. Upload lease agreement during chat
9. Continue conversation until clarified

**Employee Actions:**
1. See client's explanation in annotation
2. Continue chat conversation
3. Ask follow-up: "Do you have moving expense receipts?"
4. Receive lease agreement upload notification
5. Download and review lease
6. Client uploads moving receipts in chat
7. Verify all documentation satisfactory
8. End chat session
9. Mark document review complete: "All docs verified, discrepancy resolved"

### Phase 4: Response Preparation with AI Agent
1. Employee navigates to "Response Preparation" stage
2. Trigger "Scribe" AI agent:
   - Agent: Scribe (document generation)
   - Template: IRS Audit Response Letter
   - Context: TechNova audit case
3. Scribe generates draft response:
   - Addresses audit concerns
   - References supporting documents
   - Professional formatting
4. Employee reviews AI-generated draft
5. Makes minor edits for accuracy
6. Adds document attachments reference
7. Exports as PDF: "IRS_Audit_Response_TechNova.pdf"
8. Uploads to assignment
9. @mention Admin for review: "@admin@sterling.com Response ready for partner approval - 24 hours before deadline"
10. Mark task complete

### Phase 5: Partner Review Under Time Pressure
1. Admin receives notification with 24 hours remaining
2. Navigate to assignment
3. See countdown timer: "23 hours 45 minutes"
4. Download response letter
5. Review thoroughly:
   - Check all facts accurate
   - Verify document references
   - Ensure professional tone
6. Find one issue: Missing signature on bank reconciliation
7. Navigate to /signatures
8. Create urgent signature request:
   - Document: Bank Reconciliation June 2024
   - Send to: Client
   - Mark as URGENT
   - Deadline: 6 hours
9. Send signature request
10. Add note in assignment: "Waiting on client signature for bank rec"

### Phase 6: Urgent Signature Collection
**Client Actions:**
1. Receive URGENT signature request (Email + SMS + in-app)
2. Login immediately
3. Navigate to /client-portal/signatures
4. See URGENT badge with countdown: "5 hours 58 minutes"
5. Review bank reconciliation
6. Sign electronically
7. Submit signature
8. Verify confirmation

**Admin Actions:**
1. Receive signature completion notification
2. Download signed bank reconciliation
3. Add to response package
4. Final review of complete package:
   - Response letter ✓
   - Supporting documents (13) ✓
   - Signed bank reconciliation ✓
5. Approve response
6. Mark "Partner Review" complete

### Phase 7: Submission & Tracking
1. Admin navigates to "Submission" stage
2. Prepare final submission package:
   - Combine all documents into single PDF
   - Add cover letter
   - Create submission checklist
3. Submit to IRS (simulated):
   - Upload to IRS portal
   - Get confirmation number: IRS-2024-AUDIT-789456
4. Mark submission complete with confirmation number
5. Navigate to /team-chat
6. Announce to team: "IRS audit response submitted successfully - 18 hours before deadline!"
7. Send completion notification to client
8. Create follow-up task:
   - "Monitor IRS response"
   - Assign to: Employee
   - Due: 30 days

### Phase 8: Post-Completion Analytics & Debrief
1. Navigate to /analytics
2. View workflow completion metrics:
   - Total time: 30 hours (18 hours ahead of deadline)
   - Team collaboration events: 25+
   - Documents exchanged: 16
   - @mentions: 8
   - Chat messages: 15
   - Time tracked by employee: 6.5 hours
3. Generate timeline visualization:
   - See all events chronologically
   - Identify bottlenecks (if any)
   - Note high-intensity collaboration periods
4. Create invoice:
   - Rush service premium: 50% markup
   - Base fee: $1,500
   - Rush premium: $750
   - Total: $2,250
5. Send invoice to client with completion report
6. Archive workflow for future reference
7. Extract as template: "IRS Audit Response Template"

### Expected Results
✅ Urgent workflow creates sense of urgency (countdown timers)  
✅ Real-time collaboration via chat and @mentions  
✅ Document uploads trigger immediate notifications  
✅ Live chat enables rapid clarification  
✅ AI agent (Scribe) accelerates response preparation  
✅ Urgent signature request handled quickly  
✅ Escalation rules ready to trigger (if needed)  
✅ Complete audit trail for compliance  
✅ Analytics capture time-sensitive metrics  
✅ Template extraction for future use  

### Success Metrics
- Response submitted: 18+ hours before deadline
- Team response time: < 2 hours per action
- Client engagement: Real-time during critical periods
- Document turnaround: < 4 hours for all uploads
- Collaboration events: 25+ interactions
- Zero escalations triggered (everything on time)

---

## Scenario 3: Service Marketplace Purchase & Delivery
**Duration**: 25-35 minutes  
**Users**: Admin (Service Provider), Client (Service Buyer), Employee (Service Deliverer)  
**Objective**: Test Fiverr-style service marketplace end-to-end

### Phase 1: Service Creation (Admin)
1. Login as Admin
2. Navigate to /marketplace (or service plans section)
3. Click "Create Service Offering"
4. Fill service details:
   - **Title**: "Monthly Bookkeeping Services"
   - **Category**: Bookkeeping
   - **Description**: "Complete monthly bookkeeping for small businesses"
   
   **Pricing Tiers:**
   - **Basic** ($299/month):
     - Up to 50 transactions
     - Monthly financial statements
     - Bank reconciliation
     - 1 revision
     - 5-day delivery
   
   - **Standard** ($499/month):
     - Up to 150 transactions
     - Monthly financial statements
     - Bank + credit card reconciliation
     - Accounts payable/receivable
     - 2 revisions
     - 3-day delivery
   
   - **Premium** ($799/month):
     - Unlimited transactions
     - Weekly financial reports
     - Full reconciliation
     - AP/AR management
     - Budgeting & forecasting
     - Unlimited revisions
     - 24-hour delivery
   
   **Deliverables:**
   - [ ] Reconciled bank statements
   - [ ] Profit & Loss statement
   - [ ] Balance sheet
   - [ ] Cash flow statement
   - [ ] Transaction categorization report

   **Requirements from Client:**
   - Bank statements (PDF)
   - Credit card statements (PDF)
   - Receipts/invoices (organized by month)
   - Chart of accounts preferences

5. Add service to marketplace
6. Set service as "Published"
7. Verify service appears in marketplace

### Phase 2: Service Discovery & Purchase (Client)
1. Logout Admin, Login as Client
2. Navigate to /marketplace
3. Browse available services
4. Filter by category: "Bookkeeping"
5. Find "Monthly Bookkeeping Services"
6. Click to view service details
7. Review pricing tiers
8. Compare tier features
9. Read service description and requirements
10. Check provider rating and reviews
11. Select tier: "Standard" ($499/month)
12. Click "Purchase Service"
13. Fill order form:
    - Business name: TechNova Solutions
    - Number of monthly transactions: ~120
    - Preferred delivery date: End of current month
    - Special instructions: "Focus on expense categorization"
14. Review order summary:
    - Service: Monthly Bookkeeping - Standard
    - Price: $499
    - Delivery: 3 days
    - Revisions: 2 included
15. Proceed to payment
16. Select payment method:
    - Use saved payment method OR
    - Enter new credit card (test mode)
17. Confirm payment
18. Verify order confirmation:
    - Order number generated
    - Email confirmation sent
    - Invoice auto-generated
19. Navigate to "My Orders"
20. See new order with status: "In Progress"

### Phase 3: Service Assignment & Setup (Admin)
1. Logout Client, Login as Admin
2. Receive notification: "New service purchase - $499"
3. Navigate to service orders dashboard
4. Find order: "Monthly Bookkeeping - TechNova Solutions"
5. Review order details and client requirements
6. Assign service delivery to Employee:
   - Assign to: employee@sterling.com
   - Due date: 3 days from now (per Standard tier)
   - Add note: "Client needs expense categorization focus"
7. Create project workspace:
   - Create folder: "TechNova - Monthly Bookkeeping Dec 2024"
   - Set up task checklist from deliverables
   - Add client requirements
8. Notify employee of assignment
9. Send message to client:
   - "Your bookkeeping service has been assigned to our team. Please upload required documents to get started."

### Phase 4: Client Provides Requirements (Client)
1. Login as Client
2. Receive message about document upload
3. Navigate to "My Orders"
4. Click on bookkeeping service order
5. See "Upload Requirements" section
6. Upload documents:
   - Bank_Statement_Dec_2024.pdf
   - CreditCard_Statement_Dec_2024.pdf
   - Receipts_Dec_2024.zip (contains 45 receipts)
   - Chart_of_Accounts_Preferences.xlsx
7. Add note: "Receipts are organized by week. Please categorize technology expenses separately."
8. Mark requirements as "Submitted"
9. Verify employee receives notification

### Phase 5: Service Delivery (Employee)
1. Logout Client, Login as Employee
2. Receive notification: "Service delivery assignment - Due in 3 days"
3. Navigate to /assignments
4. Find: "Monthly Bookkeeping - TechNova Solutions"
5. Download all client documents
6. Start time tracking:
   - Task: "Bookkeeping - TechNova Dec 2024"
   - Start timer
7. Begin work (simulate):
   
   **Day 1 - Transaction Entry & Categorization:**
   - Import bank transactions (120 transactions)
   - Categorize expenses by type:
     - Technology: $8,500
     - Office expenses: $1,200
     - Professional services: $3,400
     - Payroll: $45,000
     - Other: $2,100
   - Reconcile bank statement
   - Progress: 40% complete
   - Stop timer (2 hours tracked)
   
   **Day 2 - Credit Card Reconciliation:**
   - Start timer
   - Import credit card transactions (68 transactions)
   - Match receipts to transactions
   - Categorize credit card expenses
   - Reconcile credit card statement
   - Progress: 70% complete
   - Stop timer (1.5 hours tracked)
   
   **Day 3 - Financial Statements:**
   - Start timer
   - Generate Profit & Loss statement
   - Generate Balance sheet
   - Generate Cash flow statement
   - Create transaction categorization report
   - Review for accuracy
   - Progress: 95% complete
   - Stop timer (1 hour tracked)

8. Prepare deliverables:
   - Export: Reconciled_Bank_Statement_Dec_2024.pdf
   - Export: Reconciled_CC_Statement_Dec_2024.pdf
   - Export: ProfitLoss_Dec_2024.pdf
   - Export: BalanceSheet_Dec_2024.pdf
   - Export: CashFlow_Dec_2024.pdf
   - Export: Transaction_Categorization_Report.pdf

9. Upload deliverables to service order:
   - Navigate to deliverables section
   - Upload all 6 files
   - Check off each deliverable:
     - [x] Reconciled bank statements
     - [x] Profit & Loss statement
     - [x] Balance sheet
     - [x] Cash flow statement
     - [x] Transaction categorization report

10. Add delivery note:
    - "All December 2024 bookkeeping complete. Technology expenses totaled $8,500 as requested. All transactions categorized and reconciled. Please review and let me know if any revisions needed."

11. Mark service as "Delivered"
12. Stop final timer
13. Total time tracked: 4.5 hours
14. Notify client of completion

### Phase 6: Client Review & Feedback (Client)
1. Login as Client
2. Receive notification: "Bookkeeping service delivered"
3. Navigate to "My Orders"
4. Click on bookkeeping service
5. See status: "Delivered - Awaiting Review"
6. Download all deliverables:
   - Review P&L statement
   - Review balance sheet
   - Review cash flow
   - Review transaction categorization
7. Find minor issue: One expense miscategorized
   - Software subscription ($299) marked as "Office Expense"
   - Should be "Technology"
8. Request revision:
   - Click "Request Revision" (1 of 2 revisions available)
   - Describe issue: "Please recategorize Zoom subscription ($299) from Office Expense to Technology"
   - Submit revision request
9. Verify employee receives notification

### Phase 7: Revision Handling (Employee)
1. Login as Employee
2. Receive notification: "Revision requested"
3. Navigate to service order
4. Read revision request
5. Make correction:
   - Find Zoom subscription transaction
   - Recategorize from "Office Expense" to "Technology"
   - Update reports:
     - Technology expenses: $8,500 → $8,799
     - Office expenses: $1,200 → $901
6. Regenerate affected deliverables:
   - Updated P&L statement
   - Updated transaction categorization report
7. Upload revised deliverables
8. Add note: "Zoom subscription recategorized to Technology. Technology total now $8,799."
9. Mark revision as "Complete"
10. Notify client

### Phase 8: Final Approval & Review (Client)
1. Login as Client
2. Receive revision completion notification
3. Download revised deliverables
4. Verify correction made:
   - Technology expenses now $8,799 ✓
   - Office expenses now $901 ✓
5. Approve deliverables:
   - Mark as "Accepted"
   - Release payment (already paid, mark service complete)
6. Leave review:
   - Rating: 5 stars ⭐⭐⭐⭐⭐
   - Review: "Excellent service! Quick turnaround, accurate work, and responsive to revision requests. The expense categorization was exactly what we needed. Highly recommend!"
7. Submit review
8. Verify review appears on service listing
9. Order status changes to "Completed"

### Phase 9: Service Provider Analytics (Admin)
1. Login as Admin
2. Navigate to service dashboard
3. View service metrics:
   - Total orders: 1
   - Revenue: $499
   - Average rating: 5.0 stars
   - Completion rate: 100%
   - Average delivery time: 2.8 days (ahead of 3-day promise)
4. View employee performance:
   - Time tracked: 4.5 hours
   - Effective hourly rate: $110/hour ($499 / 4.5 hours)
   - Revision rate: 1 revision (low, good)
   - Client satisfaction: 5 stars
5. Generate profitability report:
   - Revenue: $499
   - Employee cost: 4.5 hours × $40/hour = $180
   - Gross profit: $319
   - Margin: 64%
6. Set up recurring service:
   - Offer client monthly subscription
   - Same scope, discounted to $449/month
   - Send proposal to client

### Expected Results
✅ Service marketplace browsing works  
✅ Service purchase flow completes  
✅ Payment processing successful  
✅ Order assignment to employee  
✅ Client document upload works  
✅ Service delivery tracked with time  
✅ Deliverables upload successfully  
✅ Revision request system works  
✅ Review and rating system functional  
✅ Analytics capture service metrics  
✅ Profitability calculation accurate  

### Success Metrics
- Purchase to delivery: 3 days (on time)
- Client satisfaction: 5 stars
- Revision rate: 1 revision (within tier limit)
- Employee efficiency: $110/hour effective rate
- Profit margin: 64%
- Repeat business: Recurring subscription proposed

---

## Scenario 4: Multi-Office Client Onboarding with Workflow Automation
**Duration**: 20-30 minutes  
**Users**: Admin (Office A), Employee (Office B), Client  
**Objective**: Test distributed team collaboration with automated workflow routing

### Scenario Context
Sterling Accounting has two offices:
- **Office A** (Chicago): Corporate tax specialization
- **Office B** (New York): Individual tax specialization

New client "Sarah Johnson" needs individual tax prep, should auto-route to Office B.

### Phase 1: Automated Client Intake (Admin - Office A)
1. Login as Admin (Office A manager)
2. Navigate to /clients
3. Click "AI-Powered Client Onboarding"
4. Start conversational onboarding with Luca agent:
   
   **Luca:** "Welcome! I'm Luca, your AI assistant. I'll help onboard your new client. What's the client's name?"
   
   **Admin:** "Sarah Johnson"
   
   **Luca:** "Great! Is Sarah an individual or a business?"
   
   **Admin:** "Individual"
   
   **Luca:** "Perfect. What services does Sarah need?"
   
   **Admin:** "Personal tax preparation"
   
   **Luca:** "I see Sarah needs individual tax prep. Based on our team structure, this should route to Office B (NYC) which specializes in individual taxes. Should I auto-assign to that office?"
   
   **Admin:** "Yes"
   
   **Luca:** "I'll need some basic information. What's Sarah's email?"
   
   **Admin:** "sarah.johnson@email.com"
   
   **Luca:** "Phone number?"
   
   **Admin:** "+1-555-0123"
   
   **Luca:** "What's Sarah's estimated income level? This helps us assign the right complexity level."
   
   **Admin:** "Around $120,000 annually"
   
   **Luca:** "Does Sarah have any of the following? (Select all that apply)"
   - [ ] Investment income
   - [x] Rental property
   - [ ] Self-employment income
   - [ ] Foreign income
   
   **Admin:** Selects "Rental property"
   
   **Luca:** "Based on Sarah's profile (Individual, $120K income, rental property), I recommend:"
   - Service package: Individual Tax Prep - Standard
   - Assigned office: Office B (NYC)
   - Assigned preparer: employee@sterling.com (Office B specialist)
   - Workflow template: Individual Tax Return with Schedule E
   - Estimated fee: $850
   
   "Should I create this client profile and start the workflow?"
   
   **Admin:** "Yes, proceed"

5. Luca creates client profile automatically:
   - Tags: ["individual_tax", "rental_property", "office_b"]
   - Estimated complexity: Medium
   - Assigned to: Office B
   - Workflow: Individual Tax Return with Schedule E
   - Sends welcome email to client

6. Verify client created with proper tags
7. Verify workflow auto-assigned to Office B employee
8. Verify welcome email sent

### Phase 2: Conditional Workflow Auto-Routing
**System Actions (Automated):**
1. Workflow engine detects client tag: "office_b"
2. Applies conditional routing rule:
   ```
   IF client.tags contains "office_b"
   THEN assign_to_office("Office B")
   AND assign_to_user(employee@sterling.com)
   AND apply_folder_template("Office B - Individual Tax")
   ```
3. Creates folder structure:
   - Sarah Johnson/
     - Documents/
     - Tax Returns/
       - 2024/
     - Correspondence/
4. Sends assignment email to employee@sterling.com
5. Creates notification in employee's dashboard

### Phase 3: Employee Accepts Assignment (Employee - Office B)
1. Login as Employee (Office B)
2. Receive notification: "New client auto-assigned: Sarah Johnson"
3. Navigate to /assignments
4. Find assignment: "Individual Tax Return - Sarah Johnson"
5. Review auto-populated client information:
   - Name: Sarah Johnson
   - Income: ~$120K
   - Special situations: Rental property
   - Assigned workflow: Individual Tax Return with Schedule E
6. Accept assignment
7. Review workflow stages:
   - Stage 1: Client Document Collection
   - Stage 2: Data Entry & Review
   - Stage 3: Rental Property Schedule E
   - Stage 4: Tax Preparation
   - Stage 5: Review & E-File
8. Navigate to Stage 1: "Client Document Collection"
9. See automated document request already sent to client:
   - W2 forms
   - 1099 forms
   - Rental property income/expense records
   - Mortgage interest statement
   - Property tax records

### Phase 4: Client Document Portal Access (New Client)
**Note:** For this test, we'll simulate client receiving welcome email

1. Client (Sarah) receives welcome email:
   - Subject: "Welcome to Sterling Accounting - Your Tax Prep Portal"
   - Contains: Temporary password and login link
2. Client clicks link, navigates to /login
3. Client logs in with temporary credentials:
   - Email: sarah.johnson@email.com
   - Temp Password: (from email)
4. Prompted to change password
5. Sets new password
6. Redirects to /client-portal/dashboard
7. Sees welcome message and pending tasks:
   - "Upload Tax Documents" - Due in 7 days
8. Clicks task to view requirements
9. Sees document checklist:
   - [ ] W2 form(s)
   - [ ] 1099 form(s) (if any)
   - [ ] Rental property income records
   - [ ] Rental property expense records
   - [ ] Form 1098 (Mortgage interest)
   - [ ] Property tax statement

### Phase 5: Progressive Document Upload with Real-Time Updates
**Client Actions:**
1. Upload documents one by one:
   - Upload W2_2024.pdf → Mark W2 complete
   - Wait 2 seconds (simulate)
   - Upload 1099_INT_2024.pdf → Mark 1099 complete
   - Wait 2 seconds
   - Upload Rental_Income_2024.xlsx → Mark rental income complete
   - Wait 2 seconds
   - Upload Rental_Expenses_2024.xlsx → Mark rental expenses complete
   - Wait 2 seconds
   - Upload Mortgage_1098_2024.pdf → Mark mortgage complete
   - Wait 2 seconds
   - Upload PropertyTax_2024.pdf → Mark property tax complete

2. See progress bar update: "6/6 documents uploaded - 100% complete"
3. Click "Submit Documents"
4. Receive confirmation: "Documents submitted successfully!"

**Employee Actions (Simultaneous - Different Browser):**
1. Employee has assignment open
2. Sees real-time notifications as each document uploads:
   - "W2 uploaded" (notification appears)
   - "1099 uploaded" (2 seconds later)
   - "Rental income uploaded" (2 seconds later)
   - etc.
3. Downloads documents as they arrive (doesn't wait for all)
4. Begins preliminary review:
   - W2 looks complete ✓
   - 1099 shows $450 interest ✓
   - Rental income: $18,000 for year ✓
5. Gets notification: "All 6 documents uploaded - 100% complete"
6. Marks "Client Document Collection" stage complete
7. Workflow auto-advances to "Data Entry & Review"

### Phase 6: Automated Data Extraction with Forma AI Agent
1. Employee navigates to "Data Entry & Review" stage
2. Clicks "Run AI Agent: Forma"
3. Forma agent processes documents:
   - Extracts W2 data:
     - Employer: ABC Corp
     - Wages: $118,000
     - Federal withheld: $22,000
     - State withheld: $5,000
   - Extracts 1099-INT data:
     - Payer: First Bank
     - Interest: $450
   - Extracts rental property data:
     - Address: 123 Oak St
     - Rental income: $18,000
     - Expenses: $8,200
     - Net rental income: $9,800
   - Extracts mortgage interest: $4,800
   - Extracts property tax: $3,200

4. Forma populates tax software automatically
5. Employee reviews AI-extracted data:
   - Verify W2 amounts ✓
   - Verify 1099 amount ✓
   - Verify rental calculations ✓
   - Verify deductions ✓
6. Makes one correction: Rental expenses should be $8,500 (not $8,200)
7. Updates rental net income: $9,500
8. Marks data entry complete
9. Workflow auto-advances to "Rental Property Schedule E"

### Phase 7: Collaborative Review with @Mentions
1. Employee prepares Schedule E (rental property)
2. Finds question about depreciation:
   - "Client didn't provide depreciation schedule for rental property"
3. Adds comment in assignment:
   - "@admin@sterling.com Do we have depreciation info for Sarah's rental property? Not in uploaded docs."
4. Continues working on other portions
5. Admin (Office A) receives @mention notification
6. Admin checks client CRM
7. Admin doesn't find depreciation info
8. Admin uses team chat:
   - Sends message to employee: "Ask Sarah for purchase price and date. We'll calculate depreciation."
9. Employee sees chat message
10. Navigates to /messages (client communication)
11. Sends message to Sarah (Client):
    - "Hi Sarah, to complete your Schedule E, I need: 1) Purchase price of 123 Oak St, 2) Purchase date. Thanks!"

### Phase 8: Client Response and Completion
**Client Actions:**
1. Receive message notification
2. Login to client portal
3. Navigate to /client-portal/messages
4. Read employee's question
5. Reply: "I purchased the property for $280,000 on June 15, 2021. Let me know if you need anything else!"
6. Send reply

**Employee Actions:**
1. Receive client reply notification
2. Read response in messages
3. Calculate depreciation:
   - Property value: $280,000
   - Land value (estimated 20%): $56,000
   - Building value: $224,000
   - Annual depreciation: $224,000 / 27.5 = $8,145
   - Partial year 2021: $3,667 (6.5 months)
   - 2024 (Year 4): Full year $8,145
4. Complete Schedule E:
   - Rental income: $18,000
   - Expenses: $8,500
   - Depreciation: $8,145
   - Net rental income: $1,355
5. Update tax return with Schedule E
6. Mark "Rental Property Schedule E" complete
7. Workflow auto-advances to "Tax Preparation"
8. Complete tax preparation:
   - Total income: $118,000 (W2) + $450 (Interest) + $1,355 (Net rental) = $119,805
   - Standard deduction: $14,600
   - Taxable income: $105,205
   - Tax liability: $17,234
   - Withholding: $22,000
   - Refund: $4,766
9. Generate draft tax return
10. Upload: Sarah_Johnson_Tax_Return_2024_Draft.pdf
11. Mark "Tax Preparation" complete
12. Workflow auto-advances to "Review & E-File"

### Phase 9: Cross-Office Partner Review
1. Employee sends for partner review
2. @mention Admin (Office A): "@admin@sterling.com Sarah's return ready for partner review. Refund of $4,766."
3. Admin receives notification
4. Reviews return from Office A (remotely)
5. Approves return
6. Employee e-files return
7. Gets confirmation: IRS Accepted
8. Sends confirmation to client:
   - "Your 2024 tax return has been e-filed! Expect refund of $4,766 in 2-3 weeks."
9. Client receives notification
10. Marks workflow complete

### Phase 10: Analytics - Multi-Office Performance
1. Admin navigates to /analytics
2. Views multi-office metrics:
   - Office A assignments: X
   - Office B assignments: Y (including Sarah)
   - Auto-routing success rate: 100%
3. Views workflow efficiency:
   - Client onboarding: 1 hour (Luca AI-assisted)
   - Document collection: 2 days (auto-requests)
   - Data extraction: 30 minutes (Forma AI)
   - Preparation: 3 hours (employee)
   - Review: 1 hour (cross-office)
   - Total: 3 days (vs. typical 5-7 days manual)
4. Views AI agent impact:
   - Luca: Reduced onboarding time by 70%
   - Forma: Reduced data entry time by 80%
   - Conditional routing: 100% accuracy

### Expected Results
✅ AI-powered client onboarding (Luca agent)  
✅ Conditional auto-routing based on tags  
✅ Cross-office assignment workflow  
✅ Progressive document upload with real-time updates  
✅ AI data extraction (Forma agent)  
✅ @mention collaboration across offices  
✅ Client communication through portal  
✅ Multi-office partner review  
✅ Complete workflow automation  
✅ Analytics showing multi-office efficiency  

### Success Metrics
- Onboarding time: 1 hour (vs. 4 hours manual)
- Routing accuracy: 100% (correct office/employee)
- Document collection: 2 days (vs. 5 days typical)
- Data entry time: 30 minutes (vs. 2 hours manual)
- Total turnaround: 3 days (vs. 7 days typical)
- AI agent utilization: 2 agents (Luca, Forma)
- Cross-office collaboration: Seamless

---

## Scenario 5: Month-End Close with Parallel Workflows
**Duration**: 15-25 minutes  
**Users**: Admin, Employee 1, Employee 2, Client  
**Objective**: Test concurrent workflows and team coordination

### Scenario Setup
Sterling Accounting serves 5 clients who all need month-end close simultaneously. Must coordinate team to handle parallel workflows efficiently.

### Phase 1: Batch Workflow Creation (Admin)
1. Login as Admin
2. Navigate to /workflows
3. Create template: "Month-End Close - Standard"
4. Define workflow stages:
   - Bank reconciliation
   - AP/AR review
   - Journal entries
   - Financial statements
   - Management review
5. Save as template
6. Navigate to /clients
7. Select 5 clients:
   - Client A (TechNova)
   - Client B (Marketing Co)
   - Client C (Retail Shop)
   - Client D (Consulting Firm)
   - Client E (Restaurant)
8. Bulk action: "Apply Workflow Template"
9. Select "Month-End Close - Standard"
10. Set all due dates: End of month (3 days away)
11. Distribute assignments:
    - Employee 1: Clients A, B, C
    - Employee 2: Clients D, E
    - Admin: Review all 5
12. Click "Create All Workflows"
13. Verify 5 workflows created
14. Verify assignments distributed

### Phase 2: Employee 1 - Parallel Execution
1. Login as Employee 1
2. Navigate to /assignments
3. See 3 active assignments:
   - Month-End Close - TechNova
   - Month-End Close - Marketing Co
   - Month-End Close - Retail Shop
4. Use kanban board view:
   - Column 1: Not Started (3 cards)
   - Column 2: In Progress (0 cards)
   - Column 3: Review (0 cards)
   - Column 4: Complete (0 cards)
5. Drag Client A (TechNova) to "In Progress"
6. Start time tracking for Client A
7. Work on Client A for 30 minutes:
   - Complete bank reconciliation
   - Mark stage 1 complete
8. Pause Client A, start Client B
9. Drag Client B to "In Progress"
10. Work on Client B for 20 minutes:
    - Complete bank reconciliation
    - Mark stage 1 complete
11. Pause Client B, start Client C
12. Drag Client C to "In Progress"
13. Work on Client C for 25 minutes:
    - Complete bank reconciliation
    - Mark stage 1 complete
14. View workload dashboard:
    - Total time today: 1 hour 15 minutes
    - Clients in progress: 3
    - Completion: Stage 1 complete for all 3

### Phase 3: Employee 2 - Parallel Execution
**Simultaneous with Phase 2**

1. Login as Employee 2 (different browser)
2. Navigate to /assignments
3. See 2 active assignments:
   - Month-End Close - Consulting Firm
   - Month-End Close - Restaurant
4. Use list view (prefers lists over kanban)
5. Start with Client D (Consulting Firm)
6. Start time tracking
7. Work on Client D for 40 minutes:
   - Complete bank reconciliation
   - Complete AP/AR review
   - Mark stages 1-2 complete
8. Find issue in Client D: Missing invoices
9. Navigate to /team-chat
10. Message Employee 1: "Have you seen missing invoice issues with any clients? Client D is missing 3 invoices."
11. Continue with Client E while waiting for response
12. Work on Client E for 30 minutes:
    - Complete bank reconciliation
    - Find similar issue: Missing invoices
13. Realize pattern: Month-end invoice lag
14. Document finding in shared notes

### Phase 4: Team Collaboration & Problem Solving
**Employee 1 Actions:**
1. See chat message from Employee 2
2. Reply: "Yes! Client B also missing invoices. I think it's a timing issue - invoices cut off at different dates."
3. Suggest solution: "Let's standardize cut-off date to 5 PM on last day of month"
4. @mention Admin: "@admin@sterling.com We found invoice timing issue across multiple clients. Recommending standard 5 PM cut-off policy."

**Admin Actions:**
1. See @mention notification
2. Join team chat discussion
3. Review issue across all 5 clients
4. Make decision: "Great catch! Implementing 5 PM cut-off policy effective immediately."
5. Create policy document:
   - Navigate to /folders
   - Create: "Month-End Close Policies.pdf"
   - Upload to shared team folder
6. Update workflow template:
   - Add note to bank reconciliation stage
   - "Ensure all transactions through 5 PM on last day included"
7. Broadcast to team: "Policy updated and template revised. Good teamwork!"

**Employee 2 Actions:**
1. See policy update notification
2. Apply to Client D and E:
   - Request final transactions through 5 PM
   - Update reconciliations
3. Continue Client D work:
   - Complete journal entries
   - Generate financial statements
   - Mark stages 3-4 complete
4. Move to Client E:
   - Complete AP/AR review
   - Complete journal entries
   - Generate financial statements
   - Mark stages 2-4 complete

### Phase 5: Concurrent Client Communications
**Employee 1 - Multi-Client Messages:**
1. Navigate to /messages
2. Compose message to Client A:
   - "Your month-end close is in progress. Need confirmation on year-end accrual of $5,000."
3. Send message to Client A
4. Compose message to Client B:
   - "Please approve journal entry for prepaid insurance adjustment $2,400."
5. Send message to Client B
6. Compose message to Client C:
   - "Month-end close complete. Financial statements attached for review."
   - Attach: FinancialStatements_ClientC_Dec2024.pdf
7. Send message to Client C

**Client Responses (Simulated):**
1. Client A logs in
2. Approves accrual
3. Employee 1 receives approval notification
4. Client B logs in
5. Approves journal entry
6. Employee 1 receives approval
7. Client C logs in
8. Reviews financial statements
9. Approves statements
10. Employee 1 receives approval

### Phase 6: Quality Review & Completion (Admin)
1. Admin navigates to workflow dashboard
2. Views overall progress:
   - Client A (Employee 1): 80% complete
   - Client B (Employee 1): 75% complete
   - Client C (Employee 1): 100% complete ✓
   - Client D (Employee 2): 90% complete
   - Client E (Employee 2): 85% complete
3. Reviews completed Client C:
   - Download financial statements
   - Review for accuracy
   - Check all reconciliations
   - Verify management approval
4. Approves Client C: "Excellent work!"
5. Reviews Client D (nearly complete):
   - Download draft financials
   - Find minor discrepancy in depreciation
   - Add comment: "@employee2 Please verify depreciation calculation for equipment"
6. Employee 2 receives notification
7. Employee 2 fixes depreciation
8. Resubmits Client D
9. Admin re-reviews and approves
10. Marks Client D complete

### Phase 7: Workload Balancing
1. Admin views team workload:
   - Employee 1: 3 clients, 2 still in progress
   - Employee 2: 2 clients, 1 remaining
2. Employee 2 has capacity
3. Admin reassigns Client B from Employee 1 to Employee 2:
   - Navigate to Client B workflow
   - Click "Reassign"
   - Select: Employee 2
   - Add note: "Reassigning to balance workload"
4. Notify both employees of change
5. Employee 2 accepts new assignment
6. Employee 1 freed up to focus on Client A
7. Both employees work more efficiently:
   - Employee 1 completes Client A (100%)
   - Employee 2 completes Clients B & E (100%)

### Phase 8: Final Analytics & Reporting
1. Admin navigates to /analytics
2. View month-end close metrics:
   
   **Completion Summary:**
   - Total clients: 5
   - Completed on time: 5 (100%)
   - Average completion time: 2.5 days (vs. 3-day deadline)
   - Issues identified: 1 (invoice timing)
   - Issues resolved: 1 (policy created)
   
   **Team Performance:**
   - Employee 1:
     - Clients: 2 (A, C)
     - Total time: 4.5 hours
     - Efficiency: Good
   - Employee 2:
     - Clients: 3 (B, D, E)
     - Total time: 6.2 hours
     - Efficiency: Excellent
   
   **Collaboration Metrics:**
   - Team chat messages: 12
   - @mentions: 3
   - Workload reassignments: 1 (effective)
   - Client communications: 9
   - Approvals: 5
   
   **Process Improvements:**
   - New policy created: Month-end cut-off standardization
   - Template updated: Workflow template revised
   - Team learning: Invoice timing best practice documented

3. Generate summary report:
   - Export to PDF
   - Share with team
   - Archive for future reference

4. Schedule retrospective meeting:
   - Navigate to /calendar
   - Create team meeting: "Month-End Close Retrospective"
   - Invite: Admin, Employee 1, Employee 2
   - Agenda: Discuss process improvements and team performance

### Expected Results
✅ Batch workflow creation works  
✅ Parallel workflow execution successful  
✅ Team collaboration via chat effective  
✅ @mentions facilitate coordination  
✅ Issue identification and resolution  
✅ Policy creation from learnings  
✅ Workload balancing and reassignment  
✅ Concurrent client communications  
✅ Quality review process functional  
✅ Analytics capture team performance  
✅ Process improvement documented  

### Success Metrics
- All 5 clients completed: 100% on-time
- Average completion: 2.5 days (ahead of deadline)
- Team collaboration events: 20+
- Issues identified and resolved: 1
- Process improvements: 1 policy, 1 template update
- Team efficiency: High (workload balanced)
- Client satisfaction: All approvals received

---

## Test Execution Guidelines

### Prerequisites
1. **Test Data**: Ensure test accounts exist (superadmin, admin, employee, client)
2. **Clean State**: Reset workflows/assignments before each scenario
3. **Multiple Browsers**: Use different browsers/incognito for simultaneous users
4. **Screen Recording**: Record critical scenarios for documentation
5. **Timing**: Note actual completion times vs. expected

### Test Environment Setup
```bash
# Before running tests
1. Clear browser cache
2. Verify database has test data
3. Check all services running (backend, frontend, WebSockets)
4. Prepare test files (PDFs, spreadsheets for uploads)
5. Set up screen recording software
```

### During Test Execution
- ✅ Take screenshots of key moments
- ✅ Note any unexpected behavior
- ✅ Track actual timings
- ✅ Verify all notifications
- ✅ Check console for errors
- ✅ Monitor network requests
- ✅ Test on different devices/browsers

### Post-Test Actions
- ✅ Document bugs found
- ✅ Record performance metrics
- ✅ Compare expected vs. actual results
- ✅ Generate test report
- ✅ Clean up test data (if needed)
- ✅ Share findings with team

### Success Criteria
Each scenario passes if:
1. All workflow stages complete successfully
2. All user roles can perform their tasks
3. Notifications sent and received correctly
4. Data persists across sessions
5. No critical errors in console
6. Real-time features work (chat, @mentions, uploads)
7. Analytics capture accurate data
8. UI is responsive and intuitive

---

## Summary

**Total Team Collaboration Scenarios**: 5 comprehensive real-world tests

1. **Complete Tax Preparation Workflow** (30-45 min)
   - Tests: Admin, Employee, Client collaboration
   - Features: Full workflow lifecycle, AI agents, signatures, invoicing

2. **Urgent Audit Response** (20-30 min)
   - Tests: High-priority workflows, real-time chat, escalations
   - Features: Live collaboration, urgent signatures, AI document generation

3. **Service Marketplace** (25-35 min)
   - Tests: Service purchase, delivery, revisions, reviews
   - Features: Payment processing, deliverable tracking, client satisfaction

4. **Multi-Office Onboarding** (20-30 min)
   - Tests: AI-powered onboarding, auto-routing, cross-office collaboration
   - Features: Luca & Forma AI agents, conditional workflows, distributed teams

5. **Month-End Close Parallel Workflows** (15-25 min)
   - Tests: Concurrent workflows, team coordination, workload balancing
   - Features: Batch operations, kanban boards, process improvement

**Total Test Coverage**: ~110-165 minutes for complete suite

These scenarios test the platform's ability to handle realistic, complex accounting firm workflows with multiple users collaborating in real-time.
