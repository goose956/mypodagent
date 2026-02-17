import AspectRatioSelector from '../AspectRatioSelector';
import { ThemeProvider } from '../ThemeProvider';
import { useState } from 'react';

export default function AspectRatioSelectorExample() {
  const [selected, setSelected] = useState<'16:9' | '9:16' | '1:1'>('16:9');

  return (
    <ThemeProvider>
      <div className="p-8 max-w-2xl">
        <AspectRatioSelector 
          selected={selected}
          onSelect={setSelected}
        />
      </div>
    </ThemeProvider>
  );
}