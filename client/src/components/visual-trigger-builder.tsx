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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { Label } from '@/components/ui/label';

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
];

const OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'greater_than', label: 'Greater Than' },
  { value: 'less_than', label: 'Less Than' },
  { value: 'contains', label: 'Contains' },
  { value: 'starts_with', label: 'Starts With' },
];

interface ConditionNodeProps {
  data: ConditionNodeData;
  onDelete: (id: string) => void;
  onChange: (id: string, updates: Partial<Omit<ConditionNodeData, 'id'>>) => void;
}

function ConditionNode({ data, onDelete, onChange }: ConditionNodeProps) {
  return (
    <Card className="min-w-[300px]" data-testid={`condition-node-${data.id}`}>
      <Handle type="target" position={Position.Top} />
      <CardHeader className="p-3 pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm">Condition</CardTitle>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onDelete(data.id)}
            data-testid="button-delete-condition"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0 space-y-2">
        <div>
          <Label className="text-xs">Field</Label>
          <Select
            value={data.field}
            onValueChange={(value) => onChange(data.id, { field: value })}
          >
            <SelectTrigger className="h-8" data-testid="select-condition-field">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONDITION_FIELDS.map((field) => (
                <SelectItem key={field.value} value={field.value}>
                  {field.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Operator</Label>
          <Select
            value={data.operator}
            onValueChange={(value) => onChange(data.id, { operator: value })}
          >
            <SelectTrigger className="h-8" data-testid="select-condition-operator">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPERATORS.map((op) => (
                <SelectItem key={op.value} value={op.value}>
                  {op.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Value</Label>
          <Input
            className="h-8"
            value={data.value}
            onChange={(e) => onChange(data.id, { value: e.target.value })}
            placeholder="Enter value"
            data-testid="input-condition-value"
          />
        </div>
      </CardContent>
      <Handle type="source" position={Position.Bottom} />
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

  // Hydrate from props
  useEffect(() => {
    const snapshot = JSON.stringify({ conditions, conditionEdges });
    if (snapshot !== prevSnapshotRef.current) {
      isHydratingRef.current = true;
      const newState = graphReducer(state, { type: 'HYDRATE', conditions, edges: conditionEdges });
      dispatch({ type: 'HYDRATE', conditions, edges: conditionEdges });
      prevSnapshotRef.current = snapshot;
      
      // Persist IDs if generated
      if (conditions.some(c => !c.id) || conditionEdges.some((e: any) => !e.id)) {
        emitToParent(newState);
      }
      
      isHydratingRef.current = false;
    }
  }, [JSON.stringify({ conditions, conditionEdges })]);

  // Handlers dispatch ONCE, then use updated state ref
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    if (isHydratingRef.current) return;
    dispatch({ type: 'NODE_CHANGES', changes });
    // Wait for state update, then emit
    setTimeout(() => emitToParent(stateRef.current), 0);
  }, [emitToParent]);

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    if (isHydratingRef.current) return;
    dispatch({ type: 'EDGE_CHANGES', changes });
    setTimeout(() => emitToParent(stateRef.current), 0);
  }, [emitToParent]);

  const handleConnect = useCallback((connection: Connection) => {
    if (isHydratingRef.current) return;
    dispatch({ type: 'CONNECT', connection });
    setTimeout(() => emitToParent(stateRef.current), 0);
  }, [emitToParent]);

  const handleAddNode = useCallback(() => {
    dispatch({ type: 'ADD_NODE' });
    setTimeout(() => emitToParent(stateRef.current), 0);
  }, [emitToParent]);

  const handleDeleteNode = useCallback((id: string) => {
    dispatch({ type: 'DELETE_NODE', id });
    setTimeout(() => emitToParent(stateRef.current), 0);
  }, [emitToParent]);

  const handleNodeDataChange = useCallback((id: string, updates: any) => {
    dispatch({ type: 'UPDATE_NODE_DATA', id, updates });
    setTimeout(() => emitToParent(stateRef.current), 0);
  }, [emitToParent]);

  const wrappedNodeTypes = useMemo(() => ({
    condition: (props: any) => (
      <ConditionNode {...props} onDelete={handleDeleteNode} onChange={handleNodeDataChange} />
    ),
  }), [handleDeleteNode, handleNodeDataChange]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Visual Condition Builder</h3>
          <p className="text-xs text-muted-foreground">
            Drag conditions to reorder, connect nodes to create logic flow
          </p>
        </div>
        <Button onClick={handleAddNode} size="sm" variant="outline" data-testid="button-add-condition">
          <Plus className="h-3 w-3 mr-1" />
          Add Condition
        </Button>
      </div>

      <div className="h-[400px] border rounded-md bg-background">
        <ReactFlow
          nodes={state.nodes}
          edges={state.edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={handleConnect}
          nodeTypes={wrappedNodeTypes}
          fitView
          data-testid="react-flow-canvas"
        >
          <Controls />
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        </ReactFlow>
      </div>
    </div>
  );
}
