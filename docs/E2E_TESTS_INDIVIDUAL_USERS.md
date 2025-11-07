# Accute - Individual User Type E2E Tests

## Test User Credentials

### Super Admin (Platform-wide access)
- **Email**: superadmin@accute.com
- **Password**: SuperAdmin123!
- **Super Admin Key**: 2d4eaca8c385234bee27fc041c4d428e6df68f55ce4e272020858744944b9427
- **Organization**: None (platform-scoped)
- **Access**: Unlimited, bypasses all quotas

### Admin (Sterling Accounting Firm)
- **Email**: admin@sterling.com
- **Password**: Admin123!
- **Organization**: Sterling Accounting Firm
- **Role**: Admin
- **Access**: Full organization access, subject to subscription limits

### Employee (Sterling Accounting Firm)
- **Email**: employee@sterling.com
- **Password**: Employee123!
- **Organization**: Sterling Accounting Firm
- **Role**: Employee
- **Access**: Limited to assigned tasks and workflows

### Client (TechNova Solutions)
- **Email**: david@technova.com
- **Password**: Client123!
- **Organization**: TechNova Solutions (client of Sterling)
- **Role**: Client
- **Access**: Client portal only

---

## Test Suite 1: Super Admin Platform Management

### Test 1.1: Organization Management
**Objective**: Verify Super Admin can manage all organizations

**Steps:**
1. Navigate to /login
2. Click "Super Admin" tab
3. Enter Super Admin credentials:
   - Super Admin Key: 2d4eaca8c385234bee27fc041c4d428e6df68f55ce4e272020858744944b9427
   - Email: superadmin@accute.com
   - Password: SuperAdmin123!
4. Submit login form
5. Navigate to /admin/organizations
6. View list of all organizations
7. Click on "Sterling Accounting Firm" to view details
8. Verify organization information displays correctly
9. Navigate back to organizations list
10. Search for "Sterling" in search box
11. Verify filtered results show only Sterling Accounting

**Expected Results:**
- Super Admin successfully logs in
- Organizations page loads with all orgs
- Organization details are accessible
- Search and filtering work correctly
- No quota warnings (unlimited access)

---

### Test 1.2: User Management Across Organizations
**Objective**: Verify Super Admin can view and manage users across all organizations

**Steps:**
1. Login as Super Admin (use Test 1.1 steps 1-4)
2. Navigate to /admin/users
3. View list of all users across all organizations
4. Filter by organization: "Sterling Accounting Firm"
5. Verify users (admin@sterling.com, employee@sterling.com) appear
6. Click on admin@sterling.com to view user details
7. Verify user information, role, and organization displayed
8. Check user activity timeline
9. Navigate back to users list
10. Filter by role: "Admin"
11. Verify only Admin role users appear

**Expected Results:**
- All users across organizations visible
- Filtering by organization works
- Filtering by role works
- User details accessible
- Activity timeline displays

---

### Test 1.3: Subscription Plan Management
**Objective**: Verify Super Admin can manage subscription plans

**Steps:**
1. Login as Super Admin
2. Navigate to /admin/pricing (if route exists, else skip)
3. View all subscription plans
4. Verify Free, Starter, Professional, Enterprise tiers display
5. Click on "Professional" plan
6. View plan details:
   - Pricing (India vs Global)
   - Feature gates enabled
   - Resource limits
7. Check feature gates: workflows, ai_agents, signatures, analytics, automations
8. Check resource limits: maxUsers, maxClients, maxWorkflows, maxAIAgents

**Expected Results:**
- All subscription plans visible
- Plan details load correctly
- Feature gates display correctly
- Resource limits display correctly
- Pricing shows regional differences

---

### Test 1.4: AI Agent Marketplace Management
**Objective**: Verify Super Admin can manage AI agent marketplace

**Steps:**
1. Login as Super Admin
2. Navigate to /admin/marketplace/published
3. View all published AI agents
4. Verify 9 core agents appear (Cadence, Echo, Forma, Luca, OmniSpectra, Parity, Radar, Relay, Scribe)
5. Click on "Cadence" agent
6. View agent details, pricing, and installation count
7. Navigate to /admin/agent-foundry
8. View agent creation interface
9. Check if any custom agents exist
10. Navigate to /admin/marketplace/create
11. Verify agent creation form loads

