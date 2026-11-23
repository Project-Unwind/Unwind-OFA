import { useAuth } from '../context/AuthContext';
import { ShieldCheck, LockKeyhole, Fingerprint, LogOut } from 'lucide-react';
import './DashboardPage.css';

function DashboardPage() {
  const { user, signOut } = useAuth();

  async function handleSignOut() {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out failed:', error.message);
    }
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <span className="dashboard-eyebrow">UNWIND OFA</span>
          <h1>Your security hub.</h1>
          <p>One identity. One secure ecosystem.</p>
        </div>

        <button
          className="dashboard-signout"
          onClick={handleSignOut}
        >
          <LogOut size={17} />
          Sign out
        </button>
      </header>

      <section className="dashboard-welcome">
        <div className="dashboard-welcome-icon">
          <ShieldCheck size={28} />
        </div>

        <div>
          <span>YOUR ACCOUNT</span>
          <h2>Welcome to Unwind OFA</h2>
          <p>{user?.email || 'Authenticated user'}</p>
        </div>
      </section>

      <section className="dashboard-section">
        <div className="dashboard-section-heading">
          <span>YOUR SECURITY</span>
          <h2>Everything in one place.</h2>
        </div>

        <div className="dashboard-grid">
          <article className="dashboard-card">
            <div className="dashboard-card-icon">
              <Fingerprint size={23} />
            </div>
            <h3>Unwind Identity</h3>
            <p>
              Your central identity for accessing the Unwind ecosystem.
            </p>
            <span className="dashboard-status">Identity foundation</span>
          </article>

          <article className="dashboard-card">
            <div className="dashboard-card-icon">
              <LockKeyhole size={23} />
            </div>
            <h3>Unwind Vault</h3>
            <p>
              Your future zero-knowledge encrypted password vault.
            </p>
            <span className="dashboard-status">Coming soon</span>
          </article>

          <article className="dashboard-card">
            <div className="dashboard-card-icon">
              <ShieldCheck size={23} />
            </div>
            <h3>Unwind Connect</h3>
            <p>
              A unified sign-in experience across Unwind products.
            </p>
            <span className="dashboard-status">Coming soon</span>
          </article>
        </div>
      </section>
    </div>
  );
}

export default DashboardPage;