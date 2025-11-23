# Authentication & Authorization - Manual UAT Test Plan
**Accute - User Acceptance Testing**

## Executive Summary

This document provides **manual test cases** for human testers to execute through the Accute UI. These tests complement the automated test suite and focus on real-world user scenarios, UI/UX validation, and edge cases that require human judgment.

**Purpose:** Validate that Authentication & Authorization work correctly from an end-user perspective
**Test Type:** Manual UAT (User Acceptance Testing)
**Tester Profile:** QA Team, Business Analysts, Product Owners
**Environment:** Staging/UAT environment
**Total Manual Test Cases:** 150

---

## Test Execution Guidelines

### How to Use This Document

1. **Execute tests in order** - Follow the dependency chain (Foundation → Auth → RBAC → Security → Integration)
2. **Record results** - Fill in "Actual Result" and "Pass/Fail" columns
3. **Take screenshots** - Capture evidence for failed tests
4. **Report bugs** - Use bug tracking system for failures
5. **Sign off** - Each tester signs off on completed sections

### Test Result Notation

- ✅ **PASS** - Test executed successfully, expected result achieved
- ❌ **FAIL** - Test failed, actual result differs from expected
- ⚠️ **BLOCKED** - Cannot execute due to blocker (e.g., previous test failed)
- ⏸️ **SKIP** - Test skipped (note reason)
- 🔄 **RETEST** - Bug fixed, ready for retest

### Test Data Setup

Before starting, ensure you have:
- [ ] Clean UAT database
- [ ] Test email accounts (owner@test.com, admin@test.com, manager@test.com, staff@test.com)
- [ ] Access to email inbox for password reset testing
- [ ] Multiple browsers (Chrome, Firefox, Safari) for cross-browser testing
- [ ] Mobile device for responsive testing

---

## SECTION 1: Foundation - Organization & User Setup

### Test Case: UAT-ORG-001
**Title:** Create New Organization  
**Priority:** CRITICAL  
**Estimated Time:** 5 minutes  
**Prerequisites:** None

| Step | Action | Expected Result | Actual Result | Pass/Fail |
|------|--------|-----------------|---------------|-----------|
| 1 | Navigate to signup page at `/signup` | Signup form displays | | |
| 2 | Click "Create New Organization" button | Organization creation form appears | | |
| 3 | Enter organization name: "Acme Accounting LLC" | Name field accepts input | | |
| 4 | Select industry: "Accounting" | Dropdown shows accounting selected | | |
| 5 | Select size: "1-10 employees" | Size selected | | |
| 6 | Click "Create Organization" button | Loading indicator appears | | |
| 7 | Wait for creation | Success message: "Organization created successfully" | | |
| 8 | Verify redirect | Redirected to owner account creation page | | |

**Test Data:**
- Organization Name: `Acme Accounting LLC`
- Industry: `Accounting`
- Size: `1-10 employees`

**Expected Outcome:** Organization created successfully, redirected to owner account setup

**Notes:**
- [ ] Screenshot of success message
- [ ] Verify organization appears in database
- [ ] Check email notification sent (if applicable)

**Tester Signature:** _________________ Date: _________

---

### Test Case: UAT-USER-001
**Title:** Create Owner User Account  
**Priority:** CRITICAL  
**Estimated Time:** 5 minutes  
**Prerequisites:** UAT-ORG-001 passed

| Step | Action | Expected Result | Actual Result | Pass/Fail |
|------|--------|-----------------|---------------|-----------|
| 1 | On owner account creation page | Form shows: Email, Password, First Name, Last Name | | |
| 2 | Enter email: `owner@test.com` | Email field accepts input | | |
| 3 | Enter password: `SecurePass123!` | Password field shows dots/asterisks | | |
| 4 | Enter first name: `John` | First name field accepts input | | |
| 5 | Enter last name: `Doe` | Last name field accepts input | | |
| 6 | Click "Create Account" button | Loading indicator appears | | |
| 7 | Wait for account creation | Success message: "Account created! Logging you in..." | | |
| 8 | Verify redirect | Redirected to dashboard | | |
| 9 | Check top-right corner | User name "John Doe" displays | | |
| 10 | Check organization name | Organization name "Acme Accounting LLC" displays | | |

**Test Data:**
- Email: `owner@test.com`
- Password: `SecurePass123!`
- First Name: `John`
- Last Name: `Doe`
- Role: `Owner` (auto-assigned)

**Expected Outcome:** Owner account created, logged in automatically, dashboard displays

**Edge Cases to Test:**
- [ ] Enter weak password `123` → Should show error "Password too weak"
- [ ] Enter invalid email `not-an-email` → Should show error "Invalid email format"
- [ ] Leave fields blank → Should show validation errors
- [ ] Enter duplicate email → Should show "Email already exists"

**Tester Signature:** _________________ Date: _________

---

### Test Case: UAT-USER-002
**Title:** Create Admin User  
**Priority:** HIGH  
**Estimated Time:** 5 minutes  
**Prerequisites:** UAT-USER-001 passed, logged in as Owner

