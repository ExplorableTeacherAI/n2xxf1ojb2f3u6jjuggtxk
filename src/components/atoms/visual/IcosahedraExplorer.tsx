import React, { useRef, useState, useCallback, Suspense, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";

// ── Stellation Region Colors ──────────────────────────────────────────────────

const REGION_COLORS: Record<number, string> = {
    0: "#8B0000",   // Dark red - center
    1: "#FF6B6B",   // Light red
    2: "#4ECDC4",   // Teal
    3: "#45B7D1",   // Light blue
    4: "#96CEB4",   // Sage green
    5: "#FFEAA7",   // Light yellow
    6: "#DDA0DD",   // Plum
    7: "#F39C12",   // Orange
    8: "#9B59B6",   // Purple
    9: "#3498DB",   // Blue
    10: "#E74C3C",  // Red
    11: "#2ECC71",  // Green
    12: "#1ABC9C",  // Turquoise
    13: "#E91E63",  // Pink/Magenta
};

// ── Stellation Diagram Geometry ───────────────────────────────────────────────
// The stellation diagram divides the plane around a triangular face into regions.
// Each region corresponds to a different stellation of the icosahedron.

interface Point {
    x: number;
    y: number;
}

// Generate the stellation diagram points for a triangle pointing UP
// Based on the classic icosahedral stellation pattern
function generateStellationGeometry(size: number, cx: number, cy: number) {
    const h = size * Math.sqrt(3) / 2;

    // Main triangle vertices (pointing UP) - labeled A (top), B (bottom-left), C (bottom-right)
    const A: Point = { x: cx, y: cy - h * 2 / 3 };
    const B: Point = { x: cx - size / 2, y: cy + h / 3 };
    const C: Point = { x: cx + size / 2, y: cy + h / 3 };

    // Midpoints of the main triangle
    const mAB: Point = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
    const mBC: Point = { x: (B.x + C.x) / 2, y: (B.y + C.y) / 2 };
    const mCA: Point = { x: (C.x + A.x) / 2, y: (C.y + A.y) / 2 };

    // Center of triangle
    const center: Point = { x: cx, y: cy };

    // Extended vertices for outer stellations
    // These extend the edges of the triangle outward
    const scale2 = 2.0;  // First extension
    const scale3 = 3.0;  // Second extension
    const scale4 = 4.5;  // Outer extension

    // Extend from center through each vertex
    const extendPoint = (p: Point, s: number): Point => ({
        x: cx + (p.x - cx) * s,
        y: cy + (p.y - cy) * s
    });

    // Extended main vertices
    const A2 = extendPoint(A, scale2);
    const B2 = extendPoint(B, scale2);
    const C2 = extendPoint(C, scale2);

    const A3 = extendPoint(A, scale3);
    const B3 = extendPoint(B, scale3);
    const C3 = extendPoint(C, scale3);

    const A4 = extendPoint(A, scale4);
    const B4 = extendPoint(B, scale4);
    const C4 = extendPoint(C, scale4);

    // Extended midpoints
    const mAB2 = extendPoint(mAB, scale2);
    const mBC2 = extendPoint(mBC, scale2);
    const mCA2 = extendPoint(mCA, scale2);

    const mAB3 = extendPoint(mAB, scale3);
    const mBC3 = extendPoint(mBC, scale3);
    const mCA3 = extendPoint(mCA, scale3);

    // Intersection points for the stellation lines
    // Lines through vertices parallel to opposite edges create the stellation pattern

    // Define the regions based on the stellation diagram
    // Region 0: Central triangle (the original icosahedron face)
    // Regions 1-12: Various stellation cells
    // Region 13: Outermost triangular regions

    const regions: { id: number; points: Point[]; }[] = [
        // Region 0: Center small triangle
        { id: 0, points: [center, mAB, mCA] },
        { id: 0, points: [center, mBC, mAB] },
        { id: 0, points: [center, mCA, mBC] },

        // Region 1: Three triangles adjacent to center (pointing outward)
        { id: 1, points: [A, mAB, mCA] },
        { id: 2, points: [B, mBC, mAB] },
        { id: 3, points: [C, mCA, mBC] },

        // Region 4-6: Kite shapes between vertices (inner layer)
        { id: 4, points: [mAB, A, A2, mAB2] },
        { id: 5, points: [mCA, A, A2, mCA2] },
        { id: 6, points: [mAB, B, B2, mAB2] },
        { id: 7, points: [mBC, B, B2, mBC2] },
        { id: 8, points: [mBC, C, C2, mBC2] },
        { id: 9, points: [mCA, C, C2, mCA2] },

        // Region 10-11: Middle layer triangles
        { id: 10, points: [A2, mAB2, mCA2] },
        { id: 10, points: [B2, mBC2, mAB2] },
        { id: 10, points: [C2, mCA2, mBC2] },

        // Region 11: Kite shapes (outer layer)
        { id: 11, points: [mAB2, A2, A3, mAB3] },
        { id: 11, points: [mCA2, A2, A3, mCA3] },
        { id: 11, points: [mAB2, B2, B3, mAB3] },
        { id: 11, points: [mBC2, B2, B3, mBC3] },
        { id: 11, points: [mBC2, C2, C3, mBC3] },
        { id: 11, points: [mCA2, C2, C3, mCA3] },

        // Region 12: Outer triangles
        { id: 12, points: [A3, mAB3, mCA3] },
        { id: 12, points: [B3, mBC3, mAB3] },
        { id: 12, points: [C3, mCA3, mBC3] },

        // Region 13: Outermost large triangles (the "spikes")
        { id: 13, points: [A3, A4, mCA3] },
        { id: 13, points: [A3, A4, mAB3] },
        { id: 13, points: [B3, B4, mAB3] },
        { id: 13, points: [B3, B4, mBC3] },
        { id: 13, points: [C3, C4, mBC3] },
        { id: 13, points: [C3, C4, mCA3] },
    ];

    return { regions, center, A, B, C, A4, B4, C4 };
}

// ── Stellation Diagram SVG Component ──────────────────────────────────────────

interface StellationDiagramProps {
    activeRegions: Set<number>;
    onToggleRegion: (regionId: number) => void;
    size?: number;
}

function StellationDiagram({ activeRegions, onToggleRegion, size = 350 }: StellationDiagramProps) {
    const padding = 20;
    const diagramSize = size - padding * 2;
    const cx = size / 2;
    const cy = size / 2;
    const triangleSize = diagramSize * 0.28;

    const { regions } = useMemo(
        () => generateStellationGeometry(triangleSize, cx, cy),
        [triangleSize, cx, cy]
    );

    const handleClick = useCallback((e: React.MouseEvent<SVGPolygonElement>, regionId: number) => {
        e.stopPropagation();
        onToggleRegion(regionId);
    }, [onToggleRegion]);

    return (
        <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="border border-slate-200 rounded-lg bg-white"
        >
            {/* Render all region polygons */}
            {regions.map((region, idx) => {
                const isActive = activeRegions.has(region.id);
                const pointsStr = region.points.map(p => `${p.x},${p.y}`).join(" ");

                return (
                    <polygon
                        key={idx}
                        points={pointsStr}
                        fill={isActive ? REGION_COLORS[region.id] : "#f8fafc"}
                        stroke="#334155"
                        strokeWidth={1}
                        className="cursor-pointer transition-all duration-150 hover:opacity-80"
                        onClick={(e) => handleClick(e, region.id)}
                    />
                );
            })}

            {/* Region labels */}
            {Array.from(new Set(regions.map(r => r.id))).map(id => {
                // Find center of first region with this id for label placement
                const region = regions.find(r => r.id === id);
                if (!region) return null;

                const labelX = region.points.reduce((sum, p) => sum + p.x, 0) / region.points.length;
                const labelY = region.points.reduce((sum, p) => sum + p.y, 0) / region.points.length;

                return (
                    <text
                        key={`label-${id}`}
                        x={labelX}
                        y={labelY}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize={10}
                        fontWeight="bold"
                        fill={activeRegions.has(id) ? "#fff" : "#64748b"}
                        className="pointer-events-none select-none"
                        style={{ textShadow: activeRegions.has(id) ? "0 1px 2px rgba(0,0,0,0.5)" : "none" }}
                    >
                        {id}
                    </text>
                );
            })}
        </svg>
    );
}

// ── 3D Stellation Geometry ────────────────────────────────────────────────────
// Generate actual 3D stellated geometry based on active regions

interface StellatedIcosahedronProps {
    activeRegions: Set<number>;
}

function StellatedIcosahedron({ activeRegions }: StellatedIcosahedronProps) {
    const meshRef = useRef<THREE.Group>(null);

    // Icosahedron base vertices (normalized, scaled by 2)
    const baseVertices = useMemo(() => {
        const phi = (1 + Math.sqrt(5)) / 2;
        return [
            new THREE.Vector3(-1, phi, 0).normalize().multiplyScalar(2),
            new THREE.Vector3(1, phi, 0).normalize().multiplyScalar(2),
            new THREE.Vector3(-1, -phi, 0).normalize().multiplyScalar(2),
            new THREE.Vector3(1, -phi, 0).normalize().multiplyScalar(2),
            new THREE.Vector3(0, -1, phi).normalize().multiplyScalar(2),
            new THREE.Vector3(0, 1, phi).normalize().multiplyScalar(2),
            new THREE.Vector3(0, -1, -phi).normalize().multiplyScalar(2),
            new THREE.Vector3(0, 1, -phi).normalize().multiplyScalar(2),
            new THREE.Vector3(phi, 0, -1).normalize().multiplyScalar(2),
            new THREE.Vector3(phi, 0, 1).normalize().multiplyScalar(2),
            new THREE.Vector3(-phi, 0, -1).normalize().multiplyScalar(2),
            new THREE.Vector3(-phi, 0, 1).normalize().multiplyScalar(2),
        ];
    }, []);

    // 20 faces of icosahedron (vertex indices)
    const faceIndices = useMemo(() => [
        [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
        [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
        [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
        [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
    ], []);

    // Generate 3D stellation cells for each face
    const stellationGeometry = useMemo(() => {
        const geometries: { geometry: THREE.BufferGeometry; regionId: number }[] = [];

        faceIndices.forEach((face) => {
            const A = baseVertices[face[0]].clone();
            const B = baseVertices[face[1]].clone();
            const C = baseVertices[face[2]].clone();

            // Face center
            const center = new THREE.Vector3().addVectors(A, B).add(C).divideScalar(3);

            // Midpoints
            const mAB = new THREE.Vector3().addVectors(A, B).divideScalar(2);
            const mBC = new THREE.Vector3().addVectors(B, C).divideScalar(2);
            const mCA = new THREE.Vector3().addVectors(C, A).divideScalar(2);

            // Extension function - extends point from face center along face plane
            const extendOnPlane = (p: THREE.Vector3, scale: number): THREE.Vector3 => {
                const dir = new THREE.Vector3().subVectors(p, center);
                return center.clone().add(dir.multiplyScalar(scale));
            };

            // Extended vertices
            const A2 = extendOnPlane(A, 2.0);
            const B2 = extendOnPlane(B, 2.0);
            const C2 = extendOnPlane(C, 2.0);
            const A3 = extendOnPlane(A, 3.0);
            const B3 = extendOnPlane(B, 3.0);
            const C3 = extendOnPlane(C, 3.0);
            const A4 = extendOnPlane(A, 4.5);
            const B4 = extendOnPlane(B, 4.5);
            const C4 = extendOnPlane(C, 4.5);

            const mAB2 = extendOnPlane(mAB, 2.0);
            const mBC2 = extendOnPlane(mBC, 2.0);
            const mCA2 = extendOnPlane(mCA, 2.0);
            const mAB3 = extendOnPlane(mAB, 3.0);
            const mBC3 = extendOnPlane(mBC, 3.0);
            const mCA3 = extendOnPlane(mCA, 3.0);

            // Helper to create triangle geometry
            const createTriangle = (p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3): THREE.BufferGeometry => {
                const geom = new THREE.BufferGeometry();
                const positions = new Float32Array([
                    p1.x, p1.y, p1.z,
                    p2.x, p2.y, p2.z,
                    p3.x, p3.y, p3.z,
                ]);
                geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
                geom.computeVertexNormals();
                return geom;
            };

            // Helper to create quad geometry (two triangles)
            const createQuad = (p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3, p4: THREE.Vector3): THREE.BufferGeometry => {
                const geom = new THREE.BufferGeometry();
                const positions = new Float32Array([
                    p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, p3.x, p3.y, p3.z,
                    p1.x, p1.y, p1.z, p3.x, p3.y, p3.z, p4.x, p4.y, p4.z,
                ]);
                geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
                geom.computeVertexNormals();
                return geom;
            };

            // Region 0: Center triangles (the basic icosahedron face)
            geometries.push({ geometry: createTriangle(center, mAB, mCA), regionId: 0 });
            geometries.push({ geometry: createTriangle(center, mBC, mAB), regionId: 0 });
            geometries.push({ geometry: createTriangle(center, mCA, mBC), regionId: 0 });

            // Region 1, 2, 3: Corner triangles of the basic face
            geometries.push({ geometry: createTriangle(A, mAB, mCA), regionId: 1 });
            geometries.push({ geometry: createTriangle(B, mBC, mAB), regionId: 2 });
            geometries.push({ geometry: createTriangle(C, mCA, mBC), regionId: 3 });

            // Regions 4-9: First layer of stellation (kite shapes)
            geometries.push({ geometry: createQuad(mAB, A, A2, mAB2), regionId: 4 });
            geometries.push({ geometry: createQuad(mCA, A, A2, mCA2), regionId: 5 });
            geometries.push({ geometry: createQuad(mAB, B, B2, mAB2), regionId: 6 });
            geometries.push({ geometry: createQuad(mBC, B, B2, mBC2), regionId: 7 });
            geometries.push({ geometry: createQuad(mBC, C, C2, mBC2), regionId: 8 });
            geometries.push({ geometry: createQuad(mCA, C, C2, mCA2), regionId: 9 });

            // Region 10: Second layer triangles
            geometries.push({ geometry: createTriangle(A2, mAB2, mCA2), regionId: 10 });
            geometries.push({ geometry: createTriangle(B2, mBC2, mAB2), regionId: 10 });
            geometries.push({ geometry: createTriangle(C2, mCA2, mBC2), regionId: 10 });

            // Region 11: Second layer kites
            geometries.push({ geometry: createQuad(mAB2, A2, A3, mAB3), regionId: 11 });
            geometries.push({ geometry: createQuad(mCA2, A2, A3, mCA3), regionId: 11 });
            geometries.push({ geometry: createQuad(mAB2, B2, B3, mAB3), regionId: 11 });
            geometries.push({ geometry: createQuad(mBC2, B2, B3, mBC3), regionId: 11 });
            geometries.push({ geometry: createQuad(mBC2, C2, C3, mBC3), regionId: 11 });
            geometries.push({ geometry: createQuad(mCA2, C2, C3, mCA3), regionId: 11 });

            // Region 12: Third layer triangles
            geometries.push({ geometry: createTriangle(A3, mAB3, mCA3), regionId: 12 });
            geometries.push({ geometry: createTriangle(B3, mBC3, mAB3), regionId: 12 });
            geometries.push({ geometry: createTriangle(C3, mCA3, mBC3), regionId: 12 });

            // Region 13: Outermost spikes
            geometries.push({ geometry: createTriangle(A3, A4, mCA3), regionId: 13 });
            geometries.push({ geometry: createTriangle(A3, A4, mAB3), regionId: 13 });
            geometries.push({ geometry: createTriangle(B3, B4, mAB3), regionId: 13 });
            geometries.push({ geometry: createTriangle(B3, B4, mBC3), regionId: 13 });
            geometries.push({ geometry: createTriangle(C3, C4, mBC3), regionId: 13 });
            geometries.push({ geometry: createTriangle(C3, C4, mCA3), regionId: 13 });
        });

        return geometries;
    }, [baseVertices, faceIndices]);

    // Filter to only active regions
    const activeGeometries = useMemo(() => {
        return stellationGeometry.filter(g => activeRegions.has(g.regionId));
    }, [stellationGeometry, activeRegions]);

    // Auto-rotation
    useFrame((_, delta) => {
        if (meshRef.current) {
            meshRef.current.rotation.y += delta * 0.3;
            meshRef.current.rotation.x += delta * 0.1;
        }
    });

    return (
        <group ref={meshRef}>
            {activeGeometries.map((item, i) => (
                <mesh key={i} geometry={item.geometry}>
                    <meshStandardMaterial
                        color={REGION_COLORS[item.regionId]}
                        side={THREE.DoubleSide}
                        roughness={0.4}
                        metalness={0.1}
                    />
                </mesh>
            ))}
            {/* Wireframe of basic icosahedron for reference */}
            <mesh>
                <icosahedronGeometry args={[2, 0]} />
                <meshBasicMaterial
                    color="#334155"
                    wireframe
                    transparent
                    opacity={0.2}
                />
            </mesh>
        </group>
    );
}

// ── Main Explorer Component ───────────────────────────────────────────────────

export interface IcosahedraExplorerProps {
    height?: number;
    className?: string;
}

export function IcosahedraExplorer({ height = 450, className = "" }: IcosahedraExplorerProps) {
    // Start with region 0 active (the basic icosahedron)
    const [activeRegions, setActiveRegions] = useState<Set<number>>(() => new Set([0]));

    const handleToggleRegion = useCallback((regionId: number) => {
        setActiveRegions(prev => {
            const next = new Set(prev);
            if (next.has(regionId)) {
                next.delete(regionId);
            } else {
                next.add(regionId);
            }
            return next;
        });
    }, []);

    // Preset buttons for common stellations
    const presets = [
        { label: "Clear All", regions: [] },
        { label: "Icosahedron", regions: [0, 1, 2, 3] },
        { label: "First Stellation", regions: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
        { label: "Great Icosahedron", regions: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] },
    ];

    return (
        <div className={`flex flex-col lg:flex-row gap-6 items-start ${className}`}>
            {/* 2D Stellation Diagram */}
            <div className="flex flex-col gap-3">
                <div className="text-sm font-medium text-slate-600">Click regions to toggle</div>
                <StellationDiagram
                    activeRegions={activeRegions}
                    onToggleRegion={handleToggleRegion}
                    size={350}
                />
                <div className="flex flex-wrap gap-2">
                    {presets.map(preset => (
                        <button
                            key={preset.label}
                            onClick={() => setActiveRegions(new Set(preset.regions))}
                            className="px-3 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded-md text-slate-700 transition-colors"
                        >
                            {preset.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* 3D Stellated Icosahedron View */}
            <div className="flex flex-col gap-2 flex-1 min-w-[350px]">
                <div className="text-sm font-medium text-slate-600">3D View (drag to rotate)</div>
                <div
                    className="rounded-lg overflow-hidden border border-slate-200 bg-gradient-to-b from-slate-50 to-slate-100"
                    style={{ height, width: "100%" }}
                >
                    <Canvas dpr={[1, 2]}>
                        <PerspectiveCamera makeDefault position={[0, 0, 8]} fov={50} />
                        <Suspense fallback={null}>
                            <ambientLight intensity={0.6} />
                            <directionalLight position={[5, 5, 5]} intensity={0.8} />
                            <directionalLight position={[-3, -3, -3]} intensity={0.3} />
                            <StellatedIcosahedron activeRegions={activeRegions} />
                        </Suspense>
                        <OrbitControls
                            makeDefault
                            enableDamping
                            dampingFactor={0.1}
                            enablePan={false}
                            minDistance={4}
                            maxDistance={20}
                        />
                    </Canvas>
                </div>
            </div>
        </div>
    );
}

export default IcosahedraExplorer;
