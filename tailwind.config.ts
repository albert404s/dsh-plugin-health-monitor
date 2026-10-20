import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#080b10',
          900: '#0b1017',
          850: '#0e141d',
          800: '#111925',
          750: '#141d2b',
          700: '#1a2535',
          600: '#263449',
          500: '#3a4a63',
          400: '#64748b',
          300: '#93a3b8',
          200: '#c3ceda',
          100: '#e7edf4',
        },
        signal: {
          DEFAULT: '#8b7cf6',
          strong: '#a89cff',
          dim: '#5b4fc4',
        },
        mint: {
          DEFAULT: '#48d7b0',
          dim: '#1f8d73',
        },
        amber: {
          DEFAULT: '#f4b75c',
          dim: '#a66b19',
        },
        rose: {
          DEFAULT: '#ef7c8e',
          dim: '#a13e50',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'PingFang SC',
          'Hiragino Sans GB',
          'Microsoft YaHei',
          'Noto Sans SC',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Cascadia Code', 'Consolas', 'Liberation Mono', 'monospace'],
      },
      maxWidth: {
        shell: '1480px',
      },
      letterSpacing: {
        tightest: '-0.045em',
      },
      keyframes: {
        enter: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-500px 0' },
          '100%': { backgroundPosition: '500px 0' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '0.45' },
          '50%': { opacity: '1' },
        },
      },
      animation: {
        enter: 'enter 320ms ease-out both',
        shimmer: 'shimmer 1.6s linear infinite',
        pulseSoft: 'pulseSoft 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
