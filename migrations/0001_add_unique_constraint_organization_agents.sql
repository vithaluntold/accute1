-- Migration: Add unique constraint to organization_agents table
-- This prevents duplicate agent installations for the same organization

-- First, remove any existing duplicates (keep the most recent one)
DELETE FROM organization_agents a
USING organization_agents b
WHERE a.id < b.id 
  AND a.organization_id = b.organization_id 
  AND a.agent_id = b.agent_id;
--> statement-breakpoint

-- Drop the existing non-unique index
DROP INDEX IF EXISTS "organization_agents_unique_idx";
--> statement-breakpoint

-- Create a proper unique index
CREATE UNIQUE INDEX "organization_agents_unique_idx" ON "organization_agents" ("organization_id", "agent_id");
