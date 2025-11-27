import { useCallback, useEffect, useMemo, useRef, useReducer } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  addEdge,
  Connection,
  Controls,
  Background,
  BackgroundVariant,
  Handle,
  Position,
  NodeChange,
  applyNodeChanges,
  EdgeChange,
  applyEdgeChanges,
  MiniMap,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, GitBranch, Tag, Filter, Layers, MousePointer2, HelpCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ConditionNodeData {
  id: string;
  field: string;
  operator: string;
  value: string;
}

const CONDITION_FIELDS = [
  { value: 'status', label: 'Status' },
  { value: 'assignee', label: 'Assignee' },
  { value: 'priority', label: 'Priority' },
  { value: 'amount', label: 'Amount' },
  { value: 'client_id', label: 'Client' },
  { value: 'due_date', label: 'Due Date' },
  { value: 'tags', label: 'Tags' },
  { value: 'client_tags', label: 'Client Tags' },
  { value: 'document_type', label: 'Document Type' },
  { value: 'client_type', label: 'Client Type' },
  { value: 'jurisdiction', label: 'Jurisdiction' },
  { value: 'entity_type', label: 'Entity Type' },
];

const OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'greater_than', label: 'Greater Than' },
  { value: 'less_than', label: 'Less Than' },
  { value: 'contains', label: 'Contains' },
  { value: 'starts_with', label: 'Starts With' },
  { value: 'contains_any', label: 'Contains Any (Tags)' },
  { value: 'contains_all', label: 'Contains All (Tags)' },
  { value: 'not_contains', label: 'Does Not Contain' },
  { value: 'is_empty', label: 'Is Empty' },
  { value: 'is_not_empty', label: 'Is Not Empty' },
  { value: 'in', label: 'In List' },
];

interface ConditionNodeProps {
  data: ConditionNodeData;
  onDelete: (id: string) => void;
  onChange: (id: string, updates: Partial<Omit<ConditionNodeData, 'id'>>) => void;
}