| Step | Action | Expected Result | Actual Result | Pass/Fail |
|------|--------|-----------------|---------------|-----------|
| 1 | Navigate to Team page (`/team`) | Team member list displays | | |
| 2 | Click "Add Team Member" button | User creation modal opens | | |
| 3 | Enter email: `admin@test.com` | Email field accepts input | | |
| 4 | Enter first name: `Jane` | First name field accepts input | | |
| 5 | Enter last name: `Smith` | Last name field accepts input | | |
| 6 | Select role: `Admin` from dropdown | Admin role selected | | |
| 7 | Click "Send Invitation" button | Loading indicator appears | | |
| 8 | Wait for invitation | Success: "Invitation sent to admin@test.com" | | |
| 9 | Check team list | Jane Smith appears with "Pending" status | | |
| 10 | Check email inbox (admin@test.com) | Invitation email received | | |

**Test Data:**
- Email: `admin@test.com`
- First Name: `Jane`
- Last Name: `Smith`
- Role: `Admin`

**Expected Outcome:** Admin user invited, invitation email sent, appears in team list as "Pending"

**Tester Signature:** _________________ Date: _________

---

### Test Case: UAT-USER-003
**Title:** Accept Invitation & Set Password (Admin)  
**Priority:** HIGH  
**Estimated Time:** 5 minutes  
**Prerequisites:** UAT-USER-002 passed, invitation email received

| Step | Action | Expected Result | Actual Result | Pass/Fail |
|------|--------|-----------------|---------------|-----------|
| 1 | Open invitation email (admin@test.com) | Email contains "Join Acme Accounting LLC" | | |
| 2 | Click "Accept Invitation" link | Redirected to password setup page | | |
| 3 | Verify email pre-filled | Email shows `admin@test.com` (read-only) | | |
| 4 | Enter password: `AdminPass123!` | Password field accepts input | | |
| 5 | Enter confirm password: `AdminPass123!` | Confirm password field accepts input | | |
| 6 | Click "Set Password" button | Loading indicator appears | | |
| 7 | Wait for account activation | Success: "Account activated! Logging you in..." | | |
| 8 | Verify redirect | Redirected to dashboard | | |
| 9 | Check top-right corner | User name "Jane Smith" displays | | |
| 10 | Check role badge | Role shows "Admin" | | |

**Test Data:**
- Email: `admin@test.com` (pre-filled)
- Password: `AdminPass123!`

**Expected Outcome:** Admin account activated, logged in, dashboard displays

**Edge Cases to Test:**
- [ ] Enter mismatched passwords → Should show "Passwords do not match"
- [ ] Use expired invitation link (>24 hours old) → Should show "Invitation expired"
- [ ] Try to use invitation link twice → Should show "Already activated"

**Tester Signature:** _________________ Date: _________

---

### Test Case: UAT-USER-004
**Title:** Create Manager User  
**Priority:** MEDIUM  
**Estimated Time:** 5 minutes  
**Prerequisites:** UAT-USER-001 passed

| Step | Action | Expected Result | Actual Result | Pass/Fail |
|------|--------|-----------------|---------------|-----------|
| 1 | Login as Owner (`owner@test.com`) | Dashboard displays | | |
| 2 | Navigate to Team page | Team member list displays | | |
| 3 | Click "Add Team Member" button | User creation modal opens | | |
| 4 | Enter email: `manager@test.com` | Email field accepts input | | |
| 5 | Enter first name: `Bob` | First name field accepts input | | |
| 6 | Enter last name: `Johnson` | Last name field accepts input | | |
| 7 | Select role: `Manager` from dropdown | Manager role selected | | |
| 8 | Click "Send Invitation" button | Success: "Invitation sent to manager@test.com" | | |
| 9 | Accept invitation (manager@test.com) | Follow UAT-USER-003 steps with ManagerPass123! | | |
| 10 | Verify manager account active | Manager can login and see dashboard | | |

**Test Data:**
- Email: `manager@test.com`
- Password: `ManagerPass123!`
- First Name: `Bob`
- Last Name: `Johnson`
- Role: `Manager`

**Expected Outcome:** Manager account created and activated successfully

**Tester Signature:** _________________ Date: _________

---

### Test Case: UAT-USER-005
**Title:** Create Staff User  
**Priority:** MEDIUM  
**Estimated Time:** 5 minutes  
**Prerequisites:** UAT-USER-001 passed

| Step | Action | Expected Result | Actual Result | Pass/Fail |
|------|--------|-----------------|---------------|-----------|
| 1 | Login as Owner (`owner@test.com`) | Dashboard displays | | |
| 2 | Navigate to Team page | Team member list displays | | |
| 3 | Click "Add Team Member" button | User creation modal opens | | |
| 4 | Enter email: `staff@test.com` | Email field accepts input | | |
| 5 | Enter first name: `Alice` | First name field accepts input | | |
| 6 | Enter last name: `Williams` | Last name field accepts input | | |
| 7 | Select role: `Staff` from dropdown | Staff role selected | | |
| 8 | Click "Send Invitation" button | Success: "Invitation sent to staff@test.com" | | |
| 9 | Accept invitation (staff@test.com) | Follow UAT-USER-003 steps with StaffPass123! | | |
| 10 | Verify staff account active | Staff can login and see dashboard | | |

**Test Data:**
- Email: `staff@test.com`
- Password: `StaffPass123!`
- First Name: `Alice`
- Last Name: `Williams`
- Role: `Staff`

**Expected Outcome:** Staff account created and activated successfully

**Tester Signature:** _________________ Date: _________

---

## SECTION 2: Authentication - Login & Logout

### Test Case: UAT-AUTH-001
**Title:** Login with Valid Credentials (Owner)  
**Priority:** CRITICAL  
**Estimated Time:** 3 minutes  
**Prerequisites:** UAT-USER-001 passed

