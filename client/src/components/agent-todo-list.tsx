import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface TodoItem {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed";
}

interface AgentTodoListProps {
  todos: TodoItem[];
  title?: string;
}

export function AgentTodoList({ todos, title = "Build Progress" }: AgentTodoListProps) {
  if (todos.length === 0) return null;

  const completed = todos.filter(t => t.status === "completed").length;
  const total = todos.length;

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Badge variant="secondary" className="text-xs">
            {completed}/{total}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {todos.map((todo) => (
          <div
            key={todo.id}
            className="flex items-start gap-2 text-sm"
            data-testid={`todo-${todo.id}`}
          >
            {todo.status === "completed" ? (
              <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0 mt-0.5" />
            ) : todo.status === "in_progress" ? (
              <Loader2 className="h-4 w-4 text-primary flex-shrink-0 mt-0.5 animate-spin" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            )}
            <span
              className={
                todo.status === "completed"
                  ? "text-muted-foreground line-through"
                  : todo.status === "in_progress"
                  ? "text-foreground font-medium"
                  : "text-foreground"
              }
            >
              {todo.content}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
