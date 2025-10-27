import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, Save, Play, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WorkflowCanvas } from '@/components/workflow-canvas';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { Workflow, WorkflowNode, WorkflowEdge, InstalledAgentView } from '@shared/schema';
import type { Node, Edge } from '@xyflow/react';

export default function WorkflowBuilder() {
  const { id } = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('custom');
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [edges, setEdges] = useState<WorkflowEdge[]>([]);

  const isEditMode = Boolean(id);

  // Fetch existing workflow if in edit mode
  const { data: workflow, isLoading } = useQuery<Workflow>({
    queryKey: ['/api/workflows', id],
    enabled: isEditMode,
  });

  // Check if Cadence copilot is installed
  const { data: installedAgents = [] } = useQuery<InstalledAgentView[]>({
    queryKey: ['/api/ai-agents/installed'],
  });

  const hasCadence = installedAgents.some((agent) => agent.agent?.name === 'Cadence');

  useEffect(() => {
    if (workflow) {
      setName(workflow.name);
      setDescription(workflow.description || '');
      setCategory(workflow.category);
      setNodes(workflow.nodes as WorkflowNode[]);
      setEdges(workflow.edges as WorkflowEdge[]);
    }
  }, [workflow]);

  // Save workflow mutation
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (isEditMode) {
        return apiRequest(`/api/workflows/${id}`, 'PATCH', data);
      } else {
        return apiRequest('/api/workflows', 'POST', data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workflows'] });
      toast({
        title: 'Success',
        description: isEditMode ? 'Workflow updated successfully' : 'Workflow created successfully',
      });
      navigate('/workflows');
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save workflow',
        variant: 'destructive',
      });
    },
  });

  const handleSave = (updatedNodes: Node[], updatedEdges: Edge[]) => {
    if (!name.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a workflow name',
        variant: 'destructive',
      });
      return;
    }

    // Convert React Flow nodes/edges to our schema format
    const workflowNodes: WorkflowNode[] = updatedNodes.map((node) => ({
      id: node.id,
      type: node.data.type,
      position: node.position,
      data: node.data,
    }));

    const workflowEdges: WorkflowEdge[] = updatedEdges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      label: edge.label,
    }));

    saveMutation.mutate({
      name,
      description,
      category,
      nodes: workflowNodes,
      edges: workflowEdges,
      status: 'draft',
    });
  };

  const handlePublish = (updatedNodes: Node[], updatedEdges: Edge[]) => {
    if (!name.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a workflow name',
        variant: 'destructive',
      });
      return;
    }

    const workflowNodes: WorkflowNode[] = updatedNodes.map((node) => ({
      id: node.id,
      type: node.data.type,
      position: node.position,
      data: node.data,
    }));

    const workflowEdges: WorkflowEdge[] = updatedEdges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      label: edge.label,
    }));

    saveMutation.mutate({
      name,
      description,
      category,
      nodes: workflowNodes,
      edges: workflowEdges,
      status: 'published',
    });
  };

  if (isLoading && isEditMode) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading workflow...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b p-4 bg-background">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/workflows')}
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">
                  {isEditMode ? 'Edit Workflow' : 'Create Workflow'}
                </h1>
                {hasCadence && (
                  <Badge variant="secondary" className="gap-1" data-testid="badge-cadence-copilot">
                    <Sparkles className="h-3 w-3" />
                    Cadence AI
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Design your automation workflow visually
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleSave(
                nodes.map(n => ({ ...n, type: 'workflowNode' } as Node)),
                edges as Edge[]
              )}
              disabled={saveMutation.isPending}
              data-testid="button-save-draft"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Draft
            </Button>
            <Button
              onClick={() => handlePublish(
                nodes.map(n => ({ ...n, type: 'workflowNode' } as Node)),
                edges as Edge[]
              )}
              disabled={saveMutation.isPending}
              data-testid="button-publish-workflow"
            >
              <Play className="h-4 w-4 mr-2" />
              Publish
            </Button>
          </div>
        </div>

        {/* Workflow Settings */}
        <div className="grid grid-cols-4 gap-4">
          <div className="col-span-2">
            <Label htmlFor="workflow-name">Workflow Name *</Label>
            <Input
              id="workflow-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Client Onboarding Flow"
              data-testid="input-workflow-name"
            />
          </div>

          <div>
            <Label htmlFor="workflow-category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="workflow-category" data-testid="select-workflow-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">Custom</SelectItem>
                <SelectItem value="tax">Tax</SelectItem>
                <SelectItem value="audit">Audit</SelectItem>
                <SelectItem value="bookkeeping">Bookkeeping</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="workflow-description">Description</Label>
            <Input
              id="workflow-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              data-testid="input-workflow-description"
            />
          </div>
        </div>
      </div>

      {/* Workflow Canvas */}
      <div className="flex-1 overflow-hidden">
        <WorkflowCanvas
          initialNodes={nodes}
          initialEdges={edges}
          onNodesChange={(updatedNodes) => {
            // Keep local state synchronized with canvas
            const workflowNodes: WorkflowNode[] = updatedNodes.map((node) => ({
              id: node.id,
              type: node.data.type,
              position: node.position,
              data: node.data,
            }));
            setNodes(workflowNodes);
          }}
          onEdgesChange={(updatedEdges) => {
            // Keep local state synchronized with canvas
            const workflowEdges: WorkflowEdge[] = updatedEdges.map((edge) => ({
              id: edge.id,
              source: edge.source,
              target: edge.target,
              sourceHandle: edge.sourceHandle,
              targetHandle: edge.targetHandle,
              label: edge.label,
            }));
            setEdges(workflowEdges);
          }}
          onSave={(updatedNodes, updatedEdges) => {
            handleSave(updatedNodes, updatedEdges);
          }}
        />
      </div>
    </div>
  );
}
