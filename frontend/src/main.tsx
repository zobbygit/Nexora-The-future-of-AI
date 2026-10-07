import { Component, StrictMode, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { API_URL } from '@/lib/env';
import './index.css';

/* -------------------------------------------------------------------------- */
/*  Error fallback — fully self-contained, inline-styled, dependency-free.    */
/*  Renders even if Tailwind, fonts, or the CSS bundle fail to load.          */
/* -------------------------------------------------------------------------- */

function ErrorFallback({
  error,
  onReset,
}: {
  error: Error | null;
  onReset: () => void;
}) {
  const isDev = import.meta.env?.DEV ?? false;

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        textAlign: 'center',
        background: '#0a0a0f',
        color: '#fff',
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* Aurora glow backdrop */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(60% 50% at 50% 20%, rgba(124,92,255,0.22), transparent 70%),' +
            'radial-gradient(40% 40% at 80% 80%, rgba(244,63,94,0.16), transparent 70%),' +
            'radial-gradient(50% 50% at 15% 70%, rgba(56,189,248,0.10), transparent 70%)',
        }}
      />
      {/* Vignette */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(circle at 50% 40%, transparent 0%, rgba(0,0,0,0.75) 80%)',
        }}
      />

      <div style={{ position: 'relative', width: '100%', maxWidth: 440 }}>
        {/* Glowing icon orb */}
        <div
          style={{
            position: 'relative',
            width: 96,
            height: 96,
            margin: '0 auto 32px',
          }}
        >
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: -8,
              borderRadius: 999,
              background: 'rgba(244,63,94,0.35)',
              filter: 'blur(28px)',
            }}
          />
          <div
            style={{
              position: 'relative',
              width: 96,
              height: 96,
              display: 'grid',
              placeItems: 'center',
              borderRadius: 24,
              border: '1px solid rgba(255,255,255,0.08)',
              background:
                'linear-gradient(135deg, rgba(244,63,94,0.20), rgba(124,92,255,0.10))',
              boxShadow:
                '0 0 60px -10px rgba(244,63,94,0.55), inset 0 1px 0 rgba(255,255,255,0.06)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
          >
            {/* Inline SVG triangle-warning */}
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fda4af"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
        </div>

        {/* Card */}
        <div
          style={{
            borderRadius: 24,
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(20,20,28,0.72)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            padding: 32,
            boxShadow:
              '0 25px 80px -20px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.04)',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              margin: '0 0 8px',
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'rgba(252,165,165,0.85)',
            }}
          >
            Error · 500
          </p>

          <h1
            style={{
              margin: 0,
              fontSize: 'clamp(26px, 5vw, 34px)',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              lineHeight: 1.15,
              background:
                'linear-gradient(180deg, #ffffff 0%, rgba(255,255,255,0.72) 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            Something went wrong
          </h1>

          <p
            style={{
              margin: '12px auto 0',
              maxWidth: 340,
              fontSize: 14,
              lineHeight: 1.6,
              color: 'rgba(255,255,255,0.6)',
            }}
          >
            An unexpected error occurred while loading this page. Reloading
            usually fixes it — your work is safe.
          </p>

          {isDev && error?.message && (
            <pre
              style={{
                marginTop: 20,
                maxHeight: 128,
                overflow: 'auto',
                textAlign: 'left',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.06)',
                background: 'rgba(0,0,0,0.45)',
                padding: 12,
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                fontSize: 11,
                lineHeight: 1.6,
                color: 'rgba(254,205,211,0.85)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {error.message}
            </pre>
          )}

          {/* Actions */}
          <div
            style={{
              marginTop: 28,
              display: 'flex',
              gap: 12,
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              onClick={onReset}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                height: 48,
                padding: '0 24px',
                borderRadius: 12,
                border: 'none',
                cursor: 'pointer',
                color: '#fff',
                fontWeight: 700,
                fontSize: 14,
                background:
                  'linear-gradient(180deg, #8b6cff 0%, #7c5cff 100%)',
                boxShadow:
                  '0 10px 30px -10px rgba(124,92,255,0.85), inset 0 1px 0 rgba(255,255,255,0.18)',
                transition: 'transform 0.15s ease, filter 0.15s ease',
              }}
              onMouseDown={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform =
                  'scale(0.98)';
              }}
              onMouseUp={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform =
                  'scale(1)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform =
                  'scale(1)';
              }}
            >
              {/* Rotate icon */}
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M21 12a9 9 0 1 1-3-6.7" />
                <polyline points="21 3 21 9 15 9" />
              </svg>
              Reload page
            </button>

            <a
              href="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                height: 48,
                padding: '0 24px',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.04)',
                color: 'rgba(255,255,255,0.8)',
                fontWeight: 700,
                fontSize: 14,
                textDecoration: 'none',
              }}
            >
              Go home
            </a>
          </div>
        </div>

        <p
          style={{
            marginTop: 24,
            fontSize: 12,
            color: 'rgba(255,255,255,0.35)',
          }}
        >
          If this keeps happening, contact{' '}
          <a
            href="/app/support"
            style={{
              color: '#c4b5fd',
              fontWeight: 600,
              textDecoration: 'underline',
              textUnderlineOffset: 3,
            }}
          >
            support
          </a>
          .
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Error boundary                                                            */
/* -------------------------------------------------------------------------- */

class Boundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log the error for observability. Swap for Sentry/Logtail/etc. if wired up.
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  reset = () => {
    // Simplest reliable recovery — a hard reload resets all module & runtime state.
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return <ErrorFallback error={this.state.error} onReset={this.reset} />;
  }
}

/* -------------------------------------------------------------------------- */
/*  Boot                                                                      */
/* -------------------------------------------------------------------------- */

// Render's free tier sleeps when idle. Poke /health immediately so the API is
// waking while the intro plays.
if (API_URL) {
  void fetch(`${API_URL}/health`, { mode: 'no-cors', cache: 'no-store' }).catch(
    () => undefined,
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Boundary>
      <App />
    </Boundary>
  </StrictMode>,
);