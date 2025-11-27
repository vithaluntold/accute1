import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { insertForecastingModelSchema, type ForecastingModel, type ForecastingRun } from "@shared/schema";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp, Calendar, Plus, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const modelFormSchema = insertForecastingModelSchema.extend({
  name: z.string().min(1, "Name is required"),
  forecastType: z.enum(["revenue", "workload", "capacity", "client_growth"]),
});

export default function ForecastingPage() {
  const { toast } = useToast();
  const [showNewModel, setShowNewModel] = useState(false);
  const [selectedRun, setSelectedRun] = useState<string>("");

  const form = useForm<z.infer<typeof modelFormSchema>>({
    resolver: zodResolver(modelFormSchema),
    defaultValues: {
      name: "",
      description: "",
      forecastType: "revenue",
      strategy: "statistical",
      configuration: { period: "monthly", lookback: 12 },
      isActive: true,
    },
  });

  // Fetch models
  const { data: models = [], isLoading: modelsLoading } = useQuery<ForecastingModel[]>({
    queryKey: ["/api/forecasting/models"],
  });

  // Fetch selected run details
  const { data: runDetails } = useQuery({
    queryKey: ["/api/forecasting/runs", selectedRun],
    enabled: !!selectedRun,
  });

  // Create model mutation
  const createModelMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/forecasting/models", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forecasting/models"] });
      setShowNewModel(false);
      form.reset();
      toast({ title: "Model created successfully" });
    },
    onError: () => toast({ title: "Failed to create model", variant: "destructive" }),
  });

  // Run forecast mutation
  const runForecastMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/forecasting/runs", data),
    onSuccess: (run: ForecastingRun) => {
      setSelectedRun(run.id);
      toast({ title: "Forecast started", description: "Generating predictions..." });
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/forecasting/runs", run.id] });
      }, 2000);
    },
    onError: () => toast({ title: "Failed to run forecast", variant: "destructive" }),
  });

  const onSubmit = (data: z.infer<typeof modelFormSchema>) => {
    createModelMutation.mutate(data);
  };

  const handleRunForecast = (modelId: string) => {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 12);

    runForecastMutation.mutate({
      modelId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      granularity: "monthly",
    });
  };

  const chartData = runDetails?.predictions?.map((pred: any) => ({
    period: new Date(pred.periodStart).toLocaleDateString("en-US", { month: "short", year: "numeric" }),
    revenue: pred.metrics.predicted_revenue,
    confidence: pred.metrics.confidence,
  })) || [];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between gap-4 p-4 border-b">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-semibold" data-testid="text-page-title">Revenue & Workload Forecasting</h1>
        </div>
        <Button onClick={() => setShowNewModel(!showNewModel)} data-testid="button-new-model">
          <Plus className="w-4 h-4" />
          New Model
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Models List */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Forecasting Models</CardTitle>
              <CardDescription>Your configured forecast models</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {modelsLoading ? (
                <div className="text-muted-foreground text-sm" data-testid="text-loading">Loading models...</div>
              ) : models.length === 0 ? (
                <div className="text-muted-foreground text-sm" data-testid="text-no-models">No models yet. Create one to get started.</div>
              ) : (
                models.map((model) => (
                  <Card
                    key={model.id}
                    className="hover-elevate cursor-pointer transition-all"
                    data-testid={`card-model-${model.id}`}
                  >
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-medium" data-testid={`text-model-name-${model.id}`}>{model.name}</h3>
                        <Badge variant={model.isActive ? "default" : "secondary"} data-testid={`badge-status-${model.id}`}>
                          {model.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground" data-testid={`text-model-type-${model.id}`}>{model.forecastType}</p>
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRunForecast(model.id);
                        }}
                        disabled={runForecastMutation.isPending}
                        data-testid={`button-run-forecast-${model.id}`}
                      >
                        <Play className="w-3 h-3" />
                        Run Forecast
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>

          {/* Results Visualization */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Forecast Results</CardTitle>
              <CardDescription>
                {runDetails ? `${runDetails.status} - ${chartData.length} predictions` : "Select a model and run forecast"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {runDetails && runDetails.status === "completed" && chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              ) : runDetails?.status === "running" ? (
                <div className="flex items-center justify-center h-64" data-testid="text-running">
                  <div className="text-center">
                    <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-2" />
                    <p className="text-muted-foreground">Generating predictions...</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-64 text-muted-foreground" data-testid="text-no-data">
                  <div className="text-center">
                    <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No forecast data available</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* New Model Form */}
        {showNewModel && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Create New Forecasting Model</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Model Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Q1 2024 Revenue Forecast" {...field} data-testid="input-model-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Input placeholder="Optional description" {...field} value={field.value || ""} data-testid="input-model-description" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="forecastType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Forecast Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-forecast-type">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="revenue">Revenue</SelectItem>
                            <SelectItem value="workload">Workload</SelectItem>
                            <SelectItem value="capacity">Capacity</SelectItem>
                            <SelectItem value="client_growth">Client Growth</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="strategy"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Strategy</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-strategy">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="statistical">Statistical</SelectItem>
                            <SelectItem value="llm">AI/LLM</SelectItem>
                            <SelectItem value="hybrid">Hybrid</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex gap-2">
                    <Button type="submit" disabled={createModelMutation.isPending} data-testid="button-create-model">
                      Create Model
                    </Button>
                    <Button type="button" variant="outline" onClick={() => { setShowNewModel(false); form.reset(); }} data-testid="button-cancel">
                      Cancel
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
