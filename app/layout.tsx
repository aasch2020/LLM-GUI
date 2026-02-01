import '../styles/globals.css';

export const metadata = {
  title: 'Mind Map',
  description: 'Interactive choose-your-own-adventure mind map',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}
