"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { latLongToVector3 } from "../utils/geo";

// --- DATA TYPES ---
type ServerStatus = "online" | "warning" | "error";

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
};

const STATUS_COLORS: Record<ServerStatus, string> = {
  online: "#1ef7a1",
  warning: "#f7b731",
  error: "#ff476f",
};

const SERVERS: ServerLocation[] = [
  { id: "mad", name: "Madrid HQ", location: "Madrid, ES", lat: 40.4168, lon: -3.7038, status: "online", region: "EU-South", cpu: 42, memory: 58 },
  { id: "nyc", name: "New York Core", location: "New York, US", lat: 40.7128, lon: -74.006, status: "online", region: "US-East", cpu: 64, memory: 71 },
  { id: "sfo", name: "San Francisco Edge", location: "San Francisco, US", lat: 37.7749, lon: -122.4194, status: "warning", region: "US-West", cpu: 79, memory: 83 },
  { id: "lon", name: "London Gateway", location: "London, UK", lat: 51.5074, lon: -0.1278, status: "error", region: "EU-West", cpu: 93, memory: 88 },
  { id: "fra", name: "Frankfurt Vault", location: "Frankfurt, DE", lat: 50.1109, lon: 8.6821, status: "online", region: "EU-Central", cpu: 51, memory: 63 },
  { id: "sao", name: "Sao Paulo Relay", location: "Sao Paulo, BR", lat: -23.5505, lon: -46.6333, status: "warning", region: "SA-East", cpu: 69, memory: 76 },
  { id: "jnb", name: "Johannesburg Shield", location: "Johannesburg, ZA", lat: -26.2041, lon: 28.0473, status: "online", region: "AF-South", cpu: 47, memory: 55 },
  { id: "blr", name: "Bangalore Mesh", location: "Bangalore, IN", lat: 12.9716, lon: 77.5946, status: "online", region: "AP-South", cpu: 58, memory: 61 },
  { id: "tok", name: "Tokyo Edge", location: "Tokyo, JP", lat: 35.6762, lon: 139.6503, status: "online", region: "AP-North", cpu: 61, memory: 70 },
  { id: "syd", name: "Sydney Backup", location: "Sydney, AU", lat: -33.8688, lon: 151.2093, status: "warning", region: "AP-South", cpu: 72, memory: 79 },
];

// --- COMPONENTS ---

