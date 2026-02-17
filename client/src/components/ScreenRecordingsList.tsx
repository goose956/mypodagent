import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Download, Trash2, Loader2, PackageOpen, Eye } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type ScreenRecording = {
  id: string;
  fileName: string;
  storagePath: string;
  publicUrl: string;
  fileSize: number;
  duration: number | null;
  mimeType: string;
  createdAt: string;
};

export function ScreenRecordingsList() {
  const { toast } = useToast();
  const [previewRecording, setPreviewRecording] = useState<ScreenRecording | null>(null);

  const { data: recordings, isLoading } = useQuery<ScreenRecording[]>({
    queryKey: ["/api/admin/screen-recordings"],
  });

  const deleteRecordingMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/admin/screen-recordings/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/screen-recordings"] });
      toast({
        title: "Recording deleted",
        description: "The screen recording has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const formatFileSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const downloadAll = () => {
    window.open("/api/admin/screen-recordings/download-all", "_blank");
  };

  if (isLoading) {
    return (
      <Card data-testid="card-recordings-list">
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-recordings-list">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Screen Recordings</CardTitle>
            <CardDescription>
              {recordings?.length || 0} recording{recordings?.length !== 1 ? "s" : ""} saved
            </CardDescription>
          </div>
          {recordings && recordings.length > 0 && (
            <Button
              onClick={downloadAll}
              variant="outline"
              data-testid="button-download-all"
            >
              <PackageOpen className="mr-2 h-4 w-4" />
              Download All as ZIP
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!recordings || recordings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No recordings yet. Start recording to create demo videos.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File Name</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recordings.map((recording) => (
                <TableRow key={recording.id} data-testid={`row-recording-${recording.id}`}>
                  <TableCell className="font-medium">{recording.fileName}</TableCell>
                  <TableCell>{formatFileSize(recording.fileSize)}</TableCell>
                  <TableCell>
                    {formatDistanceToNow(new Date(recording.createdAt), { addSuffix: true })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPreviewRecording(recording)}
                        data-testid={`button-preview-${recording.id}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(recording.publicUrl, "_blank")}
                        data-testid={`button-download-${recording.id}`}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteRecordingMutation.mutate(recording.id)}
                        disabled={deleteRecordingMutation.isPending}
                        data-testid={`button-delete-${recording.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Video Preview Dialog */}
      <Dialog open={!!previewRecording} onOpenChange={(open) => !open && setPreviewRecording(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{previewRecording?.fileName}</DialogTitle>
            <DialogDescription>
              {previewRecording && formatFileSize(previewRecording.fileSize)} • 
              Created {previewRecording && formatDistanceToNow(new Date(previewRecording.createdAt), { addSuffix: true })}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {previewRecording && (
              <video
                src={previewRecording.publicUrl}
                controls
                className="w-full rounded-lg bg-black"
                data-testid="video-preview"
              >
                Your browser does not support the video tag.
              </video>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