**Expected Results:**
- Published agents page loads
- All 9 core agents visible
- Agent details accessible
- Agent Foundry accessible
- Create agent form loads

---

### Test 1.5: Platform Analytics
**Objective**: Verify Super Admin can view platform-wide analytics

**Steps:**
1. Login as Super Admin
2. Navigate to /admin/dashboard
3. View platform-wide metrics:
   - Total organizations
   - Total users
   - Total workflows
   - Total AI agent installations
   - Revenue metrics
4. Check real-time data updates
5. Navigate to /admin/subscription-analytics (if exists)
6. View subscription metrics:
   - MRR (Monthly Recurring Revenue)
   - ARR (Annual Recurring Revenue)
   - Churn rate
   - Active subscriptions by tier
7. Verify charts and graphs display correctly

**Expected Results:**
- Dashboard loads with platform metrics
- All metrics display real data
- Charts render correctly
- Subscription analytics accessible
- Data appears accurate

---

### Test 1.6: Unlimited Resource Creation
**Objective**: Verify Super Admin bypasses all quota limits

**Steps:**
1. Login as Super Admin
2. Navigate to /workflows
3. Create 15 new workflows (exceeds free tier limit of 10):
   - For each workflow:
     - Click "Create Workflow"
     - Name: "SuperAdmin-Test-Workflow-${i}"
     - Description: "Testing platform admin bypass"
     - Category: "general"
     - Submit form
4. Verify all 15 workflows created successfully (no quota errors)
5. Navigate to workflows list
6. Verify all 15 workflows appear
7. Delete all 15 test workflows (cleanup)

**Expected Results:**
- All 15 workflows create successfully
- No quota denial errors
- No resource limit warnings
- Platform admin bypass works correctly
- Cleanup successful

---

## Test Suite 2: Admin (Organization Owner) Workflows

### Test 2.1: Admin Login and Dashboard Access
**Objective**: Verify Admin can log in and access dashboard

**Steps:**
1. Navigate to /login
2. Enter admin credentials:
   - Email: admin@sterling.com
   - Password: Admin123!
3. Submit login form
4. Verify redirect to /dashboard
5. Check dashboard displays organization-specific data:
   - User count for Sterling Accounting
   - Client count for Sterling Accounting
   - Workflow count
   - Recent activity
6. Verify organization name "Sterling Accounting Firm" appears in UI
7. Check sidebar navigation is visible with all admin features

**Expected Results:**
- Admin logs in successfully
- Dashboard loads with org-specific data
- Organization name displays correctly
- All admin menu items visible
- No errors in console

---

### Test 2.2: Team Management
**Objective**: Verify Admin can manage team members

**Steps:**
1. Login as Admin
2. Navigate to /team
3. View list of team members (admin, employee)
4. Click "Invite User" button
5. Fill invitation form:
   - Email: newemployee@sterling.com
   - First Name: New
   - Last Name: Employee
   - Role: Employee
6. Submit invitation
7. Verify success message appears
8. Check team list for new invitation
9. Click on employee@sterling.com
10. View employee details and activity

**Expected Results:**
- Team page loads with existing members
- Invitation form works
- New invitation appears in pending state
- Employee details accessible
- Activity timeline displays

---

### Test 2.3: Client Management
**Objective**: Verify Admin can create and manage clients

**Steps:**
1. Login as Admin
2. Navigate to /clients
3. View existing clients
4. Click "Add Client" button
5. Fill client form:
   - Name: "Test Client Ltd"
   - Email: testclient@example.com
   - Phone: +1234567890
   - Company: "Test Client Ltd"
   - Tags: ["tax_preparation", "new_client"]
6. Submit form
7. Verify client created successfully
8. Search for "Test Client" in search box
9. Verify client appears in results
10. Click on client to view details
11. Verify tags appear correctly
12. Add note: "Initial consultation scheduled"
13. Verify note saves successfully

**Expected Results:**
- Clients page loads
- Client creation works
- Tags apply correctly
- Search finds client
- Client details accessible
- Notes save successfully