function ServerMarker({
  data,
  radius,
  onSelect,
}: {
  data: ServerLocation;
  radius: number;
  onSelect: (data: ServerLocation) => void;
}) {
  const position = useMemo(() => latLongToVector3(data.lat, data.lon, radius), [data.lat, data.lon, radius]);
  const pulseRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const color = STATUS_COLORS[data.status];
  const phase = useMemo(() => Math.random() * Math.PI * 2, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const pulse = 0.6 + Math.sin(t * 2 + phase) * 0.4;
    if (pulseRef.current) {
      const scale = 1.1 + pulse * 1.1;
      pulseRef.current.scale.setScalar(scale);
      const material = pulseRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = 0.35 * (1.4 - pulse);
    }
  });

  return (
    <group position={position}>
      <mesh
        onClick={(event) => {
          event.stopPropagation();
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
      >
        <sphereGeometry args={[0.28, 16, 16]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.0} depthWrite={false} />
      </mesh>

      <mesh>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={hovered ? 2.5 : 1.4} />
      </mesh>

      <mesh ref={pulseRef}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.35} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

function MainGlobe({
  nodes,
  onSelectNode,
}: {
  nodes: ServerLocation[];
  onSelectNode: (node: ServerLocation | null) => void;
}) {
  const globeRef = useRef<THREE.Mesh>(null);
  const GLOBE_RADIUS = 2;
  const colorMap = useTexture("/earth_daymap.jpg");

  useFrame((_, delta) => {
    if (globeRef.current) {
      globeRef.current.rotation.y += delta * 0.02;
    }
  });

  return (
    <group>
      <mesh
        ref={globeRef}
        onClick={() => {
          onSelectNode(null);
        }}
      >
        <sphereGeometry args={[GLOBE_RADIUS, 64, 64]} />
        <meshStandardMaterial map={colorMap} roughness={0.65} metalness={0.1} />

        <mesh scale={[1.02, 1.02, 1.02]} raycast={() => null}>
          <sphereGeometry args={[GLOBE_RADIUS, 64, 64]} />
          <meshBasicMaterial
            color="#0b1a35"
            transparent
            opacity={0.25}
            blending={THREE.AdditiveBlending}
            side={THREE.BackSide}
          />
        </mesh>

        {nodes.map((loc) => (
          <ServerMarker key={loc.id} data={loc} radius={GLOBE_RADIUS} onSelect={onSelectNode} />
        ))}
      </mesh>
    </group>
  );
}

function StatusPill({ status }: { status: ServerStatus }) {
  const color = STATUS_COLORS[status];
  return (
    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em]">
      <span className="h-2 w-2 rounded-full" style={{ background: color, boxShadow: `0 0 10px ${color}` }} />
      <span className="text-zinc-300">{status}</span>
    </div>
  );
}

export default function OpsGlobeScene() {
  const [selectedNode, setSelectedNode] = useState<ServerLocation | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | ServerStatus>("all");
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredNodes = useMemo(() => {
    const term = search.trim().toLowerCase();
    return SERVERS.filter((node) => {
      const matchesStatus = statusFilter === "all" || node.status === statusFilter;
      const matchesSearch =
        term.length === 0 ||
        node.name.toLowerCase().includes(term) ||
        node.location.toLowerCase().includes(term) ||
        node.region.toLowerCase().includes(term);
      return matchesStatus && matchesSearch;
    });
  }, [search, statusFilter]);

  useEffect(() => {
    if (selectedNode && !filteredNodes.some((node) => node.id === selectedNode.id)) {
      setSelectedNode(null);
    }
  }, [filteredNodes, selectedNode]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[100dvh] bg-[#05070f] overflow-hidden touch-none isolate"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(66,94,255,0.16),_transparent_45%),radial-gradient(circle_at_30%_80%,_rgba(0,255,209,0.12),_transparent_40%)]" />
      <div className="absolute inset-0 opacity-40 mix-blend-screen" style={{ background: "linear-gradient(120deg, rgba(0,180,255,0.08), rgba(0,0,0,0))" }} />

      <Canvas
        eventSource={containerRef as React.RefObject<HTMLElement>}
        className="absolute inset-0 z-0 touch-none"
        style={{ pointerEvents: "auto" }}
        camera={{ position: [0, 0, 6], fov: 45 }}
        gl={{ alpha: true, preserveDrawingBuffer: true }}
      >
        <Stars radius={100} depth={50} count={6000} factor={4} saturation={0} fade speed={0.6} />

        <ambientLight intensity={1.3} />
        <directionalLight position={[10, 8, 6]} intensity={2.1} />
        <pointLight position={[-10, -8, -5]} intensity={1.2} color="#4f8cff" />

        <MainGlobe nodes={filteredNodes} onSelectNode={setSelectedNode} />

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

      <div className="absolute inset-0 z-10 pointer-events-none select-none">
        <div className="absolute top-6 left-6 pointer-events-auto">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 shadow-[0_0_40px_rgba(0,170,255,0.2)] backdrop-blur">
            <p className="text-[11px] uppercase tracking-[0.4em] text-cyan-300">OpsGlobe</p>
            <h1 className="text-2xl md:text-3xl font-semibold text-white tracking-tight">DevOps Atlas</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-300">
              <div className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1">
                <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.8)]" />
                {SERVERS.length} servers tracked
              </div>
              <div className="rounded-full bg-white/5 px-3 py-1">Realtime mesh</div>
            </div>
          </div>
        </div>

        <div
          className="absolute left-4 right-4 bottom-4 pointer-events-auto md:left-6 md:right-auto md:top-24 md:bottom-6 md:w-80"
        >
          <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-black/60 p-4 shadow-[0_0_45px_rgba(0,0,0,0.6)] backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Server Fleet</h2>
                <p className="text-xs text-zinc-400">Filter by status, locate instantly.</p>
              </div>
              <div className="text-xs text-zinc-400">{filteredNodes.length} shown</div>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search servers, regions, cities"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
              />

              <div className="grid grid-cols-2 gap-2 text-xs font-medium">
                {(["all", "online", "warning", "error"] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`rounded-lg border px-3 py-2 transition ${
                      statusFilter === status
                        ? "border-cyan-400/60 bg-cyan-400/20 text-cyan-200"
                        : "border-white/10 bg-white/5 text-zinc-400 hover:text-white"
                    }`}
                  >
                    {status === "all" ? "All" : status}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 flex-1 overflow-hidden">
              <div className="h-full space-y-3 overflow-y-auto pr-1">
                {filteredNodes.map((node) => {
                  const color = STATUS_COLORS[node.status];
                  return (
                    <button
                      key={node.id}
                      onClick={() => setSelectedNode(node)}
                      className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                        selectedNode?.id === node.id
                          ? "border-cyan-400/60 bg-cyan-400/10"
                          : "border-white/10 bg-white/5 hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-white">{node.name}</h3>
                          <p className="text-xs text-zinc-400">{node.location} · {node.region}</p>
                        </div>
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: color, boxShadow: `0 0 10px ${color}` }} />
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-400">
                        <span>CPU {node.cpu}%</span>
                        <span>Memory {node.memory}%</span>
                      </div>
                    </button>
                  );
                })}
                {filteredNodes.length === 0 && (
                  <div className="rounded-xl border border-dashed border-white/10 bg-white/5 p-4 text-center text-xs text-zinc-500">
                    No servers match the current filters.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {selectedNode && (
          <div className="absolute right-4 top-4 pointer-events-auto md:right-6 md:top-6">
            <div className="w-64 rounded-2xl border border-white/10 bg-black/70 p-4 shadow-[0_0_45px_rgba(0,170,255,0.25)] backdrop-blur-xl">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Active Node</p>
                  <h2 className="text-lg font-semibold text-white">{selectedNode.name}</h2>
                  <p className="text-xs text-zinc-400">{selectedNode.location}</p>
                </div>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-300 hover:text-white"
                >
                  Close
                </button>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <StatusPill status={selectedNode.status} />
                <span className="text-xs text-zinc-400">{selectedNode.region}</span>
              </div>

              <div className="mt-4 space-y-2 text-xs text-zinc-300">
                <div className="flex items-center justify-between">
                  <span>CPU Load</span>
                  <span className="font-mono text-white">{selectedNode.cpu}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-cyan-400" style={{ width: `${selectedNode.cpu}%` }} />
                </div>

                <div className="flex items-center justify-between">
                  <span>Memory</span>
                  <span className="font-mono text-white">{selectedNode.memory}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-purple-400" style={{ width: `${selectedNode.memory}%` }} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
