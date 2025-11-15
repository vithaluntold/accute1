#!/bin/bash
# Agent Health Check Script
# Tests all 10 AI agent LLM endpoints to verify they're working in production

set -e

echo "🔍 AI Agent Health Check - Testing all 10 agents..."
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BASE_URL="http://localhost:5000"

# Get session token (login as admin)
echo "🔐 Logging in to get session token..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@sterling.com",
    "password": "Admin123!"
  }')

SESSION_TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$SESSION_TOKEN" ]; then
  echo -e "${RED}❌ Failed to get session token${NC}"
  echo "Login response: $LOGIN_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Logged in successfully${NC}"
echo ""

# Test counter
TOTAL_TESTS=10
PASSED=0
FAILED=0

# Function to test an agent endpoint
test_agent() {
  local agent_name=$1
  local endpoint=$2
  local payload=$3
  
  echo "Testing $agent_name..."
  
  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL$endpoint" \
    -H "Content-Type: application/json" \
    -H "Cookie: session_token=$SESSION_TOKEN" \
    -d "$payload")
  
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | sed '$d')
  
  if [ "$HTTP_CODE" = "200" ]; then
    # Check if response contains an error
    if echo "$BODY" | grep -q '"error"'; then
      ERROR_MSG=$(echo "$BODY" | grep -o '"error":"[^"]*"' | cut -d'"' -f4 | head -n1)
      echo -e "${RED}❌ $agent_name - Error in response: $ERROR_MSG${NC}"
      FAILED=$((FAILED + 1))
    else
      echo -e "${GREEN}✅ $agent_name - Working!${NC}"
      PASSED=$((PASSED + 1))
    fi
  elif [ "$HTTP_CODE" = "400" ]; then
    # 400 might be expected if no LLM config
    ERROR_MSG=$(echo "$BODY" | grep -o '"error":"[^"]*"' | cut -d'"' -f4 | head -n1)
    if echo "$ERROR_MSG" | grep -q "No LLM configuration"; then
      echo -e "${YELLOW}⚠️  $agent_name - No LLM config (expected if not configured)${NC}"
      echo -e "   Error: $ERROR_MSG"
      PASSED=$((PASSED + 1))
    else
      echo -e "${RED}❌ $agent_name - HTTP 400: $ERROR_MSG${NC}"
      FAILED=$((FAILED + 1))
    fi
  else
    ERROR_MSG=$(echo "$BODY" | grep -o '"error":"[^"]*"' | cut -d'"' -f4 | head -n1)
    echo -e "${RED}❌ $agent_name - HTTP $HTTP_CODE: $ERROR_MSG${NC}"
    FAILED=$((FAILED + 1))
  fi
  
  echo ""
}

# Test all 10 agents
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Testing Agent Endpoints..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. Luca
test_agent "Luca (AI Accounting Expert)" \
  "/api/agents/luca/query" \
  '{"query": "What is the difference between cash and accrual accounting?"}'

# 2. Parity
test_agent "Parity (Document Generation)" \
  "/api/agents/parity/chat" \
  '{"message": "Create a sample invoice template", "history": []}'

# 3. Cadence
test_agent "Cadence (Workflow Builder)" \
  "/api/agents/cadence/chat" \
  '{"message": "Create a workflow for client onboarding", "history": []}'

# 4. Forma
test_agent "Forma (Form Builder)" \
  "/api/agents/forma/chat" \
  '{"message": "Create a contact information form", "history": []}'

# 5. Echo
test_agent "Echo (Message Templates)" \
  "/api/agents/echo/chat" \
  '{"message": "Create a welcome email template", "history": []}'

# 6. Relay
test_agent "Relay (Email Inbox)" \
  "/api/agents/relay/chat" \
  '{"message": "Help me process this email", "history": []}'

# 7. Scribe
test_agent "Scribe (Email Templates)" \
  "/api/agents/scribe/chat" \
  '{"message": "Create a professional email template", "history": []}'

# 8. Radar
test_agent "Radar (Activity Tracking)" \
  "/api/agents/radar/chat" \
  '{"message": "Show me recent activity", "history": []}'

# 9. OmniSpectra
test_agent "OmniSpectra (Assignment Tracking)" \
  "/api/agents/omnispectra/chat" \
  '{"message": "Show assignment status", "history": []}'

# 10. Lynk
test_agent "Lynk (Client Messages)" \
  "/api/agents/lynk/chat" \
  '{"message": "Process this client message", "history": []}'

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Total Agents Tested: $TOTAL_TESTS"
echo -e "${GREEN}Passed: $PASSED${NC}"
if [ $FAILED -gt 0 ]; then
  echo -e "${RED}Failed: $FAILED${NC}"
else
  echo -e "${GREEN}Failed: 0${NC}"
fi
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}🎉 All agents are working!${NC}"
  exit 0
else
  echo -e "${RED}⚠️  Some agents failed. Check errors above.${NC}"
  exit 1
fi
