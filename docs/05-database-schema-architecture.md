# Database Schema & Architecture Documentation

## Overview
The database schema is designed for a multi-tenant SaaS platform using PostgreSQL with advanced features like JSONB columns, enums, and comprehensive indexing. The schema supports complex business workflows, AI agent interactions, payment processing, and enterprise-grade security.

## Database Technology
- **PostgreSQL 15+**: Primary database with advanced features
- **Neon**: Serverless PostgreSQL hosting platform
- **Drizzle ORM**: Type-safe SQL query builder and schema management
- **JSONB**: Flexible document storage for metadata and configurations
- **Enums**: Type-safe status and category management

## Schema Organization

### Core Entity Relationships
```
Organizations (Multi-tenant isolation)
├── Users (via userOrganizations - many-to-many)
├── Subscriptions (billing and features)
├── AI Agents (per-organization installations)
├── Workflows (automation and processes)
├── Documents (file management)
├── Clients (customer relationship management)
└── Analytics (usage tracking and metrics)
```

## Primary Tables Structure

### 1. User Management & Authentication

#### Users Table
```sql
CREATE TABLE "users" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "username" text NOT NULL UNIQUE,
  "email" text NOT NULL UNIQUE,
  "password" text NOT NULL,                    -- bcrypt hashed
  "first_name" text,
  "last_name" text,
  "phone" text,
  "country_code" text DEFAULT '+1',
  
  -- Email verification
  "email_verified" boolean DEFAULT false,
  "email_verified_at" timestamp,
  "email_verification_token" text,
  "email_verification_token_expiry" timestamp,
  
  -- Password reset
  "password_reset_token" text,
  "password_reset_token_expiry" timestamp,
  
  -- Phone verification
  "phone_verified" boolean DEFAULT false,
  "phone_verified_at" timestamp,
  
  -- Profile
  "avatar_url" text,
  
  -- KYC (Know Your Customer) fields
  "date_of_birth" timestamp,
  "national_id" text,                         -- SSN, PAN, etc.
  "national_id_type" text,                    -- 'ssn', 'pan', 'passport'
  "address" text,
  "city" text,
  "state" text,
  "zip_code" text,
  "country" text DEFAULT 'US',
  
  -- Emergency contact
  "emergency_contact_name" text,
  "emergency_contact_phone" text,
  "emergency_contact_relation" text,
  
  -- KYC verification
  "id_document_url" text,                     -- Uploaded ID proof
  "address_proof_url" text,                   -- Uploaded address proof
  "kyc_status" text DEFAULT 'pending',        -- 'pending', 'verified', 'rejected'
  "kyc_verified_at" timestamp,
  "kyc_rejection_reason" text,
  
  -- Organization relationships
  "role_id" varchar NOT NULL,
  "default_organization_id" varchar,          -- Default workspace
  
  "is_active" boolean DEFAULT true,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
```

#### Multi-Factor Authentication
```sql
CREATE TABLE "user_mfa" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  "mfa_enabled" boolean DEFAULT false,
  "mfa_enforced" boolean DEFAULT false,       -- Organization policy
  
  -- TOTP (Time-based One-Time Password)
  "totp_secret" text,                         -- AES-256-GCM encrypted
  
  -- Backup codes
  "backup_codes" text[] DEFAULT ARRAY[]::text[],
  "backup_codes_used" text[] DEFAULT ARRAY[]::text[],
  
  "last_verified" timestamp,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE "trusted_devices" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "device_id" varchar(255) NOT NULL,          -- Browser fingerprint
  "device_name" varchar(255),
  "ip_address" varchar(45),
  "user_agent" text,
  "expires_at" timestamp NOT NULL,            -- 30 days from trust
  "last_used" timestamp,
  "created_at" timestamp DEFAULT now()
);
```

### 2. Multi-Tenant Organization Management

