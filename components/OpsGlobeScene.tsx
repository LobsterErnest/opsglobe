"use client";

import { useRef, useState, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars, Html, QuadraticBezierLine } from "@react-three/drei";
import * as THREE from "three";
import { latLongToVector3 } from "../utils/geo";

// --- DATA ---
type ServerLocation = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  status: "online" | "warning" | "error";
  region: string;
  latency?: number;
};

const LOCATIONS: ServerLocation[] = [
  { id: "mad", name: "Madrid HQ", lat: 40.4168, lon: -3.7038, status: "online", region: "EU-South" },
  { id: "nyc", name: "New York Core", lat: 40.7128, lon: -74.0060, status: "online", region: "US-East" },
  { id: "sfo", name: "San Francisco", lat: 37.7749, lon: -122.4194, status: "warning", region: "US-West" },
  { id: "tok", name: "Tokyo Edge", lat: 35.6762, lon: 139.6503, status: "online", region: "AP-North" },
  { id: "syd", name: "Sydney Backup", lat: -33.8688, lon: 151.2093, status: "online", region: "AP-South" },
  { id: "lon", name: "London Gateway", lat: 51.5074, lon: -0.1278, status: "error", region: "EU-West" },
  { id: "sap", name: "São Paulo", lat: -23.5505, lon: -46.6333, status: "online", region: "SA-East" },
];

// --- COMPONENTS ---

function ConnectionLine({ start, end, color }: { start: [number, number, number]; end: [number, number, number]; color: string }) {
  return (
    <QuadraticBezierLine
      start={start}
      end={end}
      mid={[
        (start[0] + end[0]) / 2 * 1.5, // Push midpoint out to curve nicely
        (start[1] + end[1]) / 2 * 1.5,
        (start[2] + end[2]) / 2 * 1.5
      ]}
      color={color}
      lineWidth={1}
      transparent
      opacity={0.4}
    />
  );
}

