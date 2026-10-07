import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, lazy, useCallback, useEffect, useState, type ReactNode } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Intro, INTRO_KEY } from '@/components/brand/Intro';
import { Spinner, Toaster } from '@/components/ui/primitives';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/store/auth';
import { toast } from '@/store/ui';
import { ArrowLeft, HomeIcon } from 'lucide-react';
import { closeSocket } from '@/lib/socket';

const Landing = lazy(() => import('@/pages/public/Landing'));
const AppShell = lazy(() => import('@/components/layout/AppShell'));
const AdminShell = lazy(() => import('@/pages/admin/AdminShell'));
const Onboarding = lazy(() => import('@/pages/auth/Onboarding'));
const L = (p: Promise<Record<string, any>>, k: string) => p.then((m) => ({ default: m[k] }));
const Login = lazy(() => L(import('@/pages/auth/AuthPages'), 'Login'));
const Register = lazy(() => L(import('@/pages/auth/AuthPages'), 'Register'));
const ForgotPassword = lazy(() => L(import('@/pages/auth/AuthPages'), 'ForgotPassword'));
const ResetPassword = lazy(() => L(import('@/pages/auth/AuthPages'), 'ResetPassword'));
const AdminLogin = lazy(() => L(import('@/pages/auth/AuthPages'), 'AdminLogin'));
const Dashboard = lazy(() => import('@/pages/app/Dashboard'));
const ToolsGrid = lazy(() => import('@/pages/app/ToolsGrid'));
const Workspace = lazy(() => import('@/pages/app/Workspace'));
const Collaboration = lazy(() => import('@/pages/app/Collaboration'));
const History = lazy(() => import('@/pages/app/History'));
const Billing = lazy(() => import('@/pages/app/Billing'));
const Support = lazy(() => import('@/pages/app/Support'));
const Notifications = lazy(() => import('@/pages/app/Notifications'));
const Profile = lazy(() => import('@/pages/app/Profile'));
const Writer = lazy(() => L(import('@/pages/tools/TextTools'), 'Writer'));
const Resume = lazy(() => L(import('@/pages/tools/TextTools'), 'Resume'));
const CodeAssistant = lazy(() => L(import('@/pages/tools/TextTools'), 'CodeAssistant'));
const Agent = lazy(() => L(import('@/pages/tools/TextTools'), 'Agent'));
const TextToSpeech = lazy(() => L(import('@/pages/tools/MediaTools'), 'TextToSpeech'));
const SpeechToText = lazy(() => L(import('@/pages/tools/MediaTools'), 'SpeechToText'));
const VideoToText = lazy(() => L(import('@/pages/tools/MediaTools'), 'VideoToText'));
const ImageToText = lazy(() => L(import('@/pages/tools/MediaTools'), 'ImageToText'));
const BackgroundRemover = lazy(() => L(import('@/pages/tools/MediaTools'), 'BackgroundRemover'));
const ImageEnhancer = lazy(() => L(import('@/pages/tools/MediaTools'), 'ImageEnhancer'));
const TextToImage = lazy(() => L(import('@/pages/tools/MediaTools'), 'TextToImage'));
const PdfAI = lazy(() => L(import('@/pages/tools/DocTools'), 'PdfAI'));
const DataAnalyzer = lazy(() => L(import('@/pages/tools/DocTools'), 'DataAnalyzer'));
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'));
const AdminUsers = lazy(() => L(import('@/pages/admin/AdminUsers'), 'AdminUsers'));
const AdminUserDetail = lazy(() => L(import('@/pages/admin/AdminUsers'), 'AdminUserDetail'));
const AdminAI = lazy(() => import('@/pages/admin/AdminAI'));
const AdminBilling = lazy(() => import('@/pages/admin/AdminBilling'));
const AdminSupport = lazy(() => import('@/pages/admin/AdminSupport'));
const AdminComm = lazy(() => L(import('@/pages/admin/AdminMisc'), 'AdminComm'));
const AdminAnalytics = lazy(() => L(import('@/pages/admin/AdminMisc'), 'AdminAnalytics'));
const AdminSystem = lazy(() => L(import('@/pages/admin/AdminMisc'), 'AdminSystem'));