#### Organizations & User Memberships
```sql
CREATE TABLE "organizations" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "slug" text NOT NULL UNIQUE,               -- URL-friendly identifier
  "domain" text UNIQUE,                      -- Custom domain (optional)
  "description" text,
  "logo_url" text,
  "website" text,
  "industry" text,
  "company_size" text,                       -- 'startup', 'sme', 'enterprise'
  
  -- Contact information
  "phone" text,
  "address" text,
  "city" text,
  "state" text,
  "zip_code" text,
  "country" text DEFAULT 'US',
  "timezone" text DEFAULT 'UTC',
  
  -- Business details
  "tax_id" text,                            -- Business tax ID
  "registration_number" text,                -- Company registration
  
  -- Settings
  "settings" jsonb DEFAULT '{}'::jsonb,      -- Organization preferences
  
  -- Compliance
  "is_verified" boolean DEFAULT false,
  "verification_level" text DEFAULT 'basic', -- 'basic', 'verified', 'enterprise'
  
  -- Status
  "is_active" boolean DEFAULT true,
  "created_by" varchar,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Multi-workspace membership
CREATE TABLE "user_organizations" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "organization_id" varchar NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  "role_id" varchar NOT NULL REFERENCES roles(id),
  
  -- Membership status
  "status" text DEFAULT 'active',            -- 'pending', 'active', 'suspended'
  "invited_by" varchar REFERENCES users(id),
  "joined_at" timestamp,
  "last_active_at" timestamp,
  
  -- Permissions and access
  "permissions_override" jsonb DEFAULT '{}'::jsonb,
  
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  
  UNIQUE("user_id", "organization_id")
);
```

### 3. Subscription & Billing System

#### Platform Subscriptions
```sql
CREATE TABLE "platform_subscriptions" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" varchar NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Plan details
  "plan_id" varchar NOT NULL REFERENCES subscription_plans(id),
  "plan_name" text NOT NULL,                 -- Snapshot at subscription time
  "plan_features" jsonb NOT NULL DEFAULT '[]'::jsonb,
  
  -- Pricing snapshot (immutable)
  "monthly_price" numeric(10,2),
  "yearly_price" numeric(10,2),
  "currency" text DEFAULT 'USD',
  "billing_cycle" text NOT NULL DEFAULT 'monthly', -- 'monthly', 'yearly'
  
  -- Status and lifecycle
  "status" text NOT NULL DEFAULT 'active',   -- 'active', 'cancelled', 'expired', 'suspended'
  "trial_end" timestamp,
  "current_period_start" timestamp DEFAULT now(),
  "current_period_end" timestamp NOT NULL,
  "next_billing_date" timestamp,
  
  -- Payment gateway integration
  "stripe_subscription_id" text UNIQUE,
  "stripe_customer_id" text,
  "razorpay_subscription_id" text UNIQUE,
  "razorpay_customer_id" text,
  
  -- Usage tracking
  "users_count" integer DEFAULT 0,
  "storage_used_gb" numeric(10,2) DEFAULT 0,
  "api_calls_count" integer DEFAULT 0,
  
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  "cancelled_at" timestamp
);
```

#### Payment Gateway Configurations
```sql
CREATE TABLE "payment_gateway_configs" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" varchar NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  "gateway" text NOT NULL,                   -- 'razorpay', 'stripe', 'payu'
  "nickname" text,                           -- User-friendly name
  
  -- Encrypted credentials (AES-256-GCM)
  "credentials" jsonb NOT NULL,              -- Encrypted API keys
  "config" jsonb DEFAULT '{}'::jsonb,        -- Webhook URLs, settings
  
  "is_active" boolean DEFAULT true,
  "is_default" boolean DEFAULT false,
  "is_test_mode" boolean DEFAULT false,
  
  "created_by" varchar NOT NULL REFERENCES users(id),
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
```

### 4. AI Agents System

