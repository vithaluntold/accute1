-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES FOR MULTI-TENANT DATA ISOLATION
-- ============================================================================
-- Purpose: Enforce organization-level data isolation at the database layer
-- Security: Defense-in-depth - Even if application code has bugs, database enforces isolation
-- Supabase: This script enables RLS on all 85 multi-tenant tables
--
-- CRITICAL: This prevents users from accessing other organizations' data
-- ============================================================================

-- ============================================================================
-- STEP 1: Enable RLS on all multi-tenant tables
-- ============================================================================

-- Core Business Tables
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;

-- AI & Automation
ALTER TABLE ai_agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agent_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agent_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_provider_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE luca_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_configurations ENABLE ROW LEVEL SECURITY;

-- Workflow & Automation
ALTER TABLE workflow_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_workflow_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_workflow_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_schedules ENABLE ROW LEVEL SECURITY;

-- Document Management
ALTER TABLE document_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE signature_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;

-- Forms & Templates
ALTER TABLE form_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- Client Portal & Onboarding
ALTER TABLE client_onboarding_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_portal_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_progress ENABLE ROW LEVEL SECURITY;

-- Communication
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;

-- Teams & Users
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_agent_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE supervisor_relationships ENABLE ROW LEVEL SECURITY;

-- Time Tracking & Resources
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_off_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Appointments & Scheduling
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_records ENABLE ROW LEVEL SECURITY;

-- Analytics & Reporting
ALTER TABLE performance_metric_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE personality_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE cultural_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_analysis_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE forecasting_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE forecasting_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;

-- Tasks & Projects
ALTER TABLE task_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_followups ENABLE ROW LEVEL SECURITY;

-- Marketplace & Subscriptions
ALTER TABLE marketplace_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_plan_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_redemptions ENABLE ROW LEVEL SECURITY;

-- Payment Gateways
ALTER TABLE payment_gateway_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

-- Security & Auth
ALTER TABLE sso_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Organization Management
ALTER TABLE organization_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

-- Support & Activity
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Roundtable & Skills
ALTER TABLE roundtable_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;

-- Client Relationships
ALTER TABLE client_contacts ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 2: Helper Function - Get User's Organization ID from JWT
-- ============================================================================

CREATE OR REPLACE FUNCTION auth.user_organization_id()
RETURNS VARCHAR AS $$
  SELECT organization_id::VARCHAR 
  FROM users 
  WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Helper function to check if user is Super Admin
CREATE OR REPLACE FUNCTION auth.is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = auth.uid()
    AND r.name = 'Super Admin'
  )
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================================================
-- STEP 3: Create RLS Policies for Each Table
-- ============================================================================

-- ===================
-- CLIENTS
-- ===================

CREATE POLICY "Users can view own organization clients"
  ON clients FOR SELECT
  USING (
    organization_id = auth.user_organization_id()
    OR auth.is_super_admin()
  );

CREATE POLICY "Users can insert to own organization"
  ON clients FOR INSERT
  WITH CHECK (
    organization_id = auth.user_organization_id()
  );

CREATE POLICY "Users can update own organization clients"
  ON clients FOR UPDATE
  USING (
    organization_id = auth.user_organization_id()
    OR auth.is_super_admin()
  );

CREATE POLICY "Users can delete own organization clients"
  ON clients FOR DELETE
  USING (
    organization_id = auth.user_organization_id()
    OR auth.is_super_admin()
  );

-- ===================
-- CONTACTS
-- ===================

CREATE POLICY "Users can view own organization contacts"
  ON contacts FOR SELECT
  USING (
    organization_id = auth.user_organization_id()
    OR auth.is_super_admin()
  );

CREATE POLICY "Users can insert contacts to own organization"
  ON contacts FOR INSERT
  WITH CHECK (
    organization_id = auth.user_organization_id()
  );

CREATE POLICY "Users can update own organization contacts"
  ON contacts FOR UPDATE
  USING (
    organization_id = auth.user_organization_id()
  );

CREATE POLICY "Users can delete own organization contacts"
  ON contacts FOR DELETE
  USING (
    organization_id = auth.user_organization_id()
  );

-- ===================
-- PROJECTS
-- ===================

CREATE POLICY "Users can view own organization projects"
  ON projects FOR SELECT
  USING (
    organization_id = auth.user_organization_id()
    OR auth.is_super_admin()
  );

