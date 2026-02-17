import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Package, Sparkles, CheckCircle, Clock, Mail } from "lucide-react";

export default function BetaConfirmation() {
  return (
    <div className="min-h-screen bg-background">
      {/* Confirmation Content */}
      <section className="py-20 px-6">
        <div className="container mx-auto max-w-2xl">
          <div className="text-center space-y-8">
            {/* Success Icon */}
            <div className="flex justify-center">
              <div className="flex items-center justify-center w-20 h-20 bg-green-500/10 rounded-full">
                <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-500" />
              </div>
            </div>

            {/* Main Message */}
            <div className="space-y-4">
              <h1 className="text-4xl md:text-5xl font-bold" data-testid="text-confirmation-title">
                Request Received!
              </h1>
              <p className="text-xl text-muted-foreground">
                Thank you for your interest in MyPODAgent beta access.
              </p>
            </div>

            {/* Info Cards */}
            <div className="space-y-4 mt-8">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex items-center justify-center w-12 h-12 bg-primary/10 rounded-full flex-shrink-0 mt-1">
                      <Mail className="h-6 w-6 text-primary" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-lg mb-2">We've Received Your Request</h3>
                      <p className="text-muted-foreground">
                        Your beta access request has been successfully submitted and is now in our queue for review.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex items-center justify-center w-12 h-12 bg-accent/10 rounded-full flex-shrink-0 mt-1">
                      <Clock className="h-6 w-6 text-accent" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-lg mb-2">What Happens Next?</h3>
                      <p className="text-muted-foreground">
                        We manually approve all beta access requests to ensure the best experience. 
                        You'll hear from us <span className="font-semibold text-foreground">within 24 hours</span> via email with your access details.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Call to Action */}
            <div className="pt-8 space-y-4">
              <p className="text-sm text-muted-foreground">
                In the meantime, feel free to explore what MyPODAgent can do for your POD business.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/">
                  <Button size="lg" data-testid="button-back-home">
                    Back to Home
                  </Button>
                </Link>
                <Link href="/contact">
                  <Button variant="outline" size="lg" data-testid="button-contact">
                    Contact Us
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-6 mt-12">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center">
            <p className="text-xs text-muted-foreground/50">
              Questions? <a href="/contact" className="underline hover:text-primary">Contact us</a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
