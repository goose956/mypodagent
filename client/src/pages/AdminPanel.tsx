import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, UserPlus, BarChart3, Users, FolderOpen, Video, Image, Package, Mail, Check, Activity, AlertTriangle, RefreshCw, ChevronLeft, ChevronRight, Monitor, Edit, FileText, TrendingUp, Globe, Search, Bot, Eye, Clock } from "lucide-react";
import { Line, LineChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Badge } from "@/components/ui/badge";
import { ScreenRecorder } from "@/components/ScreenRecorder";
import { ScreenRecordingsList } from "@/components/ScreenRecordingsList";
import AdminBlog from "./AdminBlog";

type User = {
  id: string;
  username: string;
  email: string;
  isAdmin: string;
  tier: string;
  diskSpaceUsed: number;
  storageLimit: number;
  credits: number;
  createdAt: string;
};

type ContactMessage = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: string;
  createdAt: string;
};

type BetaSignup = {
  id: string;
  name: string;
  email: string;
  status: string;
  createdAt: string;
};

type Stats = {
  totalUsers: number;
  totalProjects: number;
  totalVideoProjects: number;
  totalImageProjects: number;
  totalImportedImages: number;
  totalBrandingAssets: number;
  recentActivity: {
    date: string;
    users: number;
    projects: number;
    videos: number;
    images: number;
  }[];
};

type ApiMetrics = {
  concurrentCalls: number;
  totalCalls: number;
  totalFailures: number;
  rateLimitErrors: number;
  lastError: string | null;
  lastErrorTime: number | null;
  averageResponseTime: number;
  peakConcurrentCalls: number;
};

type UserApiUsage = {
  userId: string;
  username: string;
  email: string;
  tier: string;
  usage: {
    totalCalls: number;
    successCalls: number;
    failedCalls: number;
    modelBreakdown: {
      model: string;
      count: number;
      successCount: number;
    }[];
    dailyUsage: {
      date: string;
      count: number;
    }[];
  };
};

type DailyVisitor = {
  date: string;
  totalVisits: number;
  uniqueVisitors: number;
};

type TopReferrer = {
  referrer: string;
  count: number;
};

type RecentVisitor = {
  id: string;
  path: string;
  referrer: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  isBot: string | null;
  browser: string | null;
  os: string | null;
  visitedAt: string;
};

type TopPage = {
  path: string;
  count: number;
};

type BrowserStat = {
  browser: string;
  count: number;
};

type OsStat = {
  os: string;
  count: number;
};

type BotStats = {
  totalVisits: number;
  botVisits: number;
  humanVisits: number;
};

const USERS_PER_PAGE = 10;

