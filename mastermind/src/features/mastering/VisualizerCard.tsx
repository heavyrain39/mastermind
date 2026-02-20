import { useEffect, useRef, useState } from "react";
import { globalVisualizerContext } from "../player/ABPlayerPanel";

const OUTER_POINT_COUNT = 300;
const INNER_POINT_COUNT = 100;
const SNOWFLAKE_COUNT = 80;

interface Point3D {
    bx: number;
    by: number;
    bz: number;
    lat: number;
    idx: number;
    layer: "outer" | "inner";
}

interface Snowflake {
    x: number;
    y: number;
    z: number;
    speed: number;
    angle: number;
    radius: number;
    phase: number;
}

export function VisualizerCard() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const spriteRef = useRef<HTMLCanvasElement | null>(null);
    const pointsRef = useRef<Point3D[]>([]);
    const snowflakesRef = useRef<Snowflake[]>([]);
    const rotationRef = useRef({ x: 0, y: 0, z: 0 });
    const [isDark, setIsDark] = useState(true);

    // Remove theme observer as we force dark mode
    useEffect(() => {
        setIsDark(true);
    }, []);

    // Points Initialization
    useEffect(() => {
        const points: Point3D[] = [];
        const goldenRatio = (1 + Math.sqrt(5)) / 2;

        for (let i = 0; i < OUTER_POINT_COUNT; i++) {
            const theta = (2 * Math.PI * i) / goldenRatio;
            const phi = Math.acos(1 - (2 * (i + 0.5)) / OUTER_POINT_COUNT);
            points.push({
                bx: Math.cos(theta) * Math.sin(phi),
                by: Math.sin(theta) * Math.sin(phi),
                bz: Math.cos(phi),
                lat: Math.abs(Math.cos(phi)),
                idx: i,
                layer: "outer"
            });
        }

        for (let i = 0; i < INNER_POINT_COUNT; i++) {
            const theta = (2 * Math.PI * i) / goldenRatio;
            const phi = Math.acos(1 - (2 * (i + 0.5)) / INNER_POINT_COUNT);
            points.push({
                bx: Math.cos(theta) * Math.sin(phi),
                by: Math.sin(theta) * Math.sin(phi),
                bz: Math.cos(phi),
                lat: Math.abs(Math.cos(phi)),
                idx: i,
                layer: "inner"
            });
        }
        pointsRef.current = points;

        const flakes: Snowflake[] = [];
        for (let i = 0; i < SNOWFLAKE_COUNT; i++) {
            flakes.push({
                x: (Math.random() - 0.5) * 4,
                y: (Math.random() - 0.5) * 4,
                z: (Math.random() - 0.5) * 4,
                speed: 0.002 + Math.random() * 0.005,
                angle: Math.random() * Math.PI * 2,
                radius: Math.random() * 2 + 1,
                phase: Math.random() * Math.PI * 2
            });
        }
        snowflakesRef.current = flakes;
    }, []);

    // Sprite generation
    useEffect(() => {
        const size = 64;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (ctx) {
            const center = size / 2;
            const gradient = ctx.createRadialGradient(center, center, size * 0.05, center, center, center * 0.5);

            const colorStart = "rgba(255, 255, 255, 0.9)";
            const colorMid = "rgba(255, 255, 255, 0.2)";

            gradient.addColorStop(0, colorStart);
            gradient.addColorStop(0.5, colorMid);
            gradient.addColorStop(1, "rgba(0,0,0,0)");

            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, size, size);
        }
        spriteRef.current = canvas;
    }, [isDark]);

    // Main loop
    useEffect(() => {
        let frameId: number;
        const startTime = Date.now();
        let freqData = new Uint8Array(1024); // max possible size for analyser

        const render = () => {
            frameId = requestAnimationFrame(render);
            const cvs = canvasRef.current;
            if (!cvs) return;

            const width = cvs.clientWidth;
            const height = cvs.clientHeight;
            const dpr = window.devicePixelRatio || 1;

            if (cvs.width !== Math.floor(width * dpr) || cvs.height !== Math.floor(height * dpr)) {
                cvs.width = Math.floor(width * dpr);
                cvs.height = Math.floor(height * dpr);
            }

            const ctx = cvs.getContext("2d");
            if (!ctx) return;

            ctx.save();
            ctx.scale(dpr, dpr);
            ctx.clearRect(0, 0, width, height);

            const time = (Date.now() - startTime) / 1000;
            const analyser = globalVisualizerContext.analyser;

            let hasAudio = false;
            if (analyser) {
                if (freqData.length !== analyser.frequencyBinCount) {
                    freqData = new Uint8Array(analyser.frequencyBinCount);
                }
                analyser.getByteFrequencyData(freqData);
                // check if has actual signal
                for (let i = 0; i < 10; i++) {
                    if (freqData[i] > 0) hasAudio = true;
                }
            }

            let bass = 0;
            const spectrum: number[] = new Array(50).fill(0);

            if (hasAudio) {
                const binCount = freqData.length;
                for (let i = 0; i < 10; i++) bass += freqData[i];
                bass = (bass / 10) / 255;
                bass *= 1.5; // Boost bass globally

                for (let i = 0; i < 50; i++) {
                    const index = Math.floor((i / 50) * (binCount * 0.7));
                    spectrum[i] = (freqData[index] / 255) * 1.5; // Boost spectrum
                }
            } else {
                bass = (Math.sin(time * 2.0) * 0.5 + 0.5) * 0.3; // Much faster and stronger idle bass
                for (let i = 0; i < 50; i++) {
                    spectrum[i] = 0.15 + Math.sin(time * 1.5 + i * 0.2) * 0.1; // More active idle wave
                }
            }

            const rot = rotationRef.current;
            rot.y += (0.002 + bass * 0.01) * 2.5; // Faster rotation
            rot.x = Math.sin(time * 0.25) * 0.25; // Increase pitch swing

            const rotX = rot.x;
            const rotY = rot.y;

            const cx = width / 2;
            const cy = height / 2;
            const baseSize = Math.min(width, height) * 0.8; // Enlarge bounds by 20%
            const breath = 1 + bass * 0.35; // Bigger breath

            ctx.globalCompositeOperation = "lighter"; // Always use lighter since it's dark theme
            const sprite = spriteRef.current;

            const drawPoint3D = (bx: number, by: number, bz: number, r: number, colorBaseAlpha: number, isInner: boolean) => {
                let x1 = bx * Math.cos(rotY) - bz * Math.sin(rotY);
                let z1 = bx * Math.sin(rotY) + bz * Math.cos(rotY);
                let y1 = by;

                let y2 = y1 * Math.cos(rotX) - z1 * Math.sin(rotX);
                let z2 = y1 * Math.sin(rotX) + z1 * Math.cos(rotX);
                let x2 = x1;

                x2 *= r;
                y2 *= r;
                z2 *= r;

                const fov = 1000;
                const zCamera = 1000;
                const zDepth = zCamera - z2;

                if (zDepth < 100) return;

                const scale = fov / zDepth;
                const x2d = cx + x2 * scale;
                const y2d = cy + y2 * scale;

                const normZ = z2 / baseSize;
                const alpha = Math.max(0.1, Math.min(1, (normZ + 1.2) * 0.45));

                const spriteSize = (isInner ? 14 : 18) * scale * (0.8 + bass * 0.3) * 0.35; // Reduce to 70% of current (0.5 * 0.7 = 0.35)

                if (sprite && alpha > 0.05) {
                    ctx.globalAlpha = alpha * colorBaseAlpha;
                    ctx.drawImage(sprite, x2d - spriteSize / 2, y2d - spriteSize / 2, spriteSize, spriteSize);
                    ctx.globalAlpha = 1;
                }
            };

            const innerSize = baseSize * 0.45;
            for (const p of pointsRef.current) {
                if (p.layer !== "inner") continue;
                const specIdx = Math.floor(p.lat * 49);
                const displacement = spectrum[specIdx] || 0;
                const r = innerSize * breath + displacement * innerSize * 1.2;
                drawPoint3D(p.bx, p.by, p.bz, r, 0.7, true);
            }

            for (const p of pointsRef.current) {
                if (p.layer !== "outer") continue;
                const specIdx = Math.floor(p.lat * 49);
                const displacement = spectrum[specIdx] || 0;
                const r = baseSize * breath + displacement * baseSize * 0.8;
                drawPoint3D(p.bx, p.by, p.bz, r, 1.0, false);
            }

            for (const f of snowflakesRef.current) {
                f.angle += f.speed * 1.5;
                f.y = Math.sin(time * 0.5 + f.phase) * 2;

                const orbitR = baseSize * 1.5 * f.radius;
                const fx = Math.cos(f.angle) * orbitR;
                const fz = Math.sin(f.angle) * orbitR;
                const fy = f.y * (baseSize * 0.5);

                const sRotY = rotY * 0.5;
                const sx = fx * Math.cos(sRotY) - fz * Math.sin(sRotY);
                const sz = fx * Math.sin(sRotY) + fz * Math.cos(sRotY);
                const sy = fy;

                const sy2 = sy * Math.cos(rotX * 0.5) - sz * Math.sin(rotX * 0.5);
                const sz2 = sy * Math.sin(rotX * 0.5) + sz * Math.cos(rotX * 0.5);
                const sx2 = sx;

                const zDepth = 1000 - sz2;
                if (zDepth < 100) continue;

                const scale = 1000 / zDepth;
                const x2d = cx + sx2 * scale;
                const y2d = cy + sy2 * scale;

                const alpha = Math.max(0, Math.min(0.8, scale - 0.2));
                const spriteSize = 16 * scale * 0.35; // Reduce to 70% of current (0.5 * 0.7 = 0.35)

                if (sprite && alpha > 0.05) {
                    ctx.globalAlpha = alpha * 0.7;
                    ctx.drawImage(sprite, x2d - spriteSize / 2, y2d - spriteSize / 2, spriteSize, spriteSize);
                    ctx.globalAlpha = 1;
                }
            }

            ctx.globalCompositeOperation = "source-over";
            ctx.restore();
        };

        render();
        return () => cancelAnimationFrame(frameId);
    }, [isDark]);

    return (
        <div className="panel visualizer-card" style={{ width: "100%", background: "#050505", border: "1px solid var(--line-strong)", overflow: "hidden", position: "relative", isolation: "isolate" }}>
            <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block", isolation: "isolate" }} />
        </div>
    );
}
