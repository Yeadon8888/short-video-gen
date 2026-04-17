import type { MetadataRoute } from "next";

const SITE_URL = "https://video.yeadon.top";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/blog", "/gallery", "/privacy", "/terms", "/refund", "/contact"],
        disallow: [
          "/api/",
          "/auth/",
          "/generate",
          "/tasks",
          "/assets",
          "/settings",
          "/admin",
          "/face-swap",
          "/analyze",
          "/scene",
          "/pricing",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
