import * as THREE from 'three';
import { FLIGHT_CONFIG, RADAR_CONFIG } from '../config.js';

const LAYER_WIDTH = 1536;
const LAYER_HEIGHT = 768;

const HUD_PLANE_WIDTH = 1.4;
const HUD_PLANE_HEIGHT = 0.7;

const GAME_OVER_WIDTH = 1.1;
const GAME_OVER_HEIGHT = 0.55;

const COLORS = {
    panelBg: 'rgba(12, 18, 28, 0.78)',
    panelInner: 'rgba(255, 255, 255, 0.06)',
    gameOverBg: 'rgba(10, 12, 18, 0.92)',
    gameOverInner: 'rgba(255, 255, 255, 0.05)',
    label: 'rgba(255,255,255,0.72)',
    value: '#ffffff',
    hint: 'rgba(255,255,255,0.55)',
    subtitle: 'rgba(255,255,255,0.86)'
};

export class VRHud {
    constructor(camera) {
        this.camera = camera;

        this.root = new THREE.Group();
        this.root.position.set(0, -0.15, -1.2);

        this.hudCanvas = document.createElement('canvas');
        this.hudCanvas.width = LAYER_WIDTH;
        this.hudCanvas.height = LAYER_HEIGHT;
        this.hudCtx = this.hudCanvas.getContext('2d');

        this.hudTexture = new THREE.CanvasTexture(this.hudCanvas);
        this.setupTexture(this.hudTexture);

        this.hudMaterial = new THREE.MeshBasicMaterial({
            map: this.hudTexture,
            transparent: true,
            depthTest: false,
            depthWrite: false,
            side: THREE.DoubleSide
        });

        this.hudMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(HUD_PLANE_WIDTH, HUD_PLANE_HEIGHT),
            this.hudMaterial
        );
        this.hudMesh.position.set(0, 0, 0);
        this.hudMesh.renderOrder = 100;
        this.root.add(this.hudMesh);

        this.gameOverCanvas = document.createElement('canvas');
        this.gameOverCanvas.width = LAYER_WIDTH;
        this.gameOverCanvas.height = LAYER_HEIGHT;
        this.gameOverCtx = this.gameOverCanvas.getContext('2d');

        this.gameOverTexture = new THREE.CanvasTexture(this.gameOverCanvas);
        this.setupTexture(this.gameOverTexture);

        this.gameOverMaterial = new THREE.MeshBasicMaterial({
            map: this.gameOverTexture,
            transparent: true,
            depthTest: false,
            depthWrite: false,
            side: THREE.DoubleSide
        });

