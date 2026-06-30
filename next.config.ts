import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  // Die lokale Upload-Route (app/api/uploads/[bucket]/[...filename]/route.ts) liest
  // Dateien dynamisch von der Festplatte (UPLOAD_ROOT). Next.js' Build-Tracer (NFT)
  // kann dabei den dynamischen Pfad nicht statisch auflösen und versucht deshalb
  // vorsichtshalber, das gesamte Projektverzeichnis mit zu tracen — das ist hier
  // unkritisch (wir nutzen kein "output: standalone"), erzeugt aber eine Build-Warnung.
  // Offiziell empfohlene Lösung laut Next.js-Doku: gezielt ignorieren.
  turbopack: {
    ignoreIssue: [
      {
        path: "**/next.config.ts",
        title: /Encountered unexpected file in NFT list/,
        description: /A file was traced that indicates that the whole project was traced unintentionally\./,
      },
      {
        path: "**/app/api/uploads/**/route.ts",
        title: /Encountered unexpected file in NFT list/,
        description: /A file was traced that indicates that the whole project was traced unintentionally\./,
      },
    ],
  },
};

export default nextConfig;