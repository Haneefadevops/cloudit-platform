import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CloudIT Hospitality",
    short_name: "Hospitality",
    description: "Hospitality OS by CloudIT Solutions",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0f766e",
    categories: ["business", "productivity", "travel"],
  };
}
