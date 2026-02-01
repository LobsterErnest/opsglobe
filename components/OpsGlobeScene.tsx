"use client";

import { useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars, Html } from "@react-three/drei";
import * as THREE from "three";

function ServerNode({ position, label }: { position: [number, number, number]; label?: string }) {
  const [hovered, setHover] = useState(false);
  
  return (
    <group position={position}>
      <mesh
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
      >
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial
          color={hovered ? "#ff0055" : "#00ff88"}
          emissive={hovered ? "#ff0055" : "#00ff88"}
          emissiveIntensity={2}
        />
      </mesh>
      {hovered && label && (
        <Html distanceFactor={10}>
          <div className="bg-black/80 text-white text-xs px-2 py-1 rounded border border-green-500 whitespace-nowrap backdrop-blur-md">
            {label}
          </div>
        </Html>
      )}
    </group>
  );
}

function MainGlobe() {
  const globeRef = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (globeRef.current) {
      globeRef.current.rotation.y += delta * 0.05; // Gentle rotation
    }
  });

  return (
    <group>
      {/* Core Sphere - Dark Ocean */}
      <mesh ref={globeRef}>
        <sphereGeometry args={[2, 64, 64]} />
        <meshStandardMaterial
          color="#050510"
          roughness={0.7}
          metalness={0.5}
        />
      </mesh>

      {/* Wireframe Grid - Tech Layer */}
      <mesh ref={globeRef}>
        <sphereGeometry args={[2.01, 32, 32]} />
        <meshBasicMaterial
          color="#2a2a40"
          wireframe
          transparent
          opacity={0.3}
        />
      </mesh>
      
      {/* Sample "Server" Nodes */}
      <group rotation={[0, 0, 0.2]}> {/* Tilt slightly */}
        <ServerNode position={[2, 0.5, 0]} label="Cluster EU-West" />
        <ServerNode position={[-1.5, 1, 1]} label="Cluster US-East" />
        <ServerNode position={[0.5, -1.5, 1.2]} label="Backup Node" />
      </group>
    </group>
  );
}

export default function OpsGlobeScene() {
  return (
    <div className="w-full h-screen bg-black">
      <Canvas camera={{ position: [0, 0, 6], fov: 45 }}>
        <color attach="background" args={["#000000"]} />
        
        {/* Environment */}
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={2} color="#4444ff" />
        <pointLight position={[-10, -10, -10]} intensity={1} color="#ff4444" />

        {/* The World */}
        <MainGlobe />

        {/* Controls */}
        <OrbitControls
          enablePan={false}
          enableZoom={true}
          minDistance={3}
          maxDistance={10}
          autoRotate
          autoRotateSpeed={0.5}
        />
      </Canvas>
      
      {/* UI Overlay */}
      <div className="absolute top-8 left-8 z-10 pointer-events-none">
        <h1 className="text-4xl font-bold text-white tracking-tighter">
          OPS<span className="text-green-500">GLOBE</span>
        </h1>
        <p className="text-zinc-500 text-sm mt-1 uppercase tracking-widest">
          Global Infrastructure Status
        </p>
      </div>

      <div className="absolute bottom-8 right-8 z-10 pointer-events-none text-right">
        <div className="flex items-center justify-end gap-2 text-green-500 text-xs font-mono">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          SYSTEM ONLINE
        </div>
        <p className="text-zinc-600 text-xs mt-1">v1.0.0-alpha</p>
      </div>
    </div>
  );
}
