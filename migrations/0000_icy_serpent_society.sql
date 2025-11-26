CREATE TYPE "public"."metric_aggregation_type" AS ENUM('sum', 'average', 'min', 'max', 'count', 'rate', 'percentage');--> statement-breakpoint
CREATE TYPE "public"."ml_model_type" AS ENUM('keyword_analysis', 'sentiment_analysis', 'behavioral_patterns', 'llm_validation', 'cultural_inference', 'performance_predictor');--> statement-breakpoint
CREATE TYPE "public"."personality_framework" AS ENUM('big_five', 'disc', 'mbti', 'eq', 'cultural');--> statement-breakpoint
CREATE TYPE "public"."proposal_status" AS ENUM('draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."trait_type" AS ENUM('openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism', 'dominance', 'influence', 'steadiness', 'compliance', 'introversion_extraversion', 'sensing_intuition', 'thinking_feeling', 'judging_perceiving', 'self_awareness', 'self_regulation', 'motivation', 'empathy', 'social_skills', 'power_distance', 'individualism_collectivism', 'masculinity_femininity', 'uncertainty_avoidance', 'long_term_orientation', 'indulgence_restraint');--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"organization_id" varchar,
	"action" text NOT NULL,
	"resource" text NOT NULL,
	"resource_id" varchar,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_availability" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"status" text DEFAULT 'offline' NOT NULL,
	"status_message" text,
	"max_concurrent_chats" integer DEFAULT 3 NOT NULL,
	"current_chat_count" integer DEFAULT 0 NOT NULL,
	"is_accepting_chats" boolean DEFAULT true NOT NULL,
	"last_online_at" timestamp,
	"last_activity_at" timestamp,
	"auto_away_minutes" integer DEFAULT 10,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agent_availability_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "agent_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_slug" text NOT NULL,
	"session_id" varchar(255) NOT NULL,
	"user_id" varchar NOT NULL,
	"organization_id" varchar NOT NULL,
	"name" text,
	"title" varchar(500),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agent_sessions_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "ai_agent_conversations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_name" text NOT NULL,
	"organization_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"title" text,
	"context_type" text,
	"context_id" varchar,
	"context_data" jsonb DEFAULT '{}'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_message_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_agent_installations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" varchar NOT NULL,
	"organization_id" varchar NOT NULL,
	"installed_by" varchar NOT NULL,
	"configuration" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_agent_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"function_calls" jsonb DEFAULT '[]'::jsonb,
	"tool_executions" jsonb DEFAULT '[]'::jsonb,
	"llm_config_id" varchar,
	"tokens_used" integer,
	"execution_time_ms" integer,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_agent_usage" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" varchar NOT NULL,
	"organization_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"instance_count" integer DEFAULT 1 NOT NULL,
	"token_count" integer DEFAULT 0 NOT NULL,
	"execution_time_ms" integer,
	"cost" numeric(10, 6) DEFAULT 0 NOT NULL,
	"billing_period" text,
	"conversation_id" varchar,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_agents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"provider" text NOT NULL,
	"category" text NOT NULL,
	"capabilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"configuration" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"rating" integer DEFAULT 0,
	"install_count" integer DEFAULT 0 NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"backend_path" text,
	"frontend_path" text,
	"icon_path" text,
	"manifest_json" text,
	"pricing_model" text DEFAULT 'free' NOT NULL,
	"price_monthly" numeric(10, 2) DEFAULT 0,
	"price_yearly" numeric(10, 2) DEFAULT 0,
	"price_per_instance" numeric(10, 4) DEFAULT 0,
	"price_per_token" numeric(10, 6) DEFAULT 0,
	"one_time_fee" numeric(10, 2) DEFAULT 0,
	"subscription_min_plan" text DEFAULT 'free' NOT NULL,
	"default_scope" text DEFAULT 'admin' NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp,
	"published_by" varchar,
	"version" text DEFAULT '1.0.0' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ai_agents_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "ai_provider_configs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"provider" text NOT NULL,
	"encrypted_api_key" text NOT NULL,
	"endpoint" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"client_id" varchar,
	"assigned_to" varchar,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"location" text,
	"meeting_url" text,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"reminder_sent" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assignment_workflow_stages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" varchar NOT NULL,
	"template_stage_id" varchar,
	"organization_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"order" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"color" text DEFAULT '#6b7280',
	"auto_progress" boolean DEFAULT false NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assignment_workflow_steps" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_stage_id" varchar NOT NULL,
	"template_step_id" varchar,
	"organization_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"order" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"type" text DEFAULT 'manual' NOT NULL,
	"assigned_to" varchar,
	"auto_progress" boolean DEFAULT false NOT NULL,
	"due_date" timestamp,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assignment_workflow_tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_step_id" varchar NOT NULL,
	"template_task_id" varchar,
	"organization_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" text DEFAULT 'manual' NOT NULL,
	"order" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"assigned_to" varchar,
	"assigned_to_contact" varchar,
	"ai_agent_id" varchar,
	"automation_input" jsonb DEFAULT '{}'::jsonb,
	"automation_output" jsonb DEFAULT '{}'::jsonb,
	"priority" text DEFAULT 'medium' NOT NULL,
	"due_date" timestamp,
	"started_at" timestamp,
	"completed_at" timestamp,
	"completed_by" varchar,
	"visible_to_client" boolean DEFAULT false NOT NULL,
	"client_portal_task_id" varchar,
	"auto_progress" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation_triggers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"event" text NOT NULL,
	"conditions" jsonb DEFAULT '[]'::jsonb,
	"condition_edges" jsonb DEFAULT '[]'::jsonb,
	"workflow_id" varchar,
	"stage_id" varchar,
	"step_id" varchar,
	"actions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"auto_advance_enabled" boolean DEFAULT false NOT NULL,
	"auto_advance_target_stage_id" varchar,
	"auto_advance_target_step_id" varchar,
	"is_scheduled" boolean DEFAULT false NOT NULL,
	"schedule_type" text,
	"cron_expression" text,
	"schedule_time" timestamp,
	"due_date_offset" integer,
	"last_executed" timestamp,
	"next_execution" timestamp,
	"enabled" boolean DEFAULT true NOT NULL,
	"is_executing" boolean DEFAULT false NOT NULL,
	"locked_at" timestamp,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"service_type" text,
	"duration" integer DEFAULT 60 NOT NULL,
	"available_days" text[] NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"buffer_time" integer DEFAULT 15,
	"assigned_to" text[],
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "call_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"channel_id" varchar,
	"caller_id" varchar NOT NULL,
	"receiver_id" varchar NOT NULL,
	"call_type" text NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"duration" integer,
	"quality" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_channels" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" text DEFAULT 'group' NOT NULL,
	"project_id" varchar,
	"is_private" boolean DEFAULT false NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_members" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"last_read_at" timestamp,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" varchar NOT NULL,
	"sender_id" varchar NOT NULL,
	"content" text NOT NULL,
	"mentions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_edited" boolean DEFAULT false NOT NULL,
	"edited_at" timestamp,
	"parent_message_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_bookings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"booking_rule_id" varchar,
	"client_id" varchar,
	"client_name" text,
	"client_email" text NOT NULL,
	"client_phone" text,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"assigned_to" varchar,
	"meeting_record_id" varchar,
	"status" text DEFAULT 'pending' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_contacts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"contact_id" varchar NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"organization_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "client_contacts_client_id_contact_id_unique" UNIQUE("client_id","contact_id")
);
--> statement-breakpoint
CREATE TABLE "client_onboarding_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"created_by" varchar NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"collected_data" jsonb DEFAULT '{}'::jsonb,
	"sensitive_data" jsonb DEFAULT '{}'::jsonb,
	"client_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "client_portal_tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"assignment_id" varchar,
	"title" text NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"source_type" text,
	"source_id" varchar,
	"assigned_to" varchar,
	"assigned_by" varchar NOT NULL,
	"created_by" varchar NOT NULL,
	"due_date" timestamp,
	"started_at" timestamp,
	"completed_at" timestamp,
	"completed_by" varchar,
	"requires_followup" boolean DEFAULT false NOT NULL,
	"last_followup_sent" timestamp,
	"followup_count" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"attachments" jsonb DEFAULT '[]'::jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" text NOT NULL,
	"contact_name" text,
	"email" text NOT NULL,
	"phone" text,
	"address" text,
	"city" text,
	"state" text,
	"zip_code" text,
	"country" text DEFAULT 'US' NOT NULL,
	"tax_id" text,
	"organization_id" varchar NOT NULL,
	"assigned_to" varchar,
	"status" text DEFAULT 'active' NOT NULL,
	"industry" text,
	"notes" text,
	"tags" text[] DEFAULT ARRAY[]::text[],
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar,
	"user_id" varchar,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"title" text,
	"department" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"notes" text,
	"organization_id" varchar NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"organization_id" varchar NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"channel_type" varchar(50) NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL,
	"avg_message_length" numeric(10, 2),
	"avg_response_time_seconds" numeric(10, 2),
	"sentiment_positive" numeric(5, 2),
	"sentiment_neutral" numeric(5, 2),
	"sentiment_negative" numeric(5, 2),
	"question_asked_count" integer DEFAULT 0 NOT NULL,
	"exclamation_count" integer DEFAULT 0 NOT NULL,
	"emoji_usage_count" integer DEFAULT 0 NOT NULL,
	"conversations_initiated" integer DEFAULT 0 NOT NULL,
	"conversations_participated" integer DEFAULT 0 NOT NULL,
	"linguistic_markers" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"client_id" varchar,
	"subject" text,
	"status" text DEFAULT 'active' NOT NULL,
	"last_message_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupon_redemptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coupon_id" varchar NOT NULL,
	"organization_id" varchar NOT NULL,
	"subscription_id" varchar,
	"discount_snapshot" jsonb NOT NULL,
	"redeemed_by" varchar,
	"redeemed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_org_coupon" UNIQUE("coupon_id","organization_id")
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"discount_type" text NOT NULL,
	"discount_value" numeric(10, 2) NOT NULL,
	"applicable_plans" jsonb DEFAULT '[]'::jsonb,
	"minimum_seats" integer,
	"max_redemptions" integer,
	"current_redemptions" integer DEFAULT 0 NOT NULL,
	"max_redemptions_per_organization" integer DEFAULT 1 NOT NULL,
	"valid_from" timestamp DEFAULT now() NOT NULL,
	"valid_until" timestamp,
	"duration_months" integer,
	"stripe_coupon_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coupons_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "crypto_audit_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sequence_number" serial NOT NULL,
	"operation" varchar(50) NOT NULL,
	"operation_type" varchar(20) NOT NULL,
	"resource_type" varchar(50) NOT NULL,
	"resource_id" varchar(255),
	"kek_id" varchar,
	"dek_id" varchar,
	"entry_hash" varchar(128) NOT NULL,
	"previous_hash" varchar(128),
	"signature" text,
	"signature_key_id" varchar(255),
	"actor_user_id" varchar,
	"actor_ip_address" varchar(45),
	"actor_user_agent" text,
	"status" varchar(20) DEFAULT 'success' NOT NULL,
	"error_message" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cultural_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"organization_id" varchar NOT NULL,
	"country_code" varchar(2),
	"location_based_profile" jsonb,
	"power_distance" integer,
	"individualism_collectivism" integer,
	"masculinity_femininity" integer,
	"uncertainty_avoidance" integer,
	"long_term_orientation" integer,
	"indulgence_restraint" integer,
	"behavioral_confidence" integer DEFAULT 0 NOT NULL,
	"conversations_analyzed" integer DEFAULT 0 NOT NULL,
	"last_analysis_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cultural_profiles_user_org_unique" UNIQUE("user_id","organization_id")
);
--> statement-breakpoint
CREATE TABLE "dek_registry" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key_id" varchar(255) NOT NULL,
	"kek_id" varchar NOT NULL,
	"wrapped_key_material" text NOT NULL,
	"key_wrap_algorithm" varchar(50) DEFAULT 'RSA-OAEP-256' NOT NULL,
	"algorithm" varchar(50) DEFAULT 'AES-256-GCM' NOT NULL,
	"domain" varchar(100) NOT NULL,
	"organization_id" varchar,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "dek_registry_key_id_unique" UNIQUE("key_id")
);
--> statement-breakpoint
CREATE TABLE "document_annotations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"type" text NOT NULL,
	"page_number" integer NOT NULL,
	"position" jsonb NOT NULL,
	"content" text,
	"color" text DEFAULT '#FFD700' NOT NULL,
	"mentions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"resolved_by" varchar,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_change_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"document_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"change_type" text NOT NULL,
	"change_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"position" integer,
	"length" integer,
	"is_accepted" boolean,
	"is_rejected" boolean,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_collaboration_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" varchar NOT NULL,
	"started_by" varchar NOT NULL,
	"track_changes_enabled" boolean DEFAULT true,
	"status" text DEFAULT 'active' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "document_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"created_by" varchar NOT NULL,
	"assigned_to" varchar,
	"status" text DEFAULT 'pending' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"due_date" timestamp,
	"completed_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_submissions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"required_document_id" varchar NOT NULL,
	"document_id" varchar NOT NULL,
	"submitted_by" varchar NOT NULL,
	"status" text DEFAULT 'pending_review' NOT NULL,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"review_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" text DEFAULT 'engagement_letter' NOT NULL,
	"content" text NOT NULL,
	"description" text,
	"scope" text DEFAULT 'organization' NOT NULL,
	"organization_id" varchar,
	"created_by" varchar,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_version_diffs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" varchar NOT NULL,
	"from_version_id" varchar NOT NULL,
	"to_version_id" varchar NOT NULL,
	"diff_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"diff_html" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_versions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" varchar NOT NULL,
	"version_number" integer NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"size" integer NOT NULL,
	"url" text NOT NULL,
	"change_description" text,
	"change_type" text DEFAULT 'minor' NOT NULL,
	"document_hash" text NOT NULL,
	"digital_signature" text,
	"encrypted_content" text,
	"uploaded_by" varchar NOT NULL,
	"organization_id" varchar NOT NULL,
	"approval_status" text DEFAULT 'pending' NOT NULL,
	"approved_by" varchar,
	"approved_at" timestamp,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "document_versions_unique" UNIQUE("document_id","version_number")
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"size" integer NOT NULL,
	"url" text NOT NULL,
	"organization_id" varchar NOT NULL,
	"uploaded_by" varchar NOT NULL,
	"workflow_id" varchar,
	"status" text DEFAULT 'pending' NOT NULL,
	"encrypted_content" text,
	"document_hash" text,
	"digital_signature" text,
	"signature_algorithm" text DEFAULT 'RSA-SHA256',
	"signed_at" timestamp,
	"signed_by" varchar,
	"verification_status" text DEFAULT 'unverified',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_accounts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"provider" text NOT NULL,
	"email" text NOT NULL,
	"display_name" text,
	"auth_type" text NOT NULL,
	"encrypted_credentials" text NOT NULL,
	"imap_host" text,
	"imap_port" integer,
	"smtp_host" text,
	"smtp_port" integer,
	"use_ssl" boolean DEFAULT true,
	"status" text DEFAULT 'active' NOT NULL,
	"last_sync_at" timestamp,
	"last_sync_error" text,
	"sync_interval" integer DEFAULT 300000,
	"auto_create_tasks" boolean DEFAULT false,
	"default_workflow_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_account_id" varchar NOT NULL,
	"organization_id" varchar NOT NULL,
	"message_id" text NOT NULL,
	"provider_message_id" text NOT NULL,
	"thread_id" text,
	"from" text NOT NULL,
	"to" text[] NOT NULL,
	"cc" text[],
	"bcc" text[],
	"reply_to" text,
	"subject" text NOT NULL,
	"normalized_subject" text,
	"body" text NOT NULL,
	"body_html" text,
	"sent_at" timestamp NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"is_read" boolean DEFAULT false,
	"is_starred" boolean DEFAULT false,
	"has_attachments" boolean DEFAULT false,
	"labels" text[],
	"ai_processed" boolean DEFAULT false,
	"ai_processed_at" timestamp,
	"ai_extracted_data" jsonb DEFAULT '{}'::jsonb,
	"created_task_id" varchar,
	"attachments" jsonb DEFAULT '[]'::jsonb,
	"raw_headers" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"scope" text DEFAULT 'organization' NOT NULL,
	"organization_id" varchar,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"variables" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"logo_url" text,
	"footer_text" text,
	"social_links" jsonb DEFAULT '{}'::jsonb,
	"branding_colors" jsonb DEFAULT '{}'::jsonb,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_attendees" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" varchar NOT NULL,
	"user_id" varchar,
	"email" text,
	"name" text,
	"rsvp_status" text DEFAULT 'pending' NOT NULL,
	"rsvp_at" timestamp,
	"is_optional" boolean DEFAULT false NOT NULL,
	"is_organizer" boolean DEFAULT false NOT NULL,
	"reminder_sent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"type" text DEFAULT 'meeting' NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"all_day" boolean DEFAULT false NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"location" text,
	"meeting_url" text,
	"meeting_provider" text,
	"meeting_provider_id" text,
	"client_id" varchar,
	"project_id" varchar,
	"workflow_task_id" varchar,
	"organizer_id" varchar NOT NULL,
	"assigned_to" varchar,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"is_recurring" boolean DEFAULT false NOT NULL,
	"recurrence_rule" text,
	"recurrence_parent_id" varchar,
	"recurrence_exception" boolean DEFAULT false NOT NULL,
	"reminder_minutes" integer[] DEFAULT ARRAY[15]::integer[],
	"last_reminder_sent" timestamp,
	"color" text,
	"notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"client_id" varchar,
	"project_id" varchar,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"is_billable" boolean DEFAULT true NOT NULL,
	"is_invoiced" boolean DEFAULT false NOT NULL,
	"invoice_id" varchar,
	"receipt" text,
	"date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "folders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"parent_id" varchar,
	"organization_id" varchar NOT NULL,
	"content_type" text NOT NULL,
	"created_by" varchar NOT NULL,
	"shared_with" jsonb DEFAULT '[]'::jsonb,
	"color" text,
	"icon" text,
	"description" text,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forecasting_models" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"forecast_type" text NOT NULL,
	"strategy" text DEFAULT 'statistical' NOT NULL,
	"configuration" jsonb DEFAULT '{}'::jsonb,
	"is_active" boolean DEFAULT true,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forecasting_predictions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" varchar NOT NULL,
	"scenario_id" varchar,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"confidence_score" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forecasting_runs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"model_id" varchar NOT NULL,
	"run_by" varchar NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"granularity" text DEFAULT 'monthly' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"llm_provider" text,
	"llm_model" text,
	"llm_tokens_used" integer,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forecasting_scenarios" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" varchar NOT NULL,
	"label" text NOT NULL,
	"growth_rate" text,
	"assumptions" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "form_share_links" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_template_id" varchar NOT NULL,
	"organization_id" varchar NOT NULL,
	"created_by" varchar NOT NULL,
	"share_token" varchar NOT NULL,
	"client_id" varchar,
	"password" text,
	"expires_at" timestamp,
	"max_submissions" integer,
	"status" text DEFAULT 'active' NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"submission_count" integer DEFAULT 0 NOT NULL,
	"last_accessed_at" timestamp,
	"due_date" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "form_share_links_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
