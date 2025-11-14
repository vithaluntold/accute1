import { db } from "../db";
import { skills, userSkills, taskSkillRequirements, users, workflowTasks, workflowSteps, workflowStages, workflows } from "@shared/schema";
import { eq, and, inArray, sql, or, ilike } from "drizzle-orm";

export interface SkillMatch {
  userId: string;
  matchScore: number;
  matchedSkills: Array<{
    skillId: string;
    skillName: string;
    userProficiency: string;
    requiredProficiency: string;
    importance: string;
    meetsRequirement: boolean;
  }>;
  missingSkills: Array<{
    skillId: string;
    skillName: string;
    requiredProficiency: string;
    importance: string;
  }>;
}

export class SkillService {
  /**
   * Create a new skill in the organization's taxonomy
   * SECURITY: Organization-scoped
   */
  static async createSkill(data: {
    organizationId: string;
    name: string;
    description?: string;
    category?: string;
  }) {
    // Check for duplicate skill name in organization
    const existing = await db.query.skills.findFirst({
      where: and(
        eq(skills.organizationId, data.organizationId),
        ilike(skills.name, data.name)
      ),
    });

    if (existing) {
      throw new Error("A skill with this name already exists in your organization");
    }

    const [skill] = await db
      .insert(skills)
      .values({
        organizationId: data.organizationId,
        name: data.name,
        description: data.description,
        category: data.category,
      })
      .returning();

    return skill;
  }

  /**
   * Update a skill
   */
  static async updateSkill(
    skillId: string,
    organizationId: string,
    updates: {
      name?: string;
      description?: string;
      category?: string;
    }
  ) {
    // Verify skill belongs to organization
    const existing = await db.query.skills.findFirst({
      where: and(
        eq(skills.id, skillId),
        eq(skills.organizationId, organizationId)
      ),
    });

    if (!existing) {
      throw new Error("Skill not found");
    }

    // Check for duplicate name if name is being updated
    if (updates.name && updates.name !== existing.name) {
      const duplicate = await db.query.skills.findFirst({
        where: and(
          eq(skills.organizationId, organizationId),
          ilike(skills.name, updates.name),
          sql`${skills.id} != ${skillId}`
        ),
      });

      if (duplicate) {
        throw new Error("A skill with this name already exists in your organization");
      }
    }

    const [updated] = await db
      .update(skills)
      .set({
        name: updates.name !== undefined ? updates.name : existing.name,
        description: updates.description !== undefined ? updates.description : existing.description,
        category: updates.category !== undefined ? updates.category : existing.category,
      })
      .where(
        and(
          eq(skills.id, skillId),
          eq(skills.organizationId, organizationId)
        )
      )
      .returning();

    return updated;
  }

  /**
   * Delete a skill (also deletes all user skills and task requirements)
   */
  static async deleteSkill(skillId: string, organizationId: string) {
    const [deleted] = await db
      .delete(skills)
      .where(
        and(
          eq(skills.id, skillId),
          eq(skills.organizationId, organizationId)
        )
      )
      .returning();

    if (!deleted) {
      throw new Error("Skill not found");
    }

    return deleted;
  }

  /**
   * Get all skills in an organization
   */
  static async getOrganizationSkills(organizationId: string, category?: string) {
    const conditions = [eq(skills.organizationId, organizationId)];

    if (category) {
      conditions.push(eq(skills.category, category));
    }

    return await db.query.skills.findMany({
      where: and(...conditions),
      orderBy: (skills, { asc }) => [asc(skills.category), asc(skills.name)],
    });
  }

  /**
   * Get skill categories in an organization
   */
  static async getSkillCategories(organizationId: string) {
    const result = await db
      .selectDistinct({ category: skills.category })
      .from(skills)
      .where(eq(skills.organizationId, organizationId))
      .orderBy(sql`${skills.category} ASC NULLS LAST`);

    return result.map(r => r.category).filter(Boolean);
  }

  // ==================== USER SKILLS ====================