---

### Test 2.4: Workflow Creation with Quota Check
**Objective**: Verify Admin is subject to subscription quota limits

**Steps:**
1. Login as Admin
2. Navigate to /workflows
3. Get current workflow count (note as ${currentCount})
4. Check subscription status:
   - Navigate to settings or check resource badge
   - Note max workflows limit (likely 10 for free tier)
5. If ${currentCount} < 10:
   - Create new workflow:
     - Name: "Tax Preparation Workflow 2024"
     - Description: "Annual tax prep process"
     - Category: "tax_preparation"
   - Verify workflow creates successfully
6. If ${currentCount} >= 10:
   - Attempt to create workflow
   - Verify quota error appears
   - Verify error message mentions limit reached

**Expected Results:**
- Current workflow count displays accurately
- Subscription limits enforced (unlike Super Admin)
- Workflow creation succeeds if under limit
- Quota error appears if limit exceeded
- Error message is user-friendly

---

### Test 2.5: Workflow Builder - Visual Automation
**Objective**: Verify Admin can build complex workflows

**Steps:**
1. Login as Admin
2. Navigate to /workflow-builder/new
3. Fill workflow details:
   - Name: "Client Onboarding Workflow"
   - Description: "Automated client onboarding process"
   - Category: "client_management"
4. Add Stage: "Initial Contact"
5. Add Step under "Initial Contact": "Send Welcome Email"
6. Add automation action to "Send Welcome Email":
   - Type: send_email
   - Template: Select welcome email template
   - To: Client email
7. Add another Step: "Request Documents"
8. Add automation action:
   - Type: request_documents
   - Documents: ["Tax ID", "Financial Statements"]
9. Add conditional logic:
   - IF client has tag "high_priority"
   - THEN assign to Senior Accountant
   - ELSE assign to Junior Accountant
10. Save workflow
11. Verify workflow saves successfully

**Expected Results:**
- Workflow builder loads
- Can add stages, steps, tasks
- Automation actions configure correctly
- Conditional logic works
- Workflow saves successfully

---

### Test 2.6: Assign Workflow to Client
**Objective**: Verify Admin can assign workflows to clients

**Steps:**
1. Login as Admin
2. Navigate to /workflows
3. Find "Client Onboarding Workflow" (from Test 2.5)
4. Click "Assign to Client"
5. Select client: "Test Client Ltd" (from Test 2.3)
6. Set due date: 7 days from now
7. Assign to user: employee@sterling.com
8. Submit assignment
9. Navigate to /assignments
10. Verify new assignment appears
11. Filter by client: "Test Client Ltd"
12. Verify assignment shows correct client, due date, assignee

**Expected Results:**
- Workflow assignment dialog opens
- Client selection works
- Due date picker works
- User assignment works
- Assignment creates successfully
- Assignment appears in list with correct details

---

### Test 2.7: AI Agent Installation
**Objective**: Verify Admin can install AI agents from marketplace

**Steps:**
1. Login as Admin
2. Navigate to /ai-agents
3. View currently installed agents
4. Note installed agent count (check quota limit: free tier = 3)
5. If under limit:
   - Navigate to /marketplace
   - Find "Cadence" agent (if not installed)
   - Click "Install"
   - Verify installation succeeds
   - Navigate back to /ai-agents
   - Verify Cadence appears in installed agents
6. If at limit:
   - Attempt to install another agent
   - Verify quota error appears

**Expected Results:**
- AI agents page loads
- Installed agents display
- Marketplace accessible
- Installation works if under quota
- Quota enforced if limit reached

---

### Test 2.8: Document Upload and Management
**Objective**: Verify Admin can upload and organize documents

**Steps:**
1. Login as Admin
2. Navigate to /folders (or /my-documents)
3. Create new folder: "Tax Documents 2024"
4. Click on folder to open
5. Upload document (use test PDF or create one)
6. Verify document uploads successfully
7. Check document appears in folder
8. Click on document to view details
9. Add annotation: "Review required"
10. @mention employee: "@employee@sterling.com please review"
11. Verify annotation saves with mention
12. Check if notification created for employee

