import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Package, Sparkles, Video, Image, FileText, CheckCircle, Workflow, Palette, Zap, Quote, AlertCircle, Clock, Frown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function Landing() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: signupMode } = useQuery<{ mode: string }>({
    queryKey: ["/api/settings/signup-mode"],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await apiRequest('/api/beta-signup', {
        method: 'POST',
        body: JSON.stringify({
          name,
          email
        })
      });

      // Redirect to confirmation page
      setLocation('/beta-confirmation');
    } catch (error: any) {
      toast({
        title: "Signup Failed",
        description: error.message || "Please try again or contact us directly.",
        variant: "destructive"
      });
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative py-20 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/10" />
        <div className="container mx-auto max-w-4xl relative">
          <div className="text-center space-y-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-4">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-primary">BETA TESTING NOW</span>
              </div>
              <h1 className="text-5xl md:text-6xl font-bold tracking-tight" data-testid="text-hero-title">
                POD sellers create <span className="underline decoration-primary decoration-2 underline-offset-4">products</span><br />
                AND <span className="underline decoration-primary decoration-2 underline-offset-4">product listings</span> in<br />
                <span className="text-primary">minutes not hours</span>
              </h1>
              <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
                Transform product ideas into complete Etsy, Amazon, and Shopify listings with AI-powered workflows. Generate professional videos, eye-catching images, and SEO-optimized copy—all in one platform. No design skills needed.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Beta Signup CTA */}
      <section className="py-16 px-6">
        <div className="container mx-auto max-w-md">
          <Card className="border-primary/50">
            <CardContent className="p-8 space-y-6">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold">
                  {signupMode?.mode === 'waitlist' ? 'Join the Waiting List' : 'Join the Beta'}
                </h2>
                <p className="text-muted-foreground">
                  {signupMode?.mode === 'waitlist' 
                    ? 'Get notified when new spots open up'
                    : 'Be among the first to experience the future of POD content creation'}
                </p>
              </div>

              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    className="w-full" 
                    size="lg"
                    data-testid="button-open-signup"
                  >
                    {signupMode?.mode === 'waitlist' ? 'Join Waiting List' : 'Request Beta Access'}
                    <Sparkles className="ml-2 h-5 w-5" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>
                      {signupMode?.mode === 'waitlist' ? 'Join the Waiting List' : 'Join the Beta'}
                    </DialogTitle>
                    <DialogDescription>
                      {signupMode?.mode === 'waitlist' 
                        ? "We'll notify you as soon as spots become available."
                        : "Enter your details to get early access to MyPODAgent."}
                    </DialogDescription>
                  </DialogHeader>

                  <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="dialog-name">Name</Label>
                      <Input
                        id="dialog-name"
                        type="text"
                        placeholder="Your name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        data-testid="input-beta-name"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="dialog-email">Email</Label>
                      <Input
                        id="dialog-email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        data-testid="input-beta-email"
                      />
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={isSubmitting}
                      data-testid="button-beta-signup"
                    >
                      {isSubmitting ? "Submitting..." : signupMode?.mode === 'waitlist' ? 'Join Waiting List' : 'Request Beta Access'}
                      <Sparkles className="ml-2 h-4 w-4" />
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Main Features Section */}
      <section className="py-16 px-6 bg-muted/50">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-3xl md:text-4xl font-bold">
              Two Powerful Ways to Create<br />
              <span className="text-primary">Professional POD Products</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Design with AI on our canvas or automate everything with one-click workflows
            </p>
          </div>

          {/* Main Two Features - Larger Cards */}
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <Card className="hover-elevate border-primary/50">
              <CardContent className="p-8 space-y-4">
                <div className="flex items-center justify-center w-16 h-16 bg-primary/10 rounded-lg mx-auto">
                  <Palette className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-2xl font-bold text-center">AI Canvas Designer</h3>
                <p className="text-base text-muted-foreground text-center">
                  Design ANY POD product with AI assistance—mugs, hats, t-shirts, hoodies, phone cases, and more. Start with a blank canvas or upload your artwork, then chat with AI to transform, enhance, and perfect your designs with simple text commands. Integrated with Printful for seamless product creation.
                </p>
                <div className="flex items-center justify-center gap-2 text-sm text-primary font-medium">
                  <Sparkles className="h-4 w-4" />
                  <span>Design any product from mugs to t-shirts</span>
                </div>
              </CardContent>
            </Card>

            <Card className="hover-elevate border-primary/50">
              <CardContent className="p-8 space-y-4">
                <div className="flex items-center justify-center w-16 h-16 bg-primary/10 rounded-lg mx-auto">
                  <Zap className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-2xl font-bold text-center">One-Click Workflows</h3>
                <p className="text-base text-muted-foreground text-center">
                  Build a workflow once, use it unlimited times. Click one button to generate product images, promotional videos, and SEO-optimized copy for Etsy, Amazon, or Shopify—all automatically. Complete listings in seconds.
                </p>
                <div className="flex items-center justify-center gap-2 text-sm text-primary font-medium">
                  <Workflow className="h-4 w-4" />
                  <span>Complete listings with 1 click</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Founder Quote Section */}
      <section className="py-16 px-6 bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <div className="container mx-auto max-w-4xl">
          <div className="relative">
            {/* Quote Icon Background */}
            <div className="absolute -top-4 -left-2 md:-left-4">
              <Quote className="h-16 w-16 md:h-20 md:w-20 text-primary/10" />
            </div>
            
            <Card className="border-primary/20 shadow-lg">
              <CardContent className="p-8 md:p-12 relative">
                {/* Solutions Badges */}
                <div className="flex flex-wrap gap-3 mb-6 justify-center items-center">
                  <p className="text-sm font-bold text-green-600 dark:text-green-500">SOLVED:</p>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 rounded-full">
                    <span className="text-xs font-semibold text-green-600 dark:text-green-500">Product creation</span>
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-500" />
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 rounded-full">
                    <span className="text-xs font-semibold text-green-600 dark:text-green-500">Listing creation</span>
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-500" />
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 rounded-full">
                    <span className="text-xs font-semibold text-green-600 dark:text-green-500">One platform, no tool switching</span>
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-500" />
                  </div>
                </div>

                <blockquote className="space-y-4">
                  <p className="text-lg md:text-xl text-foreground leading-relaxed italic">
                    "I built MyPODAgent for myself because I know the <span className="font-semibold text-destructive">utter pain</span> of creating POD products AND listings. The process is soul-destroying: you come up with a product idea, write listing copy, create half a dozen different product shots, then make a product video. Hours disappear into repetitive tasks."
                  </p>
                  <p className="text-lg md:text-xl text-foreground leading-relaxed italic">
                    "MyPODAgent solves these issues. Now what used to take hours happens in minutes. <span className="font-semibold text-primary">Now one click and I have my WHOLE listings created for Etsy AND Amazon.</span>"
                  </p>
                </blockquote>

                <div className="mt-8 pt-6 border-t border-border/50">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-12 h-12 bg-primary rounded-full">
                      <span className="text-xl font-bold text-primary-foreground">R</span>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Richard</p>
                      <p className="text-sm text-muted-foreground">Creator of MyPODAgent</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 px-6">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold mb-2">Why POD Sellers Love MyPODAgent</h2>
          </div>
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <CheckCircle className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-lg font-semibold mb-1">Design Any POD Product with AI Canvas</h3>
                <p className="text-muted-foreground">
                  Create designs for mugs, t-shirts, hoodies, hats, phone cases—any POD product. Chat with AI to transform and enhance your artwork with simple commands. Integrated with Printful for seamless production.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <CheckCircle className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-lg font-semibold mb-1">Complete Listings with One Button Click</h3>
                <p className="text-muted-foreground">
                  Set up a workflow once, then generate images, videos, and copy for unlimited products. What used to take hours per listing now happens in seconds automatically.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <CheckCircle className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-lg font-semibold mb-1">Save 20+ Hours Per Week on Content Creation</h3>
                <p className="text-muted-foreground">
                  Stop spending time on repetitive tasks. Use our AI canvas for custom designs and workflows for bulk production. Focus on growing your business instead.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-6">
        <div className="container mx-auto max-w-4xl">
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-10 h-10 bg-primary rounded-lg relative">
                <Package className="h-5 w-5 text-primary-foreground" />
                <Sparkles className="h-3 w-3 text-accent absolute -top-0.5 -right-0.5" />
              </div>
              <div>
                <p className="font-semibold">MyPODAgent</p>
                <p className="text-sm text-muted-foreground">From Idea to Listing in Minutes</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Beta access is limited. Sign up now to secure your spot.
            </p>
            <p className="text-xs text-muted-foreground/50">
              Already have access? <a href="/beta-login" className="underline hover:text-primary">Login here</a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