  /**
   * Add a skill to a user's profile
   * SECURITY: Verifies user and skill belong to same organization
   */
  static async addUserSkill(data: {
    userId: string;
    skillId: string;
    proficiencyLevel: string;
    yearsExperience?: number;
    certifications?: string[];
    lastUsedDate?: Date;
    endorsements?: number;
  }) {
    // Verify skill exists
    const skill = await db.query.skills.findFirst({
      where: eq(skills.id, data.skillId),
    });

    if (!skill) {
      throw new Error("Skill not found");
    }

    // SECURITY: Verify user belongs to same organization as skill
    const user = await db.query.users.findFirst({
      where: and(
        eq(users.id, data.userId),
        or(
          eq(users.organizationId, skill.organizationId),
          eq(users.defaultOrganizationId, skill.organizationId)
        )
      ),
    });

    if (!user) {
      throw new Error("User not found in skill's organization");
    }

    // Check if user already has this skill
    const existing = await db.query.userSkills.findFirst({
      where: and(
        eq(userSkills.userId, data.userId),
        eq(userSkills.skillId, data.skillId)
      ),
    });

    if (existing) {
      throw new Error("User already has this skill");
    }

    const [userSkill] = await db
      .insert(userSkills)
      .values({
        userId: data.userId,
        skillId: data.skillId,
        proficiencyLevel: data.proficiencyLevel,
        yearsExperience: data.yearsExperience || 0,
        certifications: data.certifications || [],
        lastUsedDate: data.lastUsedDate,
        endorsements: data.endorsements || 0,
      })
      .returning();

    return userSkill;
  }

  /**
   * Update a user's skill
   * SECURITY: Verifies organization ownership via skill
   */
  static async updateUserSkill(
    userSkillId: string,
    userId: string,
    organizationId: string,
    updates: {
      proficiencyLevel?: string;
      yearsExperience?: number;
      certifications?: string[];
      lastUsedDate?: Date;
      endorsements?: number;
    }
  ) {
    // SECURITY: Fetch user skill with skill to verify organization
    const existing = await db.query.userSkills.findFirst({
      where: and(
        eq(userSkills.id, userSkillId),
        eq(userSkills.userId, userId)
      ),
      with: {
        skill: true,
      },
    });

    if (!existing) {
      throw new Error("User skill not found");
    }

    // SECURITY: Verify skill belongs to organization
    if (existing.skill.organizationId !== organizationId) {
      throw new Error("Unauthorized: Skill belongs to different organization");
    }

    const [updated] = await db
      .update(userSkills)
      .set({
        proficiencyLevel: updates.proficiencyLevel !== undefined ? updates.proficiencyLevel : existing.proficiencyLevel,
        yearsExperience: updates.yearsExperience !== undefined ? updates.yearsExperience : existing.yearsExperience,
        certifications: updates.certifications !== undefined ? updates.certifications : existing.certifications,
        lastUsedDate: updates.lastUsedDate !== undefined ? updates.lastUsedDate : existing.lastUsedDate,
        endorsements: updates.endorsements !== undefined ? updates.endorsements : existing.endorsements,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(userSkills.id, userSkillId),
          eq(userSkills.userId, userId)
        )
      )
      .returning();

    return updated;
  }

  /**
   * Remove a skill from a user's profile
   * SECURITY: Verifies organization ownership via skill
   */
  static async removeUserSkill(userSkillId: string, userId: string, organizationId: string) {
    // SECURITY: Fetch user skill with skill to verify organization
    const existing = await db.query.userSkills.findFirst({
      where: and(
        eq(userSkills.id, userSkillId),
        eq(userSkills.userId, userId)
      ),
      with: {
        skill: true,
      },
    });

    if (!existing) {
      throw new Error("User skill not found");
    }

    // SECURITY: Verify skill belongs to organization
    if (existing.skill.organizationId !== organizationId) {
      throw new Error("Unauthorized: Skill belongs to different organization");
    }

    const [deleted] = await db
      .delete(userSkills)
      .where(
        and(
          eq(userSkills.id, userSkillId),
          eq(userSkills.userId, userId)
        )
      )
      .returning();

    return deleted;
  }