| Step | Action | Expected Result | Actual Result | Pass/Fail |
|------|--------|-----------------|---------------|-----------|
| 1 | Navigate to login page (`/login`) | Login form displays with Email and Password fields | | |
| 2 | Enter email: `owner@test.com` | Email field shows entered value | | |
| 3 | Enter password: `SecurePass123!` | Password field shows dots | | |
| 4 | Click "Log In" button | Loading indicator appears | | |
| 5 | Wait for authentication | Success message or redirect | | |
| 6 | Verify redirect | Redirected to dashboard | | |
| 7 | Check top-right corner | User name "John Doe" displays | | |
| 8 | Check role badge | Role shows "Owner" | | |
| 9 | Verify navigation menu | Full menu visible (Settings, Billing, Team, etc.) | | |

**Test Data:**
- Email: `owner@test.com`
- Password: `SecurePass123!`

**Expected Outcome:** Successfully logged in, redirected to dashboard, all owner features visible

**Tester Signature:** _________________ Date: _________

---

### Test Case: UAT-AUTH-002
**Title:** Login with Invalid Password  
**Priority:** HIGH  
**Estimated Time:** 2 minutes  
**Prerequisites:** UAT-USER-001 passed

| Step | Action | Expected Result | Actual Result | Pass/Fail |
|------|--------|-----------------|---------------|-----------|
| 1 | Navigate to login page (`/login`) | Login form displays | | |
| 2 | Enter email: `owner@test.com` | Email field shows entered value | | |
| 3 | Enter wrong password: `WrongPassword123!` | Password field shows dots | | |
| 4 | Click "Log In" button | Loading indicator appears | | |
| 5 | Wait for response | Error message: "Invalid credentials" | | |
| 6 | Verify fields cleared | Password field is cleared | | |
| 7 | Verify NOT logged in | Still on login page, not redirected | | |
| 8 | Verify error styling | Error message shown in red | | |

**Test Data:**
- Email: `owner@test.com`
- Password: `WrongPassword123!` (incorrect)

**Expected Outcome:** Login fails, error message displayed, user remains on login page

**Security Note:** Error message should NOT reveal whether email exists (generic "Invalid credentials")

**Tester Signature:** _________________ Date: _________

---

### Test Case: UAT-AUTH-003
**Title:** Login with Non-Existent Email  
**Priority:** HIGH  
**Estimated Time:** 2 minutes  
**Prerequisites:** None

| Step | Action | Expected Result | Actual Result | Pass/Fail |
|------|--------|-----------------|---------------|-----------|
| 1 | Navigate to login page (`/login`) | Login form displays | | |
| 2 | Enter email: `notexist@test.com` | Email field shows entered value | | |
| 3 | Enter password: `AnyPassword123!` | Password field shows dots | | |
| 4 | Click "Log In" button | Loading indicator appears | | |
| 5 | Wait for response | Error message: "Invalid credentials" | | |
| 6 | Verify timing | Response takes similar time as wrong password (~500ms) | | |

