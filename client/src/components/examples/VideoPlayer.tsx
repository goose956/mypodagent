import VideoPlayer from '../VideoPlayer';
import { ThemeProvider } from '../ThemeProvider';

export default function VideoPlayerExample() {
  const handleDownload = () => {
    console.log('Example: Download clicked');
  };

  const handleShare = () => {
    console.log('Example: Share clicked');
  };

  return (
    <ThemeProvider>
      <div className="p-8 space-y-8">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Empty State</h3>
          <VideoPlayer aspectRatio="16:9" />
        </div>
        
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Processing State</h3>
          <VideoPlayer 
            aspectRatio="16:9"
            isProcessing={true}
            progress={67}
          />
        </div>
        
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">With Video (Landscape)</h3>
          <VideoPlayer 
            aspectRatio="16:9"
            videoUrl="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
            onDownload={handleDownload}
            onShare={handleShare}
          />
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Portrait Format</h3>
          <div className="max-w-sm">
            <VideoPlayer 
              aspectRatio="9:16"
              videoUrl="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
              onDownload={handleDownload}
              onShare={handleShare}
            />
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
}