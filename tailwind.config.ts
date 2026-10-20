import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'rgb(var(--canvas) / <alpha-value>)',
        surface: {
          DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
          subtle: 'rgb(var(--surface-subtle) / <alpha-value>)',
          sunken: 'rgb(var(--surface-sunken) / <alpha-value>)',
        },
        line: {
          DEFAULT: 'rgb(var(--line) / <alpha-value>)',
          hairline: 'rgb(var(--line-hairline) / <alpha-value>)',
          strong: 'rgb(var(--line-strong) / <alpha-value>)',
        },
        content: {
          DEFAULT: 'rgb(var(--fg-body) / <alpha-value>)',
          primary: 'rgb(var(--fg-primary) / <alpha-value>)',
          secondary: 'rgb(var(--fg-secondary) / <alpha-value>)',
          muted: 'rgb(var(--fg-tertiary) / <alpha-value>)',
          disabled: 'rgb(var(--fg-disabled) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          hover: 'rgb(var(--accent-hover) / <alpha-value>)',
          active: 'rgb(var(--accent-active) / <alpha-value>)',
          soft: 'rgb(var(--accent-soft) / <alpha-value>)',
          line: 'rgb(var(--accent-line) / <alpha-value>)',
        },
        teal: {
          DEFAULT: 'rgb(var(--teal) / <alpha-value>)',
          bright: 'rgb(var(--teal-bright) / <alpha-value>)',
          soft: 'rgb(var(--teal-soft) / <alpha-value>)',
        },
        success: {
          DEFAULT: 'rgb(var(--success) / <alpha-value>)',
          soft: 'rgb(var(--success-soft) / <alpha-value>)',
          line: 'rgb(var(--success-line) / <alpha-value>)',
        },
        warning: {
          DEFAULT: 'rgb(var(--warning) / <alpha-value>)',
          soft: 'rgb(var(--warning-soft) / <alpha-value>)',
          line: 'rgb(var(--warning-line) / <alpha-value>)',
        },
        danger: {
          DEFAULT: 'rgb(var(--danger) / <alpha-value>)',
          soft: 'rgb(var(--danger-soft) / <alpha-value>)',
          line: 'rgb(var(--danger-line) / <alpha-value>)',
        },
        series: {
          popularity: 'rgb(var(--accent) / <alpha-value>)',
          maintenance: 'rgb(var(--teal) / <alpha-value>)',
          neutral: 'rgb(var(--fg-tertiary) / <alpha-value>)',
        },
        // Compatibility aliases while the old class names are phased out.
        // They intentionally invert the old dark palette into light surfaces.
        ink: {
          950: 'rgb(var(--canvas) / <alpha-value>)',
          900: 'rgb(var(--surface) / <alpha-value>)',
          850: 'rgb(var(--surface) / <alpha-value>)',
          800: 'rgb(var(--surface-subtle) / <alpha-value>)',
          750: 'rgb(var(--surface-sunken) / <alpha-value>)',
          700: 'rgb(var(--line) / <alpha-value>)',
          600: 'rgb(var(--line-strong) / <alpha-value>)',
          500: 'rgb(var(--fg-tertiary) / <alpha-value>)',
          400: 'rgb(var(--fg-secondary) / <alpha-value>)',
          300: 'rgb(var(--fg-body) / <alpha-value>)',
          200: 'rgb(var(--fg-primary) / <alpha-value>)',
          100: 'rgb(var(--fg-primary) / <alpha-value>)',
        },
        signal: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          strong: 'rgb(var(--accent-hover) / <alpha-value>)',
          dim: 'rgb(var(--accent-active) / <alpha-value>)',
        },
        mint: {
          DEFAULT: 'rgb(var(--teal) / <alpha-value>)',
          dim: 'rgb(var(--teal) / <alpha-value>)',
        },
        amber: {
          DEFAULT: 'rgb(var(--warning) / <alpha-value>)',
          dim: 'rgb(var(--warning) / <alpha-value>)',
        },
        rose: {
          DEFAULT: 'rgb(var(--danger) / <alpha-value>)',
          dim: 'rgb(var(--danger) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Microsoft YaHei',
          'PingFang SC',
          'Noto Sans SC',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Cascadia Code', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.75rem', { lineHeight: '1rem' }],
        xs: ['0.8125rem', { lineHeight: '1.25rem' }],
        sm: ['0.875rem', { lineHeight: '1.375rem' }],
        base: ['0.9375rem', { lineHeight: '1.5rem' }],
        lg: ['1rem', { lineHeight: '1.625rem' }],
        xl: ['1.125rem', { lineHeight: '1.625rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.75rem', { lineHeight: '2.125rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.625rem' }],
        '5xl': ['3rem', { lineHeight: '3.5rem' }],
        display: ['3.5rem', { lineHeight: '3.75rem', letterSpacing: '-0.02em' }],
      },
      maxWidth: {
        shell: '1400px',
        prose: '760px',
      },
      borderRadius: {
        chip: '4px',
        control: '6px',
        panel: '8px',
      },
      boxShadow: {
        panel: '0 1px 2px rgba(15, 23, 42, 0.04)',
        pop: '0 12px 32px -8px rgba(15, 23, 42, 0.14)',
      },
      letterSpacing: {
        display: '-0.02em',
        tightest: '-0.02em',
        label: '0.04em',
      },
      keyframes: {
        enter: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        enter: 'enter 120ms ease-out both',
      },
    },
  },
  plugins: [],
} satisfies Config;