CREATE TABLE "form_submissions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_template_id" varchar NOT NULL,
	"form_version" integer NOT NULL,
	"organization_id" varchar NOT NULL,
	"submitted_by" varchar,
	"client_id" varchar,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'submitted' NOT NULL,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"review_notes" text,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "form_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'custom' NOT NULL,
	"scope" text DEFAULT 'organization' NOT NULL,
	"organization_id" varchar,
	"created_by" varchar NOT NULL,
	"fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"conditional_rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"validation_rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"calculated_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"folder_structure" jsonb DEFAULT '{}'::jsonb,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"status" text DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_published_at" timestamp,
	"submission_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"type" text NOT NULL,
	"email" text,
	"phone" text,
	"organization_id" varchar NOT NULL,
	"role_id" varchar NOT NULL,
	"invited_by" varchar NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"accepted_by" varchar,
	"accepted_at" timestamp,
	"revoked_at" timestamp,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "invoice_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" varchar NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(10, 2) DEFAULT '1' NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"time_entry_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"invoice_number" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"issue_date" timestamp NOT NULL,
	"due_date" timestamp NOT NULL,
	"subtotal" numeric(10, 2) DEFAULT '0' NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total" numeric(10, 2) DEFAULT '0' NOT NULL,
	"amount_paid" numeric(10, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"terms" text,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kek_registry" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key_name" varchar(255) NOT NULL,
	"key_version" varchar(255) NOT NULL,
	"vault_url" text NOT NULL,
	"algorithm" varchar(50) DEFAULT 'RSA-OAEP-256' NOT NULL,
	"key_type" varchar(20) DEFAULT 'master' NOT NULL,
	"purpose" text NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"rotated_from" varchar,
	"rotation_schedule" varchar(50) DEFAULT '90d',
	"next_rotation_at" timestamp,
	"last_rotated_at" timestamp,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "kek_registry_key_name_unique" UNIQUE("key_name")
);
--> statement-breakpoint
CREATE TABLE "key_operation_approval_votes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"approval_id" varchar NOT NULL,
	"approver_id" varchar NOT NULL,
	"vote" varchar(20) NOT NULL,
	"signed_token_hash" varchar(128) NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"reason" text,
	"voted_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "key_operation_approval_votes_unique" UNIQUE("approval_id","approver_id")
);
--> statement-breakpoint
CREATE TABLE "key_operation_approvals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operation_type" varchar(50) NOT NULL,
	"operation_payload" jsonb NOT NULL,
	"required_approvals" integer DEFAULT 2 NOT NULL,
	"current_approvals" integer DEFAULT 0 NOT NULL,
	"approval_token_hash" varchar(128) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"initiated_by" varchar NOT NULL,
	"initiated_at" timestamp DEFAULT now() NOT NULL,
	"executed_at" timestamp,
	"executed_by" varchar,
	"execution_result" jsonb,
	"audit_log_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "key_vault_config" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"vault_url" text NOT NULL,
	"auth_method" varchar(50) DEFAULT 'managed_identity' NOT NULL,
	"tenant_id" varchar(255),
	"client_id" varchar(255),
	"client_secret_encrypted" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"last_health_check" timestamp,
	"health_status" varchar(20) DEFAULT 'unknown',
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "key_vault_config_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "live_chat_conversations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"subject" text,
	"status" text DEFAULT 'active' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"assigned_agent_id" varchar,
	"assigned_at" timestamp,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"last_message_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	"closed_at" timestamp,
	"first_response_time" integer,
	"avg_response_time" integer,
	"message_count" integer DEFAULT 0 NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "live_chat_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"content" text NOT NULL,
	"sender_type" text NOT NULL,
	"sender_id" varchar NOT NULL,
	"is_internal" boolean DEFAULT false NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb,
	"thread_id" varchar,
	"in_reply_to" varchar,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "llm_configurations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" text DEFAULT 'workspace' NOT NULL,
	"organization_id" varchar,
	"user_id" varchar,
	"name" text NOT NULL,
	"provider" text NOT NULL,
	"api_key_encrypted" text NOT NULL,
	"azure_endpoint" text,
	"model" text NOT NULL,
	"model_version" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "luca_chat_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "luca_chat_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"organization_id" varchar,
	"title" text DEFAULT 'New Chat' NOT NULL,
	"llm_config_id" varchar,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"last_message_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketplace_installations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" varchar NOT NULL,
	"organization_id" varchar NOT NULL,
	"installed_by" varchar NOT NULL,
	"purchase_price" numeric(10, 2),
	"transaction_id" text,
	"subscription_status" text,
	"subscription_expires_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"installed_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketplace_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"type" text NOT NULL,
	"pricing_model" text DEFAULT 'free' NOT NULL,
	"price" numeric(10, 2) DEFAULT 0,
	"price_yearly" numeric(10, 2),
	"content" jsonb DEFAULT '{}'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"source_id" varchar,
	"source_type" text,
	"created_by" varchar,
	"organization_id" varchar,
	"is_public" boolean DEFAULT true NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"install_count" integer DEFAULT 0 NOT NULL,
	"rating" numeric(3, 2) DEFAULT 0,
	"review_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meeting_records" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"provider" text NOT NULL,
	"external_meeting_id" text,
	"meeting_url" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp,
	"duration" integer,
	"host_id" varchar NOT NULL,
	"participants" text[],
	"project_id" varchar,
	"event_id" varchar,
	"client_id" varchar,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"scope" text DEFAULT 'organization' NOT NULL,
	"organization_id" varchar,
	"content" text NOT NULL,
	"variables" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"sender_id" varchar NOT NULL,
	"sender_type" text NOT NULL,
	"content" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ml_analysis_jobs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"analysis_run_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"tokens_used" integer DEFAULT 0 NOT NULL,
	"processing_time_ms" integer,
	"error_message" text,
	"last_attempt_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	CONSTRAINT "ml_analysis_jobs_user_run_unique" UNIQUE("user_id","analysis_run_id")
);
--> statement-breakpoint
CREATE TABLE "ml_analysis_runs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"run_type" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"total_users" integer DEFAULT 0 NOT NULL,
	"users_processed" integer DEFAULT 0 NOT NULL,
	"failed_users" integer DEFAULT 0 NOT NULL,
	"conversations_analyzed" integer DEFAULT 0 NOT NULL,
	"models_used" jsonb,
	"fusion_strategy" text,
	"tokens_consumed" integer DEFAULT 0 NOT NULL,
	"processing_time_seconds" integer,
	"error_message" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "ml_model_outputs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"analysis_run_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"model_type" "ml_model_type" NOT NULL,
	"output" jsonb NOT NULL,
	"confidence" integer NOT NULL,
	"checksum" varchar(64),
	"fusion_weight" numeric(5, 4) DEFAULT 1.0 NOT NULL,
	"tokens_used" integer DEFAULT 0 NOT NULL,
	"processing_time_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"organization_id" varchar,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"type" text NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"action_url" text,
	"resource_id" varchar,
	"resource_type" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"is_actioned" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"read_at" timestamp,
	"actioned_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "oauth_connections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"provider" text NOT NULL,
	"encrypted_credentials" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_nudges" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"progress_id" varchar NOT NULL,
	"nudge_id" text NOT NULL,
	"nudge_type" text NOT NULL,
	"title" text,
	"message" text NOT NULL,
	"times_shown" integer DEFAULT 1 NOT NULL,
	"max_show_count" integer DEFAULT 3,
	"is_dismissed" boolean DEFAULT false NOT NULL,
	"dismissed_at" timestamp,
	"action_taken" boolean DEFAULT false NOT NULL,
	"last_shown_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_progress" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"organization_id" varchar NOT NULL,
	"current_day" integer DEFAULT 1 NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp,
	"total_score" integer DEFAULT 0 NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"longest_streak" integer DEFAULT 0 NOT NULL,
	"region" text DEFAULT 'USA',
	"completed_steps" text[] DEFAULT ARRAY[]::text[],
	"unlocked_features" text[] DEFAULT ARRAY[]::text[],
	"badges" jsonb DEFAULT '[]'::jsonb,
	"last_activity_at" timestamp DEFAULT now() NOT NULL,
	"last_login_at" timestamp DEFAULT now() NOT NULL,
	"login_dates" text[] DEFAULT ARRAY[]::text[],
	"skip_walkthroughs" boolean DEFAULT false NOT NULL,
	"enable_nudges" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "onboarding_progress_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "onboarding_tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"progress_id" varchar NOT NULL,
	"day" integer NOT NULL,
	"task_id" text NOT NULL,
	"task_type" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"is_completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp,
	"required_for_day" boolean DEFAULT true NOT NULL,
	"points" integer DEFAULT 10 NOT NULL,
	"related_entity_type" text,
	"related_entity_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_agents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"agent_id" varchar NOT NULL,
	"status" text DEFAULT 'enabled' NOT NULL,
	"config" text,
	"enabled_at" timestamp DEFAULT now() NOT NULL,
	"disabled_at" timestamp,
	"granted_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_keys" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"public_key" text NOT NULL,
	"private_key" text NOT NULL,
	"algorithm" text DEFAULT 'RSA-2048' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"rotated_at" timestamp,
	CONSTRAINT "organization_keys_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"legal_name" text,
	"slug" text NOT NULL,
	"tags" text[] DEFAULT ARRAY[]::text[],
	"logo_url" text,
	"favicon_url" text,
	"primary_color" text DEFAULT '#1e3a8a',
	"secondary_color" text DEFAULT '#10b981',
	"industry" text,
	"business_type" text,
	"tax_id" text,
	"website" text,
	"email" text,
	"phone" text,
	"address" text,
	"city" text,
	"state" text,
	"zip_code" text,
	"country" text DEFAULT 'US',
	"timezone" text DEFAULT 'America/New_York',
	"locale" text DEFAULT 'en-US',
	"currency" text DEFAULT 'USD',
	"date_format" text DEFAULT 'MM/DD/YYYY',
	"billing_email" text,
	"billing_address" text,
	"custom_domain" text,
	"custom_domain_verified" boolean DEFAULT false,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"is_test_account" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "otp_verifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"phone" text NOT NULL,
	"otp" text NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_gateway_configs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"gateway" text NOT NULL,
	"nickname" text,
	"credentials" jsonb NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_test_mode" boolean DEFAULT false NOT NULL,
	"webhook_secret" text,
	"webhook_token" text DEFAULT encode(gen_random_bytes(32), 'hex') NOT NULL,
	"webhook_request_count" integer DEFAULT 0 NOT NULL,
	"last_webhook_at" timestamp,
	"last_used_at" timestamp,
	"total_transactions" integer DEFAULT 0 NOT NULL,
	"total_volume" numeric(15, 2) DEFAULT 0 NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payment_gateway_configs_webhook_token_unique" UNIQUE("webhook_token"),
	CONSTRAINT "payment_gateway_configs_webhook_token_idx" UNIQUE("webhook_token")
);
--> statement-breakpoint
CREATE TABLE "payment_methods" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"type" text NOT NULL,
	"nickname" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"card_last4" text,
	"card_brand" text,
	"card_exp_month" integer,
	"card_exp_year" integer,
	"cardholder_name" text,
	"bank_name" text,
	"account_last4" text,
	"account_holder_name" text,
	"upi_id" text,
	"razorpay_token_id" text,
	"razorpay_customer_id" text,
	"stripe_payment_method_id" text,
	"status" text DEFAULT 'active' NOT NULL,
	"last_used_at" timestamp,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"invoice_id" varchar,
	"subscription_invoice_id" varchar,
	"client_id" varchar,
	"amount" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'INR',
	"method" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"gateway" text,
	"internal_order_id" text,
	"gateway_order_id" text,
	"gateway_payment_id" text,
	"gateway_config_id" varchar,
	"error_code" text,
	"error_message" text,
	"stripe_payment_id" text,
	"stripe_payment_intent_id" text,
	"razorpay_payment_id" text,
	"razorpay_order_id" text,
	"customer_name" text,
	"customer_email" text,
	"customer_phone" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"transaction_date" timestamp NOT NULL,
	"notes" text,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "performance_metric_definitions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"metric_type" varchar(50) NOT NULL,
	"aggregation_type" "metric_aggregation_type" NOT NULL,
	"calculation_formula" jsonb,
	"ai_suggested" boolean DEFAULT false NOT NULL,
	"suggestion_reason" text,
	"suggestion_confidence" integer,
	"weight" numeric(5, 2) DEFAULT 1.0 NOT NULL,
	"target_value" numeric(10, 2),
	"min_acceptable" numeric(10, 2),
	"max_acceptable" numeric(10, 2),
	"visibility_scope" varchar(50) DEFAULT 'admins_only' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "performance_scores" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"metric_definition_id" varchar NOT NULL,
	"organization_id" varchar NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"score" numeric(10, 2) NOT NULL,
	"target_met" boolean,
	"percentage_of_target" numeric(5, 2),
	"data_points" integer DEFAULT 1 NOT NULL,
	"raw_data" jsonb,
	"ai_insight" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"resource" text NOT NULL,
	"action" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "permissions_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "personality_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"organization_id" varchar NOT NULL,
	"overall_confidence" integer DEFAULT 0 NOT NULL,
	"conversations_analyzed" integer DEFAULT 0 NOT NULL,
	"mbti_type" varchar(4),
	"mbti_confidence" integer,
	"disc_primary" varchar(1),
	"disc_confidence" integer,
	"cultural_context" jsonb,
	"last_analysis_run_id" varchar,
	"models_used_count" integer DEFAULT 0 NOT NULL,
	"analysis_consented" boolean DEFAULT false NOT NULL,
	"consented_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "personality_profiles_user_org_unique" UNIQUE("user_id","organization_id")
);
--> statement-breakpoint
CREATE TABLE "personality_traits" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" varchar NOT NULL,
	"framework" "personality_framework" NOT NULL,
	"trait_type" "trait_type" NOT NULL,
	"score" integer NOT NULL,
	"confidence" integer NOT NULL,
	"derivation_method" jsonb,
	"observed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_addons" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_family_id" varchar,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"pricing_model" text DEFAULT 'fixed' NOT NULL,
	"price_monthly" numeric(10, 2),
	"price_yearly" numeric(10, 2),
	"unit" text,
	"price_per_unit" numeric(10, 4),
	"min_quantity" integer DEFAULT 1,
	"max_quantity" integer,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"additional_storage" integer,
	"additional_users" integer,
	"additional_clients" integer,
	"additional_workflows" integer,
	"applicable_plans" jsonb DEFAULT '[]'::jsonb,
	"stripe_product_id" text,
	"razorpay_plan_id" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "plan_addons_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "plan_skus" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" varchar NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"pricing_model" text NOT NULL,
	"fixed_price" numeric(10, 2),
	"usage_unit" text,
	"usage_price" numeric(10, 6),
	"included_usage" integer DEFAULT 0,
	"base_price" numeric(10, 2),
	"tiers" jsonb DEFAULT '[]'::jsonb,
	"region_code" text,
	"currency" text DEFAULT 'USD' NOT NULL,
	"billing_cycle" text NOT NULL,
	"stripe_product_id" text,
	"stripe_price_id" text,
	"razorpay_plan_id" text,
	"payu_plan_id" text,
	"payoneer_plan_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "plan_skus_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "plan_volume_tiers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" varchar NOT NULL,
	"min_seats" integer NOT NULL,
	"max_seats" integer,
	"discount_percentage" numeric(5, 2) DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_subscriptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"plan" text DEFAULT 'free' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"billing_cycle" text DEFAULT 'monthly' NOT NULL,
	"monthly_price" numeric(10, 2),
	"yearly_price" numeric(10, 2),
	"mrr" numeric(10, 2) DEFAULT 0 NOT NULL,
	"max_users" integer DEFAULT 5 NOT NULL,
	"max_clients" integer DEFAULT 10 NOT NULL,
	"max_storage" integer DEFAULT 5 NOT NULL,
	"current_period_start" timestamp DEFAULT now() NOT NULL,
	"current_period_end" timestamp NOT NULL,
	"next_billing_date" timestamp,
	"current_users" integer DEFAULT 0 NOT NULL,
	"current_clients" integer DEFAULT 0 NOT NULL,
	"current_storage" numeric(10, 2) DEFAULT 0 NOT NULL,
	"payment_method" text,
	"payment_gateway" text DEFAULT 'manual',
	"default_payment_method_id" varchar,
	"last_payment_date" timestamp,
	"last_payment_amount" numeric(10, 2),
	"plan_id" varchar,
	"currency" text DEFAULT 'USD' NOT NULL,
	"region_code" text,
	"seat_count" integer DEFAULT 1 NOT NULL,
	"base_price" numeric(10, 2),
	"per_seat_price" numeric(10, 2),
	"total_discount" numeric(10, 2) DEFAULT 0 NOT NULL,
	"coupon_id" varchar,
	"price_snapshot" jsonb DEFAULT '{}'::jsonb,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"razorpay_customer_id" text,
	"razorpay_subscription_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"trial_ends_at" timestamp,
	"is_trialing" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"cancelled_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "portal_invitations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"invitation_token" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"organization_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "portal_invitations_invitation_token_unique" UNIQUE("invitation_token")
);
--> statement-breakpoint
CREATE TABLE "pricing_regions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"description" text,
	"country_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"currency_symbol" text DEFAULT '$' NOT NULL,
	"price_multiplier" numeric(5, 3) DEFAULT 1.000 NOT NULL,
	"stripe_currency" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_families" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"icon" text,
	"color" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "product_families_name_unique" UNIQUE("name"),
	CONSTRAINT "product_families_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "project_budget_thresholds" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"organization_id" varchar NOT NULL,
	"threshold_percentage" integer NOT NULL,
	"budget_amount" numeric(12, 2) NOT NULL,
	"threshold_amount" numeric(12, 2) NOT NULL,
	"is_triggered" boolean DEFAULT false NOT NULL,
	"triggered_at" timestamp,
	"current_spend" numeric(12, 2) DEFAULT 0 NOT NULL,
	"on_threshold_actions" jsonb DEFAULT '[]'::jsonb,
	"last_notified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'todo' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"assignee_id" varchar,
	"position" integer DEFAULT 0 NOT NULL,
	"due_date" timestamp,
	"completed_at" timestamp,
	"estimated_hours" numeric(10, 2),
	"actual_hours" numeric(10, 2),
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_workflows" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"workflow_id" varchar NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_workflows_project_id_workflow_id_unique" UNIQUE("project_id","workflow_id")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"client_id" varchar,
	"status" text DEFAULT 'active' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"start_date" timestamp,
	"due_date" timestamp,
	"completed_at" timestamp,
	"owner_id" varchar,
	"budget" numeric(10, 2),
	"actual_cost" numeric(10, 2),
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"organization_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"proposal_number" text,
	"subtotal" numeric(12, 2) DEFAULT 0,
	"tax_amount" numeric(12, 2) DEFAULT 0,
	"discount_amount" numeric(12, 2) DEFAULT 0,
	"total_amount" numeric(12, 2) DEFAULT 0,
	"currency" text DEFAULT 'USD' NOT NULL,
	"line_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"content" text,
	"terms_and_conditions" text,
	"notes" text,
	"template_id" varchar,
	"valid_from" timestamp DEFAULT now() NOT NULL,
	"valid_until" timestamp NOT NULL,
	"status" "proposal_status" DEFAULT 'draft' NOT NULL,
	"viewed_at" timestamp,
	"view_count" integer DEFAULT 0 NOT NULL,
	"accepted_at" timestamp,
	"rejected_at" timestamp,
	"client_notes" text,
	"signed_by" varchar,
	"signature_url" text,
	"pdf_url" text,
	"pdf_generated_at" timestamp,
	"sent_at" timestamp,
	"sent_by" varchar,
	"reminder_sent_at" timestamp,
	"reminder_count" integer DEFAULT 0 NOT NULL,
	"converted_to_project_id" varchar,
	"converted_to_invoice_id" varchar,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_org_proposal_number" UNIQUE("organization_id","proposal_number")
);
--> statement-breakpoint
CREATE TABLE "recurring_schedules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"workflow_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"frequency" text NOT NULL,
	"interval" integer DEFAULT 1 NOT NULL,
	"day_of_week" integer,
	"day_of_month" integer,
	"month_of_year" integer,
	"time_of_day" text DEFAULT '09:00:00',
	"assignment_template" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"start_date" timestamp DEFAULT now() NOT NULL,
	"end_date" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp,
	"next_run_at" timestamp NOT NULL,
	"run_count" integer DEFAULT 0 NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "required_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text,
	"is_required" boolean DEFAULT true NOT NULL,
	"expected_quantity" integer DEFAULT 1,
	"status" text DEFAULT 'pending' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_allocations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"assignment_id" varchar,
	"project_id" varchar,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"allocation_percentage" integer NOT NULL,
	"estimated_hours_per_week" numeric(10, 2),
	"notes" text,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "resource_allocations_percentage_check" CHECK ("resource_allocations"."allocation_percentage" >= 0 AND "resource_allocations"."allocation_percentage" <= 100),
	CONSTRAINT "resource_allocations_date_check" CHECK ("resource_allocations"."end_date" > "resource_allocations"."start_date")
);
--> statement-breakpoint
CREATE TABLE "revision_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" varchar NOT NULL,
	"requested_by" varchar NOT NULL,
	"fields_to_revise" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_id" varchar NOT NULL,
	"permission_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"scope" text DEFAULT 'tenant' NOT NULL,
	"is_system_role" boolean DEFAULT false NOT NULL,
	"organization_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "roundtable_approvals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deliverable_id" varchar NOT NULL,
	"session_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"decision" text NOT NULL,
	"feedback" text,
	"auto_saved" boolean DEFAULT false,
	"saved_to_template_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roundtable_deliverables" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"creator_participant_id" varchar NOT NULL,
	"creator_agent_slug" text NOT NULL,
	"deliverable_type" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"payload" jsonb NOT NULL,
	"is_presenting_now" boolean DEFAULT false,
	"presented_at" timestamp,
	"status" text DEFAULT 'draft' NOT NULL,
	"saved_to_template_id" varchar,
	"saved_to_type" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roundtable_knowledge_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"entry_type" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"source_type" text,
	"source_participant_id" varchar,
	"version" integer DEFAULT 1 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roundtable_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"channel_type" text NOT NULL,
	"recipient_participant_id" varchar,
	"sender_type" text NOT NULL,
	"sender_id" text NOT NULL,
	"sender_name" text NOT NULL,
	"content" text NOT NULL,
	"message_type" text DEFAULT 'text',
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"is_streaming" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roundtable_participants" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"participant_type" text NOT NULL,
	"participant_id" text NOT NULL,
	"role" text,
	"display_name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"capabilities" jsonb DEFAULT '[]'::jsonb,
	"assigned_tasks" jsonb DEFAULT '[]'::jsonb,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"left_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "roundtable_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"organization_id" varchar NOT NULL,
	"title" text DEFAULT 'New Roundtable Session' NOT NULL,
	"description" text,
	"objective" text,
	"status" text DEFAULT 'active' NOT NULL,
	"shared_context" jsonb DEFAULT '{}'::jsonb,
	"llm_config_id" varchar,
	"active_presentation_deliverable_id" varchar,
	"active_presentation_presenter_participant_id" varchar,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_report_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scheduled_report_id" varchar NOT NULL,
	"status" text NOT NULL,
	"error_message" text,
	"emails_sent" integer DEFAULT 0,
	"executed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"report_type" text NOT NULL,
	"report_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"schedule" text NOT NULL,
	"schedule_day" integer,
	"schedule_time" text DEFAULT '09:00',
	"recipients" text[] NOT NULL,
	"format" text DEFAULT 'pdf' NOT NULL,
	"is_active" boolean DEFAULT true,
	"last_run_at" timestamp,
	"next_run_at" timestamp,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_plan_purchases" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_plan_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"organization_id" varchar NOT NULL,
	"selected_tier" text,
	"price_snapshot" jsonb NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"currency" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"delivery_date" timestamp,
	"delivered_at" timestamp,
	"completed_at" timestamp,
	"client_requirements" jsonb,
	"notes" text,
	"rating" numeric(3, 2),
	"review" text,
	"reviewed_at" timestamp,
	"payment_status" text DEFAULT 'pending' NOT NULL,
	"payment_id" varchar,
	"payment_gateway" text,
	"payment_gateway_order_id" text,
	"assigned_to" varchar,
	"purchased_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_plans" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"category" text,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"pricing_model" text DEFAULT 'fixed' NOT NULL,
	"base_price" numeric(10, 2),
	"currency" text DEFAULT 'USD' NOT NULL,
	"hourly_rate" numeric(10, 2),
	"estimated_hours" integer,
	"tiers" jsonb DEFAULT '[]'::jsonb,
	"delivery_days" integer,
	"revisions" integer,
	"features" jsonb DEFAULT '[]'::jsonb,
	"requirements" jsonb DEFAULT '[]'::jsonb,
	"cover_image" text,
	"gallery" jsonb DEFAULT '[]'::jsonb,
	"is_available" boolean DEFAULT true NOT NULL,
	"max_orders" integer,
	"current_orders" integer DEFAULT 0 NOT NULL,
	"total_orders" integer DEFAULT 0 NOT NULL,
	"rating" numeric(3, 2),
	"review_count" integer DEFAULT 0 NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_org_slug_service" UNIQUE("organization_id","slug")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "signature_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"document_id" varchar,
	"client_id" varchar,
	"title" text NOT NULL,
	"message" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"requested_by" varchar NOT NULL,
	"signed_by" varchar,
	"signed_at" timestamp,
	"expires_at" timestamp,
	"ip_address" text,
	"user_agent" text,
	"signature_data" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sso_connections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"provider" text DEFAULT 'custom' NOT NULL,
	"entity_id" text NOT NULL,
	"sso_url" text NOT NULL,
	"certificate" text NOT NULL,
	"logout_url" text,
	"signature_algorithm" text DEFAULT 'sha256',
	"want_assertions_signed" boolean DEFAULT true,
	"want_authn_response_signed" boolean DEFAULT false,
	"attribute_mappings" jsonb DEFAULT '{}'::jsonb,
	"auto_provision" boolean DEFAULT false,
	"default_role_id" varchar,
	"is_enabled" boolean DEFAULT true,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sso_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sso_connection_id" varchar NOT NULL,
	"user_id" varchar,
	"name_id" text NOT NULL,
	"session_index" text,
	"ip_address" text,
	"user_agent" text,
	"login_at" timestamp DEFAULT now() NOT NULL,
	"logout_at" timestamp,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submission_notes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"note" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_addons" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" varchar NOT NULL,
	"addon_id" varchar NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"price_snapshot" jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"current_period_start" timestamp DEFAULT now() NOT NULL,
	"current_period_end" timestamp NOT NULL,
	"next_billing_date" timestamp,
	"stripe_subscription_item_id" text,
	"razorpay_addon_id" text,
	"added_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"cancelled_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "subscription_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" varchar NOT NULL,
	"event_type" text NOT NULL,
	"event_source" text NOT NULL,
	"external_event_id" text,
	"event_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"processed" boolean DEFAULT false NOT NULL,
	"processed_at" timestamp,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_invoices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"subscription_id" varchar NOT NULL,
	"invoice_number" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"billing_period_start" timestamp NOT NULL,
	"billing_period_end" timestamp NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"amount_paid" numeric(10, 2) DEFAULT '0' NOT NULL,
	"payment_method" text,
	"paid_at" timestamp,
	"issue_date" timestamp NOT NULL,
	"due_date" timestamp NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp,
	"grace_period_ends_at" timestamp,
	"services_disabled_at" timestamp,
	"razorpay_order_id" text,
	"razorpay_payment_id" text,
	"line_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"feature_identifiers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"base_price_monthly" numeric(10, 2) DEFAULT 0 NOT NULL,
	"base_price_yearly" numeric(10, 2) DEFAULT 0 NOT NULL,
	"per_seat_price_monthly" numeric(10, 2) DEFAULT 0 NOT NULL,
	"per_seat_price_yearly" numeric(10, 2) DEFAULT 0 NOT NULL,
	"max_users" integer DEFAULT 5 NOT NULL,
	"max_clients" integer DEFAULT 10 NOT NULL,
	"max_storage" integer DEFAULT 5 NOT NULL,
	"max_workflows" integer DEFAULT 10 NOT NULL,
	"max_ai_agents" integer DEFAULT 3 NOT NULL,
	"included_seats" integer DEFAULT 1 NOT NULL,
	"trial_days" integer DEFAULT 0 NOT NULL,
	"stripe_product_id" text,
	"stripe_price_monthly_id" text,
	"stripe_price_yearly_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_plans_name_unique" UNIQUE("name"),
	CONSTRAINT "subscription_plans_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "super_admin_keys" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key_hash" text NOT NULL,
	"generated_by" varchar NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_by" varchar,
	"used_at" timestamp,
	"revoked_at" timestamp,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "super_admin_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "supervisor_relationships" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"supervisor_id" varchar NOT NULL,
	"reportee_id" varchar NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "supervisor_relationships_supervisor_id_reportee_id_unique" UNIQUE("supervisor_id","reportee_id")
);
--> statement-breakpoint
CREATE TABLE "support_ticket_comments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" varchar NOT NULL,
	"content" text NOT NULL,
	"created_by" varchar NOT NULL,
	"is_internal" boolean DEFAULT false NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"subject" text NOT NULL,
	"description" text NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"category" text NOT NULL,
	"created_by" varchar NOT NULL,
	"assigned_to" varchar,
	"context_type" text,
	"context_id" varchar,
	"resolved_at" timestamp,
	"resolved_by" varchar,
	"resolution" text,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "taggables" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tag_id" varchar NOT NULL,
	"taggable_type" text NOT NULL,
	"taggable_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#6b7280' NOT NULL,
	"organization_id" varchar NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_checklists" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" varchar NOT NULL,
	"item" text NOT NULL,
	"order" integer NOT NULL,
	"is_checked" boolean DEFAULT false NOT NULL,
	"checked_at" timestamp,
	"checked_by" varchar,
	"nodes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"edges" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"viewport" jsonb DEFAULT '{"x": 0, "y": 0, "zoom": 1}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_dependencies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" varchar NOT NULL,
	"depends_on_task_id" varchar NOT NULL,
	"dependency_type" text DEFAULT 'finish-to-start' NOT NULL,
	"lag" integer DEFAULT 0 NOT NULL,
	"organization_id" varchar NOT NULL,
	"workflow_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "task_dependencies_unique" UNIQUE("task_id","depends_on_task_id")
);
--> statement-breakpoint
CREATE TABLE "task_followups" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" varchar NOT NULL,
	"organization_id" varchar NOT NULL,
	"frequency" text NOT NULL,
	"urgency" text DEFAULT 'normal' NOT NULL,
	"next_run_at" timestamp NOT NULL,
	"last_run_at" timestamp,
	"expires_at" timestamp,
	"status" text DEFAULT 'active' NOT NULL,
	"run_count" integer DEFAULT 0 NOT NULL,
	"max_runs" integer,
	"notify_email" boolean DEFAULT true NOT NULL,
	"notify_sms" boolean DEFAULT false NOT NULL,
	"notify_in_app" boolean DEFAULT true NOT NULL,
	"escalate_after_runs" integer,
	"escalate_to_user_id" varchar,
	"escalated" boolean DEFAULT false NOT NULL,
	"escalated_at" timestamp,
	"custom_message" text,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_skill_requirements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" varchar NOT NULL,
	"skill_id" varchar NOT NULL,
	"required_level" text DEFAULT 'intermediate',
	"importance" text DEFAULT 'required',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_subtasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" varchar NOT NULL,
	"name" text NOT NULL,
	"order" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"assigned_to" varchar,
	"completed_at" timestamp,
	"completed_by" varchar,
	"nodes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"edges" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"viewport" jsonb DEFAULT '{"x": 0, "y": 0, "zoom": 1}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_capacity_snapshots" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"organization_id" varchar NOT NULL,
	"current_workload" integer DEFAULT 0 NOT NULL,
	"max_capacity" integer DEFAULT 10 NOT NULL,
	"utilization_percentage" integer DEFAULT 0 NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"unavailable_reason" text,
	"unavailable_until" timestamp,
	"skills" text[] DEFAULT ARRAY[]::text[],
	"certifications" text[] DEFAULT ARRAY[]::text[],
	"average_completion_time" numeric(10, 2),
	"quality_score" integer DEFAULT 100,
	"snapshot_date" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_chat_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" varchar,
	"client_id" varchar,
	"sender_id" varchar NOT NULL,
	"message" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"thread_id" varchar,
	"in_reply_to" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"role" text NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "team_members_team_id_user_id_unique" UNIQUE("team_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "time_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"client_id" varchar,
	"project_id" varchar,
	"description" text NOT NULL,
	"hours" numeric(10, 2) NOT NULL,
	"hourly_rate" numeric(10, 2),
	"is_billable" boolean DEFAULT true NOT NULL,
	"is_invoiced" boolean DEFAULT false NOT NULL,
	"invoice_id" varchar,
	"date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "time_off_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"type" text NOT NULL,
	"reason" text,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"is_half_day" boolean DEFAULT false NOT NULL,
	"half_day_period" text,
	"total_days" numeric(5, 2) NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"approved_by" varchar,
	"approved_at" timestamp,
	"denial_reason" text,
	"event_id" varchar,
	"notify_team" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trusted_devices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"device_id" varchar(255) NOT NULL,
	"device_name" varchar(255),
	"ip_address" varchar(45),
	"user_agent" text,
	"expires_at" timestamp NOT NULL,
	"last_used" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_agent_access" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"agent_id" varchar NOT NULL,
	"organization_id" varchar NOT NULL,
	"access_level" text DEFAULT 'use' NOT NULL,
	"granted_by" varchar NOT NULL,
	"granted_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_mfa" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"mfa_enabled" boolean DEFAULT false NOT NULL,
	"mfa_enforced" boolean DEFAULT false NOT NULL,
	"totp_secret" text,
	"backup_codes" text[] DEFAULT ARRAY[]::text[],
	"backup_codes_used" text[] DEFAULT ARRAY[]::text[],
	"last_verified" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_organizations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"organization_id" varchar NOT NULL,
	"role_id" varchar NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"invited_by" varchar,
	"invited_at" timestamp,
	"joined_at" timestamp,
	"last_active_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_organizations_user_org_unique" UNIQUE("user_id","organization_id")
);
--> statement-breakpoint
CREATE TABLE "user_skills" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"skill_id" varchar NOT NULL,
	"proficiency_level" text DEFAULT 'intermediate' NOT NULL,
	"years_experience" integer DEFAULT 0,
	"certifications" text[] DEFAULT ARRAY[]::text[],
	"last_used_date" timestamp,
	"endorsements" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"phone" text,
	"country_code" text DEFAULT '+1',
	"email_verified" boolean DEFAULT false NOT NULL,
	"email_verified_at" timestamp,
	"email_verification_token" text,
	"email_verification_token_expiry" timestamp,
	"password_reset_token" text,
	"password_reset_token_expiry" timestamp,
	"phone_verified" boolean DEFAULT false NOT NULL,
	"phone_verified_at" timestamp,
	"avatar_url" text,
	"date_of_birth" timestamp,
	"national_id" text,
	"national_id_type" text,
	"address" text,
	"city" text,
	"state" text,
	"zip_code" text,
	"country" text DEFAULT 'US',
	"emergency_contact_name" text,
	"emergency_contact_phone" text,
	"emergency_contact_relation" text,
	"id_document_url" text,
	"address_proof_url" text,
	"kyc_status" text DEFAULT 'pending' NOT NULL,
	"kyc_verified_at" timestamp,
	"kyc_rejection_reason" text,
	"role_id" varchar NOT NULL,
	"organization_id" varchar,
	"default_organization_id" varchar,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gateway_config_id" varchar NOT NULL,
	"event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"processed_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "webhook_events_config_event_idx" UNIQUE("gateway_config_id","event_id")
);
--> statement-breakpoint
CREATE TABLE "workflow_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"organization_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"assigned_by" varchar NOT NULL,
	"assigned_to" varchar,
	"status" text DEFAULT 'not_started' NOT NULL,
	"current_stage_id" varchar,
	"current_step_id" varchar,
	"current_task_id" varchar,
	"progress" integer DEFAULT 0 NOT NULL,
	"completed_stages" integer DEFAULT 0 NOT NULL,
	"total_stages" integer DEFAULT 0 NOT NULL,
	"due_date" timestamp,
	"started_at" timestamp,
	"completed_at" timestamp,
	"client_contact_id" varchar,
	"priority" text DEFAULT 'medium' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_executions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" varchar NOT NULL,
	"organization_id" varchar NOT NULL,
	"workflow_version" integer NOT NULL,
	"triggered_by" varchar,
	"status" text DEFAULT 'running' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"input" jsonb DEFAULT '{}'::jsonb,
	"output" jsonb DEFAULT '{}'::jsonb,
	"error" text,
	"node_executions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"current_node_id" varchar,
	"duration" integer,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_stages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"order" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"auto_progress" boolean DEFAULT false NOT NULL,
	"progress_conditions" jsonb DEFAULT '{}'::jsonb,
	"on_complete_actions" jsonb DEFAULT '[]'::jsonb,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_steps" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stage_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"order" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"require_all_tasks_complete" boolean DEFAULT true NOT NULL,
	"auto_progress" boolean DEFAULT false NOT NULL,
	"progress_conditions" jsonb DEFAULT '{}'::jsonb,
	"on_complete_actions" jsonb DEFAULT '[]'::jsonb,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_task_dependencies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" varchar NOT NULL,
	"depends_on_task_id" varchar NOT NULL,
	"dependency_type" text DEFAULT 'finish_to_start' NOT NULL,
	"lag_days" integer DEFAULT 0 NOT NULL,
	"is_blocking" boolean DEFAULT true NOT NULL,
	"is_satisfied" boolean DEFAULT false NOT NULL,
	"satisfied_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "workflow_task_dependencies_unique" UNIQUE("task_id","depends_on_task_id")
);
--> statement-breakpoint
CREATE TABLE "workflow_tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"step_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" text DEFAULT 'manual' NOT NULL,
	"order" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"assigned_to" varchar,
	"ai_agent_id" varchar,
	"priority" text DEFAULT 'medium' NOT NULL,
	"start_date" timestamp,
	"due_date" timestamp,
	"estimated_hours" numeric(10, 2),
	"actual_hours" numeric(10, 2),
	"completed_at" timestamp,
	"completed_by" varchar,
	"nodes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"edges" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"viewport" jsonb DEFAULT '{"x": 0, "y": 0, "zoom": 1}'::jsonb,
	"automation_trigger" jsonb DEFAULT '{}'::jsonb,
	"automation_conditions" jsonb DEFAULT '[]'::jsonb,
	"automation_actions" jsonb DEFAULT '[]'::jsonb,
	"automation_input" jsonb DEFAULT '{}'::jsonb,
	"automation_output" jsonb DEFAULT '{}'::jsonb,
	"auto_progress" boolean DEFAULT false NOT NULL,
	"require_all_checklists_complete" boolean DEFAULT true NOT NULL,
	"require_all_subtasks_complete" boolean DEFAULT true NOT NULL,
	"review_required" boolean DEFAULT false NOT NULL,
	"review_status" text,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"review_notes" text,
	"reminder_enabled" boolean DEFAULT false NOT NULL,
	"reminder_duration" integer,
	"notify_assignee" boolean DEFAULT true NOT NULL,
	"notify_manager" boolean DEFAULT false NOT NULL,
	"notify_client" boolean DEFAULT false NOT NULL,
	"last_reminder_sent" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_trigger_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" varchar NOT NULL,
	"assignment_id" varchar,
	"organization_id" varchar NOT NULL,
	"trigger_type" text NOT NULL,
	"trigger_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" varchar NOT NULL,
	"field_name" text,
	"old_value" text,
	"new_value" text,
	"scheduled_for" timestamp,
	"fired_at" timestamp DEFAULT now() NOT NULL,
	"actions_executed" jsonb DEFAULT '[]'::jsonb,
	"execution_status" text DEFAULT 'success' NOT NULL,
	"execution_error" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflows" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'custom' NOT NULL,
	"scope" text DEFAULT 'organization' NOT NULL,
	"organization_id" varchar,
	"created_by" varchar NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"current_stage_id" varchar,
	"triggers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_automated" boolean DEFAULT false NOT NULL,
	"nodes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"edges" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"viewport" jsonb DEFAULT '{"x": 0, "y": 0, "zoom": 1}'::jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_published_at" timestamp,
	"last_executed_at" timestamp,
	"execution_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_availability" ADD CONSTRAINT "agent_availability_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_session_id_agent_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."agent_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_agent_conversations" ADD CONSTRAINT "ai_agent_conversations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_agent_conversations" ADD CONSTRAINT "ai_agent_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_agent_installations" ADD CONSTRAINT "ai_agent_installations_agent_id_ai_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."ai_agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_agent_installations" ADD CONSTRAINT "ai_agent_installations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_agent_installations" ADD CONSTRAINT "ai_agent_installations_installed_by_users_id_fk" FOREIGN KEY ("installed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_agent_messages" ADD CONSTRAINT "ai_agent_messages_conversation_id_ai_agent_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_agent_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_agent_usage" ADD CONSTRAINT "ai_agent_usage_agent_id_ai_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."ai_agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_agent_usage" ADD CONSTRAINT "ai_agent_usage_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_agent_usage" ADD CONSTRAINT "ai_agent_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_agent_usage" ADD CONSTRAINT "ai_agent_usage_conversation_id_ai_agent_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_agent_conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_agents" ADD CONSTRAINT "ai_agents_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_agents" ADD CONSTRAINT "ai_agents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_provider_configs" ADD CONSTRAINT "ai_provider_configs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_workflow_stages" ADD CONSTRAINT "assignment_workflow_stages_assignment_id_workflow_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."workflow_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_workflow_stages" ADD CONSTRAINT "assignment_workflow_stages_template_stage_id_workflow_stages_id_fk" FOREIGN KEY ("template_stage_id") REFERENCES "public"."workflow_stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_workflow_stages" ADD CONSTRAINT "assignment_workflow_stages_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_workflow_steps" ADD CONSTRAINT "assignment_workflow_steps_assignment_stage_id_assignment_workflow_stages_id_fk" FOREIGN KEY ("assignment_stage_id") REFERENCES "public"."assignment_workflow_stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_workflow_steps" ADD CONSTRAINT "assignment_workflow_steps_template_step_id_workflow_steps_id_fk" FOREIGN KEY ("template_step_id") REFERENCES "public"."workflow_steps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_workflow_steps" ADD CONSTRAINT "assignment_workflow_steps_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_workflow_steps" ADD CONSTRAINT "assignment_workflow_steps_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_workflow_tasks" ADD CONSTRAINT "assignment_workflow_tasks_assignment_step_id_assignment_workflow_steps_id_fk" FOREIGN KEY ("assignment_step_id") REFERENCES "public"."assignment_workflow_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_workflow_tasks" ADD CONSTRAINT "assignment_workflow_tasks_template_task_id_workflow_tasks_id_fk" FOREIGN KEY ("template_task_id") REFERENCES "public"."workflow_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_workflow_tasks" ADD CONSTRAINT "assignment_workflow_tasks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_workflow_tasks" ADD CONSTRAINT "assignment_workflow_tasks_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_workflow_tasks" ADD CONSTRAINT "assignment_workflow_tasks_assigned_to_contact_contacts_id_fk" FOREIGN KEY ("assigned_to_contact") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_workflow_tasks" ADD CONSTRAINT "assignment_workflow_tasks_ai_agent_id_ai_agents_id_fk" FOREIGN KEY ("ai_agent_id") REFERENCES "public"."ai_agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_workflow_tasks" ADD CONSTRAINT "assignment_workflow_tasks_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_workflow_tasks" ADD CONSTRAINT "assignment_workflow_tasks_client_portal_task_id_client_portal_tasks_id_fk" FOREIGN KEY ("client_portal_task_id") REFERENCES "public"."client_portal_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_triggers" ADD CONSTRAINT "automation_triggers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_triggers" ADD CONSTRAINT "automation_triggers_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_triggers" ADD CONSTRAINT "automation_triggers_stage_id_workflow_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."workflow_stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_triggers" ADD CONSTRAINT "automation_triggers_step_id_workflow_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."workflow_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_triggers" ADD CONSTRAINT "automation_triggers_auto_advance_target_stage_id_workflow_stages_id_fk" FOREIGN KEY ("auto_advance_target_stage_id") REFERENCES "public"."workflow_stages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_triggers" ADD CONSTRAINT "automation_triggers_auto_advance_target_step_id_workflow_steps_id_fk" FOREIGN KEY ("auto_advance_target_step_id") REFERENCES "public"."workflow_steps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_triggers" ADD CONSTRAINT "automation_triggers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_rules" ADD CONSTRAINT "booking_rules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_channel_id_chat_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."chat_channels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_caller_id_users_id_fk" FOREIGN KEY ("caller_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_receiver_id_users_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_channels" ADD CONSTRAINT "chat_channels_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_channels" ADD CONSTRAINT "chat_channels_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_channels" ADD CONSTRAINT "chat_channels_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_members" ADD CONSTRAINT "chat_members_channel_id_chat_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."chat_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_members" ADD CONSTRAINT "chat_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_channel_id_chat_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."chat_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_bookings" ADD CONSTRAINT "client_bookings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_bookings" ADD CONSTRAINT "client_bookings_booking_rule_id_booking_rules_id_fk" FOREIGN KEY ("booking_rule_id") REFERENCES "public"."booking_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_bookings" ADD CONSTRAINT "client_bookings_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_bookings" ADD CONSTRAINT "client_bookings_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_bookings" ADD CONSTRAINT "client_bookings_meeting_record_id_meeting_records_id_fk" FOREIGN KEY ("meeting_record_id") REFERENCES "public"."meeting_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_onboarding_sessions" ADD CONSTRAINT "client_onboarding_sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_onboarding_sessions" ADD CONSTRAINT "client_onboarding_sessions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_onboarding_sessions" ADD CONSTRAINT "client_onboarding_sessions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_portal_tasks" ADD CONSTRAINT "client_portal_tasks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_portal_tasks" ADD CONSTRAINT "client_portal_tasks_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_portal_tasks" ADD CONSTRAINT "client_portal_tasks_assignment_id_workflow_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."workflow_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_portal_tasks" ADD CONSTRAINT "client_portal_tasks_assigned_to_contacts_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_portal_tasks" ADD CONSTRAINT "client_portal_tasks_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_portal_tasks" ADD CONSTRAINT "client_portal_tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_portal_tasks" ADD CONSTRAINT "client_portal_tasks_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_metrics" ADD CONSTRAINT "conversation_metrics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_metrics" ADD CONSTRAINT "conversation_metrics_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_subscription_id_platform_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."platform_subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_redeemed_by_users_id_fk" FOREIGN KEY ("redeemed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crypto_audit_log" ADD CONSTRAINT "crypto_audit_log_kek_id_kek_registry_id_fk" FOREIGN KEY ("kek_id") REFERENCES "public"."kek_registry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crypto_audit_log" ADD CONSTRAINT "crypto_audit_log_dek_id_dek_registry_id_fk" FOREIGN KEY ("dek_id") REFERENCES "public"."dek_registry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crypto_audit_log" ADD CONSTRAINT "crypto_audit_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cultural_profiles" ADD CONSTRAINT "cultural_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cultural_profiles" ADD CONSTRAINT "cultural_profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dek_registry" ADD CONSTRAINT "dek_registry_kek_id_kek_registry_id_fk" FOREIGN KEY ("kek_id") REFERENCES "public"."kek_registry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dek_registry" ADD CONSTRAINT "dek_registry_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_annotations" ADD CONSTRAINT "document_annotations_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_annotations" ADD CONSTRAINT "document_annotations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_annotations" ADD CONSTRAINT "document_annotations_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_change_events" ADD CONSTRAINT "document_change_events_session_id_document_collaboration_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."document_collaboration_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_change_events" ADD CONSTRAINT "document_change_events_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_change_events" ADD CONSTRAINT "document_change_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_change_events" ADD CONSTRAINT "document_change_events_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_collaboration_sessions" ADD CONSTRAINT "document_collaboration_sessions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_collaboration_sessions" ADD CONSTRAINT "document_collaboration_sessions_started_by_users_id_fk" FOREIGN KEY ("started_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_submissions" ADD CONSTRAINT "document_submissions_required_document_id_required_documents_id_fk" FOREIGN KEY ("required_document_id") REFERENCES "public"."required_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_submissions" ADD CONSTRAINT "document_submissions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_submissions" ADD CONSTRAINT "document_submissions_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_submissions" ADD CONSTRAINT "document_submissions_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_version_diffs" ADD CONSTRAINT "document_version_diffs_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_version_diffs" ADD CONSTRAINT "document_version_diffs_from_version_id_document_versions_id_fk" FOREIGN KEY ("from_version_id") REFERENCES "public"."document_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_version_diffs" ADD CONSTRAINT "document_version_diffs_to_version_id_document_versions_id_fk" FOREIGN KEY ("to_version_id") REFERENCES "public"."document_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_signed_by_users_id_fk" FOREIGN KEY ("signed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_accounts" ADD CONSTRAINT "email_accounts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_accounts" ADD CONSTRAINT "email_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_accounts" ADD CONSTRAINT "email_accounts_default_workflow_id_workflows_id_fk" FOREIGN KEY ("default_workflow_id") REFERENCES "public"."workflows"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_email_account_id_email_accounts_id_fk" FOREIGN KEY ("email_account_id") REFERENCES "public"."email_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_created_task_id_workflow_tasks_id_fk" FOREIGN KEY ("created_task_id") REFERENCES "public"."workflow_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_attendees" ADD CONSTRAINT "event_attendees_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_attendees" ADD CONSTRAINT "event_attendees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_workflow_task_id_workflow_tasks_id_fk" FOREIGN KEY ("workflow_task_id") REFERENCES "public"."workflow_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_organizer_id_users_id_fk" FOREIGN KEY ("organizer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_parent_id_folders_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."folders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forecasting_models" ADD CONSTRAINT "forecasting_models_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forecasting_models" ADD CONSTRAINT "forecasting_models_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forecasting_predictions" ADD CONSTRAINT "forecasting_predictions_run_id_forecasting_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."forecasting_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forecasting_predictions" ADD CONSTRAINT "forecasting_predictions_scenario_id_forecasting_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."forecasting_scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forecasting_runs" ADD CONSTRAINT "forecasting_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forecasting_runs" ADD CONSTRAINT "forecasting_runs_model_id_forecasting_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."forecasting_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forecasting_runs" ADD CONSTRAINT "forecasting_runs_run_by_users_id_fk" FOREIGN KEY ("run_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forecasting_scenarios" ADD CONSTRAINT "forecasting_scenarios_run_id_forecasting_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."forecasting_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_share_links" ADD CONSTRAINT "form_share_links_form_template_id_form_templates_id_fk" FOREIGN KEY ("form_template_id") REFERENCES "public"."form_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_share_links" ADD CONSTRAINT "form_share_links_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_share_links" ADD CONSTRAINT "form_share_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_share_links" ADD CONSTRAINT "form_share_links_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_form_template_id_form_templates_id_fk" FOREIGN KEY ("form_template_id") REFERENCES "public"."form_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_templates" ADD CONSTRAINT "form_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_templates" ADD CONSTRAINT "form_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_accepted_by_users_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kek_registry" ADD CONSTRAINT "kek_registry_rotated_from_kek_registry_id_fk" FOREIGN KEY ("rotated_from") REFERENCES "public"."kek_registry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kek_registry" ADD CONSTRAINT "kek_registry_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "key_operation_approval_votes" ADD CONSTRAINT "key_operation_approval_votes_approval_id_key_operation_approvals_id_fk" FOREIGN KEY ("approval_id") REFERENCES "public"."key_operation_approvals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "key_operation_approval_votes" ADD CONSTRAINT "key_operation_approval_votes_approver_id_users_id_fk" FOREIGN KEY ("approver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "key_operation_approvals" ADD CONSTRAINT "key_operation_approvals_initiated_by_users_id_fk" FOREIGN KEY ("initiated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "key_operation_approvals" ADD CONSTRAINT "key_operation_approvals_executed_by_users_id_fk" FOREIGN KEY ("executed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "key_operation_approvals" ADD CONSTRAINT "key_operation_approvals_audit_log_id_crypto_audit_log_id_fk" FOREIGN KEY ("audit_log_id") REFERENCES "public"."crypto_audit_log"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "key_vault_config" ADD CONSTRAINT "key_vault_config_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_chat_conversations" ADD CONSTRAINT "live_chat_conversations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_chat_conversations" ADD CONSTRAINT "live_chat_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_chat_conversations" ADD CONSTRAINT "live_chat_conversations_assigned_agent_id_users_id_fk" FOREIGN KEY ("assigned_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_chat_messages" ADD CONSTRAINT "live_chat_messages_conversation_id_live_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."live_chat_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_chat_messages" ADD CONSTRAINT "live_chat_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_chat_messages" ADD CONSTRAINT "live_chat_messages_in_reply_to_live_chat_messages_id_fk" FOREIGN KEY ("in_reply_to") REFERENCES "public"."live_chat_messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_configurations" ADD CONSTRAINT "llm_configurations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_configurations" ADD CONSTRAINT "llm_configurations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_configurations" ADD CONSTRAINT "llm_configurations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "luca_chat_messages" ADD CONSTRAINT "luca_chat_messages_session_id_luca_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."luca_chat_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "luca_chat_sessions" ADD CONSTRAINT "luca_chat_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "luca_chat_sessions" ADD CONSTRAINT "luca_chat_sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "luca_chat_sessions" ADD CONSTRAINT "luca_chat_sessions_llm_config_id_llm_configurations_id_fk" FOREIGN KEY ("llm_config_id") REFERENCES "public"."llm_configurations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_installations" ADD CONSTRAINT "marketplace_installations_item_id_marketplace_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."marketplace_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_installations" ADD CONSTRAINT "marketplace_installations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_installations" ADD CONSTRAINT "marketplace_installations_installed_by_users_id_fk" FOREIGN KEY ("installed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_items" ADD CONSTRAINT "marketplace_items_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_items" ADD CONSTRAINT "marketplace_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_records" ADD CONSTRAINT "meeting_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_records" ADD CONSTRAINT "meeting_records_host_id_users_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_records" ADD CONSTRAINT "meeting_records_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_records" ADD CONSTRAINT "meeting_records_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_records" ADD CONSTRAINT "meeting_records_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ml_analysis_jobs" ADD CONSTRAINT "ml_analysis_jobs_analysis_run_id_ml_analysis_runs_id_fk" FOREIGN KEY ("analysis_run_id") REFERENCES "public"."ml_analysis_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ml_analysis_jobs" ADD CONSTRAINT "ml_analysis_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ml_analysis_runs" ADD CONSTRAINT "ml_analysis_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ml_model_outputs" ADD CONSTRAINT "ml_model_outputs_analysis_run_id_ml_analysis_runs_id_fk" FOREIGN KEY ("analysis_run_id") REFERENCES "public"."ml_analysis_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ml_model_outputs" ADD CONSTRAINT "ml_model_outputs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_connections" ADD CONSTRAINT "oauth_connections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_connections" ADD CONSTRAINT "oauth_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_messages" ADD CONSTRAINT "onboarding_messages_session_id_client_onboarding_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."client_onboarding_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_nudges" ADD CONSTRAINT "onboarding_nudges_progress_id_onboarding_progress_id_fk" FOREIGN KEY ("progress_id") REFERENCES "public"."onboarding_progress"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_progress" ADD CONSTRAINT "onboarding_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_progress" ADD CONSTRAINT "onboarding_progress_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_tasks" ADD CONSTRAINT "onboarding_tasks_progress_id_onboarding_progress_id_fk" FOREIGN KEY ("progress_id") REFERENCES "public"."onboarding_progress"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_agents" ADD CONSTRAINT "organization_agents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_agents" ADD CONSTRAINT "organization_agents_agent_id_ai_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."ai_agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_agents" ADD CONSTRAINT "organization_agents_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_keys" ADD CONSTRAINT "organization_keys_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otp_verifications" ADD CONSTRAINT "otp_verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_gateway_configs" ADD CONSTRAINT "payment_gateway_configs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_gateway_configs" ADD CONSTRAINT "payment_gateway_configs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_subscription_invoice_id_subscription_invoices_id_fk" FOREIGN KEY ("subscription_invoice_id") REFERENCES "public"."subscription_invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_gateway_config_id_payment_gateway_configs_id_fk" FOREIGN KEY ("gateway_config_id") REFERENCES "public"."payment_gateway_configs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_metric_definitions" ADD CONSTRAINT "performance_metric_definitions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_metric_definitions" ADD CONSTRAINT "performance_metric_definitions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_scores" ADD CONSTRAINT "performance_scores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_scores" ADD CONSTRAINT "performance_scores_metric_definition_id_performance_metric_definitions_id_fk" FOREIGN KEY ("metric_definition_id") REFERENCES "public"."performance_metric_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_scores" ADD CONSTRAINT "performance_scores_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personality_profiles" ADD CONSTRAINT "personality_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personality_profiles" ADD CONSTRAINT "personality_profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personality_profiles" ADD CONSTRAINT "personality_profiles_last_analysis_run_id_ml_analysis_runs_id_fk" FOREIGN KEY ("last_analysis_run_id") REFERENCES "public"."ml_analysis_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personality_traits" ADD CONSTRAINT "personality_traits_profile_id_personality_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."personality_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_addons" ADD CONSTRAINT "plan_addons_product_family_id_product_families_id_fk" FOREIGN KEY ("product_family_id") REFERENCES "public"."product_families"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_addons" ADD CONSTRAINT "plan_addons_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_skus" ADD CONSTRAINT "plan_skus_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_skus" ADD CONSTRAINT "plan_skus_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_volume_tiers" ADD CONSTRAINT "plan_volume_tiers_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_subscriptions" ADD CONSTRAINT "platform_subscriptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_subscriptions" ADD CONSTRAINT "platform_subscriptions_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_subscriptions" ADD CONSTRAINT "platform_subscriptions_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_invitations" ADD CONSTRAINT "portal_invitations_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_invitations" ADD CONSTRAINT "portal_invitations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_invitations" ADD CONSTRAINT "portal_invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_families" ADD CONSTRAINT "product_families_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_budget_thresholds" ADD CONSTRAINT "project_budget_thresholds_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_budget_thresholds" ADD CONSTRAINT "project_budget_thresholds_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_workflows" ADD CONSTRAINT "project_workflows_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_workflows" ADD CONSTRAINT "project_workflows_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_template_id_document_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."document_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_signed_by_users_id_fk" FOREIGN KEY ("signed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_sent_by_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_converted_to_project_id_projects_id_fk" FOREIGN KEY ("converted_to_project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_converted_to_invoice_id_invoices_id_fk" FOREIGN KEY ("converted_to_invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_schedules" ADD CONSTRAINT "recurring_schedules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_schedules" ADD CONSTRAINT "recurring_schedules_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_schedules" ADD CONSTRAINT "recurring_schedules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "required_documents" ADD CONSTRAINT "required_documents_request_id_document_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."document_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_allocations" ADD CONSTRAINT "resource_allocations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_allocations" ADD CONSTRAINT "resource_allocations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_allocations" ADD CONSTRAINT "resource_allocations_assignment_id_workflow_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."workflow_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_allocations" ADD CONSTRAINT "resource_allocations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_allocations" ADD CONSTRAINT "resource_allocations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revision_requests" ADD CONSTRAINT "revision_requests_submission_id_form_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."form_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revision_requests" ADD CONSTRAINT "revision_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roundtable_approvals" ADD CONSTRAINT "roundtable_approvals_deliverable_id_roundtable_deliverables_id_fk" FOREIGN KEY ("deliverable_id") REFERENCES "public"."roundtable_deliverables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roundtable_approvals" ADD CONSTRAINT "roundtable_approvals_session_id_roundtable_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."roundtable_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roundtable_approvals" ADD CONSTRAINT "roundtable_approvals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roundtable_deliverables" ADD CONSTRAINT "roundtable_deliverables_session_id_roundtable_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."roundtable_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roundtable_deliverables" ADD CONSTRAINT "roundtable_deliverables_creator_participant_id_roundtable_participants_id_fk" FOREIGN KEY ("creator_participant_id") REFERENCES "public"."roundtable_participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roundtable_knowledge_entries" ADD CONSTRAINT "roundtable_knowledge_entries_session_id_roundtable_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."roundtable_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roundtable_messages" ADD CONSTRAINT "roundtable_messages_session_id_roundtable_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."roundtable_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roundtable_participants" ADD CONSTRAINT "roundtable_participants_session_id_roundtable_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."roundtable_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roundtable_sessions" ADD CONSTRAINT "roundtable_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roundtable_sessions" ADD CONSTRAINT "roundtable_sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roundtable_sessions" ADD CONSTRAINT "roundtable_sessions_llm_config_id_llm_configurations_id_fk" FOREIGN KEY ("llm_config_id") REFERENCES "public"."llm_configurations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_report_logs" ADD CONSTRAINT "scheduled_report_logs_scheduled_report_id_scheduled_reports_id_fk" FOREIGN KEY ("scheduled_report_id") REFERENCES "public"."scheduled_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_reports" ADD CONSTRAINT "scheduled_reports_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_reports" ADD CONSTRAINT "scheduled_reports_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_plan_purchases" ADD CONSTRAINT "service_plan_purchases_service_plan_id_service_plans_id_fk" FOREIGN KEY ("service_plan_id") REFERENCES "public"."service_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_plan_purchases" ADD CONSTRAINT "service_plan_purchases_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_plan_purchases" ADD CONSTRAINT "service_plan_purchases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_plan_purchases" ADD CONSTRAINT "service_plan_purchases_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_plan_purchases" ADD CONSTRAINT "service_plan_purchases_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_plan_purchases" ADD CONSTRAINT "service_plan_purchases_purchased_by_users_id_fk" FOREIGN KEY ("purchased_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_plans" ADD CONSTRAINT "service_plans_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_plans" ADD CONSTRAINT "service_plans_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_requests" ADD CONSTRAINT "signature_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_requests" ADD CONSTRAINT "signature_requests_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_requests" ADD CONSTRAINT "signature_requests_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_requests" ADD CONSTRAINT "signature_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_requests" ADD CONSTRAINT "signature_requests_signed_by_users_id_fk" FOREIGN KEY ("signed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sso_connections" ADD CONSTRAINT "sso_connections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sso_connections" ADD CONSTRAINT "sso_connections_default_role_id_roles_id_fk" FOREIGN KEY ("default_role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sso_connections" ADD CONSTRAINT "sso_connections_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sso_sessions" ADD CONSTRAINT "sso_sessions_sso_connection_id_sso_connections_id_fk" FOREIGN KEY ("sso_connection_id") REFERENCES "public"."sso_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sso_sessions" ADD CONSTRAINT "sso_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_notes" ADD CONSTRAINT "submission_notes_submission_id_form_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."form_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_notes" ADD CONSTRAINT "submission_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_addons" ADD CONSTRAINT "subscription_addons_subscription_id_platform_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."platform_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_addons" ADD CONSTRAINT "subscription_addons_addon_id_plan_addons_id_fk" FOREIGN KEY ("addon_id") REFERENCES "public"."plan_addons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_addons" ADD CONSTRAINT "subscription_addons_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_subscription_id_platform_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."platform_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_subscription_id_platform_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."platform_subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "super_admin_keys" ADD CONSTRAINT "super_admin_keys_generated_by_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "super_admin_keys" ADD CONSTRAINT "super_admin_keys_used_by_users_id_fk" FOREIGN KEY ("used_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supervisor_relationships" ADD CONSTRAINT "supervisor_relationships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supervisor_relationships" ADD CONSTRAINT "supervisor_relationships_supervisor_id_users_id_fk" FOREIGN KEY ("supervisor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supervisor_relationships" ADD CONSTRAINT "supervisor_relationships_reportee_id_users_id_fk" FOREIGN KEY ("reportee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket_comments" ADD CONSTRAINT "support_ticket_comments_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket_comments" ADD CONSTRAINT "support_ticket_comments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taggables" ADD CONSTRAINT "taggables_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_checklists" ADD CONSTRAINT "task_checklists_task_id_workflow_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."workflow_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_checklists" ADD CONSTRAINT "task_checklists_checked_by_users_id_fk" FOREIGN KEY ("checked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_task_id_workflow_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."workflow_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_depends_on_task_id_workflow_tasks_id_fk" FOREIGN KEY ("depends_on_task_id") REFERENCES "public"."workflow_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_followups" ADD CONSTRAINT "task_followups_task_id_client_portal_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."client_portal_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_followups" ADD CONSTRAINT "task_followups_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_followups" ADD CONSTRAINT "task_followups_escalate_to_user_id_users_id_fk" FOREIGN KEY ("escalate_to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_followups" ADD CONSTRAINT "task_followups_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_skill_requirements" ADD CONSTRAINT "task_skill_requirements_task_id_workflow_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."workflow_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_skill_requirements" ADD CONSTRAINT "task_skill_requirements_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_subtasks" ADD CONSTRAINT "task_subtasks_task_id_workflow_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."workflow_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_subtasks" ADD CONSTRAINT "task_subtasks_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_subtasks" ADD CONSTRAINT "task_subtasks_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_capacity_snapshots" ADD CONSTRAINT "team_capacity_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_capacity_snapshots" ADD CONSTRAINT "team_capacity_snapshots_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_chat_messages" ADD CONSTRAINT "team_chat_messages_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_chat_messages" ADD CONSTRAINT "team_chat_messages_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_chat_messages" ADD CONSTRAINT "team_chat_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_chat_messages" ADD CONSTRAINT "team_chat_messages_in_reply_to_team_chat_messages_id_fk" FOREIGN KEY ("in_reply_to") REFERENCES "public"."team_chat_messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_project_id_workflows_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."workflows"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_off_requests" ADD CONSTRAINT "time_off_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_off_requests" ADD CONSTRAINT "time_off_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_off_requests" ADD CONSTRAINT "time_off_requests_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_off_requests" ADD CONSTRAINT "time_off_requests_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trusted_devices" ADD CONSTRAINT "trusted_devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_agent_access" ADD CONSTRAINT "user_agent_access_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_agent_access" ADD CONSTRAINT "user_agent_access_agent_id_ai_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."ai_agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_agent_access" ADD CONSTRAINT "user_agent_access_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_agent_access" ADD CONSTRAINT "user_agent_access_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_mfa" ADD CONSTRAINT "user_mfa_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_organizations" ADD CONSTRAINT "user_organizations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_organizations" ADD CONSTRAINT "user_organizations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_organizations" ADD CONSTRAINT "user_organizations_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_organizations" ADD CONSTRAINT "user_organizations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_skills" ADD CONSTRAINT "user_skills_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_skills" ADD CONSTRAINT "user_skills_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_default_organization_id_organizations_id_fk" FOREIGN KEY ("default_organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_gateway_config_id_payment_gateway_configs_id_fk" FOREIGN KEY ("gateway_config_id") REFERENCES "public"."payment_gateway_configs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_assignments" ADD CONSTRAINT "workflow_assignments_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_assignments" ADD CONSTRAINT "workflow_assignments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_assignments" ADD CONSTRAINT "workflow_assignments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_assignments" ADD CONSTRAINT "workflow_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_assignments" ADD CONSTRAINT "workflow_assignments_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_assignments" ADD CONSTRAINT "workflow_assignments_current_stage_id_workflow_stages_id_fk" FOREIGN KEY ("current_stage_id") REFERENCES "public"."workflow_stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_assignments" ADD CONSTRAINT "workflow_assignments_current_step_id_workflow_steps_id_fk" FOREIGN KEY ("current_step_id") REFERENCES "public"."workflow_steps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_assignments" ADD CONSTRAINT "workflow_assignments_current_task_id_workflow_tasks_id_fk" FOREIGN KEY ("current_task_id") REFERENCES "public"."workflow_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_assignments" ADD CONSTRAINT "workflow_assignments_client_contact_id_contacts_id_fk" FOREIGN KEY ("client_contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_triggered_by_users_id_fk" FOREIGN KEY ("triggered_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_stages" ADD CONSTRAINT "workflow_stages_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_stage_id_workflow_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."workflow_stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_task_dependencies" ADD CONSTRAINT "workflow_task_dependencies_task_id_workflow_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."workflow_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_task_dependencies" ADD CONSTRAINT "workflow_task_dependencies_depends_on_task_id_workflow_tasks_id_fk" FOREIGN KEY ("depends_on_task_id") REFERENCES "public"."workflow_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_tasks" ADD CONSTRAINT "workflow_tasks_step_id_workflow_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."workflow_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_tasks" ADD CONSTRAINT "workflow_tasks_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_tasks" ADD CONSTRAINT "workflow_tasks_ai_agent_id_ai_agents_id_fk" FOREIGN KEY ("ai_agent_id") REFERENCES "public"."ai_agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_tasks" ADD CONSTRAINT "workflow_tasks_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_tasks" ADD CONSTRAINT "workflow_tasks_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_trigger_events" ADD CONSTRAINT "workflow_trigger_events_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_trigger_events" ADD CONSTRAINT "workflow_trigger_events_assignment_id_workflow_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."workflow_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_trigger_events" ADD CONSTRAINT "workflow_trigger_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_availability_status_idx" ON "agent_availability" USING btree ("status");--> statement-breakpoint
CREATE INDEX "agent_availability_accepting_idx" ON "agent_availability" USING btree ("is_accepting_chats");--> statement-breakpoint
CREATE INDEX "agent_messages_session_idx" ON "agent_messages" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "agent_sessions_user_agent_idx" ON "agent_sessions" USING btree ("user_id","agent_slug");--> statement-breakpoint
CREATE INDEX "agent_sessions_session_id_idx" ON "agent_sessions" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "agent_sessions_user_org_idx" ON "agent_sessions" USING btree ("user_id","organization_id");--> statement-breakpoint
CREATE INDEX "ai_conversations_user_agent_idx" ON "ai_agent_conversations" USING btree ("user_id","agent_name");--> statement-breakpoint
CREATE INDEX "ai_conversations_context_idx" ON "ai_agent_conversations" USING btree ("context_type","context_id");--> statement-breakpoint
CREATE INDEX "ai_messages_conversation_idx" ON "ai_agent_messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_agent_usage_org_billing_idx" ON "ai_agent_usage" USING btree ("organization_id","billing_period");--> statement-breakpoint
CREATE INDEX "ai_agent_usage_agent_billing_idx" ON "ai_agent_usage" USING btree ("agent_id","billing_period");--> statement-breakpoint
CREATE INDEX "ai_agents_slug_idx" ON "ai_agents" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "ai_agents_public_idx" ON "ai_agents" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX "assignment_stages_assignment_order_idx" ON "assignment_workflow_stages" USING btree ("assignment_id","order");--> statement-breakpoint
CREATE INDEX "assignment_steps_stage_order_idx" ON "assignment_workflow_steps" USING btree ("assignment_stage_id","order");--> statement-breakpoint
CREATE INDEX "assignment_tasks_step_order_idx" ON "assignment_workflow_tasks" USING btree ("assignment_step_id","order");--> statement-breakpoint
CREATE INDEX "assignment_tasks_assigned_to_idx" ON "assignment_workflow_tasks" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "automation_triggers_org_idx" ON "automation_triggers" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "automation_triggers_event_idx" ON "automation_triggers" USING btree ("event");--> statement-breakpoint
CREATE INDEX "automation_triggers_workflow_idx" ON "automation_triggers" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "automation_triggers_enabled_idx" ON "automation_triggers" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "booking_rules_org_idx" ON "booking_rules" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "call_logs_organization_idx" ON "call_logs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "call_logs_caller_idx" ON "call_logs" USING btree ("caller_id");--> statement-breakpoint
CREATE INDEX "call_logs_receiver_idx" ON "call_logs" USING btree ("receiver_id");--> statement-breakpoint
CREATE INDEX "call_logs_channel_idx" ON "call_logs" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "client_bookings_org_idx" ON "client_bookings" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "client_bookings_client_idx" ON "client_bookings" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "client_bookings_time_idx" ON "client_bookings" USING btree ("start_time");--> statement-breakpoint
CREATE INDEX "client_portal_tasks_org_client_idx" ON "client_portal_tasks" USING btree ("organization_id","client_id");--> statement-breakpoint
CREATE INDEX "client_portal_tasks_assignment_idx" ON "client_portal_tasks" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX "client_portal_tasks_status_idx" ON "client_portal_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "client_portal_tasks_due_date_idx" ON "client_portal_tasks" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "conversation_metrics_user_period_idx" ON "conversation_metrics" USING btree ("user_id","period_start");--> statement-breakpoint
CREATE INDEX "conversation_metrics_org_period_idx" ON "conversation_metrics" USING btree ("organization_id","period_start");--> statement-breakpoint
CREATE INDEX "coupon_redemptions_coupon_idx" ON "coupon_redemptions" USING btree ("coupon_id");--> statement-breakpoint
CREATE INDEX "coupon_redemptions_org_idx" ON "coupon_redemptions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "coupons_code_idx" ON "coupons" USING btree ("code");--> statement-breakpoint
CREATE INDEX "coupons_valid_idx" ON "coupons" USING btree ("is_active","valid_from","valid_until");--> statement-breakpoint
CREATE INDEX "crypto_audit_log_seq_idx" ON "crypto_audit_log" USING btree ("sequence_number");--> statement-breakpoint
CREATE INDEX "crypto_audit_log_operation_idx" ON "crypto_audit_log" USING btree ("operation");--> statement-breakpoint
CREATE INDEX "crypto_audit_log_resource_idx" ON "crypto_audit_log" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "crypto_audit_log_actor_idx" ON "crypto_audit_log" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "crypto_audit_log_created_at_idx" ON "crypto_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "cultural_profiles_user_org_idx" ON "cultural_profiles" USING btree ("user_id","organization_id");--> statement-breakpoint
CREATE INDEX "dek_registry_key_id_idx" ON "dek_registry" USING btree ("key_id");--> statement-breakpoint
CREATE INDEX "dek_registry_kek_id_idx" ON "dek_registry" USING btree ("kek_id");--> statement-breakpoint
CREATE INDEX "dek_registry_domain_idx" ON "dek_registry" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "dek_registry_org_idx" ON "dek_registry" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "dek_registry_active_idx" ON "dek_registry" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "document_change_events_session_idx" ON "document_change_events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "document_change_events_doc_idx" ON "document_change_events" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "document_collaboration_sessions_doc_idx" ON "document_collaboration_sessions" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "document_requests_client_idx" ON "document_requests" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "document_requests_status_idx" ON "document_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "document_requests_org_idx" ON "document_requests" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "document_submissions_required_idx" ON "document_submissions" USING btree ("required_document_id");--> statement-breakpoint
CREATE INDEX "document_submissions_doc_idx" ON "document_submissions" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "document_version_diffs_versions_idx" ON "document_version_diffs" USING btree ("from_version_id","to_version_id");--> statement-breakpoint
CREATE INDEX "document_versions_document_idx" ON "document_versions" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "document_versions_org_idx" ON "document_versions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "email_accounts_org_idx" ON "email_accounts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "email_accounts_user_idx" ON "email_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "email_accounts_status_idx" ON "email_accounts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "email_messages_account_idx" ON "email_messages" USING btree ("email_account_id");--> statement-breakpoint
CREATE INDEX "email_messages_org_idx" ON "email_messages" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "email_messages_message_id_idx" ON "email_messages" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "email_messages_thread_idx" ON "email_messages" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "email_messages_processed_idx" ON "email_messages" USING btree ("ai_processed");--> statement-breakpoint
CREATE INDEX "email_messages_thread_sort_idx" ON "email_messages" USING btree ("organization_id","thread_id","sent_at");--> statement-breakpoint
CREATE INDEX "email_messages_subject_lookup_idx" ON "email_messages" USING btree ("organization_id","email_account_id","normalized_subject");--> statement-breakpoint
CREATE INDEX "email_templates_org_category_idx" ON "email_templates" USING btree ("organization_id","category");--> statement-breakpoint
CREATE INDEX "event_attendees_event_user_idx" ON "event_attendees" USING btree ("event_id","user_id");--> statement-breakpoint
CREATE INDEX "event_attendees_user_rsvp_idx" ON "event_attendees" USING btree ("user_id","rsvp_status");--> statement-breakpoint
CREATE INDEX "events_org_time_idx" ON "events" USING btree ("organization_id","start_time");--> statement-breakpoint
CREATE INDEX "events_type_status_idx" ON "events" USING btree ("type","status");--> statement-breakpoint
CREATE INDEX "events_assigned_idx" ON "events" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "events_recurring_idx" ON "events" USING btree ("is_recurring","recurrence_parent_id");--> statement-breakpoint
CREATE INDEX "folders_parent_org_idx" ON "folders" USING btree ("parent_id","organization_id");--> statement-breakpoint
CREATE INDEX "folders_org_type_idx" ON "folders" USING btree ("organization_id","content_type");--> statement-breakpoint
CREATE INDEX "folders_org_archived_idx" ON "folders" USING btree ("organization_id","is_archived");--> statement-breakpoint
CREATE INDEX "forecasting_models_org_type_idx" ON "forecasting_models" USING btree ("organization_id","forecast_type");--> statement-breakpoint
CREATE INDEX "forecasting_predictions_run_scenario_idx" ON "forecasting_predictions" USING btree ("run_id","scenario_id");--> statement-breakpoint
CREATE INDEX "forecasting_predictions_period_idx" ON "forecasting_predictions" USING btree ("period_start","period_end");--> statement-breakpoint
CREATE INDEX "forecasting_runs_org_model_idx" ON "forecasting_runs" USING btree ("organization_id","model_id");--> statement-breakpoint
CREATE INDEX "forecasting_runs_status_idx" ON "forecasting_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "forecasting_scenarios_run_idx" ON "forecasting_scenarios" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "form_share_links_token_idx" ON "form_share_links" USING btree ("share_token");--> statement-breakpoint
CREATE INDEX "form_share_links_form_idx" ON "form_share_links" USING btree ("form_template_id");--> statement-breakpoint
CREATE INDEX "form_share_links_client_idx" ON "form_share_links" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "form_submissions_org_form_idx" ON "form_submissions" USING btree ("organization_id","form_template_id");--> statement-breakpoint
CREATE INDEX "form_submissions_client_idx" ON "form_submissions" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "form_submissions_status_idx" ON "form_submissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "kek_registry_key_name_idx" ON "kek_registry" USING btree ("key_name");--> statement-breakpoint
CREATE INDEX "kek_registry_status_idx" ON "kek_registry" USING btree ("status");--> statement-breakpoint
CREATE INDEX "kek_registry_active_idx" ON "kek_registry" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "key_operation_approval_votes_approval_idx" ON "key_operation_approval_votes" USING btree ("approval_id");--> statement-breakpoint
CREATE INDEX "key_operation_approval_votes_approver_idx" ON "key_operation_approval_votes" USING btree ("approver_id");--> statement-breakpoint
CREATE INDEX "key_operation_approvals_status_idx" ON "key_operation_approvals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "key_operation_approvals_expires_idx" ON "key_operation_approvals" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "key_operation_approvals_initiator_idx" ON "key_operation_approvals" USING btree ("initiated_by");--> statement-breakpoint
CREATE INDEX "key_vault_config_active_idx" ON "key_vault_config" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "key_vault_config_primary_idx" ON "key_vault_config" USING btree ("is_primary");--> statement-breakpoint
CREATE INDEX "live_chat_conversations_org_idx" ON "live_chat_conversations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "live_chat_conversations_user_idx" ON "live_chat_conversations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "live_chat_conversations_status_idx" ON "live_chat_conversations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "live_chat_conversations_agent_idx" ON "live_chat_conversations" USING btree ("assigned_agent_id");--> statement-breakpoint
CREATE INDEX "live_chat_conversations_last_message_idx" ON "live_chat_conversations" USING btree ("last_message_at");--> statement-breakpoint
CREATE INDEX "live_chat_messages_conversation_idx" ON "live_chat_messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "live_chat_messages_sender_idx" ON "live_chat_messages" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "live_chat_messages_created_idx" ON "live_chat_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "live_chat_messages_thread_idx" ON "live_chat_messages" USING btree ("conversation_id","thread_id");--> statement-breakpoint
CREATE INDEX "llm_configurations_org_idx" ON "llm_configurations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "llm_configurations_user_idx" ON "llm_configurations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "llm_configurations_scope_idx" ON "llm_configurations" USING btree ("scope");--> statement-breakpoint
CREATE INDEX "luca_chat_messages_session_idx" ON "luca_chat_messages" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "luca_chat_messages_session_created_idx" ON "luca_chat_messages" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE INDEX "luca_chat_sessions_user_idx" ON "luca_chat_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "luca_chat_sessions_user_active_idx" ON "luca_chat_sessions" USING btree ("user_id","is_active");--> statement-breakpoint
CREATE INDEX "luca_chat_sessions_user_archived_idx" ON "luca_chat_sessions" USING btree ("user_id","is_archived");--> statement-breakpoint
CREATE INDEX "marketplace_installations_item_org_idx" ON "marketplace_installations" USING btree ("item_id","organization_id");--> statement-breakpoint
CREATE INDEX "marketplace_installations_org_active_idx" ON "marketplace_installations" USING btree ("organization_id","is_active");--> statement-breakpoint
CREATE INDEX "marketplace_items_org_category_idx" ON "marketplace_items" USING btree ("organization_id","category");--> statement-breakpoint
CREATE INDEX "marketplace_items_category_status_idx" ON "marketplace_items" USING btree ("category","status");--> statement-breakpoint
CREATE INDEX "marketplace_items_status_public_idx" ON "marketplace_items" USING btree ("status","is_public");--> statement-breakpoint
CREATE INDEX "meeting_records_org_idx" ON "meeting_records" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "meeting_records_host_idx" ON "meeting_records" USING btree ("host_id");--> statement-breakpoint
CREATE INDEX "message_templates_org_category_idx" ON "message_templates" USING btree ("organization_id","category");--> statement-breakpoint
CREATE INDEX "ml_analysis_jobs_run_idx" ON "ml_analysis_jobs" USING btree ("analysis_run_id");--> statement-breakpoint
CREATE INDEX "ml_analysis_jobs_status_idx" ON "ml_analysis_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ml_analysis_runs_org_idx" ON "ml_analysis_runs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "ml_analysis_runs_status_idx" ON "ml_analysis_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ml_analysis_runs_started_idx" ON "ml_analysis_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "ml_model_outputs_run_idx" ON "ml_model_outputs" USING btree ("analysis_run_id");--> statement-breakpoint
CREATE INDEX "ml_model_outputs_user_model_idx" ON "ml_model_outputs" USING btree ("user_id","model_type");--> statement-breakpoint
CREATE INDEX "oauth_connections_user_provider_idx" ON "oauth_connections" USING btree ("user_id","provider");--> statement-breakpoint
CREATE INDEX "onboarding_nudges_progress_idx" ON "onboarding_nudges" USING btree ("progress_id");--> statement-breakpoint
CREATE INDEX "onboarding_nudges_nudge_id_idx" ON "onboarding_nudges" USING btree ("nudge_id");--> statement-breakpoint
CREATE INDEX "onboarding_nudges_dismissed_idx" ON "onboarding_nudges" USING btree ("is_dismissed");--> statement-breakpoint
CREATE INDEX "onboarding_progress_user_idx" ON "onboarding_progress" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "onboarding_progress_org_idx" ON "onboarding_progress" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "onboarding_progress_day_idx" ON "onboarding_progress" USING btree ("current_day");--> statement-breakpoint
CREATE INDEX "onboarding_progress_streak_idx" ON "onboarding_progress" USING btree ("current_streak");--> statement-breakpoint
CREATE INDEX "onboarding_tasks_progress_idx" ON "onboarding_tasks" USING btree ("progress_id");--> statement-breakpoint
CREATE INDEX "onboarding_tasks_day_idx" ON "onboarding_tasks" USING btree ("day");--> statement-breakpoint
CREATE INDEX "onboarding_tasks_completed_idx" ON "onboarding_tasks" USING btree ("is_completed");--> statement-breakpoint
CREATE INDEX "onboarding_tasks_type_idx" ON "onboarding_tasks" USING btree ("task_type");--> statement-breakpoint
CREATE INDEX "organization_agents_org_agent_idx" ON "organization_agents" USING btree ("organization_id","agent_id");--> statement-breakpoint
CREATE INDEX "organization_agents_status_idx" ON "organization_agents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "organization_agents_unique_idx" ON "organization_agents" USING btree ("organization_id","agent_id");--> statement-breakpoint
CREATE INDEX "otp_verifications_phone_idx" ON "otp_verifications" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "otp_verifications_user_idx" ON "otp_verifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "payment_gateway_configs_org_idx" ON "payment_gateway_configs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "payment_gateway_configs_gateway_idx" ON "payment_gateway_configs" USING btree ("gateway");--> statement-breakpoint
CREATE INDEX "payment_gateway_configs_default_idx" ON "payment_gateway_configs" USING btree ("is_default");--> statement-breakpoint
CREATE INDEX "payment_methods_org_idx" ON "payment_methods" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "payment_methods_default_idx" ON "payment_methods" USING btree ("is_default");--> statement-breakpoint
CREATE INDEX "payment_methods_status_idx" ON "payment_methods" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payment_methods_type_idx" ON "payment_methods" USING btree ("type");--> statement-breakpoint
CREATE INDEX "payment_methods_org_default_idx" ON "payment_methods" USING btree ("organization_id","is_default");--> statement-breakpoint
CREATE INDEX "payments_org_idx" ON "payments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "payments_gateway_order_idx" ON "payments" USING btree ("gateway","gateway_order_id");--> statement-breakpoint
CREATE INDEX "payments_internal_order_idx" ON "payments" USING btree ("internal_order_id");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "performance_metric_definitions_org_idx" ON "performance_metric_definitions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "performance_metric_definitions_active_idx" ON "performance_metric_definitions" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "performance_scores_ump_idx" ON "performance_scores" USING btree ("user_id","metric_definition_id","period_start");--> statement-breakpoint
CREATE INDEX "performance_scores_user_period_idx" ON "performance_scores" USING btree ("user_id","period_start");--> statement-breakpoint
CREATE INDEX "performance_scores_org_period_idx" ON "performance_scores" USING btree ("organization_id","period_start");--> statement-breakpoint
CREATE INDEX "personality_profiles_user_org_idx" ON "personality_profiles" USING btree ("user_id","organization_id");--> statement-breakpoint
CREATE INDEX "personality_profiles_org_idx" ON "personality_profiles" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "personality_traits_profile_idx" ON "personality_traits" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "personality_traits_framework_idx" ON "personality_traits" USING btree ("framework");--> statement-breakpoint
CREATE INDEX "personality_traits_pft_idx" ON "personality_traits" USING btree ("profile_id","framework","trait_type");--> statement-breakpoint
CREATE INDEX "plan_addons_slug_idx" ON "plan_addons" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "plan_addons_display_order_idx" ON "plan_addons" USING btree ("display_order");--> statement-breakpoint
CREATE INDEX "plan_skus_plan_idx" ON "plan_skus" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "plan_skus_sku_idx" ON "plan_skus" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "plan_volume_tiers_plan_idx" ON "plan_volume_tiers" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "plan_volume_tiers_plan_seats_idx" ON "plan_volume_tiers" USING btree ("plan_id","min_seats");--> statement-breakpoint
CREATE INDEX "platform_subscriptions_org_idx" ON "platform_subscriptions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "platform_subscriptions_status_idx" ON "platform_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "platform_subscriptions_plan_idx" ON "platform_subscriptions" USING btree ("plan");--> statement-breakpoint
CREATE INDEX "pricing_regions_display_order_idx" ON "pricing_regions" USING btree ("display_order");--> statement-breakpoint
CREATE INDEX "product_families_slug_idx" ON "product_families" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "product_families_display_order_idx" ON "product_families" USING btree ("display_order");--> statement-breakpoint
CREATE INDEX "project_budget_thresholds_project_idx" ON "project_budget_thresholds" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_budget_thresholds_triggered_idx" ON "project_budget_thresholds" USING btree ("is_triggered");--> statement-breakpoint
CREATE INDEX "project_workflows_project_idx" ON "project_workflows" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "proposals_client_idx" ON "proposals" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "proposals_org_idx" ON "proposals" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "proposals_status_idx" ON "proposals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "proposals_number_idx" ON "proposals" USING btree ("proposal_number");--> statement-breakpoint
CREATE INDEX "proposals_valid_until_idx" ON "proposals" USING btree ("valid_until");--> statement-breakpoint
CREATE INDEX "proposals_org_status_idx" ON "proposals" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "proposals_client_status_idx" ON "proposals" USING btree ("client_id","status");--> statement-breakpoint
CREATE INDEX "recurring_schedules_org_idx" ON "recurring_schedules" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "recurring_schedules_workflow_idx" ON "recurring_schedules" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "recurring_schedules_next_run_idx" ON "recurring_schedules" USING btree ("next_run_at");--> statement-breakpoint
CREATE INDEX "recurring_schedules_active_idx" ON "recurring_schedules" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "required_documents_request_idx" ON "required_documents" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "resource_allocations_user_idx" ON "resource_allocations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "resource_allocations_assignment_idx" ON "resource_allocations" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX "resource_allocations_project_idx" ON "resource_allocations" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "resource_allocations_org_idx" ON "resource_allocations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "resource_allocations_date_range_idx" ON "resource_allocations" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "roundtable_approvals_deliverable_idx" ON "roundtable_approvals" USING btree ("deliverable_id");--> statement-breakpoint
CREATE INDEX "roundtable_approvals_session_idx" ON "roundtable_approvals" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "roundtable_deliverables_session_idx" ON "roundtable_deliverables" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "roundtable_deliverables_session_status_idx" ON "roundtable_deliverables" USING btree ("session_id","status");--> statement-breakpoint
CREATE INDEX "roundtable_deliverables_presenting_idx" ON "roundtable_deliverables" USING btree ("is_presenting_now");--> statement-breakpoint
CREATE INDEX "roundtable_knowledge_entries_session_idx" ON "roundtable_knowledge_entries" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "roundtable_knowledge_entries_session_type_idx" ON "roundtable_knowledge_entries" USING btree ("session_id","entry_type");--> statement-breakpoint
CREATE INDEX "roundtable_messages_session_idx" ON "roundtable_messages" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "roundtable_messages_session_channel_idx" ON "roundtable_messages" USING btree ("session_id","channel_type");--> statement-breakpoint
CREATE INDEX "roundtable_messages_session_created_idx" ON "roundtable_messages" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE INDEX "roundtable_participants_session_idx" ON "roundtable_participants" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "roundtable_participants_session_participant_idx" ON "roundtable_participants" USING btree ("session_id","participant_id");--> statement-breakpoint
CREATE INDEX "roundtable_sessions_user_idx" ON "roundtable_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "roundtable_sessions_org_idx" ON "roundtable_sessions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "roundtable_sessions_status_idx" ON "roundtable_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "scheduled_report_logs_report_idx" ON "scheduled_report_logs" USING btree ("scheduled_report_id");--> statement-breakpoint
CREATE INDEX "scheduled_reports_org_idx" ON "scheduled_reports" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "scheduled_reports_next_run_idx" ON "scheduled_reports" USING btree ("next_run_at");--> statement-breakpoint
CREATE INDEX "service_plan_purchases_service_idx" ON "service_plan_purchases" USING btree ("service_plan_id");--> statement-breakpoint
CREATE INDEX "service_plan_purchases_client_idx" ON "service_plan_purchases" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "service_plan_purchases_org_idx" ON "service_plan_purchases" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "service_plan_purchases_status_idx" ON "service_plan_purchases" USING btree ("status");--> statement-breakpoint
CREATE INDEX "service_plans_org_idx" ON "service_plans" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "service_plans_slug_idx" ON "service_plans" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "service_plans_category_idx" ON "service_plans" USING btree ("category");--> statement-breakpoint
CREATE INDEX "service_plans_public_idx" ON "service_plans" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX "skills_org_idx" ON "skills" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "skills_org_name_unique" ON "skills" USING btree ("organization_id","name");--> statement-breakpoint
CREATE INDEX "sso_connections_org_idx" ON "sso_connections" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "sso_sessions_connection_idx" ON "sso_sessions" USING btree ("sso_connection_id");--> statement-breakpoint
CREATE INDEX "sso_sessions_user_idx" ON "sso_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "subscription_addons_subscription_idx" ON "subscription_addons" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "subscription_addons_addon_idx" ON "subscription_addons" USING btree ("addon_id");--> statement-breakpoint
CREATE INDEX "subscription_events_subscription_idx" ON "subscription_events" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "subscription_events_type_idx" ON "subscription_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "subscription_events_external_idx" ON "subscription_events" USING btree ("external_event_id");--> statement-breakpoint
CREATE INDEX "subscription_events_processed_idx" ON "subscription_events" USING btree ("processed");--> statement-breakpoint
CREATE INDEX "subscription_invoices_org_idx" ON "subscription_invoices" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "subscription_invoices_subscription_idx" ON "subscription_invoices" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "subscription_invoices_status_idx" ON "subscription_invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "subscription_invoices_due_date_idx" ON "subscription_invoices" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "subscription_plans_slug_idx" ON "subscription_plans" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "subscription_plans_display_order_idx" ON "subscription_plans" USING btree ("display_order");--> statement-breakpoint
CREATE INDEX "supervisor_relationships_supervisor_idx" ON "supervisor_relationships" USING btree ("supervisor_id");--> statement-breakpoint
CREATE INDEX "supervisor_relationships_reportee_idx" ON "supervisor_relationships" USING btree ("reportee_id");--> statement-breakpoint
CREATE INDEX "supervisor_relationships_org_idx" ON "supervisor_relationships" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "support_ticket_comments_ticket_idx" ON "support_ticket_comments" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "support_tickets_org_status_idx" ON "support_tickets" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "support_tickets_org_priority_idx" ON "support_tickets" USING btree ("organization_id","priority");--> statement-breakpoint
CREATE INDEX "support_tickets_assigned_idx" ON "support_tickets" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "support_tickets_created_by_idx" ON "support_tickets" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "task_dependencies_task_idx" ON "task_dependencies" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "task_dependencies_depends_on_idx" ON "task_dependencies" USING btree ("depends_on_task_id");--> statement-breakpoint
CREATE INDEX "task_dependencies_org_idx" ON "task_dependencies" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "task_dependencies_workflow_idx" ON "task_dependencies" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "task_followups_next_run_idx" ON "task_followups" USING btree ("next_run_at","status");--> statement-breakpoint
CREATE INDEX "task_followups_task_status_idx" ON "task_followups" USING btree ("task_id","status");--> statement-breakpoint
CREATE INDEX "task_skill_requirements_task_idx" ON "task_skill_requirements" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "team_capacity_snapshots_user_org_idx" ON "team_capacity_snapshots" USING btree ("user_id","organization_id");--> statement-breakpoint
CREATE INDEX "team_capacity_snapshots_date_idx" ON "team_capacity_snapshots" USING btree ("snapshot_date");--> statement-breakpoint
CREATE INDEX "team_capacity_snapshots_available_idx" ON "team_capacity_snapshots" USING btree ("is_available");--> statement-breakpoint
CREATE INDEX "team_chat_messages_team_idx" ON "team_chat_messages" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "team_chat_messages_client_idx" ON "team_chat_messages" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "team_chat_messages_sender_idx" ON "team_chat_messages" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "team_chat_messages_created_idx" ON "team_chat_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "team_chat_messages_thread_idx" ON "team_chat_messages" USING btree ("team_id","thread_id");--> statement-breakpoint
CREATE INDEX "team_members_team_idx" ON "team_members" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "team_members_user_idx" ON "team_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "teams_org_idx" ON "teams" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "time_off_requests_org_user_idx" ON "time_off_requests" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "time_off_requests_status_idx" ON "time_off_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "time_off_requests_date_range_idx" ON "time_off_requests" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "trusted_devices_user_device_idx" ON "trusted_devices" USING btree ("user_id","device_id");--> statement-breakpoint
CREATE INDEX "user_agent_access_user_agent_idx" ON "user_agent_access" USING btree ("user_id","agent_id");--> statement-breakpoint
CREATE INDEX "user_agent_access_org_idx" ON "user_agent_access" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "user_agent_access_unique_idx" ON "user_agent_access" USING btree ("user_id","agent_id","organization_id");--> statement-breakpoint
CREATE INDEX "user_mfa_user_idx" ON "user_mfa" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_organizations_user_idx" ON "user_organizations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_organizations_org_idx" ON "user_organizations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "user_skills_unique" ON "user_skills" USING btree ("user_id","skill_id");--> statement-breakpoint
CREATE INDEX "webhook_events_expires_idx" ON "webhook_events" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "workflow_assignments_org_client_idx" ON "workflow_assignments" USING btree ("organization_id","client_id");--> statement-breakpoint
CREATE INDEX "workflow_assignments_workflow_status_idx" ON "workflow_assignments" USING btree ("workflow_id","status");--> statement-breakpoint
CREATE INDEX "workflow_executions_org_workflow_idx" ON "workflow_executions" USING btree ("organization_id","workflow_id");--> statement-breakpoint
CREATE INDEX "workflow_executions_workflow_status_idx" ON "workflow_executions" USING btree ("workflow_id","status");--> statement-breakpoint
CREATE INDEX "workflow_task_dependencies_task_idx" ON "workflow_task_dependencies" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "workflow_task_dependencies_depends_on_idx" ON "workflow_task_dependencies" USING btree ("depends_on_task_id");--> statement-breakpoint
CREATE INDEX "workflow_trigger_events_workflow_idx" ON "workflow_trigger_events" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "workflow_trigger_events_assignment_idx" ON "workflow_trigger_events" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX "workflow_trigger_events_type_idx" ON "workflow_trigger_events" USING btree ("trigger_type");--> statement-breakpoint
CREATE INDEX "workflow_trigger_events_scheduled_idx" ON "workflow_trigger_events" USING btree ("scheduled_for");--> statement-breakpoint
CREATE INDEX "workflow_trigger_events_org_idx" ON "workflow_trigger_events" USING btree ("organization_id");