**Expected Results:**
- Folder creation works
- Document upload succeeds
- Document appears in folder
- Annotations work
- @mentions work
- Notifications created

---

### Test 2.9: Time Tracking
**Objective**: Verify Admin can track time on tasks

**Steps:**
1. Login as Admin
2. Navigate to /time-tracking
3. View time tracking interface
4. Start new time entry:
   - Task: "Client consultation"
   - Project: Select a client project
   - Click "Start Timer"
5. Wait 30 seconds
6. Click "Stop Timer"
7. Verify time entry appears (showing ~30 seconds)
8. Edit time entry:
   - Change duration to 1 hour
   - Mark as billable
   - Save changes
9. Verify changes save successfully
10. View time reports
11. Filter by date range: This week
12. Verify time entry appears in report

**Expected Results:**
- Time tracking page loads
- Timer starts and stops correctly
- Time entry creates
- Manual editing works
- Reports display correctly
- Filtering works

---

### Test 2.10: Invoice Generation
**Objective**: Verify Admin can create and send invoices

**Steps:**
1. Login as Admin
2. Navigate to /invoices
3. Click "Create Invoice"
4. Fill invoice form:
   - Client: "Test Client Ltd"
   - Items:
     - Description: "Tax Preparation Services"
     - Quantity: 1
     - Rate: 500
     - Amount: 500
   - Due Date: 30 days from now
5. Save invoice
6. Verify invoice number generated
7. Click "Send Invoice"
8. Verify send confirmation
9. View invoice list
10. Filter by client: "Test Client Ltd"
11. Verify invoice appears with status "Sent"

**Expected Results:**
- Invoice creation form works
- Invoice saves successfully
- Invoice number auto-generated
- Send invoice works
- Invoice list displays correctly
- Filtering works

---

## Test Suite 3: Employee Day-to-Day Tasks

### Test 3.1: Employee Login and Dashboard
**Objective**: Verify Employee can log in and see assigned work

**Steps:**
1. Navigate to /login
2. Enter employee credentials:
   - Email: employee@sterling.com
   - Password: Employee123!
3. Submit login form
4. Verify redirect to /dashboard
5. Check dashboard shows:
   - Assigned tasks count
   - Pending assignments
   - Recent activity
6. Verify employee sees limited navigation (no admin features)
7. Check for absence of admin menu items:
   - No "Team Management"
   - No "Pricing Settings"
   - No "Organization Settings"

**Expected Results:**
- Employee logs in successfully
- Dashboard shows employee-specific data
- Admin features not visible
- Navigation limited to employee role
- No errors

---

### Test 3.2: View and Complete Assigned Tasks
**Objective**: Verify Employee can work on assigned tasks

**Steps:**
1. Login as Employee
2. Navigate to /assignments
3. View list of assigned workflows/tasks
4. Find assignment created by Admin (from Test 2.6)
5. Click on assignment to open details
6. View workflow stages and steps
7. Find first incomplete task
8. Click "Start Task"
9. Complete task:
   - Mark checklist items complete
   - Add notes: "Completed initial review"
   - Upload supporting document (if applicable)
10. Click "Complete Task"
11. Verify task marked complete
12. Move to next task in workflow
13. Repeat completion steps

**Expected Results:**
- Assignments page loads
- Assigned work visible
- Can open assignment details
- Task progression works
- Checklist items work
- Notes save
- Document upload works
- Task completion updates status

---

### Test 3.3: Collaborate via Chat
**Objective**: Verify Employee can use team chat

**Steps:**
1. Login as Employee
2. Navigate to /team-chat
3. View list of channels
4. Click on general channel
5. Send message: "Working on Tax Prep workflow"
6. @mention admin: "@admin@sterling.com need clarification on step 3"
7. Verify message sends successfully
8. Verify @mention highlights correctly
9. Upload file to chat: "tax_checklist.pdf"
10. Verify file upload succeeds
11. Check message history scrolls correctly
12. Search for "Tax Prep" in chat
13. Verify search finds message

**Expected Results:**
- Team chat loads
- Channels visible
- Messages send successfully
- @mentions work
- File uploads work
- Search works
- Real-time updates (if possible to verify)

---

### Test 3.4: Track Time on Tasks
**Objective**: Verify Employee can track time

