export interface Point {
    x: number;
    y: number;
}

export interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    color: string;
}

export interface GameState {
    isPlaying: boolean;
    score: number;
    targetPos: Point; // Normalized 0-1
    snakeBody: Point[]; // Normalized 0-1
    apple: Point; // Normalized 0-1
    particles: Particle[];
    canvasSize: { w: number; h: number };
}

// MediaPipe Global Types (since we load via script tags)
declare global {
    interface Window {
        Hands: any;
        Camera: any;
        drawConnectors: any;
        drawLandmarks: any;
    }
}