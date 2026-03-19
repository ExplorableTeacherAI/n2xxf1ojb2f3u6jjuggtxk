import React, { useRef, useState, useCallback, useEffect, Suspense, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";

// ── Triangle Canvas (2D Drawing) ──────────────────────────────────────────────

interface TriangleCanvasProps {
    onTextureUpdate: (dataUrl: string) => void;
    width?: number;
    height?: number;
}

function TriangleCanvas({ onTextureUpdate, width = 400, height = 400 }: TriangleCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [strokeColor, setStrokeColor] = useState("#1e293b");
    const [strokeWidth, setStrokeWidth] = useState(3);
    const lastPosRef = useRef<{ x: number; y: number } | null>(null);

    // Triangle vertices for an equilateral triangle centered in the canvas
    const trianglePoints = useMemo(() => {
        const cx = width / 2;
        const cy = height / 2;
        const size = Math.min(width, height) * 0.42;
        const h = size * Math.sqrt(3) / 2;
        return {
            top: { x: cx, y: cy - h * 2 / 3 },
            bottomLeft: { x: cx - size / 2, y: cy + h / 3 },
            bottomRight: { x: cx + size / 2, y: cy + h / 3 },
        };
    }, [width, height]);

    // Check if a point is inside the triangle
    const isPointInTriangle = useCallback((px: number, py: number) => {
        const { top, bottomLeft, bottomRight } = trianglePoints;

        const sign = (p1x: number, p1y: number, p2x: number, p2y: number, p3x: number, p3y: number) => {
            return (p1x - p3x) * (p2y - p3y) - (p2x - p3x) * (p1y - p3y);
        };

        const d1 = sign(px, py, top.x, top.y, bottomLeft.x, bottomLeft.y);
        const d2 = sign(px, py, bottomLeft.x, bottomLeft.y, bottomRight.x, bottomRight.y);
        const d3 = sign(px, py, bottomRight.x, bottomRight.y, top.x, top.y);

        const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
        const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);

        return !(hasNeg && hasPos);
    }, [trianglePoints]);

    // Initialize canvas with triangle outline
    const initCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Clear and fill white
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);

        // Draw equilateral triangle outline
        const { top, bottomLeft, bottomRight } = trianglePoints;

        ctx.beginPath();
        ctx.moveTo(top.x, top.y);
        ctx.lineTo(bottomLeft.x, bottomLeft.y);
        ctx.lineTo(bottomRight.x, bottomRight.y);
        ctx.closePath();

        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Notify texture update
        onTextureUpdate(canvas.toDataURL("image/png"));
    }, [width, height, trianglePoints, onTextureUpdate]);

    useEffect(() => {
        initCanvas();
    }, [initCanvas]);

    const getCanvasCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return null;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        if ("touches" in e) {
            const touch = e.touches[0];
            return {
                x: (touch.clientX - rect.left) * scaleX,
                y: (touch.clientY - rect.top) * scaleY,
            };
        } else {
            return {
                x: (e.clientX - rect.left) * scaleX,
                y: (e.clientY - rect.top) * scaleY,
            };
        }
    }, []);

    const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        const coords = getCanvasCoords(e);
        if (!coords) return;

        if (isPointInTriangle(coords.x, coords.y)) {
            setIsDrawing(true);
            lastPosRef.current = coords;
        }
    }, [getCanvasCoords, isPointInTriangle]);

    const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;

        const coords = getCanvasCoords(e);
        if (!coords || !lastPosRef.current) return;

        // Only draw if current point is in triangle
        if (isPointInTriangle(coords.x, coords.y)) {
            ctx.beginPath();
            ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
            ctx.lineTo(coords.x, coords.y);
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = strokeWidth;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.stroke();

            lastPosRef.current = coords;
            onTextureUpdate(canvas.toDataURL("image/png"));
        } else {
            // If we exit the triangle, stop drawing
            setIsDrawing(false);
            lastPosRef.current = null;
        }
    }, [isDrawing, getCanvasCoords, isPointInTriangle, strokeColor, strokeWidth, onTextureUpdate]);

    const stopDrawing = useCallback(() => {
        setIsDrawing(false);
        lastPosRef.current = null;
    }, []);

    const clearCanvas = useCallback(() => {
        initCanvas();
    }, [initCanvas]);

    const colors = ["#1e293b", "#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899"];

    return (
        <div className="flex flex-col gap-3">
            <div className="relative rounded-lg overflow-hidden border border-slate-200 bg-white" style={{ width, height }}>
                <canvas
                    ref={canvasRef}
                    width={width}
                    height={height}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="cursor-crosshair touch-none"
                    style={{ width: "100%", height: "100%" }}
                />
            </div>
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex gap-1">
                    {colors.map((color) => (
                        <button
                            key={color}
                            onClick={() => setStrokeColor(color)}
                            className={`w-6 h-6 rounded-full border-2 transition-transform ${
                                strokeColor === color ? "border-slate-800 scale-110" : "border-transparent"
                            }`}
                            style={{ backgroundColor: color }}
                            title={`Color: ${color}`}
                        />
                    ))}
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Size:</span>
                    <input
                        type="range"
                        min={1}
                        max={12}
                        value={strokeWidth}
                        onChange={(e) => setStrokeWidth(Number(e.target.value))}
                        className="w-20 h-1 accent-slate-600"
                    />
                </div>
                <button
                    onClick={clearCanvas}
                    className="px-3 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded-md text-slate-700 transition-colors"
                >
                    Clear
                </button>
            </div>
        </div>
    );
}

