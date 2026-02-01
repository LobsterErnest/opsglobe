"use client";

import { useRef, useState, useMemo, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars, QuadraticBezierLine, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { latLongToVector3 } from "../utils/geo";

// --- DATA TYPES ---
type ServerLocation = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  status: "online" | "warning" | "error";
  region: string;
  latency?: number;
};

const STATIC_LOCATIONS: ServerLocation[] = [
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
        (start[0] + end[0]) / 2 * 1.5,
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
  onSelect,
  setDebugMsg 
}: { 
  data: ServerLocation; 
  radius: number; 
  onSelect: (data: ServerLocation) => void;
  setDebugMsg: (msg: string) => void;
}) {
  const position = useMemo(() => latLongToVector3(data.lat, data.lon, radius), [data.lat, data.lon, radius]);
  const [hovered, setHover] = useState(false);
  
  const color = data.status === "online" ? "#00ff88" : data.status === "warning" ? "#ffaa00" : "#ff0055";

  return (
    <group position={position}>
      {/* 
         HITBOX STRATEGY:
         1. Visible=true but Opacity=0 (forces Raycaster to see it)
         2. Radius=0.35 (Huge compared to 0.06 visual node)
         3. Slightly elevated (z position) relative to group to ensure it's "on top" of earth
      */}
      <mesh 
        onClick={(e) => { 
          e.stopPropagation(); // Stop event from hitting the globe
          setDebugMsg(`CLICKED: ${data.name}`);
          onSelect(data); 
        }}
        onPointerOver={() => { setHover(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHover(false); document.body.style.cursor = 'auto'; }}
      >
        <sphereGeometry args={[0.35, 16, 16]} /> 
        <meshBasicMaterial color="red" transparent opacity={0.0} depthWrite={false} /> 
      </mesh>

      {/* Visible Node */}
      <mesh>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hovered ? 3 : 1.5}
        />
      </mesh>

      {/* Glow Ring */}
      {hovered && (
        <mesh>
          <ringGeometry args={[0.08, 0.12, 32]} />
          <meshBasicMaterial color={color} side={THREE.DoubleSide} transparent opacity={0.8} />
        </mesh>
      )}
    </group>
  );
}

