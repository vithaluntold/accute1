import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, XCircle, TrendingUp, Award, Star } from "lucide-react";

interface SkillMatch {
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

interface User {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
}

interface SkillBasedAssigneeSelectorProps {
  taskId: string | null; // Null if creating new task (no skill requirements yet)
  users: User[]; // All available users
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  dataTestId?: string;
  initialMatches?: SkillMatch[]; // Preloaded skill matches from API
}

export function SkillBasedAssigneeSelector({
  taskId,
  users,
  value,
  onValueChange,
  placeholder = "Select assignee",
  disabled = false,
  className,
  dataTestId = "select-assignee",
  initialMatches = [],
}: SkillBasedAssigneeSelectorProps) {
  // Fetch skill matches with preloaded initialData for immediate visibility
  const { data: matches = [], isLoading: matchesLoading, isFetching } = useQuery<SkillMatch[]>({
    queryKey: ["/api/tasks", taskId, "matches"],
    queryFn: async () => {
      if (!taskId) return [];
      const response = await fetch(`/api/tasks/${taskId}/matches`);
      if (!response.ok) throw new Error("Failed to fetch skill matches");
      return response.json();
    },
    initialData: initialMatches, // Use preloaded data for immediate display
    enabled: !!taskId, // Only fetch if taskId exists
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  // Create a map of userId -> SkillMatch for quick lookup
  const matchMap = new Map(matches.map(m => [m.userId, m]));

  // Sort users: matched users first (by score), then others alphabetically
  const sortedUsers = [...users].sort((a, b) => {
    const matchA = matchMap.get(a.id);
    const matchB = matchMap.get(b.id);

    // Both have matches - sort by score
    if (matchA && matchB) {
      return matchB.matchScore - matchA.matchScore;
    }

    // Only A has match
    if (matchA) return -1;

    // Only B has match
    if (matchB) return 1;

    // Neither has match - sort alphabetically
    const nameA = a.firstName && a.lastName ? `${a.firstName} ${a.lastName}` : a.username;
    const nameB = b.firstName && b.lastName ? `${b.firstName} ${b.lastName}` : b.username;
    return nameA.localeCompare(nameB);
  });

  const getUserName = (user: User) => {
    return user.firstName && user.lastName 
      ? `${user.firstName} ${user.lastName}` 
      : user.username;
  };

  // Show loading UI while fetching matches
  if (matchesLoading && taskId) {
    return (
      <div className="space-y-2">
        <div className="text-sm text-muted-foreground mb-2">
          Loading skill-based recommendations...
        </div>
        <Card className="p-3 space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {taskId && matches.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground font-medium">
            <TrendingUp className="w-3 h-3 inline mr-1" />
            Ranked by Skill Match
          </div>
          {isFetching && !matchesLoading && (
            <Badge variant="secondary" className="text-xs">
              Refreshing...
            </Badge>
          )}
        </div>
      )}

      <Select 
        value={value} 
        onValueChange={onValueChange} 
        disabled={disabled}
      >
        <SelectTrigger className={className} data-testid={dataTestId}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="unassigned" data-testid="option-assignee-unassigned">
            Unassigned
          </SelectItem>

          {sortedUsers.map((user) => {
            const match = matchMap.get(user.id);
            const userName = getUserName(user);
            
            // Build display text with match score (no emojis)
            let displayText = userName;
            if (match) {
              const score = match.matchScore;
              let matchLabel = "";
              if (score >= 80) matchLabel = "Excellent Match";
              else if (score >= 50) matchLabel = "Good Match";
              else if (score >= 20) matchLabel = "Partial Match";
              else matchLabel = "Low Match";
              
              displayText = `${userName} - ${matchLabel} (${score}%)`;
            }

            return (
              <SelectItem 
                key={user.id} 
                value={user.id}
                data-testid={`option-assignee-${user.id}`}
              >
                {displayText}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      {/* Show match details for selected user */}
      {taskId && value && value !== "unassigned" && matchMap.has(value) && (
        <Card className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Skill Match Details</h4>
            <Badge variant="outline">
              Score: {matchMap.get(value)!.matchScore}
            </Badge>
          </div>

          {matchMap.get(value)!.matchedSkills.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Matched Skills:</p>
              <div className="flex flex-wrap gap-1">
                {matchMap.get(value)!.matchedSkills.map((skill) => (
                  <Badge
                    key={skill.skillId}
                    variant={skill.meetsRequirement ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {skill.meetsRequirement ? (
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                    ) : (
                      <TrendingUp className="w-3 h-3 mr-1" />
                    )}
                    {skill.skillName}
                    {!skill.meetsRequirement && (
                      <span className="ml-1 text-muted-foreground">
                        ({skill.userProficiency} / {skill.requiredProficiency})
                      </span>
                    )}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {matchMap.get(value)!.missingSkills.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Missing Skills:</p>
              <div className="flex flex-wrap gap-1">
                {matchMap.get(value)!.missingSkills.map((skill) => (
                  <Badge key={skill.skillId} variant="destructive" className="text-xs">
                    <XCircle className="w-3 h-3 mr-1" />
                    {skill.skillName}
                    <span className="ml-1">
                      (needs {skill.requiredProficiency})
                    </span>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
