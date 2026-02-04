"use client";

import { useMemo, useRef, useState, useEffect, Suspense, useCallback } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { OrbitControls, Stars, Html } from "@react-three/drei";
import * as THREE from "three";
import { latLongToVector3 } from "../utils/geo";

// --- DATA TYPES ---
type ServerStatus = "online" | "warning" | "error" | "offline";

type ProcessInfo = {
    cpu: string;
    mem: string;
    name: string;
};

type ServerLocation = {
  id: string;
  name: string;
  location: string;
  lat: number;
  lon: number;
  status: ServerStatus;
  region: string;
  cpu: number;
  memory: number;
  type: "simulated" | "real" | "public" | "custom";
  processes?: ProcessInfo[];
  ip?: string;
};

const STATUS_COLORS: Record<ServerStatus, string> = {
  online: "#00f0ff", // Cyberpunk Cyan
  warning: "#f7b731", // Warning Yellow
  error: "#ff2a6d",   // Neon Red
  offline: "#555555", // Greyed out
};

// Static Fake Data (Simulated Swarm)
const SIMULATED_SERVERS: ServerLocation[] = [
  { id: "nyc", name: "New York Core", location: "New York, US", lat: 40.7128, lon: -74.006, status: "online", region: "US-East", cpu: 64, memory: 71, type: "simulated" },
  { id: "sfo", name: "San Francisco Edge", location: "San Francisco, US", lat: 37.7749, lon: -122.4194, status: "warning", region: "US-West", cpu: 79, memory: 83, type: "simulated" },
  { id: "lon", name: "London Gateway", location: "London, UK", lat: 51.5074, lon: -0.1278, status: "error", region: "EU-West", cpu: 93, memory: 88, type: "simulated" },
  { id: "tok", name: "Tokyo Edge", location: "Tokyo, JP", lat: 35.6762, lon: 139.6503, status: "online", region: "AP-North", cpu: 61, memory: 70, type: "simulated" },
];

const PUBLIC_NODES: ServerLocation[] = [
  { id: "goog", name: "Google DNS", location: "Global Anycast", lat: 37.422, lon: -122.084, status: "online", region: "Global", cpu: 0, memory: 0, type: "public" },
  { id: "cf", name: "Cloudflare", location: "Global Anycast", lat: 37.7749, lon: -122.4194, status: "online", region: "Global", cpu: 0, memory: 0, type: "public" },
  { id: "q9", name: "Quad9", location: "Zurich, CH", lat: 47.3769, lon: 8.5417, status: "online", region: "EU-Central", cpu: 0, memory: 0, type: "public" },
];

// --- 3D COMPONENTS ---

function ServerMarker({
  data,
  radius,
  onSelect,
  isSelected,
}: {
  data: ServerLocation;
  radius: number;
  onSelect: (data: ServerLocation) => void;
  isSelected: boolean;
}) {
  const position = useMemo(() => latLongToVector3(data.lat, data.lon, radius), [data.lat, data.lon, radius]);
  const pulseRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const color = STATUS_COLORS[data.status];

  // Different visuals for different types
  const scale = data.type === 'real' ? 1.5 : 1; 

  useFrame(({ clock }) => {
    if (pulseRef.current) {
      const t = clock.getElapsedTime();
      const pulse = 1 + Math.sin(t * 3) * 0.2;
      pulseRef.current.scale.setScalar(pulse);
      (pulseRef.current.material as THREE.MeshBasicMaterial).opacity = 0.6 - (pulse - 1);
    }
  });

  return (
    <group position={position}>
      {/* Interaction Hitbox */}
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onSelect(data);
        }}
        onPointerOver={() => {
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "auto";
        }}
        visible={false}
      >
        <sphereGeometry args={[0.2, 16, 16]} />
      </mesh>

      {/* Core Marker */}
      <mesh scale={isSelected ? scale * 1.5 : hovered ? scale * 1.2 : scale}>
        <sphereGeometry args={[0.04, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isSelected ? 4 : 2}
          toneMapped={false}
        />
      </mesh>

      {/* Pulse / Selection Ring */}
      <mesh ref={pulseRef}>
        <sphereGeometry args={[0.08 * scale, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.3} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      {/* Label on Hover/Select */}
      {(hovered || isSelected) && (
        <Html position={[0, 0.15, 0]} center distanceFactor={10} zIndexRange={[100, 0]} occlude>
          <div className={`pointer-events-none whitespace-nowrap rounded bg-black/80 px-2 py-1 text-[10px] font-mono backdrop-blur border ${data.type === 'real' ? 'border-cyan-500 text-cyan-400 font-bold' : 'border-white/20 text-white'}`}>
            {data.name}
          </div>
        </Html>
      )}
    </group>
  );
}

