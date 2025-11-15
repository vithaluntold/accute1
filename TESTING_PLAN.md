# Accute Platform - Comprehensive Testing Plan

## Table of Contents
1. [Authentication & Authorization](#authentication--authorization)
2. [Multi-Role Access Control](#multi-role-access-control)
3. [AI Agent System](#ai-agent-system)
4. [Agent Health Control Panel](#agent-health-control-panel)
5. [AI Personality Profiling & Performance Monitoring](#ai-personality-profiling--performance-monitoring)
6. [WebRTC Voice/Video Calling](#webrtc-voicevideo-calling)
7. [Workflow Automation](#workflow-automation)
8. [Document Management](#document-management)
9. [Payment Processing](#payment-processing)
10. [Email Integration](#email-integration)
11. [Client Portal](#client-portal)
12. [Resource Management](#resource-management)
13. [Team Collaboration](#team-collaboration)
14. [Onboarding Journey](#onboarding-journey)
15. [Performance & Load Testing](#performance--load-testing)
16. [Security Testing](#security-testing)
17. [Cross-Browser & Responsive Testing](#cross-browser--responsive-testing)

---

## 1. Authentication & Authorization

### Test Case 1.1: User Registration & Email Verification
**Priority:** Critical  
**Test Steps:**
1. Navigate to registration page
2. Fill in registration form with valid data (email, password, name)
3. Submit form
4. Verify email sent to user's inbox
5. Click verification link in email
6. Verify redirect to login page with success message

**Expected Results:**
- Registration successful with 201 status
- Verification email sent within 30 seconds
- Email contains valid verification token
- Token verification redirects to login
- User can log in after verification

**Data Requirements:**
- Valid email address (use temp email service for testing)
- Password meeting requirements (min 8 chars, uppercase, lowercase, number)

---

### Test Case 1.2: Multi-Factor Authentication (MFA) Setup
**Priority:** High  
**Test Steps:**
1. Log in as authenticated user
2. Navigate to Security Settings
3. Enable MFA/2FA
4. Scan QR code with authenticator app (Google Authenticator, Authy)
5. Enter TOTP code from authenticator
6. Save backup codes
7. Log out and log back in
8. Verify MFA prompt appears
9. Enter TOTP code to complete login

**Expected Results:**
- QR code displays correctly
- TOTP secret encrypted in database (AES-256-GCM)
- Backup codes generated (bcrypt hashed)
- MFA required on subsequent logins
- Invalid TOTP code rejected with error message

**Security Validation:**
- Verify `totpSecret` in database is encrypted (format: `iv:encryptedData:authTag`)
- Backup codes should be hashed, not plaintext
- Rate limiting applied to TOTP verification (max 5 attempts per 15 minutes)

---

### Test Case 1.3: SSO/SAML Enterprise Authentication
**Priority:** High  
**Test Steps:**
1. Configure SAML IdP (test with Okta/Azure AD)
2. Navigate to SSO login page
3. Click "Sign in with SSO"
4. Redirect to IdP login
5. Enter credentials on IdP
6. Verify redirect back to Accute with authentication
7. Check user profile populated from SAML assertion

**Expected Results:**
- SAML request properly formatted
- Redirect to IdP without errors
- SAML response validated (signature verification)
- User auto-provisioned if new
- Session created with proper JWT token

**Data Requirements:**
- SAML metadata from test IdP
- Test user accounts in IdP
- Valid certificate for signature verification

---

### Test Case 1.4: Replit Auth Integration
**Priority:** Medium  
**Test Steps:**
1. Navigate to login page
2. Click "Sign in with Replit"
3. Authorize application
4. Verify redirect back with user info
5. Check profile populated (email, name, avatar)

**Expected Results:**
- OAuth flow completes successfully
- User profile created/updated
- Session token issued
- Avatar URL saved if provided

---

## 2. Multi-Role Access Control

### Test Case 2.1: Role-Based Permission Enforcement
**Priority:** Critical  
**Test Steps:**
1. Create test users for each role:
   - Super Admin
   - Admin
   - Employee
   - Client
2. For each role, test access to protected routes:
   - `/admin/users` (Super Admin, Admin only)
   - `/workflows` (All except Client)
   - `/client-portal` (Client only)
   - `/agent-health` (Super Admin, Admin only)
   - `/personality-analysis` (Admin only)
3. Verify API endpoint access matches role permissions
4. Test privilege escalation attempts (Employee trying to access admin routes)

**Expected Results:**
- Each role can only access authorized routes
- Unauthorized access returns 403 Forbidden
- API endpoints respect RBAC rules
- No privilege escalation possible

**Test Matrix:**

| Route/Action | Super Admin | Admin | Employee | Client |
|--------------|-------------|-------|----------|--------|
| View All Users | ✅ | ✅ | ❌ | ❌ |
| Create Workflows | ✅ | ✅ | ✅ | ❌ |
| Agent Health | ✅ | ✅ | ❌ | ❌ |
| Client Portal | ❌ | ❌ | ❌ | ✅ |
| Personality Analysis | ✅ | ✅ | ❌ | ❌ |
| Team Chat | ✅ | ✅ | ✅ | ❌ |
| Document Upload | ✅ | ✅ | ✅ | ✅ |

---

### Test Case 2.2: Multi-Workspace Support
**Priority:** High  
**Test Steps:**
1. Create user account
2. Create first workspace (Organization A)
3. Verify user's `defaultOrganizationId` set to Organization A
4. Create second workspace (Organization B)
5. Switch to Organization B
6. Verify `defaultOrganizationId` updated to Organization B
7. Log out and log back in
8. Verify user lands in Organization B (default)
9. Switch back to Organization A
10. Verify data isolation (workflows, documents, users)

**Expected Results:**
- User can belong to multiple organizations
- Only one workspace marked as default (`is_default = true`)
- Data properly isolated between organizations
- Switching updates `defaultOrganizationId`
- Re-authentication required after workspace creation/switch

**Database Validation:**
- Check `user_organizations` table has multiple records for user
- Verify partial unique index: only one `is_default = true` per user
- Confirm `organizationId` filter applied to all queries

---

## 3. AI Agent System

### Test Case 3.1: Luca (Chief AI Assistant) - Follow-up Questions
**Priority:** High  
**Test Steps:**
1. Navigate to Luca chat interface (`/agents/luca`)
2. Send ambiguous query: "Help me with accounting"
3. Verify Luca asks 2-3 clarifying questions before answering
4. Provide context: "Specifically tax filing for Q4"
5. Verify Luca provides detailed, focused response
6. Test domain boundaries: ask "What's the weather?"
7. Verify polite refusal with redirect to appropriate resource

**Expected Results:**
- Luca asks clarifying questions for vague queries
- No immediate answers without context
- IRS, tax authorities, tax law are allowed topics (not prohibited)
- Out-of-scope questions politely declined
- Redirect to specialist agents when appropriate

**LLM Configuration:**
- Verify system prompt includes "STRICT ROLE BOUNDARIES" section
- Personality: "Luca now asks follow-up questions BEFORE answering"
- Test with multiple LLM providers (OpenAI, Azure OpenAI, Anthropic)

---

### Test Case 3.2: Cadence (Workflow Automation) - Workflow Building
**Priority:** High  
**Test Steps:**
1. Navigate to Cadence chat (`/agents/cadence`)
2. Request: "Create workflow for invoice approval"
3. Verify Cadence extracts workflow hierarchy
4. Upload sample invoice PDF
5. Verify Cadence parses structure and suggests automation steps
6. Request conversational workflow building
7. Verify Cadence creates multi-step workflow with triggers and actions
8. Test workflow activation

**Expected Results:**
- Document hierarchy extracted successfully
- Workflow suggestions match business logic
- Visual automation created with all steps
- Triggers properly configured
- Actions execute in correct sequence

**File Upload Support:**
- PDF parsing (via `pdf-parse`)
- DOCX extraction (via `mammoth`)
- XLSX/XLS parsing (via `xlsx`)
- CSV parsing
- Text file support

---

### Test Case 3.3: All 10 Agents - Domain Boundary Enforcement
**Priority:** Critical  
**Test Steps:**
For each agent (Cadence, Echo, Forma, Luca, Lynk, OmniSpectra, Parity, Radar, Relay, Scribe):
1. Navigate to agent chat interface
2. Ask in-scope question (related to agent's specialty)
3. Verify detailed, helpful response
4. Ask out-of-scope question (unrelated to specialty)
5. Verify polite refusal with standardized template
6. Verify redirect to appropriate specialist agent

**Expected Results:**
- Each agent refuses out-of-scope questions
- Refusal message includes:
  - Polite acknowledgment
  - Explanation of agent's focus area
  - Redirect to appropriate specialist
- No hallucinated answers outside expertise

**Agent Specialties:**
- **Cadence:** Workflow automation, process optimization
- **Echo:** Communication, team collaboration
- **Forma:** Compliance, regulatory requirements
- **Luca:** General accounting, tax law, IRS guidance (allows tax topics)
- **Lynk:** Integration, third-party connections
- **OmniSpectra:** Analytics, business intelligence
- **Parity:** Reconciliation, financial accuracy
- **Radar:** Risk management, fraud detection
- **Relay:** Client communication, engagement
- **Scribe:** Documentation, record-keeping

---

### Test Case 3.4: Multi-Provider LLM Support
**Priority:** High  
**Test Steps:**
1. Configure workspace-level LLM settings:
   - Provider: OpenAI
   - Model: gpt-4
   - API Key: [workspace key]
2. Test agent conversation (e.g., Luca)
3. Verify conversation uses OpenAI
4. Switch to user-level override:
   - Provider: Anthropic
   - Model: claude-3-5-sonnet-20241022
5. Test agent conversation again
6. Verify conversation uses Anthropic (user override)
7. Remove user override
8. Verify fallback to workspace settings
9. Test with Azure OpenAI

**Expected Results:**
- Two-level configuration hierarchy works correctly
- User-level settings override workspace settings
- Fallback to workspace when user settings absent
- API keys properly encrypted (AES-256-GCM)
- All three providers functional (OpenAI, Azure OpenAI, Anthropic)

**Security Validation:**
- API keys encrypted in database
- Decryption only happens server-side
- No API keys exposed in frontend/logs
- `ENCRYPTION_KEY` environment variable stable across deployments

---

## 4. Agent Health Control Panel

### Test Case 4.1: Real-Time Connection Monitoring
**Priority:** High  
**Test Steps:**
1. Log in as Admin user
2. Navigate to `/agent-health`
3. Verify all 10 AI agents displayed
4. Check health status indicators (green = healthy, red = error)
5. Verify last check timestamp updates in real-time
6. For each agent, verify:
   - Provider name displayed (OpenAI, Azure, Anthropic)
   - Model name shown
   - Response time metric visible
   - Error count (if any)

**Expected Results:**
- All 10 agents visible on dashboard
- Health checks auto-refresh every 60 seconds
- Status indicators accurate (green/yellow/red)
- Response times displayed in milliseconds
- No stale data (timestamps recent)

**Performance:**
- Health checks complete within 5 seconds for all agents
- No UI freezing during checks
- Graceful handling of API timeouts

---

### Test Case 4.2: Manual Health Check Refresh
**Priority:** Medium  
**Test Steps:**
1. On Agent Health dashboard, click "Refresh All" button
2. Verify loading state displayed
3. Wait for health checks to complete
4. Verify all agent statuses updated
5. Check network tab for API calls

**Expected Results:**
- Button disabled during refresh (prevent double-click)
- Loading spinner/skeleton shown
- All agents re-checked via `/api/agent-health/check-all`
- Results update in UI immediately after completion
- Error handling for network failures

**Error Handling:**
- Test with invalid API key (expect error status)
- Test with network disconnection (expect timeout)
- Verify retry mechanism using `refetch()` not just cache invalidation

---

### Test Case 4.3: Individual Agent Health Details
**Priority:** Medium  
**Test Steps:**
1. Click on individual agent card (e.g., Luca)
2. Verify detail modal/panel opens
3. Check detailed metrics:
   - Provider configuration
   - Model configuration
   - Recent response times (chart/graph)
   - Error log (if any failures)
   - Last successful check timestamp
4. Click "Test Agent" button
5. Verify test query sent to agent
6. Check response received and displayed

**Expected Results:**
- Detail view shows comprehensive agent info
- Historical response times graphed
- Error logs human-readable
- Test query returns valid response
- No sensitive data (API keys) exposed

---

### Test Case 4.4: Access Control - Admin/Super Admin Only
**Priority:** Critical  
**Test Steps:**
1. Log in as Employee user
2. Attempt to navigate to `/agent-health`
3. Verify redirect to unauthorized page (403)
4. Attempt direct API call: `GET /api/agent-health`
5. Verify 403 response
6. Log out and log in as Admin
7. Navigate to `/agent-health`
8. Verify access granted
9. Repeat with Super Admin role

**Expected Results:**
- Employee/Client roles: 403 Forbidden
- Admin role: Full access granted
- Super Admin role: Full access granted
- API endpoint enforces same RBAC rules
- No privilege escalation possible

---

## 5. AI Personality Profiling & Performance Monitoring

### Test Case 5.1: Multi-Framework Personality Assessment
**Priority:** High  
**Test Steps:**
1. Log in as Admin user
2. Navigate to Personality Analysis dashboard
3. Select employee user for assessment
4. Complete all 5 framework assessments:
   - Big Five (OCEAN): 50 questions
   - DISC: 24 questions
   - MBTI: 93 questions (or simplified 16-question)
   - Emotional Intelligence: 33 questions
   - Hofstede Cultural Dimensions: 26 questions
5. Submit assessments
6. Verify processing indicator appears
7. Wait for results to populate
8. Check personality profile displays all 5 frameworks

**Expected Results:**
- All 5 frameworks complete without errors
- Scores normalized to 0-1 scale
- Profile stored in database (JSONB format)
- Processing completes within 10 seconds for single user
- Results page shows breakdown by framework

**Data Validation:**
- Big Five scores: openness, conscientiousness, extraversion, agreeableness, neuroticism (all 0-1)
- DISC scores: dominance, influence, steadiness, compliance (all 0-1)
- MBTI: 4-letter type derived (e.g., "INTJ") with confidence scores
- EI scores: self-awareness, self-regulation, motivation, empathy, social skills (all 0-1)
- Hofstede: 6 cultural dimensions (all 0-1)

---

### Test Case 5.2: Batch ML Analysis Job Queue
**Priority:** Critical  
**Test Steps:**
1. Navigate to Personality Analysis Admin Dashboard
2. Click "Batch Analyze" button
3. Select 100 employees for analysis
4. Name batch: "Q4 2024 Analysis"
5. Submit batch job
6. Verify job appears in queue with "pending" status
7. Monitor job progress via WebSocket updates
8. Verify progress percentage increases (10%, 25%, 50%, etc.)
9. Check current phase displays:
   - "framework_analysis"
   - "ml_prediction"
   - "correlation_analysis"
   - "completed"
10. Verify job completes within 5 minutes for 100 users
11. Check final results in job details

**Expected Results:**
- Job created in `ml_analysis_jobs` table
- Status transitions: pending → processing → completed
- Real-time progress updates via WebSocket
- All 100 users processed successfully
- `processed_count = 100`, `failed_count = 0`
- Processing time recorded in `processing_time_ms`

**Performance Metrics:**
- 100 users processed in ~2-3 minutes (target: <5 minutes)
- Throughput: 40+ users/minute
- No server crashes or memory leaks
- Database connections properly managed

---

### Test Case 5.3: Hybrid ML Model Fusion & Predictions
**Priority:** High  
**Test Steps:**
1. After personality assessment complete, view ML predictions
2. Verify predictions for multiple performance metrics:
   - Task Completion Rate
   - Team Collaboration Score
   - Innovation Metrics
   - Client Satisfaction
   - Time Management
3. For each prediction, check:
   - Predicted value (0-1 scale or percentage)
   - Confidence score
   - Prediction interval (95% confidence)
   - Framework breakdown (contribution from each framework)
   - Framework-specific confidence scores
4. Compare predictions across different employees
5. Verify predictions align with actual performance data (if available)

**Expected Results:**
- Predictions generated for all configured metrics
- Confidence scores realistic (0.7-0.95 typical)
- Framework breakdown shows weighted contributions
- High conscientiousness predicts high task completion
- High EI predicts high collaboration scores
- Predictions match actual performance (R² > 0.80)

**ML Model Validation:**
- Ensemble uses all 5 framework-specific models
- Confidence-weighted averaging applied
- Predictions have realistic variance (not all identical)
- Outliers flagged for review

---

### Test Case 5.4: Real-Time Correlation Analysis
**Priority:** High  
**Test Steps:**
1. Navigate to Correlation Insights page
2. Select performance metric: "Task Completion Rate"
3. View correlations with personality traits
4. Verify top correlations displayed:
   - Trait name (e.g., "Big Five: Conscientiousness")
   - Correlation coefficient (-1 to +1)
   - P-value (statistical significance)
   - Sample size
   - Significance badge (highly significant, significant, not significant)
5. Add new performance data for user
6. Trigger correlation recalculation
7. Verify correlations update incrementally (not full recomputation)
8. Check update completes in <1 second

**Expected Results:**
- Correlations sorted by strength (highest first)
- P-values < 0.05 marked as "significant"
- Sample size shown (n = X)
- Incremental updates use Welford's algorithm (O(1) complexity)
- No performance degradation with large datasets (10,000+ users)

**Statistical Validation:**
- Conscientiousness should correlate positively with task completion (r > 0.6)
- Neuroticism should correlate negatively with performance (r < -0.3)
- Emotional intelligence correlates with collaboration (r > 0.5)

---

### Test Case 5.5: Pattern Detection (Quadratic, Interaction, Threshold)
**Priority:** Medium  
**Test Steps:**
1. Navigate to Advanced Analytics page
2. View detected patterns for specific traits
3. Check for quadratic patterns:
   - Select "Conscientiousness" trait
   - Verify inverted-U pattern detected (optimal at ~0.72)
   - Check visualization shows curve with peak
4. Check for interaction effects:
   - Select trait pair: "Openness × Conscientiousness"
   - Verify positive interaction detected
   - Check effect size and p-value
5. Check for threshold effects:
   - Select "Emotional Intelligence" trait
   - Verify threshold detected at 0.65 for managers
   - Check slope before/after threshold differs significantly

**Expected Results:**
- Patterns automatically detected via algorithms
- Quadratic patterns: inverted-U or U-shaped curves
- Interaction effects: synergy between trait pairs
- Threshold effects: performance plateaus or jumps
- All patterns statistically significant (p < 0.05)
- Visualizations clear and interpretable

**Business Insights:**
- Over-perfectionism detected (conscientiousness > 0.85)
- Synergistic trait combinations identified
- Minimum thresholds for specific roles

---

### Test Case 5.6: Missing Data Imputation
**Priority:** Medium  
**Test Steps:**
1. Create user with partial personality profile (only Big Five + DISC)
2. Missing: MBTI, EI, Hofstede (3 of 5 frameworks)
3. Trigger ML prediction
4. Verify imputation occurs using correlation-based method
5. Check `_imputation_flags` metadata attached to profile
6. Verify confidence penalty applied to predictions
7. Compare prediction accuracy:
   - Complete data user: confidence = 0.91
   - Imputed data user: confidence = 0.79 (reduced)

**Expected Results:**
- Missing scores imputed using correlated traits
- Imputation method logged in metadata
- Confidence penalty proportional to missing data
- Predictions still reasonably accurate (R² > 0.75)
- Fallback to population mean if no correlates available

**Imputation Methods:**
- "correlated_imputation": uses available framework correlations
- "population_mean": fallback when insufficient data
- Confidence penalty: `exp(-2 * imputation_ratio)`

---

## 6. WebRTC Voice/Video Calling

### Test Case 6.1: Outgoing Voice Call - Team Chat
**Priority:** High  
**Test Steps:**
1. Log in as User A (Employee)
2. Navigate to Team Chat
3. Select channel with other members
4. Verify User B is online (green indicator)
5. Click phone icon next to User B's name
6. Verify call initiation:
   - "Calling..." status displayed
   - Outgoing call UI shown with "End Call" button
   - Audio devices enumerated (mic/speakers)
7. User B (in separate browser/device) receives call
8. User B answers call
9. Verify audio connection established
10. Speak and verify User B hears audio
11. User B speaks, verify User A hears audio
12. Click "End Call" button
13. Verify call disconnected cleanly

**Expected Results:**
- Call button disabled until connected and idle
- WebRTC peer connection established (peer-to-peer)
- ICE candidates exchanged via WebSocket signaling
- Audio streams both directions (full-duplex)
- Call ends cleanly without errors
- Call history logged in database

**Technical Validation:**
- Check WebSocket messages: `call:initiate`, `call:accept`, `call:ice-candidate`, `call:end`
- Verify ICE connection state: `new → checking → connected`
- Audio tracks active during call
- No memory leaks after call ends

---

### Test Case 6.2: Incoming Call - Accept/Reject
**Priority:** High  
**Test Steps:**
1. User A initiates call to User B
2. User B (different browser) receives incoming call modal
3. Verify modal displays:
   - Caller name (User A)
   - Caller avatar
   - "Accept" button (green)
   - "Reject" button (red)
   - Ringtone plays (audio alert)
4. Test "Reject" flow:
   - Click "Reject" button
   - Verify modal closes
   - User A sees "Call Declined" message
   - Call history shows "rejected" status
5. Test "Accept" flow:
   - User A calls User B again
   - User B clicks "Accept"
   - Verify call connects successfully
   - Audio streams both ways

**Expected Results:**
- Incoming call modal appears within 1 second
- Ringtone plays (can be muted)
- Reject stops ringtone and closes modal
- Accept establishes peer connection
- User A notified of reject/accept immediately
- No phantom calls after reject

**UI/UX Validation:**
- Modal uses controlled dialog pattern
- `handledRef` prevents duplicate modals
- Modal auto-dismisses if caller cancels
- Ringtone stops on accept/reject/timeout

---

### Test Case 6.3: Video Call Upgrade
**Priority:** High  
**Test Steps:**
1. Start voice-only call between User A and User B
2. During call, User A clicks "Enable Video" button
3. Verify video permission prompt appears
4. Grant camera access
5. Verify User A's video appears locally (self-view)
6. User B receives video stream
7. Verify User B sees User A's video
8. User B enables their video
9. Verify both users see each other's video
10. Toggle video off/on multiple times
11. Verify video tracks stop/start correctly
12. End call
13. Verify camera access released (indicator off)

**Expected Results:**
- Video tracks added to existing peer connection
- Self-view shows local video (mirrored)
- Remote video displays peer's stream
- Video toggle works instantly (<500ms latency)
- Camera/mic permissions requested appropriately
- Devices released after call ends

**Performance:**
- Video resolution: 640×480 or higher
- Frame rate: 24+ fps
- No excessive CPU usage (< 50% on modern hardware)
- Audio remains stable when video enabled

---

### Test Case 6.4: Call History & Logging
**Priority:** Medium  
**Test Steps:**
1. Complete several calls (voice + video, accepted + rejected)
2. Navigate to Call History dialog
3. Verify call log displays:
   - Call date/time
   - Caller name
   - Callee name
   - Call type (voice/video)
   - Call status (completed, rejected, missed, failed)
   - Call duration (for completed calls)
4. Filter by date range
5. Filter by call type
6. Search by participant name
7. Export call log as CSV

**Expected Results:**
- All calls logged in database (`call_logs` table)
- Call duration accurate (measured in seconds)
- Missed calls flagged (incoming call not answered)
- Failed calls logged with error reason
- Export includes all filtered records

**Database Schema:**
- `callLogs` table with columns: id, channelId, initiatorId, recipientId, callType, status, duration, startedAt, endedAt

---

### Test Case 6.5: Connection Failure & Recovery
**Priority:** Critical  
**Test Steps:**
1. Start call between User A and User B
2. Simulate network interruption:
   - User A disconnects WiFi for 10 seconds
   - Reconnect WiFi
3. Verify call attempts to reconnect
4. If reconnection fails, verify:
   - Error message displayed
   - Call marked as "failed" in history
   - Clean disconnect (no hanging state)
5. Test STUN/TURN server fallback:
   - Simulate NAT/firewall blocking direct connection
   - Verify call uses TURN relay server
   - Verify audio still works (higher latency acceptable)

**Expected Results:**
- ICE restart attempted on network change
- Timeout after 30 seconds of disconnection
- User notified of connection failure
- No hanging peer connections
- TURN fallback functional (if configured)

**Error Handling:**
- ICE connection failure: "Connection lost. Call ended."
- Permission denied: "Microphone/camera access required."
- No remote stream: "Waiting for remote user..."

---

### Test Case 6.6: Concurrent Multi-User Calling
**Priority:** Medium  
**Test Steps:**
1. User A calls User B (Call 1)
2. While Call 1 active, User C calls User D (Call 2)
3. Verify both calls independent
4. User B ends Call 1
5. Verify Call 2 unaffected
6. Test max concurrent calls per user:
   - User A in active call with User B
   - User C attempts to call User A
   - Verify User A gets "busy" message or second call queued

**Expected Results:**
- Multiple simultaneous calls supported system-wide
- Each call has isolated peer connection
- No cross-talk between calls
- Call waiting/busy logic enforced per user
- WebSocket signaling handles multiple rooms

---

## 7. Workflow Automation

### Test Case 7.1: Visual Workflow Builder
**Priority:** High  
**Test Steps:**
1. Navigate to Workflows page
2. Click "Create Workflow"
3. Name: "Invoice Approval Process"
4. Add trigger: "Document Uploaded" (invoice folder)
5. Add condition: "Invoice Amount > $1000"
6. Add actions:
   - Send notification to manager
   - Create approval task
   - Send email to finance team
7. Add conditional branching:
   - If approved → Send to accounting
   - If rejected → Send back to submitter
8. Save workflow
9. Test by uploading invoice > $1000
10. Verify workflow executes correctly

**Expected Results:**
- Drag-and-drop workflow builder functional
- All 13 action types available
- Conditional logic works (if/else branching)
- Workflow executes automatically on trigger
- All actions complete in sequence
- Context variables propagate between steps

**Action Types Tested:**
1. Send email
2. Create task
3. Update field
4. Send notification
5. Create document
6. Assign user
7. Set deadline
8. Add comment
9. Change status
10. Tag item
11. Generate report
12. Call webhook
13. Custom script

---

### Test Case 7.2: Workflow Templates
**Priority:** Medium  
**Test Steps:**
1. Navigate to Workflow Templates marketplace
2. Browse global templates (built-in)
3. Browse organization templates
4. Select template: "Client Onboarding Workflow"
5. Preview template details
6. Click "Use Template"
7. Customize template:
   - Modify trigger conditions
   - Add/remove actions
   - Update assignees
8. Save as new workflow
9. Activate workflow
10. Test with new client signup

**Expected Results:**
- Global templates visible to all organizations
- Organization templates scoped to org
- Template preview shows full workflow
- Customization doesn't modify original template
- Activated workflow runs successfully

**Template Scoping:**
- Global templates: `scope = 'global'`, `organizationId = null`
- Org templates: `scope = 'organization'`, `organizationId = [org_id]`

---

### Test Case 7.3: Recurring Workflows & Scheduler
**Priority:** High  
**Test Steps:**
1. Create workflow: "Monthly Financial Report"
2. Set trigger: Recurring Schedule
3. Configure schedule:
   - Frequency: Monthly
   - Day: 1st of month
   - Time: 9:00 AM
   - Timezone: America/New_York
4. Add action: Generate report
5. Save and activate
6. Verify next run date calculated correctly
7. Wait for scheduled time (or manually trigger)
8. Verify workflow executes at scheduled time
9. Check execution logged in workflow history

**Expected Results:**
- Scheduler checks every 5 minutes for due workflows
- Next run date calculated using cron-like logic
- Workflow executes at scheduled time (±1 minute tolerance)
- Execution history logged with timestamps
- Multiple recurring workflows run independently

**Scheduler Implementation:**
- Recurring scheduler service runs every 5 minutes
- Query: `SELECT * FROM workflows WHERE recurring = true AND next_run <= NOW()`
- Update `next_run` after execution
- Handle timezone conversions correctly

---

### Test Case 7.4: Task Dependencies & Critical Path
**Priority:** Medium  
**Test Steps:**
1. Create project with task dependencies
2. Define tasks:
   - Task A: Foundation (no dependencies)
   - Task B: Framing (depends on A, lag +2 days)
   - Task C: Electrical (depends on B)
   - Task D: Plumbing (depends on B)
   - Task E: Inspection (depends on C and D, finish-to-start)
3. Save project
4. View Gantt chart visualization
5. Verify critical path highlighted
6. Check task sequence respects dependencies
7. Update Task A completion date
8. Verify dependent tasks auto-reschedule

**Expected Results:**
- All 4 dependency types supported:
  - Finish-to-Start (FS)
  - Start-to-Start (SS)
  - Finish-to-Finish (FF)
  - Start-to-Finish (SF)
- Lag/lead time applied correctly
- Critical path algorithm identifies longest path
- Circular dependencies detected and rejected
- Auto-rescheduling cascades through dependencies

**Validation:**
- No circular dependencies saved
- Critical path calculation accurate
- Gantt chart renders dependencies visually
- Lag time added/subtracted from dates

---

## 8. Document Management

### Test Case 8.1: Secure Document Upload & Encryption
**Priority:** Critical  
**Test Steps:**
1. Navigate to Documents page
2. Click "Upload Document"
3. Select file (PDF, DOCX, XLSX, image)
4. Add metadata:
   - Document name
   - Category (Invoice, Contract, Report, etc.)
   - Tags
   - Permissions (who can view)
5. Upload file
6. Verify upload progress indicator
7. Check document appears in list
8. Download document
9. Verify file integrity (SHA-256 hash match)
10. Check database: verify file encrypted at rest

**Expected Results:**
- File uploads without errors
- Progress indicator shows percentage
- File stored in `/uploads` directory (encrypted)
- Database record in `documents` table
- File encrypted using AES-256-GCM
- Download decrypts file correctly
- SHA-256 hash validates integrity

**Security Validation:**
- Raw file on disk is encrypted (not plaintext)
- Decryption only happens server-side during download
- Encryption IV unique per file
- Authentication tag prevents tampering

---

### Test Case 8.2: Document Version Control
**Priority:** High  
**Test Steps:**
1. Upload document: "Contract_v1.pdf"
2. Edit document externally
3. Upload new version: "Contract_v2.pdf" (same document ID)
4. Verify version history shows v1 and v2
5. View version details:
   - Version number
   - Uploaded by (user)
   - Upload timestamp
   - File size
   - SHA-256 hash
6. Download v1 (older version)
7. Verify correct version downloaded
8. Download v2 (latest version)
9. Compare hashes to ensure different

**Expected Results:**
- Multiple versions stored separately
- Version history ordered by date (newest first)
- Each version has unique SHA-256 hash
- Older versions accessible for download
- No data loss when uploading new version
- Storage uses delta compression (future enhancement)

**Database Schema:**
- `document_versions` table with: documentId, version, filePath, hash, uploadedBy, uploadedAt

---

### Test Case 8.3: PKI Digital Signatures
**Priority:** Medium  
**Test Steps:**
1. Upload important document (e.g., contract)
2. Click "Sign Document" button
3. Verify signature modal appears
4. Enter passphrase (if required)
5. Click "Confirm Signature"
6. Verify digital signature applied
7. Check signature details:
   - Signer name
   - Signature timestamp
   - Public key fingerprint
   - Signature algorithm (RSA-2048 or higher)
8. Download signed document
9. Verify signature using external tool (OpenSSL)
10. Attempt to modify signed document
11. Verify signature invalidated

**Expected Results:**
- Digital signature created using PKI
- Signature stored in database
- Signed document has `.sig` metadata file
- Signature verification succeeds for unmodified docs
- Tampered documents fail verification
- Signature non-repudiation guaranteed

**Cryptographic Validation:**
- RSA-2048 or RSA-4096 key pair
- SHA-256 hash of document
- Signature: `RSA_sign(SHA256(document), private_key)`
- Verification: `RSA_verify(signature, SHA256(document), public_key)`

---

### Test Case 8.4: Folder Hierarchy & Organization
**Priority:** Medium  
**Test Steps:**
1. Create folder structure:
   - Clients
     - Client A
       - Invoices
       - Contracts
     - Client B
   - Internal
     - HR
     - Finance
2. Upload documents to specific folders
3. Navigate folder tree
4. Verify documents appear in correct folders
5. Move document from "Client A/Invoices" to "Client B"
6. Verify document moved successfully
7. Delete empty folder
8. Verify folder deleted

**Expected Results:**
- Hierarchical folder structure supported
- Drag-and-drop move functionality
- Breadcrumb navigation shows path
- Folder permissions inherited by documents
- Empty folders can be deleted
- Non-empty folders require confirmation

**Data Model:**
- `folders` table with `parentId` (self-referencing)
- Documents have `folderId` foreign key
- Recursive queries for tree traversal

---

## 9. Payment Processing

### Test Case 9.1: Razorpay Integration - Client Payment Collection
**Priority:** Critical  
**Test Steps:**
1. Log in as Client user
2. Navigate to Invoices page
3. View outstanding invoice (Amount: $500)
4. Click "Pay Now" button
5. Verify Razorpay checkout modal opens
6. Enter test payment details:
   - Card: 4111 1111 1111 1111
   - Expiry: 12/25
   - CVV: 123
7. Submit payment
8. Verify payment processing
9. Check payment confirmation page
10. Verify invoice status updated to "Paid"
11. Check database: payment logged

**Expected Results:**
- Razorpay SDK initializes correctly
- Checkout modal displays amount and description
- Test payment succeeds (Razorpay test mode)
- Payment confirmation received via webhook
- Invoice status: "pending" → "paid"
- Payment record created in `payments` table
- Email receipt sent to client

**Razorpay Test Cards:**
- Success: 4111 1111 1111 1111
- Failure: 4000 0000 0000 0002
- 3D Secure: 4000 0027 6000 3184

**Security:**
- API keys encrypted in environment
- Webhook signature verified
- Payment idempotency enforced (no duplicate charges)

---

### Test Case 9.2: Stripe Integration - Subscription Billing
**Priority:** High  
**Test Steps:**
1. Log in as Admin user
2. Navigate to Subscription Plans
3. Select plan: "Pro Plan - $99/month"
4. Click "Upgrade to Pro"
5. Verify Stripe checkout session created
6. Redirect to Stripe checkout page
7. Enter test payment:
   - Card: 4242 4242 4242 4242
   - Expiry: Any future date
   - CVV: Any 3 digits
   - ZIP: Any 5 digits
8. Submit payment
9. Redirect back to app
10. Verify subscription activated
11. Check database: subscription record created
12. Wait for next billing cycle (or simulate)
13. Verify auto-renewal charges correctly

**Expected Results:**
- Stripe checkout session created
- Redirect to Stripe-hosted page
- Payment succeeds (test mode)
- Subscription status: "active"
- Recurring billing configured
- Webhooks handle subscription events:
  - `invoice.paid`
  - `invoice.payment_failed`
  - `customer.subscription.deleted`

**Stripe Test Cards:**
- Success: 4242 4242 4242 4242
- Decline: 4000 0000 0000 0002
- 3D Secure: 4000 0025 0000 3155

---

### Test Case 9.3: Multi-Gateway Support & Regional Pricing
**Priority:** Medium  
**Test Steps:**
1. Configure multi-gateway setup:
   - USA: Stripe
   - UAE: PayU
   - India: Razorpay
2. Test user in USA:
   - Verify Stripe gateway selected
   - Prices displayed in USD
3. Test user in UAE:
   - Verify PayU gateway selected
   - Prices displayed in AED
4. Test user in India:
   - Verify Razorpay gateway selected
   - Prices displayed in INR
5. Check regional pricing adjustments:
   - Pro Plan: $99 (USA), AED 360 (UAE), ₹7,500 (India)

**Expected Results:**
- Gateway auto-selected based on user region
- Currency conversion accurate
- Prices displayed in local currency
- Payment gateway SDKs load correctly for each region
- Transaction fees calculated per gateway

**Regional Configuration:**
- `subscription_plans` table: `regionalPricing` JSONB column
- Auto-detection via IP geolocation or user profile
- Manual region override supported

---

### Test Case 9.4: Invoice Generation & PDF Export
**Priority:** High  
**Test Steps:**
1. Create new invoice for client
2. Add line items:
   - Service: "Tax Consulting" - $1,200
   - Service: "Bookkeeping" - $800
   - Subtotal: $2,000
   - Tax (8%): $160
   - Total: $2,160
3. Save invoice
4. Click "Generate PDF"
5. Verify PDF downloads
6. Open PDF and check:
   - Company logo
   - Invoice number
   - Date
   - Client details
   - Itemized list
   - Subtotal, tax, total
   - Payment instructions
7. Email invoice to client
8. Verify email sent with PDF attachment

**Expected Results:**
- PDF generated using jsPDF + jspdf-autotable
- Invoice includes all required fields
- Professional formatting
- Email sent via Resend with attachment
- Invoice stored in database
- Audit trail logged

**PDF Generation:**
- Library: jsPDF
- Table plugin: jspdf-autotable
- Logo embedded as base64 image
- Font: Professional (Helvetica/Arial)

---

## 10. Email Integration

### Test Case 10.1: Gmail OAuth Integration
**Priority:** High  
**Test Steps:**
1. Log in as Employee user
2. Navigate to Email Integration settings
3. Click "Connect Gmail"
4. Verify redirect to Google OAuth consent screen
5. Grant permissions:
   - Read emails
   - Send emails
   - Modify labels
6. Authorize application
7. Verify redirect back to app
8. Check Gmail connected (green indicator)
9. Navigate to Unified Inbox
10. Verify Gmail emails displayed
11. Send email via app using Gmail account
12. Verify email sent successfully

**Expected Results:**
- OAuth flow completes without errors
- Access token stored encrypted in database
- Refresh token enables long-term access
- Emails fetched via Gmail API (IMAP alternative)
- Sent emails appear in Gmail "Sent" folder
- Token refresh automatic (before expiry)

**Security:**
- OAuth tokens encrypted (AES-256-GCM)
- Refresh token rotation enabled
- Token scopes minimal (Gmail read/send only)
- Token revocation supported

**Google OAuth Scopes:**
- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/gmail.send`
- `https://www.googleapis.com/auth/gmail.modify`

---

### Test Case 10.2: Outlook OAuth Integration
**Priority:** High  
**Test Steps:**
1. Navigate to Email Integration settings
2. Click "Connect Outlook"
3. Verify redirect to Microsoft login
4. Sign in with Microsoft account
5. Grant permissions (read/send emails)
6. Verify redirect back to app
7. Check Outlook connected
8. View Outlook emails in Unified Inbox
9. Send email via Outlook account
10. Verify email sent

**Expected Results:**
- Microsoft OAuth (MSAL.js) functional
- Access token retrieved
- Microsoft Graph API calls succeed
- Emails displayed correctly
- Sending works via Graph API
- Calendar integration possible (future)

**Microsoft Graph Scopes:**
- `Mail.Read`
- `Mail.Send`
- `Mail.ReadWrite`

---

### Test Case 10.3: Unified Inbox - Multi-Account Aggregation
**Priority:** Medium  
**Test Steps:**
1. Connect both Gmail and Outlook accounts
2. Navigate to Unified Inbox
3. Verify emails from both accounts displayed
4. Check sorting: newest first
5. Filter by account:
   - Show only Gmail
   - Show only Outlook
   - Show all
6. Search emails across accounts
7. Open email from Gmail
8. Reply to email
9. Verify reply sent via Gmail (not Outlook)

**Expected Results:**
- Emails aggregated from all connected accounts
- Account indicator shows source (Gmail/Outlook)
- Filtering works correctly
- Search spans all accounts
- Reply uses correct sending account
- No email duplication

**Data Model:**
- `email_integrations` table: userId, provider, accessToken, refreshToken
- `emails` table: integrationId, subject, from, to, body, receivedAt
- Real-time sync via polling (every 5 minutes) or webhooks

---

### Test Case 10.4: Email Thread Visualization
**Priority:** Low  
**Test Steps:**
1. Open email conversation (thread)
2. Verify all related emails displayed
3. Check threading logic:
   - Same subject (ignoring Re:/Fwd:)
   - In-Reply-To headers
   - References headers
4. Expand/collapse thread
5. Reply to specific email in thread
6. Verify reply appears in correct position

**Expected Results:**
- Emails grouped by conversation
- Threading based on headers + subject
- Chronological order within thread
- Expand/collapse smooth animation
- Reply threaded correctly

---

## 11. Client Portal

### Test Case 11.1: Client Dashboard & Document Access
**Priority:** High  
**Test Steps:**
1. Log in as Client user
2. Verify redirect to Client Portal dashboard
3. Check dashboard widgets:
   - Outstanding invoices
   - Recent documents
   - Upcoming appointments
   - Messages from accountant
4. Navigate to Documents tab
5. Verify only client-accessible documents visible
6. Attempt to access admin document (direct URL)
7. Verify 403 Forbidden
8. Download permitted document
9. Verify download succeeds

**Expected Results:**
- Client users auto-redirect to portal
- Dashboard shows relevant info only
- Document access restricted by permissions
- No access to internal documents
- Clean, simplified UI for non-technical users

**Access Control:**
- Clients can only see documents tagged with their client ID
- RBAC enforced: `documents.clientId = currentUser.clientId`
- Admin documents hidden from clients

---

### Test Case 11.2: Client Communication - Live Chat
**Priority:** Medium  
**Test Steps:**
1. Client user clicks "Chat with Accountant"
2. Verify live chat window opens
3. Type message: "Need help with invoice"
4. Send message
5. Admin user (in separate browser) sees notification
6. Admin opens chat and replies
7. Client receives reply in real-time (WebSocket)
8. Attach file in chat
9. Verify file uploaded and visible to both parties
10. Close chat
11. Reopen chat
12. Verify message history persisted

**Expected Results:**
- Real-time messaging via WebSocket
- Notifications appear for new messages
- File attachments supported (images, PDFs)
- Chat history saved in database
- Unread message count displays
- Typing indicators show (optional)

**WebSocket Events:**
- `live_chat:message`
- `live_chat:typing`
- `live_chat:file_upload`
- `live_chat:read_receipt`

---

### Test Case 11.3: Invoice Payment & History
**Priority:** High  
**Test Steps:**
1. Client views invoices tab
2. Verify outstanding invoices listed
3. Check invoice details:
   - Amount
   - Due date
   - Status (Pending/Overdue/Paid)
   - Line items
4. Click "Pay Invoice" on overdue invoice
5. Complete payment (Razorpay test)
6. Verify invoice status updates to "Paid"
7. View payment history
8. Download invoice PDF
9. Download payment receipt

**Expected Results:**
- All client invoices visible
- Status accurate (pending/overdue/paid)
- Payment gateway integration works
- Immediate status update after payment
- Payment history shows all transactions
- PDF downloads functional

---

## 12. Resource Management

### Test Case 12.1: Resource Allocation Planner
**Priority:** High  
**Test Steps:**
1. Log in as Admin user
2. Navigate to Resource Management
3. View team capacity calendar
4. Check current allocations:
   - User A: 80% allocated (32h/week)
   - User B: 120% allocated (48h/week) - OVERALLOCATED
5. Create new project allocation:
   - Project: "Tax Audit 2024"
   - Assign User C
   - Hours: 20h/week
   - Duration: 4 weeks
6. Submit allocation
7. Verify conflict detection:
   - User C already allocated 30h/week
   - New allocation would exceed 40h/week
   - Warning displayed
8. Override conflict (optional)
9. View distribution charts
10. Check over-allocation warnings highlighted in red

**Expected Results:**
- Real-time conflict detection
- Visual indicators for over-allocation (red)
- Capacity planning shows total team hours
- Allocation editable with drag-and-drop
- Warnings prevent accidental overload

**Business Logic:**
- Max hours/week per employee: 40 (configurable)
- Over-allocation threshold: 100%
- Warning threshold: 90%

---

### Test Case 12.2: Skills Management & Taxonomy
**Priority:** Medium  
**Test Steps:**
1. Admin creates skill taxonomy:
   - Category: "Tax"
     - Skills: Corporate Tax, Individual Tax, International Tax
   - Category: "Audit"
     - Skills: Financial Audit, Compliance Audit, IT Audit
   - Category: "Software"
     - Skills: Excel, QuickBooks, SAP
2. Save taxonomy
3. Admin assigns skills to employees:
   - User A: Corporate Tax (Expert), Excel (Advanced)
   - User B: Financial Audit (Intermediate), QuickBooks (Beginner)
4. Employee self-reports proficiency level
5. Admin reviews and approves/edits
6. View skills matrix report
7. Filter employees by skill: "Corporate Tax (Expert)"
8. Verify User A appears in results

**Expected Results:**
- Hierarchical skill taxonomy supported
- Skills assigned with proficiency levels (Beginner, Intermediate, Advanced, Expert)
- Self-service skill updates (pending admin approval)
- Skills matrix shows all employee skills
- Filtering and search functional
- Skill gaps identified (required skills with no experts)

**Database Schema:**
- `skills` table: id, name, categoryId
- `user_skills` table: userId, skillId, proficiencyLevel, approvedBy

---

### Test Case 12.3: Task Matching Engine
**Priority:** Medium  
**Test Steps:**
1. Create task: "Corporate Tax Filing for Client X"
2. Mark required skills:
   - Corporate Tax (Expert level required)
   - Excel (Advanced level required)
3. Click "Suggest Assignees"
4. Verify skill matching algorithm runs
5. Check ranked suggestions:
   - User A: 95% match (has both skills at required levels)
   - User C: 70% match (has Corporate Tax but Excel only Intermediate)
   - User D: 40% match (has neither skill)
6. Select User A
7. Assign task
8. Verify task appears in User A's queue

**Expected Results:**
- Matching algorithm ranks users by skill fit
- Match percentage displayed
- Availability checked (not over-allocated)
- Suggestions sorted by best match
- Manual override supported
- Task assignment creates notification

**Matching Algorithm:**
- Score = (skill match × proficiency match × availability) / 100
- Skill match: percentage of required skills possessed
- Proficiency match: actual level vs. required level
- Availability: remaining capacity percentage

---

## 13. Team Collaboration

### Test Case 13.1: Team Chat Channels
**Priority:** High  
**Test Steps:**
1. Create team channel: "Tax Team"
2. Add members: User A, User B, User C
3. User A posts message: "Let's review Q4 filings"
4. Verify all members receive notification
5. User B replies: "Sounds good"
6. User C reacts with thumbs up emoji
7. User A @mentions User B: "@UserB can you review the draft?"
8. Verify User B gets specific mention notification
9. Pin important message
10. Verify pinned message appears at top
11. Search channel messages for "Q4"
12. Verify search results accurate

**Expected Results:**
- Real-time message delivery (WebSocket)
- @mention notifications work
- Emoji reactions functional
- Message pinning works
- Search indexes messages
- Message history paginated
- Unread indicators accurate

---

### Test Case 13.2: Thread Replies
**Priority:** Medium  
**Test Steps:**
1. User A posts message in channel
2. User B clicks "Reply" on that message
3. Type threaded reply: "Here's my feedback"
4. Submit reply
5. Verify reply nested under original message
6. User C replies to same thread
7. Verify both replies grouped
8. Expand/collapse thread
9. View thread in sidebar (optional)
10. Reply to reply (3rd level nesting)
11. Verify max nesting depth enforced (3 levels)

**Expected Results:**
- Threaded conversations supported
- Replies visually indented
- Max depth: 3 levels
- Thread collapse/expand smooth
- Reply count badge shows on parent
- Navigation within threads easy

**UI Pattern:**
- Level 1: No indent
- Level 2: `ml-8` (32px indent)
- Level 3: `ml-16` (64px indent)
- Level 4+: Capped at `ml-16` (visual limit)

---

### Test Case 13.3: File Sharing in Chat
**Priority:** Medium  
**Test Steps:**
1. In team chat, click "Attach File"
2. Select file (PDF, image, document)
3. Upload file
4. Verify upload progress shown
5. Message posted with file attachment
6. Other users click file to download
7. Verify download works
8. Check file stored in `/uploads/chat/`
9. Verify file permissions (only channel members)

**Expected Results:**
- File upload UI clear
- Progress indicator during upload
- File link appears in message
- Download restricted to channel members
- File previews for images
- Max file size enforced (10MB default)

---

## 14. Onboarding Journey

### Test Case 14.1: 21-Day Onboarding Gamification
**Priority:** Medium  
**Test Steps:**
1. Create new employee account
2. Verify onboarding dashboard appears
3. Check Day 1 tasks:
   - Complete profile (20 points)
   - Upload avatar (10 points)
   - Connect email (15 points)
4. Complete Day 1 tasks
5. Verify points awarded
6. Check progress bar updates (Day 1/21 complete)
7. Return next day
8. Check Day 2 tasks unlocked
9. Complete Day 2 tasks
10. Verify streak increments (2-day streak)
11. Skip Day 3
12. Return Day 4
13. Verify streak resets to 1

**Expected Results:**
- 21 days of guided tasks
- Points awarded for completion
- Streak tracking (consecutive login days)
- Progress visualization (day counter, points)
- Badges earned at milestones (Day 7, Day 14, Day 21)
- Completion confetti animation on Day 21

**Gamification Mechanics:**
- Daily login: +5 points
- Task completion: 10-30 points per task
- 7-day streak: "Week Warrior" badge
- 21-day completion: "Onboarding Champion" badge + confetti

---

### Test Case 14.2: Region-Specific Onboarding
**Priority:** Low  
**Test Steps:**
1. Create user in USA region
2. Check onboarding tasks specific to USA:
   - Setup W-9 form
   - Connect US bank account
3. Create user in UAE region
4. Check different tasks:
   - Setup Emirates ID
   - Connect UAE bank account
5. Create user in India region
6. Check India-specific tasks:
   - Setup PAN card
   - Configure GST details

**Expected Results:**
- Tasks customized by region
- Region detected from user profile or IP
- Compliance requirements per region
- Localized language (future)

---

## 15. Performance & Load Testing

### Test Case 15.1: Concurrent User Load
**Priority:** Critical  
**Test Steps:**
1. Use load testing tool (Apache JMeter, k6)
2. Simulate 500 concurrent users
3. Distribute load:
   - 200 users: browsing dashboards
   - 150 users: uploading documents
   - 100 users: running workflows
   - 50 users: WebRTC calls
4. Run test for 30 minutes
5. Monitor metrics:
   - Response time (p50, p95, p99)
   - Throughput (requests/sec)
   - Error rate
   - CPU usage
   - Memory usage
   - Database connections

**Expected Results:**
- p95 response time < 500ms
- p99 response time < 1000ms
- Error rate < 0.1%
- CPU usage < 70%
- Memory usage stable (no leaks)
- Database connections < 100 active
- No deadlocks or timeouts

**Load Test Configuration:**
- Ramp-up: 50 users/minute
- Duration: 30 minutes
- Think time: 5-10 seconds between requests
- Regions: Distribute across USA, UAE, India

---

### Test Case 15.2: Database Query Performance
**Priority:** High  
**Test Steps:**
1. Populate database with realistic data:
   - 10,000 users
   - 100,000 documents
   - 50,000 workflows
   - 1,000,000 messages
2. Run complex queries:
   - Search documents by tag across all users
   - Aggregate workflow statistics by organization
   - Fetch chat history with pagination
   - Calculate personality correlations for 10,000 users
3. Measure query execution time
4. Identify slow queries (>100ms)
5. Add indexes to optimize
6. Re-run queries
7. Verify performance improved

**Expected Results:**
- No query exceeds 100ms (p95)
- Indexes cover all common query patterns
- EXPLAIN ANALYZE shows efficient execution plans
- No table scans on large tables
- Pagination prevents loading excessive rows

**Index Optimization:**
- `users(organizationId, isActive)`
- `documents(organizationId, createdAt)`
- `workflows(organizationId, status)`
- `chat_messages(channelId, createdAt DESC)`
- `personality_profiles(userId, organizationId)`

---

### Test Case 15.3: File Upload/Download Throughput
**Priority:** Medium  
**Test Steps:**
1. Upload 100 files simultaneously (5MB each)
2. Measure upload time
3. Calculate throughput (MB/sec)
4. Download 100 files simultaneously
5. Measure download time
6. Check server resource usage during transfers

**Expected Results:**
- Upload throughput: > 50 MB/sec aggregate
- Download throughput: > 100 MB/sec aggregate
- No timeouts during large transfers
- Streaming used for large files (no full-memory buffering)
- Concurrent uploads limited to prevent overload (max 10/user)

---

## 16. Security Testing

### Test Case 16.1: SQL Injection Prevention
**Priority:** Critical  
**Test Steps:**
1. Attempt SQL injection on login form:
   - Username: `admin' OR '1'='1`
   - Password: `password`
2. Verify login fails
3. Attempt SQL injection on search:
   - Query: `test'; DROP TABLE users; --`
4. Verify search returns no results (not execute SQL)
5. Check database logs for SQL errors
6. Verify parameterized queries used everywhere

**Expected Results:**
- All SQL injection attempts fail
- No SQL execution from user input
- Drizzle ORM prevents raw SQL injection
- Parameterized queries enforced
- No data leaked via error messages

**Validation:**
- All database queries use Drizzle ORM
- No string concatenation for SQL
- Input validation on all endpoints
- Error messages generic (no SQL details)

---

### Test Case 16.2: Cross-Site Scripting (XSS) Prevention
**Priority:** Critical  
**Test Steps:**
1. Attempt stored XSS in chat:
   - Message: `<script>alert('XSS')</script>`
2. Verify message sanitized (script tags removed)
3. Attempt reflected XSS via URL:
   - Navigate to: `/search?q=<script>alert('XSS')</script>`
4. Verify no script execution
5. Attempt DOM-based XSS:
   - Manipulate client-side JavaScript to inject HTML
6. Verify React's XSS protection active

**Expected Results:**
- No script execution from user input
- HTML sanitized before rendering
- React auto-escapes content by default
- Content Security Policy (CSP) headers set
- No inline scripts allowed

**CSP Headers:**
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';
```

---

### Test Case 16.3: CSRF Protection
**Priority:** High  
**Test Steps:**
1. Obtain valid session token
2. Craft malicious form on external site:
   ```html
   <form action="https://accute.app/api/users/delete" method="POST">
     <input name="userId" value="123">
   </form>
   <script>document.forms[0].submit()</script>
   ```
3. Submit form while logged into Accute
4. Verify request rejected (CSRF token missing)
5. Check for SameSite cookie attribute
6. Verify POST/PUT/DELETE require CSRF token

**Expected Results:**
- All state-changing requests require CSRF token
- CSRF token validated on server
- Requests without token rejected (403)
- SameSite=Strict on session cookies
- No GET requests cause state changes

**Implementation:**
- CSRF token in session
- Token included in form submissions
- Token validated via middleware
- SameSite cookie attribute set

---

### Test Case 16.4: Authentication Bypass Prevention
**Priority:** Critical  
**Test Steps:**
1. Attempt to access protected route without authentication:
   - `GET /api/workflows`
2. Verify 401 Unauthorized
3. Attempt to forge JWT token with invalid signature
4. Verify token rejected
5. Attempt to use expired JWT
6. Verify 401 with "Token expired" message
7. Attempt privilege escalation:
   - Employee user modifies JWT to claim "super_admin" role
8. Verify signature validation prevents tampering

**Expected Results:**
- All protected routes require valid JWT
- JWT signature verified using `JWT_SECRET`
- Expired tokens rejected
- Tampered tokens rejected
- Role-based access enforced server-side (not trust client)

**JWT Validation:**
- Algorithm: HS256 (HMAC with SHA-256)
- Secret: 32+ byte random string
- Expiry: 24 hours (configurable)
- Refresh token for long-lived sessions

---

### Test Case 16.5: Rate Limiting
**Priority:** High  
**Test Steps:**
1. Attempt rapid login requests (brute force):
   - Send 100 login requests in 10 seconds
2. Verify rate limit triggered (max 5 attempts per 15 minutes)
3. Attempt rapid API requests:
   - Send 1000 requests to `/api/workflows`
4. Verify rate limit (max 100 requests/minute per IP)
5. Wait for rate limit window to reset
6. Verify access restored

**Expected Results:**
- Rate limiting enforced per IP and/or user
- Login: 5 attempts per 15 minutes
- API: 100 requests/minute per user
- 429 Too Many Requests status code
- Retry-After header indicates wait time
- Distributed rate limiting (Redis) for multi-server setup

**Rate Limit Configuration:**
- Library: `express-rate-limit`
- Store: In-memory or Redis
- Windows: 1 minute, 15 minutes
- Max requests: Varies by endpoint

---

## 17. Cross-Browser & Responsive Testing

### Test Case 17.1: Browser Compatibility
**Priority:** High  
**Test Steps:**
Test full application flow on each browser:
1. Chrome (latest)
2. Firefox (latest)
3. Safari (latest)
4. Edge (latest)
5. Chrome Mobile (Android)
6. Safari Mobile (iOS)

For each browser, verify:
- Login/logout
- Dashboard loads
- AI agent chat functional
- WebRTC calling works (audio/video)
- File uploads/downloads
- Workflows execute
- No console errors

**Expected Results:**
- Full functionality in all modern browsers
- No browser-specific bugs
- Graceful degradation for older browsers (IE11 not supported)
- WebRTC supported (Chrome, Firefox, Edge, Safari 11+)
- No polyfills needed for modern browsers

---

### Test Case 17.2: Responsive Design (Mobile, Tablet, Desktop)
**Priority:** High  
**Test Steps:**
1. Desktop (1920×1080):
   - Verify sidebar visible
   - Multi-column layouts render correctly
   - All features accessible
2. Tablet (768×1024):
   - Verify sidebar collapses to hamburger menu
   - Single-column layout on narrow screens
   - Touch targets large enough (44×44px min)
3. Mobile (375×667):
   - Verify hamburger menu functional
   - Content stacks vertically
   - Forms usable on small screens
   - Bottom navigation appears (optional)

**Expected Results:**
- Responsive breakpoints: 640px, 768px, 1024px, 1280px
- Sidebar collapsible on mobile
- No horizontal scrolling
- Touch-friendly UI elements
- Progressive Web App (PWA) installable

**Testing Tools:**
- Chrome DevTools device emulation
- BrowserStack for real devices
- Responsive design mode in Firefox

---

## Test Execution Summary

### Test Prioritization

| Priority | Description | Test Cases |
|----------|-------------|------------|
| **Critical** | Core functionality, security, data integrity | 25 test cases |
| **High** | Important features, user experience | 35 test cases |
| **Medium** | Nice-to-have features, edge cases | 20 test cases |
| **Low** | Minor features, future enhancements | 5 test cases |

### Test Coverage Goals

| Area | Target Coverage | Test Cases |
|------|-----------------|------------|
| Authentication & Authorization | 100% | 8 |
| AI Agent System | 95% | 12 |
| WebRTC Calling | 95% | 6 |
| Payment Processing | 100% | 4 |
| Security | 100% | 10 |
| API Endpoints | 90% | Integrated |
| UI Components | 85% | Integrated |

### Test Automation Strategy

**Automated Testing:**
- Unit tests: Jest + React Testing Library
- Integration tests: Playwright (use `run_test` tool)
- API tests: Supertest
- Load tests: k6 or Artillery
- Security scans: OWASP ZAP, Snyk

**Manual Testing:**
- Exploratory testing
- UX/UI review
- Accessibility testing (WCAG 2.1 AA)
- Usability testing with real users

### Test Data Requirements

**Seed Data:**
- 10 test users (2 per role)
- 5 test organizations
- 100 sample documents
- 50 sample workflows
- 1000 chat messages
- 100 personality profiles

**External Services:**
- Test API keys (Razorpay, Stripe, Twilio, Gmail, OpenAI, Anthropic)
- Test IdP for SSO (Okta sandbox or Azure AD test tenant)
- STUN/TURN servers for WebRTC (publicly available or self-hosted)

---

## Defect Tracking & Reporting

### Severity Levels

| Severity | Description | SLA |
|----------|-------------|-----|
| **Critical** | System down, data loss, security breach | Fix within 4 hours |
| **High** | Core feature broken, workaround available | Fix within 1 day |
| **Medium** | Minor feature issue, no workaround | Fix within 1 week |
| **Low** | Cosmetic issue, enhancement | Fix in next release |

### Bug Report Template

```markdown
## Bug Report

**Title:** [Short description]

**Severity:** Critical / High / Medium / Low

**Environment:**
- Browser: Chrome 120
- OS: macOS 14.2
- User Role: Admin
- Organization: Test Org

**Steps to Reproduce:**
1. Navigate to...
2. Click...
3. Observe...

**Expected Result:**
[What should happen]

**Actual Result:**
[What actually happened]

**Screenshots/Videos:**
[Attach evidence]

**Console Errors:**
[Paste any errors]

**Additional Context:**
[Any other relevant info]
```

---

## Sign-Off Criteria

Application ready for production when:
- ✅ All **Critical** test cases pass (100%)
- ✅ All **High** priority test cases pass (>95%)
- ✅ Security audit complete with no critical vulnerabilities
- ✅ Performance benchmarks met (response time, throughput)
- ✅ Browser compatibility verified (Chrome, Firefox, Safari, Edge)
- ✅ Mobile responsiveness validated (iOS, Android)
- ✅ Load testing confirms 500+ concurrent users supported
- ✅ Data backup and recovery tested
- ✅ Monitoring and alerting configured
- ✅ Documentation complete (user guide, admin guide, API docs)

---

**Document Version:** 1.0  
**Created:** November 15, 2024  
**Last Updated:** November 15, 2024  
**Status:** Ready for Test Execution
