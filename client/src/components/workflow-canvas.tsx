import { useCallback, useState, useEffect, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
  type ReactFlowInstance,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Play,
  GitBranch,
  Clock,
  Bell,
  CheckCircle,
  Repeat,
  Mail,
  Webhook,
  Calendar,
  FileUp,
  UserPlus,
  FileText,
} from 'lucide-react';
import type { WorkflowNode as WorkflowNodeType, WorkflowEdge, WorkflowNodeType as NodeType } from '@shared/schema';

// Custom node component for workflow nodes
function WorkflowNode({ data }: { data: any }) {
  const getNodeIcon = () => {
    switch (data.type) {
      case 'trigger':
        return <Play className="h-4 w-4" />;
      case 'condition':
        return <GitBranch className="h-4 w-4" />;
      case 'action':
        return <CheckCircle className="h-4 w-4" />;
      case 'delay':
        return <Clock className="h-4 w-4" />;
      case 'notification':
        return <Bell className="h-4 w-4" />;
      case 'loop':
        return <Repeat className="h-4 w-4" />;
      default:
        return <CheckCircle className="h-4 w-4" />;
    }
  };

  const getNodeColor = () => {
    switch (data.type) {
      case 'trigger':
        return 'bg-green-500/10 border-green-500';
      case 'condition':
        return 'bg-amber-500/10 border-amber-500';
      case 'action':
        return 'bg-blue-500/10 border-blue-500';
      case 'delay':
        return 'bg-purple-500/10 border-purple-500';
      case 'notification':
        return 'bg-pink-500/10 border-pink-500';
      case 'loop':
        return 'bg-cyan-500/10 border-cyan-500';
      default:
        return 'bg-gray-500/10 border-gray-500';
    }
  };

  return (
    <Card className={`p-4 min-w-[180px] border-2 ${getNodeColor()}`}>
      <div className="flex items-center gap-2 mb-2">
        {getNodeIcon()}
        <span className="font-medium text-sm">{data.label}</span>
      </div>
      {data.description && (
        <p className="text-xs text-muted-foreground">{data.description}</p>
      )}
    </Card>
  );
}

const nodeTypes: NodeTypes = {
  workflowNode: WorkflowNode,
};

interface NodePaletteItem {
  type: NodeType;
  label: string;
  description: string;
  icon: React.ReactNode;
  category: 'trigger' | 'action' | 'control';
}

const nodePalette: NodePaletteItem[] = [
  {
    type: 'trigger',
    label: 'Manual Trigger',
    description: 'Start workflow manually',
    icon: <Play className="h-5 w-5" />,
    category: 'trigger',
  },
  {
    type: 'trigger',
    label: 'Schedule',
    description: 'Run on a schedule',
    icon: <Calendar className="h-5 w-5" />,
    category: 'trigger',
  },
  {
    type: 'trigger',
    label: 'Document Upload',
    description: 'When document is uploaded',
    icon: <FileUp className="h-5 w-5" />,
    category: 'trigger',
  },
  {
    type: 'trigger',
    label: 'Client Created',
    description: 'When new client is added',
    icon: <UserPlus className="h-5 w-5" />,
    category: 'trigger',
  },
  {
    type: 'trigger',
    label: 'Form Submitted',
    description: 'When form is submitted',
    icon: <FileText className="h-5 w-5" />,
    category: 'trigger',
  },
  {
    type: 'trigger',
    label: 'Email Received',
    description: 'When email arrives',
    icon: <Mail className="h-5 w-5" />,
    category: 'trigger',
  },
  {
    type: 'trigger',
    label: 'Webhook',
    description: 'External webhook trigger',
    icon: <Webhook className="h-5 w-5" />,
    category: 'trigger',
  },
  {
    type: 'condition',
    label: 'Condition',
    description: 'If/else branching',
    icon: <GitBranch className="h-5 w-5" />,
    category: 'control',
  },
  {
    type: 'action',
    label: 'Send Email',
    description: 'Send email notification',
    icon: <Mail className="h-5 w-5" />,
    category: 'action',
  },
  {
    type: 'notification',
    label: 'Send Notification',
    description: 'In-app notification',
    icon: <Bell className="h-5 w-5" />,
    category: 'action',
  },
  {
    type: 'delay',
    label: 'Delay',
    description: 'Wait before continuing',
    icon: <Clock className="h-5 w-5" />,
    category: 'control',
  },
  {
    type: 'loop',
    label: 'Loop',
    description: 'Repeat actions',
    icon: <Repeat className="h-5 w-5" />,
    category: 'control',
  },
];