  /**
   * Get all skills for a user
   * SECURITY: Verifies user belongs to organization
   */
  static async getUserSkills(userId: string, organizationId: string) {
    // SECURITY: Verify user belongs to organization
    const user = await db.query.users.findFirst({
      where: and(
        eq(users.id, userId),
        or(
          eq(users.organizationId, organizationId),
          eq(users.defaultOrganizationId, organizationId)
        )
      ),
    });

    if (!user) {
      throw new Error("User not found in organization");
    }

    return await db.query.userSkills.findMany({
      where: eq(userSkills.userId, userId),
      with: {
        skill: true,
      },
      orderBy: (userSkills, { desc }) => [desc(userSkills.proficiencyLevel), desc(userSkills.yearsExperience)],
    });
  }

  /**
   * Endorse a user's skill
   * SECURITY: Verifies organization ownership via skill
   */
  static async endorseUserSkill(userSkillId: string, organizationId: string) {
    // SECURITY: Fetch user skill with skill to verify organization
    const existing = await db.query.userSkills.findFirst({
      where: eq(userSkills.id, userSkillId),
      with: {
        skill: true,
      },
    });

    if (!existing) {
      throw new Error("User skill not found");
    }

    // SECURITY: Verify skill belongs to organization
    if (existing.skill.organizationId !== organizationId) {
      throw new Error("Unauthorized: Skill belongs to different organization");
    }

    const [updated] = await db
      .update(userSkills)
      .set({
        endorsements: (existing.endorsements || 0) + 1,
        updatedAt: new Date(),
      })
      .where(eq(userSkills.id, userSkillId))
      .returning();

    return updated;
  }

  // ==================== TASK SKILL REQUIREMENTS ====================

  /**
   * Add a skill requirement to a task
   * SECURITY: Verifies task and skill belong to same organization
   */
  static async addTaskSkillRequirement(data: {
    taskId: string;
    skillId: string;
    requiredLevel?: string;
    importance?: string;
    organizationId: string; // Required for security verification
  }) {
    // Verify skill exists and belongs to organization
    const skill = await db.query.skills.findFirst({
      where: and(
        eq(skills.id, data.skillId),
        eq(skills.organizationId, data.organizationId)
      ),
    });

    if (!skill) {
      throw new Error("Skill not found in organization");
    }

    // SECURITY: Verify task belongs to same organization
    const taskVerification = await db
      .select({
        taskId: workflowTasks.id,
        organizationId: workflows.organizationId,
      })
      .from(workflowTasks)
      .innerJoin(workflowSteps, eq(workflowTasks.stepId, workflowSteps.id))
      .innerJoin(workflowStages, eq(workflowSteps.stageId, workflowStages.id))
      .innerJoin(workflows, eq(workflowStages.workflowId, workflows.id))
      .where(eq(workflowTasks.id, data.taskId))
      .limit(1);

    if (taskVerification.length === 0) {
      throw new Error("Task not found");
    }

    if (taskVerification[0].organizationId !== data.organizationId) {
      throw new Error("Task and skill must belong to the same organization");
    }

    // Check for duplicate
    const existing = await db.query.taskSkillRequirements.findFirst({
      where: and(
        eq(taskSkillRequirements.taskId, data.taskId),
        eq(taskSkillRequirements.skillId, data.skillId)
      ),
    });

    if (existing) {
      throw new Error("This skill requirement already exists for this task");
    }

    const [requirement] = await db
      .insert(taskSkillRequirements)
      .values({
        taskId: data.taskId,
        skillId: data.skillId,
        requiredLevel: data.requiredLevel || "intermediate",
        importance: data.importance || "required",
      })
      .returning();

    return requirement;
  }

  /**
   * Update a task skill requirement
   * SECURITY: Verifies organization ownership via skill
   */
  static async updateTaskSkillRequirement(
    requirementId: string,
    organizationId: string,
    updates: {
      requiredLevel?: string;
      importance?: string;
    }
  ) {
    // SECURITY: Fetch requirement with skill to verify organization
    const existing = await db.query.taskSkillRequirements.findFirst({
      where: eq(taskSkillRequirements.id, requirementId),
      with: {
        skill: true,
      },
    });

    if (!existing) {
      throw new Error("Task skill requirement not found");
    }

    // SECURITY: Verify skill belongs to organization
    if (existing.skill.organizationId !== organizationId) {
      throw new Error("Unauthorized: Skill belongs to different organization");
    }

    const [updated] = await db
      .update(taskSkillRequirements)
      .set({
        requiredLevel: updates.requiredLevel !== undefined ? updates.requiredLevel : existing.requiredLevel,
        importance: updates.importance !== undefined ? updates.importance : existing.importance,
      })
      .where(eq(taskSkillRequirements.id, requirementId))
      .returning();

    return updated;
  }

