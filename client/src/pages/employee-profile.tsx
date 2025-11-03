import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { User, Shield, Upload, CheckCircle, XCircle, AlertCircle, Phone } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { GradientHero } from "@/components/gradient-hero";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const kycFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phone: z.string().min(10, "Valid phone number is required"),
  dateOfBirth: z.string().optional(),
  nationalId: z.string().optional(),
  nationalIdType: z.enum(["ssn", "pan", "nid", "passport", "other"]).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().default("US"),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyContactRelation: z.string().optional(),
});

type KycFormData = z.infer<typeof kycFormSchema>;

export default function EmployeeProfile() {
  const { toast } = useToast();
  const [showPhoneVerification, setShowPhoneVerification] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpId, setOtpId] = useState<string | null>(null);

  const { data: currentUser, isLoading } = useQuery<any>({
    queryKey: ["/api/users/me"],
  });

  const form = useForm<KycFormData>({
    resolver: zodResolver(kycFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      phone: "",
      dateOfBirth: "",
      nationalId: "",
      nationalIdType: undefined,
      address: "",
      city: "",
      state: "",
      zipCode: "",
      country: "US",
      emergencyContactName: "",
      emergencyContactPhone: "",
      emergencyContactRelation: "",
    },
  });

  // Reset form with fetched user data
  useEffect(() => {
    if (currentUser) {
      form.reset({
        firstName: currentUser.firstName || "",
        lastName: currentUser.lastName || "",
        phone: currentUser.phone || "",
        dateOfBirth: currentUser.dateOfBirth ? new Date(currentUser.dateOfBirth).toISOString().split('T')[0] : "",
        nationalId: currentUser.nationalId || "",
        nationalIdType: currentUser.nationalIdType || undefined,
        address: currentUser.address || "",
        city: currentUser.city || "",
        state: currentUser.state || "",
        zipCode: currentUser.zipCode || "",
        country: currentUser.country || "US",
        emergencyContactName: currentUser.emergencyContactName || "",
        emergencyContactPhone: currentUser.emergencyContactPhone || "",
        emergencyContactRelation: currentUser.emergencyContactRelation || "",
      });
    }
  }, [currentUser, form]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: KycFormData) => {
      const res = await apiRequest("PATCH", "/api/users/me", data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Profile updated",
        description: "Your profile information has been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users/me"] });
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const sendOtpMutation = useMutation({
    mutationFn: async (phone: string) => {
      const res = await apiRequest("POST", "/api/auth/send-otp", { phone });
      return res.json();
    },
    onSuccess: (data) => {
      setOtpSent(true);
      setOtpId(data.developmentOnly?.otpId || null);
      toast({
        title: "OTP sent",
        description: "A verification code has been sent to your phone.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send OTP",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: async ({ phone, otp }: { phone: string; otp: string }) => {
      const res = await apiRequest("POST", "/api/auth/verify-otp", { phone, otp });
      return res.json();
    },
    onSuccess: async () => {
      toast({
        title: "Phone verified",
        description: "Your phone number has been verified successfully.",
      });
      setShowPhoneVerification(false);
      setOtp("");
      setOtpSent(false);
      // Update user phone verified status
      await queryClient.invalidateQueries({ queryKey: ["/api/users/me"] });
    },
    onError: (error: any) => {
      toast({
        title: "Verification failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: KycFormData) => {
    updateProfileMutation.mutate(data);
  };

  const handleSendOtp = () => {
    const phone = form.getValues("phone");
    if (!phone || phone.length < 10) {
      toast({
        title: "Invalid phone number",
        description: "Please enter a valid phone number",
        variant: "destructive",
      });
      return;
    }
    sendOtpMutation.mutate(phone);
  };

  const handleVerifyOtp = () => {
    const phone = form.getValues("phone");
    if (!otp || otp.length !== 6) {
      toast({
        title: "Invalid OTP",
        description: "Please enter the 6-digit code",
        variant: "destructive",
      });
      return;
    }
    verifyOtpMutation.mutate({ phone, otp });
  };

  const getKycStatusBadge = () => {
    const status = currentUser?.kycStatus || "pending";
    const phoneVerified = currentUser?.phoneVerified || false;

    const overallStatus = !phoneVerified ? "incomplete" : status;

    const variants = {
      pending: { variant: "outline" as const, icon: AlertCircle, label: "Pending" },
      in_review: { variant: "default" as const, icon: AlertCircle, label: "In Review" },
      verified: { variant: "default" as const, icon: CheckCircle, label: "Verified" },
      rejected: { variant: "destructive" as const, icon: XCircle, label: "Rejected" },
      incomplete: { variant: "destructive" as const, icon: AlertCircle, label: "Incomplete" },
    };

    const config = variants[overallStatus as keyof typeof variants] || variants.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getVerificationProgress = () => {
    const checks = [
      { label: "Phone Verified", completed: currentUser?.phoneVerified },
      { label: "KYC Submitted", completed: currentUser?.kycStatus !== "pending" },
      { label: "KYC Approved", completed: currentUser?.kycStatus === "verified" },
    ];

    const completedCount = checks.filter(c => c.completed).length;
    const progressPercent = (completedCount / checks.length) * 100;

    return { checks, progressPercent };
  };

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  const { checks, progressPercent } = getVerificationProgress();

  return (
    <div className="h-full overflow-auto">
      <GradientHero
        icon={User}
        title="Employee Profile"
        description="Manage your profile information and complete KYC verification"
        testId="hero-employee-profile"
      />

      <div className="p-6 space-y-6">
        {/* Verification Status Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Verification Status</CardTitle>
                <CardDescription>Complete all steps to activate your profile</CardDescription>
              </div>
              {getKycStatusBadge()}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm mb-1">
                <span>Progress</span>
                <span>{Math.round(progressPercent)}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            <div className="grid gap-2">
              {checks.map((check, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  {check.completed ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className={check.completed ? "text-foreground" : "text-muted-foreground"}>
                    {check.label}
                  </span>
                </div>
              ))}
            </div>

            {currentUser?.kycStatus === "rejected" && currentUser?.kycRejectionReason && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                <p className="text-sm font-medium text-destructive">Rejection Reason:</p>
                <p className="text-sm text-destructive/90 mt-1">{currentUser.kycRejectionReason}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* KYC Information Form */}
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Update your profile and KYC details</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Basic Information */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-first-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-last-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Phone with Verification */}
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input {...field} placeholder="+1234567890" data-testid="input-phone" />
                        </FormControl>
                        <Button
                          type="button"
                          variant={currentUser?.phoneVerified ? "outline" : "default"}
                          onClick={() => setShowPhoneVerification(true)}
                          data-testid="button-verify-phone"
                        >
                          <Phone className="h-4 w-4 mr-2" />
                          {currentUser?.phoneVerified ? "Verified" : "Verify"}
                        </Button>
                      </div>
                      {currentUser?.phoneVerified && (
                        <FormDescription className="text-green-600">
                          ✓ Verified on {new Date(currentUser.phoneVerifiedAt).toLocaleDateString()}
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                {/* KYC Details */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">KYC Information</h3>

                  <FormField
                    control={form.control}
                    name="dateOfBirth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date of Birth</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-dob" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="nationalIdType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ID Type</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                            data-testid="select-id-type"
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select ID type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="ssn">SSN</SelectItem>
                              <SelectItem value="pan">PAN Card</SelectItem>
                              <SelectItem value="nid">National ID</SelectItem>
                              <SelectItem value="passport">Passport</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="nationalId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ID Number</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Enter ID number" data-testid="input-id-number" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-address" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-city" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>State</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-state" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="zipCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Zip Code</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-zip" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-country" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                {/* Emergency Contact */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Emergency Contact</h3>

                  <FormField
                    control={form.control}
                    name="emergencyContactName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Name</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-emergency-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="emergencyContactPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Phone</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="+1234567890" data-testid="input-emergency-phone" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="emergencyContactRelation"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Relationship</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g., Spouse, Parent" data-testid="input-emergency-relation" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={updateProfileMutation.isPending}
                  data-testid="button-save-profile"
                >
                  {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Document Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle>Document Verification</CardTitle>
            <CardDescription>Upload your identity and address proof documents</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>ID Proof (Passport, Driver's License, etc.)</Label>
              <div className="mt-2 flex items-center gap-2">
                <Input type="file" accept="image/*,application/pdf" data-testid="input-id-proof" />
                <Button type="button" variant="outline" data-testid="button-upload-id">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </Button>
              </div>
              {currentUser?.idDocumentUrl && (
                <p className="text-sm text-muted-foreground mt-1">✓ Document uploaded</p>
              )}
            </div>

            <div>
              <Label>Address Proof (Utility Bill, Bank Statement, etc.)</Label>
              <div className="mt-2 flex items-center gap-2">
                <Input type="file" accept="image/*,application/pdf" data-testid="input-address-proof" />
                <Button type="button" variant="outline" data-testid="button-upload-address">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </Button>
              </div>
              {currentUser?.addressProofUrl && (
                <p className="text-sm text-muted-foreground mt-1">✓ Document uploaded</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Phone Verification Dialog */}
      <Dialog open={showPhoneVerification} onOpenChange={setShowPhoneVerification}>
        <DialogContent data-testid="dialog-phone-verification">
          <DialogHeader>
            <DialogTitle>Verify Phone Number</DialogTitle>
            <DialogDescription>
              Enter the 6-digit code sent to {form.getValues("phone")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {!otpSent ? (
              <Button
                onClick={handleSendOtp}
                disabled={sendOtpMutation.isPending}
                className="w-full"
                data-testid="button-send-otp"
              >
                {sendOtpMutation.isPending ? "Sending..." : "Send Verification Code"}
              </Button>
            ) : (
              <>
                <div>
                  <Label htmlFor="otp-code">Verification Code</Label>
                  <Input
                    id="otp-code"
                    placeholder="Enter 6-digit code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    maxLength={6}
                    data-testid="input-otp"
                  />
                  {otpId && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Development: OTP ID: {otpId}
                    </p>
                  )}
                </div>

                <Button
                  onClick={() => {
                    setOtpSent(false);
                    setOtp("");
                  }}
                  variant="outline"
                  className="w-full"
                  data-testid="button-resend-otp"
                >
                  Resend Code
                </Button>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPhoneVerification(false);
                setOtp("");
                setOtpSent(false);
              }}
              data-testid="button-cancel-verification"
            >
              Cancel
            </Button>
            <Button
              onClick={handleVerifyOtp}
              disabled={!otpSent || otp.length !== 6 || verifyOtpMutation.isPending}
              data-testid="button-confirm-otp"
            >
              {verifyOtpMutation.isPending ? "Verifying..." : "Verify"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
