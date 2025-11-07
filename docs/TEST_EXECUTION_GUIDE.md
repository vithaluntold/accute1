# Accute - Complete E2E Test Execution Guide

## Overview

This guide provides comprehensive instructions for executing end-to-end tests for the Accute platform. Tests are organized into two categories:

1. **Individual User Tests** (35 tests) - Testing each user role independently
2. **Team Collaboration Scenarios** (5 scenarios) - Testing realistic multi-user workflows

---

## Test Documentation Files

### 1. Individual User Type Tests
**File**: `docs/E2E_TESTS_INDIVIDUAL_USERS.md`

**Test Suites**:
- Suite 1: Super Admin Platform Management (6 tests)
- Suite 2: Admin Organization Owner Workflows (10 tests)
- Suite 3: Employee Day-to-Day Tasks (8 tests)
- Suite 4: Client Portal Experience (10 tests)
- Suite 5: Cross-Role Workflow Tests (1 test)

**Total**: 35 individual tests

### 2. Team Collaboration Scenarios
**File**: `docs/E2E_TESTS_TEAM_SCENARIOS.md`

**Scenarios**:
1. Complete Tax Preparation Workflow (30-45 min)
2. Urgent Audit Response with Team Escalation (20-30 min)
3. Service Marketplace Purchase & Delivery (25-35 min)
4. Multi-Office Client Onboarding with Workflow Automation (20-30 min)
5. Month-End Close with Parallel Workflows (15-25 min)

**Total**: ~110-165 minutes for complete suite

---

## Test Credentials

### Super Admin (Platform Access)
```
Email: superadmin@accute.com
Password: SuperAdmin123!
Super Admin Key: 2d4eaca8c385234bee27fc041c4d428e6df68f55ce4e272020858744944b9427
Organization: None (platform-scoped)
```

### Admin (Sterling Accounting Firm)
```
Email: admin@sterling.com
Password: Admin123!
Organization: Sterling Accounting Firm
Role: Admin
```

### Employee (Sterling Accounting Firm)
```
Email: employee@sterling.com
Password: Employee123!
Organization: Sterling Accounting Firm
Role: Employee
```

### Client (TechNova Solutions)
```
Email: david@technova.com
Password: Client123!
Client of: Sterling Accounting Firm
Role: Client
```

---

## Pre-Test Setup

### Environment Preparation

#### 1. Verify Platform is Running
```bash
# Check if workflow is running
# Should see "Start application" workflow active

# Verify services are up:
# - Frontend: http://localhost:5000
# - Backend API: http://localhost:5000/api
# - WebSockets: ws://localhost:5000
```

#### 2. Database State
```bash
# Verify test data exists
# - Organizations: Sterling Accounting Firm
# - Users: superadmin, admin, employee, client
# - Clients: TechNova Solutions (and others)
# - Workflows: Some existing workflows (count varies)

# Optional: Reset test data if needed
# WARNING: Only do this in test environment
# npm run db:reset (if such script exists)
```

#### 3. Browser Setup
```bash
# For simultaneous multi-user testing:
# - Browser 1: Chrome (for Admin)
# - Browser 2: Firefox (for Employee)
# - Browser 3: Chrome Incognito (for Client)
# - Browser 4: Edge (for Super Admin)

# Clear cache in all browsers before starting
# Enable browser dev tools for monitoring
```

#### 4. Test Files Preparation
Create test files for upload scenarios:
```
test_files/
├── W2_2024.pdf (sample W2 form)
├── 1099_INT_2024.pdf (sample 1099)
├── Bank_Statement_Dec_2024.pdf
├── Tax_Return_Draft.pdf
├── Receipts_Dec_2024.zip
├── Depreciation_Schedule_2024.xlsx
└── Financial_Statements_2024.pdf
```

#### 5. Screen Recording Setup
```bash
# Recommended tools:
# - Mac: QuickTime Player or OBS Studio
# - Windows: OBS Studio or Xbox Game Bar
# - Linux: SimpleScreenRecorder or OBS Studio

# Record critical scenarios for documentation
# Especially: Team collaboration scenarios
```

---

## Test Execution Strategy

### Quick Smoke Test (15 minutes)
Run these tests to verify basic functionality:

1. **Admin Login Test** (Suite 2, Test 2.1)
   - Verify admin can log in
   - Dashboard loads correctly
   - Navigation works

