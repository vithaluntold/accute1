-- Add automatic updated_at triggers for all tables
-- This ensures updated_at is automatically set on UPDATE operations

-- Create a reusable function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';
--> statement-breakpoint

-- Add trigger for ai_agents table
DROP TRIGGER IF EXISTS update_ai_agents_updated_at ON ai_agents;
--> statement-breakpoint
CREATE TRIGGER update_ai_agents_updated_at
    BEFORE UPDATE ON ai_agents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
--> statement-breakpoint

-- Add trigger for organization_agents table
DROP TRIGGER IF EXISTS update_organization_agents_updated_at ON organization_agents;
--> statement-breakpoint
CREATE TRIGGER update_organization_agents_updated_at
    BEFORE UPDATE ON organization_agents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
