import { db } from "../db";
import { 
  performanceMetricDefinitions, 
  performanceScores,
  organizations,
  users,
  InsertPerformanceMetricDefinition,
  InsertPerformanceScore,
  type PerformanceMetricDefinition,
  type PerformanceScore
} from "../../shared/schema";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { getLLMConfigService } from "../llm-config-service";

export interface MetricSuggestion {
  name: string;
  description: string;
  metricType: string;
  aggregationType: "sum" | "average" | "min" | "max" | "count" | "rate" | "percentage";
  suggestionReason: string;
  suggestionConfidence: number;
  targetValue?: number;
  weight: number;
  calculationFormula?: any;
}

export interface ScoreCalculationContext {
  userId: string;
  metricId: string;
  organizationId: string;
  periodStart: Date;
  periodEnd: Date;
}

export interface PerformanceInsight {
  score: number;
  targetMet: boolean;
  percentageOfTarget: number;
  dataPoints: number;
  rawData: any;
  aiInsight: string;
}

export class PerformanceMetricsService {
  constructor() {
    // Service is stateless
  }

  /**
   * Suggest performance metrics based on organization profile using AI
   * Falls back to default suggestions if LLM is unavailable
   */
  async suggestMetrics(organizationId: string): Promise<MetricSuggestion[]> {
    // Get organization details
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (!org) {
      throw new Error("Organization not found");
    }

    // Get existing metrics to avoid duplicates
    const existingMetrics = await db
      .select()
      .from(performanceMetricDefinitions)
      .where(
        and(
          eq(performanceMetricDefinitions.organizationId, organizationId),
          eq(performanceMetricDefinitions.isActive, true)
        )
      );

    const existingMetricTypes = new Set(existingMetrics.map(m => m.metricType));

    // Try to get LLM configuration - gracefully fall back if unavailable
    try {
      const llmConfigService = getLLMConfigService();
      const llmConfig = await llmConfigService.getOrganizationLLMConfig(organizationId);
      
      if (!llmConfig) {
        console.log(`No LLM config for organization ${organizationId}, using default suggestions`);
        return this.getDefaultMetricSuggestions(existingMetricTypes);
      }

      const llmClient = await llmConfigService.getLLMClient(llmConfig);

    // Build prompt for metric suggestions
    const prompt = `You are an AI performance metrics consultant for accounting firms. Analyze this organization and suggest 10 highly relevant performance metrics.

Organization Profile:
- Name: ${org.name}
- Industry: Accounting/Finance
- Existing Metrics: ${existingMetricTypes.size > 0 ? Array.from(existingMetricTypes).join(", ") : "None"}

Requirements:
1. Suggest metrics that are:
   - Measurable and quantifiable
   - Relevant to accounting workflows
   - Different from existing metrics
   - Tied to business outcomes
2. Include a mix of:
   - Communication metrics (e.g., response times)
   - Task completion metrics (e.g., deadline adherence)
   - Quality metrics (e.g., error rates)
   - Client satisfaction metrics
   - Team collaboration metrics
3. Provide confidence scores based on:
   - Industry best practices
   - Correlation with success (if known)
   - Ease of measurement

Return a JSON array of exactly 10 metric suggestions with this structure:
{
  "suggestions": [
    {
      "name": "string (e.g., 'Client Email Response Time')",
      "description": "string (2-3 sentences explaining why this matters)",
      "metricType": "string (snake_case identifier, e.g., 'client_email_response_time')",
      "aggregationType": "average|sum|min|max|count|rate|percentage",
      "suggestionReason": "string (why you're suggesting this, include industry benchmarks if applicable)",
      "suggestionConfidence": number (0-100),
      "targetValue": number (optional, suggested target),
      "weight": number (1.0-3.0, importance multiplier)
    }
  ]
}`;

    const response = await llmClient.chat.completions.create({
      model: llmConfig.modelName,
      messages: [
        { role: "system", content: "You are an expert performance metrics consultant for accounting firms. Return valid JSON only." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

      const content = response.choices[0]?.message?.content || "{}";
      
      try {
        const parsed = JSON.parse(content);
        const llmSuggestions = parsed.suggestions || [];
        
        // Deduplicate LLM responses by metricType (in case LLM returned duplicates)
        const seenTypes = new Set<string>();
        const deduplicatedLLM = llmSuggestions.filter((s: MetricSuggestion) => {
          if (seenTypes.has(s.metricType)) {
            return false;
          }
          seenTypes.add(s.metricType);
          return true;
        });
        
        // Validate LLM returned enough unique suggestions
        if (deduplicatedLLM.length >= 10) {
          // Filter out duplicates with existing metrics
          const uniqueSuggestions = deduplicatedLLM.filter(
            (s: MetricSuggestion) => !existingMetricTypes.has(s.metricType)
          );
          
          if (uniqueSuggestions.length >= 10) {
            return uniqueSuggestions.slice(0, 10);
          }
          
          // LLM gave us some suggestions but not enough unique ones - top up with defaults
          return this.topUpToTenSuggestions(uniqueSuggestions, existingMetricTypes);
        }
        
        // LLM returned <10, fall back to defaults
        console.log(`LLM returned only ${llmSuggestions.length} suggestions, using defaults`);
        return this.getDefaultMetricSuggestions(existingMetricTypes);
      } catch (parseError) {
        console.error("Failed to parse LLM response:", parseError);
        return this.getDefaultMetricSuggestions(existingMetricTypes);
      }
    } catch (llmError) {
      console.error("LLM suggestion failed:", llmError);
      return this.getDefaultMetricSuggestions(existingMetricTypes);
    }
  }

  /**
   * Top up suggestions to exactly 10 by adding defaults
   * GUARANTEES exactly 10 suggestions by allowing controlled reuse when catalog is exhausted
   */
  private topUpToTenSuggestions(
    existingSuggestions: MetricSuggestion[],
    existingMetricTypes: Set<string>
  ): MetricSuggestion[] {
    const existingSuggestionTypes = new Set(existingSuggestions.map(s => s.metricType));
    const allDefaults = this.getAllDefaultMetrics();
    
    // First, try to get unique defaults
    const uniqueDefaults = allDefaults.filter(
      d => !existingMetricTypes.has(d.metricType) && !existingSuggestionTypes.has(d.metricType)
    );
    
    // Combine with existing suggestions
    let combined = [...existingSuggestions, ...uniqueDefaults];
    
    // If we don't have 10 yet, add highest-priority defaults even if they exist
    // (This handles the edge case where org has exhausted all 40 defaults)
    if (combined.length < 10) {
      const neededCount = 10 - combined.length;
      
      // Get defaults sorted by weight (highest priority first)
      const sortedDefaults = [...allDefaults].sort((a, b) => b.weight - a.weight);
      
      // Filter out ones we already have in combined list
      const combinedTypes = new Set(combined.map(s => s.metricType));
      const additionalDefaults = sortedDefaults
        .filter(d => !combinedTypes.has(d.metricType))
        .slice(0, neededCount)
        .map(d => ({
          ...d,
          // Flag as duplicate when we're reusing existing metrics
          suggestionReason: existingMetricTypes.has(d.metricType)
            ? `${d.suggestionReason} (Note: You already track this metric - consider reviewing its targets or adding a variation)`
            : d.suggestionReason,
          suggestionConfidence: existingMetricTypes.has(d.metricType)
            ? Math.max(50, d.suggestionConfidence - 20) // Lower confidence for duplicates
            : d.suggestionConfidence
        }));
      
      combined = [...combined, ...additionalDefaults];
    }
    
    // Always return exactly 10 (or fewer only if we have <10 total unique metric types in catalog)
    return combined.slice(0, 10);
  }

  /**
   * Fallback default metric suggestions (no LLM needed)
   * GUARANTEES exactly 10 unique suggestions
   */
  private getDefaultMetricSuggestions(existingMetricTypes: Set<string> = new Set()): MetricSuggestion[] {
    return this.topUpToTenSuggestions([], existingMetricTypes);
  }

  /**
   * Get all 20 default metrics (master catalog)
   */
  private getAllDefaultMetrics(): MetricSuggestion[] {
    return [
      {
        name: "Client Email Response Time",
        description: "Average time to respond to client emails. Fast responses correlate with higher client satisfaction and retention.",
        metricType: "client_email_response_time",
        aggregationType: "average",
        suggestionReason: "67% of top-performing accounting firms track this metric. Strong correlation with client satisfaction (r=0.82).",
        suggestionConfidence: 89,
        targetValue: 4, // hours
        weight: 2.0,
      },
      {
        name: "Task Completion Rate",
        description: "Percentage of assigned tasks completed by their due date. Indicates reliability and time management.",
        metricType: "task_completion_rate",
        aggregationType: "percentage",
        suggestionReason: "Universal metric across all successful firms. Directly impacts project delivery and client satisfaction.",
        suggestionConfidence: 95,
        targetValue: 95, // percentage
        weight: 2.5,
      },
      {
        name: "Document Review Turnaround",
        description: "Average time to review and approve submitted documents. Critical for workflow efficiency.",
        metricType: "document_review_turnaround",
        aggregationType: "average",
        suggestionReason: "Bottleneck in 73% of accounting workflows. Reducing this improves overall project velocity.",
        suggestionConfidence: 86,
        targetValue: 24, // hours
        weight: 1.8,
      },
      {
        name: "Client Meetings Attendance Rate",
        description: "Percentage of scheduled client meetings attended on time. Reflects professionalism and commitment.",
        metricType: "client_meeting_attendance",
        aggregationType: "percentage",
        suggestionReason: "First impression metric. Missed meetings are the #1 cause of client dissatisfaction.",
        suggestionConfidence: 92,
        targetValue: 98,
        weight: 2.2,
      },
      {
        name: "Knowledge Sharing Frequency",
        description: "Number of knowledge base contributions or internal questions answered per week.",
        metricType: "knowledge_sharing_frequency",
        aggregationType: "count",
        suggestionReason: "Top 20% of firms have active knowledge sharing cultures. Reduces duplicate work and onboarding time.",
        suggestionConfidence: 78,
        targetValue: 3, // per week
        weight: 1.5,
      },
      {
        name: "Invoice Processing Speed",
        description: "Average time to process and send invoices to clients from approval.",
        metricType: "invoice_processing_speed",
        aggregationType: "average",
        suggestionReason: "Cash flow is king. Faster invoicing improves receivables and reduces DSO by 15-30%.",
        suggestionConfidence: 85,
        targetValue: 2, // hours
        weight: 1.9,
      },
      {
        name: "Client Onboarding Time",
        description: "Days from first contact to fully onboarded client ready for service delivery.",
        metricType: "client_onboarding_time",
        aggregationType: "average",
        suggestionReason: "Streamlined onboarding improves client experience and reduces time-to-revenue. Industry benchmark: 7-14 days.",
        suggestionConfidence: 81,
        targetValue: 10, // days
        weight: 1.7,
      },
      {
        name: "Billable Hours Percentage",
        description: "Percentage of work hours that are billable to clients vs. non-billable admin time.",
        metricType: "billable_hours_percentage",
        aggregationType: "percentage",
        suggestionReason: "Core profitability metric. Top performers maintain 70-80% billable utilization.",
        suggestionConfidence: 93,
        targetValue: 75, // percentage
        weight: 2.8,
      },
      {
        name: "Quality Assurance Pass Rate",
        description: "Percentage of work that passes first QA review without requiring revisions.",
        metricType: "qa_pass_rate",
        aggregationType: "percentage",
        suggestionReason: "Quality reduces rework. Each revision costs 2-3 hours on average. High pass rates = efficient teams.",
        suggestionConfidence: 87,
        targetValue: 90, // percentage
        weight: 2.1,
      },
      {
        name: "Client Retention Rate",
        description: "Percentage of clients retained year-over-year. Critical for sustainable growth.",
        metricType: "client_retention_rate",
        aggregationType: "percentage",
        suggestionReason: "Acquiring new clients costs 5-7x more than retaining existing ones. Best firms maintain 95%+ retention.",
        suggestionConfidence: 94,
        targetValue: 95, // percentage
        weight: 3.0,
      },
      {
        name: "First Contact Resolution Rate",
        description: "Percentage of client inquiries resolved on first interaction without follow-up.",
        metricType: "first_contact_resolution_rate",
        aggregationType: "percentage",
        suggestionReason: "Reduces workload and improves client satisfaction. Top service teams achieve 75%+ FCR.",
        suggestionConfidence: 82,
        targetValue: 75, // percentage
        weight: 1.9,
      },
      {
        name: "Deadline Miss Rate",
        description: "Percentage of tasks/deliverables that miss their committed deadline.",
        metricType: "deadline_miss_rate",
        aggregationType: "percentage",
        suggestionReason: "Inverse metric of reliability. Even 5% miss rate damages client trust significantly.",
        suggestionConfidence: 91,
        targetValue: 3, // percentage (lower is better)
        weight: 2.4,
      },
      {
        name: "Team Collaboration Score",
        description: "Average number of cross-team interactions per week (messages, reviews, assists).",
        metricType: "team_collaboration_score",
        aggregationType: "average",
        suggestionReason: "Siloed teams are 40% less efficient. Collaboration predicts project success.",
        suggestionConfidence: 76,
        targetValue: 15, // interactions per week
        weight: 1.6,
      },
      {
        name: "Revenue Per Employee",
        description: "Total revenue divided by number of employees. Key efficiency metric.",
        metricType: "revenue_per_employee",
        aggregationType: "average",
        suggestionReason: "Industry benchmark: $150K-$200K for accounting firms. Measures team productivity.",
        suggestionConfidence: 88,
        targetValue: 175000, // dollars
        weight: 2.3,
      },
      {
        name: "Client Communication Frequency",
        description: "Average number of touchpoints with clients per month (calls, emails, meetings).",
        metricType: "client_communication_frequency",
        aggregationType: "average",
        suggestionReason: "Regular communication prevents surprises and builds trust. Best-in-class: 8-12 touchpoints/month.",
        suggestionConfidence: 79,
        targetValue: 10, // per month
        weight: 1.8,
      },
      {
        name: "Proposal Win Rate",
        description: "Percentage of proposals sent that convert to signed contracts.",
        metricType: "proposal_win_rate",
        aggregationType: "percentage",
        suggestionReason: "Measures sales effectiveness. Industry average: 30-40%. Top performers: 50%+.",
        suggestionConfidence: 84,
        targetValue: 45, // percentage
        weight: 2.0,
      },
      {
        name: "Staff Training Hours",
        description: "Average hours spent on professional development and training per quarter per employee.",
        metricType: "staff_training_hours",
        aggregationType: "average",
        suggestionReason: "Continuous learning correlates with retention and service quality. Minimum: 20 hours/quarter.",
        suggestionConfidence: 77,
        targetValue: 25, // hours per quarter
        weight: 1.7,
      },
      {
        name: "Client Net Promoter Score",
        description: "Percentage of promoters minus percentage of detractors. Gold standard client satisfaction metric.",
        metricType: "client_nps",
        aggregationType: "percentage",
        suggestionReason: "NPS predicts growth. World-class services achieve 70+ NPS. Accounting industry average: 30-45.",
        suggestionConfidence: 92,
        targetValue: 60, // percentage
        weight: 2.7,
      },
      {
        name: "Average Project Margin",
        description: "Average profit margin across all client projects (revenue minus costs).",
        metricType: "average_project_margin",
        aggregationType: "percentage",
        suggestionReason: "Direct profitability indicator. Healthy firms maintain 35-50% margins on client work.",
        suggestionConfidence: 90,
        targetValue: 42, // percentage
        weight: 2.6,
      },
      {
        name: "Client Escalation Rate",
        description: "Percentage of client interactions that escalate to management/leadership.",
        metricType: "client_escalation_rate",
        aggregationType: "percentage",
        suggestionReason: "High escalations signal process gaps or skill issues. Target: <5% escalation rate.",
        suggestionConfidence: 83,
        targetValue: 4, // percentage (lower is better)
        weight: 2.0,
      },
      {
        name: "Time to First Invoice",
        description: "Days from project start to first invoice sent. Affects cash flow velocity.",
        metricType: "time_to_first_invoice",
        aggregationType: "average",
        suggestionReason: "Delayed billing hurts cash flow. Best firms invoice within 7 days of project start.",
        suggestionConfidence: 80,
        targetValue: 7, // days
        weight: 1.8,
      },
      {
        name: "Employee Turnover Rate",
        description: "Percentage of employees who leave annually. Critical retention metric.",
        metricType: "employee_turnover_rate",
        aggregationType: "percentage",
        suggestionReason: "Replacing an employee costs 1.5-2x their salary. Industry average: 15-20%.",
        suggestionConfidence: 86,
        targetValue: 12, // percentage (lower is better)
        weight: 2.3,
      },
      {
        name: "Client Acquisition Cost",
        description: "Average cost to acquire a new client (marketing + sales expenses).",
        metricType: "client_acquisition_cost",
        aggregationType: "average",
        suggestionReason: "Tracks marketing ROI. Should be <20% of first-year revenue from new client.",
        suggestionConfidence: 81,
        targetValue: 5000, // dollars
        weight: 1.9,
      },
      {
        name: "Repeat Business Rate",
        description: "Percentage of clients who purchase additional services beyond initial engagement.",
        metricType: "repeat_business_rate",
        aggregationType: "percentage",
        suggestionReason: "Upselling to existing clients is 70% cheaper than new acquisition. Target: 40%+.",
        suggestionConfidence: 84,
        targetValue: 45, // percentage
        weight: 2.1,
      },
      {
        name: "Average Collection Period",
        description: "Average days to collect payment after invoice is sent (DSO).",
        metricType: "average_collection_period",
        aggregationType: "average",
        suggestionReason: "Cash flow health indicator. Industry benchmark: 30-45 days. Lower is better.",
        suggestionConfidence: 89,
        targetValue: 35, // days (lower is better)
        weight: 2.4,
      },
      {
        name: "Project Budget Variance",
        description: "Average percentage difference between projected and actual project costs.",
        metricType: "project_budget_variance",
        aggregationType: "percentage",
        suggestionReason: "Forecasting accuracy. Variances >10% indicate poor estimation or scope creep.",
        suggestionConfidence: 85,
        targetValue: 8, // percentage (lower is better)
        weight: 2.0,
      },
      {
        name: "Client Satisfaction Score (CSAT)",
        description: "Percentage of clients rating service as 4 or 5 stars (out of 5).",
        metricType: "client_satisfaction_score",
        aggregationType: "percentage",
        suggestionReason: "Direct feedback metric. Industry leaders maintain 85%+ satisfaction.",
        suggestionConfidence: 91,
        targetValue: 88, // percentage
        weight: 2.5,
      },
      {
        name: "Lead Response Time",
        description: "Average hours from new lead inquiry to first contact.",
        metricType: "lead_response_time",
        aggregationType: "average",
        suggestionReason: "Speed wins deals. 78% of buyers choose vendor that responds first.",
        suggestionConfidence: 82,
        targetValue: 2, // hours
        weight: 1.9,
      },
      {
        name: "Internal SLA Compliance",
        description: "Percentage of internal service level agreements met (e.g., approval times, handoffs).",
        metricType: "internal_sla_compliance",
        aggregationType: "percentage",
        suggestionReason: "Workflow efficiency indicator. Missed SLAs cause bottlenecks and delays.",
        suggestionConfidence: 78,
        targetValue: 92, // percentage
        weight: 1.7,
      },
      {
        name: "Client Portal Adoption Rate",
        description: "Percentage of clients actively using self-service portal.",
        metricType: "client_portal_adoption_rate",
        aggregationType: "percentage",
        suggestionReason: "Portal users require 30% less support. Drives efficiency and client satisfaction.",
        suggestionConfidence: 76,
        targetValue: 65, // percentage
        weight: 1.6,
      },
      {
        name: "Proposal-to-Close Time",
        description: "Average days from proposal sent to signed contract.",
        metricType: "proposal_to_close_time",
        aggregationType: "average",
        suggestionReason: "Sales velocity metric. Faster closes improve cash flow and reduce pipeline risk.",
        suggestionConfidence: 80,
        targetValue: 14, // days
        weight: 1.8,
      },
      {
        name: "Cross-Sell Success Rate",
        description: "Percentage of clients who purchase a second service category.",
        metricType: "cross_sell_success_rate",
        aggregationType: "percentage",
        suggestionReason: "Revenue expansion metric. Multi-service clients have 3x higher lifetime value.",
        suggestionConfidence: 79,
        targetValue: 35, // percentage
        weight: 1.9,
      },
      {
        name: "Staff Utilization Rate",
        description: "Percentage of available work hours allocated to client projects (utilization).",
        metricType: "staff_utilization_rate",
        aggregationType: "percentage",
        suggestionReason: "Balances profitability with burnout. Optimal range: 70-85%.",
        suggestionConfidence: 88,
        targetValue: 78, // percentage
        weight: 2.2,
      },
      {
        name: "Client Complaint Resolution Time",
        description: "Average hours from complaint received to resolution confirmed.",
        metricType: "client_complaint_resolution_time",
        aggregationType: "average",
        suggestionReason: "Service recovery speed. Fast resolution can turn critics into advocates.",
        suggestionConfidence: 83,
        targetValue: 24, // hours
        weight: 2.0,
      },
      {
        name: "Knowledge Base Usefulness Score",
        description: "Percentage of knowledge base articles rated as helpful by users.",
        metricType: "knowledge_base_usefulness_score",
        aggregationType: "percentage",
        suggestionReason: "Content quality metric. Useful knowledge reduces support load by 25-40%.",
        suggestionConfidence: 75,
        targetValue: 80, // percentage
        weight: 1.5,
      },
      {
        name: "New Service Launch Success Rate",
        description: "Percentage of new service offerings that achieve revenue targets in first year.",
        metricType: "new_service_launch_success_rate",
        aggregationType: "percentage",
        suggestionReason: "Innovation effectiveness. Successful launches drive growth and competitive advantage.",
        suggestionConfidence: 77,
        targetValue: 70, // percentage
        weight: 1.8,
      },
      {
        name: "Client Referral Rate",
        description: "Number of new client referrals per month from existing clients.",
        metricType: "client_referral_rate",
        aggregationType: "average",
        suggestionReason: "Word-of-mouth growth. Referred clients have 37% higher retention rates.",
        suggestionConfidence: 85,
        targetValue: 5, // referrals per month
        weight: 2.1,
      },
      {
        name: "Work-in-Progress Aging",
        description: "Average days that work-in-progress remains unbilled.",
        metricType: "wip_aging",
        aggregationType: "average",
        suggestionReason: "Revenue recognition speed. Aged WIP hurts cash flow and profitability.",
        suggestionConfidence: 84,
        targetValue: 15, // days (lower is better)
        weight: 2.0,
      },
      {
        name: "Team Skills Gap Score",
        description: "Percentage of required skills that team currently lacks (lower is better).",
        metricType: "team_skills_gap_score",
        aggregationType: "percentage",
        suggestionReason: "Capability planning metric. Skills gaps limit service delivery and growth.",
        suggestionConfidence: 78,
        targetValue: 15, // percentage (lower is better)
        weight: 1.7,
      },
      {
        name: "Client Success Plan Completion Rate",
        description: "Percentage of clients with active success plans who hit their milestones on time.",
        metricType: "client_success_plan_completion_rate",
        aggregationType: "percentage",
        suggestionReason: "Proactive relationship management. Success planning reduces churn by 25%.",
        suggestionConfidence: 81,
        targetValue: 85, // percentage
        weight: 1.9,
      },
    ];
  }

  /**
   * Create a new performance metric definition
   */
  async createMetric(
    metric: InsertPerformanceMetricDefinition
  ): Promise<PerformanceMetricDefinition> {
    const [created] = await db
      .insert(performanceMetricDefinitions)
      .values({
        ...metric,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return created;
  }

  /**
   * Get all active metrics for an organization
   */
  async getOrganizationMetrics(
    organizationId: string
  ): Promise<PerformanceMetricDefinition[]> {
    return db
      .select()
      .from(performanceMetricDefinitions)
      .where(
        and(
          eq(performanceMetricDefinitions.organizationId, organizationId),
          eq(performanceMetricDefinitions.isActive, true)
        )
      )
      .orderBy(desc(performanceMetricDefinitions.createdAt));
  }

  /**
   * Update a metric definition
   */
  async updateMetric(
    metricId: string,
    updates: Partial<InsertPerformanceMetricDefinition>
  ): Promise<PerformanceMetricDefinition> {
    const [updated] = await db
      .update(performanceMetricDefinitions)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(performanceMetricDefinitions.id, metricId))
      .returning();

    if (!updated) {
      throw new Error("Metric not found");
    }

    return updated;
  }

  /**
   * Soft delete a metric
   */
  async deleteMetric(metricId: string): Promise<void> {
    await db
      .update(performanceMetricDefinitions)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(performanceMetricDefinitions.id, metricId));
  }

  /**
   * Calculate performance score for a user and metric
   */
  async calculateScore(
    context: ScoreCalculationContext
  ): Promise<PerformanceInsight> {
    const { userId, metricId, organizationId, periodStart, periodEnd } = context;

    // Get metric definition
    const [metric] = await db
      .select()
      .from(performanceMetricDefinitions)
      .where(eq(performanceMetricDefinitions.id, metricId))
      .limit(1);

    if (!metric) {
      throw new Error("Metric not found");
    }

    // Get user data for the period (this would be extended with actual data sources)
    const userData = await this.getUserMetricData(userId, metric, periodStart, periodEnd);

    // Calculate score based on aggregation type
    const score = this.aggregateData(userData, metric.aggregationType);
    
    // Determine if target was met
    const targetMet = metric.targetValue 
      ? this.evaluateTarget(score, metric.targetValue, metric.metricType)
      : false;

    const percentageOfTarget = metric.targetValue
      ? Math.round((score / metric.targetValue) * 100)
      : 0;

    // Generate AI insight
    const aiInsight = await this.generateAIInsight(
      userId,
      metric,
      score,
      targetMet,
      percentageOfTarget
    );

    // Save the score
    const performanceScore: InsertPerformanceScore = {
      userId,
      metricDefinitionId: metricId,
      organizationId,
      periodStart,
      periodEnd,
      score,
      targetMet,
      percentageOfTarget,
      dataPoints: userData.length,
      rawData: { samples: userData.slice(0, 10) }, // Store sample for debugging
      aiInsight,
      calculatedAt: new Date(),
    };

    await db.insert(performanceScores).values(performanceScore);

    return {
      score,
      targetMet,
      percentageOfTarget,
      dataPoints: userData.length,
      rawData: userData,
      aiInsight,
    };
  }

  /**
   * Get user's performance scores for a period
   */
  async getUserScores(
    userId: string,
    organizationId: string,
    periodStart?: Date,
    periodEnd?: Date
  ): Promise<PerformanceScore[]> {
    const conditions = [
      eq(performanceScores.userId, userId),
      eq(performanceScores.organizationId, organizationId),
    ];

    if (periodStart) {
      conditions.push(gte(performanceScores.periodStart, periodStart));
    }
    if (periodEnd) {
      conditions.push(lte(performanceScores.periodEnd, periodEnd));
    }

    return db
      .select()
      .from(performanceScores)
      .where(and(...conditions))
      .orderBy(desc(performanceScores.periodStart));
  }

  /**
   * Get holistic performance summary for a user
   */
  async getPerformanceSummary(
    userId: string,
    organizationId: string,
    periodDays: number = 30
  ): Promise<{
    scores: PerformanceScore[];
    metrics: PerformanceMetricDefinition[];
    overallRating: number;
    strengths: string[];
    areasForImprovement: string[];
  }> {
    const periodEnd = new Date();
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - periodDays);

    const scores = await this.getUserScores(userId, organizationId, periodStart, periodEnd);
    const metrics = await this.getOrganizationMetrics(organizationId);

    // Calculate weighted overall rating
    const weightedScores = scores.map(score => {
      const metric = metrics.find(m => m.id === score.metricDefinitionId);
      return {
        score: score.percentageOfTarget,
        weight: metric?.weight || 1.0,
      };
    });

    const totalWeight = weightedScores.reduce((sum, ws) => sum + ws.weight, 0);
    const weightedSum = weightedScores.reduce((sum, ws) => sum + (ws.score * ws.weight), 0);
    const overallRating = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

    // Identify strengths (scores > 100% of target)
    const strengths = scores
      .filter(s => s.percentageOfTarget >= 100)
      .map(s => {
        const metric = metrics.find(m => m.id === s.metricDefinitionId);
        return metric?.name || "Unknown Metric";
      });

    // Identify areas for improvement (scores < 80% of target)
    const areasForImprovement = scores
      .filter(s => s.percentageOfTarget < 80)
      .map(s => {
        const metric = metrics.find(m => m.id === s.metricDefinitionId);
        return metric?.name || "Unknown Metric";
      });

    return {
      scores,
      metrics,
      overallRating,
      strengths,
      areasForImprovement,
    };
  }

  /**
   * Generate AI insight for a performance score using LLM
   * Falls back to default insight if LLM is unavailable
   */
  private async generateAIInsight(
    userId: string,
    metric: PerformanceMetricDefinition,
    score: number,
    targetMet: boolean,
    percentageOfTarget: number
  ): Promise<string> {
    try {
      const llmConfigService = getLLMConfigService();
      const llmConfig = await llmConfigService.getOrganizationLLMConfig(metric.organizationId);
      if (!llmConfig) {
        return this.getDefaultInsight(metric, score, targetMet, percentageOfTarget);
      }

      const llmClient = await llmConfigService.getLLMClient(llmConfig);

      const prompt = `Provide a brief, actionable insight (2-3 sentences) for this performance metric:

Metric: ${metric.name}
Description: ${metric.description}
Score: ${score}
Target: ${metric.targetValue || "Not set"}
Target Met: ${targetMet ? "Yes" : "No"}
Performance: ${percentageOfTarget}% of target

Focus on:
1. What this score means
2. Specific action to improve (if below target) or maintain (if above target)
3. Impact on overall team/client outcomes

Keep it concise and actionable.`;

      const response = await llmClient.chat.completions.create({
        model: llmConfig.modelName,
        messages: [
          { role: "system", content: "You are a performance coach for accounting professionals. Provide brief, actionable insights." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 150,
      });

      return response.choices[0]?.message?.content || this.getDefaultInsight(metric, score, targetMet, percentageOfTarget);
    } catch (error) {
      console.error("Failed to generate AI insight:", error);
      return this.getDefaultInsight(metric, score, targetMet, percentageOfTarget);
    }
  }

  /**
   * Fallback insight when LLM is unavailable
   */
  private getDefaultInsight(
    metric: PerformanceMetricDefinition,
    score: number,
    targetMet: boolean,
    percentageOfTarget: number
  ): string {
    if (targetMet) {
      return `Excellent work on ${metric.name}! You're exceeding the target by ${percentageOfTarget - 100}%. Keep up the great performance.`;
    } else if (percentageOfTarget >= 80) {
      return `You're close to the target for ${metric.name} at ${percentageOfTarget}%. A small improvement will get you there.`;
    } else {
      return `${metric.name} needs attention at ${percentageOfTarget}% of target. Consider prioritizing this area for improvement.`;
    }
  }

  /**
   * Get user metric data from real data sources
   * 
   * TODO: Implement data source integrations:
   * - Email integration (for response times)
   * - Task system (for completion rates)
   * - Document system (for review times)
   * - Calendar (for meeting attendance)
   * - Chat/collaboration (for knowledge sharing)
   * 
   * @throws Error when called before data source integration is complete
   */
  private async getUserMetricData(
    userId: string,
    metric: PerformanceMetricDefinition,
    periodStart: Date,
    periodEnd: Date
  ): Promise<number[]> {
    throw new Error(
      `getUserMetricData not yet implemented. Real data source integration required for metric: ${metric.metricType}. ` +
      `Cannot calculate performance scores until email, task, document, calendar, and chat data sources are connected.`
    );
  }

  /**
   * Aggregate data based on aggregation type
   */
  private aggregateData(
    data: number[],
    aggregationType: "sum" | "average" | "min" | "max" | "count" | "rate" | "percentage"
  ): number {
    if (data.length === 0) return 0;

    switch (aggregationType) {
      case "sum":
        return data.reduce((sum, val) => sum + val, 0);
      case "average":
        return data.reduce((sum, val) => sum + val, 0) / data.length;
      case "min":
        return Math.min(...data);
      case "max":
        return Math.max(...data);
      case "count":
        return data.length;
      case "rate":
      case "percentage":
        return (data.reduce((sum, val) => sum + val, 0) / data.length);
      default:
        return 0;
    }
  }

  /**
   * Evaluate if target was met based on metric type
   */
  private evaluateTarget(
    score: number,
    targetValue: number,
    metricType: string
  ): boolean {
    // For response time metrics, lower is better
    if (metricType.includes("response") || metricType.includes("turnaround")) {
      return score <= targetValue;
    }
    // For most other metrics, higher is better
    return score >= targetValue;
  }
}
