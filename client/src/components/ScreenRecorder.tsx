import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Video, Square, Loader2 } from "lucide-react";
import { useScreenRecorder } from "@/contexts/ScreenRecorderContext";

export function ScreenRecorder() {
  const { isRecording, isUploading, startRecording, stopRecording } = useScreenRecorder();

  return (
    <Card data-testid="card-screen-recorder">
      <CardHeader>
        <CardTitle>Screen Recording</CardTitle>
        <CardDescription>
          Record your screen to create demo videos of the application
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          {!isRecording ? (
            <Button
              onClick={startRecording}
              disabled={isUploading}
              data-testid="button-start-recording"
            >
              <Video className="mr-2 h-4 w-4" />
              Start Recording
            </Button>
          ) : (
            <Button
              onClick={stopRecording}
              variant="destructive"
              data-testid="button-stop-recording"
            >
              <Square className="mr-2 h-4 w-4" />
              Stop Recording
            </Button>
          )}
          
          {isUploading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading recording...
            </div>
          )}
        </div>

        {isRecording && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
            <div className="h-3 w-3 bg-destructive rounded-full animate-pulse" />
            <span className="text-sm font-medium">Recording in progress...</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
