import ChatInterface from '../ChatInterface';
import { ThemeProvider } from '../ThemeProvider';

// todo: remove mock functionality
const mockMessages = [
  {
    id: '1',
    content: 'I want to create a sleek product showcase video for my new headphones. The scene should have dramatic lighting with a rotating product display.',
    role: 'user' as const,
    timestamp: new Date(Date.now() - 120000)
  },
  {
    id: '2',
    content: 'Great! I\'ll create a professional product showcase video with dramatic lighting and smooth rotation. The video will highlight your headphones with cinematic camera movements and premium aesthetics.',
    role: 'assistant' as const,
    timestamp: new Date(Date.now() - 60000)
  }
];

export default function ChatInterfaceExample() {
  const handleSendMessage = (message: string) => {
    console.log('Example: Message sent', message);
  };

  return (
    <ThemeProvider>
      <div className="h-[600px] border rounded-lg overflow-hidden">
        <ChatInterface 
          onSendMessage={handleSendMessage}
          messages={mockMessages}
        />
      </div>
    </ThemeProvider>
  );
}