export default function AdminPanel() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditCreditsDialogOpen, setIsEditCreditsDialogOpen] = useState(false);
  const [isEditStorageLimitDialogOpen, setIsEditStorageLimitDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newCredits, setNewCredits] = useState<number>(0);
  const [newStorageLimit, setNewStorageLimit] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [excludeBots, setExcludeBots] = useState(true);
  const [newUser, setNewUser] = useState({
    username: "",
    email: "",
    password: "",
    isAdmin: false,
  });

  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ["/api/admin/stats"],
  });

  const { data: contactMessages, isLoading: messagesLoading } = useQuery<ContactMessage[]>({
    queryKey: ["/api/admin/contact-messages"],
  });

  const { data: betaSignups, isLoading: betaSignupsLoading } = useQuery<BetaSignup[]>({
    queryKey: ["/api/admin/beta-signups"],
  });

  const { data: signupMode, isLoading: signupModeLoading } = useQuery<{ mode: string }>({
    queryKey: ["/api/settings/signup-mode"],
  });

  const { data: apiMetrics, isLoading: metricsLoading } = useQuery<ApiMetrics>({
    queryKey: ["/api/admin/api-metrics"],
    refetchInterval: 3000, // Auto-refresh every 3 seconds
  });

  const { data: apiUsageData, isLoading: apiUsageLoading } = useQuery<UserApiUsage[]>({
    queryKey: ["/api/admin/all-users-api-usage"],
  });

  const { data: dailyVisitors, isLoading: dailyVisitorsLoading } = useQuery<DailyVisitor[]>({
    queryKey: [`/api/admin/analytics/daily-visitors?excludeBots=${excludeBots}`],
  });

  const { data: topReferrers, isLoading: topReferrersLoading } = useQuery<TopReferrer[]>({
    queryKey: [`/api/admin/analytics/top-referrers?excludeBots=${excludeBots}`],
  });

  const { data: recentVisitors, isLoading: recentVisitorsLoading } = useQuery<RecentVisitor[]>({
    queryKey: [`/api/admin/analytics/recent-visitors?limit=50&excludeBots=${excludeBots}`],
  });

  const { data: topPages } = useQuery<TopPage[]>({
    queryKey: [`/api/admin/analytics/top-pages?excludeBots=${excludeBots}`],
  });

  const { data: browserStats } = useQuery<BrowserStat[]>({
    queryKey: [`/api/admin/analytics/browser-stats?excludeBots=${excludeBots}`],
  });

  const { data: osStats } = useQuery<OsStat[]>({
    queryKey: [`/api/admin/analytics/os-stats?excludeBots=${excludeBots}`],
  });

  const { data: botStats } = useQuery<BotStats>({
    queryKey: ["/api/admin/analytics/bot-stats"],
  });

  // Paginate users
  const paginatedUsers = useMemo(() => {
    if (!users) return { currentUsers: [], totalPages: 0 };
    
    const totalPages = Math.ceil(users.length / USERS_PER_PAGE);
    const startIndex = (currentPage - 1) * USERS_PER_PAGE;
    const endIndex = startIndex + USERS_PER_PAGE;
    const currentUsers = users.slice(startIndex, endIndex);
    
    return { currentUsers, totalPages };
  }, [users, currentPage]);

  const resetMetricsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/admin/api-metrics/reset", {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/api-metrics"] });
      toast({
        title: "Metrics reset",
        description: "API metrics have been reset successfully.",
      });
    },
  });

  const generateThumbnailsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/admin/generate-thumbnails", {
        method: "POST",
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/image-projects"] });
      toast({
        title: "Thumbnails generated",
        description: data.message || `Successfully generated ${data.processed} thumbnails`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error generating thumbnails",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (userData: typeof newUser) => {
      return await apiRequest("/api/admin/users", {
        method: "POST",
        body: JSON.stringify(userData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setIsCreateDialogOpen(false);
      setNewUser({ username: "", email: "", password: "", isAdmin: false });
      toast({
        title: "User created",
        description: "The new user has been created successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error creating user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await apiRequest(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({
        title: "User deleted",
        description: "The user has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateCreditsMutation = useMutation({
    mutationFn: async ({ userId, credits }: { userId: string; credits: number }) => {
      return await apiRequest(`/api/admin/users/${userId}/credits`, {
        method: "PATCH",
        body: JSON.stringify({ credits }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setIsEditCreditsDialogOpen(false);
      setSelectedUser(null);
      toast({
        title: "Credits updated",
        description: "User credits have been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating credits",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateStorageLimitMutation = useMutation({
    mutationFn: async ({ userId, storageLimit }: { userId: string; storageLimit: number }) => {
      return await apiRequest(`/api/admin/users/${userId}/storage-limit`, {
        method: "PATCH",
        body: JSON.stringify({ storageLimit }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setIsEditStorageLimitDialogOpen(false);
      setSelectedUser(null);
      toast({
        title: "Storage limit updated",
        description: "User storage limit has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating storage limit",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMessageStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return await apiRequest(`/api/admin/contact-messages/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contact-messages"] });
      toast({
        title: "Status updated",
        description: "Message status has been updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateBetaSignupStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return await apiRequest(`/api/admin/beta-signups/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/beta-signups"] });
      toast({
        title: "Status updated",
        description: "Beta signup status has been updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateSignupModeMutation = useMutation({
    mutationFn: async (mode: string) => {
      return await apiRequest(`/api/admin/settings/signup-mode`, {
        method: "PATCH",
        body: JSON.stringify({ mode }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/signup-mode"] });
      toast({
        title: "Signup mode updated",
        description: `Signup mode changed to ${signupMode?.mode === 'beta' ? 'Waiting List' : 'Beta Signup'}.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    createUserMutation.mutate(newUser);
  };

  const handleDeleteUser = (userId: string) => {
    if (confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
      deleteUserMutation.mutate(userId);
    }
  };

  const handleEditCredits = (user: User) => {
    setSelectedUser(user);
    setNewCredits(user.credits);
    setIsEditCreditsDialogOpen(true);
  };

  const handleUpdateCredits = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUser) {
      updateCreditsMutation.mutate({ userId: selectedUser.id, credits: newCredits });
    }
  };

  const handleEditStorageLimit = (user: User) => {
    setSelectedUser(user);
    setNewStorageLimit(user.storageLimit);
    setIsEditStorageLimitDialogOpen(true);
  };

  const handleUpdateStorageLimit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUser) {
      updateStorageLimitMutation.mutate({ userId: selectedUser.id, storageLimit: newStorageLimit });
    }
  };

  // Note: Authentication is now handled by AdminLogin component
  // No redirect logic needed here

  if (usersLoading || statsLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-admin-title">Admin Panel</h1>
          <p className="text-muted-foreground">Manage users and view platform statistics</p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-users">{stats?.totalUsers || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-projects">{stats?.totalProjects || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Video Projects</CardTitle>
            <Video className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-videos">{stats?.totalVideoProjects || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Image Projects</CardTitle>
            <Image className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-images">{stats?.totalImageProjects || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Imported Images</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-imported">{stats?.totalImportedImages || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Branding Assets</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-branding">{stats?.totalBrandingAssets || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Chart */}
      {stats?.recentActivity && stats.recentActivity.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity (Last 7 Days)</CardTitle>
            <CardDescription>Track platform usage over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={stats.recentActivity}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="users" stroke="hsl(var(--primary))" name="New Users" />
                <Line type="monotone" dataKey="projects" stroke="hsl(var(--chart-2))" name="Projects Created" />
                <Line type="monotone" dataKey="videos" stroke="hsl(var(--chart-3))" name="Videos Generated" />
                <Line type="monotone" dataKey="images" stroke="hsl(var(--chart-4))" name="Images Generated" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* API Health Monitoring */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                API Health Monitoring
              </CardTitle>
              <CardDescription>Real-time API performance metrics</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => generateThumbnailsMutation.mutate()}
                disabled={generateThumbnailsMutation.isPending}
                data-testid="button-generate-thumbnails"
              >
                <Image className={`h-4 w-4 mr-2 ${generateThumbnailsMutation.isPending ? 'animate-spin' : ''}`} />
                {generateThumbnailsMutation.isPending ? 'Generating...' : 'Generate Thumbnails'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => resetMetricsMutation.mutate()}
                disabled={resetMetricsMutation.isPending}
                data-testid="button-reset-metrics"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${resetMetricsMutation.isPending ? 'animate-spin' : ''}`} />
                Reset Metrics
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {metricsLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Active Calls</p>
                  <p className="text-2xl font-bold" data-testid="text-concurrent-calls">
                    {apiMetrics?.concurrentCalls || 0}
                  </p>
                  <Badge variant={apiMetrics && apiMetrics.concurrentCalls > 0 ? "default" : "secondary"}>
                    {apiMetrics && apiMetrics.concurrentCalls > 0 ? "Processing" : "Idle"}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Total Calls</p>
                  <p className="text-2xl font-bold" data-testid="text-total-calls">
                    {apiMetrics?.totalCalls || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Peak: {apiMetrics?.peakConcurrentCalls || 0}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Error Rate</p>
                  <p className="text-2xl font-bold text-destructive" data-testid="text-error-rate">
                    {apiMetrics && apiMetrics.totalCalls > 0 
                      ? ((apiMetrics.totalFailures / apiMetrics.totalCalls) * 100).toFixed(1)
                      : 0}%
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {apiMetrics?.totalFailures || 0} failures
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Avg Response Time</p>
                  <p className="text-2xl font-bold" data-testid="text-avg-response">
                    {apiMetrics?.averageResponseTime ? Math.round(apiMetrics.averageResponseTime) : 0}ms
                  </p>
                  <Badge variant={apiMetrics && apiMetrics.averageResponseTime > 3000 ? "destructive" : "secondary"}>
                    {apiMetrics && apiMetrics.averageResponseTime > 3000 ? "Slow" : "Normal"}
                  </Badge>
                </div>
              </div>

              {/* Last Error */}
              {apiMetrics?.lastError && (
                <div className="border rounded-lg p-4 bg-muted/30">
                  <p className="text-sm font-medium mb-2">Last Error</p>
                  <p className="text-sm text-muted-foreground font-mono break-all">
                    {apiMetrics.lastError}
                  </p>
                  {apiMetrics.lastErrorTime && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(apiMetrics.lastErrorTime).toLocaleString()}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabbed Section: Users & API Usage */}
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users" data-testid="tab-users">
            <Users className="w-4 h-4 mr-2" />
            Users
          </TabsTrigger>
          <TabsTrigger value="api-usage" data-testid="tab-api-usage">
            <BarChart3 className="w-4 h-4 mr-2" />
            API Usage
          </TabsTrigger>
          <TabsTrigger value="recordings" data-testid="tab-recordings">
            <Monitor className="w-4 h-4 mr-2" />
            Screen Recordings
          </TabsTrigger>
          <TabsTrigger value="blog" data-testid="tab-blog">
            <FileText className="w-4 h-4 mr-2" />
            Blog
          </TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-analytics">
            <TrendingUp className="w-4 h-4 mr-2" />
            Analytics
          </TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>User Management</CardTitle>
                  <CardDescription>View and manage all users ({users?.length || 0} total)</CardDescription>
                </div>
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-create-user">
                      <UserPlus className="w-4 h-4 mr-2" />
                      Add User
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New User</DialogTitle>
                      <DialogDescription>
                        Add a new user to the platform
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateUser} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="username">Username</Label>
                        <Input
                          id="username"
                          value={newUser.username}
                          onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                          required
                          data-testid="input-username"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={newUser.email}
                          onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                          required
                          data-testid="input-email"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                          id="password"
                          type="password"
                          value={newUser.password}
                          onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                          required
                          data-testid="input-password"
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="isAdmin"
                          checked={newUser.isAdmin}
                          onCheckedChange={(checked) => setNewUser({ ...newUser, isAdmin: checked })}
                          data-testid="switch-admin"
                        />
                        <Label htmlFor="isAdmin">Admin privileges</Label>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={createUserMutation.isPending} data-testid="button-submit-user">
                          {createUserMutation.isPending ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Creating...
                            </>
                          ) : (
                            "Create User"
                          )}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Credits</TableHead>
                    <TableHead>Storage Used</TableHead>
                    <TableHead>Storage Limit</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedUsers.currentUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium" data-testid={`text-username-${user.id}`}>{user.username}</TableCell>
                      <TableCell data-testid={`text-email-${user.id}`}>{user.email}</TableCell>
                      <TableCell>
                        {user.isAdmin === "true" ? (
                          <Badge variant="default" data-testid={`badge-role-${user.id}`}>Admin</Badge>
                        ) : (
                          <Badge variant="secondary" data-testid={`badge-role-${user.id}`}>User</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" data-testid={`badge-tier-${user.id}`}>{user.tier}</Badge>
                      </TableCell>
                      <TableCell data-testid={`text-credits-${user.id}`}>
                        <Badge variant="secondary">{user.credits || 0} credits</Badge>
                      </TableCell>
                      <TableCell data-testid={`text-storage-${user.id}`}>
                        {(user.diskSpaceUsed / (1024 * 1024)).toFixed(2)} MB
                      </TableCell>
                      <TableCell data-testid={`text-storage-limit-${user.id}`}>
                        <Badge variant="outline">{(user.storageLimit / (1024 * 1024)).toFixed(0)} MB</Badge>
                      </TableCell>
                      <TableCell data-testid={`text-created-${user.id}`}>
                        {new Date(user.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditCredits(user)}
                            disabled={updateCreditsMutation.isPending}
                            data-testid={`button-edit-credits-${user.id}`}
                            title="Edit Credits"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditStorageLimit(user)}
                            disabled={updateStorageLimitMutation.isPending}
                            data-testid={`button-edit-storage-${user.id}`}
                            title="Edit Storage Limit"
                          >
                            <FolderOpen className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteUser(user.id)}
                            disabled={deleteUserMutation.isPending}
                            data-testid={`button-delete-${user.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination Controls */}
              {paginatedUsers.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {currentPage} of {paginatedUsers.totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      data-testid="button-prev-page"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(paginatedUsers.totalPages, p + 1))}
                      disabled={currentPage === paginatedUsers.totalPages}
                      data-testid="button-next-page"
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Edit Credits Dialog */}
          <Dialog open={isEditCreditsDialogOpen} onOpenChange={setIsEditCreditsDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit User Credits</DialogTitle>
                <DialogDescription>
                  Update credits for {selectedUser?.username}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleUpdateCredits} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="credits">Credits</Label>
                  <Input
                    id="credits"
                    type="number"
                    min="0"
                    value={newCredits}
                    onChange={(e) => setNewCredits(parseInt(e.target.value) || 0)}
                    required
                    data-testid="input-credits"
                  />
                  <p className="text-sm text-muted-foreground">
                    Current credits: {selectedUser?.credits || 0}
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsEditCreditsDialogOpen(false)}
                    data-testid="button-cancel-credits"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={updateCreditsMutation.isPending}
                    data-testid="button-save-credits"
                  >
                    {updateCreditsMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          {/* Edit Storage Limit Dialog */}
          <Dialog open={isEditStorageLimitDialogOpen} onOpenChange={setIsEditStorageLimitDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit User Storage Limit</DialogTitle>
                <DialogDescription>
                  Update storage limit for {selectedUser?.username}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleUpdateStorageLimit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="storageLimit">Storage Limit (MB)</Label>
                  <Input
                    id="storageLimit"
                    type="number"
                    min="0"
                    value={Math.round(newStorageLimit / (1024 * 1024))}
                    onChange={(e) => setNewStorageLimit((parseInt(e.target.value) || 0) * 1024 * 1024)}
                    required
                    data-testid="input-storage-limit"
                  />
                  <p className="text-sm text-muted-foreground">
                    Current limit: {selectedUser ? (selectedUser.storageLimit / (1024 * 1024)).toFixed(0) : 0} MB
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Current usage: {selectedUser ? (selectedUser.diskSpaceUsed / (1024 * 1024)).toFixed(2) : 0} MB
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsEditStorageLimitDialogOpen(false)}
                    data-testid="button-cancel-storage-limit"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={updateStorageLimitMutation.isPending}
                    data-testid="button-save-storage-limit"
                  >
                    {updateStorageLimitMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* API Usage Tab */}
        <TabsContent value="api-usage">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                API Usage Tracking
              </CardTitle>
              <CardDescription>Per-user API consumption breakdown by model</CardDescription>
            </CardHeader>
            <CardContent>
              {apiUsageLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : apiUsageData && apiUsageData.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Total Calls</TableHead>
                      <TableHead>Success Rate</TableHead>
                      <TableHead>Model Breakdown</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apiUsageData.map((userUsage) => {
                      const successRate = userUsage.usage.totalCalls > 0
                        ? ((userUsage.usage.successCalls / userUsage.usage.totalCalls) * 100).toFixed(1)
                        : '0';
                      
                      return (
                        <TableRow key={userUsage.userId}>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{userUsage.username}</span>
                              <span className="text-xs text-muted-foreground">{userUsage.email}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{userUsage.tier}</Badge>
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold">{userUsage.usage.totalCalls}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className={userUsage.usage.failedCalls > 0 ? "text-destructive" : "text-green-600 dark:text-green-500"}>
                                {successRate}%
                              </span>
                              {userUsage.usage.failedCalls > 0 && (
                                <Badge variant="destructive" className="text-xs">
                                  {userUsage.usage.failedCalls} failed
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {userUsage.usage.modelBreakdown.map((model) => (
                                <Badge key={model.model} variant="outline" className="text-xs">
                                  {model.model}: {model.count}
                                </Badge>
                              ))}
                              {userUsage.usage.modelBreakdown.length === 0 && (
                                <span className="text-xs text-muted-foreground">No usage</span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No API usage data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Screen Recordings Tab */}
        <TabsContent value="recordings" className="space-y-4">
          <ScreenRecorder />
          <ScreenRecordingsList />
        </TabsContent>

        {/* Blog Tab */}
        <TabsContent value="blog">
          <AdminBlog />
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          {/* Bot Filter Toggle + Bot Stats */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                checked={excludeBots}
                onCheckedChange={setExcludeBots}
              />
              <Label className="text-sm">Filter out bots</Label>
            </div>
            {botStats && (
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="secondary">
                  <Eye className="w-3 h-3 mr-1" />
                  {botStats.totalVisits} total
                </Badge>
                <Badge variant="secondary">
                  <Users className="w-3 h-3 mr-1" />
                  {botStats.humanVisits} human
                </Badge>
                <Badge variant="outline">
                  <Bot className="w-3 h-3 mr-1" />
                  {botStats.botVisits} bot
                </Badge>
              </div>
            )}
          </div>

          {/* Daily Visitors Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Daily Visitor Breakdown
              </CardTitle>
              <CardDescription>Total visits and unique visitors over the last 30 days {excludeBots ? '(bots excluded)' : '(all traffic)'}</CardDescription>
            </CardHeader>
            <CardContent>
              {dailyVisitorsLoading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : dailyVisitors && dailyVisitors.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={[...dailyVisitors].reverse()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="totalVisits" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      name="Total Visits"
                      dot={{ r: 3 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="uniqueVisitors" 
                      stroke="hsl(var(--accent))" 
                      strokeWidth={2}
                      name="Unique Visitors"
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-16 text-muted-foreground">
                  No visitor data available yet
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stats Grid: Top Pages, Browser, OS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Top Pages */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Top Pages (30 days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topPages && topPages.length > 0 ? (
                  <div className="space-y-2">
                    {topPages.slice(0, 8).map((page, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate text-muted-foreground">{page.path}</span>
                        <Badge variant="secondary">{page.count}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No data yet</p>
                )}
              </CardContent>
            </Card>

            {/* Browser Stats */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Monitor className="h-4 w-4" />
                  Browsers
                </CardTitle>
              </CardHeader>
              <CardContent>
                {browserStats && browserStats.length > 0 ? (
                  <div className="space-y-2">
                    {browserStats.slice(0, 8).map((stat, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-muted-foreground">{stat.browser}</span>
                        <Badge variant="secondary">{stat.count}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No data yet</p>
                )}
              </CardContent>
            </Card>

            {/* OS Stats */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Operating Systems
                </CardTitle>
              </CardHeader>
              <CardContent>
                {osStats && osStats.length > 0 ? (
                  <div className="space-y-2">
                    {osStats.slice(0, 8).map((stat, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-muted-foreground">{stat.os}</span>
                        <Badge variant="secondary">{stat.count}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No data yet</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top Referrers Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Top 5 Referrers
              </CardTitle>
              <CardDescription>Sources driving the most traffic to your site</CardDescription>
            </CardHeader>
            <CardContent>
              {topReferrersLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : topReferrers && topReferrers.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Referrer</TableHead>
                      <TableHead className="text-right">Visits</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topReferrers.map((referrer, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium" data-testid={`text-referrer-${index}`}>
                          {referrer.referrer === 'Direct' ? (
                            <span className="text-muted-foreground">Direct / None</span>
                          ) : (
                            <a 
                              href={referrer.referrer} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              {referrer.referrer}
                            </a>
                          )}
                        </TableCell>
                        <TableCell className="text-right" data-testid={`text-referrer-count-${index}`}>
                          <Badge variant="secondary">{referrer.count}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No referrer data available yet
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Visitors Log */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Recent Visitors
              </CardTitle>
              <CardDescription>Last 50 visitors {excludeBots ? '(bots excluded)' : '(all traffic)'}</CardDescription>
            </CardHeader>
            <CardContent>
              {recentVisitorsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : recentVisitors && recentVisitors.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Page</TableHead>
                        <TableHead>IP</TableHead>
                        <TableHead>Browser</TableHead>
                        <TableHead>OS</TableHead>
                        <TableHead>Referrer</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentVisitors.map((visitor) => (
                        <TableRow key={visitor.id}>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(visitor.visitedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </TableCell>
                          <TableCell className="text-sm font-medium max-w-[200px] truncate">{visitor.path}</TableCell>
                          <TableCell className="text-xs text-muted-foreground font-mono">{visitor.ipAddress || '-'}</TableCell>
                          <TableCell className="text-xs">{visitor.browser || '-'}</TableCell>
                          <TableCell className="text-xs">{visitor.os || '-'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                            {visitor.referrer ? (
                              <a href={visitor.referrer} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                {(() => { try { return new URL(visitor.referrer).hostname; } catch { return visitor.referrer; } })()}
                              </a>
                            ) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No visitor data available yet
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Contact Messages */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Contact Messages
          </CardTitle>
          <CardDescription>Messages from the contact form</CardDescription>
        </CardHeader>
        <CardContent>
          {messagesLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : contactMessages && contactMessages.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contactMessages.map((message) => (
                  <TableRow key={message.id}>
                    <TableCell className="font-medium" data-testid={`text-message-name-${message.id}`}>{message.name}</TableCell>
                    <TableCell data-testid={`text-message-email-${message.id}`}>{message.email}</TableCell>
                    <TableCell data-testid={`text-message-subject-${message.id}`}>{message.subject}</TableCell>
                    <TableCell className="max-w-xs truncate" data-testid={`text-message-body-${message.id}`}>{message.message}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={message.status === 'read' ? 'secondary' : 'default'}
                        data-testid={`badge-message-status-${message.id}`}
                      >
                        {message.status}
                      </Badge>
                    </TableCell>
                    <TableCell data-testid={`text-message-date-${message.id}`}>
                      {new Date(message.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {message.status === 'unread' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => updateMessageStatusMutation.mutate({ id: message.id, status: 'read' })}
                          disabled={updateMessageStatusMutation.isPending}
                          data-testid={`button-mark-read-${message.id}`}
                        >
                          <Check className="w-4 h-4 text-green-600" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No contact messages yet
            </div>
          )}
        </CardContent>
      </Card>

      {/* Signup Mode Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Signup Mode Settings
          </CardTitle>
          <CardDescription>Toggle between Beta Signup and Waiting List modes</CardDescription>
        </CardHeader>
        <CardContent>
          {signupModeLoading ? (
            <div className="flex items-center justify-center h-20">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <h4 className="font-medium">Current Mode: {signupMode?.mode === 'beta' ? 'Beta Signup' : 'Waiting List'}</h4>
                <p className="text-sm text-muted-foreground">
                  {signupMode?.mode === 'beta' 
                    ? 'Users can sign up for beta access. Switch to Waiting List when beta is full.'
                    : 'Users will be added to a waiting list. Switch to Beta Signup to accept new testers.'}
                </p>
              </div>
              <Switch
                checked={signupMode?.mode === 'waitlist'}
                onCheckedChange={(checked) => {
                  updateSignupModeMutation.mutate(checked ? 'waitlist' : 'beta');
                }}
                disabled={updateSignupModeMutation.isPending}
                data-testid="switch-signup-mode"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Beta Signups */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Beta Signups
          </CardTitle>
          <CardDescription>Early access beta tester registrations</CardDescription>
        </CardHeader>
        <CardContent>
          {betaSignupsLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : betaSignups && betaSignups.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {betaSignups.map((signup) => (
                  <TableRow key={signup.id}>
                    <TableCell className="font-medium" data-testid={`text-signup-name-${signup.id}`}>{signup.name}</TableCell>
                    <TableCell data-testid={`text-signup-email-${signup.id}`}>{signup.email}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={signup.status === 'approved' ? 'default' : signup.status === 'rejected' ? 'destructive' : 'secondary'}
                        data-testid={`badge-signup-status-${signup.id}`}
                      >
                        {signup.status}
                      </Badge>
                    </TableCell>
                    <TableCell data-testid={`text-signup-date-${signup.id}`}>
                      {new Date(signup.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {signup.status !== 'approved' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateBetaSignupStatusMutation.mutate({ id: signup.id, status: 'approved' })}
                            disabled={updateBetaSignupStatusMutation.isPending}
                            data-testid={`button-approve-${signup.id}`}
                          >
                            <Check className="w-4 h-4 text-green-600" />
                          </Button>
                        )}
                        {signup.status !== 'rejected' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateBetaSignupStatusMutation.mutate({ id: signup.id, status: 'rejected' })}
                            disabled={updateBetaSignupStatusMutation.isPending}
                            data-testid={`button-reject-${signup.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No beta signups yet
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
