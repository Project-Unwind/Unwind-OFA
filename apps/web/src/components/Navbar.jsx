import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Menu, ShieldCheck, X } from "lucide-react";
import Button from "./Button";
import "./Navbar.css";

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="ofa-navbar">
      <div className="ofa-navbar-inner">
        <Link to="/" className="ofa-brand" onClick={closeMenu}>
          <span className="ofa-brand-icon">
            <ShieldCheck size={23} />
          </span>

          <span className="ofa-brand-copy">
            <strong>unwind<span>.</span></strong>
            <small>ONE FOR ALL</small>
          </span>
        </Link>

        <button
          className="ofa-mobile-menu"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X /> : <Menu />}
        </button>

        <nav className={`ofa-nav-links ${menuOpen ? "is-open" : ""}`}>
          <NavLink to="/#platform" onClick={closeMenu}>Platform</NavLink>
          <NavLink to="/security" onClick={closeMenu}>Security</NavLink>
          <NavLink to="/connect" onClick={closeMenu}>Developers</NavLink>

          <div className="ofa-nav-actions">
            <Link to="/login" className="ofa-login-link" onClick={closeMenu}>
              Log in
            </Link>

            <Button href="/signup" icon>
              Get started
            </Button>
          </div>
        </nav>
      </div>
    </header>
  );
}

export default Navbar;