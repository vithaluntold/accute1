import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Brain,
  Shield,
  TrendingUp,
  Users,
  Heart,
  Target,
  Zap,
  Globe2,
  Eye,
  EyeOff,
  Info,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useFeatureAccess } from "@/hooks/use-subscription";
import { Link } from "wouter";

type PersonalityProfile = {
  userId: string;
  bigFiveTraits: {
    openness: number;
    conscientiousness: number;
    extraversion: number;
    agreeableness: number;
    neuroticism: number;
  } | null;
  discProfile: {
    dominance: number;
    influence: number;
    steadiness: number;
    conscientiousness: number;
  } | null;
  mbtiType: string | null;
  emotionalIntelligence: {
    selfAwareness: number;
    selfRegulation: number;
    motivation: number;
    empathy: number;
    socialSkills: number;
  } | null;
  hofstedeFactors: {
    powerDistance: number;
    individualismCollectivism: number;
    masculinityFemininity: number;
    uncertaintyAvoidance: number;
    longTermOrientation: number;
  } | null;
  culturalContext: string | null;
  confidenceScore: number;
  lastAnalyzedAt: string | null;
  conversationsAnalyzed: number;
};

type ConsentStatus = {
  userId: string;
  hasConsented: boolean;
  consentedAt: string | null;
};