function MainGlobe({
  nodes,
  onSelectNode,
  selectedNodeId,
}: {
  nodes: ServerLocation[];
  onSelectNode: (node: ServerLocation | null) => void;
  selectedNodeId: string | null;
}) {
  const globeRef = useRef<THREE.Mesh>(null);
  const GLOBE_RADIUS = 2;
  
  // Load texture
  const colorMap = useLoader(THREE.TextureLoader, '/earth_daymap.jpg');

  return (
    <group>
      <mesh
        ref={globeRef}
        onClick={(e) => {
          e.stopPropagation();
          onSelectNode(null);
        }}
        rotation={[0, 0, 0]}
      >
        <sphereGeometry args={[GLOBE_RADIUS, 128, 128]} />
        {/* Textured Earth with Emissive Glow for Visibility */}
        <meshStandardMaterial
          map={colorMap}
          color="#ffffff"
          emissiveMap={colorMap}
          emissive="#444444"
          emissiveIntensity={0.5}
          roughness={0.5}
          metalness={0.1}
        />
      </mesh>
      
      {/* Subtle Atmosphere Glow */}
      <mesh scale={[1.02, 1.02, 1.02]} rotation={[0, -Math.PI / 2, 0]}>
        <sphereGeometry args={[GLOBE_RADIUS, 128, 128]} />
        <meshBasicMaterial
          color="#00f0ff"
          transparent
          opacity={0.15}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      {nodes.map((loc) => (
        <ServerMarker
          key={loc.id}
          data={loc}
          radius={GLOBE_RADIUS}
          onSelect={onSelectNode}
          isSelected={selectedNodeId === loc.id}
        />
      ))}
    </group>
  );
}

// --- UI COMPONENTS ---

function AddNodeModal({ onClose, onAdd }: { onClose: () => void, onAdd: (node: any) => Promise<void> }) {
    const [formData, setFormData] = useState({ name: '', ip: '', lat: '', lng: '', region: '' });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        await onAdd(formData);
        setLoading(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 pointer-events-auto">
            <div className="w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-xl p-6 shadow-2xl relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-zinc-500 hover:text-white">✕</button>
                <h2 className="text-xl font-bold text-white mb-1">Add New Node</h2>
                <p className="text-xs text-zinc-500 mb-4">Register an external server for monitoring.</p>
                
                <form onSubmit={handleSubmit} className="space-y-3">
                    <div>
                        <label className="text-xs text-zinc-400 block mb-1">Node Name</label>
                        <input required className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-cyan-500 outline-none" 
                            value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. My Web Server" />
                    </div>
                    <div>
                        <label className="text-xs text-zinc-400 block mb-1">IP Address / Hostname</label>
                        <input required className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-cyan-500 outline-none" 
                            value={formData.ip} onChange={e => setFormData({...formData, ip: e.target.value})} placeholder="e.g. my-app.com" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-zinc-400 block mb-1">Latitude</label>
                            <input type="number" step="any" className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-cyan-500 outline-none" 
                                value={formData.lat} onChange={e => setFormData({...formData, lat: e.target.value})} placeholder="Auto-detect" />
                        </div>
                        <div>
                            <label className="text-xs text-zinc-400 block mb-1">Longitude</label>
                            <input type="number" step="any" className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-cyan-500 outline-none" 
                                value={formData.lng} onChange={e => setFormData({...formData, lng: e.target.value})} placeholder="Auto-detect" />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-zinc-400 block mb-1">Region</label>
                        <input className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-cyan-500 outline-none" 
                            value={formData.region} onChange={e => setFormData({...formData, region: e.target.value})} placeholder="e.g. US-West" />
                    </div>
                    <button disabled={loading} type="submit" className="w-full mt-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 rounded transition">
                        {loading ? 'Adding...' : 'Add Node'}
                    </button>
                </form>
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: ServerStatus }) {
  const color = STATUS_COLORS[status];
  return (
    <div 
      className="flex items-center gap-2 rounded-full border bg-black/40 px-2 py-1 text-[10px] uppercase tracking-wider backdrop-blur-md"
      style={{ borderColor: `${color}40`, color: color }}
    >
      <div className="h-1.5 w-1.5 rounded-full shadow-[0_0_8px_currentColor]" style={{ background: color }} />
      {status}
    </div>
  );
}

