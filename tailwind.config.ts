import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: 'rgb(var(--canvas) / <alpha-value>)',
          deep: 'rgb(var(--canvas-deep) / <alpha-value>)',
        },
        surface: {
          DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
          subtle: 'rgb(var(--surface-subtle) / <alpha-value>)',
          sunken: 'rgb(var(--surface-sunken) / <alpha-value>)',
        },
        metal: {
          100: 'rgb(var(--metal-100) / <alpha-value>)',
          200: 'rgb(var(--metal-200) / <alpha-value>)',
          300: 'rgb(var(--metal-300) / <alpha-value>)',
        },
        line: {
          DEFAULT: 'rgb(var(--line) / <alpha-value>)',
          hairline: 'rgb(var(--line-hairline) / <alpha-value>)',
          strong: 'rgb(var(--line-strong) / <alpha-value>)',
          control: 'rgb(var(--line-control) / <alpha-value>)',
        },
        content: {
          DEFAULT: 'rgb(var(--fg-body) / <alpha-value>)',
          primary: 'rgb(var(--fg-primary) / <alpha-value>)',
          secondary: 'rgb(var(--fg-secondary) / <alpha-value>)',
          muted: 'rgb(var(--fg-tertiary) / <alpha-value>)',
          disabled: 'rgb(var(--fg-disabled) / <alpha-value>)',
          inverse: 'rgb(var(--fg-inverse) / <alpha-value>)',
        },
        brand: {
          DEFAULT: 'rgb(var(--brand) / <alpha-value>)',
          strong: 'rgb(var(--brand-strong) / <alpha-value>)',
          active: 'rgb(var(--brand-active) / <alpha-value>)',
          text: 'rgb(var(--brand-text) / <alpha-value>)',
          soft: 'rgb(var(--brand-soft) / <alpha-value>)',
          line: 'rgb(var(--brand-line) / <alpha-value>)',
        },
        risk: {
          high: {
            DEFAULT: 'rgb(var(--risk-high) / <alpha-value>)',
            soft: 'rgb(var(--risk-high-soft) / <alpha-value>)',
            line: 'rgb(var(--risk-high-line) / <alpha-value>)',
          },
          medium: {
            DEFAULT: 'rgb(var(--risk-medium) / <alpha-value>)',
            soft: 'rgb(var(--risk-medium-soft) / <alpha-value>)',
            line: 'rgb(var(--risk-medium-line) / <alpha-value>)',
          },
          low: {
            DEFAULT: 'rgb(var(--risk-low) / <alpha-value>)',
            soft: 'rgb(var(--risk-low-soft) / <alpha-value>)',
            line: 'rgb(var(--risk-low-line) / <alpha-value>)',
          },
          unknown: {
            DEFAULT: 'rgb(var(--risk-unknown) / <alpha-value>)',
            soft: 'rgb(var(--risk-unknown-soft) / <alpha-value>)',
            line: 'rgb(var(--risk-unknown-line) / <alpha-value>)',
          },
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
          popularity: 'rgb(var(--series-popularity) / <alpha-value>)',
          maintenance: 'rgb(var(--series-maintenance) / <alpha-value>)',
          bar: 'rgb(var(--series-bar) / <alpha-value>)',
          'bar-hover': 'rgb(var(--series-bar-hover) / <alpha-value>)',
          neutral: 'rgb(var(--fg-tertiary) / <alpha-value>)',
        },
        chart: {
          grid: 'rgb(var(--chart-grid) / <alpha-value>)',
          axis: 'rgb(var(--chart-axis) / <alpha-value>)',
          'axis-line': 'rgb(var(--chart-axis-line) / <alpha-value>)',
          threshold: 'rgb(var(--chart-threshold) / <alpha-value>)',
          gap: 'rgb(var(--chart-gap) / <alpha-value>)',
        },
        focus: 'rgb(var(--focus) / <alpha-value>)',
        selection: 'rgb(var(--selection) / <alpha-value>)',

        // ── Compatibility aliases. New code should use the semantic names above. ──
        accent: {
          DEFAULT: 'rgb(var(--brand) / <alpha-value>)',
          hover: 'rgb(var(--brand-strong) / <alpha-value>)',
          active: 'rgb(var(--brand-active) / <alpha-value>)',
          soft: 'rgb(var(--brand-soft) / <alpha-value>)',
          line: 'rgb(var(--brand-line) / <alpha-value>)',
        },
        teal: {
          DEFAULT: 'rgb(var(--series-maintenance) / <alpha-value>)',
          bright: 'rgb(var(--series-maintenance) / <alpha-value>)',
          soft: 'rgb(var(--teal-soft) / <alpha-value>)',
        },
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
          DEFAULT: 'rgb(var(--brand) / <alpha-value>)',
          strong: 'rgb(var(--brand-strong) / <alpha-value>)',
          dim: 'rgb(var(--brand-active) / <alpha-value>)',
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
        micro: ['0.6875rem', { lineHeight: '0.875rem' }],
        xs: ['0.8125rem', { lineHeight: '1.25rem' }],
        sm: ['0.875rem', { lineHeight: '1.375rem' }],
        base: ['0.9375rem', { lineHeight: '1.5rem' }],
        lg: ['1rem', { lineHeight: '1.625rem' }],
        xl: ['1.125rem', { lineHeight: '1.625rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem', letterSpacing: '-0.01em' }],
        '3xl': ['1.75rem', { lineHeight: '2.25rem', letterSpacing: '-0.015em' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem', letterSpacing: '-0.02em' }],
        '5xl': ['3rem', { lineHeight: '3.25rem', letterSpacing: '-0.025em' }],
        display: ['3.5rem', { lineHeight: '3.625rem', letterSpacing: '-0.03em' }],
        'readout-sm': ['2.25rem', { lineHeight: '2.5rem', letterSpacing: '-0.02em' }],
        'readout-md': ['2.5rem', { lineHeight: '2.75rem', letterSpacing: '-0.02em' }],
        readout: ['2.75rem', { lineHeight: '2.875rem', letterSpacing: '-0.02em' }],
      },
      letterSpacing: {
        display: '-0.02em',
        tightest: '-0.03em',
        title: '-0.01em',
        label: '0.04em',
        index: '0.08em',
        stamp: '0.12em',
      },
      maxWidth: {
        shell: '1400px',
        prose: '760px',
      },
      borderRadius: {
        chip: '2px',
        control: '4px',
        panel: '6px',
      },
      boxShadow: {
        panel: 'var(--shadow-panel)',
        raise: 'var(--shadow-raise)',
        pop: 'var(--shadow-pop)',
        inset: 'var(--shadow-inset)',
        art: 'var(--shadow-art)',
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
