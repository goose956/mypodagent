import Header from '../Header';
import { ThemeProvider } from '../ThemeProvider';

export default function HeaderExample() {
  return (
    <ThemeProvider>
      <div className="bg-background min-h-screen">
        <Header />
        <div className="p-8">
          <p className="text-muted-foreground">Header component with theme toggle functionality</p>
        </div>
      </div>
    </ThemeProvider>
  );
}