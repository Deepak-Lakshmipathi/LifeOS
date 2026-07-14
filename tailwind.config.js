/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      // Glass Cockpit (v2) — DESIGN_LANGUAGE.md §2.4, verbatim.
      // The apple-*/ios/glass keys below are v1 and stay until each view is
      // restyled onto tokens (S21+).
      fontFamily: {
        sans: [
          '"SF Pro Display"',
          '-apple-system',
          '"Segoe UI Variable Display"',
          '"Segoe UI"',
          'system-ui',
          'sans-serif',
        ],
      },
      colors: {
        bg: '#0b0f1e',
        bg2: '#10162b',
        txt: '#e8ecf6',
        dim: '#8b93ab',
        faint: '#5a6178',
        good: '#4ade80',
        warn: '#fbbf24',
        bad: '#f87171',
        domain: {
          build: '#f59e0b',
          career: '#38bdf8',
          growth: '#a78bfa',
          admin: '#94a3b8',
          body: '#2dd4bf',
          fin: '#4ade80',
          rel: '#f472b6',
        },
        panel: 'rgba(255,255,255,.055)',
        'panel-brd': 'rgba(255,255,255,.09)',
        apple: {
          blue: '#007AFF',
          green: '#34C759',
          red: '#FF3B30',
          gray: {
            1: '#8E8E93',
            2: '#AEAEB2',
            3: '#C7C7CC',
            4: '#D1D1D6',
            5: '#E5E5EA',
            6: '#F2F2F7',
          },
          label: '#000000',
          secondary: 'rgba(60,60,67,0.6)',
          separator: 'rgba(60,60,67,0.12)',
        },
      },
      borderRadius: {
        card: '18px',
        tile: '14px',
        row: '12px',
        chip: '9px',
        'ios': '12px',
        'ios-sm': '8px',
        'ios-lg': '16px',
      },
      backdropBlur: { seg: '12px', tile: '14px', card: '16px' },
      maxWidth: { shell: '1180px' },
      transitionDuration: { DEFAULT: '200ms', tab: '300ms' },
      boxShadow: {
        'ios': '0 2px 8px rgba(0,0,0,0.08)',
        'ios-md': '0 4px 16px rgba(0,0,0,0.12)',
        // Glass/elevation system (S11)
        'glass-sm':    '0 2px 12px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.50)',
        'glass-md':    '0 4px 24px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.60)',
        'glass-lg':    '0 8px 40px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.70)',
        'glass-float': '0 16px 60px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.80)',
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
    },
  },
  plugins: [],
}
