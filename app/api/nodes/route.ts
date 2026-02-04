import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import net from 'net';

const NODES_FILE = path.join(process.cwd(), 'utils', 'nodes.json');

// Helper to check server status via TCP
const checkServerStatus = (host: string): Promise<ServerStatus> => {
  return new Promise((resolve) => {
    const port = 80; // Default to port 80 for a basic check
    const socket = new net.Socket();
    socket.setTimeout(1500);

    socket.on('connect', () => {
      socket.destroy();
      resolve('online');
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve('offline');
    });
    socket.on('error', () => {
      socket.destroy();
      resolve('offline');
    });

    try {
      socket.connect(port, host);
    } catch (e) {
      resolve('offline');
    }
  });
};


export async function GET() {
  try {
    try {
      await fs.access(NODES_FILE);
    } catch {
      await fs.writeFile(NODES_FILE, '[]'); // Create if doesn't exist
    }

    const data = await fs.readFile(NODES_FILE, 'utf-8');
    let nodes = JSON.parse(data);
    
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
    let { name, ip, lat, lng, region } = await req.json();

    if (!name || !ip) {
      return NextResponse.json({ error: 'Name and IP are required' }, { status: 400 });
    }

    // AUTO-GEOLOCATION LOGIC
    if (!lat || !lng) {
      try {
        const geoRes = await fetch(`http://ip-api.com/json/${ip}`);
        if (!geoRes.ok) throw new Error('GeoIP API request failed');
        
        const geoData = await geoRes.json();
        
        if (geoData.status === 'success') {
          lat = geoData.lat;
          lng = geoData.lon;
          if (!region) region = `${geoData.city}, ${geoData.countryCode}`; // Auto-fill region
        } else {
          // Fallback to a random-ish location if lookup fails
          lat = 0;
          lng = 0;
        }
      } catch (e) {
        console.error("GeoIP lookup failed, using fallback:", e);
        lat = 0;
        lng = 0;
      }
    }

    let nodes = [];
    try {
      const data = await fs.readFile(NODES_FILE, 'utf-8');
      nodes = JSON.parse(data);
    } catch (e) {
      // file missing is ok, we'll create it
    }

    const newNode = {
      id: `node_${Date.now()}`,
      name,
      ip,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      region: region || 'Auto-Detected',
      status: 'offline' // Start as offline, next GET will update
    };

    nodes.push(newNode);
    await fs.writeFile(NODES_FILE, JSON.stringify(nodes, null, 2));

    return NextResponse.json(newNode, { status: 201 });
  } catch (e) {
    console.error("Error saving node:", e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