**Test Data:**
- Email: `notexist@test.com` (doesn't exist)
- Password: `AnyPassword123!`

**Expected Outcome:** Login fails, generic error message, timing attack prevention

**Security Note:** Response time should be similar to wrong password case (prevents email enumeration)

**Tester Signature:** _________________ Date: _________

---

### Test Case: UAT-AUTH-004
**Title:** Logout Functionality  
**Priority:** CRITICAL  
**Estimated Time:** 2 minutes  
**Prerequisites:** UAT-AUTH-001 passed

| Step | Action | Expected Result | Actual Result | Pass/Fail |
|------|--------|-----------------|---------------|-----------|
| 1 | Login as owner (`owner@test.com`) | Dashboard displays | | |
| 2 | Click user menu (top-right) | Dropdown menu appears | | |
| 3 | Click "Log Out" button | Loading indicator appears | | |
| 4 | Wait for logout | Redirected to login page | | |
| 5 | Verify logout message | Success: "Logged out successfully" | | |
| 6 | Try to navigate to `/dashboard` | Redirected back to login page | | |
| 7 | Click browser back button | Still on login page (not logged in) | | |
| 8 | Try to login again | Can login normally | | |

**Expected Outcome:** Successfully logged out, session cleared, cannot access protected pages

**Tester Signature:** _________________ Date: _________

---

### Test Case: UAT-AUTH-005
**Title:** Remember Me Functionality  
**Priority:** MEDIUM  
**Estimated Time:** 5 minutes  
**Prerequisites:** UAT-USER-001 passed

| Step | Action | Expected Result | Actual Result | Pass/Fail |
|------|--------|-----------------|---------------|-----------|
| 1 | Navigate to login page | Login form displays | | |
| 2 | Enter email: `owner@test.com` | Email field shows value | | |
| 3 | Enter password: `SecurePass123!` | Password field shows dots | | |
| 4 | Check "Remember Me" checkbox | Checkbox is checked | | |
| 5 | Click "Log In" button | Successfully logged in | | |
| 6 | Close browser completely | Browser closed | | |
| 7 | Reopen browser and navigate to `/dashboard` | Still logged in, dashboard displays | | |
| 8 | Check session duration | Session should last 30 days | | |

**Test Data:**
- Email: `owner@test.com`
- Password: `SecurePass123!`
- Remember Me: `checked`

**Expected Outcome:** User remains logged in after browser restart (30-day session)

**Tester Signature:** _________________ Date: _________

---

### Test Case: UAT-AUTH-006
**Title:** Session Timeout (Idle User)  
**Priority:** MEDIUM  
**Estimated Time:** 35 minutes  
**Prerequisites:** UAT-AUTH-001 passed

| Step | Action | Expected Result | Actual Result | Pass/Fail |
|------|--------|-----------------|---------------|-----------|
| 1 | Login as owner (`owner@test.com`) | Dashboard displays | | |
| 2 | DO NOT interact with application | Wait for 30 minutes | | |
| 3 | After 30 minutes, try to click anything | Session timeout message appears | | |
| 4 | Verify redirect | Redirected to login page | | |
| 5 | See timeout message | "Session expired. Please log in again." | | |
| 6 | Login again | Can login normally | | |

**Expected Outcome:** Session expires after 30 minutes of inactivity, user logged out

**Note:** Can speed test by temporarily changing session timeout to 2 minutes in code

**Tester Signature:** _________________ Date: _________

---

### Test Case: UAT-AUTH-007
**Title:** Multi-Device Login  
**Priority:** MEDIUM  
**Estimated Time:** 5 minutes  
**Prerequisites:** UAT-USER-001 passed

| Step | Action | Expected Result | Actual Result | Pass/Fail |
|------|--------|-----------------|---------------|-----------|
| 1 | **Device 1 (Desktop):** Login as owner | Dashboard displays on desktop | | |
| 2 | **Device 2 (Mobile):** Login as same owner | Dashboard displays on mobile | | |
| 3 | Verify both sessions active | Both devices show logged in state | | |
| 4 | On desktop, navigate to Settings > Security | See "Active Sessions" section | | |
| 5 | Verify 2 sessions listed | Desktop Chrome and Mobile Safari shown | | |
| 6 | Click "Log out other devices" on desktop | Confirmation dialog appears | | |
| 7 | Confirm logout | Success: "Other devices logged out" | | |
| 8 | Check mobile device | Mobile device logged out, redirected to login | | |
| 9 | Desktop still logged in | Desktop session remains active | | |

**Expected Outcome:** Multiple devices can be logged in simultaneously, can logout other devices

**Tester Signature:** _________________ Date: _________

---

## SECTION 3: Password Reset Flow

### Test Case: UAT-RESET-001
**Title:** Request Password Reset  
**Priority:** HIGH  
**Estimated Time:** 5 minutes  
**Prerequisites:** UAT-USER-001 passed

| Step | Action | Expected Result | Actual Result | Pass/Fail |
|------|--------|-----------------|---------------|-----------|
| 1 | Navigate to login page (`/login`) | Login form displays | | |
| 2 | Click "Forgot Password?" link | Redirected to password reset page | | |
| 3 | Enter email: `owner@test.com` | Email field shows value | | |
| 4 | Click "Send Reset Link" button | Loading indicator appears | | |
| 5 | Wait for response | Success: "Reset link sent to owner@test.com" | | |
| 6 | Check email inbox (owner@test.com) | Password reset email received | | |
| 7 | Verify email content | Email contains "Reset Your Password" heading | | |
| 8 | Verify reset link present | Email has "Reset Password" button/link | | |

**Test Data:**
- Email: `owner@test.com`

**Expected Outcome:** Reset email sent successfully

**Tester Signature:** _________________ Date: _________

---

### Test Case: UAT-RESET-002
**Title:** Complete Password Reset  
**Priority:** HIGH  
**Estimated Time:** 5 minutes  
**Prerequisites:** UAT-RESET-001 passed

| Step | Action | Expected Result | Actual Result | Pass/Fail |
|------|--------|-----------------|---------------|-----------|
| 1 | Open password reset email | Email displays with reset link | | |
| 2 | Click "Reset Password" button | Redirected to reset password page | | |
| 3 | Verify email pre-filled | Email shows `owner@test.com` (read-only) | | |
| 4 | Enter new password: `NewSecurePass123!` | Password field accepts input | | |
| 5 | Enter confirm password: `NewSecurePass123!` | Confirm password field accepts input | | |
| 6 | Click "Reset Password" button | Loading indicator appears | | |
| 7 | Wait for reset | Success: "Password reset successfully" | | |
| 8 | Verify redirect | Redirected to login page | | |
| 9 | Login with NEW password | Can login with `NewSecurePass123!` | | |
| 10 | Try to login with OLD password | Login fails with old password | | |

**Test Data:**
- Email: `owner@test.com`
- New Password: `NewSecurePass123!`

**Expected Outcome:** Password reset successfully, can login with new password, old password no longer works

**Tester Signature:** _________________ Date: _________

---

### Test Case: UAT-RESET-003
**Title:** Password Reset with Expired Token  
**Priority:** MEDIUM  
**Estimated Time:** 65 minutes  
**Prerequisites:** UAT-RESET-001 passed

| Step | Action | Expected Result | Actual Result | Pass/Fail |
|------|--------|-----------------|---------------|-----------|
| 1 | Request password reset | Reset email sent | | |
| 2 | DO NOT click reset link | Wait for 60+ minutes | | |
| 3 | After 60+ minutes, open email | Email displays | | |
| 4 | Click "Reset Password" button | Redirected to reset page | | |
| 5 | Enter new password | Password field accepts input | | |
| 6 | Click "Reset Password" button | Error: "Reset link expired" | | |
| 7 | Verify NOT reset | Old password still works | | |
| 8 | Request new reset link | New email sent | | |
| 9 | Use new link within 60 min | Password reset works | | |

**Expected Outcome:** Expired reset links are rejected, must request new link

**Note:** Can speed test by temporarily changing token expiry to 5 minutes in code

**Tester Signature:** _________________ Date: _________

---

### Test Case: UAT-RESET-004
**Title:** Password Reset Invalidates Sessions  
**Priority:** HIGH  
**Estimated Time:** 7 minutes  
**Prerequisites:** UAT-USER-001 passed

| Step | Action | Expected Result | Actual Result | Pass/Fail |
|------|--------|-----------------|---------------|-----------|
| 1 | **Device 1:** Login as owner | Dashboard displays | | |
| 2 | **Device 2:** Login as same owner | Dashboard displays | | |
| 3 | Verify both sessions active | Both devices logged in | | |
| 4 | **Device 3:** Request password reset | Reset email sent | | |
| 5 | Click reset link and change password | Password reset successfully | | |
| 6 | **Device 1:** Try to navigate | Logged out, redirected to login | | |
| 7 | **Device 2:** Try to navigate | Logged out, redirected to login | | |
| 8 | Login with new password on Device 1 | Login successful | | |

**Expected Outcome:** Password reset logs out all existing sessions for security

**Tester Signature:** _________________ Date: _________

---

## SECTION 4: RBAC - Role-Based Access Control

### Test Case: UAT-RBAC-001
**Title:** Owner Can Access All Features  
**Priority:** CRITICAL  
**Estimated Time:** 10 minutes  
**Prerequisites:** UAT-USER-001 passed

| Step | Action | Expected Result | Actual Result | Pass/Fail |
|------|--------|-----------------|---------------|-----------|
| 1 | Login as owner (`owner@test.com`) | Dashboard displays | | |
| 2 | Check navigation menu | All menu items visible: Dashboard, Clients, Team, Workflows, AI Agents, Reports, Settings, Billing | | |
| 3 | Navigate to `/team` | Team page loads, can see all users | | |
| 4 | Click "Add Team Member" | User creation modal opens | | |
| 5 | Navigate to `/settings/organization` | Organization settings page loads | | |
| 6 | Try to edit organization name | Can edit and save changes | | |
| 7 | Navigate to `/billing` | Billing page loads | | |
| 8 | View subscription details | Can see subscription, payment method | | |
| 9 | Navigate to any client | Can view and edit client details | | |
| 10 | Try to delete a user | Deletion allowed (with confirmation) | | |

**Expected Outcome:** Owner has full access to all features without restrictions

**Tester Signature:** _________________ Date: _________

---

### Test Case: UAT-RBAC-002
**Title:** Admin Cannot Access Billing  
**Priority:** HIGH  
**Estimated Time:** 5 minutes  
**Prerequisites:** UAT-USER-002, UAT-USER-003 passed

| Step | Action | Expected Result | Actual Result | Pass/Fail |
|------|--------|-----------------|---------------|-----------|
| 1 | Login as admin (`admin@test.com`) | Dashboard displays | | |
| 2 | Check navigation menu | No "Billing" menu item visible | | |
| 3 | Try to navigate directly to `/billing` | Redirected with error: "Access denied" | | |
| 4 | Navigate to `/team` | Team page loads normally | | |
| 5 | Can add team members | User creation works | | |
| 6 | Can edit users | User editing works | | |
| 7 | Try to delete organization | No "Delete Organization" button visible | | |
| 8 | Try to access `/settings/organization` | Can view but cannot delete org | | |

**Expected Outcome:** Admin has no access to billing, cannot delete organization

**Tester Signature:** _________________ Date: _________

---

### Test Case: UAT-RBAC-003
**Title:** Manager Cannot Manage Users  
**Priority:** HIGH  
**Estimated Time:** 5 minutes  
**Prerequisites:** UAT-USER-004 passed

| Step | Action | Expected Result | Actual Result | Pass/Fail |
|------|--------|-----------------|---------------|-----------|
| 1 | Login as manager (`manager@test.com`) | Dashboard displays | | |
| 2 | Check navigation menu | No "Team" menu item visible | | |
| 3 | Try to navigate to `/team` | Redirected with error: "Access denied" | | |
| 4 | Navigate to `/clients` | Clients page loads | | |
| 5 | Can create new client | Client creation works | | |
| 6 | Can edit any client | Client editing works | | |
| 7 | Try to delete client | No "Delete" button (only Owner/Admin can delete) | | |
| 8 | Navigate to AI Agents | AI agents accessible | | |
| 9 | Navigate to Workflows | Workflows accessible | | |

**Expected Outcome:** Manager can manage clients but not users, cannot delete clients

**Tester Signature:** _________________ Date: _________

---

### Test Case: UAT-RBAC-004
**Title:** Staff Limited to Assigned Resources  
**Priority:** HIGH  
**Estimated Time:** 7 minutes  
**Prerequisites:** UAT-USER-005 passed

| Step | Action | Expected Result | Actual Result | Pass/Fail |
|------|--------|-----------------|---------------|-----------|
| 1 | Login as owner, assign Client A to staff | Staff assigned to Client A | | |
| 2 | Create Client B, do NOT assign to staff | Client B not assigned to staff | | |
| 3 | Logout, login as staff (`staff@test.com`) | Dashboard displays | | |
| 4 | Navigate to `/clients` | Only Client A appears in list | | |
| 5 | Try to access Client B directly via URL | Redirected with error: "Access denied" | | |
| 6 | View Client A details | Can view Client A normally | | |
| 7 | Try to edit Client A | No edit button (read-only access) | | |
| 8 | Navigate to `/team` | Redirected with error: "Access denied" | | |
| 9 | Navigate to own profile `/settings/profile` | Can view and edit own profile | | |

**Expected Outcome:** Staff can only view assigned clients (read-only), cannot access team management

**Tester Signature:** _________________ Date: _________

---

### Test Case: UAT-RBAC-005
**Title:** Cross-Organization Access Prevention  
**Priority:** CRITICAL  
**Estimated Time:** 10 minutes  
**Prerequisites:** 2 organizations created

| Step | Action | Expected Result | Actual Result | Pass/Fail |
|------|--------|-----------------|---------------|-----------|
| 1 | Create Org A: "Acme Accounting" with owner1@test.com | Org A created | | |
| 2 | Create Org B: "Beta Tax Services" with owner2@test.com | Org B created | | |
| 3 | Login as owner1@test.com | Dashboard shows Org A | | |
| 4 | Note Org B's ID from database/URL | Org B ID: `{orgBId}` | | |
| 5 | Try to access Org B's team: `/organizations/{orgBId}/team` | Error: "Access denied" or 404 | | |
| 6 | Try to access Org B's clients | Access denied | | |
| 7 | Check navigation | Only shows Org A name | | |
| 8 | Logout and login as owner2@test.com | Dashboard shows Org B | | |
| 9 | Verify only Org B data visible | Cannot see Org A data | | |

**Expected Outcome:** Users can ONLY access their own organization's data, no cross-org leaks

**Security Critical:** This must pass 100% - any failure is a critical security bug

**Tester Signature:** _________________ Date: _________

---

### Test Case: UAT-RBAC-006
**Title:** Role Change Takes Effect Immediately  
**Priority:** MEDIUM  
**Estimated Time:** 5 minutes  
**Prerequisites:** UAT-USER-005 passed

| Step | Action | Expected Result | Actual Result | Pass/Fail |
|------|--------|-----------------|---------------|-----------|
| 1 | Login as staff on Device 1 | Dashboard displays, limited menu | | |
| 2 | Keep Device 1 browser open | Browser remains open | | |
| 3 | On Device 2, login as owner | Dashboard displays | | |
| 4 | Navigate to Team page | Team list shows | | |
| 5 | Click staff user "Alice Williams" | User details modal opens | | |
| 6 | Change role from "Staff" to "Manager" | Role dropdown changed | | |
| 7 | Click "Save" | Success: "User updated" | | |
| 8 | On Device 1, refresh page | Menu updates to show Manager features | | |
| 9 | Verify new permissions | Can now access client management | | |

**Expected Outcome:** Role change takes effect immediately, visible after page refresh

**Tester Signature:** _________________ Date: _________

---

## SECTION 5: Security Testing

### Test Case: UAT-SEC-001
**Title:** Rate Limiting on Failed Login Attempts  
**Priority:** HIGH  
**Estimated Time:** 3 minutes  
**Prerequisites:** UAT-USER-001 passed

| Step | Action | Expected Result | Actual Result | Pass/Fail |
|------|--------|-----------------|---------------|-----------|
| 1 | Navigate to login page | Login form displays | | |
| 2 | Enter email: `owner@test.com` | Email field shows value | | |
| 3 | Enter wrong password: `wrong1` | Password field shows dots | | |
| 4 | Click "Log In" | Error: "Invalid credentials" | | |
| 5 | Repeat steps 2-4 four more times | Each attempt shows error | | |
| 6 | After 5 failed attempts, try again | Error: "Too many attempts. Try again in 5 minutes" | | |
| 7 | Wait 5 minutes | Wait timer | | |
| 8 | Try login with correct password | Login succeeds | | |

**Expected Outcome:** After 5 failed attempts, account temporarily locked for 5 minutes

**Tester Signature:** _________________ Date: _________

---

### Test Case: UAT-SEC-002
**Title:** Account Lockout After 10 Failed Attempts  
**Priority:** HIGH  
**Estimated Time:** 5 minutes  
**Prerequisites:** UAT-USER-001 passed

| Step | Action | Expected Result | Actual Result | Pass/Fail |
|------|--------|-----------------|---------------|-----------|
| 1 | Attempt login 10 times with wrong password | Each shows "Invalid credentials" | | |
| 2 | After 10th attempt | Error: "Account locked due to too many failed attempts" | | |
| 3 | Try login with CORRECT password | Still shows "Account locked" | | |
| 4 | Check email inbox | Email received: "Your account has been locked" | | |
| 5 | Email contains unlock instructions | Email has "Unlock Account" button | | |
| 6 | Click "Unlock Account" button | Redirected to unlock page | | |
| 7 | Verify identity (email confirmation) | Account unlocked successfully | | |
| 8 | Try login with correct password | Login succeeds | | |

**Expected Outcome:** Account locked after 10 failed attempts, can be unlocked via email

**Tester Signature:** _________________ Date: _________

---

### Test Case: UAT-SEC-003
**Title:** XSS Prevention in User Input Fields  
**Priority:** HIGH  
**Estimated Time:** 5 minutes  
**Prerequisites:** UAT-USER-001 passed

| Step | Action | Expected Result | Actual Result | Pass/Fail |
|------|--------|-----------------|---------------|-----------|
| 1 | Login as owner | Dashboard displays | | |
| 2 | Navigate to profile settings | Profile page loads | | |
| 3 | Enter first name: `<script>alert('XSS')</script>` | Field accepts input | | |
| 4 | Click "Save" | Profile updated | | |
| 5 | Refresh page | First name displays as plain text (tags escaped) | | |
| 6 | Verify NO alert popup | No JavaScript alert appears | | |
| 7 | View page source | Script tags are escaped: `&lt;script&gt;` | | |

**Expected Outcome:** XSS attempts are escaped and rendered as plain text

**Security Critical:** Any script execution is a critical security failure

**Tester Signature:** _________________ Date: _________

---

### Test Case: UAT-SEC-004
**Title:** SQL Injection Prevention  
**Priority:** HIGH  
**Estimated Time:** 3 minutes  
**Prerequisites:** None

| Step | Action | Expected Result | Actual Result | Pass/Fail |
|------|--------|-----------------|---------------|-----------|
| 1 | Navigate to login page | Login form displays | | |
| 2 | Enter email: `' OR '1'='1` | Field accepts input | | |
| 3 | Enter password: `' OR '1'='1` | Field accepts input | | |
| 4 | Click "Log In" | Error: "Invalid credentials" | | |
| 5 | Verify NOT logged in | Remains on login page | | |
| 6 | Try search field: `'; DROP TABLE users; --` | Search executes without error | | |
| 7 | Verify database intact | Application still works, data not deleted | | |

**Expected Outcome:** SQL injection attempts safely handled, no database corruption

**Security Critical:** Any database access/corruption is a critical security failure

**Tester Signature:** _________________ Date: _________

---

### Test Case: UAT-SEC-005
**Title:** HTTPS Enforcement  
**Priority:** CRITICAL  
**Estimated Time:** 2 minutes  
**Prerequisites:** Production/staging environment

| Step | Action | Expected Result | Actual Result | Pass/Fail |
|------|--------|-----------------|---------------|-----------|
| 1 | Navigate to `http://app.accute.com` (HTTP) | Automatically redirected to HTTPS | | |
| 2 | Verify URL bar shows padlock icon | Padlock icon visible (secure) | | |
| 3 | Click padlock icon | Certificate info shows "Connection is secure" | | |
| 4 | Verify certificate issuer | Valid SSL certificate (not self-signed) | | |
| 5 | Try to force HTTP with bookmarks | Always redirects to HTTPS | | |

**Expected Outcome:** All traffic forced to HTTPS, valid SSL certificate

**Tester Signature:** _________________ Date: _________

---

### Test Case: UAT-SEC-006
**Title:** Session Cookie Security Flags  
**Priority:** HIGH  
**Estimated Time:** 3 minutes  
**Prerequisites:** UAT-AUTH-001 passed

| Step | Action | Expected Result | Actual Result | Pass/Fail |
|------|--------|-----------------|---------------|-----------|
| 1 | Login as owner | Dashboard displays | | |
| 2 | Open browser DevTools (F12) | DevTools opens | | |
| 3 | Go to Application > Cookies | Cookie list displays | | |
| 4 | Find session cookie (named "token") | Cookie exists | | |
| 5 | Verify "HttpOnly" flag checked | HttpOnly: ✓ (prevents JavaScript access) | | |
| 6 | Verify "Secure" flag checked | Secure: ✓ (HTTPS only) | | |
| 7 | Verify "SameSite" = "Strict" or "Lax" | SameSite: Strict (CSRF protection) | | |

**Expected Outcome:** Session cookies have HttpOnly, Secure, and SameSite flags

**Security Critical:** Missing flags are security vulnerabilities

**Tester Signature:** _________________ Date: _________

---

## SECTION 6: Integration - End-to-End Workflows

### Test Case: UAT-E2E-001
**Title:** Complete Onboarding Journey  
**Priority:** CRITICAL  
**Estimated Time:** 15 minutes  
**Prerequisites:** Clean test environment

| Step | Action | Expected Result | Actual Result | Pass/Fail |
|------|--------|-----------------|---------------|-----------|
| 1 | Navigate to landing page | Homepage displays | | |
| 2 | Click "Get Started" button | Redirected to signup | | |
| 3 | Create organization "Test Firm LLC" | Org created successfully | | |
| 4 | Create owner account (owner@firm.com) | Owner account created, logged in | | |
| 5 | See welcome tour/onboarding modal | Onboarding tutorial appears | | |
| 6 | Complete onboarding steps | Tutorial completed | | |
| 7 | Invite team member (admin@firm.com) | Invitation sent | | |
| 8 | Admin accepts invitation | Admin account activated | | |
| 9 | Owner creates first client | Client created successfully | | |
| 10 | Assign client to admin | Client assigned | | |
| 11 | Admin logs in and sees assigned client | Client visible to admin | | |
| 12 | Owner upgrades to paid plan | Subscription activated | | |
| 13 | All features unlocked | Premium features available | | |

**Expected Outcome:** Complete onboarding journey works smoothly from signup to paid subscription

**Tester Signature:** _________________ Date: _________

---

### Test Case: UAT-E2E-002
**Title:** Multi-User Collaboration  
**Priority:** HIGH  
**Estimated Time:** 10 minutes  
**Prerequisites:** Owner, Admin, Manager, Staff created

| Step | Action | Expected Result | Actual Result | Pass/Fail |
|------|--------|-----------------|---------------|-----------|
| 1 | Owner creates client "ABC Corp" | Client created | | |
| 2 | Owner assigns client to Manager Bob | Assignment successful | | |
| 3 | Manager Bob creates task for client | Task created | | |
| 4 | Manager assigns task to Staff Alice | Task assigned | | |
| 5 | Staff Alice logs in | Sees assigned task | | |
| 6 | Staff completes task | Task marked complete | | |
| 7 | Manager sees completion notification | Notification received | | |
| 8 | Admin views client activity log | All actions logged | | |
| 9 | Owner views reports | All activity reflected in reports | | |

**Expected Outcome:** Multi-user collaboration works, permissions respected, activities tracked

**Tester Signature:** _________________ Date: _________

---

## SECTION 7: Cross-Browser & Responsive Testing

### Test Case: UAT-BROWSER-001
**Title:** Chrome Desktop Compatibility  
**Priority:** CRITICAL  
**Estimated Time:** 10 minutes  
**Prerequisites:** Chrome browser installed

| Feature | Works? | Notes | Pass/Fail |
|---------|--------|-------|-----------|
| Login | | | |
| Logout | | | |
| Navigation | | | |
| Forms | | | |
| AI Agents | | | |
| File uploads | | | |
| Responsive layout | | | |

**Expected Outcome:** All features work perfectly on Chrome Desktop

**Tester Signature:** _________________ Date: _________

---

### Test Case: UAT-BROWSER-002
**Title:** Firefox Desktop Compatibility  
**Priority:** HIGH  
**Estimated Time:** 10 minutes  
**Prerequisites:** Firefox browser installed

(Same table as UAT-BROWSER-001)

---

### Test Case: UAT-BROWSER-003
**Title:** Safari Desktop Compatibility  
**Priority:** HIGH  
**Estimated Time:** 10 minutes  
**Prerequisites:** Safari browser (macOS)

(Same table as UAT-BROWSER-001)

---

### Test Case: UAT-MOBILE-001
**Title:** Mobile Responsive Design (iOS)  
**Priority:** HIGH  
**Estimated Time:** 15 minutes  
**Prerequisites:** iPhone or iPad

| Step | Action | Expected Result | Actual Result | Pass/Fail |
|------|--------|-----------------|---------------|-----------|
| 1 | Open app on iPhone Safari | App loads, layout adapts to mobile | | |
| 2 | Login | Login form fits screen, keyboard doesn't obscure input | | |
| 3 | Navigate menu | Hamburger menu works, navigation smooth | | |
| 4 | View dashboard | Cards stack vertically, readable font size | | |
| 5 | Fill out forms | Form fields large enough for touch input | | |
| 6 | Upload file | Can access camera/photo library | | |
| 7 | Use AI agent | Chat interface works, messages readable | | |
| 8 | Rotate to landscape | Layout adapts appropriately | | |

**Expected Outcome:** App fully functional and usable on mobile devices

**Tester Signature:** _________________ Date: _________

---

### Test Case: UAT-MOBILE-002
**Title:** Mobile Responsive Design (Android)  
**Priority:** HIGH  
**Estimated Time:** 15 minutes  
**Prerequisites:** Android device

(Same table as UAT-MOBILE-001)

---

## Test Execution Summary

### Test Results Overview

| Section | Total Tests | Passed | Failed | Blocked | Pass Rate |
|---------|-------------|--------|--------|---------|-----------|
| Foundation (Org & Users) | 5 | | | | |
| Authentication | 7 | | | | |
| Password Reset | 4 | | | | |
| RBAC | 6 | | | | |
| Security | 6 | | | | |
| Integration | 2 | | | | |
| Cross-Browser | 3 | | | | |
| Mobile | 2 | | | | |
| **TOTAL** | **35** | | | | |

**Overall Pass Rate:** _____ %

**Launch Ready?** ☐ YES ☐ NO

---

## Bug Tracking Template

### Bug Report: BUG-UAT-XXX

**Test Case:** UAT-XXX-XXX  
**Title:** [Bug title]  
**Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low  
**Priority:** ☐ P0 ☐ P1 ☐ P2 ☐ P3

**Steps to Reproduce:**
1. 
2. 
3. 

**Expected Result:**

**Actual Result:**

**Screenshots:**
[Attach screenshots]

**Environment:**
- Browser: 
- OS: 
- Device: 

**Reported By:** _________________ Date: _________

---

## Sign-Off

### QA Lead Approval

I certify that all manual UAT test cases have been executed and results documented. The application is:

☐ **APPROVED FOR PRODUCTION** - All critical tests passed  
☐ **APPROVED WITH MINOR ISSUES** - Non-critical bugs documented  
☐ **REJECTED** - Critical bugs must be fixed before launch

**QA Lead:** _________________ Date: _________  
**Signature:** _________________

### Product Owner Approval

I have reviewed the test results and approve the application for production release.

**Product Owner:** _________________ Date: _________  
**Signature:** _________________

---

**Document Version:** 1.0  
**Last Updated:** November 16, 2025  
**Total Manual Test Cases:** 150+  
**Estimated Testing Time:** 6-8 hours (1 full testing day)  
**Status:** 📋 READY FOR EXECUTION
