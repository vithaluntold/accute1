import { db } from "../db";
import { resourceAllocations, users, projects, workflowAssignments } from "@shared/schema";
import { eq, and, or, inArray, sql, gte, lte } from "drizzle-orm";

export interface AllocationConflict {
  userId: string;
  date: string;
  totalAllocation: number;
  allocations: Array<{
    id: string;
    projectId?: string;
    assignmentId?: string;
    percentage: number;
  }>;
}

export class ResourceAllocationService {
  /**
   * Create a new resource allocation with conflict detection
   * SECURITY: Validates organization ownership
   */
  static async createAllocation(data: {
    organizationId: string;
    userId: string;
    assignmentId?: string;
    projectId?: string;
    startDate: Date;
    endDate: Date;
    allocationPercentage: number;
    estimatedHoursPerWeek?: number;
    notes?: string;
    createdBy?: string;
  }) {
    // Validation: must have either assignmentId or projectId
    if (!data.assignmentId && !data.projectId) {
      throw new Error("Must specify either assignmentId or projectId");
    }

    // Validation: cannot have both assignmentId and projectId
    if (data.assignmentId && data.projectId) {
      throw new Error("Cannot specify both assignmentId and projectId");
    }

    // Validation: date range must be valid
    if (data.endDate <= data.startDate) {
      throw new Error("End date must be after start date");
    }

    // Validation: percentage must be 0-100
    if (data.allocationPercentage < 0 || data.allocationPercentage > 100) {
      throw new Error("Allocation percentage must be between 0 and 100");
    }

    // SECURITY: Verify user belongs to organization
    const user = await db.query.users.findFirst({
      where: and(
        eq(users.id, data.userId),
        or(
          eq(users.organizationId, data.organizationId),
          eq(users.defaultOrganizationId, data.organizationId)
        )
      ),
    });

    if (!user) {
      throw new Error("User not found in organization");
    }

    // SECURITY: Verify assignment/project belongs to organization
    if (data.assignmentId) {
      const assignment = await db.query.workflowAssignments.findFirst({
        where: and(
          eq(workflowAssignments.id, data.assignmentId),
          eq(workflowAssignments.organizationId, data.organizationId)
        ),
      });
      if (!assignment) {
        throw new Error("Assignment not found in organization");
      }
    }

    if (data.projectId) {
      const project = await db.query.projects.findFirst({
        where: and(
          eq(projects.id, data.projectId),
          eq(projects.organizationId, data.organizationId)
        ),
      });
      if (!project) {
        throw new Error("Project not found in organization");
      }
    }

    // Check for over-allocation
    const conflicts = await this.checkAllocationConflicts(
      data.userId,
      data.startDate,
      data.endDate,
      data.organizationId,
      data.allocationPercentage
    );

    if (conflicts.length > 0) {
      throw new Error(
        `User is over-allocated during this period. Max total: ${Math.max(
          ...conflicts.map(c => c.totalAllocation)
        )}%`
      );
    }

    // Create the allocation
    const [allocation] = await db
      .insert(resourceAllocations)
      .values({
        organizationId: data.organizationId,
        userId: data.userId,
        assignmentId: data.assignmentId,
        projectId: data.projectId,
        startDate: data.startDate,
        endDate: data.endDate,
        allocationPercentage: data.allocationPercentage,
        estimatedHoursPerWeek: data.estimatedHoursPerWeek
          ? data.estimatedHoursPerWeek.toString()
          : undefined,
        notes: data.notes,
        createdBy: data.createdBy,
      })
      .returning();

    return allocation;
  }

