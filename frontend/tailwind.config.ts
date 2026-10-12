import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-jakarta)', 'Arial', 'sans-serif'],
      },
      colors: {
        // Background & surface
        background: '#F4F6F8',
        surface: '#FFFFFF',
        // Brand accent
        amber: { DEFAULT: '#D97706', hover: '#B45309' },
        // Navy (sidebar)
        navy: { DEFAULT: '#0F172A', light: '#1E293B', muted: '#475569' },
        // Text
        ink: '#0F172A',
        muted: '#64748B',
        subtle: '#94A3B8',
        // Border
        stroke: '#E2E8F0',
        // Legacy aliases (keep for backward compat with existing components)
        cream: '#F4F6F8',
        'brown-mid': '#64748B',
        'brown-dark': '#0F172A',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(15,23,42,0.06), 0 1px 2px -1px rgba(15,23,42,0.04)',
        'card-hover': '0 4px 12px 0 rgba(15,23,42,0.10), 0 2px 4px -2px rgba(15,23,42,0.06)',
        'sidebar': '1px 0 0 0 #1E293B',
      },
    },
  },
  plugins: [],
};
export default config;