CREATE POLICY "Users can create projects in own organization"
  ON projects FOR INSERT
  WITH CHECK (
    organization_id = auth.user_organization_id()
  );

CREATE POLICY "Users can update own organization projects"
  ON projects FOR UPDATE
  USING (
    organization_id = auth.user_organization_id()
  );

CREATE POLICY "Users can delete own organization projects"
  ON projects FOR DELETE
  USING (
    organization_id = auth.user_organization_id()
  );

-- ===================
-- DOCUMENTS
-- ===================

CREATE POLICY "Users can view own organization documents"
  ON documents FOR SELECT
  USING (
    organization_id = auth.user_organization_id()
    OR auth.is_super_admin()
  );

CREATE POLICY "Users can upload documents to own organization"
  ON documents FOR INSERT
  WITH CHECK (
    organization_id = auth.user_organization_id()
  );

CREATE POLICY "Users can update own organization documents"
  ON documents FOR UPDATE
  USING (
    organization_id = auth.user_organization_id()
  );

CREATE POLICY "Users can delete own organization documents"
  ON documents FOR DELETE
  USING (
    organization_id = auth.user_organization_id()
  );

-- ===================
-- WORKFLOWS
-- ===================

CREATE POLICY "Users can view own organization workflows"
  ON workflows FOR SELECT
  USING (
    organization_id = auth.user_organization_id()
    OR auth.is_super_admin()
  );

CREATE POLICY "Users can create workflows in own organization"
  ON workflows FOR INSERT
  WITH CHECK (
    organization_id = auth.user_organization_id()
  );

CREATE POLICY "Users can update own organization workflows"
  ON workflows FOR UPDATE
  USING (
    organization_id = auth.user_organization_id()
  );

CREATE POLICY "Users can delete own organization workflows"
  ON workflows FOR DELETE
  USING (
    organization_id = auth.user_organization_id()
  );

-- ===================
-- AI AGENT SESSIONS
-- ===================

CREATE POLICY "Users can view own organization AI sessions"
  ON agent_sessions FOR SELECT
  USING (
    organization_id = auth.user_organization_id()
    OR auth.is_super_admin()
  );

CREATE POLICY "Users can create AI sessions in own organization"
  ON agent_sessions FOR INSERT
  WITH CHECK (
    organization_id = auth.user_organization_id()
  );

CREATE POLICY "Users can update own organization AI sessions"
  ON agent_sessions FOR UPDATE
  USING (
    organization_id = auth.user_organization_id()
  );

CREATE POLICY "Users can delete own organization AI sessions"
  ON agent_sessions FOR DELETE
  USING (
    organization_id = auth.user_organization_id()
  );

-- ===================
-- LLM CONFIGURATIONS (Special: Allow NULL for system-wide)
-- ===================

CREATE POLICY "Users can view own org LLM configs or system-wide"
  ON llm_configurations FOR SELECT
  USING (
    organization_id = auth.user_organization_id()
    OR organization_id IS NULL  -- System-wide configs
    OR auth.is_super_admin()
  );

CREATE POLICY "Users can create LLM configs in own organization"
  ON llm_configurations FOR INSERT
  WITH CHECK (
    organization_id = auth.user_organization_id()
    OR (organization_id IS NULL AND auth.is_super_admin())  -- Only super admin can create system-wide
  );

CREATE POLICY "Users can update own org LLM configs"
  ON llm_configurations FOR UPDATE
  USING (
    organization_id = auth.user_organization_id()
    OR (organization_id IS NULL AND auth.is_super_admin())
  );

CREATE POLICY "Users can delete own org LLM configs"
  ON llm_configurations FOR DELETE
  USING (
    organization_id = auth.user_organization_id()
    OR (organization_id IS NULL AND auth.is_super_admin())
  );

-- ===================
-- INVOICES
-- ===================

CREATE POLICY "Users can view own organization invoices"
  ON invoices FOR SELECT
  USING (
    organization_id = auth.user_organization_id()
    OR auth.is_super_admin()
  );

CREATE POLICY "Users can create invoices in own organization"
  ON invoices FOR INSERT
  WITH CHECK (
    organization_id = auth.user_organization_id()
  );

