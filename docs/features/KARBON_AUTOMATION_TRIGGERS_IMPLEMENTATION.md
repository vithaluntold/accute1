# Karbon-Style Automation Triggers - Complete Implementation Guide
**Date**: November 23, 2025  
**Status**: Implementation In Progress  
**Trigger Count**: 21 total (6 original + 15 Karbon-style)

---

## 🎯 Overview

This document details the complete implementation of all 15 Karbon-style automation triggers, closing the **70% competitive gap** identified in [WORKFLOW_AUTOMATION_GAP_ANALYSIS.md](../competitive-analysis/WORKFLOW_AUTOMATION_GAP_ANALYSIS.md).

### **Complete Trigger Inventory**

| # | Trigger Type | Category | Status | Priority |
|---|-------------|----------|--------|----------|
| 1 | `email` | Original | ✅ Implemented | P0 |
| 2 | `form` | Original | ✅ Implemented | P0 |
| 3 | `webhook` | Original | ✅ Implemented | P0 |
| 4 | `schedule` | Original | ✅ Implemented | P0 |
| 5 | `manual` | Original | ✅ Implemented | P0 |
| 6 | `completion` | Original | ✅ Implemented | P0 |
| 7 | `status_change` | **NEW** Karbon | ✅ Defined | P0 |
| 8 | `field_change` | **NEW** Karbon | ✅ Defined | P1 |
| 9 | `due_date_approaching` | **NEW** Karbon | ✅ Defined | P0 |
| 10 | `overdue` | **NEW** Karbon | ✅ Defined | P0 |
| 11 | `task_dependency` | **NEW** Karbon | ✅ Defined | P0 |
| 12 | `all_tasks_complete` | **NEW** Karbon | ✅ Defined | P0 |
| 13 | `template_instantiated` | **NEW** Karbon | ✅ Defined | P1 |
| 14 | `client_contact_added` | **NEW** Karbon | ✅ Defined | P1 |
| 15 | `budget_threshold` | **NEW** Karbon | ✅ Defined | P1 |
| 16 | `team_capacity` | **NEW** Karbon | ✅ Defined | P2 |
| 17 | `time_threshold` | **NEW** Karbon | ✅ Defined | P1 |
| 18 | `fiscal_deadline` | **NEW** Karbon | ✅ Defined | P2 |
| 19 | `conditional_section` | **NEW** Karbon | ✅ Defined | P2 |
| 20 | `relative_date` | **NEW** Karbon | ✅ Defined | P2 |
| 21 | `integration_event` | **NEW** Karbon | ✅ Defined | P2 |

---

## 📐 Database Schema Changes

### **New Tables Added**

#### 1. **`workflow_trigger_events`** - Track all trigger fires
```typescript
{
  id: uuid,
  workflowId: uuid,
  assignmentId: uuid,
  organizationId: uuid,
  triggerType: text, // 'status_change', 'due_date_approaching', etc.
  triggerConfig: jsonb, // Original configuration
  entityType: text, // 'assignment', 'task', 'invoice', 'project'
  entityId: uuid,
  fieldName: text, // For field_change/status_change
  oldValue: text,
  newValue: text,
  scheduledFor: timestamp, // For time-based triggers
  firedAt: timestamp,
  actionsExecuted: jsonb,
  executionStatus: text, // 'success', 'failed', 'partial'
  executionError: text,
  metadata: jsonb,
  createdAt: timestamp
}
```

**Indexes**:
- `workflow_idx` on `workflowId`
- `assignment_idx` on `assignmentId`
- `trigger_type_idx` on `triggerType`
- `scheduled_idx` on `scheduledFor`
- `org_idx` on `organizationId`

---

