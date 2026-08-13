/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Warm-neutral surfaces with a deep ink for text/primary actions and
        // a teal accent for interactive/selected state — distinct from the
        // per-code color palette used for coding highlights.
        ink: {
          DEFAULT: '#1b1a17',
          soft: '#57534e',
        },
        surface: {
          DEFAULT: '#ffffff',
          alt: '#faf9f7',
          sunken: '#f5f4f1',
        },
        border: {
          DEFAULT: '#e5e2dd',
          strong: '#d4d0c8',
        },
        accent: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Inter',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 1px 2px rgba(27,26,23,0.04), 0 1px 8px rgba(27,26,23,0.04)',
        popover: '0 8px 24px rgba(27,26,23,0.12)',
      },
      borderRadius: {
        xl: '14px',
      },
    },
  },
  plugins: [],
};