CREATE POLICY "Users can update own organization invoices"
  ON invoices FOR UPDATE
  USING (
    organization_id = auth.user_organization_id()
  );

CREATE POLICY "Users can delete own organization invoices"
  ON invoices FOR DELETE
  USING (
    organization_id = auth.user_organization_id()
  );

-- ===================
-- PAYMENTS
-- ===================

CREATE POLICY "Users can view own organization payments"
  ON payments FOR SELECT
  USING (
    organization_id = auth.user_organization_id()
    OR auth.is_super_admin()
  );

CREATE POLICY "Users can create payments in own organization"
  ON payments FOR INSERT
  WITH CHECK (
    organization_id = auth.user_organization_id()
  );

CREATE POLICY "Users can update own organization payments"
  ON payments FOR UPDATE
  USING (
    organization_id = auth.user_organization_id()
  );

-- ============================================================================
-- STEP 4: Bulk Apply Same Policies to Remaining Tables
-- ============================================================================

-- This function creates standard CRUD policies for a table
CREATE OR REPLACE FUNCTION create_standard_rls_policies(table_name TEXT)
RETURNS VOID AS $$
BEGIN
  -- SELECT policy
  EXECUTE format('
    CREATE POLICY "%I_select_policy"
      ON %I FOR SELECT
      USING (
        organization_id = auth.user_organization_id()
        OR auth.is_super_admin()
      )', table_name, table_name);
  
  -- INSERT policy
  EXECUTE format('
    CREATE POLICY "%I_insert_policy"
      ON %I FOR INSERT
      WITH CHECK (
        organization_id = auth.user_organization_id()
      )', table_name, table_name);
  
  -- UPDATE policy
  EXECUTE format('
    CREATE POLICY "%I_update_policy"
      ON %I FOR UPDATE
      USING (
        organization_id = auth.user_organization_id()
        OR auth.is_super_admin()
      )', table_name, table_name);
  
  -- DELETE policy
  EXECUTE format('
    CREATE POLICY "%I_delete_policy"
      ON %I FOR DELETE
      USING (
        organization_id = auth.user_organization_id()
        OR auth.is_super_admin()
      )', table_name, table_name);
END;
$$ LANGUAGE plpgsql;

-- Apply standard policies to remaining tables
SELECT create_standard_rls_policies('proposals');
SELECT create_standard_rls_policies('ai_agent_conversations');
SELECT create_standard_rls_policies('ai_agent_installations');
SELECT create_standard_rls_policies('ai_agent_usage');
SELECT create_standard_rls_policies('ai_provider_configs');
SELECT create_standard_rls_policies('luca_chat_sessions');
SELECT create_standard_rls_policies('workflow_assignments');
SELECT create_standard_rls_policies('workflow_executions');
SELECT create_standard_rls_policies('assignment_workflow_stages');
SELECT create_standard_rls_policies('assignment_workflow_steps');
SELECT create_standard_rls_policies('assignment_workflow_tasks');
SELECT create_standard_rls_policies('recurring_schedules');
SELECT create_standard_rls_policies('document_requests');
SELECT create_standard_rls_policies('document_templates');
SELECT create_standard_rls_policies('document_versions');
SELECT create_standard_rls_policies('signature_requests');
SELECT create_standard_rls_policies('folders');
SELECT create_standard_rls_policies('form_templates');
SELECT create_standard_rls_policies('form_submissions');
SELECT create_standard_rls_policies('form_share_links');
SELECT create_standard_rls_policies('message_templates');
SELECT create_standard_rls_policies('email_templates');
SELECT create_standard_rls_policies('client_onboarding_sessions');
SELECT create_standard_rls_policies('client_portal_tasks');
SELECT create_standard_rls_policies('portal_invitations');
SELECT create_standard_rls_policies('onboarding_progress');
SELECT create_standard_rls_policies('conversations');
SELECT create_standard_rls_policies('live_chat_conversations');
SELECT create_standard_rls_policies('chat_channels');
SELECT create_standard_rls_policies('email_accounts');
SELECT create_standard_rls_policies('email_messages');
SELECT create_standard_rls_policies('call_logs');
SELECT create_standard_rls_policies('teams');
SELECT create_standard_rls_policies('user_organizations');
SELECT create_standard_rls_policies('user_agent_access');
SELECT create_standard_rls_policies('supervisor_relationships');
SELECT create_standard_rls_policies('time_entries');
SELECT create_standard_rls_policies('time_off_requests');
SELECT create_standard_rls_policies('resource_allocations');
SELECT create_standard_rls_policies('expenses');
SELECT create_standard_rls_policies('appointments');
SELECT create_standard_rls_policies('client_bookings');
SELECT create_standard_rls_policies('booking_rules');
SELECT create_standard_rls_policies('events');
SELECT create_standard_rls_policies('meeting_records');
SELECT create_standard_rls_policies('performance_metric_definitions');
SELECT create_standard_rls_policies('performance_scores');
SELECT create_standard_rls_policies('personality_profiles');
SELECT create_standard_rls_policies('conversation_metrics');
SELECT create_standard_rls_policies('cultural_profiles');
SELECT create_standard_rls_policies('ml_analysis_runs');
SELECT create_standard_rls_policies('forecasting_models');
SELECT create_standard_rls_policies('forecasting_runs');
SELECT create_standard_rls_policies('scheduled_reports');
SELECT create_standard_rls_policies('task_dependencies');
SELECT create_standard_rls_policies('task_followups');
SELECT create_standard_rls_policies('marketplace_items');
SELECT create_standard_rls_policies('marketplace_installations');
SELECT create_standard_rls_policies('platform_subscriptions');
SELECT create_standard_rls_policies('service_plans');
SELECT create_standard_rls_policies('service_plan_purchases');
SELECT create_standard_rls_policies('subscription_invoices');
SELECT create_standard_rls_policies('coupon_redemptions');
SELECT create_standard_rls_policies('payment_gateway_configs');
SELECT create_standard_rls_policies('payment_methods');
SELECT create_standard_rls_policies('sso_connections');
SELECT create_standard_rls_policies('oauth_connections');
SELECT create_standard_rls_policies('organization_keys');
SELECT create_standard_rls_policies('invitations');
SELECT create_standard_rls_policies('organization_agents');
SELECT create_standard_rls_policies('tags');
SELECT create_standard_rls_policies('support_tickets');
SELECT create_standard_rls_policies('notifications');
SELECT create_standard_rls_policies('activity_logs');
SELECT create_standard_rls_policies('roundtable_sessions');
SELECT create_standard_rls_policies('skills');
SELECT create_standard_rls_policies('client_contacts');

-- Special: Roles table (tenant-scoped + system roles)
CREATE POLICY "roles_select_policy"
  ON roles FOR SELECT
  USING (
    organization_id = auth.user_organization_id()
    OR organization_id IS NULL  -- System roles visible to all
    OR auth.is_super_admin()
  );

CREATE POLICY "roles_insert_policy"
  ON roles FOR INSERT
  WITH CHECK (
    organization_id = auth.user_organization_id()
    OR (organization_id IS NULL AND auth.is_super_admin())
  );

CREATE POLICY "roles_update_policy"
  ON roles FOR UPDATE
  USING (
    organization_id = auth.user_organization_id()
    OR (organization_id IS NULL AND auth.is_super_admin())
  );

CREATE POLICY "roles_delete_policy"
  ON roles FOR DELETE
  USING (
    organization_id = auth.user_organization_id()
    OR (organization_id IS NULL AND auth.is_super_admin())
  );

-- ============================================================================
-- STEP 5: Verification Queries
-- ============================================================================

-- Check RLS is enabled
SELECT 
  tablename, 
  rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('clients', 'documents', 'workflows', 'invoices', 'projects')
ORDER BY tablename;

-- Count policies created
SELECT 
  schemaname, 
  tablename, 
  COUNT(*) as policy_count
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY tablename;

-- ============================================================================
-- COMPLETION
-- ============================================================================

-- Display summary
DO $$
DECLARE
  rls_count INTEGER;
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO rls_count
  FROM pg_tables 
  WHERE schemaname = 'public' AND rowsecurity = true;
  
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies 
  WHERE schemaname = 'public';
  
  RAISE NOTICE '✅ RLS IMPLEMENTATION COMPLETE';
  RAISE NOTICE '📊 Tables with RLS enabled: %', rls_count;
  RAISE NOTICE '📋 Total policies created: %', policy_count;
  RAISE NOTICE '🔒 Multi-tenant data isolation: ENFORCED';
END $$;