function ConditionNode({ data, onDelete, onChange }: ConditionNodeProps) {
  const isTagField = data.field.includes('tag');
  const fieldLabel = CONDITION_FIELDS.find(f => f.value === data.field)?.label || data.field;
  const operatorLabel = OPERATORS.find(o => o.value === data.operator)?.label || data.operator;
  
  return (
    <Card className="min-w-[320px] shadow-lg border-2 hover:border-primary/50 transition-colors" data-testid={`condition-node-${data.id}`}>
      <Handle 
        type="target" 
        position={Position.Top} 
        className="!bg-primary !w-3 !h-3 !border-2 !border-background"
      />
      <CardHeader className="p-3 pb-2 bg-muted/30">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-medium">Condition</CardTitle>
            {isTagField && (
              <Badge variant="secondary" className="text-xs">
                <Tag className="h-3 w-3 mr-1" />
                Tag
              </Badge>
            )}
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={() => onDelete(data.id)}
                  data-testid="button-delete-condition"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete condition</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-2 space-y-3">
        <div>
          <Label className="text-xs text-muted-foreground">Field</Label>
          <Select
            value={data.field}
            onValueChange={(value) => onChange(data.id, { field: value })}
          >
            <SelectTrigger className="h-8 mt-1" data-testid="select-condition-field">
              <SelectValue placeholder="Select field" />
            </SelectTrigger>
            <SelectContent>
              <div className="text-xs text-muted-foreground px-2 py-1">Basic Fields</div>
              {CONDITION_FIELDS.filter(f => !f.value.includes('tag') && !f.value.includes('type')).map((field) => (
                <SelectItem key={field.value} value={field.value}>
                  {field.label}
                </SelectItem>
              ))}
              <div className="text-xs text-muted-foreground px-2 py-1 border-t mt-1 pt-1">
                <Tag className="h-3 w-3 inline mr-1" />
                Tag Fields
              </div>
              {CONDITION_FIELDS.filter(f => f.value.includes('tag')).map((field) => (
                <SelectItem key={field.value} value={field.value}>
                  {field.label}
                </SelectItem>
              ))}
              <div className="text-xs text-muted-foreground px-2 py-1 border-t mt-1 pt-1">Type Fields</div>
              {CONDITION_FIELDS.filter(f => f.value.includes('type') && !f.value.includes('tag')).map((field) => (
                <SelectItem key={field.value} value={field.value}>
                  {field.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Operator</Label>
          <Select
            value={data.operator}
            onValueChange={(value) => onChange(data.id, { operator: value })}
          >
            <SelectTrigger className="h-8 mt-1" data-testid="select-condition-operator">
              <SelectValue placeholder="Select operator" />
            </SelectTrigger>
            <SelectContent>
              <div className="text-xs text-muted-foreground px-2 py-1">Comparison</div>
              {OPERATORS.filter(o => ['equals', 'not_equals', 'greater_than', 'less_than'].includes(o.value)).map((op) => (
                <SelectItem key={op.value} value={op.value}>
                  {op.label}
                </SelectItem>
              ))}
              <div className="text-xs text-muted-foreground px-2 py-1 border-t mt-1 pt-1">Text Matching</div>
              {OPERATORS.filter(o => ['contains', 'starts_with', 'not_contains'].includes(o.value)).map((op) => (
                <SelectItem key={op.value} value={op.value}>
                  {op.label}
                </SelectItem>
              ))}
              <div className="text-xs text-muted-foreground px-2 py-1 border-t mt-1 pt-1">
                <Tag className="h-3 w-3 inline mr-1" />
                Tag Operations
              </div>
              {OPERATORS.filter(o => ['contains_any', 'contains_all', 'in', 'is_empty', 'is_not_empty'].includes(o.value)).map((op) => (
                <SelectItem key={op.value} value={op.value}>
                  {op.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Value</Label>
          <Input
            className="h-8 mt-1"
            value={data.value}
            onChange={(e) => onChange(data.id, { value: e.target.value })}
            placeholder={isTagField ? "tag1, tag2, tag3" : "Enter value"}
            data-testid="input-condition-value"
          />
          {isTagField && (
            <p className="text-xs text-muted-foreground mt-1">
              Separate multiple tags with commas
            </p>
          )}
        </div>
        
        <div className="text-xs bg-muted/50 rounded p-2 mt-2">
          <span className="text-muted-foreground">Rule: </span>
          <span className="font-medium">{fieldLabel}</span>
          <span className="text-muted-foreground"> {operatorLabel.toLowerCase()} </span>
          <span className="font-medium">{data.value || '...'}</span>
        </div>
      </CardContent>
      <Handle 
        type="source" 
        position={Position.Bottom}
        className="!bg-primary !w-3 !h-3 !border-2 !border-background"
      />
    </Card>
  );
}

interface VisualTriggerBuilderProps {
  conditions: Array<{ id?: string; field: string; operator: string; value: string; x?: number; y?: number }>;
  conditionEdges?: Array<{ id?: string; source: string; target: string }>;
  onChange: (
    conditions: Array<{ id: string; field: string; operator: string; value: string; x: number; y: number }>,
    edges: Array<{ id: string; source: string; target: string }>
  ) => void;
}

function generateId(): string {
  return `cond-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// State managed by reducer
interface GraphState {
  nodes: Node[];
  edges: Edge[];
}

type GraphAction =
  | { type: 'HYDRATE'; conditions: any[]; edges: any[] }
  | { type: 'NODE_CHANGES'; changes: NodeChange[] }
  | { type: 'EDGE_CHANGES'; changes: EdgeChange[] }
  | { type: 'CONNECT'; connection: Connection }
  | { type: 'ADD_NODE' }
  | { type: 'DELETE_NODE'; id: string }
  | { type: 'UPDATE_NODE_DATA'; id: string; updates: any };

function graphReducer(state: GraphState, action: GraphAction): GraphState {
  switch (action.type) {
    case 'HYDRATE': {
      const { conditions, edges } = action;
      
      // Ensure conditions have stable IDs
      const withIds = conditions.map((c, idx) => ({
        ...c,
        id: c.id || generateId(),
        x: c.x ?? 250,
        y: c.y ?? idx * 180 + 50,
      }));

      const nodes: Node[] = withIds.map((c) => ({
        id: c.id,
        type: 'condition',
        position: { x: c.x, y: c.y },
        data: { id: c.id, field: c.field, operator: c.operator, value: c.value } as ConditionNodeData,
      }));

      const edgesWithIds = edges.map((e: any) => ({
        id: e.id || generateId(),
        source: e.source,
        target: e.target,
      }));

      return { nodes, edges: edgesWithIds };
    }

    case 'NODE_CHANGES':
      return { ...state, nodes: applyNodeChanges(action.changes, state.nodes) };

    case 'EDGE_CHANGES':
      return { ...state, edges: applyEdgeChanges(action.changes, state.edges) };

    case 'CONNECT':
      return { ...state, edges: addEdge({ ...action.connection, id: generateId() }, state.edges) };

    case 'ADD_NODE': {
      const id = generateId();
      return {
        ...state,
        nodes: [...state.nodes, {
          id,
          type: 'condition',
          position: { x: 250, y: state.nodes.length * 180 + 50 },
          data: { id, field: 'status', operator: 'equals', value: '' } as ConditionNodeData,
        }],
      };
    }

    case 'DELETE_NODE':
      return {
        nodes: state.nodes.filter(n => n.id !== action.id),
        edges: state.edges.filter(e => e.source !== action.id && e.target !== action.id),
      };

    case 'UPDATE_NODE_DATA':
      return {
        ...state,
        nodes: state.nodes.map(n =>
          n.id === action.id ? { ...n, data: { ...n.data, ...action.updates } } : n
        ),
      };

    default:
      return state;
  }
}

export function VisualTriggerBuilder({ conditions, conditionEdges = [], onChange }: VisualTriggerBuilderProps) {
  const [state, dispatch] = useReducer(graphReducer, { nodes: [], edges: [] });
  const prevSnapshotRef = useRef('');
  const isHydratingRef = useRef(false);

  // Synchronous emit to parent
  const emitToParent = useCallback((newState: GraphState) => {
    const updatedConditions = newState.nodes.map((n) => {
      const data = n.data as ConditionNodeData;
      return {
        id: data.id,
        field: data.field,
        operator: data.operator,
        value: data.value,
        x: n.position.x,
        y: n.position.y,
      };
    });
    const updatedEdges = newState.edges.map(e => ({ id: e.id, source: e.source, target: e.target }));
    onChange(updatedConditions, updatedEdges);
  }, [onChange]);

  // Helper to compute new state and emit to parent in one step
  const dispatchAndEmit = useCallback((action: GraphAction) => {
    const newState = graphReducer(stateRef.current, action);
    dispatch(action);
    stateRef.current = newState;
    emitToParent(newState);
  }, [emitToParent]);

  // Track state ref for dispatchAndEmit
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Hydrate from props
  useEffect(() => {
    const snapshot = JSON.stringify({ conditions, conditionEdges });
    if (snapshot !== prevSnapshotRef.current) {
      isHydratingRef.current = true;
      
      const action: GraphAction = { type: 'HYDRATE', conditions, edges: conditionEdges };
      const newState = graphReducer(stateRef.current, action);
      dispatch(action);
      stateRef.current = newState;
      prevSnapshotRef.current = snapshot;
      
      // Persist IDs if generated
      if (conditions.some(c => !c.id) || conditionEdges.some((e: any) => !e.id)) {
        emitToParent(newState);
      }
      
      isHydratingRef.current = false;
    }
  }, [JSON.stringify({ conditions, conditionEdges }), emitToParent]);

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    if (isHydratingRef.current) return;
    dispatchAndEmit({ type: 'NODE_CHANGES', changes });
  }, [dispatchAndEmit]);

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    if (isHydratingRef.current) return;
    dispatchAndEmit({ type: 'EDGE_CHANGES', changes });
  }, [dispatchAndEmit]);

  const handleConnect = useCallback((connection: Connection) => {
    if (isHydratingRef.current) return;
    dispatchAndEmit({ type: 'CONNECT', connection });
  }, [dispatchAndEmit]);

  const handleAddNode = useCallback(() => {
    dispatchAndEmit({ type: 'ADD_NODE' });
  }, [dispatchAndEmit]);

  const handleDeleteNode = useCallback((id: string) => {
    dispatchAndEmit({ type: 'DELETE_NODE', id });
  }, [dispatchAndEmit]);

  const handleNodeDataChange = useCallback((id: string, updates: any) => {
    dispatchAndEmit({ type: 'UPDATE_NODE_DATA', id, updates });
  }, [dispatchAndEmit]);

  const wrappedNodeTypes = useMemo(() => ({
    condition: (props: any) => (
      <ConditionNode {...props} onDelete={handleDeleteNode} onChange={handleNodeDataChange} />
    ),
  }), [handleDeleteNode, handleNodeDataChange]);

  const hasConditions = state.nodes.length > 0;
  const hasConnections = state.edges.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-medium">Visual Condition Builder</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Build complex conditions with AND/OR logic. Connect nodes to create conditional flows.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-8 w-8"
                >
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs">
                <div className="space-y-2 text-xs">
                  <p><strong>Tips:</strong></p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Drag nodes to reposition them</li>
                    <li>Connect nodes by dragging from bottom handle to top handle</li>
                    <li>Connected nodes create AND logic</li>
                    <li>Use tag fields for dynamic filtering</li>
                  </ul>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button onClick={handleAddNode} size="sm" data-testid="button-add-condition">
            <Plus className="h-3 w-3 mr-1" />
            Add Condition
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <Badge variant={hasConditions ? "default" : "outline"} className="gap-1">
          <Layers className="h-3 w-3" />
          {state.nodes.length} condition{state.nodes.length !== 1 ? 's' : ''}
        </Badge>
        <Badge variant={hasConnections ? "default" : "outline"} className="gap-1">
          <GitBranch className="h-3 w-3" />
          {state.edges.length} connection{state.edges.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      <div className="h-[450px] border rounded-lg bg-muted/20 relative overflow-hidden">
        {!hasConditions && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <Card className="p-6 text-center bg-background/95 pointer-events-auto shadow-lg">
              <Filter className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <h4 className="font-medium mb-2">No Conditions Yet</h4>
              <p className="text-sm text-muted-foreground mb-4 max-w-xs">
                Add conditions to filter when this automation should trigger. 
                Use tags for dynamic client-based filtering.
              </p>
              <Button onClick={handleAddNode} data-testid="button-add-first-condition">
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Condition
              </Button>
            </Card>
          </div>
        )}
        
        <ReactFlow
          nodes={state.nodes}
          edges={state.edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={handleConnect}
          nodeTypes={wrappedNodeTypes}
          fitView
          snapToGrid
          snapGrid={[15, 15]}
          defaultEdgeOptions={{
            type: 'smoothstep',
            animated: true,
            style: { strokeWidth: 2 }
          }}
          data-testid="react-flow-canvas"
        >
          <Controls className="!bg-background !border !shadow-sm" />
          <Background variant={BackgroundVariant.Dots} gap={15} size={1} className="!bg-transparent" />
          {hasConditions && (
            <MiniMap 
              className="!bg-background !border !shadow-sm"
              nodeColor={() => 'hsl(var(--primary))'}
              maskColor="hsl(var(--muted) / 0.5)"
            />
          )}
          <Panel position="bottom-left" className="!m-2">
            <div className="bg-background/90 border rounded px-2 py-1 text-xs text-muted-foreground flex items-center gap-2">
              <MousePointer2 className="h-3 w-3" />
              Drag to move • Scroll to zoom • Connect handles for AND logic
            </div>
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
}
