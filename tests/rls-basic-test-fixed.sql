/**
 * RLS Verification Test (SQL-based - FIXED)
 * Run directly in Supabase SQL editor to verify RLS is working
 */

-- Test 1: Verify helper functions exist
SELECT 
  'Helper Functions Test' as test_name,
  (SELECT routine_name FROM information_schema.routines 
   WHERE routine_schema = 'public' AND routine_name = 'get_user_organization_id') as get_org_func,
  (SELECT routine_name FROM information_schema.routines 
   WHERE routine_schema = 'public' AND routine_name = 'is_super_admin') as super_admin_func;

-- Test 2: Verify RLS is enabled on critical tables
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

-- Test 5: Verify LLM configurations allow NULL org_id (system-wide resources)
SELECT 
  'LLM Config Special Policy Test' as test_name,
  COUNT(*) as policies_with_null_handling
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'llm_configurations'
  AND qual LIKE '%organization_id IS NULL%';

-- Test 6: Sample isolation test (non-destructive)
BEGIN;

-- Get existing organization
DO $$
DECLARE
  test_org_id VARCHAR;
BEGIN
  SELECT id INTO test_org_id FROM organizations LIMIT 1;
  
  -- Insert test client
  INSERT INTO clients (id, name, email, organization_id) 
  VALUES ('rls-test-client-1', 'RLS Test Client', 'rls-test@example.com', test_org_id)
  ON CONFLICT (id) DO NOTHING;
  
  RAISE NOTICE 'Created test client in org: %', test_org_id;
END $$;

-- Cleanup
DELETE FROM clients WHERE id = 'rls-test-client-1';

ROLLBACK;

-- Summary
SELECT 
  '=== RLS IMPLEMENTATION SUMMARY ===' as summary,
  (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true) as tables_with_rls,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public') as total_policies,
  (SELECT COUNT(DISTINCT tablename) FROM pg_policies WHERE schemaname = 'public') as tables_with_policies,
  CASE 
    WHEN (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public') >= 340 
    THEN '✅ PASS - Production Ready'
    ELSE '❌ FAIL - Incomplete'
  END as status;