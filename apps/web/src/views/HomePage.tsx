import {
  ArrowRight,
  ArrowUpRight,
  Blocks,
  Fingerprint,
  KeyRound,
  ShieldCheck,
  LockKeyhole,
  Check,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import Link from 'next/link';
import Button from '../components/Button';
import './HomePage.css';

interface Product {
  number: string;
  icon: LucideIcon;
  tag: string;
  title: string;
  description: string;
}

const products: Product[] = [
  {
    number: '01',
    icon: Fingerprint,
    tag: 'IDENTITY & SSO',
    title: 'Unwind Identity',
    description:
      'One identity for your Unwind ecosystem. Sign in once and move seamlessly between applications.',
  },
  {
    number: '02',
    icon: KeyRound,
    tag: 'ZERO-KNOWLEDGE VAULT',
    title: 'Unwind Vault',
    description:
      'Your credentials protected through client-side encryption and keys that remain under your control.',
  },
  {
    number: '03',
    icon: Blocks,
    tag: 'DEVELOPER PLATFORM',
    title: 'Unwind Connect',
    description:
      'A unified authentication layer designed to connect Unwind applications securely.',
  },
];

function HomePage() {
  return (
    <div className="ofa-home">
      <section className="ofa-hero">
        <div className="ofa-hero-glow" />

        <div className="ofa-hero-content">
          <div className="ofa-eyebrow">
            <span className="ofa-status-dot" />
            ONE IDENTITY. ONE SECURE ECOSYSTEM.
          </div>

          <h1>
            Everything connected.
            <br />
            <span>Everything protected.</span>
          </h1>

          <p className="ofa-hero-description">
            Meet the identity and security layer powering the Unwind
            ecosystem. One account, one secure vault, and greater control
            over your digital identity.
          </p>

          <div className="ofa-hero-actions">
            <Button href="#platform" icon>
              Explore the platform
            </Button>

            <Button href="/security" variant="secondary">
              Discover our security
            </Button>
          </div>

          <div className="ofa-hero-assurance">
            <span>
              <Check size={15} /> Privacy-first architecture
            </span>
            <span>
              <Check size={15} /> Built for the Unwind ecosystem
            </span>
          </div>
        </div>

        <div className="ofa-hero-visual">
          <div className="ofa-orbit ofa-orbit-one" />
          <div className="ofa-orbit ofa-orbit-two" />
          <div className="ofa-orbit ofa-orbit-three" />

          <div className="ofa-visual-core">
            <div className="ofa-core-inner">
              <ShieldCheck size={52} strokeWidth={1.3} />
            </div>
          </div>

          <div className="ofa-orbit-node ofa-node-top">
            <Fingerprint size={22} />
          </div>

          <div className="ofa-orbit-node ofa-node-right">
            <KeyRound size={22} />
          </div>

          <div className="ofa-orbit-node ofa-node-left">
            <Blocks size={22} />
          </div>

          <div className="ofa-visual-caption">
            <span className="ofa-status-dot" />
            UNWIND SECURITY LAYER
          </div>
        </div>

        <div className="ofa-hero-bottom">
          <span>DESIGNED AROUND YOUR DIGITAL LIFE</span>
          <span>IDENTITY <i /> SECURITY <i /> CONTROL</span>
        </div>
      </section>

      <section className="ofa-platform-section" id="platform">
        <div className="ofa-section-heading">
          <div>
            <div className="ofa-eyebrow">THE UNWIND PLATFORM</div>
            <h2>
              One foundation.
              <br />
              <span>Three powerful layers.</span>
            </h2>
          </div>

          <p>
            A unified foundation for how you authenticate, protect your
            credentials, and connect your applications.
          </p>
        </div>

        <div className="ofa-product-grid">
          {products.map((product) => {
            const Icon = product.icon;

            return (
              <article
                className="ofa-product-card"
                key={product.number}
              >
                <div className="ofa-card-top">
                  <span className="ofa-product-icon">
                    <Icon size={24} />
                  </span>

                  <span className="ofa-product-number">
                    {product.number}
                  </span>
                </div>

                <span className="ofa-product-tag">
                  {product.tag}
                </span>

                <h3>{product.title}</h3>
                <p>{product.description}</p>

                <Link href="/signup" className="ofa-card-link">
                  Get started <ArrowUpRight size={16} />
                </Link>
              </article>
            );
          })}
        </div>
      </section>

      <section className="ofa-security-section">
        <div className="ofa-security-visual">
          <div className="ofa-security-ring">
            <LockKeyhole size={43} strokeWidth={1.3} />
          </div>

          <span className="ofa-security-label ofa-label-one">
            PRIVATE BY DESIGN
          </span>

          <span className="ofa-security-label ofa-label-two">
            CONTROLLED BY YOU
          </span>
        </div>

        <div className="ofa-security-copy">
          <div className="ofa-eyebrow">
            SECURITY IS THE FOUNDATION
          </div>

          <h2>
            Your identity.
            <br />
            <span>Your control.</span>
          </h2>

          <p>
            Unwind OFA is being designed around privacy, strong
            authentication, and a vault architecture where sensitive
            information is encrypted on your device.
          </p>

          <ul>
            <li>
              <Check size={17} /> Client-side vault encryption
            </li>
            <li>
              <Check size={17} /> Privacy-first identity architecture
            </li>
            <li>
              <Check size={17} /> Secure connections across Unwind apps
            </li>
          </ul>

          <Link href="/security" className="ofa-text-link">
            Explore security <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <section className="ofa-connect-section">
        <div className="ofa-connect-panel">
          <div>
            <div className="ofa-eyebrow">
              BUILT FOR THE ECOSYSTEM
            </div>

            <h2>
              One connection.
              <br />
              <span>Every Unwind product.</span>
            </h2>

            <p>
              Unwind Connect is designed to make secure authentication
              integration simpler across the applications we build.
            </p>

            <Button href="/connect" icon>
              Explore Unwind Connect
            </Button>
          </div>

          <div className="ofa-connect-symbol">
            <Blocks size={65} strokeWidth={1.1} />
            <span>UNWIND CONNECT</span>
          </div>
        </div>
      </section>

      <section className="ofa-closing-section">
        <div className="ofa-eyebrow">
          THE NEXT CHAPTER OF UNWIND
        </div>

        <h2>
          One for all.
          <br />
          <span>One for auth.</span>
        </h2>

        <p>
          A connected digital experience starts with a secure foundation.
        </p>

        <Button href="/signup" icon>
          Get started
        </Button>
      </section>
    </div>
  );
}

export default HomePage;