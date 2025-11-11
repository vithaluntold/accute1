import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, DollarSign } from "lucide-react";
import { GradientHero } from "@/components/gradient-hero";

export default function ProfitabilityView() {
  const { data: clients } = useQuery<any[]>({ queryKey: ["/api/clients"] });
  const { data: timeEntries } = useQuery<any[]>({ queryKey: ["/api/time-entries"] });
  const { data: invoices } = useQuery<any[]>({ queryKey: ["/api/invoices"] });

  // Calculate profitability per client
  const clientProfitability = clients?.map(client => {
    const clientTime = timeEntries?.filter(t => t.clientId === client.id) || [];
    const clientInvoices = invoices?.filter(i => i.clientId === client.id) || [];
    
    const totalHours = clientTime.reduce((sum, t) => sum + (t.hours || 0), 0);
    const totalCost = clientTime.reduce((sum, t) => sum + ((t.hours || 0) * (t.hourlyRate || 0)), 0);
    const totalRevenue = clientInvoices.reduce((sum, i) => sum + (i.amount || 0), 0);
    const margin = totalRevenue - totalCost;
    const marginPercent = totalRevenue > 0 ? (margin / totalRevenue) * 100 : 0;

    return {
      client,
      totalHours,
      totalCost,
      totalRevenue,
      margin,
      marginPercent,
    };
  }) || [];

  return (
    <div className="flex flex-col h-screen">
      <GradientHero
        title="Client Profitability"
        description="Revenue vs cost analysis per client"
        icon={TrendingUp}
      />
      <div className="flex-1 overflow-auto p-6">
        <div className="grid gap-6">
          {clientProfitability.map((data, idx) => (
            <Card key={idx}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{data.client.name || "Unknown Client"}</CardTitle>
                  <Badge variant={data.margin >= 0 ? "default" : "destructive"}>
                    {data.margin >= 0 ? "+" : ""}${data.margin.toFixed(2)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Profit Margin</span>
                      <span className="text-sm text-muted-foreground">
                        {data.marginPercent.toFixed(1)}%
                      </span>
                    </div>
                    <Progress 
                      value={Math.min(Math.max(data.marginPercent, 0), 100)} 
                      className={data.margin < 0 ? "bg-destructive/20" : ""}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Revenue</p>
                      <p className="font-medium flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        {data.totalRevenue.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Cost</p>
                      <p className="font-medium flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        {data.totalCost.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Hours</p>
                      <p className="font-medium">{data.totalHours.toFixed(1)}h</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
