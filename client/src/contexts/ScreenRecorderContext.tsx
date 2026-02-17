import { createContext, useContext, useState, useRef, ReactNode, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";

interface ScreenRecorderContextType {
  isRecording: boolean;
  isUploading: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
}

const ScreenRecorderContext = createContext<ScreenRecorderContextType | undefined>(undefined);

export function ScreenRecorderProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const uploadRecordingMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/upload-screen-recording", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Failed to upload recording");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/screen-recordings"] });
      toast({
        title: "Recording saved",
        description: "Your screen recording has been saved successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getRecorderOptions = () => {
    const codecs = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm;codecs=h264,opus",
      "video/mp4",
    ];
    
    for (const codec of codecs) {
      if (MediaRecorder.isTypeSupported(codec)) {
        return {
          mimeType: codec,
          videoBitsPerSecond: 2500000,
          audioBitsPerSecond: 128000,
        };
      }
    }
    
    return {};
  };

  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        toast({
          title: "Not supported",
          description: "Screen recording is not supported in this browser.",
          variant: "destructive",
        });
        return;
      }

      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: "always",
        } as any,
        audio: false,
      });

      let audioStream: MediaStream | null = null;
      try {
        audioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 44100,
          },
        });
      } catch (err) {
        console.log("Microphone not available, continuing without audio");
      }

      const combinedStream = new MediaStream();
      displayStream.getVideoTracks().forEach(track => combinedStream.addTrack(track));
      if (audioStream) {
        audioStream.getAudioTracks().forEach(track => combinedStream.addTrack(track));
      }

      streamRef.current = combinedStream;
      recordedChunksRef.current = [];

      const options = getRecorderOptions();
      const mediaRecorder = new MediaRecorder(combinedStream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, {
          type: options.mimeType || "video/webm",
        });

        setIsUploading(true);
        try {
          const formData = new FormData();
          const fileName = `recording-${Date.now()}.webm`;
          formData.append("file", blob, fileName);
          formData.append("fileName", fileName);
          formData.append("fileSize", blob.size.toString());
          formData.append("mimeType", options.mimeType || "video/webm");

          await uploadRecordingMutation.mutateAsync(formData);
        } catch (error) {
          console.error("Upload error:", error);
        } finally {
          setIsUploading(false);
          recordedChunksRef.current = [];
        }
      };

      combinedStream.getVideoTracks()[0].onended = () => {
        stopRecording();
      };

      mediaRecorder.start(200);
      setIsRecording(true);

      toast({
        title: "Recording started",
        description: "Your screen is being recorded. You can navigate to other pages.",
      });
    } catch (error) {
      console.error("Error starting recording:", error);
      toast({
        title: "Recording failed",
        description: error instanceof Error ? error.message : "Failed to start recording",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    setIsRecording(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <ScreenRecorderContext.Provider value={{ isRecording, isUploading, startRecording, stopRecording }}>
      {children}
    </ScreenRecorderContext.Provider>
  );
}

export function useScreenRecorder() {
  const context = useContext(ScreenRecorderContext);
  if (!context) {
    throw new Error("useScreenRecorder must be used within ScreenRecorderProvider");
  }
  return context;
}
