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
// Based on the classic diagram from "The Fifty-Nine Icosahedra" by Coxeter et al.

interface Point {
    x: number;
    y: number;
}

// Generate the stellation diagram matching the classic icosahedral pattern
// The diagram has a central triangle with regions numbered 0-13 extending outward
function generateStellationGeometry(size: number, cx: number, cy: number) {
    const h = size * Math.sqrt(3) / 2;

    // Main triangle vertices - pointing DOWN (flat edge at top)
    // This matches the reference image orientation
    const T: Point = { x: cx - size / 2, y: cy - h / 3 };  // Top-left
    const U: Point = { x: cx + size / 2, y: cy - h / 3 };  // Top-right
    const V: Point = { x: cx, y: cy + 2 * h / 3 };         // Bottom center

    // The stellation pattern is created by extending lines through each vertex
    // parallel to the opposite edge, creating a grid of cells.
    // For icosahedron stellation, the key ratios are based on the golden ratio φ.
    const phi = (1 + Math.sqrt(5)) / 2;

    // Midpoints of original edges
    const mTU: Point = { x: (T.x + U.x) / 2, y: (T.y + U.y) / 2 };
    const mUV: Point = { x: (U.x + V.x) / 2, y: (U.y + V.y) / 2 };
    const mVT: Point = { x: (V.x + T.x) / 2, y: (V.y + T.y) / 2 };

    // Center of triangle
    const center: Point = { x: (T.x + U.x + V.x) / 3, y: (T.y + U.y + V.y) / 3 };

    // Extended vertices (tips of the outer spikes)
    // These are found by extending from center through each vertex
    const extendFromCenter = (p: Point, scale: number): Point => ({
        x: center.x + (p.x - center.x) * scale,
        y: center.y + (p.y - center.y) * scale
    });

    // Key scale factors for icosahedral stellation
    // Based on golden ratio relationships
    const s2 = phi;   // First stellation (small triakis)
    const s3 = phi * phi;  // Second stellation
    const s4 = phi * phi + phi; // Outer spikes

    // Extended vertices at each shell
    const T2 = extendFromCenter(T, s2);
    const U2 = extendFromCenter(U, s2);
    const V2 = extendFromCenter(V, s2);

    const T3 = extendFromCenter(T, s3);
    const U3 = extendFromCenter(U, s3);
    const V3 = extendFromCenter(V, s3);

    const T4 = extendFromCenter(T, s4);
    const U4 = extendFromCenter(U, s4);
    const V4 = extendFromCenter(V, s4);

    // Extended midpoints at each shell
    const mTU2 = extendFromCenter(mTU, s2);
    const mUV2 = extendFromCenter(mUV, s2);
    const mVT2 = extendFromCenter(mVT, s2);

    const mTU3 = extendFromCenter(mTU, s3);
    const mUV3 = extendFromCenter(mUV, s3);
    const mVT3 = extendFromCenter(mVT, s3);

    // Build the regions matching the classic diagram layout
    // Region 0: Central small triangle (darkest)
    // Regions 1-3: Three cells around the center
    // Regions 4-9: Next ring
    // etc.

    const regions: { id: number; points: Point[] }[] = [
        // Region 0: The innermost central region
        { id: 0, points: [T, U, V] },

        // Regions 1, 2, 3: The three corners extending from original triangle
        { id: 1, points: [T, T2, mTU2, mTU] },
        { id: 1, points: [T, T2, mVT2, mVT] },
        { id: 2, points: [U, U2, mTU2, mTU] },
        { id: 2, points: [U, U2, mUV2, mUV] },
        { id: 3, points: [V, V2, mUV2, mUV] },
        { id: 3, points: [V, V2, mVT2, mVT] },

        // Regions 4, 5, 6: Triangles at the midpoint extensions
        { id: 4, points: [mTU, mTU2, T2] },
        { id: 4, points: [mTU, mTU2, U2] },
        { id: 5, points: [mUV, mUV2, U2] },
        { id: 5, points: [mUV, mUV2, V2] },
        { id: 6, points: [mVT, mVT2, V2] },
        { id: 6, points: [mVT, mVT2, T2] },

        // Region 7: The second shell triangles at vertices
        { id: 7, points: [T2, mTU2, mVT2] },
        { id: 7, points: [U2, mTU2, mUV2] },
        { id: 7, points: [V2, mUV2, mVT2] },

        // Regions 8, 9, 10: Kite shapes in second shell
        { id: 8, points: [T2, T3, mTU3, mTU2] },
        { id: 8, points: [T2, T3, mVT3, mVT2] },
        { id: 9, points: [U2, U3, mTU3, mTU2] },
        { id: 9, points: [U2, U3, mUV3, mUV2] },
        { id: 10, points: [V2, V3, mUV3, mUV2] },
        { id: 10, points: [V2, V3, mVT3, mVT2] },

        // Region 11: Triangles connecting the kites
        { id: 11, points: [mTU2, mTU3, T3] },
        { id: 11, points: [mTU2, mTU3, U3] },
        { id: 11, points: [mUV2, mUV3, U3] },
        { id: 11, points: [mUV2, mUV3, V3] },
        { id: 11, points: [mVT2, mVT3, V3] },
        { id: 11, points: [mVT2, mVT3, T3] },

        // Region 12: Third shell vertex triangles
        { id: 12, points: [T3, mTU3, mVT3] },
        { id: 12, points: [U3, mTU3, mUV3] },
        { id: 12, points: [V3, mUV3, mVT3] },

        // Region 13: Outermost spike triangles
        { id: 13, points: [T3, T4, mTU3] },
        { id: 13, points: [T3, T4, mVT3] },
        { id: 13, points: [U3, U4, mTU3] },
        { id: 13, points: [U3, U4, mUV3] },
        { id: 13, points: [V3, V4, mUV3] },
        { id: 13, points: [V3, V4, mVT3] },
    ];

    return { regions, center, T, U, V, T4, U4, V4 };
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
        const phi = (1 + Math.sqrt(5)) / 2;

        // Scale factors matching the 2D diagram
        const s1 = 1.0;
        const s2 = phi;
        const s3 = phi * phi;
        const s4 = phi * phi + phi;

        faceIndices.forEach((face) => {
            const T = baseVertices[face[0]].clone();
            const U = baseVertices[face[1]].clone();
            const V = baseVertices[face[2]].clone();

            // Face center
            const center = new THREE.Vector3().addVectors(T, U).add(V).divideScalar(3);

            // Midpoints
            const mTU = new THREE.Vector3().addVectors(T, U).divideScalar(2);
            const mUV = new THREE.Vector3().addVectors(U, V).divideScalar(2);
            const mVT = new THREE.Vector3().addVectors(V, T).divideScalar(2);

            // Extension function - extends point from face center along face plane
            const extendOnPlane = (p: THREE.Vector3, scale: number): THREE.Vector3 => {
                const dir = new THREE.Vector3().subVectors(p, center);
                return center.clone().add(dir.multiplyScalar(scale));
            };

            // Extended vertices at each shell
            const T2 = extendOnPlane(T, s2);
            const U2 = extendOnPlane(U, s2);
            const V2 = extendOnPlane(V, s2);

            const T3 = extendOnPlane(T, s3);
            const U3 = extendOnPlane(U, s3);
            const V3 = extendOnPlane(V, s3);

            const T4 = extendOnPlane(T, s4);
            const U4 = extendOnPlane(U, s4);
            const V4 = extendOnPlane(V, s4);

            // Extended midpoints
            const mTU2 = extendOnPlane(mTU, s2);
            const mUV2 = extendOnPlane(mUV, s2);
            const mVT2 = extendOnPlane(mVT, s2);

            const mTU3 = extendOnPlane(mTU, s3);
            const mUV3 = extendOnPlane(mUV, s3);
            const mVT3 = extendOnPlane(mVT, s3);

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

            // Region 0: The base icosahedron face
            geometries.push({ geometry: createTriangle(T, U, V), regionId: 0 });

            // Regions 1, 2, 3: First shell kites from each vertex
            geometries.push({ geometry: createQuad(T, T2, mTU2, mTU), regionId: 1 });
            geometries.push({ geometry: createQuad(T, T2, mVT2, mVT), regionId: 1 });
            geometries.push({ geometry: createQuad(U, U2, mTU2, mTU), regionId: 2 });
            geometries.push({ geometry: createQuad(U, U2, mUV2, mUV), regionId: 2 });
            geometries.push({ geometry: createQuad(V, V2, mUV2, mUV), regionId: 3 });
            geometries.push({ geometry: createQuad(V, V2, mVT2, mVT), regionId: 3 });

            // Regions 4, 5, 6: Triangles at midpoint extensions
            geometries.push({ geometry: createTriangle(mTU, mTU2, T2), regionId: 4 });
            geometries.push({ geometry: createTriangle(mTU, mTU2, U2), regionId: 4 });
            geometries.push({ geometry: createTriangle(mUV, mUV2, U2), regionId: 5 });
            geometries.push({ geometry: createTriangle(mUV, mUV2, V2), regionId: 5 });
            geometries.push({ geometry: createTriangle(mVT, mVT2, V2), regionId: 6 });
            geometries.push({ geometry: createTriangle(mVT, mVT2, T2), regionId: 6 });

            // Region 7: Second shell vertex triangles
            geometries.push({ geometry: createTriangle(T2, mTU2, mVT2), regionId: 7 });
            geometries.push({ geometry: createTriangle(U2, mTU2, mUV2), regionId: 7 });
            geometries.push({ geometry: createTriangle(V2, mUV2, mVT2), regionId: 7 });

            // Regions 8, 9, 10: Second shell kites
            geometries.push({ geometry: createQuad(T2, T3, mTU3, mTU2), regionId: 8 });
            geometries.push({ geometry: createQuad(T2, T3, mVT3, mVT2), regionId: 8 });
            geometries.push({ geometry: createQuad(U2, U3, mTU3, mTU2), regionId: 9 });
            geometries.push({ geometry: createQuad(U2, U3, mUV3, mUV2), regionId: 9 });
            geometries.push({ geometry: createQuad(V2, V3, mUV3, mUV2), regionId: 10 });
            geometries.push({ geometry: createQuad(V2, V3, mVT3, mVT2), regionId: 10 });

            // Region 11: Triangles connecting kites
            geometries.push({ geometry: createTriangle(mTU2, mTU3, T3), regionId: 11 });
            geometries.push({ geometry: createTriangle(mTU2, mTU3, U3), regionId: 11 });
            geometries.push({ geometry: createTriangle(mUV2, mUV3, U3), regionId: 11 });
            geometries.push({ geometry: createTriangle(mUV2, mUV3, V3), regionId: 11 });
            geometries.push({ geometry: createTriangle(mVT2, mVT3, V3), regionId: 11 });
            geometries.push({ geometry: createTriangle(mVT2, mVT3, T3), regionId: 11 });

            // Region 12: Third shell vertex triangles
            geometries.push({ geometry: createTriangle(T3, mTU3, mVT3), regionId: 12 });
            geometries.push({ geometry: createTriangle(U3, mTU3, mUV3), regionId: 12 });
            geometries.push({ geometry: createTriangle(V3, mUV3, mVT3), regionId: 12 });

            // Region 13: Outermost spikes
            geometries.push({ geometry: createTriangle(T3, T4, mTU3), regionId: 13 });
            geometries.push({ geometry: createTriangle(T3, T4, mVT3), regionId: 13 });
            geometries.push({ geometry: createTriangle(U3, U4, mTU3), regionId: 13 });
            geometries.push({ geometry: createTriangle(U3, U4, mUV3), regionId: 13 });
            geometries.push({ geometry: createTriangle(V3, V4, mUV3), regionId: 13 });
            geometries.push({ geometry: createTriangle(V3, V4, mVT3), regionId: 13 });
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
        { label: "Icosahedron", regions: [0] },
        { label: "Small Triakis", regions: [0, 1, 2, 3] },
        { label: "Compound", regions: [0, 1, 2, 3, 4, 5, 6, 7] },
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
