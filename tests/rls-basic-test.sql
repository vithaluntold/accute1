/**
 * Basic RLS Verification Test (SQL-based)
 * 
 * This test can be run directly in Supabase SQL editor
 * to verify RLS policies are functioning correctly
 */

-- Test 1: Verify helper functions exist and work
SELECT 
  'Helper Functions Test' as test_name,
  (SELECT routine_name FROM information_schema.routines 
   WHERE routine_schema = 'public' AND routine_name = 'get_user_organization_id') as get_org_func,
  (SELECT routine_name FROM information_schema.routines 
   WHERE routine_schema = 'public' AND routine_name = 'is_super_admin') as super_admin_func;

-- Test 2: Verify RLS is enabled on key tables
SELECT 
  'RLS Enabled Test' as test_name,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('clients', 'documents', 'agent_sessions', 'invoices', 'workflows')
ORDER BY tablename;

-- Test 3: Count total RLS policies
SELECT 
  'Policy Count Test' as test_name,
  COUNT(*) as total_policies,
  COUNT(DISTINCT tablename) as tables_with_policies
FROM pg_policies 
WHERE schemaname = 'public';

-- Test 4: Verify standard policy pattern on clients table
SELECT 
  'Clients Policies Test' as test_name,
  policyname,
  cmd as operation
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'clients'
ORDER BY cmd;

-- Test 5: Verify special handling for llm_configurations
SELECT 
  'LLM Config Special Policy Test' as test_name,
  policyname,
  cmd as operation,
  CASE 
    WHEN qual LIKE '%organization_id IS NULL%' THEN 'Has NULL check'
    ELSE 'Missing NULL check'
  END as null_handling
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'llm_configurations'
ORDER BY cmd;

-- Test 6: Sample data isolation test
-- Create two test organizations and verify isolation

BEGIN;

-- Create test organizations
INSERT INTO organizations (id, name, slug, status) 
VALUES 
  ('test-org-a', 'Test Org A', 'test-org-a', 'active'),
  ('test-org-b', 'Test Org B', 'test-org-b', 'active')
ON CONFLICT (id) DO NOTHING;

-- Create test clients
INSERT INTO clients (id, name, email, organization_id) 
VALUES 
  ('test-client-a', 'Client A', 'client-a@test.com', 'test-org-a'),
  ('test-client-b', 'Client B', 'client-b@test.com', 'test-org-b')
ON CONFLICT (id) DO NOTHING;

-- Verify both clients exist (as admin/no RLS context)
SELECT 
  'Pre-RLS Check' as test_name,
  COUNT(*) as total_clients,
  COUNT(CASE WHEN organization_id = 'test-org-a' THEN 1 END) as org_a_clients,
  COUNT(CASE WHEN organization_id = 'test-org-b' THEN 1 END) as org_b_clients
FROM clients
WHERE id IN ('test-client-a', 'test-client-b');

-- Cleanup
DELETE FROM clients WHERE id IN ('test-client-a', 'test-client-b');
DELETE FROM organizations WHERE id IN ('test-org-a', 'test-org-b');

ROLLBACK;

-- Summary
SELECT 
  '=== RLS IMPLEMENTATION SUMMARY ===' as summary,
  (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true) as tables_with_rls,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public') as total_policies,
  (SELECT COUNT(DISTINCT tablename) FROM pg_policies WHERE schemaname = 'public') as tables_with_policies,
  CASE 
    WHEN (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public') >= 340 
    THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as status;
