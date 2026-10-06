import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

jest.mock('../src/lib/api', () => ({ api: { post: jest.fn(), get: jest.fn(), patch: jest.fn(), delete: jest.fn() }, fileUrl: (u: string) => u }));
jest.mock('../src/lib/socket', () => ({ getSocket: () => ({ on: jest.fn(), off: jest.fn(), emit: jest.fn() }), closeSocket: jest.fn() }));

import { api } from '../src/lib/api';
import { Intro, INTRO_KEY } from '../src/components/brand/Intro';
import { RequireAdmin, RequireUser, PublicOnly } from '../src/App';
import Onboarding from '../src/pages/auth/Onboarding';
import { ForgotPassword, Login, RecoveryCodeCard, Register } from '../src/pages/auth/AuthPages';
import { useAuth } from '../src/store/auth';

const post = api.post as jest.Mock;
const baseUser = { id: 'u1', name: 'Zed Test', email: 'z@t.dev', phone: '', avatarUrl: '', plan: 'free', isActive: true, credits: 20, onboardingCompleted: true, onboarding: { useCases: [], building: [], goals: [] }, createdAt: '' };
const at = (path: string, ui: React.ReactNode, extra?: React.ReactNode) => render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/login" element={<div>LOGIN PAGE</div>} /><Route path="/onboarding" element={<div>ONBOARDING PAGE</div>} /><Route path="/app" element={<div>APP HOME</div>} /><Route path="/admin/login" element={<div>ADMIN LOGIN</div>} /><Route path="*" element={ui} />{extra}</Routes></MemoryRouter>);
beforeEach(() => { jest.clearAllMocks(); useAuth.setState({ user: null, admin: null, ready: true, adminReady: true }); });

describe('route guards', () => {
  it('sends anonymous visitors to login', () => { at('/app/x', <RequireUser><div>SECRET</div></RequireUser>); expect(screen.getByText('LOGIN PAGE')).toBeInTheDocument(); });
  it('sends users who have not onboarded to onboarding', () => { useAuth.setState({ user: { ...baseUser, onboardingCompleted: false } as any }); at('/app/x', <RequireUser><div>SECRET</div></RequireUser>); expect(screen.getByText('ONBOARDING PAGE')).toBeInTheDocument(); });
  it('REGRESSION: a refresh with a profile that lacks the flag does not bounce the user to onboarding', () => { const { onboardingCompleted: _o, ...partial } = baseUser as any; useAuth.setState({ user: partial }); at('/app/x', <RequireUser><div>SECRET</div></RequireUser>); expect(screen.getByText('SECRET')).toBeInTheDocument(); });
  it('lets onboarded users in', () => { useAuth.setState({ user: baseUser as any }); at('/app/x', <RequireUser><div>SECRET</div></RequireUser>); expect(screen.getByText('SECRET')).toBeInTheDocument(); });
  it('keeps signed-in users off the login page', () => { useAuth.setState({ user: baseUser as any }); at('/login-x', <PublicOnly><div>FORM</div></PublicOnly>); expect(screen.getByText('APP HOME')).toBeInTheDocument(); });
  it('protects admin routes', () => { at('/admin/x', <RequireAdmin><div>ADMIN SECRET</div></RequireAdmin>); expect(screen.getByText('ADMIN LOGIN')).toBeInTheDocument(); useAuth.setState({ admin: { email: 'a', name: 'A' } }); });
  it('does not treat a user session as admin', () => { useAuth.setState({ user: baseUser as any }); at('/admin/x', <RequireAdmin><div>ADMIN SECRET</div></RequireAdmin>); expect(screen.queryByText('ADMIN SECRET')).not.toBeInTheDocument(); });
});

