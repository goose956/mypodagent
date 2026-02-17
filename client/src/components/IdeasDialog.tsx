import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lightbulb, Copy } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface IdeasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const productTypes = [
  { value: 'mug', label: 'Mug' },
  { value: 'tshirt', label: 'T-Shirt' },
  { value: 'hoodie', label: 'Hoodie' },
  { value: 'poster', label: 'Poster' },
  { value: 'tote-bag', label: 'Tote Bag' },
  { value: 'phone-case', label: 'Phone Case' },
  { value: 'sticker', label: 'Sticker' },
  { value: 'pillow', label: 'Pillow' },
];

const niches = [
  { value: 'nurses', label: 'Nurses' },
  { value: 'teachers', label: 'Teachers' },
  { value: 'doctors', label: 'Doctors' },
  { value: 'programmers', label: 'Programmers' },
  { value: 'pet-lovers', label: 'Pet Lovers' },
  { value: 'fitness', label: 'Fitness Enthusiasts' },
  { value: 'gamers', label: 'Gamers' },
  { value: 'coffee-lovers', label: 'Coffee Lovers' },
  { value: 'mom-dad', label: 'Moms & Dads' },
  { value: 'students', label: 'Students' },
];

const tones = [
  { value: 'funny', label: 'Funny' },
  { value: 'sarcastic', label: 'Sarcastic' },
  { value: 'inspirational', label: 'Inspirational' },
  { value: 'cute', label: 'Cute' },
  { value: 'professional', label: 'Professional' },
  { value: 'edgy', label: 'Edgy' },
  { value: 'wholesome', label: 'Wholesome' },
  { value: 'motivational', label: 'Motivational' },
];

export function IdeasDialog({ open, onOpenChange }: IdeasDialogProps) {
  const { toast } = useToast();
  const [productType, setProductType] = useState('');
  const [niche, setNiche] = useState('');
  const [tone, setTone] = useState('');
  const [numberOfIdeas, setNumberOfIdeas] = useState('5');
  const [ideas, setIdeas] = useState<string[]>([]);

  const generateIdeasMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/generate-ideas', {
        method: 'POST',
        body: JSON.stringify({
          productType,
          niche,
          tone,
          numberOfIdeas: parseInt(numberOfIdeas),
        }),
      });
      return response;
    },
    onSuccess: (data: any) => {
      setIdeas(data.ideas);
      toast({
        title: 'Ideas generated!',
        description: `Generated ${data.ideas.length} product ideas.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error generating ideas',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleGenerate = () => {
    if (!productType || !niche || !tone) {
      toast({
        title: 'Missing information',
        description: 'Please fill in all fields before generating ideas.',
        variant: 'destructive',
      });
      return;
    }

    generateIdeasMutation.mutate();
  };

  const copyToClipboard = (idea: string) => {
    navigator.clipboard.writeText(idea);
    toast({
      title: 'Copied!',
      description: 'Idea copied to clipboard.',
    });
  };

  const handleReset = () => {
    setProductType('');
    setNiche('');
    setTone('');
    setNumberOfIdeas('5');
    setIdeas([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-primary" />
            AI Product Ideas Generator
          </DialogTitle>
          <DialogDescription>
            Generate creative product ideas using AI. Select your product type, target niche, and desired tone to get started.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="product-type">Product Type</Label>
              <Select value={productType} onValueChange={setProductType}>
                <SelectTrigger id="product-type" data-testid="select-product-type">
                  <SelectValue placeholder="Select product type" />
                </SelectTrigger>
                <SelectContent>
                  {productTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="niche">Target Niche</Label>
              <Select value={niche} onValueChange={setNiche}>
                <SelectTrigger id="niche" data-testid="select-niche">
                  <SelectValue placeholder="Select niche" />
                </SelectTrigger>
                <SelectContent>
                  {niches.map((n) => (
                    <SelectItem key={n.value} value={n.value}>
                      {n.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tone">Tone</Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger id="tone" data-testid="select-tone">
                  <SelectValue placeholder="Select tone" />
                </SelectTrigger>
                <SelectContent>
                  {tones.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="number-of-ideas">Number of Ideas</Label>
              <Input
                id="number-of-ideas"
                type="number"
                min="1"
                max="20"
                value={numberOfIdeas}
                onChange={(e) => setNumberOfIdeas(e.target.value)}
                data-testid="input-number-of-ideas"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleGenerate}
              disabled={generateIdeasMutation.isPending}
              className="flex-1"
              data-testid="button-generate-ideas"
            >
              {generateIdeasMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Lightbulb className="w-4 h-4 mr-2" />
                  Generate Ideas
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleReset}
              data-testid="button-reset-ideas"
            >
              Reset
            </Button>
          </div>

          {ideas.length > 0 && (
            <div className="space-y-3 pt-4">
              <h3 className="text-sm font-semibold">Generated Ideas:</h3>
              <div className="space-y-2">
                {ideas.map((idea, index) => (
                  <Card key={index}>
                    <CardContent className="p-4 flex items-start justify-between gap-3">
                      <p className="text-sm flex-1" data-testid={`idea-text-${index}`}>
                        {idea}
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(idea)}
                        data-testid={`button-copy-idea-${index}`}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
