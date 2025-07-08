/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{astro,html,js,jsx,ts,tsx,svelte,vue}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["Merriweather", "serif"],
        body: ["Georgia", "serif"],
      },
      borderRadius: {
        'md': '0.375rem',
        'xl': '1rem',
      },
      boxShadow: {
        subtle: '0 1px 2px rgba(0, 0, 0, 0.05)',
        vintage: '0 4px 6px rgba(60, 60, 59, 0.1)',
      },
    },
  },
  plugins: [
    function({ addUtilities }) {
      addUtilities({
        '.text-vintage': {
          color: '#3c3c3b',
          'font-family': 'Georgia, serif',
          'font-style': 'italic',
        },
      })
    }
  ],
  plugins: [require("daisyui"), require("@tailwindcss/typography")],
  daisyui: {
    themes: [
      {
        johncrow: {
          "primary": "#3c3c3b",       // Dusty black headline ink
          "base-100": "#f5f5eb",      // Faded paper ivory
          "base-content": "#1f1f1f",  // Newsprint text black
          "neutral": "#3c3c3b",
          "neutral-content": "#f5f5eb",
          "accent": "#8b7355",
          "accent-content": "#f5f5eb",
          "secondary": "#6b7280",
          "secondary-content": "#f5f5eb",
          "info": "#3b82f6",
          "success": "#10b981",
          "warning": "#f59e0b",
          "error": "#ef4444",
        },
      },
    ],
  },
};
