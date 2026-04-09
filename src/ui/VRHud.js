import * as THREE from 'three';

export class VRHud {
    constructor(camera) {
        this.camera = camera;

        this.root = new THREE.Group();
        this.root.position.set(0, -0.15, -1.2);

        this.hudCanvas = document.createElement('canvas');
        this.hudCanvas.width = 1024;
        this.hudCanvas.height = 512;
        this.hudCtx = this.hudCanvas.getContext('2d');

        this.hudTexture = new THREE.CanvasTexture(this.hudCanvas);
        this.hudTexture.needsUpdate = true;

        this.hudMaterial = new THREE.MeshBasicMaterial({
            map: this.hudTexture,
            transparent: true,
            depthTest: false,
            depthWrite: false
        });

        this.hudMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(0.9, 0.45),
            this.hudMaterial
        );
        this.hudMesh.position.set(0, 0, 0);
        this.root.add(this.hudMesh);

        this.gameOverCanvas = document.createElement('canvas');
        this.gameOverCanvas.width = 1024;
        this.gameOverCanvas.height = 512;
        this.gameOverCtx = this.gameOverCanvas.getContext('2d');

        this.gameOverTexture = new THREE.CanvasTexture(this.gameOverCanvas);
        this.gameOverTexture.needsUpdate = true;

        this.gameOverMaterial = new THREE.MeshBasicMaterial({
            map: this.gameOverTexture,
            transparent: true,
            depthTest: false,
            depthWrite: false
        });

        this.gameOverMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(1.1, 0.55),
            this.gameOverMaterial
        );
        this.gameOverMesh.position.set(0, -0.18, 0);
        this.gameOverMesh.visible = false;
        this.root.add(this.gameOverMesh);

        this.camera.add(this.root);

        this.render({
            kills: 0,
            isGameOver: false
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

        this.drawRoundedRect(ctx, 24, 24, 360, 120, 26, 'rgba(12, 18, 28, 0.78)');
        this.drawRoundedRect(ctx, 32, 32, 344, 104, 20, 'rgba(255, 255, 255, 0.06)');

        ctx.fillStyle = 'rgba(255,255,255,0.72)';
        ctx.font = '28px Arial';
        ctx.textBaseline = 'middle';
        ctx.fillText('KILLS', 64, 84);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 54px Arial';
        ctx.fillText(String(state.kills), 250, 84);

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
        ctx.fillText(`Enemies destroyed: ${state.kills}`, canvas.width / 2, 250);

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