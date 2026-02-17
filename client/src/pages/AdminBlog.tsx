import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { BlogEditor } from "@/components/BlogEditor";
import { Plus, Edit, Trash2, Search, Eye, FileText, Loader2, Sparkles } from "lucide-react";
import type { BlogPost } from "@shared/schema";

export default function AdminBlog() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
  const [aiAssistOpen, setAIAssistOpen] = useState(false);
  const [aiAction, setAIAction] = useState<string>("improve");
  const [aiText, setAIText] = useState("");
  const [aiPrompt, setAIPrompt] = useState("");
  const [aiResult, setAIResult] = useState("");
  const [aiTone, setAITone] = useState<string>("professional");
  const [aiBlogLength, setAIBlogLength] = useState<string>("medium");
  const [aiBlogType, setAIBlogType] = useState<string>("how-to");

  // Form state
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [content, setContent] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [featuredImage, setFeaturedImage] = useState("");
  const [category, setCategory] = useState("uncategorized");
  const [tags, setTags] = useState("");
  const [status, setStatus] = useState("draft");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");

  const { data: posts, isLoading } = useQuery<BlogPost[]>({
    queryKey: ["/api/admin/blog", filterCategory, filterStatus, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterCategory && filterCategory !== "all") params.append("category", filterCategory);
      if (filterStatus && filterStatus !== "all") params.append("status", filterStatus);
      if (searchQuery) params.append("search", searchQuery);
      
      const url = `/api/admin/blog${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch blog posts");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("/api/admin/blog", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/blog"] });
      toast({
        title: "Success",
        description: "Blog post created successfully",
      });
      closeEditor();
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create blog post",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest(`/api/admin/blog/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/blog"] });
      toast({
        title: "Success",
        description: "Blog post updated successfully",
      });
      closeEditor();
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update blog post",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/admin/blog/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/blog"] });
      toast({
        title: "Success",
        description: "Blog post deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete blog post",
      });
    },
  });

  const aiAssistMutation = useMutation({
    mutationFn: async ({ action, text, prompt, tone, blogLength, blogType }: { 
      action: string; 
      text?: string; 
      prompt?: string;
      tone?: string;
      blogLength?: string;
      blogType?: string;
    }) => {
      return apiRequest("/api/admin/blog/assist", {
        method: "POST",
        body: JSON.stringify({ action, text, prompt, tone, blogLength, blogType }),
      });
    },
    onSuccess: (data: any) => {
      setAIResult(data.result);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "AI Assist Error",
        description: error.message || "Failed to process AI assistance",
      });
    },
  });

  const openNewPost = () => {
    setSelectedPost(null);
    resetForm();
    setEditorOpen(true);
  };

  const openEditPost = (post: BlogPost) => {
    setSelectedPost(post);
    setTitle(post.title);
    setSlug(post.slug);
    setContent(post.content);
    setExcerpt(post.excerpt || "");
    setFeaturedImage(post.featuredImage || "");
    setCategory(post.category);
    setTags((post.tags || []).join(", "));
    setStatus(post.status);
    setSeoTitle(post.seoTitle || "");
    setSeoDescription(post.seoDescription || "");
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setSelectedPost(null);
    resetForm();
  };

  const resetForm = () => {
    setTitle("");
    setSlug("");
    setContent("");
    setExcerpt("");
    setFeaturedImage("");
    setCategory("uncategorized");
    setTags("");
    setStatus("draft");
    setSeoTitle("");
    setSeoDescription("");
  };

  const handleSave = () => {
    if (!title || !slug || !content) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Title, slug, and content are required",
      });
      return;
    }

    const postData = {
      title,
      slug,
      content,
      excerpt,
      featuredImage: featuredImage || null,
      category,
      tags: tags ? tags.split(",").map(t => t.trim()) : [],
      status,
      seoTitle: seoTitle || null,
      seoDescription: seoDescription || null,
      publishedAt: status === "published" ? new Date().toISOString() : null,
    };

    if (selectedPost) {
      updateMutation.mutate({ id: selectedPost.id, data: postData });
    } else {
      createMutation.mutate(postData);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this blog post?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleAIAssist = (selectedText: string) => {
    setAIText(selectedText);
    setAIAssistOpen(true);
  };

  const runAIAssist = () => {
    aiAssistMutation.mutate({ 
      action: aiAction, 
      text: aiText, 
      prompt: aiPrompt,
      tone: aiTone,
      blogLength: aiBlogLength,
      blogType: aiBlogType
    });
  };

  const applyAIResult = () => {
    if (aiResult) {
      if (aiAction === "generate_blog") {
        setContent(aiResult);
      } else {
        setContent(content.replace(aiText, aiResult));
      }
      setAIAssistOpen(false);
      setAIResult("");
      setAIText("");
      setAIPrompt("");
    }
  };

  const generateSlugFromTitle = () => {
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    setSlug(slug);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileText className="h-8 w-8" />
            Blog Management
          </h1>
          <p className="text-muted-foreground mt-2">Create and manage your blog posts</p>
        </div>
        <Button onClick={openNewPost} className="gap-2" data-testid="button-new-post">
          <Plus className="h-4 w-4" />
          New Post
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Posts</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <Label htmlFor="search">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Search posts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search"
              />
            </div>
          </div>
          <div className="w-[200px]">
            <Label htmlFor="filter-category">Category</Label>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger id="filter-category" data-testid="select-category-filter">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                <SelectItem value="uncategorized">Uncategorized</SelectItem>
                <SelectItem value="news">News</SelectItem>
                <SelectItem value="tutorial">Tutorial</SelectItem>
                <SelectItem value="guide">Guide</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-[200px]">
            <Label htmlFor="filter-status">Status</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger id="filter-status" data-testid="select-status-filter">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Blog Posts Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Posts</CardTitle>
          <CardDescription>
            {posts?.length || 0} total post{posts?.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : posts && posts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posts.map((post) => (
                  <TableRow key={post.id} data-testid={`row-post-${post.id}`}>
                    <TableCell className="font-medium">{post.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{post.category}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={post.status === "published" ? "default" : "secondary"}>
                        {post.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(post.createdAt!).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openEditPost(post)}
                        data-testid={`button-edit-${post.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDelete(post.id)}
                        data-testid={`button-delete-${post.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No blog posts found. Create your first post to get started.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Editor Dialog */}
      <Dialog open={editorOpen} onOpenChange={closeEditor}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedPost ? "Edit Post" : "New Blog Post"}</DialogTitle>
            <DialogDescription>
              {selectedPost ? "Update your blog post" : "Create a new blog post"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter post title"
                  data-testid="input-title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug *</Label>
                <div className="flex gap-2">
                  <Input
                    id="slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="post-url-slug"
                    data-testid="input-slug"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={generateSlugFromTitle}
                    data-testid="button-generate-slug"
                  >
                    Generate
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="excerpt">Excerpt</Label>
              <Textarea
                id="excerpt"
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                placeholder="Short summary of the post"
                rows={2}
                data-testid="input-excerpt"
              />
            </div>

            <div className="space-y-2">
              <Label>Content *</Label>
              <BlogEditor
                content={content}
                onChange={setContent}
                onAIAssist={handleAIAssist}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="category" data-testid="select-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="uncategorized">Uncategorized</SelectItem>
                    <SelectItem value="news">News</SelectItem>
                    <SelectItem value="tutorial">Tutorial</SelectItem>
                    <SelectItem value="guide">Guide</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id="status" data-testid="select-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input
                id="tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="react, tutorial, web development"
                data-testid="input-tags"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="featured-image">Featured Image URL</Label>
              <Input
                id="featured-image"
                value={featuredImage}
                onChange={(e) => setFeaturedImage(e.target.value)}
                placeholder="https://example.com/image.jpg"
                data-testid="input-featured-image"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="seo-title">SEO Title</Label>
              <Input
                id="seo-title"
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                placeholder="Custom SEO title (optional)"
                data-testid="input-seo-title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="seo-description">SEO Description</Label>
              <Textarea
                id="seo-description"
                value={seoDescription}
                onChange={(e) => setSeoDescription(e.target.value)}
                placeholder="Meta description for search engines"
                rows={2}
                data-testid="input-seo-description"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeEditor}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-post"
            >
              {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : "Save Post"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Assist Dialog */}
      <Dialog open={aiAssistOpen} onOpenChange={setAIAssistOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              AI Writing Assistant
            </DialogTitle>
            <DialogDescription>
              Generate complete blog posts from topics, or improve existing content
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="ai-action">Action</Label>
              <Select value={aiAction} onValueChange={setAIAction}>
                <SelectTrigger id="ai-action" data-testid="select-ai-action">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="generate_blog">Generate Full Blog Post</SelectItem>
                  <SelectItem value="improve">Improve Writing</SelectItem>
                  <SelectItem value="expand">Expand Text</SelectItem>
                  <SelectItem value="shorten">Make Concise</SelectItem>
                  <SelectItem value="fix_grammar">Fix Grammar</SelectItem>
                  <SelectItem value="change_tone">Change Tone</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {aiAction === "generate_blog" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="blog-topic">Blog Topic/Title</Label>
                  <Input
                    id="blog-topic"
                    value={aiPrompt}
                    onChange={(e) => setAIPrompt(e.target.value)}
                    placeholder="e.g., How to Create Engaging Print-on-Demand Designs"
                    data-testid="input-blog-topic"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="blog-outline">Outline / Additional Instructions (Optional)</Label>
                  <Textarea
                    id="blog-outline"
                    value={aiText}
                    onChange={(e) => setAIText(e.target.value)}
                    rows={6}
                    placeholder="Provide a detailed outline or instructions for the AI. For example:&#10;&#10;Key points to cover:&#10;- Introduction to POD business&#10;- Best product categories (apparel, home decor, accessories)&#10;- Design tips for each category&#10;- Common mistakes to avoid&#10;&#10;Target audience: Beginners to POD&#10;Keywords: print on demand, POD products, custom merchandise"
                    data-testid="textarea-blog-outline"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="blog-type">Blog Type</Label>
                    <Select value={aiBlogType} onValueChange={setAIBlogType}>
                      <SelectTrigger id="blog-type" data-testid="select-blog-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="how-to">How-To Guide</SelectItem>
                        <SelectItem value="listicle">Listicle</SelectItem>
                        <SelectItem value="product-review">Product Review</SelectItem>
                        <SelectItem value="opinion">Opinion Piece</SelectItem>
                        <SelectItem value="tutorial">Step-by-Step Tutorial</SelectItem>
                        <SelectItem value="comparison">Comparison</SelectItem>
                        <SelectItem value="case-study">Case Study</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="blog-tone">Tone</Label>
                    <Select value={aiTone} onValueChange={setAITone}>
                      <SelectTrigger id="blog-tone" data-testid="select-blog-tone">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="casual">Casual</SelectItem>
                        <SelectItem value="conversational">Conversational</SelectItem>
                        <SelectItem value="authoritative">Authoritative</SelectItem>
                        <SelectItem value="friendly">Friendly</SelectItem>
                        <SelectItem value="enthusiastic">Enthusiastic</SelectItem>
                        <SelectItem value="informative">Informative</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="blog-length">Blog Length</Label>
                  <Select value={aiBlogLength} onValueChange={setAIBlogLength}>
                    <SelectTrigger id="blog-length" data-testid="select-blog-length">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="short">Short (300-500 words)</SelectItem>
                      <SelectItem value="medium">Medium (600-1000 words)</SelectItem>
                      <SelectItem value="long">Long (1200-2000 words)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <>
                {aiAction === "change_tone" && (
                  <div className="space-y-2">
                    <Label htmlFor="ai-tone">Desired Tone</Label>
                    <Select value={aiTone} onValueChange={setAITone}>
                      <SelectTrigger id="ai-tone" data-testid="select-tone">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="casual">Casual</SelectItem>
                        <SelectItem value="conversational">Conversational</SelectItem>
                        <SelectItem value="authoritative">Authoritative</SelectItem>
                        <SelectItem value="friendly">Friendly</SelectItem>
                        <SelectItem value="enthusiastic">Enthusiastic</SelectItem>
                        <SelectItem value="informative">Informative</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Selected Text</Label>
                  <Textarea
                    value={aiText}
                    onChange={(e) => setAIText(e.target.value)}
                    rows={4}
                    className="font-mono text-sm"
                    data-testid="textarea-ai-text"
                  />
                </div>
              </>
            )}

            <Button
              onClick={runAIAssist}
              disabled={
                aiAssistMutation.isPending || 
                (aiAction === "generate_blog" ? !aiPrompt : !aiText)
              }
              className="w-full gap-2"
              data-testid="button-run-ai-assist"
            >
              {aiAssistMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  {aiAction === "generate_blog" ? "Generate Blog Post" : "Run AI Assist"}
                </>
              )}
            </Button>

            {aiResult && (
              <div className="space-y-2">
                <Label>AI Result</Label>
                <Textarea
                  value={aiResult}
                  onChange={(e) => setAIResult(e.target.value)}
                  rows={10}
                  className="font-mono text-sm"
                  data-testid="textarea-ai-result"
                />
                <Button
                  onClick={applyAIResult}
                  variant="default"
                  className="w-full"
                  data-testid="button-apply-ai-result"
                >
                  {aiAction === "generate_blog" ? "Use as Content" : "Apply to Content"}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
