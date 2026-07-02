import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CloudIT Hospitality",
    short_name: "Hospitality",
    description: "Hospitality OS by CloudIT Solutions",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone", "browser"],
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#0f766e",
    categories: ["business", "productivity", "travel"],
    icons: [
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Today",
        short_name: "Today",
        description: "Open today's hotel dashboard",
        url: "/dashboard",
      },
      {
        name: "Check-ins",
        short_name: "Check-ins",
        description: "View today's guest arrivals",
        url: "/dashboard/checkin",
      },
      {
        name: "Housekeeping",
        short_name: "Cleaning",
        description: "Open room cleaning tasks",
        url: "/dashboard/housekeeping",
      },
      {
        name: "Reports",
        short_name: "Reports",
        description: "Open Hospitality OS reports",
        url: "/dashboard/reports",
      },
    ],
  };
}