function ToolsPanel() {
    const [target, setTarget] = useState("");
    const [port, setPort] = useState("80");
    const [result, setResult] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [activeTool, setActiveTool] = useState<'ping' | 'nslookup' | 'ssl' | 'port'>('ping');

    const runTool = async () => {
        if (!target) return;
        setLoading(true);
        setResult(null);
        try {
            const res = await fetch('/api/tools', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: activeTool, target, port: parseInt(port) })
            });
            const data = await res.json();
            setResult(data.result || data.error);
        } catch (e) {
            setResult("Error executing command.");
        } finally {
            setLoading(false);
        }
    };

    const tools = ['ping', 'nslookup', 'ssl', 'port'];

    return (
        <div className="flex flex-col h-full">
            <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-widest border-b border-white/10 pb-2">Network Tools</h3>
            
            <div className="grid grid-cols-4 gap-1 mb-4">
                {tools.map(t => (
                    <button 
                        key={t}
                        onClick={() => setActiveTool(t as any)}
                        className={`py-1.5 text-[10px] font-mono border rounded uppercase ${activeTool === t ? 'border-cyan-500 bg-cyan-500/20 text-cyan-300' : 'border-white/10 bg-white/5 text-zinc-400'}`}
                    >
                        {t}
                    </button>
                ))}
            </div>

            <div className="flex gap-2 mb-4">
                <input 
                    type="text" 
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    placeholder="Domain or IP..."
                    className="flex-1 bg-black/40 border border-white/10 rounded px-3 py-2 text-xs text-white font-mono focus:border-cyan-500/50 outline-none"
                    onKeyDown={(e) => e.key === 'Enter' && runTool()}
                />
                {activeTool === 'port' && (
                    <input 
                        type="number"
                        value={port}
                        onChange={(e) => setPort(e.target.value)}
                        className="w-16 bg-black/40 border border-white/10 rounded px-2 py-2 text-xs text-white font-mono focus:border-cyan-500/50 outline-none"
                        placeholder="Port"
                    />
                )}
                <button 
                    onClick={runTool}
                    disabled={loading}
                    className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded text-xs font-bold disabled:opacity-50"
                >
                    {loading ? '...' : '>'}
                </button>
            </div>

            <div className="flex-1 bg-black/60 border border-white/10 rounded p-3 font-mono text-[10px] text-zinc-300 overflow-y-auto whitespace-pre-wrap">
                {result ? result : <span className="text-zinc-600">// Output will appear here...</span>}
            </div>
        </div>
    );
}