2. **Employee Login Test** (Suite 3, Test 3.1)
   - Verify employee can log in
   - Limited navigation displayed
   - No admin features visible

3. **Client Portal Test** (Suite 4, Test 4.1)
   - Verify client can log in
   - Client portal loads
   - Client-specific UI displayed

4. **Workflow Creation Test** (Suite 2, Test 2.4)
   - Admin creates simple workflow
   - Workflow saves successfully
   - Quota enforcement verified

5. **Document Upload Test** (Suite 4, Test 4.3)
   - Client uploads document
   - Document appears in system
   - Employee receives notification

**Expected Duration**: 15 minutes  
**Pass Criteria**: All 5 tests pass without errors

---

### Core Functionality Test (1 hour)
Run all Suite 2 (Admin) and Suite 3 (Employee) tests:

1. Suite 2: Admin Workflows (10 tests) - ~40 minutes
2. Suite 3: Employee Tasks (8 tests) - ~30 minutes

**Expected Duration**: 70 minutes  
**Pass Criteria**: 80% of tests pass (16/18)

---

### Full Individual User Test (2-3 hours)
Run all 35 individual tests:

1. Suite 1: Super Admin (6 tests) - ~30 minutes
2. Suite 2: Admin (10 tests) - ~45 minutes
3. Suite 3: Employee (8 tests) - ~30 minutes
4. Suite 4: Client Portal (10 tests) - ~40 minutes
5. Suite 5: Cross-Role (1 test) - ~20 minutes

**Expected Duration**: 2-3 hours  
**Pass Criteria**: 90% of tests pass (32/35)

---

### Team Collaboration Test (2-3 hours)
Run all 5 team scenarios:

1. Scenario 1: Tax Preparation (30-45 min)
2. Scenario 2: Urgent Audit (20-30 min)
3. Scenario 3: Service Marketplace (25-35 min)
4. Scenario 4: Multi-Office Onboarding (20-30 min)
5. Scenario 5: Month-End Close (15-25 min)

**Expected Duration**: 110-165 minutes  
**Pass Criteria**: All 5 scenarios complete successfully

---

### Complete Test Suite (4-6 hours)
Run everything:
- All 35 individual tests
- All 5 team scenarios

**Expected Duration**: 4-6 hours  
**Pass Criteria**: 90% overall pass rate

---

## Test Execution Process

### Step-by-Step Execution

#### 1. Select Test Suite
Choose from:
- Quick Smoke Test (15 min)
- Core Functionality Test (1 hour)
- Full Individual User Test (2-3 hours)
- Team Collaboration Test (2-3 hours)
- Complete Test Suite (4-6 hours)

#### 2. Prepare Environment
```bash
# 1. Start application
npm run dev

# 2. Verify services running
curl http://localhost:5000/api/health

# 3. Clear browser cache

# 4. Prepare test files

# 5. Start screen recording (optional)
```

#### 3. Execute Tests

**For Individual Tests:**
1. Open test document: `E2E_TESTS_INDIVIDUAL_USERS.md`
2. Navigate to specific test (e.g., Suite 2, Test 2.1)
3. Follow step-by-step instructions
4. Check each "Expected Result"
5. Note any failures or deviations
6. Take screenshots of issues

**For Team Scenarios:**
1. Open test document: `E2E_TESTS_TEAM_SCENARIOS.md`
2. Navigate to specific scenario (e.g., Scenario 1)
3. Set up multiple browsers for different users
4. Follow phase-by-phase instructions
5. Execute actions in parallel where indicated
6. Verify real-time collaboration features
7. Record completion metrics

#### 4. Document Results

Use this template for each test:

```markdown
## Test: [Test Name]
**Date**: YYYY-MM-DD
**Tester**: [Your Name]
**Environment**: Development/Staging/Production

### Results
- Status: PASS / FAIL / SKIP
- Duration: [X minutes]
- Browser: [Chrome/Firefox/Safari/Edge]

### Issues Found
1. [Issue description]
   - Severity: Critical/Major/Minor
   - Steps to reproduce: ...
   - Expected: ...
   - Actual: ...
   - Screenshot: [link]

2. [Issue description]
   ...

### Notes
- [Any additional observations]

### Recommendations
- [Suggestions for improvement]
```

#### 5. Report Bugs

