import { Monitor, Smartphone, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { AspectRatio } from '@shared/schema';

interface AspectRatioSelectorProps {
  selected: AspectRatio;
  onSelect: (ratio: AspectRatio) => void;
  title?: string;
  description?: string;
}

const aspectRatios = [
  {
    value: '16:9' as AspectRatio,
    label: 'Landscape',
    description: 'Widescreen format',
    icon: Monitor,
    preview: 'w-8 h-5'
  },
  {
    value: '9:16' as AspectRatio,
    label: 'Portrait',
    description: 'Mobile-friendly format',
    icon: Smartphone,
    preview: 'w-5 h-8'
  },
  {
    value: '1:1' as AspectRatio,
    label: 'Square',
    description: 'Social media format',
    icon: Square,
    preview: 'w-6 h-6'
  }
];

export default function AspectRatioSelector({ 
  selected, 
  onSelect, 
  title = "Format", 
  description = "Choose the aspect ratio" 
}: AspectRatioSelectorProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {aspectRatios.map((ratio) => {
          const Icon = ratio.icon;
          const isSelected = selected === ratio.value;
          
          return (
            <Card
              key={ratio.value}
              className={`cursor-pointer transition-all hover-elevate ${
                isSelected 
                  ? 'ring-2 ring-primary bg-primary/5' 
                  : 'hover:border-primary/50'
              }`}
              onClick={() => {
                console.log('Aspect ratio selected:', ratio.value);
                onSelect(ratio.value);
              }}
              data-testid={`card-aspect-${ratio.value}`}
            >
              <div className="p-4 text-center space-y-3" aria-selected={isSelected}>
                <div className="flex items-center justify-center space-x-2">
                  <Icon className={`h-5 w-5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div className={`bg-border rounded ${ratio.preview}`}></div>
                </div>
                
                <div className="space-y-1">
                  <p className={`font-medium ${isSelected ? 'text-primary' : ''}`}>
                    {ratio.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {ratio.value}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {ratio.description}
                  </p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}