import './globals.css';
import { SettingsProvider } from '@/context/SettingsContext';

export const metadata = {
  title: 'AI Company Research Assistant',
  description: 'AI-powered tool to research any company using its name or website URL.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <SettingsProvider>
          {children}
        </SettingsProvider>
      </body>
    </html>
  );
}