For each bug found:
1. Create detailed bug report
2. Include screenshots/recordings
3. Note reproduction steps
4. Assign severity level:
   - **Critical**: App crashes, data loss, security issue
   - **Major**: Feature broken, major functionality impacted
   - **Minor**: UI glitch, minor inconvenience
   - **Trivial**: Cosmetic issue

---

## Test Scenarios Execution Examples

### Example 1: Executing "Complete Tax Preparation Workflow"

**Setup** (5 minutes):
1. Open 3 browsers:
   - Browser A: Admin (admin@sterling.com)
   - Browser B: Employee (employee@sterling.com)
   - Browser C: Client (david@technova.com)
2. Prepare test files:
   - W2_TechNova_2024.pdf
   - 1099_Contractors_2024.pdf
   - Business_Receipts_2024.xlsx
3. Start screen recording

**Execution** (30-45 minutes):
1. **Phase 1** (Admin, 5 min): Create workflow
2. **Phase 2** (Client, 5 min): Upload documents
3. **Phase 3** (Employee, 10 min): Review documents
4. **Phase 4** (Admin, 3 min): Request additional docs
5. **Phase 5** (Client, 2 min): Provide additional docs
6. **Phase 6** (Employee, 10 min): Prepare tax return
7. **Phase 7** (Admin, 5 min): Partner review & AI check
8. **Phase 8** (Employee, 3 min): Revisions
9. **Phase 9** (Admin, 3 min): Send for signature
10. **Phase 10** (Client, 2 min): Sign document
11. **Phase 11** (Employee, 2 min): E-file
12. **Phase 12** (Admin, 5 min): Analytics & invoice

**Verification**:
- ✅ All phases completed
- ✅ Documents uploaded/downloaded successfully
- ✅ @mentions triggered notifications
- ✅ AI agent (Parity) provided insights
- ✅ Digital signature captured
- ✅ Time tracking recorded
- ✅ Invoice generated

**Result**: PASS (if all verifications ✅)

---

### Example 2: Executing "Urgent Audit Response"

**Setup** (5 minutes):
1. Open 2 browsers simultaneously:
   - Browser A: Admin
   - Browser B: Employee
   - Browser C: Client
2. Side-by-side arrangement for real-time monitoring
3. Prepare 13 test documents for rapid upload

**Execution** (20-30 minutes):
1. **Phase 1** (Admin, 3 min): Create urgent workflow
2. **Phase 2** (Parallel - 5 min):
   - Client: Uploads documents one by one
   - Employee: Downloads and reviews in real-time
3. **Phase 3** (Parallel - 10 min):
   - Employee: Reviews documents, finds issue
   - Client: Joins live chat to clarify
   - Both: Real-time document annotation
4. **Phase 4** (Employee, 5 min): AI response generation
5. **Phase 5** (Admin, 3 min): Partner review
6. **Phase 6** (Client, 2 min): Urgent signature
7. **Phase 7** (Admin, 3 min): Submission
8. **Phase 8** (Admin, 4 min): Analytics

**Verification**:
- ✅ Real-time document notifications
- ✅ Live chat functionality
- ✅ @mentions in annotations
- ✅ AI agent (Scribe) generated response
- ✅ Urgent signature flow
- ✅ Countdown timers visible
- ✅ Completed before deadline

**Result**: PASS (if all verifications ✅)

---

## Common Issues & Troubleshooting

### Issue 1: User Cannot Log In
**Symptoms**: Login fails, error message displayed

**Troubleshooting**:
1. Verify credentials are correct (check test credentials section)
2. Check if user exists in database
3. Verify password hasn't been changed
4. Check browser console for errors
5. Try clearing browser cache
6. Try different browser

**Resolution**: Reset user password or recreate test user

---

### Issue 2: Workflow Not Advancing
**Symptoms**: Workflow stuck on one stage

**Troubleshooting**:
1. Check if all required tasks completed
2. Verify auto-advance trigger configured correctly
3. Check for errors in browser console
4. Refresh page
5. Check backend logs for errors

**Resolution**: Manually advance workflow or check automation configuration

---

### Issue 3: Notifications Not Received
**Symptoms**: @mentions or notifications not appearing

**Troubleshooting**:
1. Refresh browser
2. Check notification settings for user
3. Verify WebSocket connection active (check network tab)
4. Check if notification service running
5. Try logging out and back in