const qc = new QueryClient({ defaultOptions: { queries: { retry: (n, e: any) => n < 1 && !(e?.response?.status >= 400 && e?.response?.status < 500), refetchOnWindowFocus: false, staleTime: 15_000 } } });

const Fallback = () => <div className="grid min-h-[50vh] place-items-center" role="status" aria-label="Loading"><Spinner className="h-7 w-7" /></div>;

const FullLoader = () => <div className="grid min-h-screen place-items-center"><Spinner className="h-8 w-8" /></div>;

export const RequireUser = ({ children, allowIncomplete }: { children: ReactNode; allowIncomplete?: boolean }) => {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <FullLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  // Strict comparison: only an explicit `false` means "not onboarded" — a missing field must never bounce a user.
  if (!allowIncomplete && user.onboardingCompleted === false) return <Navigate to="/onboarding" replace />;
  if (allowIncomplete && user.onboardingCompleted !== false) return <Navigate to="/app" replace />;
  return <>{children}</>;
};
export const PublicOnly = ({ children }: { children: ReactNode }) => {
  const { user, ready } = useAuth();
  if (!ready) return <FullLoader />;
  if (user) return <Navigate to={user.onboardingCompleted === false ? '/onboarding' : '/app'} replace />;
  return <>{children}</>;
};
export const RequireAdmin = ({ children }: { children: ReactNode }) => {
  const { admin, adminReady } = useAuth();
  if (!adminReady) return <FullLoader />;
  if (!admin) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
};

const NotFound = () => (
  <div className="grid min-h-screen place-items-center px-6 py-10 text-center">
    <div className="relative w-full max-w-md">
      {/* Glow behind the 404 */}
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-4 h-32 w-32 -translate-x-1/2 rounded-full bg-violet-500/25 blur-3xl" />

      <div className="glass-strong relative rounded-3xl border border-white/[0.08] p-8 shadow-[0_25px_80px_-20px_rgba(0,0,0,0.85)] sm:p-10">
        <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.22em] text-violet-300/80">
          Error · 404
        </p>

        <p className="bg-gradient-to-b from-white via-white/90 to-white/40 bg-clip-text text-7xl font-black leading-none tracking-tighter text-transparent sm:text-8xl">
          404
        </p>

        <h1 className="mt-3 bg-gradient-to-b from-white to-white/70 bg-clip-text text-2xl font-extrabold tracking-tight text-transparent">
          This page does not exist
        </h1>

        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-fg-mute">
          The link may be broken, or the page may have moved. Let's get you back on track.
        </p>

        <div className="mt-6 flex flex-col justify-center gap-2.5 sm:flex-row">
          <Button asChild size="lg" className="shadow-[0_10px_30px_-10px_rgba(124,92,255,0.85)]">
            <Link to="/">
              <HomeIcon className="h-4 w-4" />
              Back to Nexora
            </Link>
          </Button>
          <Button variant="secondary" size="lg" onClick={() => history.back()}>
            <ArrowLeft className="h-4 w-4" />
            Go back
          </Button>
        </div>
      </div>

      <p className="mt-5 text-xs text-fg-faint">
        Lost? Try the{' '}
        <Link to="/app" className="font-semibold text-violet-300 underline-offset-4 hover:underline">
          dashboard
        </Link>{' '}
        or contact{' '}
        <Link to="/app/support" className="font-semibold text-violet-300 underline-offset-4 hover:underline">
          support
        </Link>
        .
      </p>
    </div>
  </div>
);

const Home = () => {
  const [intro, setIntro] = useState(() => { try { return !localStorage.getItem(INTRO_KEY); } catch { return false; } });
  const done = useCallback(() => setIntro(false), []);
  return <><Landing />{intro && <Intro onDone={done} />}</>;
};

