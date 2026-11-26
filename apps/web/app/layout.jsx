import '../src/styles/global.css';
import { AuthProvider } from '../src/context/AuthContext';

export const metadata = {
  title: 'Unwind OFA | One For All',
  description:
    'One identity. One secure vault. One connected Unwind ecosystem.',
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}