export default function OpsGlobeScene() {
  const [selectedNode, setSelectedNode] = useState<ServerLocation | null>(null);
  const [nodes, setNodes] = useState<ServerLocation[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | ServerStatus>("all");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<'nodes' | 'tools'>('nodes');
  const [showAddModal, setShowAddModal] = useState(false);
  
  // FETCH DATA
  const fetchData = useCallback(async () => {
    try {
        // 1. Fetch Local Status
        const statusRes = await fetch('/api/status');
        const statusData = await statusRes.json();
        
        const realNode: ServerLocation = {
            id: 'local-hq',
            name: `${statusData.hostname} (HQ)`,
            location: 'Berlin, DE', 
            lat: 52.5200,
            lon: 13.4050,
            status: 'online',
            region: 'Local',
            cpu: statusData.cpu,
            memory: statusData.memory,
            type: 'real',
            processes: statusData.processes
        };

        // 2. Fetch Custom Nodes
        const nodesRes = await fetch('/api/nodes');
        const customNodesRaw = await nodesRes.json();
        const customNodes: ServerLocation[] = customNodesRaw.map((n: any) => ({
            id: n.id,
            name: n.name,
            location: n.ip, // Use IP as location label for now
            lat: n.lat,
            lon: n.lng,
            status: n.status === 'online' ? 'online' : 'offline',
            region: n.region,
            cpu: 0,
            memory: 0,
            type: 'custom',
            ip: n.ip
        }));

        setNodes([realNode, ...customNodes, ...SIMULATED_SERVERS, ...PUBLIC_NODES]);

    } catch (e) {
        console.error("Failed to fetch data", e);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000); 
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleAddNode = async (data: any) => {
    try {
        await fetch('/api/nodes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        await fetchData(); // Refresh list immediately
    } catch (e) {
        console.error("Failed to add node", e);
    }
  };

  const filteredNodes = useMemo(() => {
    const term = search.trim().toLowerCase();
    return nodes.filter((node) => {
      const matchesStatus = statusFilter === "all" || node.status === statusFilter;
      const matchesSearch =
        term.length === 0 ||
        node.name.toLowerCase().includes(term) ||
        node.location.toLowerCase().includes(term) ||
        node.region.toLowerCase().includes(term);
      return matchesStatus && matchesSearch;
    });
  }, [search, statusFilter, nodes]);

  return (
    <div className="relative h-screen w-full bg-[#050505] overflow-hidden text-zinc-100 font-sans selection:bg-cyan-500/30">
      
      {showAddModal && (
          <AddNodeModal onClose={() => setShowAddModal(false)} onAdd={handleAddNode} />
      )}

      {/* Canvas Layer */}
      <div className="absolute inset-0 z-0">
        <Canvas camera={{ position: [0, 0, 5.5], fov: 45 }} gl={{ antialias: true }}>
          <color attach="background" args={["#020205"]} />
          <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={0.5} />
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} intensity={1} color="#4f8cff" />
          <pointLight position={[-10, -10, -10]} intensity={0.5} color="#bd00ff" />
          
          <Suspense fallback={null}>
            <MainGlobe
              nodes={filteredNodes}
              onSelectNode={setSelectedNode}
              selectedNodeId={selectedNode?.id ?? null}
            />
          </Suspense>
          
          <OrbitControls 
            enablePan={false} 
            minDistance={3} 
            maxDistance={8}
            enableRotate={true}
            autoRotate={false} 
            enableDamping
          />
        </Canvas>
      </div>

      {/* HEADER */}
      <div className="absolute top-6 left-6 z-10 pointer-events-none select-none">
        <div className="flex flex-col">
          <h1 className="text-3xl font-bold tracking-tighter text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">
            OPS<span className="text-cyan-400">GLOBE</span>
          </h1>
          <div className="mt-1 flex items-center gap-2 text-xs font-mono text-cyan-500/80">
            <span className="animate-pulse">●</span> LIVE SYSTEM
            <span className="text-zinc-600">|</span>
            <span>V3.0.0</span>
          </div>
        </div>
      </div>

      {/* LEFT SIDEBAR - CONTROL PANEL */}
      <div className="absolute left-6 top-28 bottom-6 w-80 z-10 flex flex-col gap-4 pointer-events-none">
        
        {/* Tab Switcher */}
        <div className="flex bg-black/60 rounded-xl p-1 border border-white/10 backdrop-blur-xl pointer-events-auto">
             <button 
                onClick={() => setTab('nodes')}
                className={`flex-1 py-2 text-xs font-bold uppercase tracking-wide rounded-lg transition-all ${tab === 'nodes' ? 'bg-cyan-500/20 text-cyan-300 shadow-[0_0_10px_rgba(0,240,255,0.1)]' : 'text-zinc-500 hover:text-zinc-300'}`}
             >
                Nodes
             </button>
             <button 
                onClick={() => setTab('tools')}
                className={`flex-1 py-2 text-xs font-bold uppercase tracking-wide rounded-lg transition-all ${tab === 'tools' ? 'bg-cyan-500/20 text-cyan-300 shadow-[0_0_10px_rgba(0,240,255,0.1)]' : 'text-zinc-500 hover:text-zinc-300'}`}
             >
                Net Tools
             </button>
        </div>

        {tab === 'nodes' ? (
            <>
                {/* Filter Panel */}
                <div className="rounded-xl border border-white/10 bg-black/60 p-4 backdrop-blur-xl shadow-2xl pointer-events-auto">
                    <div className="flex gap-2 mb-3">
                        <input
                            type="text"
                            placeholder="Search nodes..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-cyan-500/50 focus:bg-white/10 transition-all"
                        />
                        <button 
                            onClick={() => setShowAddModal(true)}
                            className="bg-cyan-600 hover:bg-cyan-500 text-white px-3 rounded-lg text-lg font-bold"
                            title="Add Node"
                        >
                            +
                        </button>
                    </div>
                    
                    <div className="flex gap-2">
                        {(['all', 'online', 'warning', 'error', 'offline'] as const).map(status => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={`flex-1 rounded py-1.5 text-[10px] font-medium uppercase tracking-wide transition-all ${
                            statusFilter === status 
                                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-[0_0_10px_rgba(0,240,255,0.1)]' 
                                : 'bg-white/5 text-zinc-400 border border-transparent hover:bg-white/10'
                            }`}
                        >
                            {status}
                        </button>
                        ))}
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto rounded-xl border border-white/10 bg-black/60 p-2 backdrop-blur-xl shadow-2xl scrollbar-none pointer-events-auto">
                <div className="space-y-1">
                    {filteredNodes.map(node => (
                    <button
                        key={node.id}
                        onClick={() => setSelectedNode(node)}
                        className={`group w-full flex items-center justify-between rounded-lg border px-3 py-3 transition-all ${
                        selectedNode?.id === node.id
                            ? 'border-cyan-500/40 bg-cyan-500/10 shadow-[inset_0_0_20px_rgba(0,240,255,0.05)]'
                            : 'border-transparent hover:bg-white/5 hover:border-white/5'
                        }`}
                    >
                        <div className="text-left">
                        <div className={`text-sm font-medium ${selectedNode?.id === node.id ? 'text-white' : 'text-zinc-300 group-hover:text-white'} flex items-center gap-2`}>
                            {node.name}
                            {node.type === 'real' && <span className="text-[9px] bg-cyan-900/50 text-cyan-300 px-1 rounded border border-cyan-500/30">HQ</span>}
                            {node.type === 'custom' && <span className="text-[9px] bg-purple-900/50 text-purple-300 px-1 rounded border border-purple-500/30">EXT</span>}
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono mt-0.5">{node.location}</div>
                        </div>
                        <div className={`h-2 w-2 rounded-full shadow-[0_0_8px_currentColor]`} style={{ color: STATUS_COLORS[node.status], backgroundColor: STATUS_COLORS[node.status] }} />
                    </button>
                    ))}
                    {filteredNodes.length === 0 && (
                    <div className="p-4 text-center text-xs text-zinc-500">No servers found.</div>
                    )}
                </div>
                </div>
            </>
        ) : (
            <div className="flex-1 rounded-xl border border-white/10 bg-black/60 p-4 backdrop-blur-xl shadow-2xl pointer-events-auto">
                <ToolsPanel />
            </div>
        )}
      </div>

      {/* RIGHT SIDEBAR - DETAILS */}
      {selectedNode && (
        <div className="absolute right-6 top-6 bottom-6 w-80 z-10 flex flex-col justify-center animate-in slide-in-from-right-10 duration-300 pointer-events-none">
          <div className="rounded-2xl border border-white/10 bg-black/70 p-6 backdrop-blur-xl shadow-2xl relative overflow-hidden pointer-events-auto">
            {/* Background Decoration */}
            <div className="absolute top-0 right-0 p-3 opacity-20">
               <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            </div>
            
            <div className="mb-6">
               <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-mono mb-2">Selected Node</div>
               <h2 className="text-2xl font-bold text-white leading-tight">{selectedNode.name}</h2>
               <div className="text-xs text-cyan-400 font-mono mt-1">{selectedNode.id.toUpperCase()} <span className="text-zinc-600">|</span> {selectedNode.region}</div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5">
                <span className="text-xs text-zinc-400">Status</span>
                <StatusBadge status={selectedNode.status} />
              </div>

              {/* Metrics */}
              {selectedNode.type === 'real' ? (
                <div className="space-y-4">
                    <div>
                    <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-zinc-400">CPU Load</span>
                        <span className="font-mono text-white">{selectedNode.cpu}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                        <div 
                            className="h-full rounded-full transition-all duration-700 ease-out" 
                            style={{ width: `${selectedNode.cpu}%`, background: selectedNode.cpu > 80 ? '#ff2a6d' : '#00f0ff' }} 
                        />
                    </div>
                    </div>

                    <div>
                    <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-zinc-400">Memory Usage</span>
                        <span className="font-mono text-white">{selectedNode.memory}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                        <div 
                            className="h-full rounded-full bg-purple-500 transition-all duration-700 ease-out" 
                            style={{ width: `${selectedNode.memory}%` }} 
                        />
                    </div>
                    </div>
                </div>
              ) : selectedNode.type === 'custom' ? (
                  <div className="p-4 bg-white/5 rounded text-xs text-zinc-400 space-y-2">
                      <div className="flex justify-between">
                          <span>Target IP</span>
                          <span className="text-white font-mono">{selectedNode.ip}</span>
                      </div>
                      <div className="flex justify-between">
                          <span>Monitoring</span>
                          <span className="text-cyan-400">TCP Ping (Port 80)</span>
                      </div>
                  </div>
              ) : (
                  <div className="p-4 bg-white/5 rounded text-xs text-zinc-400 italic text-center">
                      Public Infrastructure Node<br/>Metrics unavailable
                  </div>
              )}
              
              {/* TOP PROCESSES */}
              {selectedNode.processes && selectedNode.processes.length > 0 && (
                  <div className="pt-2 border-t border-white/10">
                      <div className="text-[10px] text-zinc-400 uppercase tracking-wider mb-2">Top Processes</div>
                      <div className="space-y-1">
                          {selectedNode.processes.map((p, i) => (
                              <div key={i} className="flex justify-between text-[10px] font-mono text-zinc-300 bg-white/5 px-2 py-1 rounded">
                                  <span className="truncate w-32">{p.name}</span>
                                  <span className="text-cyan-400">{p.cpu}% CPU</span>
                              </div>
                          ))}
                      </div>
                  </div>
              )}

              {/* Action Buttons */}
              {selectedNode.type === 'real' && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                    <button className="rounded-lg border border-white/10 bg-white/5 py-2 text-xs font-medium text-zinc-300 hover:bg-white/10 hover:text-white transition">
                    Restart Service
                    </button>
                    <button className="rounded-lg border border-red-500/30 bg-red-500/10 py-2 text-xs font-medium text-red-400 hover:bg-red-500/20 hover:text-red-300 transition">
                    Panic Button
                    </button>
                </div>
              )}
            </div>

            {/* Close Button */}
            <button 
              onClick={() => setSelectedNode(null)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white transition"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
        </div>
      )}

      {/* Footer / Overlay details */}
      <div className="absolute bottom-6 right-6 z-0 text-right pointer-events-none opacity-50">
        <div className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest">System Operational</div>
        <div className="text-[10px] text-zinc-700 font-mono">lat: {selectedNode?.lat.toFixed(4) ?? '--'} lon: {selectedNode?.lon.toFixed(4) ?? '--'}</div>
      </div>

    </div>
  );
}