#### AI Agents Registry
```sql
CREATE TABLE "ai_agents" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "slug" text NOT NULL UNIQUE,              -- 'luca', 'cadence', 'parity'
  "name" text NOT NULL,                     -- Display name
  "description" text,
  "category" text NOT NULL,                 -- 'assistant', 'workflow', 'accounting'
  "provider" text NOT NULL DEFAULT 'openai', -- 'openai', 'anthropic', 'azure-openai'
  
  -- Capabilities and features
  "capabilities" text[] DEFAULT ARRAY[]::text[],
  "frontend_entry" text NOT NULL,           -- Path to React component
  "backend_entry" text NOT NULL,            -- Path to Express handler
  
  -- Access control
  "subscription_min_plan" text DEFAULT 'free',
  "default_scope" text DEFAULT 'admin',     -- Default access level
  "pricing_model" text DEFAULT 'free',
  
  -- Configuration
  "configuration" jsonb DEFAULT '{}'::jsonb, -- Default LLM settings
  "icon_path" text,
  "version" text DEFAULT '1.0.0',
  "tags" text[] DEFAULT ARRAY[]::text[],
  
  -- Marketplace
  "is_published" boolean DEFAULT false,
  "is_pre_installed" boolean DEFAULT false,
  
  "created_by" varchar REFERENCES users(id),
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Organization-specific agent installations
CREATE TABLE "organization_agents" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" varchar NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  "agent_slug" text NOT NULL,
  
  "is_enabled" boolean DEFAULT true,
  "configuration" jsonb DEFAULT '{}'::jsonb,
  "custom_name" text,                       -- Organization-specific name
  "access_restrictions" jsonb DEFAULT '{}'::jsonb,
  
  "installed_by" varchar NOT NULL REFERENCES users(id),
  "installed_at" timestamp DEFAULT now(),
  "last_used_at" timestamp,
  
  UNIQUE("organization_id", "agent_slug")
);

-- User access to specific agents
CREATE TABLE "user_agent_access" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "organization_id" varchar NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  "agent_slug" text NOT NULL,
  
  "is_granted" boolean DEFAULT true,
  "granted_by" varchar REFERENCES users(id),
  "granted_at" timestamp DEFAULT now(),
  "expires_at" timestamp,                   -- Optional expiration
  
  UNIQUE("user_id", "organization_id", "agent_slug")
);
```

#### Agent Sessions & Messages
```sql
CREATE TABLE "agent_sessions" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "agent_slug" text NOT NULL,
  "session_id" varchar(255) NOT NULL UNIQUE,
  "user_id" varchar NOT NULL REFERENCES users(id),
  "organization_id" varchar NOT NULL REFERENCES organizations(id),
  
  "name" text,                              -- User-defined session name
  "title" varchar(500),                     -- Auto-generated title
  "metadata" jsonb DEFAULT '{}'::jsonb,
  
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE "agent_messages" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "session_id" varchar NOT NULL REFERENCES agent_sessions(session_id) ON DELETE CASCADE,
  "role" text NOT NULL,                     -- 'user', 'assistant', 'system'
  "content" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,     -- Tool calls, function results
  "created_at" timestamp DEFAULT now()
);
```

### 5. Document Management

#### Documents & File Storage
```sql
CREATE TABLE "documents" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" varchar NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  "folder_id" varchar REFERENCES folders(id),
  
  -- File details
  "filename" text NOT NULL,
  "original_filename" text NOT NULL,
  "file_path" text NOT NULL,               -- Storage path
  "file_size" integer NOT NULL,            -- Bytes
  "mime_type" text NOT NULL,
  "file_hash" text,                        -- SHA-256 for deduplication
  
  -- Classification
  "document_type" text,                    -- 'tax_return', 'financial_statement'
  "tags" text[] DEFAULT ARRAY[]::text[],
  
  -- Access control
  "visibility" text DEFAULT 'private',     -- 'private', 'team', 'client'
  "client_id" varchar REFERENCES clients(id),
  
  -- Metadata
  "description" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,    -- Custom fields, OCR results
  
  -- Versioning
  "version" integer DEFAULT 1,
  "parent_document_id" varchar REFERENCES documents(id),
  "is_current_version" boolean DEFAULT true,
  
  -- Security
  "is_encrypted" boolean DEFAULT false,
  "encryption_key_id" text,                -- For client-side encryption
  
  -- Digital signatures
  "signature_status" text DEFAULT 'none',  -- 'none', 'pending', 'signed'
  "signatures" jsonb DEFAULT '[]'::jsonb,  -- Signature metadata
  
  "uploaded_by" varchar NOT NULL REFERENCES users(id),
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Document access permissions
CREATE TABLE "document_permissions" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "document_id" varchar NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  "user_id" varchar REFERENCES users(id),
  "client_id" varchar REFERENCES clients(id),
  "role_id" varchar REFERENCES roles(id),
  
  "permission_type" text NOT NULL,          -- 'view', 'edit', 'delete', 'share'
  "granted_by" varchar NOT NULL REFERENCES users(id),
  "expires_at" timestamp,
  
  "created_at" timestamp DEFAULT now()
);
```

