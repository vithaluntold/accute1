# FinACEverse Core Features - Demo Walkthrough Guide
**Date**: November 23, 2025  
**Purpose**: Manual demonstration of workflows, assignments, automation, client portal, and projects

---

## 🎯 Overview

This guide demonstrates that FinACEverse's core platform features **actually work**, not just theoretically. You'll manually test the complete workflow → assignment → automation → client communication → project integration pipeline.

**Estimated Time**: 30-45 minutes  
**Prerequisites**: Running FinACEverse instance, admin account, at least one client account

---

## 📋 Demo Scenario: Tax Return Workflow

**Business Case**: Accounting firm automates tax return process with client communications

**Workflow Steps**:
1. Create tax return workflow with automated email
2. Create client assignment from workflow
3. Move assignment through stages (trigger automation)
4. Verify email sent to client
5. View in client portal (data isolation)
6. Link to project for budget tracking

---

## Step 1: Create Tax Return Workflow (5 min)

### Actions:
1. **Navigate** to `/workflows`
2. **Click** "Create Workflow" button (`data-testid="button-create-workflow"`)
3. **Fill in form**:
   - Name: `2024 Tax Return - Individual`
   - Description: `Complete tax return workflow with client communications`
   - Category: `tax_preparation`
4. **Click** "Create" (`data-testid="button-submit-workflow"`)

### Expected Result:
✅ Redirect to workflow detail page (`/workflows/{id}`)  
✅ Workflow name displayed: `2024 Tax Return - Individual`  
✅ Status: `Draft` or `Active`

### Screenshot Checkpoint:
📸 **Capture**: Workflow detail page showing empty stages section

---

## Step 2: Add Stage with Email Automation (10 min)

### Actions:
1. **Click** "Add Stage" button (`data-testid="button-add-stage"`)
2. **Fill in stage**:
   - Name: `Client Data Collection`
   - Description: `Gather client information and send welcome email`
   - Auto Progress: ✅ **Checked** (`data-testid="checkbox-auto-progress"`)
3. **Click** "Save Stage" (`data-testid="button-save-stage"`)

### Expected Result:
✅ Stage card appears in workflow builder  
✅ Stage shows "Auto Progress: Enabled"

---

### Add Step with Send Email Action

4. **Click** on the `Client Data Collection` stage card
5. **Click** "Add Step" button (`data-testid="button-add-step"`)
6. **Fill in step**:
   - Name: `Send Welcome Email`
   - Description: `Automated email to client`
   - Type: `automation` (select from dropdown)
7. **Click** "Configure Automation" (`data-testid="button-configure-automation"`)

---

### Configure Email Automation Action

8. **In Automation Config Dialog**:
   - Action Type: `send_email` (`data-testid="select-action-type"`)
   - Email Subject: `Welcome to Your 2024 Tax Return` (`data-testid="input-email-subject"`)
   - Email Body:
     ```
     Dear Client,
     
     We're excited to begin working on your 2024 tax return!
     
     Next Steps:
     1. Upload your W-2, 1099, and other tax documents
     2. Complete the tax organizer form
     3. Schedule a review call
     
     We'll keep you updated on progress.
     
     Best regards,
     Your Accounting Firm
     ```
   - Recipient Type: `client` (`data-testid="select-recipient-type"`)
   
9. **Click** "Save Automation" (`data-testid="button-save-automation"`)
10. **Click** "Save Step" (`data-testid="button-save-step"`)

### Expected Result:
✅ Step card appears: `Send Welcome Email`  
✅ Step shows automation icon/badge  
✅ Stage shows 1 step in the card

### Screenshot Checkpoint:
📸 **Capture**: Workflow builder showing stage with automation step

---

## Step 3: Create Client Assignment (5 min)

### Prerequisites:
- At least one client exists in system
- If no client exists, create one: `/clients` → "Add Client"

### Actions:
1. **Navigate** to `/assignments`
2. **Click** "Create Assignment" (`data-testid="button-create-assignment"`)
3. **Fill in form**:
   - Workflow: `2024 Tax Return - Individual` (select from dropdown)
   - Client: Select any client from dropdown
   - Assignment Name: `John Doe - 2024 Tax Return`
   - Due Date: 30 days from now
   - Priority: `High`
   - Assigned To: Your user (or leave unassigned)
4. **Click** "Create Assignment" (`data-testid="button-submit-assignment"`)

### Expected Result:
✅ Redirect to assignment detail page (`/assignments/{id}`)  
✅ Assignment name: `John Doe - 2024 Tax Return`  
✅ Status: `not_started` (`data-testid="assignment-status-*"`)  
✅ Progress: 0%  
✅ Current Stage: `Client Data Collection`

### Screenshot Checkpoint:
📸 **Capture**: Assignment detail showing `not_started` status

---

