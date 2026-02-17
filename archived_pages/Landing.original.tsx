import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Package, Sparkles, Video, Image, FileText, Bot, Layers, Zap, TrendingUp, Clock, Workflow, ArrowRight, CheckCircle } from "lucide-react";
import { SiEtsy, SiAmazon, SiShopify } from "react-icons/si";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative py-20 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/10" />
        <div className="container mx-auto max-w-6xl relative">
          <div className="text-center space-y-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-4">
                <Workflow className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-primary">NEW: Automated Workflows</span>
              </div>
              <h1 className="text-5xl md:text-6xl font-bold tracking-tight" data-testid="text-hero-title">
                Create POD Products AND Listings<br />
                <span className="text-primary">in Minutes, Not Hours</span>
              </h1>
              <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
                Build once, create forever. Automated workflows generate images, videos, and copy in one click
              </p>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                No more juggling tools. Our visual workflow builder creates complete, ready-to-list products for Etsy, Amazon, and Shopify. 
                <span className="font-semibold text-foreground"> Start FREE</span> — no credit card required.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link href="/auth">
                <Button size="lg" className="text-lg px-8" data-testid="button-get-started">
                  Get Started Free
                  <Sparkles className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/contact">
                <Button size="lg" variant="outline" className="text-lg px-8" data-testid="button-contact">
                  Contact Us
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Platforms Section */}
      <section className="py-12 px-6 border-b">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center space-y-6">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Create Listings for All Major Platforms
            </p>
            <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12">
              <div className="flex items-center gap-3 hover-elevate rounded-lg p-3" data-testid="platform-etsy">
                <SiEtsy className="w-10 h-10 text-[#F16521]" />
                <span className="text-lg font-semibold">Etsy</span>
              </div>
              <div className="flex items-center gap-3 hover-elevate rounded-lg p-3" data-testid="platform-amazon">
                <SiAmazon className="w-10 h-10 text-[#FF9900]" />
                <span className="text-lg font-semibold">Amazon</span>
              </div>
              <div className="flex items-center gap-3 hover-elevate rounded-lg p-3" data-testid="platform-shopify">
                <SiShopify className="w-10 h-10 text-[#96bf48]" />
                <span className="text-lg font-semibold">Shopify</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Workflow Automation Section - NEW */}
      <section className="py-20 px-6 bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center space-y-4 mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-primary">GAME CHANGER</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold">
              Automated Workflows:<br />
              <span className="text-primary">Your 24/7 Listing Factory</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Build a workflow once, click execute, and watch as AI generates complete listings with images, videos, and copy — all ready to publish
            </p>
          </div>

          {/* Visual Workflow Diagram */}
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 mb-12">
            <Card className="p-6 text-center space-y-3 flex-1 max-w-xs" data-testid="workflow-step-1">
              <div className="flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mx-auto">
                <Workflow className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-semibold text-lg">1. Build Your Workflow</h3>
              <p className="text-sm text-muted-foreground">Drag and drop modules to create your perfect automation</p>
            </Card>

            <ArrowRight className="hidden md:block h-8 w-8 text-primary" />
            <div className="md:hidden rotate-90">
              <ArrowRight className="h-8 w-8 text-primary" />
            </div>

            <Card className="p-6 text-center space-y-3 flex-1 max-w-xs" data-testid="workflow-step-2">
              <div className="flex items-center justify-center w-16 h-16 bg-accent/10 rounded-2xl mx-auto">
                <Zap className="h-8 w-8 text-accent" />
              </div>
              <h3 className="font-semibold text-lg">2. Click Execute</h3>
              <p className="text-sm text-muted-foreground">One click starts the entire automated process</p>
            </Card>

            <ArrowRight className="hidden md:block h-8 w-8 text-primary" />
            <div className="md:hidden rotate-90">
              <ArrowRight className="h-8 w-8 text-primary" />
            </div>

            <Card className="p-6 text-center space-y-3 flex-1 max-w-xs" data-testid="workflow-step-3">
              <div className="flex items-center justify-center w-16 h-16 bg-green-500/10 rounded-2xl mx-auto">
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
              <h3 className="font-semibold text-lg">3. Get Complete Listings</h3>
              <p className="text-sm text-muted-foreground">AI-generated images, videos, and copy ready to publish</p>
            </Card>
          </div>

          {/* Workflow Benefits */}
          <div className="grid md:grid-cols-3 gap-6 mt-12">
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-primary mr-2" />
                <h4 className="font-semibold">Reusable Templates</h4>
              </div>
              <p className="text-sm text-muted-foreground">Build once, use unlimited times across all your products</p>
            </div>
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-primary mr-2" />
                <h4 className="font-semibold">Batch Processing</h4>
              </div>
              <p className="text-sm text-muted-foreground">Generate content for 10 products as easily as one</p>
            </div>
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-primary mr-2" />
                <h4 className="font-semibold">Consistent Quality</h4>
              </div>
              <p className="text-sm text-muted-foreground">Same professional results, every single time</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6 bg-muted/50">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-3xl md:text-4xl font-bold">Everything You Need to Dominate Your Market</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Professional AI tools that give you an unfair advantage over competitors still doing everything manually
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="hover-elevate border-primary/50 bg-primary/5" data-testid="card-feature-workflows">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center justify-center w-12 h-12 bg-primary/10 rounded-lg">
                    <Workflow className="h-6 w-6 text-primary" />
                  </div>
                  <span className="text-xs font-semibold text-primary px-2 py-1 rounded-full bg-primary/10">NEW</span>
                </div>
                <h3 className="text-xl font-semibold">Automated Workflows</h3>
                <p className="text-muted-foreground">
                  Build visual workflows that generate complete listings automatically. One click creates images, videos, and copy together.
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate" data-testid="card-feature-video">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-center w-12 h-12 bg-primary/10 rounded-lg">
                  <Video className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">AI Video Creation</h3>
                <p className="text-muted-foreground">
                  Turn any product image into scroll-stopping videos in under 60 seconds. No video experience needed.
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate" data-testid="card-feature-image">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-center w-12 h-12 bg-primary/10 rounded-lg">
                  <Image className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Smart Image Editor</h3>
                <p className="text-muted-foreground">
                  Design eye-catching mockups and product photos that make buyers stop scrolling and start buying
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate" data-testid="card-feature-copy">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-center w-12 h-12 bg-primary/10 rounded-lg">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">AI Copywriting</h3>
                <p className="text-muted-foreground">
                  Generate high-converting listings with platform-specific tags for Etsy and Amazon. SEO-optimized in seconds.
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate" data-testid="card-feature-agent">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-center w-12 h-12 bg-primary/10 rounded-lg">
                  <Bot className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">AI Agent Assistant</h3>
                <p className="text-muted-foreground">
                  "Make me a video for my coffee mug" — Your AI assistant understands exactly what you need and delivers instantly
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate" data-testid="card-feature-canvas">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-center w-12 h-12 bg-primary/10 rounded-lg">
                  <Layers className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Canvas Editor</h3>
                <p className="text-muted-foreground">
                  Professional design tools with layers, text, and effects for perfect product mockups
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Demo Videos Section */}
      <section className="py-20 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-3xl md:text-4xl font-bold">See It In Action</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Watch how MyPODAgent transforms your product content creation
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="hover-elevate" data-testid="card-demo-1">
              <CardContent className="p-0">
                <div className="aspect-video bg-muted flex items-center justify-center rounded-t-lg">
                  <div className="text-center space-y-2">
                    <Video className="h-12 w-12 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground px-4">Demo Video 1</p>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold">AI Video Generation</h3>
                  <p className="text-sm text-muted-foreground mt-1">Create product videos from images</p>
                </div>
              </CardContent>
            </Card>

            <Card className="hover-elevate" data-testid="card-demo-2">
              <CardContent className="p-0">
                <div className="aspect-video bg-muted flex items-center justify-center rounded-t-lg">
                  <div className="text-center space-y-2">
                    <Video className="h-12 w-12 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground px-4">Demo Video 2</p>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold">Canvas Editor</h3>
                  <p className="text-sm text-muted-foreground mt-1">Design professional mockups</p>
                </div>
              </CardContent>
            </Card>

            <Card className="hover-elevate" data-testid="card-demo-3">
              <CardContent className="p-0">
                <div className="aspect-video bg-muted flex items-center justify-center rounded-t-lg">
                  <div className="text-center space-y-2">
                    <Video className="h-12 w-12 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground px-4">Demo Video 3</p>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold">AI Assistant</h3>
                  <p className="text-sm text-muted-foreground mt-1">Chat to create content instantly</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-6 bg-muted/50">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-3xl md:text-4xl font-bold">Why Choose MyPODAgent?</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center space-y-3">
              <div className="flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mx-auto">
                <Zap className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">10x Faster</h3>
              <p className="text-muted-foreground">
                What used to take hours now takes minutes. Launch more products, test faster, and scale your POD business
              </p>
            </div>

            <div className="text-center space-y-3">
              <div className="flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mx-auto">
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Higher Conversions</h3>
              <p className="text-muted-foreground">
                Professional-quality content builds trust and drives sales. Look like the big brands without the big budget
              </p>
            </div>

            <div className="text-center space-y-3">
              <div className="flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mx-auto">
                <Clock className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Save Time</h3>
              <p className="text-muted-foreground">
                Focus on growing your business while AI handles content creation
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="container mx-auto max-w-4xl text-center space-y-8">
          <h2 className="text-3xl md:text-4xl font-bold">
            Stop Spending Hours on Content.<br />Start Selling More Products.
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Join POD sellers who are 10x-ing their productivity with AI. Start FREE — upgrade only when you're ready to scale.
          </p>
          <Link href="/auth">
            <Button size="lg" className="text-lg px-8" data-testid="button-cta">
              Start Creating Now
              <Sparkles className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-10 h-10 bg-primary rounded-lg relative">
                <Package className="h-5 w-5 text-primary-foreground" />
                <Sparkles className="h-3 w-3 text-accent absolute -top-0.5 -right-0.5" />
              </div>
              <div>
                <p className="font-semibold">MyPODAgent</p>
                <p className="text-sm text-muted-foreground">AI Print on Demand</p>
              </div>
            </div>
            <div className="flex gap-6">
              <Link href="/pricing">
                <Button variant="ghost" size="sm">Pricing</Button>
              </Link>
              <Link href="/contact">
                <Button variant="ghost" size="sm">Contact</Button>
              </Link>
              <Link href="/auth">
                <Button variant="ghost" size="sm">Login</Button>
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