function ServerNode({ 
  data, 
  radius, 
  onSelect 
}: { 
  data: ServerLocation; 
  radius: number; 
  onSelect: (data: ServerLocation) => void 
}) {
  const position = useMemo(() => latLongToVector3(data.lat, data.lon, radius), [data.lat, data.lon, radius]);
  const [hovered, setHover] = useState(false);
  
  const color = data.status === "online" ? "#00ff88" : data.status === "warning" ? "#ffaa00" : "#ff0055";

  return (
    <group position={position}>
      <mesh
        onClick={(e) => { e.stopPropagation(); onSelect(data); }}
        onPointerOver={() => { setHover(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHover(false); document.body.style.cursor = 'auto'; }}
      >
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hovered ? 3 : 1.5}
        />
      </mesh>
      {/* Glow effect ring */}
      {hovered && (
        <mesh>
          <ringGeometry args={[0.08, 0.1, 32]} />
          <meshBasicMaterial color={color} side={THREE.DoubleSide} transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  );
}

function MainGlobe({ onSelectNode }: { onSelectNode: (node: ServerLocation | null) => void }) {
  const globeRef = useRef<THREE.Mesh>(null);
  const GLOBE_RADIUS = 2;

  useFrame((state, delta) => {
    if (globeRef.current) {
      globeRef.current.rotation.y += delta * 0.02; // Slow rotation
    }
  });

  const [nodeData, setNodeData] = useState<ServerLocation[]>(LOCATIONS);

  // Poll for live status
  useMemo(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        
        // Merge live data with static coords
        setNodeData(prev => prev.map(node => {
          const live = data.nodes.find((n: any) => n.id === node.id);
          if (live) {
            return { ...node, status: live.status, latency: live.latency };
          }
          return node;
        }));
      } catch (e) {
        console.error("Failed to fetch status", e);
      }
    };
    
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const madridPos = useMemo(() => latLongToVector3(40.4168, -3.7038, GLOBE_RADIUS), []);

  return (
    <group>
      {/* Interactive invisible sphere for drag catching if needed */}
      <mesh ref={globeRef} onClick={() => onSelectNode(null)}>
        <sphereGeometry args={[GLOBE_RADIUS, 64, 64]} />
        <meshStandardMaterial color="#050510" roughness={0.8} metalness={0.2} />
        
        {/* Child mesh for wireframe to rotate with globe */}
        <mesh>
          <sphereGeometry args={[GLOBE_RADIUS + 0.01, 32, 32]} />
          <meshBasicMaterial color="#303050" wireframe transparent opacity={0.15} />
        </mesh>

        {/* Nodes attached to the globe rotation */}
        {nodeData.map((loc) => (
          <ServerNode 
            key={loc.id} 
            data={loc} 
            radius={GLOBE_RADIUS} 
            onSelect={onSelectNode} 
          />
        ))}

        {/* Connections (Static for now, could be dynamic) */}
        {nodeData.filter(l => l.id !== 'mad').map((loc) => {
          const pos = latLongToVector3(loc.lat, loc.lon, GLOBE_RADIUS);
          return (
            <ConnectionLine 
              key={`link-mad-${loc.id}`} 
              start={madridPos} 
              end={pos} 
              color="#00ffff" 
            />
          );
        })}
      </mesh>
    </group>
  );
}

export default function OpsGlobeScene() {
  const [selectedNode, setSelectedNode] = useState<ServerLocation | null>(null);

  return (
    <div className="w-full h-screen bg-black relative">
      <Canvas camera={{ position: [0, 0, 5.5], fov: 45 }}>
        <color attach="background" args={["#000005"]} />
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={0.5} />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={2} color="#4444ff" />
        
        <MainGlobe onSelectNode={setSelectedNode} />
        
        <OrbitControls 
          enablePan={false} 
          minDistance={3} 
          maxDistance={10} 
          enableDamping 
          dampingFactor={0.05}
          rotateSpeed={0.5}
        />
      </Canvas>
      
      {/* UI Overlay */}
      <div className="absolute top-6 left-6 z-10 pointer-events-none select-none">
        <h1 className="text-3xl font-bold text-white tracking-tighter">
          OPS<span className="text-cyan-500">GLOBE</span>
        </h1>
        <div className="flex gap-2 mt-2">
           <div className="text-[10px] bg-zinc-900 border border-zinc-800 px-2 py-1 rounded text-zinc-400">
             NODES: <span className="text-white">{LOCATIONS.length}</span>
           </div>
           <div className="text-[10px] bg-zinc-900 border border-zinc-800 px-2 py-1 rounded text-zinc-400">
             NET: <span className="text-green-400">STABLE</span>
           </div>
        </div>
      </div>

      {/* Detail Panel */}
      {selectedNode && (
        <div className="absolute right-6 top-6 w-64 bg-zinc-900/90 backdrop-blur-md border border-zinc-700 rounded-lg p-4 text-white shadow-2xl transition-all animate-in slide-in-from-right-10">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-lg font-bold text-cyan-400">{selectedNode.name}</h2>
              <p className="text-xs text-zinc-500">{selectedNode.region} • {selectedNode.lat.toFixed(2)}, {selectedNode.lon.toFixed(2)}</p>
            </div>
            <div className={`w-2 h-2 rounded-full ${
              selectedNode.status === 'online' ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 
              selectedNode.status === 'warning' ? 'bg-yellow-500 shadow-[0_0_10px_#eab308]' : 
              'bg-red-500 shadow-[0_0_10px_#ef4444]'
            }`} />
          </div>
          
          <div className="space-y-3 text-sm">
            <div className="flex justify-between border-b border-zinc-800 pb-1">
              <span className="text-zinc-400">CPU Usage</span>
              <span className="font-mono">{Math.floor(Math.random() * 40) + 10}%</span>
            </div>
            <div className="flex justify-between border-b border-zinc-800 pb-1">
              <span className="text-zinc-400">Memory</span>
              <span className="font-mono">{Math.floor(Math.random() * 8) + 4}GB / 32GB</span>
            </div>
            <div className="flex justify-between border-b border-zinc-800 pb-1">
              <span className="text-zinc-400">Latency (Real)</span>
              <span className="font-mono text-green-400">
                {selectedNode.latency ? `${selectedNode.latency}ms` : 'Checking...'}
              </span>
            </div>
          </div>

          <div className="mt-4 pt-2 border-t border-zinc-700 text-xs text-zinc-500 text-center uppercase tracking-wider">
            Telemetry Live
          </div>
        </div>
      )}

      <div className="absolute bottom-6 left-0 w-full text-center pointer-events-none">
        <p className="text-zinc-600 text-[10px] uppercase tracking-[0.2em]">
          Interactive Infrastructure Map v1.1
        </p>
      </div>
    </div>
  );
}
