import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Search, Shield, CheckCircle, XCircle, Clock, AlertCircle, Eye, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { GradientHero } from "@/components/gradient-hero";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { calculateKycCompletion } from "@shared/kycUtils";

interface UserKycData {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  username: string;
  phone: string | null;
  phoneVerified: boolean;
  dateOfBirth: string | null;
  nationalId: string | null;
  nationalIdType: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;
  idDocumentUrl: string | null;
  addressProofUrl: string | null;
  kycStatus: string;
  kycVerifiedAt: string | null;
  kycRejectionReason: string | null;
  organization: {
    id: string;
    name: string;
  } | null;
  roleName: string;
}

export default function KycVerificationPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserKycData | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [showRejectionDialog, setShowRejectionDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const { data: users, isLoading } = useQuery<UserKycData[]>({
    queryKey: ["/api/admin/kyc/users"],
  });

  const updateKycStatusMutation = useMutation({
    mutationFn: async ({ userId, status, reason }: { userId: string; status: string; reason?: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${userId}/kyc-status`, { status, reason });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "KYC status updated",
        description: "User verification status has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/kyc/users"] });
      setShowApprovalDialog(false);
      setShowRejectionDialog(false);
      setShowDetailsDialog(false);
      setSelectedUser(null);
      setRejectionReason("");
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filteredUsers = users?.filter(user => {
    const searchLower = searchQuery.toLowerCase();
    const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim();
    return (
      user.email.toLowerCase().includes(searchLower) ||
      user.username.toLowerCase().includes(searchLower) ||
      fullName.toLowerCase().includes(searchLower) ||
      user.organization?.name.toLowerCase().includes(searchLower)
    );
  }) || [];

  const stats = {
    total: users?.length || 0,
    pending: users?.filter(u => u.kycStatus === "pending").length || 0,
    inReview: users?.filter(u => u.kycStatus === "in_review").length || 0,
    verified: users?.filter(u => u.kycStatus === "verified").length || 0,
    rejected: users?.filter(u => u.kycStatus === "rejected").length || 0,
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "verified": return "default";
      case "in_review": return "secondary";
      case "rejected": return "destructive";
      default: return "outline";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "verified": return <CheckCircle className="h-3 w-3" />;
      case "in_review": return <Clock className="h-3 w-3" />;
      case "rejected": return <XCircle className="h-3 w-3" />;
      default: return <AlertCircle className="h-3 w-3" />;
    }
  };

  const handleApprove = () => {
    if (!selectedUser) return;
    updateKycStatusMutation.mutate({
      userId: selectedUser.id,
      status: "verified",
    });
  };

  const handleReject = () => {
    if (!selectedUser || !rejectionReason.trim()) {
      toast({
        title: "Rejection reason required",
        description: "Please provide a reason for rejecting the KYC verification.",
        variant: "destructive",
      });
      return;
    }
    updateKycStatusMutation.mutate({
      userId: selectedUser.id,
      status: "rejected",
      reason: rejectionReason,
    });
  };

  const handleMarkInReview = () => {
    if (!selectedUser) return;
    updateKycStatusMutation.mutate({
      userId: selectedUser.id,
      status: "in_review",
    });
  };

  const viewDetails = (user: UserKycData) => {
    setSelectedUser(user);
    setShowDetailsDialog(true);
  };

  return (
    <div className="h-full overflow-auto">
      <GradientHero
        icon={Shield}
        title="KYC Verification"
        description="Review and manage user identity verification"
        testId="heading-kyc-verification"
      />

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold" data-testid="stat-total-users">{stats.total}</div>
              <p className="text-xs text-muted-foreground">All users</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <AlertCircle className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold" data-testid="stat-pending">{stats.pending}</div>
              <p className="text-xs text-muted-foreground">Awaiting submission</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Review</CardTitle>
              <Clock className="h-4 w-4 text-info" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold" data-testid="stat-in-review">{stats.inReview}</div>
              <p className="text-xs text-muted-foreground">Under review</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Verified</CardTitle>
              <CheckCircle className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold" data-testid="stat-verified">{stats.verified}</div>
              <p className="text-xs text-muted-foreground">Verified users</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rejected</CardTitle>
              <XCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold" data-testid="stat-rejected">{stats.rejected}</div>
              <p className="text-xs text-muted-foreground">Rejected applications</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>User Verification Status</CardTitle>
                <CardDescription>Review and approve user identity verification</CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  data-testid="input-search-users"
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="loading-users">Loading users...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="empty-users">
                No users found
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Completion</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Phone Verified</TableHead>
                    <TableHead>Documents</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => {
                    const kycCheck = calculateKycCompletion(user);
                    return (
                      <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                        <TableCell>
                          <div>
                            <div className="font-medium" data-testid={`text-user-name-${user.id}`}>
                              {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.username}
                            </div>
                            <div className="text-sm text-muted-foreground" data-testid={`text-user-email-${user.id}`}>
                              {user.email}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm" data-testid={`text-organization-${user.id}`}>
                            {user.organization?.name || "—"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 min-w-[120px]">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Progress</span>
                              <span className="font-medium" data-testid={`text-completion-${user.id}`}>
                                {kycCheck.completionPercentage}%
                              </span>
                            </div>
                            <Progress value={kycCheck.completionPercentage} className="h-1.5" data-testid={`progress-kyc-${user.id}`} />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(user.kycStatus)} className="gap-1" data-testid={`badge-status-${user.id}`}>
                            {getStatusIcon(user.kycStatus)}
                            {user.kycStatus}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.phoneVerified ? (
                            <Badge variant="default" className="gap-1" data-testid={`badge-phone-verified-${user.id}`}>
                              <CheckCircle className="h-3 w-3" />
                              Verified
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1" data-testid={`badge-phone-unverified-${user.id}`}>
                              <XCircle className="h-3 w-3" />
                              Not Verified
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {user.idDocumentUrl && (
                              <Badge variant="secondary" className="text-xs" data-testid={`badge-id-doc-${user.id}`}>ID</Badge>
                            )}
                            {user.addressProofUrl && (
                              <Badge variant="secondary" className="text-xs" data-testid={`badge-address-doc-${user.id}`}>Address</Badge>
                            )}
                            {!user.idDocumentUrl && !user.addressProofUrl && (
                              <span className="text-xs text-muted-foreground">None</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => viewDetails(user)}
                            data-testid={`button-view-details-${user.id}`}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Details Dialog */}
      {selectedUser && (
        <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-kyc-details">
            <DialogHeader>
              <DialogTitle data-testid="text-dialog-title">
                KYC Verification - {selectedUser.firstName && selectedUser.lastName ? `${selectedUser.firstName} ${selectedUser.lastName}` : selectedUser.username}
              </DialogTitle>
              <DialogDescription>
                Review user information and verification status
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Status Section */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Verification Status</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground">Current Status</label>
                    <div className="mt-1">
                      <Badge variant={getStatusBadgeVariant(selectedUser.kycStatus)} className="gap-1" data-testid="badge-current-status">
                        {getStatusIcon(selectedUser.kycStatus)}
                        {selectedUser.kycStatus}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Completion</label>
                    <div className="mt-1 flex items-center gap-2">
                      <Progress 
                        value={calculateKycCompletion(selectedUser).completionPercentage} 
                        className="h-2 flex-1" 
                        data-testid="progress-dialog-kyc"
                      />
                      <span className="text-sm font-medium" data-testid="text-dialog-completion">
                        {calculateKycCompletion(selectedUser).completionPercentage}%
                      </span>
                    </div>
                  </div>
                </div>
                {selectedUser.kycRejectionReason && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
                    <label className="text-xs font-medium text-destructive">Rejection Reason</label>
                    <p className="text-sm mt-1" data-testid="text-rejection-reason">{selectedUser.kycRejectionReason}</p>
                  </div>
                )}
              </div>

              {/* Personal Information */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Personal Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground">Email</label>
                    <p className="text-sm mt-1" data-testid="text-dialog-email">{selectedUser.email}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Phone</label>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-sm" data-testid="text-dialog-phone">{selectedUser.phone || "—"}</p>
                      {selectedUser.phoneVerified && (
                        <Badge variant="default" className="text-xs gap-1">
                          <CheckCircle className="h-2 w-2" />
                          Verified
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Date of Birth</label>
                    <p className="text-sm mt-1" data-testid="text-dialog-dob">
                      {selectedUser.dateOfBirth ? format(new Date(selectedUser.dateOfBirth), "PPP") : "—"}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">National ID</label>
                    <p className="text-sm mt-1" data-testid="text-dialog-national-id">
                      {selectedUser.nationalId || "—"}
                      {selectedUser.nationalIdType && (
                        <span className="text-muted-foreground ml-1">({selectedUser.nationalIdType})</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Address */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Address</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-xs text-muted-foreground">Street Address</label>
                    <p className="text-sm mt-1" data-testid="text-dialog-address">{selectedUser.address || "—"}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">City</label>
                    <p className="text-sm mt-1" data-testid="text-dialog-city">{selectedUser.city || "—"}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">State</label>
                    <p className="text-sm mt-1" data-testid="text-dialog-state">{selectedUser.state || "—"}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">ZIP Code</label>
                    <p className="text-sm mt-1" data-testid="text-dialog-zip">{selectedUser.zipCode || "—"}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Country</label>
                    <p className="text-sm mt-1" data-testid="text-dialog-country">{selectedUser.country || "—"}</p>
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Emergency Contact</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground">Name</label>
                    <p className="text-sm mt-1" data-testid="text-dialog-emergency-name">{selectedUser.emergencyContactName || "—"}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Phone</label>
                    <p className="text-sm mt-1" data-testid="text-dialog-emergency-phone">{selectedUser.emergencyContactPhone || "—"}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Relation</label>
                    <p className="text-sm mt-1" data-testid="text-dialog-emergency-relation">{selectedUser.emergencyContactRelation || "—"}</p>
                  </div>
                </div>
              </div>

              {/* Documents */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Uploaded Documents</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground">ID Document</label>
                    {selectedUser.idDocumentUrl ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 w-full"
                        onClick={() => window.open(selectedUser.idDocumentUrl!, "_blank")}
                        data-testid="button-view-id-doc"
                      >
                        <ExternalLink className="h-3 w-3 mr-2" />
                        View Document
                      </Button>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-1">Not uploaded</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Address Proof</label>
                    {selectedUser.addressProofUrl ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 w-full"
                        onClick={() => window.open(selectedUser.addressProofUrl!, "_blank")}
                        data-testid="button-view-address-doc"
                      >
                        <ExternalLink className="h-3 w-3 mr-2" />
                        View Document
                      </Button>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-1">Not uploaded</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              {selectedUser.kycStatus !== "verified" && (
                <>
                  {selectedUser.kycStatus !== "in_review" && (
                    <Button
                      variant="secondary"
                      onClick={handleMarkInReview}
                      disabled={updateKycStatusMutation.isPending}
                      data-testid="button-mark-in-review"
                    >
                      Mark In Review
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setShowRejectionDialog(true);
                      setShowDetailsDialog(false);
                    }}
                    disabled={updateKycStatusMutation.isPending}
                    data-testid="button-reject"
                  >
                    Reject
                  </Button>
                  <Button
                    onClick={() => {
                      setShowApprovalDialog(true);
                      setShowDetailsDialog(false);
                    }}
                    disabled={updateKycStatusMutation.isPending}
                    data-testid="button-approve"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Approval Confirmation Dialog */}
      {selectedUser && (
        <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
          <DialogContent data-testid="dialog-approve-kyc">
            <DialogHeader>
              <DialogTitle>Approve KYC Verification</DialogTitle>
              <DialogDescription>
                Are you sure you want to approve the KYC verification for {selectedUser.firstName && selectedUser.lastName ? `${selectedUser.firstName} ${selectedUser.lastName}` : selectedUser.username}?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowApprovalDialog(false)}
                data-testid="button-cancel-approval"
              >
                Cancel
              </Button>
              <Button
                onClick={handleApprove}
                disabled={updateKycStatusMutation.isPending}
                data-testid="button-confirm-approval"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Rejection Dialog */}
      {selectedUser && (
        <Dialog open={showRejectionDialog} onOpenChange={setShowRejectionDialog}>
          <DialogContent data-testid="dialog-reject-kyc">
            <DialogHeader>
              <DialogTitle>Reject KYC Verification</DialogTitle>
              <DialogDescription>
                Please provide a reason for rejecting the KYC verification for {selectedUser.firstName && selectedUser.lastName ? `${selectedUser.firstName} ${selectedUser.lastName}` : selectedUser.username}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Textarea
                placeholder="Enter rejection reason..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
                data-testid="textarea-rejection-reason"
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowRejectionDialog(false);
                  setRejectionReason("");
                }}
                data-testid="button-cancel-rejection"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={updateKycStatusMutation.isPending || !rejectionReason.trim()}
                data-testid="button-confirm-rejection"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
