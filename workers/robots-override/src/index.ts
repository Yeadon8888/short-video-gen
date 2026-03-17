export default {
  async fetch(request: Request): Promise<Response> {
    const robotsTxt = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /generate
Disallow: /tasks
Disallow: /assets
Disallow: /settings
Disallow: /admin

Sitemap: https://video.yeadon.top/sitemap.xml
`;

    return new Response(robotsTxt, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=86400",
      },
    });
  },
};
