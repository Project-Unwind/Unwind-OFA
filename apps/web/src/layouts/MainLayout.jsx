import { Outlet } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import "./MainLayout.css";

function MainLayout() {
  return (
    <div className="ofa-main-layout">
      <Navbar />
      <main className="ofa-main-content">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

export default MainLayout;