### 6. Workflow & Automation Engine

#### Workflows
```sql
CREATE TABLE "workflows" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" varchar NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  "name" text NOT NULL,
  "description" text,
  "category" text,                          -- 'tax_preparation', 'client_onboarding'
  
  -- Workflow definition
  "definition" jsonb NOT NULL,              -- Visual workflow definition
  "triggers" jsonb DEFAULT '[]'::jsonb,     -- Event triggers
  "actions" jsonb DEFAULT '[]'::jsonb,      -- Automated actions
  
  -- Configuration
  "is_template" boolean DEFAULT false,      -- Template vs instance
  "template_id" varchar REFERENCES workflows(id),
  "variables" jsonb DEFAULT '{}'::jsonb,    -- Configurable parameters
  
  -- Status
  "status" text DEFAULT 'draft',           -- 'draft', 'active', 'paused', 'archived'
  "version" integer DEFAULT 1,
  
  -- Access control
  "visibility" text DEFAULT 'private',     -- 'private', 'team', 'organization'
  "assigned_users" text[] DEFAULT ARRAY[]::text[],
  
  "created_by" varchar NOT NULL REFERENCES users(id),
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Workflow execution instances
CREATE TABLE "workflow_executions" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "workflow_id" varchar NOT NULL REFERENCES workflows(id),
  "organization_id" varchar NOT NULL REFERENCES organizations(id),
  
  "trigger_event" text NOT NULL,            -- What triggered the execution
  "trigger_data" jsonb DEFAULT '{}'::jsonb,
  "execution_context" jsonb DEFAULT '{}'::jsonb,
  
  "status" text DEFAULT 'running',         -- 'running', 'completed', 'failed', 'cancelled'
  "progress" integer DEFAULT 0,            -- Percentage complete
  "current_step" integer DEFAULT 0,
  
  "started_at" timestamp DEFAULT now(),
  "completed_at" timestamp,
  "error_message" text,
  "execution_log" jsonb DEFAULT '[]'::jsonb,
  
  "started_by" varchar REFERENCES users(id)
);
```

### 7. Client Relationship Management

#### Clients & Contacts
```sql
CREATE TABLE "clients" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" varchar NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Client information
  "name" text NOT NULL,
  "company_name" text,
  "client_type" text DEFAULT 'individual',  -- 'individual', 'business', 'nonprofit'
  "industry" text,
  "client_number" text,                     -- Internal reference number
  
  -- Contact details
  "email" text,
  "phone" text,
  "website" text,
  
  -- Address
  "address" text,
  "city" text,
  "state" text,
  "zip_code" text,
  "country" text DEFAULT 'US',
  
  -- Business details
  "tax_id" text,                           -- EIN, SSN, etc.
  "registration_number" text,
  "fiscal_year_end" text,                  -- 'December', 'March', etc.
  
  -- Relationship
  "status" text DEFAULT 'active',          -- 'active', 'inactive', 'prospect'
  "acquisition_source" text,               -- How they found us
  "referral_source" text,
  "assigned_manager" varchar REFERENCES users(id),
  
  -- Preferences
  "communication_preferences" jsonb DEFAULT '{}'::jsonb,
  "service_preferences" jsonb DEFAULT '{}'::jsonb,
  
  -- Financial
  "billing_address" jsonb,
  "payment_terms" text DEFAULT 'net_30',
  "credit_limit" numeric(12,2),
  
  "created_by" varchar NOT NULL REFERENCES users(id),
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Individual contacts within client organizations
CREATE TABLE "contacts" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" varchar NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  "client_id" varchar REFERENCES clients(id),
  
  "first_name" text NOT NULL,
  "last_name" text NOT NULL,
  "job_title" text,
  "department" text,
  
  "email" text,
  "phone" text,
  "mobile" text,
  
  "is_primary" boolean DEFAULT false,       -- Primary contact for client
  "can_authorize" boolean DEFAULT false,    -- Can make decisions
  "receives_communications" boolean DEFAULT true,
  
  "notes" text,
  "tags" text[] DEFAULT ARRAY[]::text[],
  
  "created_by" varchar NOT NULL REFERENCES users(id),
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
```

