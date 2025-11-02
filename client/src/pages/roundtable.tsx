import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Plus, Users, Calendar, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { RoundtableSession } from '@shared/schema';

export default function RoundtablePage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [objective, setObjective] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Fetch all sessions (we'll implement this endpoint)
  const { data: sessions, isLoading } = useQuery<RoundtableSession[]>({
    queryKey: ['/api/roundtable/sessions'],
  });

  const handleCreateSession = async () => {
    if (!objective.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter an objective',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    try {
      const response = await apiRequest('POST', '/api/roundtable/sessions', {
        objective,
        initialAgents: ['luca'], // Always start with Luca as PM
      });

      const session = await response.json();

      toast({
        title: 'Session Created',
        description: 'Your AI Roundtable session has been created',
      });

      setIsCreateDialogOpen(false);
      setObjective('');
      queryClient.invalidateQueries({ queryKey: ['/api/roundtable/sessions'] });
      
      // Navigate to the new session
      setLocation(`/roundtable/${session.id}`);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create session',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="roundtable-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-orbitron bg-gradient-to-r from-[#e5a660] to-[#d76082] bg-clip-text text-transparent">
            AI Roundtable
          </h1>
          <p className="text-muted-foreground mt-1">
            Collaborate with multiple AI agents to build complete solutions
          </p>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button size="lg" data-testid="button-create-session">
              <Plus className="mr-2 h-5 w-5" />
              New Roundtable
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create AI Roundtable Session</DialogTitle>
              <DialogDescription>
                Start a collaborative session where multiple AI agents work together to achieve your objective
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="objective">What do you want to build?</Label>
                <Textarea
                  id="objective"
                  placeholder="E.g., Create a client onboarding workflow with intake form and welcome email template"
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  rows={4}
                  data-testid="input-objective"
                />
              </div>

              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm font-medium mb-2">Available Agents:</p>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <div>• <strong>Luca</strong> - Project Manager (auto-added)</div>
                  <div>• <strong>Cadence</strong> - Workflow Builder</div>
                  <div>• <strong>Forma</strong> - Form Designer</div>
                  <div>• <strong>Parity</strong> - Legal Document Specialist</div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
                data-testid="button-cancel-create"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateSession}
                disabled={isCreating}
                data-testid="button-confirm-create"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Session
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Sessions Grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : sessions && sessions.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sessions.map((session) => (
            <Card
              key={session.id}
              className="hover-elevate cursor-pointer"
              onClick={() => setLocation(`/roundtable/${session.id}`)}
              data-testid={`card-session-${session.id}`}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg line-clamp-2">
                    {session.objective || 'Untitled Session'}
                  </CardTitle>
                  <Badge
                    variant={
                      session.status === 'active'
                        ? 'default'
                        : session.status === 'completed'
                        ? 'secondary'
                        : 'outline'
                    }
                  >
                    {session.status}
                  </Badge>
                </div>
                <CardDescription className="flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(session.createdAt).toLocaleDateString()}
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLocation(`/roundtable/${session.id}`);
                  }}
                  data-testid={`button-open-session-${session.id}`}
                >
                  <Users className="mr-2 h-4 w-4" />
                  Open Session
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Roundtable Sessions Yet</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
              Create your first AI Roundtable session to collaborate with multiple AI agents
              and build comprehensive solutions together.
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-first-session">
              <Plus className="mr-2 h-5 w-5" />
              Create Your First Roundtable
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
