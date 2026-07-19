"use client";

import { Canvas } from "@react-three/fiber";
import { useState } from "react";

type Store3DProps = {
  selectedDepartment: string | null;
  onSelectDepartment: (id: string | null) => void;
};

function ProduceCrate({
  selected,
  onClick,
}: {
  selected: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <group position={[0, 0, 0]}>
      <mesh
        position={[0, 0.75, 0]}
        castShadow
        scale={hovered || selected ? 1.06 : 1}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "auto";
        }}
      >
        <boxGeometry args={[2.4, 1.5, 2.4]} />
        <meshStandardMaterial
          color={selected ? "#22c55e" : "#4ade80"}
          emissive={selected ? "#14532d" : "#000000"}
          emissiveIntensity={selected ? 0.35 : 0}
        />
      </mesh>

      {/* Green ring on the floor marking the selected department */}
      {selected && (
        <mesh position={[0, 0.02, 0]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[1.9, 2.15, 48]} />
          <meshBasicMaterial color="#16a34a" />
        </mesh>
      )}
    </group>
  );
}

export default function Store3D({
  selectedDepartment,
  onSelectDepartment,
}: Store3DProps) {
  return (
    <Canvas
      shadows
      orthographic
      // Fixed isometric-style camera: up and off to a corner, looking at the
      // store center. Tweak position/zoom to change the angle later.
      camera={{ position: [10, 10, 10], zoom: 55, near: 0.1, far: 100 }}
      className="touch-none"
    >
      {/* Warm sky backdrop */}
      <color attach="background" args={["#fdf0d5"]} />

      {/* Soft fill light so nothing is pure black */}
      <ambientLight intensity={0.9} />

      {/* Sun: one angled light that casts the gentle shadows */}
      <directionalLight
        position={[6, 12, 5]}
        intensity={1.8}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
      />

      {/* Store floor. Clicking empty floor closes the department panel. */}
      <mesh
        rotation-x={-Math.PI / 2}
        receiveShadow
        onClick={() => onSelectDepartment(null)}
      >
        <planeGeometry args={[26, 26]} />
        <meshStandardMaterial color="#ecd9ae" />
      </mesh>

      <ProduceCrate
        selected={selectedDepartment === "produce"}
        onClick={() => onSelectDepartment("produce")}
      />
    </Canvas>
  );
}