## Database Features & Optimizations

### 1. Indexing Strategy
```sql
-- Performance indexes for common queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS "users_organization_idx" ON "users"("organization_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "users_email_idx" ON "users"("email");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "users_username_idx" ON "users"("username");

-- Multi-column indexes for complex queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS "user_orgs_user_org_idx" 
ON "user_organizations"("user_id", "organization_id");

-- JSONB indexes for metadata queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS "documents_metadata_gin_idx" 
ON "documents" USING GIN ("metadata");

-- Partial indexes for active records
CREATE INDEX CONCURRENTLY IF NOT EXISTS "active_workflows_idx" 
ON "workflows"("organization_id") WHERE "status" = 'active';
```

### 2. Data Types & Constraints
```sql
-- Custom enum types for consistency
CREATE TYPE "subscription_status" AS ENUM (
  'active', 'cancelled', 'expired', 'suspended', 'trial'
);

CREATE TYPE "document_visibility" AS ENUM (
  'private', 'team', 'client', 'public'
);

-- Check constraints for data validation
ALTER TABLE "platform_subscriptions" 
ADD CONSTRAINT "valid_billing_cycle" 
CHECK ("billing_cycle" IN ('monthly', 'yearly'));

ALTER TABLE "documents" 
ADD CONSTRAINT "positive_file_size" 
CHECK ("file_size" > 0);
```

### 3. Security Features
```sql
-- Row Level Security (RLS) for multi-tenancy
ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents_org_isolation" ON "documents"
FOR ALL USING (organization_id IN (
  SELECT organization_id FROM user_organizations 
  WHERE user_id = current_setting('app.user_id')::varchar
));

-- Audit triggers for sensitive operations
CREATE OR REPLACE FUNCTION audit_trigger() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO activity_logs (user_id, action, resource, resource_id, metadata)
  VALUES (
    current_setting('app.user_id')::varchar,
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    jsonb_build_object('old', OLD, 'new', NEW)
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
```

### 4. Performance Optimizations
```sql
-- Partitioning for large tables (activity logs)
CREATE TABLE "activity_logs_y2024m01" PARTITION OF "activity_logs"
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- Materialized views for analytics
CREATE MATERIALIZED VIEW "organization_stats" AS
SELECT 
  o.id as organization_id,
  o.name,
  COUNT(DISTINCT u.id) as user_count,
  COUNT(DISTINCT c.id) as client_count,
  COUNT(DISTINCT d.id) as document_count,
  SUM(d.file_size) as total_storage_bytes
FROM organizations o
LEFT JOIN user_organizations uo ON o.id = uo.organization_id
LEFT JOIN users u ON uo.user_id = u.id
LEFT JOIN clients c ON o.id = c.organization_id
LEFT JOIN documents d ON o.id = d.organization_id
GROUP BY o.id, o.name;
```

## Migration Management

### 1. Schema Versioning
- **Drizzle Kit**: Automatic migration generation from schema changes
- **Migration Files**: SQL files with forward and rollback capabilities
- **Version Control**: All migrations tracked in version control
- **Production Safety**: Migrations tested in staging before production

### 2. Data Migration Strategies
```typescript
// Example data migration script
export async function migrateUserOrganizations() {
  const users = await db.select().from(usersTable).where(isNotNull(usersTable.organizationId));
  
  for (const user of users) {
    await db.insert(userOrganizationsTable).values({
      userId: user.id,
      organizationId: user.organizationId!,
      roleId: user.roleId,
      status: 'active',
      joinedAt: user.createdAt
    });
  }
}
```

### 3. Backup & Recovery
- **Automated Backups**: Daily snapshots via Neon
- **Point-in-time Recovery**: Transaction log-based recovery
- **Cross-region Replication**: Disaster recovery setup
- **Data Export**: Regular exports for compliance and analysis

This database architecture provides a robust foundation for enterprise SaaS applications with strong multi-tenancy, security, and scalability features.