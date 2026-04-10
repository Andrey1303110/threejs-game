import * as THREE from 'three';

const SCREEN_WIDTH = 1024
const SCREEN_HEIGHT = 512

export class VRHud {
    constructor(camera) {
        this.camera = camera;

        this.root = new THREE.Group();
        this.root.position.set(0, -0.15, -1.2);

        this.hudCanvas = document.createElement('canvas');
        this.hudCanvas.width = SCREEN_WIDTH;
        this.hudCanvas.height = SCREEN_HEIGHT;
        this.hudCtx = this.hudCanvas.getContext('2d');

        this.hudTexture = new THREE.CanvasTexture(this.hudCanvas);
        this.hudTexture.colorSpace = THREE.SRGBColorSpace;
        this.hudTexture.generateMipmaps = false;
        this.hudTexture.minFilter = THREE.LinearFilter;
        this.hudTexture.magFilter = THREE.LinearFilter;
        this.hudTexture.needsUpdate = true;

        this.hudMaterial = new THREE.MeshBasicMaterial({
            map: this.hudTexture,
            transparent: true,
            depthTest: false,
            depthWrite: false,
            side: THREE.DoubleSide
        });

        this.hudMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(1.4, 0.7),
            this.hudMaterial
        );
        this.hudMesh.position.set(0, 0, 0);
        this.hudMesh.renderOrder = 100;
        this.root.add(this.hudMesh);

        this.gameOverCanvas = document.createElement('canvas');
        this.gameOverCanvas.width = SCREEN_WIDTH;
        this.gameOverCanvas.height = SCREEN_HEIGHT;
        this.gameOverCtx = this.gameOverCanvas.getContext('2d');

        this.gameOverTexture = new THREE.CanvasTexture(this.gameOverCanvas);
        this.gameOverTexture.colorSpace = THREE.SRGBColorSpace;
        this.gameOverTexture.generateMipmaps = false;
        this.gameOverTexture.minFilter = THREE.LinearFilter;
        this.gameOverTexture.magFilter = THREE.LinearFilter;
        this.gameOverTexture.needsUpdate = true;

        this.gameOverMaterial = new THREE.MeshBasicMaterial({
            map: this.gameOverTexture,
            transparent: true,
            depthTest: false,
            depthWrite: false,
            side: THREE.DoubleSide
        });

        this.gameOverMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(1.1, 0.55),
            this.gameOverMaterial
        );
        this.gameOverMesh.position.set(0, -0.18, 0.01);
        this.gameOverMesh.visible = false;
        this.gameOverMesh.renderOrder = 110;
        this.root.add(this.gameOverMesh);

        this.camera.add(this.root);

        this.render({
            kills: 0,
            isGameOver: false,
            speed: 0,
            altitude: 0
        });
    }

    render(state) {
        this.renderHud(state);
        this.renderGameOver(state);
    }

    renderHud(state) {
        const ctx = this.hudCtx;
        const canvas = this.hudCanvas;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        // KILLS — по центру сверху
        this.drawRoundedRect(ctx, 332, 20, 360, 120, 26, 'rgba(12, 18, 28, 0.78)');
        this.drawRoundedRect(ctx, 340, 28, 344, 104, 20, 'rgba(255, 255, 255, 0.06)');

        ctx.textAlign = 'center';

        ctx.fillStyle = 'rgba(255,255,255,0.72)';
        ctx.font = '28px Arial';
        ctx.fillText('KILLS', this.gameOverCanvas.width * 0.5, 58);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 54px Arial';
        ctx.fillText(String(state.kills ?? 0), this.gameOverCanvas.width * 0.5, 98);

        // SPEED — снизу слева
        this.drawRoundedRect(ctx, 24, 360, 280, 120, 26, 'rgba(12, 18, 28, 0.78)');
        this.drawRoundedRect(ctx, 32, 368, 264, 104, 20, 'rgba(255, 255, 255, 0.06)');

        ctx.textAlign = 'left';

        ctx.fillStyle = 'rgba(255,255,255,0.72)';
        ctx.font = '24px Arial';
        ctx.fillText('SPEED', 56, 400);

        const drawSpeed = state.speed * 10 ?? 0;
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 42px Arial';
        ctx.fillText(`${Math.round(drawSpeed)} km/h`, 56, 442);

        // ALTITUDE — снизу справа
        this.drawRoundedRect(ctx, 720, 360, 280, 120, 26, 'rgba(12, 18, 28, 0.78)');
        this.drawRoundedRect(ctx, 728, 368, 264, 104, 20, 'rgba(255, 255, 255, 0.06)');

        ctx.fillStyle = 'rgba(255,255,255,0.72)';
        ctx.font = '24px Arial';
        ctx.fillText('ALTITUDE', 752, 400);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 42px Arial';
        ctx.fillText(`${Math.round(state.altitude ?? 0)} m`, 752, 442);

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

        this.drawRoundedRect(ctx, 90, 70, 844, 360, 34, 'rgba(10, 12, 18, 0.92)');
        this.drawRoundedRect(ctx, 106, 86, 812, 328, 28, 'rgba(255, 255, 255, 0.05)');

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 72px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('GAME OVER', canvas.width / 2, 170);

        ctx.fillStyle = 'rgba(255,255,255,0.86)';
        ctx.font = '36px Arial';
        ctx.fillText(`Enemies destroyed: ${state.kills ?? 0}`, canvas.width / 2, 250);

        ctx.fillStyle = 'rgba(255,255,255,0.72)';
        ctx.font = '30px Arial';
        ctx.fillText('Press trigger to restart', canvas.width / 2, 330);

        this.gameOverTexture.needsUpdate = true;
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