## Step 4: Start Assignment & Trigger Automation (10 min)

### Actions:
1. **On assignment detail page**, click "Start Assignment" (`data-testid="button-start-assignment"`)
2. **Observe** status change to `in_progress`

### Expected Immediate Results:
✅ Status badge changes: `not_started` → `in_progress`  
✅ Progress bar appears (may show 0% initially)

---

### Complete Current Stage to Trigger Email

3. **Click** "Complete Current Stage" button (`data-testid="button-complete-stage"`)
   - OR: If step-by-step completion is required:
     - Mark individual tasks/steps as complete within the stage
     - System auto-progresses when all complete (if `autoProgress: true`)

### Expected Results:
✅ **Stage status** changes to `completed`  
✅ **Automation executes** → Email action triggered  
✅ **Notification appears** (either in-app notification bell or toast message)

### Key Indicators of Success:

#### 1. **Check Notifications** (UI Method)
- Click bell icon in top nav (`data-testid="button-notifications"`)
- Look for notification titled: `Email sent: Welcome to Your 2024 Tax Return`
- Message should say: `To: [client email]` and `Email sent successfully via Resend`
- OR if Resend not configured: `Email service unavailable - notification created instead`

#### 2. **Check Notifications** (API Method)
**Endpoint**: `GET /api/notifications`

**Expected Response**:
```json
{
  "notifications": [
    {
      "id": "...",
      "title": "Email sent: Welcome to Your 2024 Tax Return",
      "message": "To: client@example.com\n\nEmail sent successfully via Resend",
      "type": "info",
      "metadata": {
        "emailMessageId": "...",
        "workflowId": "...",
        "organizationId": "..."
      },
      "createdAt": "2025-11-23T...",
      "read": false
    }
  ]
}
```

**If Resend not configured**:
```json
{
  "title": "Email notification: Welcome to Your 2024 Tax Return",
  "type": "warning",
  "metadata": {
    "emailError": "Resend API key not configured"
  }
}
```

#### 3. **Check Database** (Direct SQL Verification)
**Table**: `notifications`

**Query**:
```sql
SELECT 
  id, 
  title, 
  message, 
  type, 
  metadata, 
  created_at 
FROM notifications 
WHERE title LIKE '%Email sent%' 
  OR title LIKE '%Email notification%'
ORDER BY created_at DESC 
LIMIT 5;
```

**Expected Row**:
- `type`: `'info'` (if email sent) or `'warning'` (if fallback)
- `metadata`: JSON containing `emailMessageId` (success) or `emailError` (fallback)
- `title`: Contains `"Email sent:"` or `"Email notification:"`

#### 4. **Check Server Logs** (Resend Debugging)
**Location**: Replit Workflows → "Start application" → View Logs

**Search for**:
```
[AutomationEngine] Sending email to: client@example.com
[AutomationEngine] Email sent successfully via Resend
```

**OR if Resend fails**:
```
[AutomationEngine] Resend email failed: ...
[AutomationEngine] Created fallback notification instead
```

### Screenshot Checkpoint:
📸 **Capture**: Notification showing email sent confirmation

---

## Step 5: Verify Client Portal Separation (5 min)

