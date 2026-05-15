import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FalconDraft",
    short_name: "FalconDraft",
    description: "Espace client FalconDraft",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#142033",
    theme_color: "#142033",
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
