import type { ReactNode } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import './MainLayout.css';

interface MainLayoutProps {
  children: ReactNode;
}

function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="ofa-main-layout">
      <Navbar />

      <main className="ofa-main-content">
        {children}
      </main>

      <Footer />
    </div>
  );
}

export default MainLayout;