import { FolderKanban, Layers, Library, Lightbulb, Workflow, Database } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/dashboard', icon: FolderKanban, label: 'Projects', testId: 'icon-nav-projects' },
  { path: '/pod-workflows', icon: Workflow, label: 'AI Agent Workflows', testId: 'icon-nav-workflows' },
  { path: '/canvas', icon: Layers, label: 'Canvas', testId: 'icon-nav-canvas' },
  { path: '/library', icon: Library, label: 'Media Library', testId: 'icon-nav-library' },
  { path: '/ideas', icon: Lightbulb, label: 'Ideas', testId: 'icon-nav-ideas' },
  { path: '/uploads', icon: Database, label: 'Product Database', testId: 'icon-nav-uploads' },
];

export default function IconNav() {
  const [location] = useLocation();

  return (
    <div className="border-b bg-background">
      <div className="flex items-center justify-center py-6">
        <div className="flex items-center gap-8">
          {navItems.map((item) => {
            const isActive = location === item.path;
            const Icon = item.icon;

            return (
              <Link key={item.path} href={item.path}>
                <button
                  className={cn(
                    "group relative flex flex-col items-center gap-2 transition-all duration-300",
                    "hover:scale-110",
                    isActive ? "scale-125" : "scale-100"
                  )}
                  data-testid={item.testId}
                >
                  <div
                    className={cn(
                      "relative flex items-center justify-center rounded-2xl transition-all duration-300",
                      "hover-elevate active-elevate-2",
                      isActive
                        ? "w-16 h-16 bg-primary text-primary-foreground shadow-lg"
                        : "w-12 h-12 bg-muted text-muted-foreground group-hover:bg-muted/80"
                    )}
                  >
                    <Icon
                      className={cn(
                        "transition-all duration-300",
                        isActive ? "w-8 h-8" : "w-6 h-6"
                      )}
                    />
                    {isActive && (
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-primary-foreground animate-pulse" />
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-xs font-medium transition-all duration-300",
                      isActive
                        ? "text-primary font-semibold"
                        : "text-muted-foreground group-hover:text-foreground"
                    )}
                  >
                    {item.label}
                  </span>
                </button>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
