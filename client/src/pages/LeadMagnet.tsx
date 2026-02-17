import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Mail, TrendingUp, Zap } from "lucide-react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const emailFormSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  name: z.string().optional(),
});

type EmailFormValues = z.infer<typeof emailFormSchema>;

// Popular POD niches
const POPULAR_NICHES = [
  "fitness enthusiasts",
  "dog lovers",
  "cat owners",
  "teachers",
  "nurses",
  "coffee lovers",
  "gamers",
  "yoga instructors",
  "book lovers",
  "new parents",
  "travel enthusiasts",
  "plant lovers",
  "custom"
] as const;

export default function LeadMagnet() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [productType, setProductType] = useState("mug");
  const [selectedNiche, setSelectedNiche] = useState("fitness enthusiasts");
  const [customNiche, setCustomNiche] = useState("");
  const [tone, setTone] = useState("professional");
  const [generatedIdeas, setGeneratedIdeas] = useState<string[]>([]);
  const [showEmailDialog, setShowEmailDialog] = useState(false);

  // Get the actual niche value (either selected or custom)
  const getNicheValue = () => {
    return selectedNiche === "custom" ? customNiche : selectedNiche;
  };

  const form = useForm<EmailFormValues>({
    resolver: zodResolver(emailFormSchema),
    defaultValues: {
      email: "",
      name: "",
    },
  });

  // Generate ideas mutation
  const generateMutation = useMutation({
    mutationFn: async (data: { productType: string; niche: string; tone: string }) => {
      const response = await apiRequest('/api/lead-magnet/generate', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return response;
    },
    onSuccess: (data: { ideas: string[]; warning?: string }) => {
      setGeneratedIdeas(data.ideas);
      toast({
        title: "Ideas generated!",
        description: data.warning || `${data.ideas.length} creative ideas ready for you.`,
        variant: data.warning ? "default" : "default",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Generation failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Unlock mutation (capture email)
  const unlockMutation = useMutation({
    mutationFn: async (data: EmailFormValues) => {
      const response = await apiRequest('/api/lead-magnet/unlock', {
        method: 'POST',
        body: JSON.stringify({
          email: data.email,
          name: data.name || undefined,
          productType,
          niche: getNicheValue(),
          tone,
          ideas: generatedIdeas,
        }),
      });
      return response;
    },
    onSuccess: (data: { token: string }) => {
      toast({
        title: "Success!",
        description: "Redirecting to your results...",
      });
      setShowEmailDialog(false);
      navigate(`/lead-magnet/results/${data.token}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to save",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleGenerate = () => {
    const nicheValue = getNicheValue();
    
    if (!nicheValue.trim()) {
      toast({
        title: "Niche required",
        description: "Please select or enter a target niche for your POD products",
        variant: "destructive",
      });
      return;
    }

    generateMutation.mutate({
      productType,
      niche: nicheValue,
      tone,
    });
  };

  const handleUnlock = (data: EmailFormValues) => {
    unlockMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4 py-16 max-w-5xl">
        {/* Hero Section */}
        <div className="text-center mb-12 space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <Zap className="h-4 w-4" />
            Free Tool - No Credit Card Required
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
            Start Your Profitable
            <span className="block text-primary mt-2">Etsy Store Today</span>
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Discover 30 unique print-on-demand product ideas tailored to your niche. 
            <span className="block mt-2 font-semibold text-foreground">
              Stop guessing what to sell and start with proven product concepts.
            </span>
          </p>

          <div className="flex items-center justify-center gap-8 pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <span className="text-sm font-medium">Instant Results</span>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">AI-Powered</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-600" />
              <span className="text-sm font-medium">100% Free</span>
            </div>
          </div>
        </div>

        {/* Form Card */}
        <Card className="border-2">
          <CardContent className="pt-8">
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="product-type" className="text-sm font-medium">Product Type</Label>
                  <Select value={productType} onValueChange={setProductType}>
                    <SelectTrigger id="product-type" data-testid="select-product-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mug">Mug</SelectItem>
                      <SelectItem value="tshirt">T-Shirt</SelectItem>
                      <SelectItem value="hoodie">Hoodie</SelectItem>
                      <SelectItem value="poster">Poster</SelectItem>
                      <SelectItem value="tote-bag">Tote Bag</SelectItem>
                      <SelectItem value="phone-case">Phone Case</SelectItem>
                      <SelectItem value="sticker">Sticker</SelectItem>
                      <SelectItem value="notebook">Notebook</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tone" className="text-sm font-medium">Design Tone</Label>
                  <Select value={tone} onValueChange={setTone}>
                    <SelectTrigger id="tone" data-testid="select-tone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="casual">Casual</SelectItem>
                      <SelectItem value="humorous">Humorous</SelectItem>
                      <SelectItem value="inspirational">Inspirational</SelectItem>
                      <SelectItem value="edgy">Edgy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="niche" className="text-sm font-medium">Your Target Niche</Label>
                <Select value={selectedNiche} onValueChange={setSelectedNiche}>
                  <SelectTrigger id="niche" data-testid="select-niche">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fitness enthusiasts">Fitness Enthusiasts</SelectItem>
                    <SelectItem value="dog lovers">Dog Lovers</SelectItem>
                    <SelectItem value="cat owners">Cat Owners</SelectItem>
                    <SelectItem value="teachers">Teachers</SelectItem>
                    <SelectItem value="nurses">Nurses</SelectItem>
                    <SelectItem value="coffee lovers">Coffee Lovers</SelectItem>
                    <SelectItem value="gamers">Gamers</SelectItem>
                    <SelectItem value="yoga instructors">Yoga Instructors</SelectItem>
                    <SelectItem value="book lovers">Book Lovers</SelectItem>
                    <SelectItem value="new parents">New Parents</SelectItem>
                    <SelectItem value="travel enthusiasts">Travel Enthusiasts</SelectItem>
                    <SelectItem value="plant lovers">Plant Lovers</SelectItem>
                    <SelectItem value="custom">Custom Niche...</SelectItem>
                  </SelectContent>
                </Select>
                
                {selectedNiche === "custom" && (
                  <Input
                    id="custom-niche"
                    placeholder="Enter your custom niche (e.g., vintage car collectors)"
                    value={customNiche}
                    onChange={(e) => setCustomNiche(e.target.value)}
                    data-testid="input-custom-niche"
                    className="text-base mt-2"
                  />
                )}
                
                <p className="text-xs text-muted-foreground">
                  {selectedNiche === "custom" 
                    ? "Enter a specific niche for better results"
                    : "Or choose 'Custom Niche...' to enter your own"}
                </p>
              </div>

              <div className="flex justify-center pt-2">
                <Button
                  onClick={handleGenerate}
                  disabled={generateMutation.isPending}
                  size="lg"
                  className="px-8"
                  data-testid="button-generate-ideas"
                >
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      Generating Your Ideas...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5 mr-2" />
                      Generate 30 Free Ideas
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Social Proof / Benefits */}
        {generatedIdeas.length === 0 && (
          <div className="mt-12 text-center space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              <div className="p-6 rounded-lg bg-card border">
                <div className="text-3xl font-bold text-primary mb-2">30</div>
                <div className="font-medium mb-1">Unique Ideas</div>
                <p className="text-sm text-muted-foreground">
                  Tailored to your specific niche and product type
                </p>
              </div>
              
              <div className="p-6 rounded-lg bg-card border">
                <div className="text-3xl font-bold text-primary mb-2">60s</div>
                <div className="font-medium mb-1">Time to Generate</div>
                <p className="text-sm text-muted-foreground">
                  Get instant results powered by advanced AI
                </p>
              </div>
              
              <div className="p-6 rounded-lg bg-card border">
                <div className="text-3xl font-bold text-primary mb-2">$0</div>
                <div className="font-medium mb-1">Completely Free</div>
                <p className="text-sm text-muted-foreground">
                  No credit card, no signup required to start
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Results Section */}
        {generatedIdeas.length > 0 && (
          <Card className="mt-12 relative border-2">
            <CardContent className="pt-8 relative">
              <div className="relative">
                {/* Configuration Header - visible through transparent overlay */}
                <div className="mb-4 p-6 rounded-lg border bg-card">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Product Type:</span>
                      <p className="font-semibold capitalize">{productType}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Target Niche:</span>
                      <p className="font-semibold">{getNicheValue()}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Tone:</span>
                      <p className="font-semibold capitalize">{tone}</p>
                    </div>
                  </div>
                </div>

                {/* Blurred preview with exactly 30 dummy items */}
                <div 
                  className="space-y-3 max-h-96 overflow-hidden blur-[2px] select-none pointer-events-none"
                  aria-hidden="true"
                >
                  {/* Show exactly 30 dummy preview items */}
                  {Array.from({ length: 30 }, (_, index) => {
                    const nicheValue = getNicheValue();
                    return (
                      <div
                        key={index}
                        className="flex items-start gap-3 p-4 rounded-lg border bg-card"
                      >
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                          {index + 1}
                        </div>
                        <div className="flex-1 pt-1.5">
                          <p className="text-sm">
                            {index === 0 && `"Morning Motivation" ${productType} with inspirational quote for ${nicheValue}`}
                            {index === 1 && `${productType.charAt(0).toUpperCase() + productType.slice(1)} featuring custom illustration perfect for ${nicheValue}`}
                            {index === 2 && `Funny ${productType} with witty saying targeting ${nicheValue}`}
                            {index === 3 && `Minimalist design ${productType} with clean typography for ${nicheValue}`}
                            {index === 4 && `Vintage-style ${productType} with retro graphics appealing to ${nicheValue}`}
                            {index > 4 && `Unique ${productType} design concept #${index + 1} tailored for ${nicheValue}...`}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* More transparent overlay - users can see through better */}
                <div className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-sm">
                  <div className="text-center space-y-4 p-8 max-w-md bg-background/95 rounded-lg border-2 border-primary/20 shadow-xl">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                      <Mail className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-2xl font-bold">Your Ideas Are Ready!</h3>
                    <p className="text-muted-foreground">
                      Enter your email to unlock all {generatedIdeas.length} product ideas. 
                      <span className="block mt-1 text-sm">
                        We'll send you the results instantly — no spam, ever.
                      </span>
                    </p>
                    <Button
                      size="lg"
                      onClick={() => setShowEmailDialog(true)}
                      data-testid="button-unlock-results"
                      className="mt-4"
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      Get My Free Ideas Now
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Get Your Free Product Ideas</DialogTitle>
            <DialogDescription>
              Enter your email to unlock your personalized POD ideas instantly.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleUnlock)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="your@email.com"
                        {...field}
                        data-testid="input-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="Your name"
                        {...field}
                        data-testid="input-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={unlockMutation.isPending}
                data-testid="button-submit-email"
              >
                {unlockMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Unlocking...
                  </>
                ) : (
                  "Unlock My Ideas"
                )}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