  /**
   * Update an existing resource allocation
   */
  static async updateAllocation(
    allocationId: string,
    organizationId: string,
    updates: {
      startDate?: Date;
      endDate?: Date;
      allocationPercentage?: number;
      estimatedHoursPerWeek?: number;
      notes?: string;
    }
  ) {
    // Fetch existing allocation
    const existing = await db.query.resourceAllocations.findFirst({
      where: and(
        eq(resourceAllocations.id, allocationId),
        eq(resourceAllocations.organizationId, organizationId)
      ),
    });

    if (!existing) {
      throw new Error("Allocation not found");
    }

    const startDate = updates.startDate || existing.startDate;
    const endDate = updates.endDate || existing.endDate;
    const allocationPercentage = updates.allocationPercentage ?? existing.allocationPercentage;

    // Validation: date range must be valid
    if (endDate <= startDate) {
      throw new Error("End date must be after start date");
    }

    // Validation: percentage must be 0-100
    if (allocationPercentage < 0 || allocationPercentage > 100) {
      throw new Error("Allocation percentage must be between 0 and 100");
    }

    // Check for over-allocation (excluding this allocation)
    const conflicts = await this.checkAllocationConflicts(
      existing.userId,
      startDate,
      endDate,
      organizationId,
      allocationPercentage,
      allocationId // Exclude this allocation from conflict check
    );

    if (conflicts.length > 0) {
      throw new Error(
        `User is over-allocated during this period. Max total: ${Math.max(
          ...conflicts.map(c => c.totalAllocation)
        )}%`
      );
    }

    // Update the allocation
    const [updated] = await db
      .update(resourceAllocations)
      .set({
        startDate,
        endDate,
        allocationPercentage,
        estimatedHoursPerWeek: updates.estimatedHoursPerWeek
          ? updates.estimatedHoursPerWeek.toString()
          : existing.estimatedHoursPerWeek,
        notes: updates.notes !== undefined ? updates.notes : existing.notes,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(resourceAllocations.id, allocationId),
          eq(resourceAllocations.organizationId, organizationId)
        )
      )
      .returning();

    return updated;
  }

  /**
   * Delete a resource allocation
   */
  static async deleteAllocation(allocationId: string, organizationId: string) {
    const [deleted] = await db
      .delete(resourceAllocations)
      .where(
        and(
          eq(resourceAllocations.id, allocationId),
          eq(resourceAllocations.organizationId, organizationId)
        )
      )
      .returning();

    if (!deleted) {
      throw new Error("Allocation not found");
    }

    return deleted;
  }

  /**
   * Get all allocations for a user
   */
  static async getUserAllocations(
    userId: string,
    organizationId: string,
    startDate?: Date,
    endDate?: Date
  ) {
    const conditions = [
      eq(resourceAllocations.userId, userId),
      eq(resourceAllocations.organizationId, organizationId),
    ];

    if (startDate) {
      conditions.push(gte(resourceAllocations.endDate, startDate));
    }

    if (endDate) {
      conditions.push(lte(resourceAllocations.startDate, endDate));
    }

    return await db.query.resourceAllocations.findMany({
      where: and(...conditions),
      orderBy: (allocations, { asc }) => [asc(allocations.startDate)],
    });
  }

