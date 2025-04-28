/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/web/**/*.tsx",
    "./node_modules/flowbite/**/*.js", // Add Flowbite source files for Tailwind processing
  ],
  theme: {
    extend: {},
  },
  plugins: [
    require("flowbite/plugin"), // Add the Flowbite plugin
  ],
};
