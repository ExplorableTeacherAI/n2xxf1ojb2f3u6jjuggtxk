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
// The stellation diagram is created by the 18 lines where other icosahedron face planes
// intersect with one triangular face plane. This creates a specific pattern of cells.
// Reference: "The Fifty-Nine Icosahedra" by Coxeter, Du Val, Flather, and Petrie
function generateStellationGeometry(size: number, cx: number, cy: number) {
    const h = size * Math.sqrt(3) / 2;
    const phi = (1 + Math.sqrt(5)) / 2; // Golden ratio ≈ 1.618

    // Main triangle vertices - pointing DOWN (flat edge at top)
    // A = top-left, B = top-right, C = bottom center
    const A: Point = { x: cx - size / 2, y: cy - h / 3 };
    const B: Point = { x: cx + size / 2, y: cy - h / 3 };
    const C: Point = { x: cx, y: cy + 2 * h / 3 };

    // The stellation diagram is formed by extending lines through each edge
    // The key distances are based on the golden ratio
    // The icosahedron's face planes intersect at specific angles creating
    // a pattern with distances proportional to 1, φ, φ², φ³

    // Helper: Linear interpolation between two points
    const lerp = (p1: Point, p2: Point, t: number): Point => ({
        x: p1.x + (p2.x - p1.x) * t,
        y: p1.y + (p2.y - p1.y) * t
    });

    // Center of triangle
    const center: Point = { x: (A.x + B.x + C.x) / 3, y: (A.y + B.y + C.y) / 3 };

    // The stellation diagram has lines parallel to each edge at specific distances
    // For the icosahedron, the key ratios are: 1, φ, φ², φ³
    // These create the characteristic nested triangular pattern

    // Vertices extended outward from center (for the spike tips)
    const extendFromCenter = (p: Point, scale: number): Point => ({
        x: center.x + (p.x - center.x) * scale,
        y: center.y + (p.y - center.y) * scale
    });

    // The classic stellation diagram has concentric "shells" of triangles
    // Shell 1: The original triangle (region 0)
    // Shell 2: First stellation layer at distance φ
    // Shell 3: Second layer at distance φ²
    // Shell 4: Third layer at distance φ³ (outermost spikes)

    // Extended vertex positions for each shell
    const A1 = A, B1 = B, C1 = C;
    const A2 = extendFromCenter(A, phi);
    const B2 = extendFromCenter(B, phi);
    const C2 = extendFromCenter(C, phi);
    const A3 = extendFromCenter(A, phi * phi);
    const B3 = extendFromCenter(B, phi * phi);
    const C3 = extendFromCenter(C, phi * phi);
    const A4 = extendFromCenter(A, phi * phi * phi);
    const B4 = extendFromCenter(B, phi * phi * phi);
    const C4 = extendFromCenter(C, phi * phi * phi);

    // Edge midpoints for each shell
    const mAB1 = lerp(A1, B1, 0.5);
    const mBC1 = lerp(B1, C1, 0.5);
    const mCA1 = lerp(C1, A1, 0.5);

    const mAB2 = extendFromCenter(mAB1, phi);
    const mBC2 = extendFromCenter(mBC1, phi);
    const mCA2 = extendFromCenter(mCA1, phi);

    const mAB3 = extendFromCenter(mAB1, phi * phi);
    const mBC3 = extendFromCenter(mBC1, phi * phi);
    const mCA3 = extendFromCenter(mCA1, phi * phi);

    // Build the 14 region types (0-13) of the stellation diagram
    // Each region maintains 3-fold symmetry around the center
    const regions: { id: number; points: Point[] }[] = [
        // ═══════════════════════════════════════════════════════════════════
        // REGION 0: The central triangle (original icosahedron face)
        // ═══════════════════════════════════════════════════════════════════
        { id: 0, points: [A1, B1, C1] },

        // ═══════════════════════════════════════════════════════════════════
        // REGIONS 1, 2, 3: Three kite-shaped cells adjacent to each vertex
        // These extend from the triangle corners toward the first shell
        // ═══════════════════════════════════════════════════════════════════
        // At vertex A (top-left)
        { id: 1, points: [A1, mAB2, A2, mCA2] },
        // At vertex B (top-right)
        { id: 2, points: [B1, mBC2, B2, mAB2] },
        // At vertex C (bottom)
        { id: 3, points: [C1, mCA2, C2, mBC2] },

        // ═══════════════════════════════════════════════════════════════════
        // REGIONS 4, 5, 6: Triangular cells at edge midpoints (first shell)
        // ═══════════════════════════════════════════════════════════════════
        // At edge AB midpoint - two triangles
        { id: 4, points: [mAB1, A2, mAB2] },
        { id: 4, points: [mAB1, B2, mAB2] },
        // At edge BC midpoint - two triangles
        { id: 5, points: [mBC1, B2, mBC2] },
        { id: 5, points: [mBC1, C2, mBC2] },
        // At edge CA midpoint - two triangles
        { id: 6, points: [mCA1, C2, mCA2] },
        { id: 6, points: [mCA1, A2, mCA2] },

        // ═══════════════════════════════════════════════════════════════════
        // REGION 7: Three triangular cells at the outer vertices of shell 2
        // ═══════════════════════════════════════════════════════════════════
        { id: 7, points: [A2, mAB2, mCA2] },
        { id: 7, points: [B2, mBC2, mAB2] },
        { id: 7, points: [C2, mCA2, mBC2] },

        // ═══════════════════════════════════════════════════════════════════
        // REGIONS 8, 9, 10: Kite cells extending from shell 2 to shell 3
        // ═══════════════════════════════════════════════════════════════════
        // From A2 vertex
        { id: 8, points: [A2, mAB3, A3, mCA3] },
        // From B2 vertex
        { id: 9, points: [B2, mBC3, B3, mAB3] },
        // From C2 vertex
        { id: 10, points: [C2, mCA3, C3, mBC3] },

        // ═══════════════════════════════════════════════════════════════════
        // REGION 11: Triangular cells at shell 2 midpoints extending to shell 3
        // ═══════════════════════════════════════════════════════════════════
        { id: 11, points: [mAB2, A3, mAB3] },
        { id: 11, points: [mAB2, B3, mAB3] },
        { id: 11, points: [mBC2, B3, mBC3] },
        { id: 11, points: [mBC2, C3, mBC3] },
        { id: 11, points: [mCA2, C3, mCA3] },
        { id: 11, points: [mCA2, A3, mCA3] },

        // ═══════════════════════════════════════════════════════════════════
        // REGION 12: Three triangular cells at shell 3 vertices
        // ═══════════════════════════════════════════════════════════════════
        { id: 12, points: [A3, mAB3, mCA3] },
        { id: 12, points: [B3, mBC3, mAB3] },
        { id: 12, points: [C3, mCA3, mBC3] },

        // ═══════════════════════════════════════════════════════════════════
        // REGION 13: Outermost spike triangles (shell 3 to shell 4)
        // ═══════════════════════════════════════════════════════════════════
        { id: 13, points: [A3, A4, mAB3] },
        { id: 13, points: [A3, A4, mCA3] },
        { id: 13, points: [B3, B4, mBC3] },
        { id: 13, points: [B3, B4, mAB3] },
        { id: 13, points: [C3, C4, mCA3] },
        { id: 13, points: [C3, C4, mBC3] },
    ];

    return { regions, center, A: A1, B: B1, C: C1, A4, B4, C4 };
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

        // Scale factors matching the 2D diagram (based on golden ratio)
        const s2 = phi;                  // First shell
        const s3 = phi * phi;            // Second shell
        const s4 = phi * phi * phi;      // Third shell (outermost spikes)

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

            // Extended vertices at each shell
            const A2 = extendOnPlane(A, s2);
            const B2 = extendOnPlane(B, s2);
            const C2 = extendOnPlane(C, s2);

            const A3 = extendOnPlane(A, s3);
            const B3 = extendOnPlane(B, s3);
            const C3 = extendOnPlane(C, s3);

            const A4 = extendOnPlane(A, s4);
            const B4 = extendOnPlane(B, s4);
            const C4 = extendOnPlane(C, s4);

            // Extended midpoints
            const mAB2 = extendOnPlane(mAB, s2);
            const mBC2 = extendOnPlane(mBC, s2);
            const mCA2 = extendOnPlane(mCA, s2);

            const mAB3 = extendOnPlane(mAB, s3);
            const mBC3 = extendOnPlane(mBC, s3);
            const mCA3 = extendOnPlane(mCA, s3);

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
            geometries.push({ geometry: createTriangle(A, B, C), regionId: 0 });

            // Regions 1, 2, 3: First shell kite shapes at each vertex
            geometries.push({ geometry: createQuad(A, mAB2, A2, mCA2), regionId: 1 });
            geometries.push({ geometry: createQuad(B, mBC2, B2, mAB2), regionId: 2 });
            geometries.push({ geometry: createQuad(C, mCA2, C2, mBC2), regionId: 3 });

            // Regions 4, 5, 6: Triangles at edge midpoints
            geometries.push({ geometry: createTriangle(mAB, A2, mAB2), regionId: 4 });
            geometries.push({ geometry: createTriangle(mAB, B2, mAB2), regionId: 4 });
            geometries.push({ geometry: createTriangle(mBC, B2, mBC2), regionId: 5 });
            geometries.push({ geometry: createTriangle(mBC, C2, mBC2), regionId: 5 });
            geometries.push({ geometry: createTriangle(mCA, C2, mCA2), regionId: 6 });
            geometries.push({ geometry: createTriangle(mCA, A2, mCA2), regionId: 6 });

            // Region 7: Triangles at shell 2 vertices
            geometries.push({ geometry: createTriangle(A2, mAB2, mCA2), regionId: 7 });
            geometries.push({ geometry: createTriangle(B2, mBC2, mAB2), regionId: 7 });
            geometries.push({ geometry: createTriangle(C2, mCA2, mBC2), regionId: 7 });

            // Regions 8, 9, 10: Kite shapes from shell 2 to shell 3
            geometries.push({ geometry: createQuad(A2, mAB3, A3, mCA3), regionId: 8 });
            geometries.push({ geometry: createQuad(B2, mBC3, B3, mAB3), regionId: 9 });
            geometries.push({ geometry: createQuad(C2, mCA3, C3, mBC3), regionId: 10 });

            // Region 11: Triangles at shell 2 midpoints
            geometries.push({ geometry: createTriangle(mAB2, A3, mAB3), regionId: 11 });
            geometries.push({ geometry: createTriangle(mAB2, B3, mAB3), regionId: 11 });
            geometries.push({ geometry: createTriangle(mBC2, B3, mBC3), regionId: 11 });
            geometries.push({ geometry: createTriangle(mBC2, C3, mBC3), regionId: 11 });
            geometries.push({ geometry: createTriangle(mCA2, C3, mCA3), regionId: 11 });
            geometries.push({ geometry: createTriangle(mCA2, A3, mCA3), regionId: 11 });

            // Region 12: Triangles at shell 3 vertices
            geometries.push({ geometry: createTriangle(A3, mAB3, mCA3), regionId: 12 });
            geometries.push({ geometry: createTriangle(B3, mBC3, mAB3), regionId: 12 });
            geometries.push({ geometry: createTriangle(C3, mCA3, mBC3), regionId: 12 });

            // Region 13: Outermost spike triangles
            geometries.push({ geometry: createTriangle(A3, A4, mAB3), regionId: 13 });
            geometries.push({ geometry: createTriangle(A3, A4, mCA3), regionId: 13 });
            geometries.push({ geometry: createTriangle(B3, B4, mBC3), regionId: 13 });
            geometries.push({ geometry: createTriangle(B3, B4, mAB3), regionId: 13 });
            geometries.push({ geometry: createTriangle(C3, C4, mCA3), regionId: 13 });
            geometries.push({ geometry: createTriangle(C3, C4, mBC3), regionId: 13 });
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
