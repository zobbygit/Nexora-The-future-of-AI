import { fontFamily } from 'tailwindcss/defaultTheme';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#05060d', 900: '#070911', 800: '#0a0c16', 700: '#0e1120', 600: '#131728', 500: '#1a1f36' },
        line: 'rgba(255,255,255,0.07)',
        violet: { 300: '#c4b5fd', 400: '#a78bfa', 500: '#8b5cf6', 600: '#7c5cff', 700: '#6d47f0' },
        iris: '#6366f1',
        sky2: '#4f8bff',
        cyan2: '#22d3ee',
        fg: { DEFAULT: '#f4f5fb', soft: '#c3c6d8', mute: '#8b90a8', faint: '#5d627a' },
        ok: '#34d399', warn: '#fbbf24', bad: '#f87171',
      },
      fontFamily: { sans: ['"Manrope Variable"', ...fontFamily.sans], mono: ['"JetBrains Mono Variable"', ...fontFamily.mono] },
      borderRadius: { '2xl': '1.25rem', '3xl': '1.75rem', '4xl': '2.25rem' },
      boxShadow: {
        card: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 24px 48px -28px rgba(0,0,0,0.8)',
        glow: '0 0 0 1px rgba(139,92,246,0.35), 0 12px 40px -12px rgba(124,92,255,0.55)',
      },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        floaty: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        drift: { '0%': { transform: 'translate3d(-4%,0,0)' }, '100%': { transform: 'translate3d(4%,-3%,0)' } },
      },
      animation: { shimmer: 'shimmer 1.6s infinite', floaty: 'floaty 7s ease-in-out infinite', drift: 'drift 14s ease-in-out infinite alternate' },
    },
  },
  plugins: [],
};