export default function PersonalityProfile() {
  const { toast } = useToast();
  const [showRawScores, setShowRawScores] = useState(false);

  // Check if organization has access to personality assessment feature
  const { hasAccess: hasPersonalityAssessment, isLoading: isCheckingAccess } = useFeatureAccess('personality_assessment');

  // Fetch user's consent status (only if they have access to the feature)
  const { data: consent } = useQuery<ConsentStatus>({
    queryKey: ["/api/personality-profiling/consent"],
    enabled: hasPersonalityAssessment,
  });

  // Fetch user's personality profile
  const { data: profile, isLoading } = useQuery<PersonalityProfile>({
    queryKey: ["/api/personality-profiling/profiles/me"],
    enabled: hasPersonalityAssessment && consent?.hasConsented === true,
  });

  // Update consent mutation
  const updateConsentMutation = useMutation({
    mutationFn: async (hasConsented: boolean) => {
      return await apiRequest<ConsentStatus>("/api/personality-profiling/consent", {
        method: "POST",
        body: JSON.stringify({ hasConsented }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Consent Updated",
        description: "Your personality analysis preferences have been saved.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/personality-profiling/consent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/personality-profiling/profiles/me"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update consent",
        variant: "destructive",
      });
    },
  });

  const getTraitInterpretation = (score: number, traitName: string): string => {
    if (score >= 0.7) return `High ${traitName}`;
    if (score >= 0.4) return `Moderate ${traitName}`;
    return `Low ${traitName}`;
  };

  const getTraitDescription = (framework: string, trait: string, score: number): string => {
    const descriptions: Record<string, Record<string, { high: string; low: string }>> = {
      bigFive: {
        openness: {
          high: "You're creative, curious, and open to new experiences.",
          low: "You prefer familiar routines and practical approaches.",
        },
        conscientiousness: {
          high: "You're organized, dependable, and goal-oriented.",
          low: "You're flexible and spontaneous in your approach.",
        },
        extraversion: {
          high: "You're energized by social interactions and group activities.",
          low: "You prefer quiet reflection and one-on-one interactions.",
        },
        agreeableness: {
          high: "You're cooperative, empathetic, and value harmony.",
          low: "You're direct and prioritize honesty over politeness.",
        },
        neuroticism: {
          high: "You're emotionally responsive and thoughtful about challenges.",
          low: "You remain calm and resilient under pressure.",
        },
      },
      disc: {
        dominance: {
          high: "You're decisive, results-oriented, and take charge confidently.",
          low: "You're collaborative and seek consensus in decision-making.",
        },
        influence: {
          high: "You're persuasive, enthusiastic, and build relationships easily.",
          low: "You're reserved and prefer facts over emotional appeals.",
        },
        steadiness: {
          high: "You're patient, supportive, and value stability.",
          low: "You're dynamic and thrive in fast-paced environments.",
        },
        conscientiousness: {
          high: "You're detail-oriented, analytical, and value accuracy.",
          low: "You're flexible and comfortable with ambiguity.",
        },
      },
      ei: {
        selfAwareness: {
          high: "You understand your emotions and their impact well.",
          low: "You may benefit from reflecting on your emotional patterns.",
        },
        selfRegulation: {
          high: "You manage your emotions effectively under stress.",
          low: "You may react impulsively to challenging situations.",
        },
        motivation: {
          high: "You're driven by internal goals and persist through challenges.",
          low: "You may need external motivation to maintain momentum.",
        },
        empathy: {
          high: "You understand and respond to others' emotions effectively.",
          low: "You may focus more on tasks than interpersonal dynamics.",
        },
        socialSkills: {
          high: "You build rapport and influence others naturally.",
          low: "You may prefer independent work over team collaboration.",
        },
      },
    };

    const frameworkDescs = descriptions[framework];
    if (!frameworkDescs || !frameworkDescs[trait]) return "";

    return score >= 0.5 ? frameworkDescs[trait].high : frameworkDescs[trait].low;
  };

  // Show upgrade message if user doesn't have access to personality assessment
  if (!isCheckingAccess && !hasPersonalityAssessment) {
    return (
      <div className="container mx-auto py-6 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-6 h-6" />
              Personality Assessment - Enterprise Feature
            </CardTitle>
            <CardDescription>
              Unlock advanced AI personality profiling for your organization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert>
              <Info className="w-4 h-4" />
              <AlertDescription>
                <strong>Enterprise Feature:</strong> AI Personality Assessment requires an Enterprise subscription.
                Upgrade to unlock multi-framework personality analysis for your team.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <h3 className="font-semibold">Included with Enterprise:</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <Brain className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary" />
                  <span><strong>5 Psychology Frameworks:</strong> Big Five, DISC, MBTI, Emotional Intelligence, Cultural Dimensions</span>
                </li>
                <li className="flex items-start gap-2">
                  <TrendingUp className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary" />
                  <span><strong>Performance Correlations:</strong> See how personality traits correlate with team performance</span>
                </li>
                <li className="flex items-start gap-2">
                  <Shield className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary" />
                  <span><strong>Privacy-First:</strong> GDPR-compliant with no raw message storage</span>
                </li>
                <li className="flex items-start gap-2">
                  <Zap className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary" />
                  <span><strong>ML Model Fusion:</strong> 95%+ token cost reduction with hybrid analysis</span>
                </li>
              </ul>
            </div>

            <div className="pt-4 border-t">
              <Button asChild data-testid="button-upgrade">
                <Link href="/admin/billing">
                  Upgrade to Enterprise
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isCheckingAccess || !consent) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="animate-pulse">Loading...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!consent.hasConsented) {
    return (
      <div className="container mx-auto py-6 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-6 h-6" />
              AI Personality Profiling
            </CardTitle>
            <CardDescription>
              Understand your work personality and communication style
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert>
              <Shield className="w-4 h-4" />
              <AlertDescription>
                <strong>Privacy First:</strong> We analyze your conversation patterns to provide personality insights
                that can help you understand your work style and improve collaboration. We only store aggregated
                metrics—never your actual messages.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <h3 className="font-semibold">What we analyze:</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span><strong>Big Five Personality:</strong> Openness, Conscientiousness, Extraversion, Agreeableness, Neuroticism</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span><strong>DISC Profile:</strong> Dominance, Influence, Steadiness, Compliance</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span><strong>Emotional Intelligence:</strong> Self-awareness, Empathy, Social Skills</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span><strong>Cultural Dimensions:</strong> Communication preferences based on cultural context</span>
                </li>
              </ul>
            </div>

            <div className="pt-4 border-t">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="consent-switch" className="text-base">
                    Enable personality analysis
                  </Label>
                  <div className="text-sm text-muted-foreground">
                    You can opt-out at any time from your settings
                  </div>
                </div>
                <Switch
                  id="consent-switch"
                  checked={false}
                  onCheckedChange={(checked) => updateConsentMutation.mutate(checked)}
                  disabled={updateConsentMutation.isPending}
                  data-testid="switch-consent"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading || !profile) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center space-y-2">
              <Brain className="w-12 h-12 animate-pulse mx-auto" />
              <p>Analyzing your personality profile...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2" data-testid="text-page-title">
            <Brain className="w-8 h-8" />
            My Personality Profile
          </h1>
          <p className="text-muted-foreground">
            Based on {profile.conversationsAnalyzed} conversations •
            Last updated {profile.lastAnalyzedAt ? new Date(profile.lastAnalyzedAt).toLocaleDateString() : "Never"}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="raw-scores" className="text-sm">
              {showRawScores ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </Label>
            <Switch
              id="raw-scores"
              checked={showRawScores}
              onCheckedChange={setShowRawScores}
              data-testid="switch-raw-scores"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => updateConsentMutation.mutate(false)}
            data-testid="button-disable-analysis"
          >
            Disable Analysis
          </Button>
        </div>
      </div>

      {/* Confidence Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Analysis Confidence
          </CardTitle>
          <CardDescription>
            How confident we are in this personality assessment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">Confidence Score</span>
              <span className="font-semibold">{Math.round(profile.confidenceScore * 100)}%</span>
            </div>
            <Progress value={profile.confidenceScore * 100} className="h-2" />
            <p className="text-xs text-muted-foreground">
              Based on {profile.conversationsAnalyzed} conversations.
              {profile.confidenceScore < 0.5 && " More data will improve accuracy."}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Personality Frameworks */}
      <Tabs defaultValue="bigfive" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="bigfive" data-testid="tab-bigfive">
            <Zap className="w-4 h-4" />
            Big Five
          </TabsTrigger>
          <TabsTrigger value="disc" data-testid="tab-disc">
            <Users className="w-4 h-4" />
            DISC
          </TabsTrigger>
          <TabsTrigger value="mbti" data-testid="tab-mbti">
            <Brain className="w-4 h-4" />
            MBTI
          </TabsTrigger>
          <TabsTrigger value="ei" data-testid="tab-ei">
            <Heart className="w-4 h-4" />
            EQ
          </TabsTrigger>
          <TabsTrigger value="culture" data-testid="tab-culture">
            <Globe2 className="w-4 h-4" />
            Culture
          </TabsTrigger>
        </TabsList>

        {/* Big Five */}
        <TabsContent value="bigfive" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Big Five Personality Traits</CardTitle>
              <CardDescription>
                The most scientifically validated personality framework
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {profile.bigFiveTraits && Object.entries(profile.bigFiveTraits).map(([trait, score]) => (
                <div key={trait} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="font-medium capitalize">{trait}</div>
                      {!showRawScores && (
                        <div className="text-sm text-muted-foreground">
                          {getTraitDescription("bigFive", trait, score)}
                        </div>
                      )}
                    </div>
                    <Badge variant="outline" data-testid={`badge-${trait}-score`}>
                      {showRawScores ? Math.round(score * 100) + "%" : getTraitInterpretation(score, trait)}
                    </Badge>
                  </div>
                  <Progress value={score * 100} className="h-2" />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* DISC */}
        <TabsContent value="disc" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>DISC Behavioral Profile</CardTitle>
              <CardDescription>
                How you approach tasks and interact with others
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {profile.discProfile && Object.entries(profile.discProfile).map(([trait, score]) => (
                <div key={trait} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="font-medium capitalize">{trait}</div>
                      {!showRawScores && (
                        <div className="text-sm text-muted-foreground">
                          {getTraitDescription("disc", trait, score)}
                        </div>
                      )}
                    </div>
                    <Badge variant="outline" data-testid={`badge-disc-${trait}-score`}>
                      {showRawScores ? Math.round(score * 100) + "%" : getTraitInterpretation(score, trait)}
                    </Badge>
                  </div>
                  <Progress value={score * 100} className="h-2" />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* MBTI */}
        <TabsContent value="mbti" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Myers-Briggs Type</CardTitle>
              <CardDescription>
                Your predicted personality type based on conversation patterns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <div className="text-6xl font-bold mb-4" data-testid="text-mbti-type">
                  {profile.mbtiType || "Analyzing..."}
                </div>
                {profile.mbtiType && (
                  <p className="text-muted-foreground">
                    This is a predicted type based on your communication patterns.
                    <br />
                    Consider taking an official MBTI assessment for confirmation.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Emotional Intelligence */}
        <TabsContent value="ei" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Emotional Intelligence</CardTitle>
              <CardDescription>
                Your ability to understand and manage emotions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {profile.emotionalIntelligence && Object.entries(profile.emotionalIntelligence).map(([trait, score]) => (
                <div key={trait} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="font-medium capitalize">{trait.replace(/([A-Z])/g, ' $1').trim()}</div>
                      {!showRawScores && (
                        <div className="text-sm text-muted-foreground">
                          {getTraitDescription("ei", trait, score)}
                        </div>
                      )}
                    </div>
                    <Badge variant="outline" data-testid={`badge-ei-${trait}-score`}>
                      {showRawScores ? Math.round(score * 100) + "%" : getTraitInterpretation(score, trait)}
                    </Badge>
                  </div>
                  <Progress value={score * 100} className="h-2" />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cultural Dimensions */}
        <TabsContent value="culture" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cultural Communication Style</CardTitle>
              <CardDescription>
                Hofstede's cultural dimensions based on location and patterns
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {profile.culturalContext && (
                <Alert>
                  <Globe2 className="w-4 h-4" />
                  <AlertDescription>
                    <strong>Cultural Context:</strong> {profile.culturalContext}
                  </AlertDescription>
                </Alert>
              )}

              {profile.hofstedeFactors && Object.entries(profile.hofstedeFactors).map(([factor, score]) => (
                <div key={factor} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-medium capitalize">
                      {factor.replace(/([A-Z])/g, ' $1').trim()}
                    </div>
                    <Badge variant="outline" data-testid={`badge-culture-${factor}-score`}>
                      {showRawScores ? Math.round(score * 100) + "%" : getTraitInterpretation(score, factor)}
                    </Badge>
                  </div>
                  <Progress value={score * 100} className="h-2" />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