const Boot = ({ children }: { children: ReactNode }) => {
  const { setUser, setAdmin } = useAuth();
  useEffect(() => {
    const expired = () => {
      if (window.location.pathname.startsWith('/admin')) { closeSocket('admin'); setAdmin(null); return; }
      closeSocket('user'); setUser(null); qc.clear(); toast.info('Session ended', 'Please sign in again.');
    };
    window.addEventListener('nexora:session-expired', expired);
    return () => window.removeEventListener('nexora:session-expired', expired);
  }, [setUser, setAdmin]);
  return <>{children}</>;
};

/** The shells need to know which auth context to load when jumping between /app and /admin. */
const AuthSync = () => {
  const loc = useLocation();
  const { user, ready, admin, adminReady, loadUser, loadAdmin } = useAuth();
  useEffect(() => {
    if (loc.pathname.startsWith('/admin') && !adminReady && !admin) void loadAdmin();
    if (!loc.pathname.startsWith('/admin') && !ready && !user) void loadUser();
  }, [loc.pathname, adminReady, admin, ready, user, loadAdmin, loadUser]);
  return null;
};

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Boot>
          <AuthSync />
          <Suspense fallback={<FullLoader />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
              <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
              <Route path="/forgot-password" element={<PublicOnly><ForgotPassword /></PublicOnly>} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/onboarding" element={<RequireUser allowIncomplete><Onboarding /></RequireUser>} />

              <Route path="/app" element={<RequireUser><AppShell /></RequireUser>}>
                <Route index element={<Suspense fallback={<Fallback />}><Dashboard /></Suspense>} />
                <Route path="tools" element={<Suspense fallback={<Fallback />}><ToolsGrid /></Suspense>} />
                {[['writer', Writer], ['resume', Resume], ['code', CodeAssistant], ['agent', Agent], ['text-to-speech', TextToSpeech], ['speech-to-text', SpeechToText], ['video-to-text', VideoToText], ['image-to-text', ImageToText], ['background-remover', BackgroundRemover], ['image-enhancer', ImageEnhancer], ['text-to-image', TextToImage], ['pdf', PdfAI], ['data-analyzer', DataAnalyzer]].map(([p, C]) => {
                  const Comp = C as React.ComponentType; return <Route key={p as string} path={`tools/${p}`} element={<Suspense fallback={<Fallback />}><Comp /></Suspense>} />;
                })}
                <Route path="workspace" element={<Suspense fallback={<Fallback />}><Workspace /></Suspense>} />
                <Route path="collaboration" element={<Suspense fallback={<Fallback />}><Collaboration /></Suspense>} />
                <Route path="history" element={<Suspense fallback={<Fallback />}><History /></Suspense>} />
                <Route path="billing" element={<Suspense fallback={<Fallback />}><Billing /></Suspense>} />
                <Route path="support" element={<Suspense fallback={<Fallback />}><Support /></Suspense>} />
                <Route path="notifications" element={<Suspense fallback={<Fallback />}><Notifications /></Suspense>} />
                <Route path="profile" element={<Suspense fallback={<Fallback />}><Profile /></Suspense>} />
                <Route path="*" element={<Navigate to="/app" replace />} />
              </Route>

              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin" element={<RequireAdmin><AdminShell /></RequireAdmin>}>
                {[['', AdminDashboard], ['users', AdminUsers], ['users/:id', AdminUserDetail], ['ai', AdminAI], ['billing', AdminBilling], ['support', AdminSupport], ['communication', AdminComm], ['analytics', AdminAnalytics], ['system', AdminSystem]].map(([p, C]) => {
                  const Comp = C as React.ComponentType; return p === '' ? <Route key="idx" index element={<Suspense fallback={<Fallback />}><Comp /></Suspense>} /> : <Route key={p as string} path={p as string} element={<Suspense fallback={<Fallback />}><Comp /></Suspense>} />;
                })}
                <Route path="*" element={<Navigate to="/admin" replace />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          <Toaster />
        </Boot>
      </BrowserRouter>
    </QueryClientProvider>
  );
}