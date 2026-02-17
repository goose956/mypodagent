import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, FolderOpen, Archive, File, Image, Video, FileText, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FileInfo {
  name: string;
  size: number;
  contentType: string;
  lastModified: Date;
}

interface FileBrowserModalProps {
  folderPath: string;
  folderName: string;
  children: React.ReactNode;
}

export function FileBrowserModal({ folderPath, folderName, children }: FileBrowserModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const { toast } = useToast();

  const fetchFiles = async () => {
    if (!folderPath) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/files/${encodeURIComponent(folderPath)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch files');
      }
      const fileList: FileInfo[] = await response.json();
      // Parse lastModified strings back to Date objects
      const parsedFiles = fileList.map(file => ({
        ...file,
        lastModified: new Date(file.lastModified)
      }));
      setFiles(parsedFiles);
    } catch (error) {
      console.error('Error fetching files:', error);
      toast({
        title: "Error",
        description: "Failed to load files. Please try again.",
        variant: "destructive",
      });
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchFiles();
    }
  }, [isOpen, folderPath]);

  const downloadFile = async (fileName: string) => {
    try {
      const response = await fetch(`/api/download/${encodeURIComponent(folderPath)}?fileName=${encodeURIComponent(fileName)}`);
      if (!response.ok) {
        throw new Error('Failed to download file');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Success",
        description: `Downloaded ${fileName}`,
      });
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({
        title: "Error",
        description: `Failed to download ${fileName}`,
        variant: "destructive",
      });
    }
  };

  const downloadZip = async () => {
    if (files.length === 0) {
      toast({
        title: "No Files",
        description: "No files available to download",
        variant: "destructive",
      });
      return;
    }

    setDownloadingZip(true);
    try {
      const response = await fetch(`/api/download-zip/${encodeURIComponent(folderPath)}`);
      if (!response.ok) {
        throw new Error('Failed to create zip file');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `${folderName || 'files'}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Success",
        description: `Downloaded ${folderName || 'files'}.zip with ${files.length} files`,
      });
    } catch (error) {
      console.error('Error downloading zip:', error);
      toast({
        title: "Error",
        description: "Failed to create zip file",
        variant: "destructive",
      });
    } finally {
      setDownloadingZip(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (contentType: string) => {
    if (contentType.startsWith('image/')) return <Image className="w-4 h-4 text-blue-500" />;
    if (contentType.startsWith('video/')) return <Video className="w-4 h-4 text-purple-500" />;
    if (contentType.startsWith('text/')) return <FileText className="w-4 h-4 text-green-500" />;
    return <File className="w-4 h-4 text-gray-500" />;
  };

  const getFileTypeBadge = (contentType: string) => {
    const type = contentType.split('/')[0];
    const colors = {
      image: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      video: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      text: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      application: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    };
    return (
      <Badge variant="secondary" className={colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800'}>
        {type}
      </Badge>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5" />
            Files in {folderName}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex items-center justify-between py-4">
          <div className="text-sm text-muted-foreground">
            {loading ? 'Loading...' : `${files.length} file(s)`}
          </div>
          <Button
            onClick={downloadZip}
            disabled={files.length === 0 || downloadingZip}
            size="sm"
            className="gap-2"
            data-testid="button-download-zip"
          >
            {downloadingZip ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Archive className="w-4 h-4" />
            )}
            Download All as ZIP
          </Button>
        </div>

        <div className="flex-1 overflow-auto border rounded-lg">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              Loading files...
            </div>
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FolderOpen className="w-12 h-12 mb-4 opacity-50" />
              <p>No files found in this folder</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Modified</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((file, index) => (
                  <TableRow key={index} data-testid={`file-row-${index}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getFileIcon(file.contentType)}
                        <span className="font-medium" data-testid={`file-name-${index}`}>
                          {file.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getFileTypeBadge(file.contentType)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatFileSize(file.size)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {file.lastModified.toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => downloadFile(file.name)}
                        data-testid={`button-download-${index}`}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}