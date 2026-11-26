'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, ShieldCheck, X } from 'lucide-react';
import Button from './Button';
import './Navbar.css';

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  const closeMenu = () => setMenuOpen(false);

  const isActive = (path) => pathname === path ? 'active' : '';

  return (
    <header className="ofa-navbar">
      <div className="ofa-navbar-inner">
        <Link href="/" className="ofa-brand" onClick={closeMenu}>
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
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X /> : <Menu />}
        </button>

        <nav className={`ofa-nav-links ${menuOpen ? 'is-open' : ''}`}>
          <Link href="/#platform" onClick={closeMenu}>
            Platform
          </Link>

          <Link
            href="/security"
            className={isActive('/security')}
            onClick={closeMenu}
          >
            Security
          </Link>

          <Link
            href="/connect"
            className={isActive('/connect')}
            onClick={closeMenu}
          >
            Developers
          </Link>

          <div className="ofa-nav-actions">
            <Link
              href="/login"
              className={`ofa-login-link ${isActive('/login')}`}
              onClick={closeMenu}
            >
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