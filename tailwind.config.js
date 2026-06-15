/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"SF Pro Text"',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
      },
      colors: {
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
        'ios': '12px',
        'ios-sm': '8px',
        'ios-lg': '16px',
      },
      boxShadow: {
        'ios': '0 2px 8px rgba(0,0,0,0.08)',
        'ios-md': '0 4px 16px rgba(0,0,0,0.12)',
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
    },
  },
  plugins: [],
}
