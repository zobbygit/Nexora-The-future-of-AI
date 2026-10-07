import { Component, StrictMode, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { API_URL } from '@/lib/env';
import './index.css';

class Boundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(e: Error, i: ErrorInfo) { console.error(e, i.componentStack); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
        <div><h1 style={{ fontSize: 28, fontWeight: 800 }}>Something went wrong</h1><p style={{ opacity: 0.6, marginTop: 8 }}>An unexpected error occurred. Reloading usually fixes it.</p>
          <button onClick={() => location.reload()} style={{ marginTop: 20, padding: '10px 20px', borderRadius: 12, background: '#7c5cff', color: '#fff', fontWeight: 700 }}>Reload</button></div>
      </div>
    );
  }
}

// Render's free tier sleeps when idle. Poke /health immediately so the API is waking while the intro plays.
if (API_URL) void fetch(`${API_URL}/health`, { mode: 'no-cors', cache: 'no-store' }).catch(() => undefined);

createRoot(document.getElementById('root')!).render(<StrictMode><Boundary><App /></Boundary></StrictMode>);