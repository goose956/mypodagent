import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Sparkles, Zap, Rocket } from "lucide-react";

export default function Pricing() {
  const plans = [
    {
      name: "Free",
      price: "$0",
      period: "forever",
      description: "Perfect for trying out MyPODAgent",
      icon: Sparkles,
      credits: "50 credits/month",
      features: [
        "5 AI video generations",
        "10 AI image creations",
        "20 AI copywriting requests",
        "Access to Canvas Editor",
        "Basic asset library",
        "Community support",
      ],
      cta: "Start Free",
      highlighted: false,
      testId: "card-plan-free",
    },
    {
      name: "Pro",
      price: "$29",
      period: "/month",
      description: "For serious POD sellers ready to scale",
      icon: Zap,
      credits: "500 credits/month",
      features: [
        "50 AI video generations",
        "100 AI image creations",
        "200 AI copywriting requests",
        "Priority AI processing",
        "Unlimited canvas projects",
        "Advanced asset library",
        "Priority email support",
        "Etsy & Amazon tag optimization",
      ],
      cta: "Start Pro Trial",
      highlighted: true,
      testId: "card-plan-pro",
    },
    {
      name: "Business",
      price: "$99",
      period: "/month",
      description: "For agencies and high-volume sellers",
      icon: Rocket,
      credits: "2000 credits/month",
      features: [
        "200 AI video generations",
        "400 AI image creations",
        "800 AI copywriting requests",
        "Fastest AI processing",
        "Unlimited everything",
        "Team collaboration tools",
        "API access",
        "Dedicated account manager",
        "Custom integrations",
      ],
      cta: "Contact Sales",
      highlighted: false,
      testId: "card-plan-business",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative py-20 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/10" />
        <div className="container mx-auto max-w-6xl relative">
          <div className="text-center space-y-6">
            <Badge className="mx-auto" data-testid="badge-pricing-hero">
              Simple, Transparent Pricing
            </Badge>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight" data-testid="text-pricing-title">
              Start Free, Scale When Ready
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              No credit card required to start. Upgrade anytime to unlock more credits and features.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-12 px-6">
        <div className="container mx-auto max-w-7xl">
          <div className="grid md:grid-cols-3 gap-8">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={`hover-elevate relative ${
                  plan.highlighted
                    ? "border-primary shadow-lg scale-105"
                    : ""
                }`}
                data-testid={plan.testId}
              >
                {plan.highlighted && (
                  <div className="absolute -top-4 left-0 right-0 flex justify-center">
                    <Badge className="bg-primary text-primary-foreground px-6 py-1" data-testid="badge-most-popular">
                      Most Popular
                    </Badge>
                  </div>
                )}
                <CardHeader className="text-center space-y-4 pt-8">
                  <div className="flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mx-auto">
                    <plan.icon className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl" data-testid={`text-plan-name-${plan.name.toLowerCase()}`}>
                      {plan.name}
                    </CardTitle>
                    <CardDescription className="mt-2">
                      {plan.description}
                    </CardDescription>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-4xl font-bold" data-testid={`text-price-${plan.name.toLowerCase()}`}>
                        {plan.price}
                      </span>
                      <span className="text-muted-foreground">{plan.period}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{plan.credits}</p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-3">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Link href="/auth" className="w-full">
                    <Button
                      size="lg"
                      variant={plan.highlighted ? "default" : "outline"}
                      className="w-full"
                      data-testid={`button-select-${plan.name.toLowerCase()}`}
                    >
                      {plan.cta}
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Credit Usage Explanation */}
      <section className="py-20 px-6 bg-muted/50">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center space-y-8">
            <h2 className="text-3xl md:text-4xl font-bold">How Credits Work</h2>
            <div className="grid md:grid-cols-3 gap-6 text-left">
              <Card data-testid="card-credit-video">
                <CardContent className="p-6 space-y-2">
                  <div className="font-semibold flex items-center gap-2">
                    <span className="text-2xl font-bold text-primary">10</span>
                    <span>credits</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Per AI video generation (60 seconds of professional video content)
                  </p>
                </CardContent>
              </Card>
              <Card data-testid="card-credit-image">
                <CardContent className="p-6 space-y-2">
                  <div className="font-semibold flex items-center gap-2">
                    <span className="text-2xl font-bold text-primary">5</span>
                    <span>credits</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Per AI image creation (high-resolution product images and mockups)
                  </p>
                </CardContent>
              </Card>
              <Card data-testid="card-credit-copy">
                <CardContent className="p-6 space-y-2">
                  <div className="font-semibold flex items-center gap-2">
                    <span className="text-2xl font-bold text-primary">2-3</span>
                    <span>credits</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Per AI copywriting request (full product listings with tags)
                  </p>
                </CardContent>
              </Card>
            </div>
            <p className="text-muted-foreground">
              Credits reset monthly. Unused credits don't roll over, so pick the plan that matches your volume.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-6">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            <Card data-testid="card-faq-1">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">Is the free plan really free forever?</h3>
                <p className="text-sm text-muted-foreground">
                  Yes! No credit card required. Start creating immediately with 50 credits per month. Perfect for testing the platform and creating content for a few products.
                </p>
              </CardContent>
            </Card>
            <Card data-testid="card-faq-2">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">Can I cancel anytime?</h3>
                <p className="text-sm text-muted-foreground">
                  Absolutely. Cancel your subscription anytime with no questions asked. You'll keep access until the end of your billing period.
                </p>
              </CardContent>
            </Card>
            <Card data-testid="card-faq-3">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">What happens if I run out of credits?</h3>
                <p className="text-sm text-muted-foreground">
                  You can upgrade to a higher plan anytime, or purchase additional credit packs. We'll notify you when you're running low so you're never caught off guard.
                </p>
              </CardContent>
            </Card>
            <Card data-testid="card-faq-4">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">Do you offer refunds?</h3>
                <p className="text-sm text-muted-foreground">
                  We offer a 7-day money-back guarantee on all paid plans. If you're not satisfied, contact support for a full refund.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-muted/50">
        <div className="container mx-auto max-w-4xl text-center space-y-8">
          <h2 className="text-3xl md:text-4xl font-bold">
            Ready to Create Better Content Faster?
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Start with our free plan. No credit card. No risk. Just results.
          </p>
          <Link href="/auth">
            <Button size="lg" className="text-lg px-8" data-testid="button-cta-pricing">
              Get Started Free
              <Sparkles className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