**Steps:**
1. Login as Employee
2. Navigate to /time-tracking
3. Start timer for current task:
   - Task: From assignment (e.g., "Review Financial Statements")
   - Click "Start Timer"
4. Wait 15 seconds
5. Stop timer
6. Verify time entry created (~15 seconds)
7. View personal time report
8. Filter by: This week
9. Verify time entry appears
10. Check total time for week

**Expected Results:**
- Time tracking accessible to employee
- Timer works correctly
- Time entries save
- Reports show employee's own time only
- Cannot see other employees' time

---

### Test 3.5: Upload Documents for Client
**Objective**: Verify Employee can manage client documents

**Steps:**
1. Login as Employee
2. Navigate to assigned client folder (e.g., "Test Client Ltd")
3. Navigate to /folders or client document area
4. Find client's folder
5. Upload document: "Financial_Statement_2024.pdf"
6. Verify upload succeeds
7. Add document metadata:
   - Document type: "Financial Statement"
   - Year: 2024
   - Tags: ["reviewed", "important"]
8. Save metadata
9. View document list
10. Filter by tag: "reviewed"
11. Verify document appears

**Expected Results:**
- Employee can access client folders
- Document upload works
- Metadata can be added
- Filtering works
- Documents organized correctly

---

### Test 3.6: Receive and Respond to @Mentions
**Objective**: Verify Employee receives notifications for @mentions

**Steps:**
1. Login as Employee
2. Check notifications icon in header
3. Look for notification from Admin's @mention (from Test 2.8 or other tests)
4. Click on notification
5. Verify it navigates to the context (document annotation or chat message)
6. Respond to the mention:
   - If document: Add reply annotation
   - If chat: Send reply message
7. Verify response sends successfully
8. Mark notification as read
9. Verify notification disappears from unread list

**Expected Results:**
- Notifications visible in UI
- Click navigation works correctly
- Context preserved (jumps to right place)
- Can respond to mentions
- Notification system works end-to-end

---

### Test 3.7: Request Leave or Time Off
**Objective**: Verify Employee can interact with HR/time-off features (if available)

**Steps:**
1. Login as Employee
2. Navigate to calendar or time-off section
3. Request time off:
   - Dates: Next week, 2 days
   - Reason: "Personal leave"
4. Submit request
5. Verify request appears as "Pending"
6. Check if notification sent to Admin for approval

**Expected Results:**
- Time off request form accessible
- Request submits successfully
- Status shows as pending
- Admin receives notification (verify in next admin test)

---

### Test 3.8: Access Restricted from Admin Features
**Objective**: Verify Employee cannot access admin-only features

**Steps:**
1. Login as Employee
2. Attempt to navigate directly to admin URLs:
   - /admin/dashboard
   - /admin/users
   - /admin/pricing
   - /team (team management)
3. Verify each URL either:
   - Redirects to dashboard with error message, OR
   - Shows "Access Denied" message
4. Check sidebar navigation does NOT show admin items
5. Verify employee cannot:
   - Invite new users
   - Change organization settings
   - View subscription/billing
   - Delete workflows owned by others

**Expected Results:**
- Direct URL navigation blocked
- Error messages displayed
- Redirects to allowed pages
- Admin features not visible in UI
- Role-based access control enforced

---

## Test Suite 4: Client Portal Experience

### Test 4.1: Client Login and Portal Access
**Objective**: Verify Client can log in and access client portal

**Steps:**
1. Navigate to /login
2. Enter client credentials:
   - Email: david@technova.com
   - Password: Client123!
3. Submit login form
4. Verify redirect to /client-portal/dashboard
5. Check client portal dashboard shows:
   - Pending tasks
   - Recent documents
   - Messages
   - Upcoming deadlines
6. Verify navigation shows client-specific menu:
   - Documents
   - Tasks
   - Forms
   - Signatures
   - Messages
7. Verify no access to internal team features

**Expected Results:**
- Client logs in successfully
- Redirects to client portal (not main dashboard)
- Client-specific UI loads
- Only client-relevant features visible
- Clean, simple interface

---

### Test 4.2: View Assigned Tasks
**Objective**: Verify Client can see tasks assigned to them

