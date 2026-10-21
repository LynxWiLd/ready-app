/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        serif: ['Georgia', 'Cambria', 'Times New Roman', 'Times', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace']
      },
      colors: {
        sepia: {
          50: '#fbf7ef',
          100: '#f5eddc',
          200: '#eaddc0',
          300: '#dcc79c',
          400: '#c9ad74',
          500: '#b8955a',
          600: '#a17e4a',
          700: '#85663f',
          800: '#6d5437',
          900: '#5a4630'
        },
        ink: {
          50: '#f6f7f9',
          100: '#eceef2',
          200: '#d5dae2',
          300: '#b1bac8',
          400: '#8794a9',
          500: '#68768f',
          600: '#535f76',
          700: '#444e60',
          800: '#3b4251',
          900: '#343945',
          950: '#23262e'
        }
      },
      keyframes: {
        'fade-in': {
          from: { opacity: 0 },
          to: { opacity: 1 }
        },
        'slide-up': {
          from: { opacity: 0, transform: 'translateY(8px)' },
          to: { opacity: 1, transform: 'translateY(0)' }
        },
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' }
        }
      },
      animation: {
        'fade-in': 'fade-in 160ms ease-out',
        'slide-up': 'slide-up 200ms ease-out',
        shimmer: 'shimmer 1.4s infinite linear'
      }
    }
  },
  plugins: []
};
