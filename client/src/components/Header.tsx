import { Package, Sparkles, Shield, LogOut, User, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/lib/auth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import IconNav from '@/components/IconNav';

export default function Header() {
  const [location, navigate] = useLocation();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  
  // Beta routes should have minimal header (no navigation)
  const betaRoutes = ['/', '/beta-login', '/beta-confirmation'];
  const isBetaRoute = betaRoutes.some(route => location === route);
  
  // Show public nav on public pages, member nav on protected routes
  const publicRoutes = ['/contact', '/pricing', '/auth'];
  const isOnPublicRoute = publicRoutes.some(route => location === route || location.startsWith(route + '/'));
  const showMemberNav = !isOnPublicRoute && !isBetaRoute && user;

  const handleLogout = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
      logout();
      navigate('/auth');
      toast({
        title: 'Logged out',
        description: 'You have been logged out successfully.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to log out. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="flex h-16 items-center justify-between px-6">
          <Link href={showMemberNav ? "/pod-workflows" : "/"}>
            <div className="flex items-center space-x-3 hover-elevate rounded-lg p-2 -m-2 cursor-pointer">
              <div className="flex items-center justify-center w-10 h-10 bg-primary rounded-lg relative">
                <Package className="h-5 w-5 text-primary-foreground" />
                <Sparkles className="h-3 w-3 text-accent absolute -top-0.5 -right-0.5" />
              </div>
              <div>
                <h1 className="text-xl font-bold">MyPODAgent</h1>
                <p className="text-xs text-muted-foreground">From Idea to Listing in Minutes</p>
              </div>
            </div>
          </Link>

          <div className="flex items-center space-x-4">
            {/* Public Navigation (Non-authenticated users) - Hidden on beta routes */}
            {!showMemberNav && !isBetaRoute && (
              <>
                <div className="hidden md:flex items-center space-x-2">
                  <Link href="/">
                    <Button 
                      variant={location === '/' ? 'default' : 'ghost'} 
                      size="sm"
                      data-testid="nav-button-home"
                    >
                      Home
                    </Button>
                  </Link>
                  <Link href="/pricing">
                    <Button 
                      variant={location === '/pricing' ? 'default' : 'ghost'} 
                      size="sm"
                      data-testid="nav-button-pricing"
                    >
                      Pricing
                    </Button>
                  </Link>
                  <Link href="/contact">
                    <Button 
                      variant={location === '/contact' ? 'default' : 'ghost'} 
                      size="sm"
                      data-testid="nav-button-contact"
                    >
                      Contact
                    </Button>
                  </Link>
                </div>
                <Link href="/auth">
                  <Button size="sm" data-testid="nav-button-login">
                    Login
                  </Button>
                </Link>
              </>
            )}

            {/* Authenticated Navigation */}
            {showMemberNav && (
              <>
                <div className="flex items-center space-x-2">
                  {(user as any)?.isAdmin && (
                    <Link href="/admin">
                      <Button 
                        variant={location === '/admin' ? 'default' : 'ghost'} 
                        size="sm"
                        data-testid="nav-button-admin"
                      >
                        <Shield className="w-4 h-4 mr-2" />
                        Admin
                      </Button>
                    </Link>
                  )}

                  {/* User Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" data-testid="button-user-menu">
                        <User className="w-4 h-4 mr-2" />
                        {user?.username || 'Dev Mode'}
                        <ChevronDown className="w-3 h-3 ml-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <Link href="/account">
                        <DropdownMenuItem data-testid="nav-menu-account" className="cursor-pointer">
                          <User className="w-4 h-4 mr-2" />
                          Account
                        </DropdownMenuItem>
                      </Link>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleLogout} data-testid="nav-menu-logout" className="cursor-pointer">
                        <LogOut className="w-4 h-4 mr-2" />
                        Logout
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </>
            )}
          </div>
        </div>
      </header>
      
      {/* Icon Navigation for authenticated users (not on admin page) */}
      {showMemberNav && location !== '/admin' && <IconNav />}
    </>
  );
}
