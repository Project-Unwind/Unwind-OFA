import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import './MainLayout.css';

function MainLayout({ children }) {
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