describe('login form', () => {
  it('validates before calling the API', async () => {
    at('/x', <Login />);
    await userEvent.click(screen.getByRole('button', { name: /Sign in/ }));
    expect(await screen.findByText('Enter a valid email')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });
  it('signs in and routes to the app', async () => {
    post.mockResolvedValueOnce({ data: { user: baseUser } });
    at('/x', <Login />);
    await userEvent.type(screen.getByLabelText('Email'), 'z@t.dev');
    await userEvent.type(screen.getByLabelText('Password'), 'Password1');
    await userEvent.click(screen.getByRole('button', { name: /Sign in/ }));
    await waitFor(() => expect(screen.getByText('APP HOME')).toBeInTheDocument());
    expect(post).toHaveBeenCalledWith('/auth/login', { email: 'z@t.dev', password: 'Password1' });
  });
  it('shows server errors', async () => {
    post.mockRejectedValueOnce({ response: { data: { error: { message: 'Email or password is incorrect.' } } } });
    at('/x', <Login />);
    await userEvent.type(screen.getByLabelText('Email'), 'z@t.dev');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: /Sign in/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('incorrect');
  });
  it('toggles password visibility', async () => {
    at('/x', <Login />);
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');
  });
});

describe('registration & recovery code', () => {
  it('shows the recovery code once and gates continue behind confirmation', async () => {
    post.mockResolvedValueOnce({ data: { user: { ...baseUser, onboardingCompleted: false }, recoveryCode: 'ABCD-EFGH-JKLM-NPQR' } });
    at('/x', <Register />);
    await userEvent.type(screen.getByLabelText('Full name'), 'Zed Test');
    await userEvent.type(screen.getByLabelText('Email'), 'z@t.dev');
    await userEvent.type(screen.getByPlaceholderText('Create a password'), 'Password1');
    await userEvent.click(screen.getByRole('button', { name: /Create account/ }));
    expect(await screen.findByTestId('recovery-code')).toHaveTextContent('ABCD-EFGH-JKLM-NPQR');
    const cont = screen.getByRole('button', { name: /Continue/ });
    expect(cont).toBeDisabled();
    await userEvent.click(screen.getByRole('checkbox'));
    expect(cont).toBeEnabled();
    await userEvent.click(cont);
    await waitFor(() => expect(screen.getByText('ONBOARDING PAGE')).toBeInTheDocument());
  });
  it('rejects weak passwords', async () => {
    at('/x', <Register />);
    await userEvent.type(screen.getByLabelText('Full name'), 'Zed Test');
    await userEvent.type(screen.getByLabelText('Email'), 'z@t.dev');
    await userEvent.type(screen.getByPlaceholderText('Create a password'), 'short');
    await userEvent.click(screen.getByRole('button', { name: /Create account/ }));
    expect(await screen.findByText(/at least 8 characters/i, { selector: 'span' })).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });
  it('RecoveryCodeCard calls onContinue only after confirmation', async () => {
    const onContinue = jest.fn(); let saved = false;
    const { rerender } = render(<MemoryRouter><RecoveryCodeCard code="AAAA-BBBB-CCCC-DDDD" saved={saved} setSaved={(v) => { saved = v; }} onContinue={onContinue} cta="Go" /></MemoryRouter>);
    expect(screen.getByRole('button', { name: /Go/ })).toBeDisabled();
    rerender(<MemoryRouter><RecoveryCodeCard code="AAAA-BBBB-CCCC-DDDD" saved onContinue={onContinue} setSaved={() => undefined} cta="Go" /></MemoryRouter>);
    await userEvent.click(screen.getByRole('button', { name: /Go/ }));
    expect(onContinue).toHaveBeenCalled();
  });
  it('forgot-password verifies the code then moves on', async () => {
    post.mockResolvedValueOnce({ data: { resetToken: 'tok' } });
    at('/x', <ForgotPassword />, <Route path="/reset-password" element={<div>RESET PAGE</div>} />);
    await userEvent.type(screen.getByLabelText('Email'), 'z@t.dev');
    await userEvent.type(screen.getByLabelText('Recovery code'), 'ABCD-EFGH-JKLM-NPQR');
    await userEvent.click(screen.getByRole('button', { name: /Verify code/ }));
    await waitFor(() => expect(screen.getByText('RESET PAGE')).toBeInTheDocument());
  });
});

describe('onboarding', () => {
  it('walks three steps, personalises the summary, and saves', async () => {
    useAuth.setState({ user: { ...baseUser, onboardingCompleted: false } as any });
    post.mockResolvedValueOnce({ data: { user: baseUser } });
    at('/onboarding-x', <Onboarding />);
    const next = () => screen.getByRole('button', { name: /Continue|Finish setup/ });
    expect(screen.getByRole('heading', { name: /What do you want to use Nexora for/ })).toBeInTheDocument();
    expect(next()).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Writing' }));
    await userEvent.click(screen.getByRole('button', { name: 'Coding' }));
    expect(screen.getByRole('button', { name: 'Writing' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(next());
    expect(await screen.findByRole('heading', { name: /What are you building/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Projects' }));
    await userEvent.click(next());
    expect(await screen.findByRole('heading', { name: /do more/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Create faster' }));
    await userEvent.click(next());
    expect(await screen.findByRole('heading', { name: /Your workspace is ready/ })).toBeInTheDocument();
    expect(screen.getByText(/writing and coding/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Enter Nexora/ }));
    await waitFor(() => expect(screen.getByText('APP HOME')).toBeInTheDocument());
    expect(post).toHaveBeenCalledWith('/onboarding', { useCases: ['Writing', 'Coding'], building: ['Projects'], goals: ['Create faster'] });
  });
  it('can go back and keeps selections', async () => {
    useAuth.setState({ user: { ...baseUser, onboardingCompleted: false } as any });
    at('/onboarding-x', <Onboarding />);
    await userEvent.click(screen.getByRole('button', { name: 'Research' }));
    await userEvent.click(screen.getByRole('button', { name: /Continue/ }));
    await screen.findByRole('heading', { name: /What are you building/ });
    await userEvent.click(screen.getByRole('button', { name: /Back/ }));
    await screen.findByRole('heading', { name: /What do you want to use Nexora for/ });
    expect(screen.getByRole('button', { name: 'Research' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('cinematic intro', () => {
  beforeEach(() => { jest.useFakeTimers(); localStorage.clear(); });
  afterEach(() => { jest.useRealTimers(); document.documentElement.style.overflow = ''; });
  it('locks scroll, offers skip after a moment, then completes and remembers', async () => {
    const onDone = jest.fn();
    render(<Intro onDone={onDone} />);
    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(screen.getByRole('status', { name: /Loading Nexora/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Skip intro' })).not.toBeInTheDocument();
    await act(async () => { jest.advanceTimersByTime(1300); });
    const skip = await screen.findByRole('button', { name: 'Skip intro' });
    await act(async () => { skip.click(); });
    await act(async () => { jest.advanceTimersByTime(2000); });
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(INTRO_KEY)).toBe('1');
    expect(document.documentElement.style.overflow).toBe('');
  });
});