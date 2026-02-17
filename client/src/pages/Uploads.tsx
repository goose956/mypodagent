import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Loader2, Upload, Check, X, Pencil, Video, Square, Download, ArrowUpDown, ArrowUp, ArrowDown, Lightbulb, Sparkles, Search, ChevronLeft, ChevronRight, Calendar as CalendarIcon, BarChart3, TrendingUp } from "lucide-react";
import { format, getYear, parseISO, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { ProductUpload } from "@shared/schema";
import { useScreenRecorder } from "@/contexts/ScreenRecorderContext";
import { useAuth } from "@/lib/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";

const PRODUCT_CATEGORIES = [
  "Mug",
  "T-Shirt",
  "Hoodie",
  "Poster",
  "Tote Bag",
  "Phone Case",
  "Sticker",
  "Notebook",
  "Canvas Print",
  "Throw Pillow",
  "Blanket",
  "Hat",
  "Sweatshirt",
  "Tank Top",
  "Leggings"
];

interface SmartSuggestion {
  title: string;
  description: string;
  targetNiche: string;
  reasoning: string;
}

type ProductStatus = "idea" | "in-progress" | "listings-created" | "listing-product-created" | "completed";

const STATUS_CONFIG: Record<ProductStatus, { label: string; rowBg: string; badgeBg: string }> = {
  "idea": {
    label: "Idea",
    rowBg: "bg-blue-50 dark:bg-blue-950/30",
    badgeBg: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300"
  },
  "in-progress": {
    label: "In Progress",
    rowBg: "bg-amber-50 dark:bg-amber-950/30",
    badgeBg: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
  },
  "listings-created": {
    label: "Listings Created",
    rowBg: "bg-purple-50 dark:bg-purple-950/30",
    badgeBg: "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300"
  },
  "listing-product-created": {
    label: "Listing+Product Created",
    rowBg: "bg-cyan-50 dark:bg-cyan-950/30",
    badgeBg: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-300"
  },
  "completed": {
    label: "Completed",
    rowBg: "bg-green-50 dark:bg-green-950/30",
    badgeBg: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300"
  }
};

type SortField = "name" | "description" | "date" | "status";
type SortDirection = "asc" | "desc";

interface Holiday {
  name: string;
  date: string;
  month: number;
  day: number;
  isVariable?: boolean;
  description?: string;
}

const UK_HOLIDAYS: Holiday[] = [
  { name: "New Year's Day", date: "1 January", month: 1, day: 1, description: "Fresh start, resolutions, new beginnings" },
  { name: "Valentine's Day", date: "14 February", month: 2, day: 14, description: "Love, romance, couples, Galentine's" },
  { name: "Pancake Day", date: "February (varies)", month: 2, day: 13, isVariable: true, description: "Fun food designs, family cooking" },
  { name: "Mother's Day (UK)", date: "March (4th Sunday of Lent)", month: 3, day: 10, isVariable: true, description: "Mum appreciation, flowers, family" },
  { name: "St Patrick's Day", date: "17 March", month: 3, day: 17, description: "Irish heritage, green, luck" },
  { name: "Easter", date: "March/April (varies)", month: 4, day: 20, isVariable: true, description: "Spring, bunnies, eggs, family gatherings" },
  { name: "St George's Day", date: "23 April", month: 4, day: 23, description: "English pride, red and white" },
  { name: "May Day", date: "1 May", month: 5, day: 1, description: "Spring celebration, maypole" },
  { name: "Coronation Day", date: "6 May", month: 5, day: 6, description: "Royal celebration, British pride" },
  { name: "Father's Day", date: "June (3rd Sunday)", month: 6, day: 16, isVariable: true, description: "Dad appreciation, hobbies, tools, sports" },
  { name: "Summer Solstice", date: "21 June", month: 6, day: 21, description: "Longest day, sunshine, outdoors" },
  { name: "Pride Month", date: "June", month: 6, day: 1, description: "LGBTQ+ celebration, rainbow, inclusion" },
  { name: "Back to School", date: "September", month: 9, day: 1, description: "School supplies, teachers, students" },
  { name: "Halloween", date: "31 October", month: 10, day: 31, description: "Spooky, costumes, pumpkins, witches" },
  { name: "Bonfire Night", date: "5 November", month: 11, day: 5, description: "Fireworks, Guy Fawkes, autumn" },
  { name: "Remembrance Day", date: "11 November", month: 11, day: 11, description: "Poppies, veterans, respect" },
  { name: "Black Friday", date: "November (4th Friday)", month: 11, day: 29, isVariable: true, description: "Sales, shopping, deals" },
  { name: "Christmas", date: "25 December", month: 12, day: 25, description: "Family, gifts, Santa, festive" },
  { name: "Boxing Day", date: "26 December", month: 12, day: 26, description: "Sales, relaxation, leftovers" },
  { name: "New Year's Eve", date: "31 December", month: 12, day: 31, description: "Celebration, parties, countdown" },
];

const USA_HOLIDAYS: Holiday[] = [
  { name: "New Year's Day", date: "1 January", month: 1, day: 1, description: "Fresh start, resolutions, new beginnings" },
  { name: "Martin Luther King Jr. Day", date: "January (3rd Monday)", month: 1, day: 20, isVariable: true, description: "Civil rights, equality, legacy" },
  { name: "Super Bowl Sunday", date: "February (varies)", month: 2, day: 9, isVariable: true, description: "Football, parties, snacks, team spirit" },
  { name: "Valentine's Day", date: "14 February", month: 2, day: 14, description: "Love, romance, couples, Galentine's" },
  { name: "Presidents' Day", date: "February (3rd Monday)", month: 2, day: 17, isVariable: true, description: "American history, patriotism" },
  { name: "St Patrick's Day", date: "17 March", month: 3, day: 17, description: "Irish heritage, green, luck" },
  { name: "Easter", date: "March/April (varies)", month: 4, day: 20, isVariable: true, description: "Spring, bunnies, eggs, family gatherings" },
  { name: "Earth Day", date: "22 April", month: 4, day: 22, description: "Environment, nature, sustainability" },
  { name: "Cinco de Mayo", date: "5 May", month: 5, day: 5, description: "Mexican heritage, celebration" },
  { name: "Mother's Day (USA)", date: "May (2nd Sunday)", month: 5, day: 11, isVariable: true, description: "Mom appreciation, flowers, family" },
  { name: "Memorial Day", date: "May (last Monday)", month: 5, day: 26, isVariable: true, description: "Veterans, patriotism, summer kickoff" },
  { name: "Pride Month", date: "June", month: 6, day: 1, description: "LGBTQ+ celebration, rainbow, inclusion" },
  { name: "Juneteenth", date: "19 June", month: 6, day: 19, description: "Freedom, African American history" },
  { name: "Father's Day", date: "June (3rd Sunday)", month: 6, day: 15, isVariable: true, description: "Dad appreciation, hobbies, tools, sports" },
  { name: "Independence Day", date: "4 July", month: 7, day: 4, description: "Patriotism, fireworks, BBQ, red white blue" },
  { name: "Back to School", date: "August/September", month: 8, day: 15, description: "School supplies, teachers, students" },
  { name: "Labor Day", date: "September (1st Monday)", month: 9, day: 1, isVariable: true, description: "Workers, end of summer" },
  { name: "Halloween", date: "31 October", month: 10, day: 31, description: "Spooky, costumes, pumpkins, witches" },
  { name: "Veterans Day", date: "11 November", month: 11, day: 11, description: "Military, patriotism, thank you for service" },
  { name: "Thanksgiving", date: "November (4th Thursday)", month: 11, day: 28, isVariable: true, description: "Family, gratitude, turkey, fall" },
  { name: "Black Friday", date: "November (day after Thanksgiving)", month: 11, day: 29, isVariable: true, description: "Sales, shopping, deals" },
  { name: "Christmas", date: "25 December", month: 12, day: 25, description: "Family, gifts, Santa, festive" },
  { name: "New Year's Eve", date: "31 December", month: 12, day: 31, description: "Celebration, parties, countdown" },
];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function Uploads() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { isRecording, isUploading, startRecording, stopRecording } = useScreenRecorder();
  const isAdmin = (user as any)?.isAdmin;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    category: "",
    date: "",
    status: "idea" as ProductStatus,
    conversionRate: ""
  });
  const [newUploadForm, setNewUploadForm] = useState({
    name: "",
    description: "",
    category: "",
    date: new Date().toISOString().split('T')[0],
    status: "idea" as ProductStatus,
    conversionRate: ""
  });
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  
  // Smart Suggestions state
  const [smartSuggestionsOpen, setSmartSuggestionsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [numberOfSuggestions, setNumberOfSuggestions] = useState<number>(5);
  const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([]);
  const [addingSuggestionIndex, setAddingSuggestionIndex] = useState<number | null>(null);

  // Search and pagination state
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  // Calendar tab state
  const [calendarCountry, setCalendarCountry] = useState<"uk" | "usa">("uk");
  const [calendarYear, setCalendarYear] = useState(getYear(new Date()));

  // Fetch all uploads
  const { data: uploads = [], isLoading } = useQuery<ProductUpload[]>({
    queryKey: ['/api/product-uploads'],
  });

  // Create upload mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof newUploadForm) => {
      return await apiRequest('/api/product-uploads', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/product-uploads'] });
      setNewUploadForm({
        name: "",
        description: "",
        category: "",
        date: new Date().toISOString().split('T')[0],
        status: "in-progress",
        conversionRate: ""
      });
      setIsAddingNew(false);
      toast({
        title: "Upload created!",
        description: "Your product upload has been added.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create upload",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update upload mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof editForm> }) => {
      return await apiRequest(`/api/product-uploads/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/product-uploads'] });
      setEditingId(null);
      toast({
        title: "Upload updated!",
        description: "Your changes have been saved.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update upload",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete upload mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/product-uploads/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/product-uploads'] });
      toast({
        title: "Upload deleted!",
        description: "The product upload has been removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete upload",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Smart Suggestions mutation
  const smartSuggestionsMutation = useMutation({
    mutationFn: async (data: { category: string; numberOfSuggestions: number }) => {
      return await apiRequest('/api/product-uploads/smart-suggestions', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: (response: any) => {
      const suggestionsList = response.suggestions || [];
      setSuggestions(suggestionsList);
      
      if (suggestionsList.length === 0) {
        toast({
          title: "No new ideas found",
          description: `The AI couldn't find untapped niches for ${response.category}. Try a different category or check your existing products.`,
        });
      } else {
        toast({
          title: "Suggestions generated!",
          description: `Found ${suggestionsList.length} new product ideas for ${response.category}.`,
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to generate suggestions",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Add suggestion to uploads mutation
  const addSuggestionMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; category: string }) => {
      return await apiRequest('/api/product-uploads', {
        method: 'POST',
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          category: data.category,
          date: new Date().toISOString().split('T')[0],
          status: "idea"
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/product-uploads'] });
      setAddingSuggestionIndex(null);
      toast({
        title: "Added to uploads!",
        description: "The product idea has been added to your uploads.",
      });
    },
    onError: (error: Error) => {
      setAddingSuggestionIndex(null);
      toast({
        title: "Failed to add suggestion",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleGenerateSuggestions = () => {
    if (!selectedCategory) {
      toast({
        title: "Select a category",
        description: "Please select a product category first.",
        variant: "destructive",
      });
      return;
    }
    setSuggestions([]);
    smartSuggestionsMutation.mutate({
      category: selectedCategory,
      numberOfSuggestions
    });
  };

  const handleAddSuggestionToUploads = (suggestion: SmartSuggestion, index: number) => {
    setAddingSuggestionIndex(index);
    addSuggestionMutation.mutate({
      name: `${selectedCategory}: ${suggestion.title}`,
      description: `${suggestion.description} | Target: ${suggestion.targetNiche}`,
      category: selectedCategory
    });
  };

  const handleStartEdit = (upload: ProductUpload) => {
    setEditingId(upload.id);
    setEditForm({
      name: upload.name,
      description: upload.description || "",
      category: upload.category || "",
      date: new Date(upload.productDate).toISOString().split('T')[0],
      status: upload.status as ProductStatus,
      conversionRate: upload.conversionRate || ""
    });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const statusOrder: ProductStatus[] = ["idea", "in-progress", "listings-created", "listing-product-created", "completed"];

  // Filter by search query
  const filteredUploads = useMemo(() => {
    if (!searchQuery.trim()) return uploads;
    const query = searchQuery.toLowerCase();
    return uploads.filter((upload) =>
      upload.name.toLowerCase().includes(query) ||
      (upload.description || "").toLowerCase().includes(query)
    );
  }, [uploads, searchQuery]);

  // Sort filtered uploads
  const sortedUploads = useMemo(() => {
    return [...filteredUploads].sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "description":
          comparison = (a.description || "").localeCompare(b.description || "");
          break;
        case "date":
          comparison = new Date(a.productDate).getTime() - new Date(b.productDate).getTime();
          break;
        case "status":
          comparison = statusOrder.indexOf(a.status as ProductStatus) - statusOrder.indexOf(b.status as ProductStatus);
          break;
      }
      
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [filteredUploads, sortField, sortDirection]);

  // Calculate total pages
  const totalPages = Math.max(1, Math.ceil(sortedUploads.length / ITEMS_PER_PAGE));
  
  // Synchronously clamp page to valid range
  const safePage = Math.min(currentPage, totalPages);

  // Paginate sorted uploads using clamped page
  const paginatedUploads = useMemo(() => {
    const startIndex = (safePage - 1) * ITEMS_PER_PAGE;
    return sortedUploads.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [sortedUploads, safePage, ITEMS_PER_PAGE]);

  // Update state to match clamped page (for UI consistency)
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  // Reset to page 1 when search changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    }
    return sortDirection === "asc" 
      ? <ArrowUp className="h-4 w-4 ml-1" />
      : <ArrowDown className="h-4 w-4 ml-1" />;
  };

  const getStatusConfig = (status: string) => {
    return STATUS_CONFIG[status as ProductStatus] || STATUS_CONFIG["idea"];
  };

  const handleSaveEdit = () => {
    if (!editingId) return;
    updateMutation.mutate({ id: editingId, data: editForm });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleCreateUpload = () => {
    if (!newUploadForm.name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a product name.",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate(newUploadForm);
  };

  const handleCancelNew = () => {
    setIsAddingNew(false);
    setNewUploadForm({
      name: "",
      description: "",
      category: "",
      date: new Date().toISOString().split('T')[0],
      status: "idea",
      conversionRate: ""
    });
  };

  const [isExporting, setIsExporting] = useState(false);

  const handleExportCSV = async () => {
    try {
      setIsExporting(true);
      const response = await fetch('/api/product-uploads/export', {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to export uploads');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `product-uploads-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Export successful!",
        description: "Your uploads have been downloaded as a CSV file.",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Could not export uploads",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Product Database</h1>
        <p className="text-muted-foreground">
          Track your products and their progress.
        </p>
      </div>

      {/* Admin Screen Recording Controls */}
      {isAdmin && (
        <Card className="mb-6 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5 text-primary" />
              Screen Recording (Admin Only)
            </CardTitle>
            <CardDescription>
              Record demo videos while you work on product uploads
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isRecording ? (
              <Alert className="border-destructive/50 bg-destructive/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 bg-destructive rounded-full animate-pulse" />
                    <AlertDescription className="font-semibold m-0">
                      Recording in progress - You can navigate freely
                    </AlertDescription>
                  </div>
                  <Button
                    onClick={stopRecording}
                    variant="destructive"
                    size="sm"
                    disabled={isUploading}
                    data-testid="button-stop-recording"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Square className="mr-2 h-4 w-4" />
                        Stop Recording
                      </>
                    )}
                  </Button>
                </div>
              </Alert>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Start recording your screen to create demo videos. The recording will continue even if you navigate to other pages.
                </p>
                <Button
                  onClick={startRecording}
                  variant="default"
                  data-testid="button-start-recording"
                >
                  <Video className="mr-2 h-4 w-4" />
                  Start Recording
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="products" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="products" data-testid="tab-products">
            <Upload className="h-4 w-4 mr-2" />
            Products
          </TabsTrigger>
          <TabsTrigger value="calendar" data-testid="tab-calendar">
            <CalendarIcon className="h-4 w-4 mr-2" />
            Holiday Calendar
          </TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-analytics">
            <TrendingUp className="h-4 w-4 mr-2" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          <Card>
        <CardHeader className="space-y-4 pb-4">
          <div className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Product Database
              </CardTitle>
              <CardDescription>
                Manage your products and track conversions
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Dialog open={smartSuggestionsOpen} onOpenChange={(open) => {
              setSmartSuggestionsOpen(open);
              if (!open) {
                setSuggestions([]);
                setSelectedCategory("");
              }
            }}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  data-testid="button-smart-suggestions"
                >
                  <Lightbulb className="h-4 w-4 mr-2" />
                  Smart Suggestions
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Smart Product Suggestions
                  </DialogTitle>
                  <DialogDescription>
                    Get AI-powered product ideas in untapped niches based on your existing products.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="category">Product Category</Label>
                      <Select
                        value={selectedCategory}
                        onValueChange={setSelectedCategory}
                      >
                        <SelectTrigger id="category" data-testid="select-category">
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                        <SelectContent>
                          {PRODUCT_CATEGORIES.map((cat) => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="numSuggestions">Number of Ideas</Label>
                      <Select
                        value={numberOfSuggestions.toString()}
                        onValueChange={(val) => setNumberOfSuggestions(parseInt(val))}
                      >
                        <SelectTrigger id="numSuggestions" data-testid="select-num-suggestions">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                            <SelectItem key={num} value={num.toString()}>{num} ideas</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <Button
                    onClick={handleGenerateSuggestions}
                    disabled={!selectedCategory || smartSuggestionsMutation.isPending}
                    className="w-full"
                    data-testid="button-generate-suggestions"
                  >
                    {smartSuggestionsMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Analyzing your products...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Generate Suggestions
                      </>
                    )}
                  </Button>

                  {suggestions.length > 0 && (
                    <div className="space-y-3">
                      <Label className="text-base font-semibold">Suggested Ideas</Label>
                      <ScrollArea className="h-[300px] pr-4">
                        <div className="space-y-3">
                          {suggestions.map((suggestion, index) => (
                            <Card key={index} className="p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-semibold text-sm mb-1" data-testid={`suggestion-title-${index}`}>
                                    {suggestion.title}
                                  </h4>
                                  <p className="text-sm text-muted-foreground mb-2">
                                    {suggestion.description}
                                  </p>
                                  <div className="flex flex-wrap gap-2 text-xs">
                                    <span className="bg-primary/10 text-primary px-2 py-1 rounded">
                                      Target: {suggestion.targetNiche}
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-2 italic">
                                    {suggestion.reasoning}
                                  </p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleAddSuggestionToUploads(suggestion, index)}
                                  disabled={addingSuggestionIndex === index || addSuggestionMutation.isPending}
                                  data-testid={`button-add-suggestion-${index}`}
                                >
                                  {addingSuggestionIndex === index ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Plus className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </Card>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
            <Button
              variant="outline"
              onClick={handleExportCSV}
              disabled={isExporting || uploads.length === 0}
              data-testid="button-export-csv"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Export CSV
            </Button>
            <Button
              onClick={() => setIsAddingNew(true)}
              disabled={isAddingNew}
              data-testid="button-add-upload"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Upload
            </Button>
            </div>
          </div>
          
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products by name or description..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9 max-w-md"
              data-testid="input-search"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/50 border-b sticky top-0 z-10">
                <div className="flex">
                  <div className="flex-1 p-3 font-medium text-sm">
                    <button
                      onClick={() => handleSort("name")}
                      className="flex items-center hover:text-foreground transition-colors"
                      data-testid="sort-name"
                    >
                      Product Name
                      <SortIcon field="name" />
                    </button>
                  </div>
                  <div className="flex-1 p-3 font-medium text-sm">
                    <button
                      onClick={() => handleSort("description")}
                      className="flex items-center hover:text-foreground transition-colors"
                      data-testid="sort-description"
                    >
                      Description
                      <SortIcon field="description" />
                    </button>
                  </div>
                  <div className="w-32 p-3 font-medium text-sm">Category</div>
                  <div className="w-36 p-3 font-medium text-sm">
                    <button
                      onClick={() => handleSort("date")}
                      className="flex items-center hover:text-foreground transition-colors"
                      data-testid="sort-date"
                    >
                      Date
                      <SortIcon field="date" />
                    </button>
                  </div>
                  <div className="w-48 p-3 font-medium text-sm">
                    <button
                      onClick={() => handleSort("status")}
                      className="flex items-center hover:text-foreground transition-colors"
                      data-testid="sort-status"
                    >
                      Status
                      <SortIcon field="status" />
                    </button>
                  </div>
                  <div className="w-28 p-3 font-medium text-sm">Conversion Rate</div>
                  <div className="w-32 p-3 font-medium text-sm text-right">Actions</div>
                </div>
              </div>
              <div>
                <div className="divide-y">
                  {isAddingNew && (
                    <div className="flex border-b bg-primary/5" data-testid="row-new-upload">
                      <div className="flex-1 p-2">
                        <Input
                          value={newUploadForm.name}
                          onChange={(e) => setNewUploadForm({ ...newUploadForm, name: e.target.value })}
                          placeholder="Enter product name"
                          className="h-8"
                          data-testid="input-new-name"
                        />
                      </div>
                      <div className="flex-1 p-2">
                        <Input
                          value={newUploadForm.description}
                          onChange={(e) => setNewUploadForm({ ...newUploadForm, description: e.target.value })}
                          placeholder="Enter description"
                          className="h-8"
                          data-testid="input-new-description"
                        />
                      </div>
                      <div className="w-32 p-2">
                        <Select
                          value={newUploadForm.category}
                          onValueChange={(value) => setNewUploadForm({ ...newUploadForm, category: value })}
                        >
                          <SelectTrigger className="h-8" data-testid="select-new-category">
                            <SelectValue placeholder="Category" />
                          </SelectTrigger>
                          <SelectContent>
                            {PRODUCT_CATEGORIES.map((cat) => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-36 p-2">
                        <Input
                          type="date"
                          value={newUploadForm.date}
                          onChange={(e) => setNewUploadForm({ ...newUploadForm, date: e.target.value })}
                          className="h-8"
                          data-testid="input-new-date"
                        />
                      </div>
                      <div className="w-48 p-2">
                        <Select
                          value={newUploadForm.status}
                          onValueChange={(value) => setNewUploadForm({ ...newUploadForm, status: value as ProductStatus })}
                        >
                          <SelectTrigger className="h-8" data-testid="select-new-status">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="idea">Idea</SelectItem>
                            <SelectItem value="in-progress">In Progress</SelectItem>
                            <SelectItem value="listings-created">Listings Created</SelectItem>
                            <SelectItem value="listing-product-created">Listing+Product Created</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-28 p-2">
                        <Input
                          value={newUploadForm.conversionRate}
                          onChange={(e) => setNewUploadForm({ ...newUploadForm, conversionRate: e.target.value })}
                          placeholder="e.g. 5%"
                          className="h-8"
                          data-testid="input-new-conversion-rate"
                        />
                      </div>
                      <div className="w-32 p-2">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={handleCreateUpload}
                            disabled={createMutation.isPending}
                            className="h-8 w-8"
                            data-testid="button-save-new"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={handleCancelNew}
                            disabled={createMutation.isPending}
                            className="h-8 w-8"
                            data-testid="button-cancel-new"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                  {paginatedUploads.length === 0 && !isAddingNew ? (
                    <div className="p-8 text-center text-muted-foreground">
                      {searchQuery ? `No products found matching "${searchQuery}"` : "No uploads yet. Click \"Add Upload\" to get started."}
                    </div>
                  ) : (
                    paginatedUploads.map((upload) => {
                      const statusConfig = getStatusConfig(upload.status);
                      return (
                        <div
                          key={upload.id}
                          className={`flex border-b ${statusConfig.rowBg}`}
                          data-testid={`row-upload-${upload.id}`}
                        >
                          {editingId === upload.id ? (
                            <>
                              <div className="flex-1 p-2">
                                <Input
                                  value={editForm.name}
                                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                  className="h-8"
                                  data-testid="input-edit-name"
                                />
                              </div>
                              <div className="flex-1 p-2">
                                <Input
                                  value={editForm.description}
                                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                  className="h-8"
                                  data-testid="input-edit-description"
                                />
                              </div>
                              <div className="w-32 p-2">
                                <Select
                                  value={editForm.category}
                                  onValueChange={(value) => setEditForm({ ...editForm, category: value })}
                                >
                                  <SelectTrigger className="h-8" data-testid="select-edit-category">
                                    <SelectValue placeholder="Category" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {PRODUCT_CATEGORIES.map((cat) => (
                                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="w-36 p-2">
                                <Input
                                  type="date"
                                  value={editForm.date}
                                  onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                                  className="h-8"
                                  data-testid="input-edit-date"
                                />
                              </div>
                              <div className="w-48 p-2">
                                <Select
                                  value={editForm.status}
                                  onValueChange={(value) => setEditForm({ ...editForm, status: value as ProductStatus })}
                                >
                                  <SelectTrigger className="h-8" data-testid="select-edit-status">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="idea">Idea</SelectItem>
                                    <SelectItem value="in-progress">In Progress</SelectItem>
                                    <SelectItem value="listings-created">Listings Created</SelectItem>
                                    <SelectItem value="listing-product-created">Listing+Product Created</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="w-28 p-2">
                                <Input
                                  value={editForm.conversionRate}
                                  onChange={(e) => setEditForm({ ...editForm, conversionRate: e.target.value })}
                                  placeholder="e.g. 5%"
                                  className="h-8"
                                  data-testid="input-edit-conversion-rate"
                                />
                              </div>
                              <div className="w-32 p-2">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={handleSaveEdit}
                                    disabled={updateMutation.isPending}
                                    className="h-8 w-8"
                                    data-testid="button-save-edit"
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={handleCancelEdit}
                                    disabled={updateMutation.isPending}
                                    className="h-8 w-8"
                                    data-testid="button-cancel-edit"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex-1 p-3">
                                <span className="font-medium" data-testid={`text-name-${upload.id}`}>
                                  {upload.name}
                                </span>
                              </div>
                              <div className="flex-1 p-3">
                                <span className="text-sm text-muted-foreground" data-testid={`text-description-${upload.id}`}>
                                  {upload.description || "—"}
                                </span>
                              </div>
                              <div className="w-32 p-3">
                                <span className="text-sm" data-testid={`text-category-${upload.id}`}>
                                  {upload.category || "—"}
                                </span>
                              </div>
                              <div className="w-36 p-3">
                                <span className="text-sm" data-testid={`text-date-${upload.id}`}>
                                  {format(new Date(upload.productDate), "MMM d, yyyy")}
                                </span>
                              </div>
                              <div className="w-48 p-3">
                                <span
                                  className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${statusConfig.badgeBg}`}
                                  data-testid={`text-status-${upload.id}`}
                                >
                                  {statusConfig.label}
                                </span>
                              </div>
                              <div className="w-28 p-3">
                                <span className="text-sm" data-testid={`text-conversion-${upload.id}`}>
                                  {upload.conversionRate || "—"}
                                </span>
                              </div>
                              <div className="w-32 p-3">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => handleStartEdit(upload)}
                                    className="h-8 w-8"
                                    data-testid={`button-edit-${upload.id}`}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => deleteMutation.mutate(upload.id)}
                                    disabled={deleteMutation.isPending}
                                    className="h-8 w-8"
                                    data-testid={`button-delete-${upload.id}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
              
              {/* Pagination controls */}
              {sortedUploads.length > ITEMS_PER_PAGE && (
                <div className="flex items-center justify-between border-t px-4 py-3 bg-muted/30">
                  <div className="text-sm text-muted-foreground">
                    Showing {((safePage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(safePage * ITEMS_PER_PAGE, sortedUploads.length)} of {sortedUploads.length} products
                    {searchQuery && ` (filtered from ${uploads.length} total)`}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={safePage === 1}
                      data-testid="button-prev-page"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    <span className="text-sm font-medium px-2">
                      Page {safePage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={safePage === totalPages}
                      data-testid="button-next-page"
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="calendar">
          <Card>
            <CardHeader>
              <div className="flex flex-row items-center justify-between gap-4 flex-wrap">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarIcon className="h-5 w-5" />
                    Holiday Calendar
                  </CardTitle>
                  <CardDescription>
                    Plan your POD products around key holidays and events
                  </CardDescription>
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCalendarYear(y => y - 1)}
                      data-testid="button-calendar-prev-year"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="font-semibold text-lg min-w-[60px] text-center" data-testid="text-calendar-year">
                      {calendarYear}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCalendarYear(y => y + 1)}
                      data-testid="button-calendar-next-year"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={calendarCountry === "uk" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCalendarCountry("uk")}
                      data-testid="button-calendar-uk"
                    >
                      UK
                    </Button>
                    <Button
                      variant={calendarCountry === "usa" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCalendarCountry("usa")}
                      data-testid="button-calendar-usa"
                    >
                      USA
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {MONTHS.map((monthName, monthIndex) => {
                  const holidays = (calendarCountry === "uk" ? UK_HOLIDAYS : USA_HOLIDAYS)
                    .filter(h => h.month === monthIndex + 1);
                  
                  return (
                    <Card key={monthName} className="overflow-hidden">
                      <div className="bg-primary/10 dark:bg-primary/20 px-4 py-2 border-b">
                        <h3 className="font-semibold text-sm">{monthName}</h3>
                      </div>
                      <div className="p-3 min-h-[120px]">
                        {holidays.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic">No major holidays</p>
                        ) : (
                          <div className="space-y-2">
                            {holidays.map((holiday, idx) => (
                              <div
                                key={idx}
                                className="group border-b border-border/50 last:border-0 pb-2 last:pb-0"
                                data-testid={`holiday-${holiday.name.toLowerCase().replace(/\s+/g, '-')}`}
                              >
                                <div className="flex items-start gap-2">
                                  <div className="min-w-[28px] h-6 flex items-center justify-center rounded bg-primary/10 dark:bg-primary/20 text-xs font-medium">
                                    {holiday.isVariable ? "~" : holiday.day}
                                  </div>
                                  <div className="flex-1">
                                    <p className="text-sm font-medium leading-tight">{holiday.name}</p>
                                    <p className="text-xs text-muted-foreground/80" data-testid={`date-${holiday.name.toLowerCase().replace(/\s+/g, '-')}`}>
                                      {holiday.date}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      {holiday.description}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Product Analytics
              </CardTitle>
              <CardDescription>
                Track your products over time by category
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                if (uploads.length === 0) {
                  return (
                    <div className="text-center py-12 text-muted-foreground">
                      No product data available. Add products to see analytics.
                    </div>
                  );
                }

                const dates = uploads.map(u => parseISO(u.productDate));
                const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
                const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
                const months = eachMonthOfInterval({
                  start: startOfMonth(subMonths(maxDate, 11)),
                  end: endOfMonth(maxDate)
                });

                const chartData = months.map(month => {
                  const monthStart = startOfMonth(month);
                  const monthEnd = endOfMonth(month);
                  const monthProducts = uploads.filter(u => {
                    const date = parseISO(u.productDate);
                    return date >= monthStart && date <= monthEnd;
                  });

                  const categoryCount: Record<string, number> = {};
                  monthProducts.forEach(p => {
                    const cat = p.category || "Uncategorized";
                    categoryCount[cat] = (categoryCount[cat] || 0) + 1;
                  });

                  return {
                    month: format(month, "MMM yyyy"),
                    total: monthProducts.length,
                    ...categoryCount
                  };
                });

                const allCategories = [...new Set(uploads.map(u => u.category || "Uncategorized"))];
                const colors = [
                  "#8b5cf6", "#f97316", "#22c55e", "#3b82f6", "#ec4899",
                  "#14b8a6", "#eab308", "#a855f7", "#06b6d4", "#f43f5e"
                ];

                return (
                  <div className="space-y-6">
                    <div className="h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="month" className="text-xs" />
                          <YAxis className="text-xs" />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'hsl(var(--card))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px'
                            }}
                          />
                          <Legend />
                          {allCategories.map((category, idx) => (
                            <Bar 
                              key={category}
                              dataKey={category}
                              stackId="a"
                              fill={colors[idx % colors.length]}
                              name={category}
                            />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-2xl font-bold">{uploads.length}</div>
                          <p className="text-xs text-muted-foreground">Total Products</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-2xl font-bold">{allCategories.length}</div>
                          <p className="text-xs text-muted-foreground">Categories</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-2xl font-bold">
                            {uploads.filter(u => u.status === "completed").length}
                          </div>
                          <p className="text-xs text-muted-foreground">Completed</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-2xl font-bold">
                            {uploads.filter(u => u.status === "in-progress").length}
                          </div>
                          <p className="text-xs text-muted-foreground">In Progress</p>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