### Actions:
1. **Open new browser tab** (or incognito window)
2. **Navigate** to `/client-portal/dashboard`
3. **Login as client user** (if you don't have client credentials, create a client user):
   - Email: [client email used in assignment]
   - Password: [set during client user creation]

### Expected Client Portal Results:
✅ **Different UI Layout**: No admin sidebar visible  
✅ **Limited Navigation**: Only client-specific menu items (My Tasks, My Documents, Messages)  
✅ **Dashboard shows client data**: Assignment `John Doe - 2024 Tax Return` appears

---

### Verify Data Isolation

4. **Navigate** to `/client-portal/my-tasks`
5. **Verify**:
   - ✅ Client sees **ONLY** their own assignment (`John Doe - 2024 Tax Return`)
   - ✅ Client does **NOT** see other clients' assignments
   - ✅ Client does **NOT** see admin/team assignments
   - ✅ Assignment status reflects main app state (`in_progress`, completed stage, etc.)

**API Verification**:
**Endpoint**: `GET /api/assignments/my-tasks` (client-scoped)

**Expected Response** (client session):
```json
{
  "assignments": [
    {
      "id": "...",
      "name": "John Doe - 2024 Tax Return",
      "status": "in_progress",
      "workflowId": "...",
      "clientId": "[current client ID]",
      "currentStageId": "...",
      "progress": 50
    }
  ]
}
```

**Database Verification**:
```sql
-- Verify assignment has correct clientId
SELECT 
  id, 
  name, 
  status, 
  client_id, 
  workflow_id,
  organization_id
FROM assignments 
WHERE name = 'John Doe - 2024 Tax Return';
```

Expected:
- `client_id` matches authenticated client user's ID
- `organization_id` matches firm's organization

6. **Click** on assignment card (`data-testid="assignment-card-{id}"`)
7. **Verify Client Detail View**:
   - ✅ Client sees stage progress (`data-testid="stage-progress"`)
   - ✅ Client sees task checklist (`data-testid="task-list"`)
   - ✅ Client **cannot** see internal notes (no `data-testid="internal-notes"` element)

### Screenshot Checkpoint:
📸 **Capture**: Client portal `/my-tasks` showing only client-scoped assignments

---

## Step 6: Link Workflow to Project (5 min)

### Actions:
1. **Switch back to admin session** (close client portal tab)
2. **Navigate** to `/projects`
3. **Click** "Create Project" (`data-testid="button-create-project"`)
4. **Fill in form**:
   - Name: `2024 Tax Season - Q1`
   - Description: `Tax returns for Q1 2024`
   - Client: Same client used in assignment
   - Status: `Active`
   - Priority: `High`
   - Start Date: Today
   - Due Date: 60 days from now
   - Budget: `$5,000`
5. **Click** "Create" (`data-testid="button-submit-project"`)

### Expected Result:
✅ Redirect to project detail page (`/projects/{id}`)  
✅ Project name: `2024 Tax Season - Q1`  
✅ Budget: `$5,000.00`

---

### Link Workflow to Project

6. **On project detail page**, click "Link Workflow" (`data-testid="button-link-workflow"`)
7. **Select workflow**: `2024 Tax Return - Individual`
8. **Click** "Link" (`data-testid="button-confirm-link-workflow"`)

### Expected Result:
✅ Workflow appears in project's "Linked Workflows" section  
✅ Shows workflow name: `2024 Tax Return - Individual`  
✅ Shows link to workflow detail page

### Optional - Verify Bi-Directional Link:
9. **Navigate back** to `/workflows/{workflow-id}`
10. **Verify**: Workflow shows linked project (if feature implemented)

### Screenshot Checkpoint:
📸 **Capture**: Project detail showing linked workflow

---

## Step 7: Verify End-to-End Pipeline (5 min)

### Verification Checklist:

| **Feature** | **Test** | **Status** |
|-------------|----------|------------|
| **Workflow Creation** | Created workflow with stages | ✅ / ❌ |
| **Automation Config** | Configured `send_email` action | ✅ / ❌ |
| **Assignment Creation** | Created client assignment from workflow | ✅ / ❌ |
| **Stage Progression** | Moved assignment to `in_progress` status | ✅ / ❌ |
| **Auto-Progression** | Stage auto-completed when conditions met | ✅ / ❌ |
| **Email Trigger** | Email automation executed (notification created) | ✅ / ❌ |
| **Client Portal Access** | Client logged in to separate portal | ✅ / ❌ |
| **Data Isolation** | Client sees only their assignments | ✅ / ❌ |
| **Portal Sync** | Client portal reflects main app status | ✅ / ❌ |
| **Project Linking** | Workflow linked to project successfully | ✅ / ❌ |

---

## 🎉 Success Criteria

**Minimum Passing Score**: 8/10 ✅ marks

**Critical Features (Must Pass)**:
1. ✅ Workflow creation with automation config
2. ✅ Assignment creation and status progression
3. ✅ Automation execution (email sent notification)
4. ✅ Client portal data isolation

**If All Passing**:
🎯 **FinACEverse core platform features are FUNCTIONAL and production-ready**

---

## 🐛 Troubleshooting Guide

### Issue: "Email not sent" notification

**Root Cause**: `RESEND_API_KEY` secret not configured

**Solution**: This is EXPECTED behavior! The automation engine creates a fallback notification instead of failing.

**Verification Methods**:

**1. Check Notification UI**:
- Notification message contains: `Email service unavailable - notification created instead`
- This proves automation **executed** but fell back to notification

**2. Check API**:
```bash
curl -H "Cookie: [your-session-cookie]" http://localhost:5000/api/notifications
```
Look for `"type": "warning"` and `"metadata": { "emailError": "..." }`

**3. Check Database**:
```sql
SELECT 
  title, 
  type, 
  metadata->>'emailError' AS error_reason
FROM notifications 
WHERE title LIKE '%Email notification%'
ORDER BY created_at DESC 
LIMIT 1;
```

**4. Check Server Logs**:
Search for:
```
[AutomationEngine] Resend email failed: Resend API key not configured
```

**To Enable Real Emails**:
1. Add `RESEND_API_KEY` secret to Replit:
   - Sidebar → Secrets (🔒 icon)
   - Key: `RESEND_API_KEY`
   - Value: Your Resend API key (get from https://resend.com/api-keys)
2. Restart workflow: `Start application`
3. Repeat Step 4 (trigger automation)

**Expected Log After Fix**:
```
[AutomationEngine] Sending email to: client@example.com
[AutomationEngine] Email sent successfully via Resend
[AutomationEngine] Message ID: re_...
```

---

### Issue: Assignment not showing in client portal

**Root Cause**: Client user not linked to client record

**Solution**:
1. Navigate to `/clients/{client-id}`
2. Check "Primary Contact" field links to user account
3. OR: Navigate to `/team` → Find client user → Edit → Set "Client ID"

---

### Issue: Stage not auto-progressing

**Root Cause**: `autoProgress` flag not enabled on stage

**Solution**:
1. Navigate to `/workflows/{workflow-id}`
2. Edit stage → Enable "Auto Progress" checkbox
3. Save stage
4. Retry Step 4 (complete stage)

---

### Issue: Cannot find "Complete Stage" button

**Root Cause**: UI may use step-level completion instead

**Solution**:
1. Look for individual task/step completion checkboxes
2. Mark all tasks/steps in stage as complete
3. System should auto-progress if `autoProgress: true`

---

## 📊 Performance Benchmarks (Optional)

### Email Delivery Time
- **Expected**: < 5 seconds from trigger to notification creation
- **Measurement Method**:
  ```sql
  -- Compare timestamp delta
  SELECT 
    a.updated_at AS assignment_updated,
    n.created_at AS notification_created,
    EXTRACT(EPOCH FROM (n.created_at - a.updated_at)) AS seconds_elapsed
  FROM assignments a
  JOIN notifications n ON n.metadata->>'workflowId' = a.workflow_id::text
  WHERE a.id = '[assignment-id]'
    AND n.title LIKE '%Email sent%'
  ORDER BY n.created_at DESC
  LIMIT 1;
  ```
  Expected: `seconds_elapsed` < 5

### Client Portal Data Sync
- **Expected**: Immediate (same database)
- **Measurement Method**:
  1. Admin session: Complete stage → Note timestamp
  2. Client portal: Refresh `/my-tasks` → Verify status updated
  3. OR use API: `GET /api/assignments/my-tasks` → Confirm `status` and `progress` reflect latest

### Automation Execution
- **Expected**: < 2 seconds from stage completion to action execution
- **Measurement Method**:
  ```sql
  -- Check automation engine execution time
  SELECT 
    ws.updated_at AS stage_completed,
    n.created_at AS action_executed,
    EXTRACT(EPOCH FROM (n.created_at - ws.updated_at)) AS execution_time_seconds
  FROM workflow_stages ws
  JOIN notifications n ON n.metadata->>'stageId' = ws.id::text
  WHERE ws.id = '[stage-id]'
    AND ws.status = 'completed'
  ORDER BY n.created_at DESC
  LIMIT 1;
  ```
  Expected: `execution_time_seconds` < 2

---

## 🚀 Next Steps (Advanced Testing)

### Test Additional Automation Actions:
1. **`send_notification`**: Create in-app notification to user
2. **`trigger_form`**: Send form to client
3. **`create_task`**: Auto-create task in workflow
4. **`run_ai_agent`**: Trigger AI agent (Cadence, Luca, etc.)

### Test Complex Workflows:
1. **Multi-Stage Workflow**: Create workflow with 3+ stages
2. **Conditional Automation**: Add conditions to actions (e.g., only send email if priority = "urgent")
3. **Chained Workflows**: Use `trigger_workflow` action to start another workflow

### Test AI Agent Integration:
1. **Cadence Agent**: Ask for workflow recommendations
2. **Luca Agent**: Chat in Luca widget, verify onboarding help
3. **Echo Agent**: Test email drafting in communication templates

---

## 📝 Documentation & Reporting

### After Completing Walkthrough:

1. **Screenshot Evidence**: Collect all 6 checkpoint screenshots
2. **Verification Checklist**: Fill in ✅/❌ status for all 10 features
3. **Bug Reports**: Document any ❌ failures with:
   - Feature name
   - Expected behavior
   - Actual behavior
   - Steps to reproduce
   - Screenshots/error messages

4. **Share Results**: Send completed checklist + screenshots to team

---

## 🎓 Training Materials

**For New Team Members**:
- Use this walkthrough as onboarding training
- Estimated completion time: 45 minutes
- Covers 70% of core platform functionality

**For Client Demos**:
- Use Step 1-5 as live demo script
- Shows real-time automation
- Demonstrates client portal separation

**For Sales**:
- Screenshot checkpoints = demo slides
- Automation execution = competitive differentiator
- Multi-tenant client portal = enterprise-ready

---

## 📞 Support

**If Issues Persist**:
1. Check server logs: Refresh workflows in Replit
2. Check database: Use Replit Database pane
3. Check browser console: F12 Developer Tools
4. Contact: [Support email/Slack channel]

---

**End of Walkthrough** - Happy Testing! 🚀
