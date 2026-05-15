import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** GitHub project Pages need /repo-name/; local dev and drag-drop dist use ./ */
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || "./",
});