**Resolution**: Restart WebSocket connection or check notification service

---

### Issue 4: Document Upload Fails
**Symptoms**: Upload progress bar stuck or error

**Troubleshooting**:
1. Check file size (verify not exceeding limit)
2. Check file type (verify supported format)
3. Check network connection
4. Try smaller file
5. Check browser console for errors
6. Verify storage quota not exceeded

**Resolution**: Use smaller file or check storage limits

---

### Issue 5: Real-Time Updates Not Working
**Symptoms**: Changes by one user not visible to other users

**Troubleshooting**:
1. Check WebSocket connection (Network tab)
2. Verify both users logged in
3. Refresh browsers
4. Check if real-time sync enabled
5. Verify both users in same organization

**Resolution**: Refresh browsers or restart WebSocket service

---

## Performance Benchmarks

### Expected Performance Metrics

#### Page Load Times
- Login page: < 1 second
- Dashboard: < 2 seconds
- Workflows list: < 2 seconds
- Client portal: < 1.5 seconds
- Analytics: < 3 seconds

#### API Response Times
- User authentication: < 500ms
- Workflow creation: < 1 second
- Document upload: < 3 seconds (depends on file size)
- AI agent execution: < 10 seconds
- Database queries: < 200ms

#### Real-Time Features
- Notification delivery: < 1 second
- Chat message delivery: < 500ms
- @mention notification: < 1 second
- Document upload notification: < 2 seconds

#### Concurrent Users
- System should support: 50+ concurrent users
- No degradation up to: 25 concurrent users
- Acceptable degradation: 25-50 users
- Performance issues expected: > 50 users

---

## Test Result Summary Template

### Test Execution Summary
```markdown
# Test Execution Report
**Date**: [YYYY-MM-DD]
**Tester**: [Name]
**Environment**: [Dev/Staging/Prod]
**Duration**: [Total time]

## Test Suite Executed
- [ ] Quick Smoke Test (15 min)
- [ ] Core Functionality Test (1 hour)
- [ ] Full Individual User Test (2-3 hours)
- [ ] Team Collaboration Test (2-3 hours)
- [ ] Complete Test Suite (4-6 hours)

## Results Summary
- Total Tests: [X]
- Passed: [X] ([%])
- Failed: [X] ([%])
- Skipped: [X] ([%])

## Pass Rate by Suite
- Suite 1 (Super Admin): [X/6] ([%])
- Suite 2 (Admin): [X/10] ([%])
- Suite 3 (Employee): [X/8] ([%])
- Suite 4 (Client): [X/10] ([%])
- Suite 5 (Cross-Role): [X/1] ([%])
- Scenario 1: PASS/FAIL
- Scenario 2: PASS/FAIL
- Scenario 3: PASS/FAIL
- Scenario 4: PASS/FAIL
- Scenario 5: PASS/FAIL

## Critical Issues Found
1. [Issue 1 - Critical]
2. [Issue 2 - Critical]

## Major Issues Found
1. [Issue 1 - Major]
2. [Issue 2 - Major]

## Minor Issues Found
1. [Issue 1 - Minor]
2. [Issue 2 - Minor]

## Performance Metrics
- Average page load: [X seconds]
- Average API response: [X ms]
- Slowest feature: [Feature name - X seconds]

## Recommendations
1. [Recommendation 1]
2. [Recommendation 2]
3. [Recommendation 3]

## Overall Assessment
[ ] Ready for production
[ ] Needs minor fixes
[ ] Needs major fixes
[ ] Not ready for production

**Tester Signature**: _______________
**Date**: _______________
```

---

## Automation Considerations (Future)

### Tests Suitable for Automation
1. Login/Logout flows (all user types)
2. CRUD operations (create, read, update, delete)
3. Form validation
4. Navigation tests
5. API endpoint tests
6. Database integrity tests

### Tests Best Kept Manual
1. UI/UX evaluation
2. Complex multi-user scenarios
3. Real-time collaboration
4. User experience feedback
5. Visual design verification
6. Accessibility testing

### Recommended Automation Tools
- **E2E Testing**: Playwright (already used by run_test tool)
- **API Testing**: Supertest or Postman
- **Unit Testing**: Jest + React Testing Library
- **Load Testing**: k6 or Apache JMeter
- **Continuous Integration**: GitHub Actions or Jenkins

