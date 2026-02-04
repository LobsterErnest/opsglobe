import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import net from 'net';

const NODES_FILE = path.join(process.cwd(), 'utils', 'nodes.json');

// Helper to check server status via TCP
const checkServerStatus = (host: string): Promise<string> => {
  return new Promise((resolve) => {
    // Default to port 80 if not specified (rough check)
    // If the user inputs "1.2.3.4", we try 80.
    const port = 80; 
    const socket = new net.Socket();
    socket.setTimeout(1500); // 1.5s timeout

    socket.on('connect', () => {
      socket.destroy();
      resolve('ONLINE');
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve('OFFLINE');
    });

    socket.on('error', (err) => {
      socket.destroy();
      resolve('OFFLINE');
    });

    try {
        socket.connect(port, host);
    } catch(e) {
        resolve('OFFLINE');
    }
  });
};

export async function GET() {
  try {
    // Ensure file exists
    try {
        await fs.access(NODES_FILE);
    } catch {
        await fs.writeFile(NODES_FILE, '[]');
    }

    const data = await fs.readFile(NODES_FILE, 'utf-8');
    let nodes = JSON.parse(data);
    
    // Check status for all nodes in parallel
    const nodesWithStatus = await Promise.all(nodes.map(async (node: any) => {
        const status = await checkServerStatus(node.ip);
        return { ...node, status };
    }));

    return NextResponse.json(nodesWithStatus);
  } catch (e) {
    console.error("Error reading nodes:", e);
    return NextResponse.json([]);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    let { name, ip, lat, lng, region } = body;

    if (!name || !ip) {
        return NextResponse.json({ error: 'Name and IP are required' }, { status: 400 });
    }

    // Auto-Geolocation if coords are missing
    if (!lat || !lng) {
        try {
            // Using ip-api.com (free, no key required for basic use)
            const geoRes = await fetch(`http://ip-api.com/json/${ip}`);
            const geoData = await geoRes.json();
            
            if (geoData.status === 'success') {
                lat = geoData.lat;
                lng = geoData.lon;
                if (!region) region = `${geoData.city}, ${geoData.countryCode}`;
            } else {
                // Fallback: Null Island or Random
                lat = (Math.random() * 40) - 20;
                lng = (Math.random() * 80) - 40;
                region = region || 'Unknown Location';
            }
        } catch (e) {
            console.error("GeoIP lookup failed:", e);
            lat = 0;
            lng = 0;
        }
    }

    let nodes = [];
    try {
        const data = await fs.readFile(NODES_FILE, 'utf-8');
        nodes = JSON.parse(data);
    } catch (e) {
        // file missing, start empty
    }

    const newNode = {
        id: Date.now().toString(),
        name,
        ip,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        region: region || 'Remote',
        status: 'PENDING'
    };

    nodes.push(newNode);
    await fs.writeFile(NODES_FILE, JSON.stringify(nodes, null, 2));

    return NextResponse.json(newNode);
  } catch (e) {
    console.error("Error saving node:", e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
