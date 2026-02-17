import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function BetaLogin() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  
  const [loginData, setLoginData] = useState({ username: "", password: "" });
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login(loginData.username, loginData.password);
      toast({
        title: "Welcome to MyPODAgent Beta!",
        description: "You've successfully logged in.",
      });
      setLocation("/dashboard");
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message || "Invalid credentials. Please check your username and password.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" />
      
      <div className="w-full max-w-md relative">
        <div className="flex flex-col items-center justify-center gap-3 mb-8">
          <div className="flex items-center justify-center w-16 h-16 bg-primary rounded-2xl relative">
            <Package className="h-8 w-8 text-primary-foreground" />
            <Sparkles className="h-4 w-4 text-accent absolute -top-1 -right-1" />
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-bold">MyPODAgent</h1>
            <p className="text-sm text-muted-foreground mt-1">Beta Access Login</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Beta Tester Login</CardTitle>
            <CardDescription>Sign in with your beta tester credentials</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-username">Username</Label>
                <Input
                  id="login-username"
                  data-testid="input-beta-username"
                  type="text"
                  placeholder="Your username"
                  value={loginData.username}
                  onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Password</Label>
                <Input
                  id="login-password"
                  data-testid="input-beta-password"
                  type="password"
                  placeholder="Your password"
                  value={loginData.password}
                  onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                  required
                />
              </div>
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading}
                data-testid="button-beta-login"
              >
                {isLoading ? "Signing in..." : "Access Beta"}
                <Sparkles className="ml-2 h-4 w-4" />
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Don't have beta access yet?{" "}
                <a href="/" className="text-primary hover:underline">
                  Request access
                </a>
              </p>
            </div>
          </CardContent>
        </Card>

        <p className="text-xs text-center text-muted-foreground mt-4">
          Having trouble? Contact support for assistance.
        </p>
      </div>
    </div>
  );
}
