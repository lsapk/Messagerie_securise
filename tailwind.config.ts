import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        chatDark: '#121212',
        chatCard: '#1f2937',
        chatAccent: '#3b82f6',
      },
    },
  },
  plugins: [],
};

export default config;