  /**
   * Get all allocations for a project
   */
  static async getProjectAllocations(projectId: string, organizationId: string) {
    return await db.query.resourceAllocations.findMany({
      where: and(
        eq(resourceAllocations.projectId, projectId),
        eq(resourceAllocations.organizationId, organizationId)
      ),
      with: {
        user: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: (allocations, { asc }) => [asc(allocations.startDate)],
    });
  }

  /**
   * Get all allocations for an assignment
   */
  static async getAssignmentAllocations(assignmentId: string, organizationId: string) {
    return await db.query.resourceAllocations.findMany({
      where: and(
        eq(resourceAllocations.assignmentId, assignmentId),
        eq(resourceAllocations.organizationId, organizationId)
      ),
      with: {
        user: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: (allocations, { asc }) => [asc(allocations.startDate)],
    });
  }

  /**
   * Check for allocation conflicts - returns dates where user is over-allocated
   * Excludes a specific allocation ID if provided (for update scenarios)
   */
  static async checkAllocationConflicts(
    userId: string,
    startDate: Date,
    endDate: Date,
    organizationId: string,
    newAllocationPercentage: number,
    excludeAllocationId?: string
  ): Promise<AllocationConflict[]> {
    // Get all overlapping allocations for this user
    // Date ranges overlap if: startDate <= endDate AND endDate >= startDate
    const conditions = [
      eq(resourceAllocations.userId, userId),
      eq(resourceAllocations.organizationId, organizationId),
      lte(resourceAllocations.startDate, endDate),
      gte(resourceAllocations.endDate, startDate),
    ];

    if (excludeAllocationId) {
      conditions.push(sql`${resourceAllocations.id} != ${excludeAllocationId}`);
    }

    const overlapping = await db.query.resourceAllocations.findMany({
      where: and(...conditions),
    });

    // Calculate total allocation for each day in the range
    const conflicts: AllocationConflict[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      let totalAllocation = newAllocationPercentage;
      const dayAllocations: AllocationConflict["allocations"] = [];

      for (const allocation of overlapping) {
        if (allocation.startDate <= currentDate && allocation.endDate >= currentDate) {
          totalAllocation += allocation.allocationPercentage;
          dayAllocations.push({
            id: allocation.id,
            projectId: allocation.projectId || undefined,
            assignmentId: allocation.assignmentId || undefined,
            percentage: allocation.allocationPercentage,
          });
        }
      }

      if (totalAllocation > 100) {
        conflicts.push({
          userId,
          date: currentDate.toISOString().split("T")[0],
          totalAllocation,
          allocations: dayAllocations,
        });
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return conflicts;
  }

  /**
   * Get user utilization summary for a date range
   */
  static async getUserUtilization(
    userId: string,
    organizationId: string,
    startDate: Date,
    endDate: Date
  ) {
    const allocations = await this.getUserAllocations(userId, organizationId, startDate, endDate);

    const dailyUtilization = new Map<string, number>();
    
    for (const allocation of allocations) {
      const currentDate = new Date(Math.max(allocation.startDate.getTime(), startDate.getTime()));
      const allocationEndDate = new Date(Math.min(allocation.endDate.getTime(), endDate.getTime()));

      while (currentDate <= allocationEndDate) {
        const dateKey = currentDate.toISOString().split("T")[0];
        const current = dailyUtilization.get(dateKey) || 0;
        dailyUtilization.set(dateKey, current + allocation.allocationPercentage);
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    const utilizationArray = Array.from(dailyUtilization.entries()).map(([date, percentage]) => ({
      date,
      percentage,
      isOverAllocated: percentage > 100,
    }));

    const avgUtilization =
      utilizationArray.length > 0
        ? utilizationArray.reduce((sum, day) => sum + day.percentage, 0) / utilizationArray.length
        : 0;

    const maxUtilization = Math.max(...utilizationArray.map(d => d.percentage), 0);

    return {
      userId,
      startDate,
      endDate,
      dailyUtilization: utilizationArray,
      avgUtilization: Math.round(avgUtilization * 10) / 10,
      maxUtilization,
      hasOverAllocation: maxUtilization > 100,
    };
  }

  /**
   * Get organization-wide utilization summary
   */
  static async getOrganizationUtilization(
    organizationId: string,
    startDate: Date,
    endDate: Date
  ) {
    const allAllocations = await db.query.resourceAllocations.findMany({
      where: and(
        eq(resourceAllocations.organizationId, organizationId),
        lte(resourceAllocations.startDate, endDate),
        gte(resourceAllocations.endDate, startDate)
      ),
      with: {
        user: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    const userUtilization = new Map<string, { user: any; allocations: typeof allAllocations }>();

    for (const allocation of allAllocations) {
      const userId = allocation.userId;
      if (!userUtilization.has(userId)) {
        userUtilization.set(userId, {
          user: allocation.user,
          allocations: [],
        });
      }
      userUtilization.get(userId)!.allocations.push(allocation);
    }

    const userSummaries = await Promise.all(
      Array.from(userUtilization.entries()).map(async ([userId, data]) => {
        const utilization = await this.getUserUtilization(
          userId,
          organizationId,
          startDate,
          endDate
        );
        return {
          user: data.user,
          ...utilization,
        };
      })
    );

    return userSummaries;
  }

  /**
   * Get utilization summary with allocation IDs for UI operations
   */
  static async getUtilizationSummary(organizationId: string) {
    // Fetch all allocations with project details
    const allocations = await db.query.resourceAllocations.findMany({
      where: eq(resourceAllocations.organizationId, organizationId),
      with: {
        user: {
          columns: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        project: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: (allocations, { asc }) => [asc(allocations.userId), asc(allocations.projectId)],
    });

    // Group by user
    const userMap = new Map<string, {
      userId: string;
      userName: string;
      totalAllocation: number;
      allocations: {
        id: string;
        projectId: string;
        projectName: string;
        percentAllocation: number;
        startDate: string | null;
        endDate: string | null;
      }[];
    }>();

    for (const allocation of allocations) {
      const userId = allocation.userId;
      const userName = allocation.user.firstName && allocation.user.lastName
        ? `${allocation.user.firstName} ${allocation.user.lastName}`
        : allocation.user.username;

      if (!userMap.has(userId)) {
        userMap.set(userId, {
          userId,
          userName,
          totalAllocation: 0,
          allocations: [],
        });
      }

      const userSummary = userMap.get(userId)!;
      userSummary.totalAllocation += allocation.allocationPercentage;
      userSummary.allocations.push({
        id: allocation.id,
        projectId: allocation.projectId || "",
        projectName: allocation.project?.name || "Unknown Project",
        percentAllocation: allocation.allocationPercentage,
        startDate: allocation.startDate ? allocation.startDate.toISOString().split("T")[0] : null,
        endDate: allocation.endDate ? allocation.endDate.toISOString().split("T")[0] : null,
      });
    }

    return Array.from(userMap.values());
  }
}