**Steps:**
1. Login as Client
2. Navigate to /client-portal/tasks
3. View list of tasks assigned to client
4. Find task like "Upload Tax Documents"
5. Click on task to view details
6. Read task description and requirements
7. Check due date
8. View task checklist (if any)
9. Mark checklist item as complete
10. Verify checklist updates

**Expected Results:**
- Tasks page loads in client portal
- Only client's own tasks visible
- Task details accessible
- Due dates clearly displayed
- Checklist interaction works

---

### Test 4.3: Upload Requested Documents
**Objective**: Verify Client can upload documents

**Steps:**
1. Login as Client
2. Navigate to /client-portal/documents
3. View document request from accountant
4. Click "Upload Document"
5. Select document type: "Tax ID"
6. Upload file: "TaxID_2024.pdf"
7. Add description: "Federal Tax ID for 2024"
8. Submit upload
9. Verify document appears in "My Documents"
10. Check upload status shows "Uploaded" or "Under Review"
11. Verify timestamp shows current date/time

**Expected Results:**
- Document upload interface accessible
- File upload works
- Document categorization works
- Upload confirmation displayed
- Document appears in list
- Status tracking visible

---

### Test 4.4: Fill and Submit Forms
**Objective**: Verify Client can complete forms

**Steps:**
1. Login as Client
2. Navigate to /client-portal/forms
3. View list of assigned forms
4. Find form like "Tax Information Organizer"
5. Click "Fill Form"
6. Complete form fields:
   - Personal information
   - Income details
   - Deduction information
   - etc.
7. Save progress as draft
8. Continue later (verify draft saved)
9. Complete remaining fields
10. Review filled form
11. Click "Submit Form"
12. Verify submission confirmation
13. Verify form status changes to "Submitted"

**Expected Results:**
- Forms page loads
- Assigned forms visible
- Form builder renders correctly
- Can save draft
- Draft persists
- Form submission works
- Status updates correctly

---

### Test 4.5: Digital Signature Workflow
**Objective**: Verify Client can sign documents digitally

**Steps:**
1. Login as Client
2. Navigate to /client-portal/signatures
3. View pending signature requests
4. Find document: "Engagement Letter 2024"
5. Click "Review and Sign"
6. Read document content
7. Scroll to signature section
8. Enter signature (draw or type)
9. Verify signature preview
10. Click "Sign Document"
11. Verify signing confirmation
12. Check document status changes to "Signed"
13. Download signed copy
14. Verify PDF includes signature and timestamp

**Expected Results:**
- Signature requests visible
- Document viewer works
- Signature capture works (draw/type)
- Signing process completes
- Status updates to "Signed"
- Download works
- Signed PDF valid

---

### Test 4.6: Message Accountant
**Objective**: Verify Client can communicate with accountant

**Steps:**
1. Login as Client
2. Navigate to /client-portal/messages
3. Click "New Message"
4. Compose message:
   - Subject: "Question about deductions"
   - Body: "Can I deduct home office expenses?"
5. Send message
6. Verify message appears in sent messages
7. Wait for response (or simulate in another test)
8. Check for unread message notification
9. Read response
10. Reply to message thread
11. Verify reply sends successfully

**Expected Results:**
- Messaging interface accessible
- New message composition works
- Message sends successfully
- Message thread displays correctly
- Notifications work
- Reply functionality works

---

### Test 4.7: View and Pay Invoices
**Objective**: Verify Client can view and pay invoices

**Steps:**
1. Login as Client
2. Navigate to client portal invoice section
3. View list of invoices
4. Find invoice created by Admin (from Test 2.10)
5. Click on invoice to view details
6. Verify invoice details:
   - Invoice number
   - Date
   - Line items
   - Total amount
   - Due date
7. Click "Pay Invoice"
8. Select payment method (if payment gateway configured):
   - Credit card
   - Bank transfer
   - Saved payment method
9. Complete payment (use test mode)
10. Verify payment confirmation
11. Check invoice status changes to "Paid"

**Expected Results:**
- Invoice list accessible
- Invoice details display correctly
- Payment button visible
- Payment flow works (test mode)
- Payment confirmation received
- Invoice status updates

