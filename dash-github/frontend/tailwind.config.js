/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        meat: {
          dark: '#121212',
          deep: '#0b0b0b',
          panel: '#1e1e1e',
          soft: '#252525',
          line: '#2d2d2d',
          red: '#c91c1c',
          crimson: '#e02a2a',
          green: '#2e7d32',
          blue: '#1976d2',
          orange: '#ed6c02',
          purple: '#7b1fa2',
          muted: '#a0a0a0',
        },
      },
      fontFamily: {
        sans: ['Vazirmatn', 'Tahoma', 'sans-serif'],
      },
      boxShadow: {
        panel: '0 18px 50px -30px rgba(0, 0, 0, 0.9)',
        'red-glow': '0 12px 35px -14px rgba(201, 28, 28, 0.65)',
        'green-glow': '0 12px 35px -18px rgba(46, 125, 50, 0.6)',
        'blue-glow': '0 12px 35px -18px rgba(25, 118, 210, 0.6)',
        'orange-glow': '0 12px 35px -18px rgba(237, 108, 2, 0.6)',
        'purple-glow': '0 12px 35px -18px rgba(123, 31, 162, 0.6)',
      },
      backgroundImage: {
        'red-sheen': 'linear-gradient(135deg, #e02a2a 0%, #a81414 55%, #7f0f0f 100%)',
        'panel-sheen': 'linear-gradient(145deg, rgba(255,255,255,0.035), rgba(255,255,255,0) 55%)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateX(24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'soft-pulse': {
          '0%, 100%': { opacity: '0.45' },
          '50%': { opacity: '0.9' },
        },
        shimmer: {
          '100%': { transform: 'translateX(-100%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.45s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in': 'fade-in 0.25s ease-out both',
        'slide-in': 'slide-in 0.3s cubic-bezier(0.22, 1, 0.36, 1) both',
        'soft-pulse': 'soft-pulse 3s ease-in-out infinite',
        shimmer: 'shimmer 1.8s infinite',
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
    },
  },
  plugins: [],
}
