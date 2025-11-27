import React, { useEffect, useRef, useState } from 'react';
import { GameState, Point, Particle } from '../types';

const CONFIG = {
    SEGMENT_GAP: 8,         // Physics constraint distance (pixels)
    INITIAL_LENGTH: 20,
    GROWTH_PER_APPLE: 5,
    APPLE_RADIUS: 16,
    SNAKE_RADIUS: 14,
    HEAD_RADIUS: 18,
    LERP_SPEED: 0.5,        // Fast response for head tracking
};

const SnakeGame: React.FC = () => {
    // UI State
    const [score, setScore] = useState(0);
    const [status, setStatus] = useState<'loading' | 'ready' | 'playing' | 'gameover'>('loading');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Refs for Game Engine (Mutable state without re-renders)
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const requestRef = useRef<number>(0);
    
    // Mutable Game State
    const state = useRef<GameState>({
        isPlaying: false,
        score: 0,
        targetPos: { x: 0.5, y: 0.5 },
        snakeBody: [],
        apple: { x: 0.5, y: 0.5 },
        particles: [],
        canvasSize: { w: 0, h: 0 }
    });

    // --- Physics & Logic Helpers ---

    const lerp = (start: number, end: number, amt: number) => {
        return (1 - amt) * start + amt * end;
    };

    const spawnApple = () => {
        state.current.apple = {
            x: 0.05 + Math.random() * 0.9,
            y: 0.05 + Math.random() * 0.9
        };
    };

    const createParticles = (x: number, y: number, color: string) => {
        for(let i=0; i<12; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 0.01 + 0.005;
            state.current.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1.0,
                color: color
            });
        }
    };

    const resetGame = () => {
        state.current.score = 0;
        setScore(0);
        state.current.snakeBody = [];
        
        // Initialize collapsed snake at center (or current target)
        for(let i=0; i<CONFIG.INITIAL_LENGTH; i++) {
            state.current.snakeBody.push({ ...state.current.targetPos });
        }
        
        state.current.isPlaying = true;
        state.current.particles = [];
        spawnApple();
        setStatus('playing');
    };

    const stopGame = (e?: React.SyntheticEvent) => {
        // Prevent event bubbling/default actions to ensure immediate execution
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        state.current.isPlaying = false;
        state.current.snakeBody = []; // Clear the snake to hide it
        state.current.particles = []; // Clear particles
        setStatus('ready');
    };

    // --- Game Loop ---

    const updatePhysics = (w: number, h: number) => {
        const s = state.current;
        if (!s.isPlaying || s.snakeBody.length === 0) return;

        // 1. Head Movement (Lerp towards target)
        const head = s.snakeBody[0];
        head.x = lerp(head.x, s.targetPos.x, CONFIG.LERP_SPEED);
        head.y = lerp(head.y, s.targetPos.y, CONFIG.LERP_SPEED);

        // 2. Inverse Kinematics (Body Following)
        for (let i = 1; i < s.snakeBody.length; i++) {
            const prev = s.snakeBody[i - 1];
            const curr = s.snakeBody[i];

            const dx = (prev.x - curr.x) * w;
            const dy = (prev.y - curr.y) * h;
            const dist = Math.sqrt(dx*dx + dy*dy);

            // Constraint: Pull segment if too far
            if (dist > CONFIG.SEGMENT_GAP) {
                const angle = Math.atan2(dy, dx);
                const tx = (prev.x * w) - Math.cos(angle) * CONFIG.SEGMENT_GAP;
                const ty = (prev.y * h) - Math.sin(angle) * CONFIG.SEGMENT_GAP;
                curr.x = tx / w;
                curr.y = ty / h;
            }
        }

        // 3. Apple Collision
        const dxApple = (head.x - s.apple.x) * w;
        const dyApple = (head.y - s.apple.y) * h;
        const distApple = Math.sqrt(dxApple*dxApple + dyApple*dyApple);
        
        if (distApple < (CONFIG.HEAD_RADIUS + CONFIG.APPLE_RADIUS)) {
            s.score += 10;
            setScore(s.score); // Update UI
            
            // Grow snake
            const tail = s.snakeBody[s.snakeBody.length - 1];
            for(let k=0; k<CONFIG.GROWTH_PER_APPLE; k++) {
                s.snakeBody.push({ ...tail });
            }
            
            createParticles(s.apple.x, s.apple.y, '#ef4444');
            spawnApple();
        }
    };

    const draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
        const s = state.current;

        // 1. Draw Video Feed
        if (videoRef.current && videoRef.current.readyState >= 2) {
            ctx.save();
            ctx.drawImage(videoRef.current, 0, 0, w, h);
            // Dark overlay for contrast
            ctx.fillStyle = 'rgba(5, 5, 5, 0.75)';
            ctx.fillRect(0, 0, w, h);
            ctx.restore();
        } else {
            // Fallback background
            ctx.fillStyle = '#111';
            ctx.fillRect(0, 0, w, h);
        }

        // Stop drawing game elements if snake is gone (Game Stopped/Ready)
        if (s.snakeBody.length === 0) return;

        // 2. Draw Particles
        for (let i = s.particles.length - 1; i >= 0; i--) {
            const p = s.particles[i];
            p.life -= 0.04;
            p.x += p.vx;
            p.y += p.vy;
            
            if (p.life <= 0) {
                s.particles.splice(i, 1);
                continue;
            }
            
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.life;
            ctx.beginPath();
            ctx.arc(p.x * w, p.y * h, 3 + Math.random()*2, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
        }

        // 3. Draw Apple
        const ax = s.apple.x * w;
        const ay = s.apple.y * h;
        const pulse = Math.sin(Date.now() / 200) * 2;
        
        ctx.shadowColor = '#ff3333';
        ctx.shadowBlur = 20 + pulse;
        ctx.fillStyle = '#ff1a1a';
        ctx.beginPath();
        ctx.arc(ax, ay, CONFIG.APPLE_RADIUS + pulse/2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        
        // Apple Shine
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath();
        ctx.ellipse(ax - 5, ay - 5, 6, 3, Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();

        // 4. Draw Snake
        // Body
        for (let i = s.snakeBody.length - 1; i > 0; i--) {
            const pt = s.snakeBody[i];
            const px = pt.x * w;
            const py = pt.y * h;
            const progress = i / s.snakeBody.length;
            
            const hue = 145; 
            const lightness = 60 - (progress * 30);
            
            ctx.fillStyle = `hsl(${hue}, 100%, ${lightness}%)`;
            ctx.strokeStyle = `hsl(${hue}, 100%, ${lightness - 10}%)`;
            ctx.lineWidth = 1;

            ctx.beginPath();
            ctx.arc(px, py, CONFIG.SNAKE_RADIUS, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Body Shine
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.beginPath();
            ctx.arc(px, py - 3, CONFIG.SNAKE_RADIUS * 0.4, 0, Math.PI * 2);
            ctx.fill();
        }

        // Head
        const head = s.snakeBody[0];
        const hx = head.x * w;
        const hy = head.y * h;

        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 15;
        ctx.fillStyle = '#4ade80';
        ctx.beginPath();
        ctx.arc(hx, hy, CONFIG.HEAD_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Eyes Logic
        const lookDx = s.apple.x - head.x;
        const lookDy = s.apple.y - head.y;
        let lookAngle = Math.atan2(lookDy, lookDx);

        ctx.fillStyle = 'white';
        const eyeOffset = 6;
        const eyeLX = hx + Math.cos(lookAngle - 0.5) * eyeOffset;
        const eyeLY = hy + Math.sin(lookAngle - 0.5) * eyeOffset;
        const eyeRX = hx + Math.cos(lookAngle + 0.5) * eyeOffset;
        const eyeRY = hy + Math.sin(lookAngle + 0.5) * eyeOffset;

        // Sclera
        ctx.beginPath(); ctx.arc(eyeLX, eyeLY, 7, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(eyeRX, eyeRY, 7, 0, Math.PI*2); ctx.fill();

        // Pupils
        ctx.fillStyle = 'black';
        const pupilDist = 3;
        ctx.beginPath(); ctx.arc(eyeLX + Math.cos(lookAngle)*pupilDist, eyeLY + Math.sin(lookAngle)*pupilDist, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(eyeRX + Math.cos(lookAngle)*pupilDist, eyeRY + Math.sin(lookAngle)*pupilDist, 3.5, 0, Math.PI * 2); ctx.fill();
        
        // Highlight
        ctx.fillStyle = 'white';
        ctx.beginPath(); ctx.arc(eyeLX + Math.cos(lookAngle)*pupilDist - 1, eyeLY + Math.sin(lookAngle)*pupilDist - 1, 1.5, 0, Math.PI * 2); ctx.fill();
    };

    const animate = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d', { alpha: false });
        
        if (canvas && ctx) {
            updatePhysics(canvas.width, canvas.height);
            draw(ctx, canvas.width, canvas.height);
        }
        
        requestRef.current = requestAnimationFrame(animate);
    };

    // --- Input Handling ---

    const handleMouseMove = (e: MouseEvent) => {
        if (!state.current.isPlaying || !canvasRef.current) return;
        
        const rect = canvasRef.current.getBoundingClientRect();
        let x = (e.clientX - rect.left) / rect.width;
        let y = (e.clientY - rect.top) / rect.height;

        // Mirror check: The canvas container has 'mirror-x', so we need to invert X for input to feel natural
        x = 1.0 - x;

        state.current.targetPos = { 
            x: Math.max(0, Math.min(1, x)), 
            y: Math.max(0, Math.min(1, y)) 
        };
    };

    // --- Initialization ---

    useEffect(() => {
        let isMounted = true;
        let hands: any = null;

        const initCamera = async () => {
            // Check if scripts are loaded
            if (!window.Hands || !window.Camera) {
                if(isMounted) setTimeout(initCamera, 100);
                return;
            }

            try {
                hands = new window.Hands({
                    locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
                });

                hands.setOptions({
                    maxNumHands: 1,
                    modelComplexity: 1,
                    minDetectionConfidence: 0.5,
                    minTrackingConfidence: 0.5
                });

                hands.onResults((results: any) => {
                    if (!isMounted) return;

                    if (canvasRef.current && videoRef.current) {
                        // Keep canvas size synced
                        if (canvasRef.current.width !== videoRef.current.videoWidth) {
                            canvasRef.current.width = videoRef.current.videoWidth;
                            canvasRef.current.height = videoRef.current.videoHeight;
                        }
                    }

                    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
                        const indexTip = results.multiHandLandmarks[0][8];
                        state.current.targetPos = { x: indexTip.x, y: indexTip.y };
                    }
                });

                if (videoRef.current) {
                    const camera = new window.Camera(videoRef.current, {
                        onFrame: async () => {
                            if (isMounted && hands) await hands.send({ image: videoRef.current });
                        },
                        width: 1280,
                        height: 720
                    });
                    
                    await camera.start();
                    if (isMounted) setStatus('ready');
                }
            } catch (e) {
                console.error(e);
                if (isMounted) setErrorMsg('Camera failed to start. Please check permissions.');
            }
        };

        initCamera();

        // Mouse listeners
        window.addEventListener('mousemove', handleMouseMove);
        
        // Start Loop
        requestRef.current = requestAnimationFrame(animate);

        return () => {
            isMounted = false;
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            window.removeEventListener('mousemove', handleMouseMove);
            if (hands) hands.close();
        };
    }, []);

    // --- Render ---

    return (
        <div className="relative w-full h-full flex items-center justify-center bg-black">
            
            {/* Game Container (Mirrored) */}
            <div className="relative w-full h-full flex items-center justify-center mirror-x">
                <video ref={videoRef} className="hidden" playsInline muted></video>
                <canvas 
                    ref={canvasRef} 
                    className="absolute inset-0 w-full h-full object-cover"
                />
            </div>

            {/* UI Overlay (Not Mirrored) */}
            {/* pointer-events-none ensures clicks pass through the empty layout spaces */}
            <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between z-20">
                
                {/* Header: Use pointer-events-auto ONLY on interactive children */}
                <div className="flex justify-between items-start w-full">
                     <div className="pointer-events-auto bg-black/40 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/10 shadow-xl">
                        <h1 className="text-2xl font-black italic tracking-tighter bg-gradient-to-r from-lime-400 to-emerald-400 bg-clip-text text-transparent">
                            SNAKE.AI
                        </h1>
                    </div>

                    {status === 'playing' && (
                        <button 
                            onPointerDown={stopGame} // pointer-down is faster and handles both mouse/touch better
                            className="pointer-events-auto cursor-pointer z-50 bg-red-500/80 hover:bg-red-500 text-white font-bold px-8 py-3 rounded-full shadow-lg border border-red-400/30 transition-all hover:scale-105 active:scale-95 uppercase tracking-wider text-sm backdrop-blur-md"
                        >
                            STOP
                        </button>
                    )}

                    <div className="pointer-events-auto bg-black/40 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 shadow-xl text-center min-w-[100px]">
                        <p className="text-[10px] text-emerald-400 uppercase tracking-widest font-bold mb-1">Score</p>
                        <p className="text-4xl font-mono font-black text-white leading-none drop-shadow-[0_2px_10px_rgba(52,211,153,0.5)]">
                            {score}
                        </p>
                    </div>
                </div>

                {/* Center Content */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    
                    {status === 'loading' && (
                        <div className="pointer-events-auto flex flex-col items-center gap-6">
                            <div className="relative">
                                <div className="w-16 h-16 border-4 border-lime-500/30 rounded-full animate-ping absolute inset-0"></div>
                                <div className="w-16 h-16 border-4 border-lime-400 border-t-transparent rounded-full animate-spin relative z-10"></div>
                            </div>
                            <p className="text-zinc-300 font-bold tracking-wide animate-pulse">STARTING VISION...</p>
                        </div>
                    )}

                    {errorMsg && (
                         <div className="pointer-events-auto text-red-500 font-bold bg-black/80 p-4 rounded-xl border border-red-500/50">
                            {errorMsg}
                         </div>
                    )}

                    {status === 'ready' && (
                        <button 
                            onPointerDown={resetGame}
                            className="pointer-events-auto cursor-pointer group relative px-10 py-5 bg-gradient-to-r from-lime-500 to-emerald-600 hover:from-lime-400 hover:to-emerald-500 text-white font-black rounded-full transition-all hover:scale-105 active:scale-95 shadow-[0_0_40px_rgba(16,185,129,0.5)] ring-4 ring-white/10"
                        >
                            <span className="text-2xl italic tracking-wide drop-shadow-md">PLAY GAME</span>
                        </button>
                    )}

                    {status === 'gameover' && (
                        <div className="pointer-events-auto flex flex-col items-center bg-black/60 backdrop-blur-xl p-10 rounded-3xl border border-white/10 text-center shadow-2xl animate-in fade-in zoom-in duration-300">
                             <div className="text-6xl mb-4 drop-shadow-lg">💀</div>
                             <h2 className="text-4xl font-black text-white mb-2 italic">GAME OVER</h2>
                             <p className="text-zinc-300 mb-8 font-medium">Final Score: <span className="text-lime-400 font-mono text-2xl font-bold">{score}</span></p>
                             <button 
                                onPointerDown={resetGame}
                                className="w-full px-8 py-4 bg-white text-black hover:bg-gray-200 font-black tracking-wide rounded-xl transition-colors shadow-lg cursor-pointer"
                            >
                                TRY AGAIN
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer Hint */}
                <div className="text-center pb-4 pointer-events-auto">
                     <span className="bg-black/50 backdrop-blur px-4 py-2 rounded-full text-white/60 text-sm font-medium border border-white/5">
                        ☝️ Use Index Finger &nbsp;|&nbsp; 🖱️ Use Mouse
                    </span>
                </div>
            </div>
        </div>
    );
};

export default SnakeGame;