---

### Test 4.8: Download Documents
**Objective**: Verify Client can download documents

**Steps:**
1. Login as Client
2. Navigate to /client-portal/documents
3. View available documents
4. Find document: "Tax Return 2024"
5. Click "Download"
6. Verify download initiates
7. Check downloaded file opens correctly
8. Verify file is complete (not corrupted)
9. Check for watermark or client name (if applicable)
10. Attempt to download encrypted document
11. Verify decryption works (if applicable)

**Expected Results:**
- Documents list accessible
- Download button works
- File downloads successfully
- File integrity maintained
- Encryption/decryption works
- Only authorized documents accessible

---

### Test 4.9: Access Restrictions - Cannot See Other Clients
**Objective**: Verify Client can only see their own data

**Steps:**
1. Login as Client (david@technova.com)
2. Navigate to /client-portal/documents
3. Verify only TechNova documents visible
4. Verify no documents from other clients appear
5. Attempt to navigate to another client's URL (if known)
6. Verify access denied or redirect
7. Check tasks - should only see own tasks
8. Check forms - should only see own forms
9. Verify no access to internal team communications

**Expected Results:**
- Data isolation enforced
- Only own data visible
- Cross-client access blocked
- Direct URL access blocked
- Role-based restrictions work
- Client portal truly isolated

---

### Test 4.10: Mobile Responsive Client Portal
**Objective**: Verify Client portal works on mobile devices

**Steps:**
1. Login as Client on mobile device OR resize browser to mobile width (375px)
2. Verify client portal dashboard adapts to mobile layout
3. Check mobile navigation (hamburger menu or bottom nav)
4. Navigate to Documents section
5. Verify documents display in mobile-friendly layout
6. Upload document from mobile:
   - Use file picker
   - Take photo (if on actual mobile device)
7. Verify upload works on mobile
8. Navigate to Tasks
9. Complete task on mobile
10. Verify all interactions work on mobile viewport

**Expected Results:**
- Mobile layout activates
- Navigation accessible on mobile
- All features work on mobile
- Touch interactions work
- File upload works on mobile
- Photo upload works (if mobile device)
- Responsive design throughout

---

## Test Suite 5: Cross-Role Workflow Tests

### Test 5.1: Admin Creates Workflow, Employee Executes, Client Interacts
**Objective**: End-to-end workflow across all user types

**Steps:**
1. **Admin Actions**:
   - Login as Admin
   - Navigate to /workflow-builder/new
   - Create workflow: "Year-End Tax Prep 2024"
   - Add stages: "Document Collection" → "Review" → "Filing"
   - Add automation: request_documents from client
   - Assign workflow to client: david@technova.com
   - Assign employee: employee@sterling.com
   - Save and activate workflow

2. **Client Actions**:
   - Logout Admin, Login as Client
   - Navigate to /client-portal/tasks
   - See new task: "Upload Year-End Documents"
   - Upload documents: W2, 1099, receipts
   - Mark task complete

3. **Employee Actions**:
   - Logout Client, Login as Employee
   - Navigate to /assignments
   - See new assignment triggered by client upload
   - Review uploaded documents
   - Add notes: "Documents reviewed, ready for filing"
   - Complete review task
   - Workflow auto-advances to next stage

4. **Admin Verification**:
   - Logout Employee, Login as Admin
   - Navigate to /analytics or workflow dashboard
   - Verify workflow progress tracked correctly
   - View audit trail of all actions
   - Check notifications sent to all parties

**Expected Results:**
- Workflow creates successfully (Admin)
- Client receives task notification
- Client upload triggers next step
- Employee receives assignment
- Employee completion advances workflow
- Admin sees full audit trail
- All notifications sent correctly
- End-to-end automation works

---

## Summary

These individual user type tests cover:
- **Super Admin**: 6 comprehensive tests
- **Admin**: 10 workflow tests
- **Employee**: 8 day-to-day task tests  
- **Client**: 10 client portal tests
- **Cross-Role**: 1 integrated workflow test

**Total: 35 Individual User E2E Tests**

Each test is designed to be executed independently or as part of a comprehensive test suite for release validation.
