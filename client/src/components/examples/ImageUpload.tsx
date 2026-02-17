import ImageUpload from '../ImageUpload';
import { ThemeProvider } from '../ThemeProvider';

export default function ImageUploadExample() {
  const handleImageUpload = (imageUrl: string) => {
    console.log('Example: Image uploaded', imageUrl);
  };

  const handleRemoveImage = () => {
    console.log('Example: Image removed');
  };

  return (
    <ThemeProvider>
      <div className="p-8 space-y-8">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Empty State</h3>
          <ImageUpload onImageUpload={handleImageUpload} />
        </div>
        
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">With Uploaded Image</h3>
          <ImageUpload 
            onImageUpload={handleImageUpload}
            uploadedImage="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=300&fit=crop"
            onRemoveImage={handleRemoveImage}
          />
        </div>
        
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Uploading State</h3>
          <ImageUpload 
            onImageUpload={handleImageUpload}
            uploadedImage="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=300&fit=crop"
            onRemoveImage={handleRemoveImage}
            isUploading={true}
          />
        </div>
      </div>
    </ThemeProvider>
  );
}