        this.gameOverMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(GAME_OVER_WIDTH, GAME_OVER_HEIGHT),
            this.gameOverMaterial
        );
        this.gameOverMesh.position.set(0, -0.18, 0.01);
        this.gameOverMesh.visible = false;
        this.gameOverMesh.renderOrder = 110;
        this.root.add(this.gameOverMesh);

        // --- FPS PANEL ---
        this.fpsCanvas = document.createElement('canvas');
        this.fpsCanvas.width = 512;
        this.fpsCanvas.height = 256;
        this.fpsCtx = this.fpsCanvas.getContext('2d');

        this.fpsTexture = new THREE.CanvasTexture(this.fpsCanvas);
        this.fpsTexture.needsUpdate = true;

        this.fpsMaterial = new THREE.MeshBasicMaterial({
            map: this.fpsTexture,
            transparent: true,
            depthTest: false,
            depthWrite: false
        });

        this.fpsMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(0.35, 0.18),
            this.fpsMaterial
        );

        // 👉 верхний левый угол
        this.fpsMesh.position.set(-0.5, 0.25, 0);
        this.root.add(this.fpsMesh);

        // счетчик FPS
        this._fpsFrames = 0;
        this._fpsTime = 0;
        this._fpsValue = 0;

        this.camera.add(this.root);

    // Radar state
    this.radarImage = new Image();
    this.radarImage.src = './assets/images/sonar.png';
    this.radarBlinkOn = true;
    this.radarDots = []; // cached dot positions
    this.radarCanvasSize = Math.floor(LAYER_WIDTH * (RADAR_CONFIG.displayFraction || 0.5));

        this.render({
            kills: 0,
            isGameOver: false,
            speed: 0,
            altitude: 0
        });
    }

    updateFPS(deltaTime) {
        this._fpsFrames++;
        this._fpsTime += deltaTime;

        this._fpsValue = Math.round(this._fpsFrames / this._fpsTime);
        this._fpsFrames = 0;
        this._fpsTime = 0;

        this.renderFPS();
    }

    renderFPS() {
        const ctx = this.fpsCtx;
        const canvas = this.fpsCanvas;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // фон
        this.drawRoundedRect(
            ctx,
            20,
            20,
            200,
            100,
            20,
            'rgba(0,0,0,0.75)'
        );

        // текст
        ctx.fillStyle = '#00ff88';
        ctx.font = 'bold 48px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillText(
            `${this._fpsValue}`,
            120,
            70
        );

        ctx.font = '20px monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText(
            'FPS',
            120,
            110
        );

        this.fpsTexture.needsUpdate = true;
    }

    setupTexture(texture) {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.generateMipmaps = false;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.needsUpdate = true;
    }

    render(state) {
    this.renderHud(state);
    this.renderRadar(state);
    this.renderGameOver(state);
    this.updateFPS(state.deltaTime);
    }

    renderHud(state) {
        const ctx = this.hudCtx;
        const canvas = this.hudCanvas;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const killsRect = this.getRect('top-center', 360, 120, 0);
        const speedRect = this.getRect('bottom-left', 280, 120, 0);
        const altitudeRect = this.getRect('bottom-right', 280, 120, 0);

        this.drawPanel(ctx, killsRect, 26);
        this.drawPanel(ctx, speedRect, 26);
        this.drawPanel(ctx, altitudeRect, 26);

        this.drawCenterMetric(ctx, killsRect, {
            label: 'KILLS',
            value: String(state.kills ?? 0)
        });

        this.drawLeftMetric(ctx, speedRect, {
            label: 'SPEED',
            value: `${Math.round((state.speed ?? 0) * 10)}`,
            suffix: 'km/h'
        });

        this.drawLeftMetric(ctx, altitudeRect, {
            label: 'ALTITUDE',
            value: `${Math.round(state.altitude ?? 0)}`,
            suffix: 'm'
        });

        // low altitude warning
        if (state.altitude < FLIGHT_CONFIG.lowAltitudeWarning) {
            ctx.fillStyle = 'rgba(255,80,40,0.85)';
            ctx.font = 'bold 100px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('LOW ALTITUDE', LAYER_WIDTH * 0.5, altitudeRect.y - 50);
        }

        this.hudTexture.needsUpdate = true;
    }

    // radar: state.enemies = array of enemy objects with world positions, state.playerPosition = Vector3
    renderRadar(state) {
        const ctx = this.hudCtx;
        const canvas = this.hudCanvas;

        const radarSize = this.radarCanvasSize;
        const radius = radarSize * 0.5;
        const centerX = canvas.width - radarSize - 5; // place near right
        const centerY = radius + 5; // top margin

        // background radar image (circular)
        if (this.radarImage.complete) {
            ctx.save();
            ctx.globalAlpha = 0.9;
            ctx.drawImage(this.radarImage, centerX, centerY - radius, radarSize, radarSize);
            ctx.restore();
        } else {
            // fallback circle
            ctx.save();
            ctx.fillStyle = 'rgba(0,24,40,0.6)';
            ctx.beginPath();
            ctx.arc(centerX + radius, centerY, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // recompute dot positions every frame so new enemies appear immediately
        this.radarDots.length = 0;
        const enemies = state.enemies || [];
        const playerPos = state.playerPosition;
        const pad = RADAR_CONFIG.padding;
        const maxRange = RADAR_CONFIG.range;

        for (const enemy of enemies) {
            const ex = enemy.position.x - playerPos.x;
            const ez = enemy.position.z - playerPos.z;
            const dist = Math.hypot(ex, ez);

            let sx = ex / maxRange;
            let sy = ez / maxRange;
            let onEdge = false;

            if (dist > maxRange) {
                const angle = Math.atan2(ez, ex);
                sx = Math.cos(angle);
                sy = Math.sin(angle);
                onEdge = true;
            }

            const px = centerX + radius + sx * (radius - pad);
            const py = centerY + sy * (radius - pad);

            this.radarDots.push({ x: px, y: py, onEdge, dist });
        }

        ctx.save();

        for (const d of this.radarDots) {
            // size scales inversely with distance: closer -> larger
            const ratio = Math.max(0, Math.min(1, 1 - (d.dist / maxRange)));
            const minS = RADAR_CONFIG.dotMin;
            const maxS = RADAR_CONFIG.dotMax;
            const size = Math.round(minS + (maxS - minS) * ratio);

            ctx.fillStyle = d.onEdge ? '#ffcc00' : '#00ff66';
            ctx.beginPath();
            ctx.arc(d.x, d.y, size, 0, Math.PI * 2);
            ctx.fill();
        }

        // draw player center dot (red)
        ctx.fillStyle = '#ff3333';
        const playerSize = RADAR_CONFIG.playerDotSize;
        ctx.beginPath();
        ctx.arc(centerX + radius, centerY, playerSize, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
        this.hudTexture.needsUpdate = true;
    }

    renderGameOver(state) {
        const ctx = this.gameOverCtx;
        const canvas = this.gameOverCanvas;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!state.isGameOver) {
            this.gameOverMesh.visible = false;
            this.gameOverTexture.needsUpdate = true;
            return;
        }

        this.gameOverMesh.visible = true;

        const panelRect = this.getRect('center', 844, 360);

        this.drawRoundedRect(
            ctx,
            panelRect.x,
            panelRect.y,
            panelRect.width,
            panelRect.height,
            34,
            COLORS.gameOverBg
        );

        this.drawRoundedRect(
            ctx,
            panelRect.x + 16,
            panelRect.y + 16,
            panelRect.width - 32,
            panelRect.height - 32,
            28,
            COLORS.gameOverInner
        );

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const centerX = panelRect.x + panelRect.width * 0.5;
        const centerY = panelRect.y + panelRect.height * 0.5;

        ctx.fillStyle = COLORS.value;
        ctx.font = 'bold 72px Arial';
        ctx.fillText('GAME OVER', centerX, centerY - 70);

        ctx.fillStyle = COLORS.subtitle;
        ctx.font = '36px Arial';
        ctx.fillText(`Enemies destroyed: ${state.kills ?? 0}`, centerX, centerY + 10);

        ctx.fillStyle = COLORS.label;
        ctx.font = '30px Arial';
        ctx.fillText('Press trigger to restart', centerX, centerY + 90);

        this.gameOverTexture.needsUpdate = true;
    }

    getRect(anchor, width, height, margin = 0) {
        switch (anchor) {
            case 'top-center':
                return {
                    x: (LAYER_WIDTH - width) * 0.5,
                    y: margin,
                    width,
                    height
                };

            case 'bottom-left':
                return {
                    x: margin,
                    y: LAYER_HEIGHT - height - margin,
                    width,
                    height
                };

            case 'bottom-right':
                return {
                    x: LAYER_WIDTH - width - margin,
                    y: LAYER_HEIGHT - height - margin,
                    width,
                    height
                };

            case 'center':
                return {
                    x: (LAYER_WIDTH - width) * 0.5,
                    y: (LAYER_HEIGHT - height) * 0.5,
                    width,
                    height
                };

            default:
                return { x: 0, y: 0, width, height };
        }
    }

    drawPanel(ctx, rect, radius = 24) {
        this.drawRoundedRect(
            ctx,
            rect.x,
            rect.y,
            rect.width,
            rect.height,
            radius,
            COLORS.panelBg
        );

        this.drawRoundedRect(
            ctx,
            rect.x + 8,
            rect.y + 8,
            rect.width - 16,
            rect.height - 16,
            Math.max(12, radius - 6),
            COLORS.panelInner
        );
    }

    drawCenterMetric(ctx, rect, { label, value }) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillStyle = COLORS.label;
        ctx.font = '28px Arial';
        ctx.fillText(label, rect.x + rect.width * 0.5, rect.y + 38);

        ctx.fillStyle = COLORS.value;
        ctx.font = 'bold 54px Arial';
        ctx.fillText(value, rect.x + rect.width * 0.5, rect.y + 78);
    }

    drawLeftMetric(ctx, rect, { label, value, suffix }) {
        const left = rect.x + 32;
        const valueY = rect.y + 82;

        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        ctx.fillStyle = COLORS.label;
        ctx.font = '24px Arial';
        ctx.fillText(label, left, rect.y + 40);

        ctx.fillStyle = COLORS.value;
        ctx.font = 'bold 42px Arial';
        ctx.fillText(value, left, valueY);

        const valueWidth = ctx.measureText(value).width;

        ctx.fillStyle = COLORS.hint;
        ctx.font = '22px Arial';
        ctx.fillText(suffix, left + valueWidth + 14, valueY);
    }

    drawRoundedRect(ctx, x, y, width, height, radius, fillStyle) {
        ctx.save();
        ctx.fillStyle = fillStyle;

        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    dispose() {
        if (this.root.parent) {
            this.root.parent.remove(this.root);
        }

        this.hudMesh.geometry.dispose();
        this.hudMaterial.dispose();
        this.hudTexture.dispose();

        this.gameOverMesh.geometry.dispose();
        this.gameOverMaterial.dispose();
        this.gameOverTexture.dispose();
    }
}