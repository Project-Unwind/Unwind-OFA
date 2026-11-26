import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import './Footer.css';

function Footer() {
  return (
    <footer className="ofa-footer">
      <div className="ofa-footer-main">
        <Link href="/" className="ofa-brand">
          <span className="ofa-brand-icon">
            <ShieldCheck size={21} />
          </span>

          <span className="ofa-brand-copy">
            <strong>unwind<span>.</span></strong>
            <small>ONE FOR ALL</small>
          </span>
        </Link>

        <div className="ofa-footer-links">
          <Link href="/security">Security</Link>
          <Link href="/connect">Developers</Link>
          <Link href="/login">Log in</Link>
        </div>
      </div>

      <div className="ofa-footer-bottom">
        <span>© 2026 Unwind OFA. Part of the Unwind ecosystem.</span>

        <span className="ofa-footer-status">
          <span /> PRIVACY MINDED BY DESIGN
        </span>
      </div>
    </footer>
  );
}

export default Footer;