  /**
   * Remove a skill requirement from a task
   * SECURITY: Verifies organization ownership via skill
   */
  static async removeTaskSkillRequirement(requirementId: string, organizationId: string) {
    // SECURITY: Fetch requirement with skill to verify organization
    const existing = await db.query.taskSkillRequirements.findFirst({
      where: eq(taskSkillRequirements.id, requirementId),
      with: {
        skill: true,
      },
    });

    if (!existing) {
      throw new Error("Task skill requirement not found");
    }

    // SECURITY: Verify skill belongs to organization
    if (existing.skill.organizationId !== organizationId) {
      throw new Error("Unauthorized: Skill belongs to different organization");
    }

    const [deleted] = await db
      .delete(taskSkillRequirements)
      .where(eq(taskSkillRequirements.id, requirementId))
      .returning();

    return deleted;
  }

  /**
   * Get all skill requirements for a task
   * SECURITY: Verifies task belongs to organization
   */
  static async getTaskSkillRequirements(taskId: string, organizationId: string) {
    // SECURITY: Verify task belongs to organization via workflow hierarchy
    const taskVerification = await db
      .select({
        taskId: workflowTasks.id,
        organizationId: workflows.organizationId,
      })
      .from(workflowTasks)
      .innerJoin(workflowSteps, eq(workflowTasks.stepId, workflowSteps.id))
      .innerJoin(workflowStages, eq(workflowSteps.stageId, workflowStages.id))
      .innerJoin(workflows, eq(workflowStages.workflowId, workflows.id))
      .where(eq(workflowTasks.id, taskId))
      .limit(1);

    if (taskVerification.length === 0) {
      throw new Error("Task not found");
    }

    if (taskVerification[0].organizationId !== organizationId) {
      throw new Error("Unauthorized: Task belongs to different organization");
    }

    return await db.query.taskSkillRequirements.findMany({
      where: eq(taskSkillRequirements.taskId, taskId),
      with: {
        skill: true,
      },
    });
  }

  // ==================== SKILL MATCHING ENGINE ====================

