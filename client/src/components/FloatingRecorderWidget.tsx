import { Button } from "@/components/ui/button";
import { Square, Loader2, Video } from "lucide-react";
import { useScreenRecorder } from "@/contexts/ScreenRecorderContext";
import { useAuth } from "@/lib/auth";

export function FloatingRecorderWidget() {
  const { isRecording, isUploading, stopRecording } = useScreenRecorder();
  const { user } = useAuth();

  // Only show widget if user is admin and recording is active
  if (!(user as any)?.isAdmin || (!isRecording && !isUploading)) {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-[9999]" data-testid="floating-recorder-widget">
      <div className="bg-background border-2 border-destructive shadow-2xl rounded-lg p-4 min-w-[280px]">
        <div className="space-y-3">
          {/* Recording status */}
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 bg-destructive rounded-full animate-pulse" />
            <span className="text-sm font-semibold">Recording in progress</span>
          </div>

          {/* Stop button */}
          <Button
            onClick={stopRecording}
            variant="destructive"
            className="w-full"
            disabled={isUploading}
            data-testid="button-floating-stop"
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

          {/* Info text */}
          <p className="text-xs text-muted-foreground text-center">
            You can navigate freely while recording
          </p>
        </div>
      </div>
    </div>
  );
}