---

## Release Testing Checklist

### Pre-Release Testing
Before each release, execute:

#### Critical Path Tests (Must Pass 100%)
- [ ] User authentication (all 4 roles)
- [ ] Workflow creation and execution
- [ ] Document upload/download
- [ ] Digital signatures
- [ ] Payment processing (test mode)
- [ ] AI agent execution
- [ ] Client portal access

#### High Priority Tests (Must Pass 95%)
- [ ] Team collaboration (@mentions, chat)
- [ ] Time tracking
- [ ] Invoice generation
- [ ] Analytics dashboard
- [ ] Notifications
- [ ] Email sending

#### Medium Priority Tests (Must Pass 85%)
- [ ] Form builder
- [ ] Template management
- [ ] Calendar/scheduling
- [ ] Service marketplace
- [ ] Folder organization

#### Low Priority Tests (Must Pass 75%)
- [ ] Advanced reporting
- [ ] Custom integrations
- [ ] White-label features
- [ ] API webhooks

### Production Validation
After deployment to production:

#### Smoke Test (5 minutes)
1. Admin login ✓
2. Create test workflow ✓
3. Client portal access ✓
4. Document upload ✓
5. AI agent execution ✓

#### Rollback Criteria
Rollback immediately if:
- Login fails for any user type
- Workflows cannot be created
- Client portal inaccessible
- Payment processing fails
- Data loss detected
- Security vulnerability exposed

---

## Contact for Test Support

### Test Environment Issues
- **DevOps Team**: devops@accute.ai
- **Database Issues**: dba@accute.ai

### Test Documentation
- **QA Lead**: qa@accute.ai
- **Test Coordinator**: testing@accute.ai

### Bug Reporting
- **Bug Tracker**: bugs@accute.ai
- **Critical Bugs**: critical@accute.ai (24/7)

---

## Appendix

### A. Test Data Management

#### Creating Additional Test Users
```sql
-- Super Admin
INSERT INTO users (email, password, role, organization_id, first_name, last_name)
VALUES ('testsuperadmin@accute.com', <bcrypt_hash>, 'Super Admin', NULL, 'Test', 'SuperAdmin');

-- Admin
INSERT INTO users (email, password, role, organization_id, first_name, last_name)
VALUES ('testadmin@sterling.com', <bcrypt_hash>, 'Admin', <org_id>, 'Test', 'Admin');

-- Employee
INSERT INTO users (email, password, role, organization_id, first_name, last_name)
VALUES ('testemployee@sterling.com', <bcrypt_hash>, 'Employee', <org_id>, 'Test', 'Employee');

-- Client
INSERT INTO clients (email, name, organization_id)
VALUES ('testclient@example.com', 'Test Client', <org_id>);
```

#### Resetting Test Data
```sql
-- WARNING: Only in test environment!
-- Clear workflows
DELETE FROM workflow_assignments WHERE id > 0;
DELETE FROM workflows WHERE id > 0;

-- Clear documents (optional)
DELETE FROM documents WHERE id > 0;

-- Clear time tracking
DELETE FROM time_entries WHERE id > 0;

-- Keep users and organizations intact
```

### B. Browser Configuration

#### Chrome DevTools Setup
1. Open DevTools (F12)
2. Network tab → Disable cache
3. Console tab → Preserve log
4. Application tab → Clear storage before tests

#### Multi-Browser Testing Matrix
| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Login | ✓ | ✓ | ✓ | ✓ |
| Workflows | ✓ | ✓ | ✓ | ✓ |
| File Upload | ✓ | ✓ | ✓ | ✓ |
| WebSockets | ✓ | ✓ | ✓ | ✓ |
| Digital Signatures | ✓ | ✓ | ⚠️ | ✓ |

✓ = Fully supported  
⚠️ = Partial support or issues  
✗ = Not supported

### C. Test File Templates

Located in `test_files/` directory:
- `W2_2024.pdf` - Sample W2 form
- `1099_INT_2024.pdf` - Sample 1099
- `Bank_Statement_Template.pdf` - Bank statement template
- `Financial_Statements_Template.xlsx` - Financial statements
- `Tax_Return_Template.pdf` - Tax return template

---

**Document Version**: 1.0  
**Last Updated**: January 2025  
**Maintained By**: QA Team - Accute Platform