  /**
   * Find users who match the skill requirements for a task
   * Returns ranked list based on proficiency match
   * SECURITY: Verifies task belongs to organization
   */
  static async findMatchingUsers(taskId: string, organizationId: string): Promise<SkillMatch[]> {
    // SECURITY: Verify task belongs to organization via workflow hierarchy
    const taskVerification = await db
      .select({
        taskId: workflowTasks.id,
        organizationId: workflows.organizationId,
      })
      .from(workflowTasks)
      .innerJoin(workflowSteps, eq(workflowTasks.stepId, workflowSteps.id))
      .innerJoin(workflowStages, eq(workflowSteps.stageId, workflowStages.id))
      .innerJoin(workflows, eq(workflowStages.workflowId, workflows.id))
      .where(eq(workflowTasks.id, taskId))
      .limit(1);

    if (taskVerification.length === 0) {
      throw new Error("Task not found");
    }

    if (taskVerification[0].organizationId !== organizationId) {
      throw new Error("Unauthorized: Task belongs to different organization");
    }

    // Get task skill requirements
    const requirements = await db.query.taskSkillRequirements.findMany({
      where: eq(taskSkillRequirements.taskId, taskId),
      with: {
        skill: true,
      },
    });

    if (requirements.length === 0) {
      return [];
    }

    const skillIds = requirements.map(r => r.skillId);

    // Get all users in organization with their skills
    const orgUsers = await db.query.users.findMany({
      where: and(
        or(
          eq(users.organizationId, organizationId),
          eq(users.defaultOrganizationId, organizationId)
        ),
        eq(users.isActive, true)
      ),
      with: {
        userSkills: {
          where: inArray(userSkills.skillId, skillIds),
          with: {
            skill: true,
          },
        },
      },
    });

    const proficiencyLevels = {
      beginner: 1,
      intermediate: 2,
      advanced: 3,
      expert: 4,
    };

    const matches: SkillMatch[] = [];

    for (const user of orgUsers) {
      const userSkillMap = new Map(user.userSkills.map(us => [us.skillId, us]));
      
      let matchScore = 0;
      const matchedSkills: SkillMatch["matchedSkills"] = [];
      const missingSkills: SkillMatch["missingSkills"] = [];

      for (const requirement of requirements) {
        const userSkill = userSkillMap.get(requirement.skillId);
        
        if (userSkill) {
          const userLevel = proficiencyLevels[userSkill.proficiencyLevel as keyof typeof proficiencyLevels] || 0;
          const requiredLevel = proficiencyLevels[requirement.requiredLevel as keyof typeof proficiencyLevels] || 0;
          const meetsRequirement = userLevel >= requiredLevel;

          // Calculate skill match score
          let skillScore = 0;
          if (meetsRequirement) {
            // Base score for meeting requirement
            skillScore = 10;
            // Bonus for exceeding requirement
            skillScore += (userLevel - requiredLevel) * 5;
            // Bonus for years of experience
            if (userSkill.yearsExperience) {
              skillScore += Math.min(userSkill.yearsExperience, 10);
            }
            // Bonus for certifications
            if (userSkill.certifications && userSkill.certifications.length > 0) {
              skillScore += userSkill.certifications.length * 3;
            }
            // Bonus for endorsements
            if (userSkill.endorsements) {
              skillScore += Math.min(userSkill.endorsements, 5);
            }
          } else {
            // Partial credit if below requirement
            skillScore = userLevel * 3;
          }

          // Weight by importance
          if (requirement.importance === "required") {
            skillScore *= 2;
          } else if (requirement.importance === "preferred") {
            skillScore *= 1.5;
          }

          matchScore += skillScore;

          matchedSkills.push({
            skillId: requirement.skillId,
            skillName: requirement.skill.name,
            userProficiency: userSkill.proficiencyLevel,
            requiredProficiency: requirement.requiredLevel || "intermediate",
            importance: requirement.importance || "required",
            meetsRequirement,
          });
        } else {
          // Missing skill - deduct points for required skills
          if (requirement.importance === "required") {
            matchScore -= 20;
          } else if (requirement.importance === "preferred") {
            matchScore -= 10;
          }

          missingSkills.push({
            skillId: requirement.skillId,
            skillName: requirement.skill.name,
            requiredProficiency: requirement.requiredLevel || "intermediate",
            importance: requirement.importance || "required",
          });
        }
      }

      // Only include users with positive match scores
      if (matchScore > 0 || matchedSkills.length > 0) {
        matches.push({
          userId: user.id,
          matchScore: Math.max(0, matchScore),
          matchedSkills,
          missingSkills,
        });
      }
    }

    // Sort by match score descending
    return matches.sort((a, b) => b.matchScore - a.matchScore);
  }

  /**
   * Get skill statistics for an organization
   */
  static async getOrganizationSkillStats(organizationId: string) {
    const orgSkills = await db.query.skills.findMany({
      where: eq(skills.organizationId, organizationId),
      with: {
        userSkills: {
          with: {
            user: {
              columns: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        taskSkillRequirements: true,
      },
    });

    return orgSkills.map(skill => ({
      skill: {
        id: skill.id,
        name: skill.name,
        category: skill.category,
      },
      userCount: skill.userSkills.length,
      taskCount: skill.taskSkillRequirements.length,
      proficiencyDistribution: {
        beginner: skill.userSkills.filter(us => us.proficiencyLevel === "beginner").length,
        intermediate: skill.userSkills.filter(us => us.proficiencyLevel === "intermediate").length,
        advanced: skill.userSkills.filter(us => us.proficiencyLevel === "advanced").length,
        expert: skill.userSkills.filter(us => us.proficiencyLevel === "expert").length,
      },
    }));
  }
}
