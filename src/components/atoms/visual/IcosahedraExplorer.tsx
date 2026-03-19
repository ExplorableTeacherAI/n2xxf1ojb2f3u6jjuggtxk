import React, { useRef, useState, useCallback, useEffect, Suspense, useMemo } from "react";
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

// ── Texture Generation from Active Regions ────────────────────────────────────

function generateTextureFromRegions(activeRegions: Set<number>, canvasSize: number = 512): string {
    const canvas = document.createElement("canvas");
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    const cx = canvasSize / 2;
    const cy = canvasSize / 2;
    const triangleSize = canvasSize * 0.28;

    const { regions } = generateStellationGeometry(triangleSize, cx, cy);

    // Draw active regions
    regions.forEach(region => {
        if (activeRegions.has(region.id)) {
            ctx.beginPath();
            ctx.moveTo(region.points[0].x, region.points[0].y);
            for (let i = 1; i < region.points.length; i++) {
                ctx.lineTo(region.points[i].x, region.points[i].y);
            }
            ctx.closePath();
            ctx.fillStyle = REGION_COLORS[region.id];
            ctx.fill();
        }
    });

    // Draw all region outlines
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    regions.forEach(region => {
        ctx.beginPath();
        ctx.moveTo(region.points[0].x, region.points[0].y);
        for (let i = 1; i < region.points.length; i++) {
            ctx.lineTo(region.points[i].x, region.points[i].y);
        }
        ctx.closePath();
        ctx.stroke();
    });

    return canvas.toDataURL("image/png");
}

// ── Icosahedron with Textured Faces ───────────────────────────────────────────

interface IcosahedronMeshProps {
    textureDataUrl: string;
}

function IcosahedronMesh({ textureDataUrl }: IcosahedronMeshProps) {
    const meshRef = useRef<THREE.Group>(null);
    const materialsRef = useRef<THREE.MeshStandardMaterial[]>([]);
    const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
    const [textureVersion, setTextureVersion] = useState(0);

    // Create icosahedron vertices using the golden ratio
    const vertices = useMemo(() => {
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

    // 20 faces of icosahedron
    const faces = useMemo(() => [
        [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
        [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
        [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
        [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
    ], []);

    // Update texture when data URL changes
    useEffect(() => {
        if (!textureDataUrl) return;

        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = 512;
            canvas.height = 512;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            // Flip vertically for Three.js UV coordinates
            ctx.translate(0, 512);
            ctx.scale(1, -1);
            ctx.drawImage(img, 0, 0, 512, 512);

            const newTexture = new THREE.CanvasTexture(canvas);
            newTexture.wrapS = THREE.ClampToEdgeWrapping;
            newTexture.wrapT = THREE.ClampToEdgeWrapping;
            newTexture.needsUpdate = true;

            setTexture(newTexture);
            setTextureVersion(v => v + 1);

            materialsRef.current.forEach(mat => {
                mat.map = newTexture;
                mat.needsUpdate = true;
            });
        };
        img.src = textureDataUrl;
    }, [textureDataUrl]);

    // Create face geometries with UV mapping
    const faceGeometries = useMemo(() => {
        return faces.map((face) => {
            const geometry = new THREE.BufferGeometry();

            const v0 = vertices[face[0]];
            const v1 = vertices[face[1]];
            const v2 = vertices[face[2]];

            const positions = new Float32Array([
                v0.x, v0.y, v0.z,
                v1.x, v1.y, v1.z,
                v2.x, v2.y, v2.z,
            ]);

            // UV mapping to match the stellation diagram triangle
            // The diagram triangle is centered and pointing up
            const cx = 0.5;
            const cy = 0.5;
            const uvSize = 0.28;
            const uvH = uvSize * Math.sqrt(3) / 2;

            const uvs = new Float32Array([
                cx, cy + uvH * 2 / 3,           // top
                cx - uvSize / 2, cy - uvH / 3, // bottom left
                cx + uvSize / 2, cy - uvH / 3, // bottom right
            ]);

            geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
            geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
            geometry.computeVertexNormals();

            return geometry;
        });
    }, [faces, vertices]);

    // Auto-rotation
    useFrame((_, delta) => {
        if (meshRef.current) {
            meshRef.current.rotation.y += delta * 0.3;
            meshRef.current.rotation.x += delta * 0.1;
        }
    });

    const setMaterialRef = useCallback((index: number) => (mat: THREE.MeshStandardMaterial | null) => {
        if (mat) {
            materialsRef.current[index] = mat;
        }
    }, []);

    return (
        <group ref={meshRef}>
            {faceGeometries.map((geometry, i) => (
                <mesh key={`${i}-${textureVersion}`} geometry={geometry}>
                    <meshStandardMaterial
                        ref={setMaterialRef(i)}
                        map={texture}
                        side={THREE.DoubleSide}
                        roughness={0.4}
                        metalness={0.1}
                    />
                </mesh>
            ))}
            {/* Wireframe overlay */}
            <mesh>
                <icosahedronGeometry args={[2, 0]} />
                <meshBasicMaterial
                    color="#334155"
                    wireframe
                    transparent
                    opacity={0.3}
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
    const [textureDataUrl, setTextureDataUrl] = useState<string>("");

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

    // Generate texture whenever active regions change
    useEffect(() => {
        const dataUrl = generateTextureFromRegions(activeRegions);
        setTextureDataUrl(dataUrl);
    }, [activeRegions]);

    // Preset buttons for common stellations
    const presets = [
        { label: "Clear All", regions: [] },
        { label: "Icosahedron", regions: [0] },
        { label: "Small Triambic", regions: [0, 1, 2, 3] },
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

            {/* 3D Icosahedron View */}
            <div className="flex flex-col gap-2 flex-1 min-w-[350px]">
                <div className="text-sm font-medium text-slate-600">3D View (drag to rotate)</div>
                <div
                    className="rounded-lg overflow-hidden border border-slate-200 bg-gradient-to-b from-slate-50 to-slate-100"
                    style={{ height, width: "100%" }}
                >
                    <Canvas dpr={[1, 2]}>
                        <PerspectiveCamera makeDefault position={[0, 0, 6]} fov={50} />
                        <Suspense fallback={null}>
                            <ambientLight intensity={0.6} />
                            <directionalLight position={[5, 5, 5]} intensity={0.8} />
                            <directionalLight position={[-3, -3, -3]} intensity={0.3} />
                            <IcosahedronMesh textureDataUrl={textureDataUrl} />
                        </Suspense>
                        <OrbitControls
                            makeDefault
                            enableDamping
                            dampingFactor={0.1}
                            enablePan={false}
                            minDistance={4}
                            maxDistance={12}
                        />
                    </Canvas>
                </div>
            </div>
        </div>
    );
}

export default IcosahedraExplorer;
