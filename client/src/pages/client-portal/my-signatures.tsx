import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GradientHero } from "@/components/gradient-hero";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileSignature, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { useLocation } from "wouter";

interface SignatureRequest {
  id: string;
  documentName: string;
  description: string | null;
  status: "pending" | "signed" | "declined";
  requestedAt: string;
  signedAt: string | null;
  dueDate: string | null;
  isOverdue: boolean;
  requestedBy: {
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
}

export default function ClientMySignatures() {
  const [, setLocation] = useLocation();

  const { data: signatures = [], isLoading } = useQuery<SignatureRequest[]>({
    queryKey: ["/api/client-portal/signatures"],
  });

  const pendingSignatures = signatures.filter((s) => s.status === "pending");
  const completedSignatures = signatures.filter((s) => s.status === "signed");
  const overdueSignatures = signatures.filter((s) => s.isOverdue && s.status === "pending");

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "signed":
        return <Badge variant="default">Signed</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "declined":
        return <Badge variant="destructive">Declined</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="h-full overflow-auto">
      <GradientHero
        icon={FileSignature}
        title="My Signatures"
        description="Sign documents and track signature requests"
        testId="client-signatures"
      />

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card data-testid="card-all-signatures">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">All Requests</CardTitle>
              <FileSignature className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-all-signatures">
                {signatures.length}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-pending-signatures">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-pending-signatures">
                {pendingSignatures.length}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-completed-signatures">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Signed</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-completed-signatures">
                {completedSignatures.length}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-overdue-signatures">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overdue</CardTitle>
              <AlertCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive" data-testid="text-overdue-signatures">
                {overdueSignatures.length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pending Signatures */}
        <Card data-testid="card-pending-list">
          <CardHeader>
            <CardTitle>Pending Signatures</CardTitle>
            <CardDescription>Documents requiring your signature</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading signature requests...
              </div>
            ) : pendingSignatures.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="text-no-pending">
                No pending signature requests
              </div>
            ) : (
              <div className="space-y-3">
                {pendingSignatures.map((sig) => (
                  <div
                    key={sig.id}
                    className="p-4 rounded-lg border hover-elevate"
                    data-testid={`signature-${sig.id}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <FileSignature className="h-5 w-5 text-muted-foreground" />
                          <h3 className="font-semibold">{sig.documentName}</h3>
                          {sig.isOverdue && (
                            <Badge variant="destructive">Overdue</Badge>
                          )}
                          {getStatusBadge(sig.status)}
                        </div>
                        {sig.description && (
                          <p className="text-sm text-muted-foreground mb-3">
                            {sig.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            Requested by:{" "}
                            {sig.requestedBy.firstName && sig.requestedBy.lastName
                              ? `${sig.requestedBy.firstName} ${sig.requestedBy.lastName}`
                              : sig.requestedBy.email}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(sig.requestedAt).toLocaleDateString()}
                          </div>
                          {sig.dueDate && (
                            <div className="flex items-center gap-1">
                              Due: {new Date(sig.dueDate).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => setLocation(`/client-portal/signatures/${sig.id}/sign`)}
                        data-testid={`button-sign-${sig.id}`}
                      >
                        Sign Document
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Completed Signatures */}
        <Card data-testid="card-completed-list">
          <CardHeader>
            <CardTitle>Completed Signatures</CardTitle>
            <CardDescription>Documents you have already signed</CardDescription>
          </CardHeader>
          <CardContent>
            {completedSignatures.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="text-no-completed">
                No completed signatures
              </div>
            ) : (
              <div className="space-y-3">
                {completedSignatures.map((sig) => (
                  <div
                    key={sig.id}
                    className="p-4 rounded-lg border"
                    data-testid={`completed-signature-${sig.id}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <FileSignature className="h-5 w-5 text-muted-foreground" />
                          <h3 className="font-semibold">{sig.documentName}</h3>
                          {getStatusBadge(sig.status)}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Signed: {sig.signedAt ? new Date(sig.signedAt).toLocaleDateString() : "N/A"}
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setLocation(`/client-portal/signatures/${sig.id}/view`)}
                        data-testid={`button-view-${sig.id}`}
                      >
                        View
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
