import { NextResponse } from 'next/server';
import dns from 'dns';
import net from 'net';
import tls from 'tls';

export async function POST(request: Request) {
  try {
    const { type, target, port } = await request.json();

    if (!target) {
      return NextResponse.json({ error: 'Target is required' }, { status: 400 });
    }

    if (type === 'nslookup') {
        try {
            const addresses = await new Promise((resolve, reject) => {
                dns.resolve4(target, (err, addresses) => {
                    if (err) reject(err);
                    else resolve(addresses);
                });
            });
            return NextResponse.json({ result: `DNS Records for ${target}: ${(addresses as string[]).join(', ')}` });
        } catch (error: any) {
             return NextResponse.json({ result: `DNS Error: ${error.message}` });
        }
    } else if (type === 'ping') {
        const checkPort = (host: string, port: number) => {
            return new Promise((resolve, reject) => {
                const socket = new net.Socket();
                const start = Date.now();
                socket.setTimeout(2000);
                
                socket.on('connect', () => {
                    const duration = Date.now() - start;
                    socket.destroy();
                    resolve(duration);
                });

                socket.on('timeout', () => {
                    socket.destroy();
                    reject(new Error('Timeout'));
                });

                socket.on('error', (err) => {
                    socket.destroy();
                    reject(err);
                });

                socket.connect(port, host);
            });
        };

        try {
            try {
                const duration = await checkPort(target, 80);
                return NextResponse.json({ result: `Target ${target} is ALIVE (Port 80). Latency: ${duration}ms` });
            } catch {
                 const duration = await checkPort(target, 443);
                 return NextResponse.json({ result: `Target ${target} is ALIVE (Port 443). Latency: ${duration}ms` });
            }
        } catch (error) {
             return NextResponse.json({ result: `Target ${target} unreachable (Ports 80/443 closed or timeout).` });
        }

    } else if (type === 'port') {
        const targetPort = port || 80;
        try {
            await new Promise((resolve, reject) => {
                const socket = new net.Socket();
                socket.setTimeout(2000);
                socket.on('connect', () => {
                    socket.destroy();
                    resolve(true);
                });
                socket.on('timeout', () => {
                    socket.destroy();
                    reject(new Error('Timeout'));
                });
                socket.on('error', (err) => {
                    socket.destroy();
                    reject(err);
                });
                socket.connect(targetPort, target);
            });
            return NextResponse.json({ result: `Port ${targetPort} on ${target} is OPEN.` });
        } catch (error: any) {
            return NextResponse.json({ result: `Port ${targetPort} on ${target} is CLOSED/FILTERED (${error.message}).` });
        }
    } else if (type === 'ssl') {
        try {
             const result = await new Promise<string>((resolve, reject) => {
                const socket = tls.connect(443, target, { servername: target }, () => {
                    const cert = socket.getPeerCertificate();
                    if (!cert || Object.keys(cert).length === 0) {
                        reject(new Error('No certificate found'));
                        return;
                    }
                    socket.end();
                    
                    const validTo = new Date(cert.valid_to);
                    const daysRemaining = Math.ceil((validTo.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    resolve(`SSL Certificate for ${target}:\n- Issuer: ${cert.issuer.O}\n- Valid To: ${validTo.toDateString()}\n- Days Remaining: ${daysRemaining}`);
                });

                socket.on('error', (err) => {
                    reject(err);
                });
                
                socket.setTimeout(3000, () => {
                    socket.destroy();
                    reject(new Error('Timeout connecting to SSL'));
                });
             });
             return NextResponse.json({ result });
        } catch (error: any) {
             return NextResponse.json({ result: `SSL Check Failed: ${error.message}` });
        }
    } else {
        return NextResponse.json({ error: 'Invalid tool type' }, { status: 400 });
    }

  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