function MainGlobe({ onSelectNode, nodeData, setDebugMsg }: { onSelectNode: (node: ServerLocation | null) => void, nodeData: ServerLocation[], setDebugMsg: (msg: string) => void }) {
  const globeRef = useRef<THREE.Mesh>(null);
  const GLOBE_RADIUS = 2;

  const colorMap = useTexture('/earth_daymap.jpg');

  useFrame((state, delta) => {
    if (globeRef.current) {
      globeRef.current.rotation.y += delta * 0.02; 
    }
  });

  const madridPos = useMemo(() => latLongToVector3(40.4168, -3.7038, GLOBE_RADIUS), []);

  return (
    <group>
      {/* The Globe Mesh */}
      <mesh 
        ref={globeRef} 
        onClick={(e) => {
          // If we hit the globe (and not a node via stopPropagation), deselect
          // But only if the click wasn't dragged (handled by R3F usually, but let's be safe)
          setDebugMsg(`CLICKED: Empty Space (Deselect)`);
          onSelectNode(null);
        }}
      >
        <sphereGeometry args={[GLOBE_RADIUS, 64, 64]} />
        <meshStandardMaterial 
          map={colorMap} 
          roughness={0.6}
          metalness={0.1}
        />

        {/* Atmosphere - RAYCAST DISABLED via null return to prevent blocking */}
        <mesh scale={[1.02, 1.02, 1.02]} raycast={() => null}>
             <sphereGeometry args={[GLOBE_RADIUS, 64, 64]} />
             <meshBasicMaterial color="#000020" transparent opacity={0.2} blending={THREE.AdditiveBlending} side={THREE.BackSide} />
        </mesh>

        {nodeData.map((loc) => (
          <ServerNode 
            key={loc.id} 
            data={loc} 
            radius={GLOBE_RADIUS} 
            onSelect={onSelectNode} 
            setDebugMsg={setDebugMsg}
          />
        ))}

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
  const [nodeData, setNodeData] = useState<ServerLocation[]>(STATIC_LOCATIONS);
  const [debugMsg, setDebugMsg] = useState("Ready (R19 Fix)");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      // ... same fetch logic ...
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        setNodeData(prev => prev.map(node => {
          const live = data.nodes.find((n: any) => n.id === node.id);
          if (live) {
            return { ...node, status: live.status, latency: live.latency };
          }
          return node;
        }));
      } catch (e) {
        // silent fail
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000); 
    return () => clearInterval(interval);
  }, []);

  return (
    <div 
      ref={containerRef}
      className="w-full h-screen bg-black relative overflow-hidden touch-none" // touch-none is CRITICAL for mobile
    >
      <Canvas 
        eventSource={containerRef} // Bind events to parent div (Fixes React 19 interaction)
        className="touch-none"
        camera={{ position: [0, 0, 6], fov: 45 }}
      >
        <color attach="background" args={["#000000"]} />
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={0.5} />
        
        <ambientLight intensity={1.5} />
        <directionalLight position={[10, 10, 5]} intensity={2} />
        <pointLight position={[-10, -10, -5]} intensity={1} color="#4444ff" />
        
        <MainGlobe onSelectNode={setSelectedNode} nodeData={nodeData} setDebugMsg={setDebugMsg} />
        
        <OrbitControls 
          makeDefault 
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
        <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tighter drop-shadow-md">
          OPS<span className="text-cyan-500">GLOBE</span>
        </h1>
        <div className="flex gap-2 mt-2">
           <div className="text-[10px] bg-zinc-900/80 border border-zinc-700 px-2 py-1 rounded text-zinc-300 backdrop-blur">
             NODES: <span className="text-white">{nodeData.length}</span>
           </div>
           <div className="text-[10px] bg-zinc-900/80 border border-zinc-700 px-2 py-1 rounded text-zinc-300 backdrop-blur">
             NET: <span className="text-green-400">ACTIVE</span>
           </div>
        </div>
      </div>

      {/* DEBUG PANEL (Bottom Left) - Helps verify touch inputs */}
      <div className="absolute bottom-2 left-2 z-10 pointer-events-none flex flex-col gap-2">
         <div className="text-[10px] text-zinc-600 font-mono bg-white/10 p-1">
           SYS_LOG: {debugMsg}
         </div>
         {/* HTML Test Button - Verify layer clicks */}
         <button 
            className="pointer-events-auto bg-red-500/50 text-[10px] text-white px-2 py-1 rounded"
            onClick={() => setDebugMsg("HTML CLICK OK")}
         >
           TEST HTML CLICK
         </button>
      </div>

      {/* Detail Panel */}
      {selectedNode && (
        <div className="absolute z-50 bg-zinc-900/95 backdrop-blur-xl border-t md:border border-zinc-600 p-5 text-white shadow-2xl transition-all animate-in slide-in-from-bottom-10 md:slide-in-from-right-10
          bottom-0 left-0 w-full rounded-t-2xl
          md:top-6 md:right-6 md:left-auto md:bottom-auto md:w-72 md:rounded-lg"
        >
          <button 
            onClick={() => setSelectedNode(null)}
            className="absolute top-3 right-4 md:top-2 md:right-2 p-2 text-zinc-500 hover:text-white bg-zinc-800/50 rounded-full md:bg-transparent"
          >
            ✕
          </button>
          
          <div className="flex justify-between items-start mb-4 pr-8">
            <div>
              <h2 className="text-xl font-bold text-cyan-400">{selectedNode.name}</h2>
              <p className="text-xs text-zinc-400">{selectedNode.region}</p>
            </div>
            <div className={`mt-1 w-3 h-3 rounded-full ${
              selectedNode.status === 'online' ? 'bg-green-500 shadow-[0_0_12px_#22c55e]' : 
              selectedNode.status === 'warning' ? 'bg-yellow-500 shadow-[0_0_12px_#eab308]' : 
              'bg-red-500 shadow-[0_0_12px_#ef4444]'
            }`} />
          </div>
          
          <div className="grid grid-cols-2 md:block gap-4 md:gap-0 space-y-0 md:space-y-3 text-sm">
            <div className="flex flex-col md:flex-row md:justify-between md:border-b border-zinc-800 pb-2">
              <span className="text-zinc-400 text-xs md:text-sm">Status</span>
              <span className="font-mono uppercase">{selectedNode.status}</span>
            </div>
            <div className="flex flex-col md:flex-row md:justify-between md:border-b border-zinc-800 pb-2">
              <span className="text-zinc-400 text-xs md:text-sm">Latency</span>
              <span className={`font-mono ${selectedNode.latency ? 'text-green-400' : 'text-zinc-500'}`}>
                {selectedNode.latency ? `${selectedNode.latency}ms` : '...'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
