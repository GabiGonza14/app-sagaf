import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#f6f8fc',
        ink: '#172033',
        muted: '#667085',
        line: '#e4e9f2',
        primary: {
          DEFAULT: '#145c9e',
          dark: '#0f3e69',
          soft: '#e8f3ff',
        },
        teal: {
          DEFAULT: '#0f766e',
          soft: '#e7f8f5',
        },
        green: {
          DEFAULT: '#15803d',
          soft: '#e9f9ef',
        },
        amber: {
          DEFAULT: '#b7791f',
          soft: '#fff4db',
        },
        red: {
          DEFAULT: '#b42318',
          soft: '#ffe9e7',
        },
        purple: {
          DEFAULT: '#6941c6',
          soft: '#f1ebff',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        card: '22px',
        field: '14px',
        chip: '999px',
      },
      boxShadow: {
        soft: '0 16px 42px rgba(21, 40, 72, 0.08)',
        modal: '0 30px 80px rgba(15,23,42,.25)',
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.4s ease',
        'shimmer': 'shimmer 2s ease infinite',
        'glow-pulse': 'glowPulse 3s infinite',
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(20, 92, 158, 0)' },
          '50%': { boxShadow: '0 0 0 6px rgba(20, 92, 158, 0.10)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