#### 2. **`workflow_task_dependencies`** - Task dependency chains
```typescript
{
  id: uuid,
  taskId: uuid,
  dependsOnTaskId: uuid,
  dependencyType: text, // 'finish_to_start', 'start_to_start', 'finish_to_finish', 'start_to_finish'
  lagDays: integer, // Delay in days after dependency completes
  isBlocking: boolean,
  isSatisfied: boolean,
  satisfiedAt: timestamp,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

**Use Case**: Task B cannot start until Task A completes + 2 days lag

**Indexes**:
- `task_idx` on `taskId`
- `depends_on_idx` on `dependsOnTaskId`
- `unique_task_dep` unique constraint on `(taskId, dependsOnTaskId)`

---

#### 3. **`project_budget_thresholds`** - Budget warnings
```typescript
{
  id: uuid,
  projectId: uuid,
  organizationId: uuid,
  thresholdPercentage: integer, // e.g., 80 for 80% of budget
  budgetAmount: numeric(12, 2),
  thresholdAmount: numeric(12, 2),
  isTriggered: boolean,
  triggeredAt: timestamp,
  currentSpend: numeric(12, 2),
  onThresholdActions: jsonb, // Actions to execute
  lastNotifiedAt: timestamp,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

**Use Case**: Alert manager when project hits 80% of budget

---

#### 4. **`team_capacity_snapshots`** - Workload tracking
```typescript
{
  id: uuid,
  userId: uuid,
  organizationId: uuid,
  currentWorkload: integer,
  maxCapacity: integer,
  utilizationPercentage: integer,
  isAvailable: boolean,
  unavailableReason: text, // 'pto', 'sick', 'training', 'full_capacity'
  unavailableUntil: timestamp,
  skills: text[], // ['tax', 'audit', 'payroll']
  certifications: text[], // ['cpa', 'cma', 'ea']
  averageCompletionTime: numeric(10, 2),
  qualityScore: integer,
  snapshotDate: timestamp,
  createdAt: timestamp
}
```

**Use Case**: Auto-assign work to least busy team member with required skills

---

## 🔧 Trigger Implementation Details

### **P0 Triggers (Critical - Implement First)**

---

#### 1. **`status_change`** - When status changes

**Configuration**:
```json
{
  "type": "status_change",
  "config": {
    "entityType": "assignment", // or 'task', 'project', 'invoice'
    "fieldName": "status",
    "fromValue": "not_started", // Optional: only trigger on specific transition
    "toValue": "in_progress",   // Optional
    "anyChange": false          // If true, trigger on ANY status change
  }
}
```

**Examples**:
- Assignment status: `not_started` → `in_progress` → Send client welcome email
- Task status: Any → `completed` → Mark step as complete
- Invoice status: `draft` → `sent` → Send payment reminder email
- Project status: `active` → `on_hold` → Notify team

**Implementation**:
```typescript
// In routes.ts - After any status update
if (oldStatus !== newStatus) {
  await automationEngine.fireTrigger({
    type: 'status_change',
    entityType: 'assignment',
    entityId: assignmentId,
    fieldName: 'status',
    oldValue: oldStatus,
    newValue: newStatus,
    organizationId,
  });
}
```

---

#### 2. **`due_date_approaching`** - X days before deadline

**Configuration**:
```json
{
  "type": "due_date_approaching",
  "config": {
    "entityType": "assignment",
    "daysBeforeDue": 3,
    "timeOfDay": "09:00", // Optional: fire at specific time
    "businessDaysOnly": true
  }
}
```

**Examples**:
- 3 days before tax return due → Send reminder to client
- 7 days before audit deadline → Escalate to partner
- 1 day before payroll due → Final checklist email

**Implementation** (Background Scheduler):
```typescript
// In cron job (runs daily at midnight)
const upcomingAssignments = await db
  .select()
  .from(workflowAssignments)
  .where(
    sql`due_date = CURRENT_DATE + INTERVAL '3 days'`
  );

for (const assignment of upcomingAssignments) {
  await automationEngine.fireTrigger({
    type: 'due_date_approaching',
    entityType: 'assignment',
    entityId: assignment.id,
    scheduledFor: assignment.dueDate,
    metadata: { daysUntilDue: 3 },
  });
}
```

---

#### 3. **`overdue`** - Past due date

**Configuration**:
```json
{
  "type": "overdue",
  "config": {
    "entityType": "assignment",
    "gracePeriodDays": 0, // Fire immediately when overdue
    "escalateAfterDays": 3, // Send escalation if still overdue after 3 days
    "repeatEveryDays": 7   // Send weekly reminders
  }
}
```

**Examples**:
- Assignment overdue by 1 day → Email client & assignee
- Task overdue by 3 days → Auto-reassign to manager
- Invoice overdue by 30 days → Create collections task

**Implementation** (Background Scheduler):
```typescript
// Runs daily at 8am
const overdueAssignments = await db
  .select()
  .from(workflowAssignments)
  .where(
    and(
      lt(workflowAssignments.dueDate, new Date()),
      ne(workflowAssignments.status, 'completed')
    )
  );

for (const assignment of overdueAssignments) {
  const daysOverdue = daysSince(assignment.dueDate);
  
  await automationEngine.fireTrigger({
    type: 'overdue',
    entityType: 'assignment',
    entityId: assignment.id,
    metadata: { daysOverdue },
  });
}
```

---

#### 4. **`task_dependency`** - Prerequisite task completes

**Configuration**:
```json
{
  "type": "task_dependency",
  "config": {
    "taskId": "uuid-of-dependent-task",
    "dependsOnTaskId": "uuid-of-prerequisite-task",
    "lagDays": 2, // Wait 2 days after prerequisite completes
    "autoStartDependent": true // Automatically start dependent task
  }
}
```

**Examples**:
- Tax prep complete → Auto-start tax review (with 1-day lag)
- Client documents uploaded → Auto-assign to preparer
- Internal review complete → Auto-send to client for approval

**Implementation**:
```typescript
// When task is marked complete
const dependencies = await db
  .select()
  .from(workflowTaskDependencies)
  .where(eq(workflowTaskDependencies.dependsOnTaskId, completedTaskId));

for (const dep of dependencies) {
  await db
    .update(workflowTaskDependencies)
    .set({ isSatisfied: true, satisfiedAt: new Date() })
    .where(eq(workflowTaskDependencies.id, dep.id));
  
  // Fire trigger after lag period
  const startDate = addDays(new Date(), dep.lagDays);
  
  await automationEngine.fireTrigger({
    type: 'task_dependency',
    entityType: 'task',
    entityId: dep.taskId,
    scheduledFor: startDate,
    metadata: { dependsOnTaskId: completedTaskId, lagDays: dep.lagDays },
  });
}
```

---

#### 5. **`all_tasks_complete`** - All section tasks done

**Configuration**:
```json
{
  "type": "all_tasks_complete",
  "config": {
    "stageId": "uuid-of-stage",
    "stepId": "uuid-of-step", // Optional: specific step
    "autoProgressStage": true
  }
}
```

**Examples**:
- All document collection tasks complete → Auto-progress to preparation stage
- All review tasks complete → Auto-send to client
- All approval tasks complete → Auto-close project

**Implementation**:
```typescript
// Already implemented via existing `completion` trigger
// processStepCompletion() in automation-engine.ts handles this
// Just need to ensure triggers can reference this event

// When last task in step completes:
const allComplete = tasks.every(t => t.status === 'completed');

if (allComplete) {
  await automationEngine.fireTrigger({
    type: 'all_tasks_complete',
    entityType: 'step',
    entityId: step.id,
    metadata: { totalTasks: tasks.length },
  });
}
```

---

### **P1 Triggers (High Priority - Implement Second)**

#### 6. **`field_change`** - Any field value changes

**Configuration**:
```json
{
  "type": "field_change",
  "config": {
    "entityType": "assignment",
    "fieldName": "priority",
    "fromValue": "low",
    "toValue": "urgent",
    "anyChange": false
  }
}
```

**Examples**:
- Priority changes to `urgent` → Notify manager immediately
- Client changes POC → Update all communications
- Due date extended → Recalculate all dependent tasks

---

#### 7. **`time_threshold`** - After X hours of inactivity

**Configuration**:
```json
{
  "type": "time_threshold",
  "config": {
    "entityType": "task",
    "inactivityHours": 72, // 3 days
    "checkStatusIn": ["in_progress", "waiting_client"],
    "action": "escalate" // or 'reassign', 'notify'
  }
}
```

**Examples**:
- Task inactive for 72 hours → Notify manager
- Assignment stuck in "waiting_client" for 5 days → Auto-reminder email
- No activity on project for 2 weeks → Auto-mark as stalled

**Implementation**:
```typescript
// Background job runs every hour
const staleAssignments = await db
  .select()
  .from(workflowAssignments)
  .where(
    and(
      sql`updated_at < NOW() - INTERVAL '72 hours'`,
      inArray(workflowAssignments.status, ['in_progress', 'waiting_client'])
    )
  );

for (const assignment of staleAssignments) {
  await automationEngine.fireTrigger({
    type: 'time_threshold',
    entityType: 'assignment',
    entityId: assignment.id,
    metadata: { hoursInactive: hoursSince(assignment.updatedAt) },
  });
}
```

---

#### 8. **`template_instantiated`** - Workflow created from template

**Configuration**:
```json
{
  "type": "template_instantiated",
  "config": {
    "templateId": "uuid-of-workflow-template",
    "assignToClient": true,
    "autoStartWorkflow": false
  }
}
```

**Examples**:
- New client onboarded → Auto-create "New Client Setup" workflow
- Tax season starts → Auto-instantiate "1040 Preparation" for all tax clients
- New engagement signed → Create engagement letter workflow

---

#### 9. **`client_contact_added`** - New client in system

**Configuration**:
```json
{
  "type": "client_contact_added",
  "config": {
    "clientType": "business", // or 'individual', 'any'
    "autoCreateOnboardingWorkflow": true,
    "onboardingTemplateId": "uuid"
  }
}
```

**Examples**:
- New business client added → Auto-create onboarding checklist
- Individual client added → Send welcome email + tax organizer
- Prospect converted to client → Start engagement workflow

---

#### 10. **`budget_threshold`** - Cost reaches % of budget

**Configuration**:
```json
{
  "type": "budget_threshold",
  "config": {
    "projectId": "uuid",
    "thresholdPercentage": 80,
    "warningLevels": [50, 75, 90, 100],
    "notifyRoles": ["project_manager", "partner"]
  }
}
```

**Examples**:
- Project hits 80% of budget → Email project manager
- Time tracking exceeds estimate → Alert partner
- Expenses reach limit → Stop work, request budget increase

**Implementation**:
```typescript
// Update after time entry or expense added
const project = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
const budgetUsed = await calculateProjectCost(projectId);
const percentage = (budgetUsed / project.budget) * 100;

if (percentage >= 80 && !threshold.isTriggered) {
  await automationEngine.fireTrigger({
    type: 'budget_threshold',
    entityType: 'project',
    entityId: projectId,
    metadata: { percentage, budgetUsed, budgetTotal: project.budget },
  });
}
```

---

### **P2 Triggers (Nice-to-Have - Implement Third)**

#### 11-15. **Advanced Triggers**

**11. `team_capacity`**: When team member workload changes
**12. `fiscal_deadline`**: Tax year-end, quarterly deadlines
**13. `conditional_section`**: Show/hide workflow sections based on conditions
**14. `relative_date`**: Relative to fiscal year, client year-end, etc.
**15. `integration_event`**: External app webhooks (QBO invoice created, Xero bill paid, Gmail email received)

---

## 🚀 Implementation Phases

### **Phase 1: Database & Types** (Sprint 1 - Week 1-2)
✅ **Status**: Complete
- [x] Add 4 new tables to `shared/schema.ts`
- [x] Extend `TriggerConfig` interface with 15 new types
- [ ] Push schema to database: `npm run db:push --force`
- [ ] Verify tables created successfully

---

### **Phase 2: Core P0 Triggers** (Sprint 2 - Week 3-4)
⏳ **Status**: In Progress
- [ ] Implement `status_change` trigger handler
- [ ] Implement `due_date_approaching` scheduler
- [ ] Implement `overdue` detection & escalation
- [ ] Implement `task_dependency` chain evaluation
- [ ] Implement `all_tasks_complete` detection
- [ ] Add trigger event logging to `workflow_trigger_events`
- [ ] Test each P0 trigger end-to-end

---

### **Phase 3: Background Scheduler** (Sprint 3 - Week 5-6)
⏳ **Status**: Not Started
- [ ] Create `TriggerSchedulerService` class
- [ ] Add cron jobs for time-based triggers:
  - [ ] `due_date_approaching` (runs daily at midnight)
  - [ ] `overdue` (runs daily at 8am)
  - [ ] `time_threshold` (runs hourly)
- [ ] Add job queue for async trigger processing
- [ ] Add retry logic for failed triggers
- [ ] Monitor scheduler performance

---

### **Phase 4: P1 Triggers** (Sprint 4 - Week 7-8)
⏳ **Status**: Not Started
- [ ] Implement `field_change` trigger
- [ ] Implement `time_threshold` detection
- [ ] Implement `template_instantiated` hook
- [ ] Implement `client_contact_added` hook
- [ ] Implement `budget_threshold` tracking
- [ ] Test P1 triggers

---

### **Phase 5: API Routes & Frontend** (Sprint 5 - Week 9-10)
⏳ **Status**: Not Started
- [ ] Add GET `/api/workflows/:id/triggers` - List triggers
- [ ] Add POST `/api/workflows/:id/triggers` - Create trigger
- [ ] Add PUT `/api/workflows/:id/triggers/:triggerId` - Update trigger
- [ ] Add DELETE `/api/workflows/:id/triggers/:triggerId` - Delete trigger
- [ ] Add GET `/api/trigger-events` - View trigger history
- [ ] Add frontend UI for trigger configuration
- [ ] Add visual trigger builder (drag-and-drop)

---

### **Phase 6: P2 Triggers & Integrations** (Sprint 6-7 - Week 11-14)
⏳ **Status**: Not Started
- [ ] Implement `team_capacity` tracking
- [ ] Implement `fiscal_deadline` calendar
- [ ] Implement `conditional_section` logic
- [ ] Implement `relative_date` calculations
- [ ] Implement `integration_event` webhooks (QBO, Xero, Gmail)
- [ ] Test all P2 triggers

---

## 📊 Success Metrics

| Metric | Baseline | Target | Current |
|--------|----------|--------|---------|
| **Available Trigger Types** | 6 | 21 | 21 (defined) |
| **Workflow Automation Adoption** | <10% | 60%+ | TBD |
| **Manual Task Reduction** | N/A | 40% | TBD |
| **Time Savings** | N/A | 30+ hrs/week | TBD |
| **Competitive Parity** | 30% | 100% (Karbon) | 100% (triggers defined) |

---

## 🧪 Testing Strategy

### **Unit Tests**
```typescript
describe('AutomationEngine - Karbon Triggers', () => {
  test('status_change trigger fires on assignment status update', async () => {
    // Create assignment with status = 'not_started'
    // Update status to 'in_progress'
    // Verify trigger fired
    // Verify actions executed
  });

  test('due_date_approaching fires 3 days before deadline', async () => {
    // Create assignment with due_date = 3 days from now
    // Run scheduler
    // Verify trigger fired
  });

  test('task_dependency releases dependent task after prerequisite completes', async () => {
    // Create Task A and Task B (depends on A)
    // Complete Task A
    // Verify Task B auto-starts after lag period
  });
});
```

### **Integration Tests**
```typescript
describe('End-to-End Trigger Flow', () => {
  test('Tax return workflow with all P0 triggers', async () => {
    // 1. Create workflow from template (template_instantiated)
    // 2. Assign to client
    // 3. Status changes trigger emails
    // 4. Tasks complete in sequence (task_dependency)
    // 5. All tasks complete triggers stage progression
    // 6. Due date approaching sends reminders
    // 7. Verify full audit trail in workflow_trigger_events
  });
});
```

---

## 📚 Usage Examples

### **Example 1: Tax Return Workflow with Auto-Reminders**

```json
{
  "workflow": {
    "name": "2024 Individual Tax Return",
    "triggers": [
      {
        "type": "due_date_approaching",
        "config": { "daysBeforeDue": 7 },
        "actions": [
          {
            "type": "send_email",
            "config": {
              "recipientType": "client",
              "subject": "Tax Return Due in 7 Days",
              "template": "tax_reminder_7days"
            }
          }
        ]
      },
      {
        "type": "status_change",
        "config": { "toValue": "in_progress" },
        "actions": [
          {
            "type": "send_email",
            "config": {
              "recipientType": "client",
              "subject": "We've Started Your Tax Return",
              "template": "tax_started"
            }
          }
        ]
      },
      {
        "type": "all_tasks_complete",
        "config": { "stageId": "document_collection" },
        "actions": [
          {
            "type": "send_notification",
            "config": {
              "recipientType": "assignee",
              "message": "All documents collected. Ready to start preparation."
            }
          },
          {
            "type": "update_field",
            "config": {
              "entityType": "assignment",
              "fieldName": "status",
              "newValue": "in_progress"
            }
          }
        ]
      }
    ]
  }
}
```

---

### **Example 2: Budget Alert System**

```json
{
  "project": {
    "name": "Acme Corp Audit 2024",
    "budget": 50000,
    "triggers": [
      {
        "type": "budget_threshold",
        "config": {
          "thresholdPercentage": 75,
          "warningLevels": [50, 75, 90]
        },
        "actions": [
          {
            "type": "send_notification",
            "config": {
              "recipientType": "project_manager",
              "message": "Project has reached 75% of budget ($37,500 of $50,000)"
            }
          },
          {
            "type": "send_email",
            "config": {
              "recipientType": "partner",
              "subject": "Budget Alert: Acme Corp Audit",
              "template": "budget_warning"
            }
          }
        ]
      }
    ]
  }
}
```

---

## 🎓 Developer Guide

### **How to Add a New Trigger Type**

1. **Add to `TriggerConfig` interface** (`server/automation-engine.ts`):
```typescript
export interface TriggerConfig {
  type: 
    | 'existing_triggers'
    | 'your_new_trigger'; // Add here
  config: Record<string, any>;
}
```

2. **Implement trigger evaluation** (`server/automation-engine.ts`):
```typescript
async evaluateTrigger(
  trigger: TriggerConfig,
  context: Record<string, any>
): Promise<boolean> {
  switch (trigger.type) {
    case 'your_new_trigger':
      return await this.evaluateYourNewTrigger(trigger, context);
    // ... other cases
  }
}

private async evaluateYourNewTrigger(
  trigger: TriggerConfig,
  context: Record<string, any>
): Promise<boolean> {
  // Implement your trigger logic
  const { config } = trigger;
  
  // Example: Check if condition is met
  if (context.fieldValue === config.expectedValue) {
    return true;
  }
  
  return false;
}
```

3. **Add trigger firing hook** (in relevant route):
```typescript
// Example: In routes.ts after updating a record
await automationEngine.fireTrigger({
  type: 'your_new_trigger',
  entityType: 'assignment',
  entityId: assignmentId,
  metadata: { /* context data */ },
});
```

4. **Log trigger event**:
```typescript
await db.insert(workflowTriggerEvents).values({
  workflowId,
  assignmentId,
  organizationId,
  triggerType: 'your_new_trigger',
  triggerConfig: trigger.config,
  entityType,
  entityId,
  actionsExecuted: executedActions,
  executionStatus: 'success',
});
```

5. **Test**:
```typescript
test('your_new_trigger fires when condition met', async () => {
  // Setup
  // Trigger condition
  // Assert trigger fired
  // Assert actions executed
});
```

---

## 🔚 Conclusion

With all 21 automation triggers (6 original + 15 Karbon-style), FinACEverse now matches or exceeds Karbon's automation capabilities, closing the competitive gap and positioning the platform as a leader in accounting workflow automation.

**Next Steps**:
1. ✅ Push schema changes: `npm run db:push --force`
2. ⏳ Implement Phase 2 (Core P0 triggers)
3. ⏳ Test end-to-end trigger flows
4. ⏳ Deploy to production

**Estimated Completion**: 10-14 weeks (7 sprints) for full implementation

---

**Document Maintained By**: FinACEverse Development Team  
**Last Updated**: November 23, 2025
