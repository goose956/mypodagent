import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, Copy, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export default function LeadMagnetResults() {
  const [, params] = useRoute("/lead-magnet/results/:token");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const token = params?.token;

  const { data, isLoading, error } = useQuery<{
    email: string;
    name?: string;
    productType: string;
    niche: string;
    tone: string;
    ideas: string[];
  }>({
    queryKey: ['/api/lead-magnet/results', token],
    enabled: !!token,
  });

  const handleCopyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIndex(index);
      toast({
        title: "Copied!",
        description: "Idea copied to clipboard",
      });
      setTimeout(() => setCopiedIndex(null), 2000);
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your ideas...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Results Not Found</CardTitle>
            <CardDescription>
              This link may have expired or is invalid.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/lead-magnet')} className="w-full">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Generate New Ideas
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/lead-magnet')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Generate More Ideas
          </Button>
          
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <h1 className="text-3xl font-bold">Your POD Ideas Are Ready!</h1>
          </div>
          
          {data.name && (
            <p className="text-lg text-muted-foreground">
              Hi {data.name}! Here are your personalized ideas.
            </p>
          )}
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Your Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Product Type:</span>
                <p className="font-semibold capitalize">{data.productType}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Target Niche:</span>
                <p className="font-semibold">{data.niche}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Tone:</span>
                <p className="font-semibold capitalize">{data.tone}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your 30 Unique POD Ideas</CardTitle>
            <CardDescription>
              Click the copy icon to save any idea to your clipboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.ideas.map((idea, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-4 rounded-lg border bg-card hover-elevate group"
                  data-testid={`idea-${index + 1}`}
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1 pt-1.5">
                    <p className="text-sm">{idea}</p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleCopyToClipboard(idea, index)}
                    className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    data-testid={`button-copy-${index + 1}`}
                  >
                    {copiedIndex === index ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            Want more ideas? Generate another batch!
          </p>
          <Button onClick={() => navigate('/lead-magnet')}>
            Generate More Ideas
          </Button>
        </div>
      </div>
    </div>
  );
}
