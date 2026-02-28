# OpsGlobe

Server monitoring dashboard with 3D globe visualization. Built with Next.js, React Three Fiber, and Tailwind.

## Features

- **3D Globe** – Interactive globe with server markers
- **Simulated + Public nodes** – Demo servers (NYC, SFO, London, Tokyo) + public infra (Google DNS, Cloudflare, GitHub, AWS, etc.)
- **Custom nodes** – Add your own servers to monitor
- **Network tools** – Ping, nslookup, port check, SSL check
- **Real-time status** – CPU, memory, top processes (when running locally)

## Local Development

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy on Vercel

1. Push to GitHub and import in Vercel.
2. Deploy.

### Custom nodes on Vercel

Vercel has a read-only filesystem, so custom nodes can't be added via the UI. Use the **`OPSGLOBE_NODES`** environment variable:

```json
[
  {"id":"my-site","name":"My Site","ip":"mysite.com","lat":40.4,"lng":-3.7,"region":"Spain"},
  {"id":"api","name":"API Server","ip":"api.example.com","lat":37.77,"lng":-122.42,"region":"US-West"}
]
```

Format: JSON array. Each object needs `id`, `name`, `ip`. Optional: `lat`, `lng`, `region` (auto-detected from IP if omitted).

Set in Vercel: Project → Settings → Environment Variables → Add `OPSGLOBE_NODES`.

## Tech Stack

- Next.js 16
- React 19
- React Three Fiber + Drei
- Tailwind CSS 4
