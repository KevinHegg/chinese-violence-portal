/** @type {import('tailwindcss').Config} */
const { themes } = require("daisyui/src/colors/themes");

module.exports = {
  content: ["./src/**/*.{astro,html,js,jsx,ts,tsx,svelte,vue}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Merriweather", "serif"],
        body: ["Georgia", "serif"],
      },
    },
  },
  plugins: [require("daisyui"), require("@tailwindcss/typography")],
  daisyui: {
    themes: [
      {
        johncrow: {
          ...themes["[data-theme=dim]"],
          primary: "#3c3c3b",
          "base-100": "#f5f5eb",
          "base-content": "#1f1f1f",
        },
      },
    ],
  },
};
