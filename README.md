# Labtrail on Vercel

1. Push this folder to a GitHub repo, then Import it in Vercel (framework: Other).
2. Vercel > Storage / Marketplace > add Upstash Redis (free plan). It sets the REDIS env vars for you.
3. Vercel > Settings > Environment Variables:
   - ANTHROPIC_API_KEY  (create a NEW key in console.anthropic.com just for Labtrail)
   - ADMIN_TOKEN        (any long random string; protects the stats page)
   - ACCESS_CODES (invite codes, e.g. tian:200,friend1,friend2). While set, only people with a code can read reports. Delete it later to open to everyone (then per-IP limit applies).
   - optional: DAILY_CAP (default 600 Claude calls/day), IP_LIMIT (default 20/day per visitor), CLAUDE_MODEL
4. Redeploy. Open /api/stats?token=YOUR_ADMIN_TOKEN&html=1 for usage.
5. Vercel > Analytics > Enable Web Analytics for page views and referrers (free on Hobby).
6. In console.anthropic.com set a monthly spend limit on the workspace as a hard backstop.

public/index.html is generated: python3 scripts/build.py ../labtrail/index.html
