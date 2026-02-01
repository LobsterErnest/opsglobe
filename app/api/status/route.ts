import { NextResponse } from 'next/server';

type ServiceCheck = {
  id: string;
  url: string;
  name: string;
  region: string; // Mapping to our 3D nodes
};

const SERVICES: ServiceCheck[] = [
  { id: 'mad', name: 'Madrid Core', url: 'https://google.es', region: 'EU-South' },
  { id: 'nyc', name: 'US East Gateway', url: 'https://github.com', region: 'US-East' },
  { id: 'tok', name: 'Asia Edge', url: 'https://www.sony.co.jp', region: 'AP-North' }, // Sony Japan as proxy for Tokyo latency
  { id: 'lon', name: 'London Auth', url: 'https://bbc.co.uk', region: 'EU-West' },
];

export async function GET() {
  const results = await Promise.all(
    SERVICES.map(async (service) => {
      const start = performance.now();
      try {
        const res = await fetch(service.url, { method: 'HEAD', cache: 'no-store' });
        const latency = Math.round(performance.now() - start);
        
        return {
          id: service.id,
          name: service.name,
          region: service.region,
          status: res.ok ? 'online' : 'error',
          latency: latency,
          lastChecked: new Date().toISOString()
        };
      } catch (error) {
        return {
          id: service.id,
          name: service.name,
          region: service.region,
          status: 'error',
          latency: 0,
          error: 'Unreachable'
        };
      }
    })
  );

  return NextResponse.json({ 
    timestamp: new Date().toISOString(),
    nodes: results 
  });
}
