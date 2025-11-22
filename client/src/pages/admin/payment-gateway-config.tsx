import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CreditCard, Plus, Settings, Trash2, AlertCircle, CheckCircle2 } from "lucide-react";

const gatewaySchema = z.object({
  gateway: z.enum(['razorpay', 'stripe', 'cashfree', 'payu', 'payoneer']),
  apiKey: z.string().min(1, "API Key is required"),
  apiSecret: z.string().min(1, "API Secret is required"),
  webhookSecret: z.string().optional(),
  publicKey: z.string().optional(),
  environment: z.enum(['sandbox', 'production']).default('production'),
  isDefault: z.boolean().default(false),
});

type GatewayFormValues = z.infer<typeof gatewaySchema>;

interface GatewayConfig {
  id: string;
  gateway: string;
  environment: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
}

interface SupportedGateway {
  id: string;
  name: string;
  description: string;
  implemented: boolean;
}

export default function PaymentGatewayConfig() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<GatewayConfig | null>(null);

  const { data: configs, isLoading } = useQuery<GatewayConfig[]>({
    queryKey: ['/api/payment-gateway-configs'],
  });

  const { data: supportedGateways } = useQuery<{ gateways: SupportedGateway[] }>({
    queryKey: ['/api/payment/gateways'],
  });

  const form = useForm<GatewayFormValues>({
    resolver: zodResolver(gatewaySchema),
    defaultValues: {
      gateway: 'razorpay',
      apiKey: '',
      apiSecret: '',
      webhookSecret: '',
      publicKey: '',
      environment: 'production',
      isDefault: false,
    },
  });

  const createConfigMutation = useMutation({
    mutationFn: async (data: GatewayFormValues) => {
      return await apiRequest('/api/payment-gateway-configs', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/payment-gateway-configs'] });
      toast({
        title: "Success",
        description: "Payment gateway configured successfully",
      });
      setDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to configure payment gateway",
        variant: "destructive",
      });
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<GatewayConfig> }) => {
      return await apiRequest(`/api/payment-gateway-configs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/payment-gateway-configs'] });
      toast({
        title: "Success",
        description: "Gateway configuration updated",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update configuration",
        variant: "destructive",
      });
    },
  });

  const deleteConfigMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/payment-gateway-configs/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/payment-gateway-configs'] });
      toast({
        title: "Success",
        description: "Gateway configuration deleted",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete configuration",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: GatewayFormValues) => {
    createConfigMutation.mutate(data);
  };

  const handleToggleDefault = (config: GatewayConfig) => {
    updateConfigMutation.mutate({
      id: config.id,
      data: { isDefault: !config.isDefault },
    });
  };

  const handleToggleActive = (config: GatewayConfig) => {
    updateConfigMutation.mutate({
      id: config.id,
      data: { isActive: !config.isActive },
    });
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this gateway configuration?")) {
      deleteConfigMutation.mutate(id);
    }
  };

  const selectedGateway = form.watch('gateway');
  const gatewayInfo = supportedGateways?.gateways.find(g => g.id === selectedGateway);

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-payment-gateway-config">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Payment Gateway Configuration</h1>
          <p className="text-muted-foreground mt-2">
            Configure payment gateways for your organization
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} data-testid="button-add-gateway">
          <Plus className="w-4 h-4 mr-2" />
          Add Gateway
        </Button>
      </div>

      {configs?.length === 0 && (
        <Alert data-testid="alert-no-gateways">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No payment gateways configured. Add a gateway to start accepting payments.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Configured Gateways</CardTitle>
          <CardDescription>
            Manage your payment gateway integrations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : configs && configs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Gateway</TableHead>
                  <TableHead>Environment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Default</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs.map((config) => (
                  <TableRow key={config.id} data-testid={`row-gateway-${config.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4" />
                        <span className="font-medium capitalize">{config.gateway}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={config.environment === 'production' ? 'default' : 'secondary'}>
                        {config.environment}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {config.isActive ? (
                        <Badge variant="default" className="bg-green-600">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={config.isDefault}
                        onCheckedChange={() => handleToggleDefault(config)}
                        data-testid={`switch-default-${config.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={config.isActive}
                        onCheckedChange={() => handleToggleActive(config)}
                        data-testid={`switch-active-${config.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(config.id)}
                        data-testid={`button-delete-${config.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No gateways configured yet
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Supported Gateways</CardTitle>
          <CardDescription>
            Available payment gateway integrations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {supportedGateways?.gateways.map((gateway) => (
              <Card key={gateway.id} className="border-2">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{gateway.name}</CardTitle>
                    {gateway.implemented ? (
                      <Badge variant="default" className="bg-green-600">Available</Badge>
                    ) : (
                      <Badge variant="secondary">Coming Soon</Badge>
                    )}
                  </div>
                  <CardDescription className="text-sm">
                    {gateway.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl" data-testid="dialog-add-gateway">
          <DialogHeader>
            <DialogTitle>Add Payment Gateway</DialogTitle>
            <DialogDescription>
              Configure a new payment gateway for your organization
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="gateway"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Gateway</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-gateway">
                          <SelectValue placeholder="Select a gateway" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {supportedGateways?.gateways
                          .filter(g => g.implemented)
                          .map((gateway) => (
                            <SelectItem key={gateway.id} value={gateway.id}>
                              {gateway.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    {gatewayInfo && (
                      <FormDescription>{gatewayInfo.description}</FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="environment"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Environment</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-environment">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="sandbox">Sandbox (Test)</SelectItem>
                        <SelectItem value="production">Production (Live)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="apiKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>API Key / Client ID</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder="Enter your API key"
                        data-testid="input-api-key"
                      />
                    </FormControl>
                    <FormDescription>
                      Your gateway API key or client ID
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="apiSecret"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>API Secret</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder="Enter your API secret"
                        data-testid="input-api-secret"
                      />
                    </FormControl>
                    <FormDescription>
                      Your gateway API secret or client secret
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="webhookSecret"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Webhook Secret (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder="Enter webhook secret"
                        data-testid="input-webhook-secret"
                      />
                    </FormControl>
                    <FormDescription>
                      Used to verify webhook signatures
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {selectedGateway === 'stripe' && (
                <FormField
                  control={form.control}
                  name="publicKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Public Key (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Enter your publishable key"
                          data-testid="input-public-key"
                        />
                      </FormControl>
                      <FormDescription>
                        Stripe publishable key for frontend integration
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="isDefault"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Set as Default Gateway
                      </FormLabel>
                      <FormDescription>
                        Use this gateway for all new transactions
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-is-default"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createConfigMutation.isPending}
                  data-testid="button-submit"
                >
                  {createConfigMutation.isPending ? "Configuring..." : "Configure Gateway"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
