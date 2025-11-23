import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  BackgroundVariant,
  NodeTypes,
  Handle,
  Position,
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

const nodeTypes: NodeTypes = {
  condition: ConditionNode,
};

interface VisualTriggerBuilderProps {
  conditions: Array<{ field: string; operator: string; value: string }>;
  onChange: (conditions: Array<{ field: string; operator: string; value: string }>) => void;
}

export function VisualTriggerBuilder({ conditions, onChange }: VisualTriggerBuilderProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const isInitialLoad = useRef(true);
  const prevConditionsLength = useRef(conditions.length);

  // Sync nodes ONLY on initial load or when switching triggers (count change)
  useEffect(() => {
    // Only rebuild if this is initial load OR condition count changed (switching triggers)
    const countChanged = prevConditionsLength.current !== conditions.length;
    
    if (isInitialLoad.current || countChanged) {
      const conditionNodes: Node[] = conditions.map((cond, idx) => {
        const nodeId = `condition-${idx}`; // Stable ID based on index
        return {
          id: nodeId,
          type: 'condition',
          position: { x: 250, y: idx * 180 + 50 },
          data: {
            id: nodeId,
            field: cond.field,
            operator: cond.operator,
            value: cond.value,
          } as ConditionNodeData,
        };
      });
      setNodes(conditionNodes);
      setEdges([]); // Only clear edges on full rebuild
      
      isInitialLoad.current = false;
      prevConditionsLength.current = conditions.length;
    }
  }, [conditions.length]); // Only watch length to detect trigger switches

  const handleDeleteNode = useCallback((id: string) => {
    setNodes((nds) => {
      const filtered = nds.filter((node) => node.id !== id);
      // Convert to plain objects without functions
      const plainConditions = filtered.map((n) => ({
        field: (n.data as ConditionNodeData).field,
        operator: (n.data as ConditionNodeData).operator,
        value: (n.data as ConditionNodeData).value,
      }));
      prevConditionsLength.current = filtered.length; // Update length ref
      onChange(plainConditions);
      return filtered;
    });
    // Also clear edges connected to this node
    setEdges((eds) => eds.filter((edge) => edge.source !== id && edge.target !== id));
  }, [onChange, setNodes, setEdges]);

  const handleNodeChange = useCallback((id: string, updates: Partial<Omit<ConditionNodeData, 'id'>>) => {
    setNodes((nds) => {
      const updated = nds.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, ...updates } as ConditionNodeData }
          : node
      );
      // Convert to plain objects without functions
      const plainConditions = updated.map((n) => ({
        field: (n.data as ConditionNodeData).field,
        operator: (n.data as ConditionNodeData).operator,
        value: (n.data as ConditionNodeData).value,
      }));
      onChange(plainConditions);
      return updated;
    });
  }, [onChange, setNodes]);

  const handleAddCondition = useCallback(() => {
    setNodes((nds) => {
      const newId = `condition-${nds.length}`; // Stable ID based on count
      const newNode: Node = {
        id: newId,
        type: 'condition',
        position: { x: 250, y: nds.length * 180 + 50 },
        data: {
          id: newId,
          field: 'status',
          operator: 'equals',
          value: '',
        } as ConditionNodeData,
      };
      const updated = [...nds, newNode];
      // Convert to plain objects without functions
      const plainConditions = updated.map((n) => ({
        field: (n.data as ConditionNodeData).field,
        operator: (n.data as ConditionNodeData).operator,
        value: (n.data as ConditionNodeData).value,
      }));
      prevConditionsLength.current = updated.length; // Update length ref
      onChange(plainConditions);
      return updated;
    });
  }, [onChange, setNodes]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // Wrap ConditionNode with callbacks
  const wrappedNodeTypes = useMemo(() => ({
    condition: (props: any) => (
      <ConditionNode
        {...props}
        onDelete={handleDeleteNode}
        onChange={handleNodeChange}
      />
    ),
  }), [handleDeleteNode, handleNodeChange]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Visual Condition Builder</h3>
          <p className="text-xs text-muted-foreground">
            Drag conditions to reorder, connect nodes to create logic flow
          </p>
        </div>
        <Button
          onClick={handleAddCondition}
          size="sm"
          variant="outline"
          data-testid="button-add-condition"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Condition
        </Button>
      </div>

      <div className="h-[400px] border rounded-md bg-background">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
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
