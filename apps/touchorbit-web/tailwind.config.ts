import type { Config } from "tailwindcss";
import uiConfig from "@cloudit/ui/tailwind.config";

const config: Config = {
  darkMode: uiConfig.darkMode,
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: uiConfig.theme,
  plugins: uiConfig.plugins,
};

export default config;