// ── Icosahedron with Textured Faces ───────────────────────────────────────────

interface IcosahedronMeshProps {
    textureDataUrl: string;
}

function IcosahedronMesh({ textureDataUrl }: IcosahedronMeshProps) {
    const meshRef = useRef<THREE.Group>(null);
    const textureRef = useRef<THREE.CanvasTexture | null>(null);
    const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);

    // Create icosahedron vertices using the golden ratio
    const vertices = useMemo(() => {
        const phi = (1 + Math.sqrt(5)) / 2; // Golden ratio
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

            // Draw the image to the canvas
            ctx.drawImage(img, 0, 0, 512, 512);

            // Create or update texture
            if (textureRef.current) {
                textureRef.current.image = canvas;
                textureRef.current.needsUpdate = true;
            } else {
                const newTexture = new THREE.CanvasTexture(canvas);
                newTexture.wrapS = THREE.ClampToEdgeWrapping;
                newTexture.wrapT = THREE.ClampToEdgeWrapping;
                textureRef.current = newTexture;
                setTexture(newTexture);
            }
        };
        img.src = textureDataUrl;
    }, [textureDataUrl]);

    // Create individual face geometries with proper UV mapping
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

            // UV coordinates mapping to equilateral triangle in texture
            // Triangle in texture is centered, pointing up
            const cx = 0.5;
            const cy = 0.5;
            const size = 0.42;
            const h = size * Math.sqrt(3) / 2;

            const uvs = new Float32Array([
                cx, cy - h * 2 / 3,           // top
                cx - size / 2, cy + h / 3,    // bottom left
                cx + size / 2, cy + h / 3,    // bottom right
            ]);

            geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
            geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
            geometry.computeVertexNormals();

            return geometry;
        });
    }, [faces, vertices]);

    // Slow auto-rotation
    useFrame((_, delta) => {
        if (meshRef.current) {
            meshRef.current.rotation.y += delta * 0.2;
            meshRef.current.rotation.x += delta * 0.1;
        }
    });

    return (
        <group ref={meshRef}>
            {faceGeometries.map((geometry, i) => (
                <mesh key={i} geometry={geometry}>
                    <meshStandardMaterial
                        map={texture}
                        side={THREE.DoubleSide}
                        roughness={0.4}
                        metalness={0.1}
                    />
                </mesh>
            ))}
            {/* Wireframe overlay for visibility */}
            <mesh>
                <icosahedronGeometry args={[2, 0]} />
                <meshBasicMaterial
                    color="#94a3b8"
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
    const [textureDataUrl, setTextureDataUrl] = useState<string>("");

    const handleTextureUpdate = useCallback((dataUrl: string) => {
        setTextureDataUrl(dataUrl);
    }, []);

    return (
        <div className={`flex flex-col lg:flex-row gap-6 items-start ${className}`}>
            {/* 2D Drawing Canvas */}
            <div className="flex flex-col gap-2">
                <div className="text-sm font-medium text-slate-600 mb-1">Draw on the triangle</div>
                <TriangleCanvas
                    onTextureUpdate={handleTextureUpdate}
                    width={350}
                    height={350}
                />
            </div>

            {/* 3D Icosahedron View */}
            <div className="flex flex-col gap-2 flex-1 min-w-[350px]">
                <div className="text-sm font-medium text-slate-600 mb-1">3D Icosahedron (drag to rotate)</div>
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