interface WorkflowCanvasProps {
  initialNodes?: WorkflowNodeType[];
  initialEdges?: WorkflowEdge[];
  initialViewport?: { x: number; y: number; zoom: number };
  onSave?: (nodes: Node[], edges: Edge[], viewport: { x: number; y: number; zoom: number }) => void;
  onNodesChange?: (nodes: Node[]) => void;
  onEdgesChange?: (edges: Edge[]) => void;
  readOnly?: boolean;
}

export function WorkflowCanvas({
  initialNodes = [],
  initialEdges = [],
  initialViewport = { x: 0, y: 0, zoom: 1 },
  onSave,
  onNodesChange: onNodesChangeProp,
  onEdgesChange: onEdgesChangeProp,
  readOnly = false,
}: WorkflowCanvasProps) {
  const reactFlowInstanceRef = useRef<ReactFlowInstance | null>(null);
  const [viewport, setViewport] = useState(initialViewport);
  const [nodes, setNodes, onNodesChangeInternal] = useNodesState(
    initialNodes.map((node) => ({
      ...node,
      type: 'workflowNode',
    }))
  );
  const [edges, setEdges, onEdgesChangeInternal] = useEdgesState(initialEdges as Edge[]);

  // Handle ReactFlow initialization
  const onInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowInstanceRef.current = instance;
    
    // Apply saved viewport if it's not the default
    if (initialViewport.x !== 0 || initialViewport.y !== 0 || initialViewport.zoom !== 1) {
      instance.setViewport(initialViewport);
    } else if (nodes.length > 0) {
      // If no viewport is saved and there are nodes, fit view once
      instance.fitView();
    }
  }, [initialViewport, nodes.length]);

  // Apply saved viewport when initialViewport changes (e.g., when switching tasks)
  useEffect(() => {
    const instance = reactFlowInstanceRef.current;
    if (instance && initialViewport) {
      if (initialViewport.x !== 0 || initialViewport.y !== 0 || initialViewport.zoom !== 1) {
        instance.setViewport(initialViewport);
      } else if (nodes.length > 0) {
        instance.fitView();
      }
    }
  }, [initialViewport, nodes.length]);

  // Wrap internal change handlers to notify parent
  const handleNodesChange = useCallback((changes: any) => {
    onNodesChangeInternal(changes);
  }, [onNodesChangeInternal]);

  const handleEdgesChange = useCallback((changes: any) => {
    onEdgesChangeInternal(changes);
  }, [onEdgesChangeInternal]);

  // Sync canvas state when initialNodes/initialEdges props change (including empty arrays for task switching)
  useEffect(() => {
    setNodes(initialNodes.map((node) => ({
      ...node,
      type: 'workflowNode',
    })));
  }, [initialNodes, setNodes]);

  useEffect(() => {
    setEdges(initialEdges as Edge[]);
  }, [initialEdges, setEdges]);

  // Sync local viewport state when initialViewport prop changes (for task switching)
  useEffect(() => {
    setViewport(initialViewport);
  }, [initialViewport]);

  // Notify parent when nodes or edges change
  useEffect(() => {
    if (onNodesChangeProp) {
      onNodesChangeProp(nodes);
    }
  }, [nodes, onNodesChangeProp]);

  useEffect(() => {
    if (onEdgesChangeProp) {
      onEdgesChangeProp(edges);
    }
  }, [edges, onEdgesChangeProp]);

  const [nodeIdCounter, setNodeIdCounter] = useState(() => {
    // Calculate next ID based on existing nodes
    if (initialNodes.length === 0) return 1;
    const maxId = Math.max(
      ...initialNodes.map((node) => {
        const match = node.id.match(/node-(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      })
    );
    return maxId + 1;
  });

  // Recalculate nodeIdCounter when initialNodes changes (for edit mode)
  useEffect(() => {
    if (initialNodes.length > 0) {
      const maxId = Math.max(
        ...initialNodes.map((node) => {
          const match = node.id.match(/node-(\d+)/);
          return match ? parseInt(match[1], 10) : 0;
        })
      );
      setNodeIdCounter(maxId + 1);
    }
  }, [initialNodes]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onDragStart = (event: React.DragEvent, nodeType: NodeType, label: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.setData('label', label);
    event.dataTransfer.effectAllowed = 'move';
  };

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow') as NodeType;
      const label = event.dataTransfer.getData('label');

      if (!type) return;

      const reactFlowBounds = event.currentTarget.getBoundingClientRect();
      const position = {
        x: event.clientX - reactFlowBounds.left - 100,
        y: event.clientY - reactFlowBounds.top - 50,
      };

      const newNode: Node = {
        id: `node-${nodeIdCounter}`,
        type: 'workflowNode',
        position,
        data: {
          label,
          type,
          config: {},
        },
      };

      setNodes((nds) => nds.concat(newNode));
      setNodeIdCounter((id) => id + 1);
    },
    [nodeIdCounter, setNodes]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const handleSave = () => {
    if (onSave) {
      onSave(nodes, edges, viewport);
    }
  };

  const handleMove = useCallback((event: any, viewportData: { x: number; y: number; zoom: number }) => {
    setViewport(viewportData);
  }, []);

  return (
    <div className="flex h-full w-full gap-4">
      {/* Node Palette */}
      {!readOnly && (
        <Card className="w-64 p-4 flex-shrink-0">
          <h3 className="font-semibold mb-4">Workflow Nodes</h3>
          <ScrollArea className="h-[calc(100vh-200px)]">
            <div className="space-y-4">
              {/* Trigger Nodes */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                  Triggers
                </h4>
                <div className="space-y-2">
                  {nodePalette
                    .filter((item) => item.category === 'trigger')
                    .map((item, idx) => (
                      <div
                        key={idx}
                        draggable
                        onDragStart={(e) => onDragStart(e, item.type, item.label)}
                        className="p-3 border rounded-lg cursor-move hover-elevate active-elevate-2"
                        data-testid={`node-palette-${item.label.toLowerCase().replace(' ', '-')}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {item.icon}
                          <span className="font-medium text-sm">{item.label}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {item.description}
                        </p>
                      </div>
                    ))}
                </div>
              </div>

              {/* Action Nodes */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                  Actions
                </h4>
                <div className="space-y-2">
                  {nodePalette
                    .filter((item) => item.category === 'action')
                    .map((item, idx) => (
                      <div
                        key={idx}
                        draggable
                        onDragStart={(e) => onDragStart(e, item.type, item.label)}
                        className="p-3 border rounded-lg cursor-move hover-elevate active-elevate-2"
                        data-testid={`node-palette-${item.label.toLowerCase().replace(' ', '-')}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {item.icon}
                          <span className="font-medium text-sm">{item.label}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {item.description}
                        </p>
                      </div>
                    ))}
                </div>
              </div>

              {/* Control Flow Nodes */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                  Control Flow
                </h4>
                <div className="space-y-2">
                  {nodePalette
                    .filter((item) => item.category === 'control')
                    .map((item, idx) => (
                      <div
                        key={idx}
                        draggable
                        onDragStart={(e) => onDragStart(e, item.type, item.label)}
                        className="p-3 border rounded-lg cursor-move hover-elevate active-elevate-2"
                        data-testid={`node-palette-${item.label.toLowerCase().replace(' ', '-')}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {item.icon}
                          <span className="font-medium text-sm">{item.label}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {item.description}
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </ScrollArea>
        </Card>
      )}

      {/* React Flow Canvas */}
      <div className="flex-1 border rounded-lg overflow-hidden bg-background">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onMove={handleMove}
          onInit={onInit}
          nodeTypes={nodeTypes}
          data-testid="workflow-canvas"
        >
          <Background />
          <Controls />
          <MiniMap />
          
          {/* Save Button Panel */}
          {!readOnly && (
            <Panel position="top-right">
              <Button
                onClick={handleSave}
                data-testid="button-save-workflow"
              >
                Save Workflow
              </Button>
            </Panel>
          )}
        </ReactFlow>
      </div>
    </div>
  );
}
