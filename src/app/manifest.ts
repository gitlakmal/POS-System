import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "නය පොත · Naya Potha",
    short_name: "Naya Potha",
    description: "Offline POS and digital credit book",
    start_url: "/",
    display: "standalone",
    background_color: "#ecfdf5",
    theme_color: "#065f46",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
