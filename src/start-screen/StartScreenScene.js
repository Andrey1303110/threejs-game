import * as THREE from 'three';
import { CONTROLLER_NAME } from '../constants';

const BASE_DISTANCE = -4;
const BASE_HEIGHT = 0.8;

export class StartScreenScene {
    constructor({ renderer, gltf, onStart }) {
        this.renderer = renderer;
        this.gltf = gltf;
        this.onStart = onStart;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x05070b);
        this.scene.fog = new THREE.FogExp2(0x05070b, 0.12);

        this.camera = new THREE.PerspectiveCamera(
            50,
            window.innerWidth / window.innerHeight,
            0.1,
            100
        );
        this.camera.position.set(0, 0.15, 0);

        this.clock = new THREE.Clock();

        this.raycaster = new THREE.Raycaster();
        this.tempMatrix = new THREE.Matrix4();

        this.triggerPressedLastFrame = {
            left: false,
            right: false
        };

        this.createLights();
        this.createXRControllers();
        this.createLayout();
        this.createDronePreview();
    }

    createLights() {
        const ambient = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambient);

        const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
        keyLight.position.set(2.5, 2.2, 3.2);
        this.scene.add(keyLight);

        const fillLight = new THREE.DirectionalLight(0x7d9bff, 1.0);
        fillLight.position.set(-2.2, 1.2, 1.5);
        this.scene.add(fillLight);

        const rimLight = new THREE.DirectionalLight(0x88aaff, 0.8);
        rimLight.position.set(-1.5, 0.8, 2.0);
        this.scene.add(rimLight);
    }

    createXRControllers() {
        this.controller1 = this.renderer.xr.getController(0);
        this.controller2 = this.renderer.xr.getController(1);

        const geometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, -1)
        ]);

        const material = new THREE.LineBasicMaterial({ color: 0xffffff });

        const line1 = new THREE.Line(geometry, material.clone());
        line1.name = 'ray';
        line1.scale.z = 3;
        this.controller1.add(line1);

        const line2 = new THREE.Line(geometry, material.clone());
        line2.name = 'ray';
        line2.scale.z = 3;
        this.controller2.add(line2);

        this.scene.add(this.controller1);
        this.scene.add(this.controller2);
    }

    createLayout() {
        this.root = new THREE.Group();
        this.root.position.set(0, BASE_HEIGHT, BASE_DISTANCE);
        this.scene.add(this.root);

        const rightPanel = this.createPanel({
            width: 2,
            height: 1.75,
            x: 1.55,
            y: 0,
            z: 0,
            color: 'rgba(12, 14, 20, 0.8)',
            borderColor: 'rgba(255,255,255,0.05)'
        });

        this.root.add(rightPanel);

        this.titleMesh = this.createTextPlane({
            width: 2.3,
            height: 0.7,
            fontSize: 72,
            text: 'SHAHED GAME',
            subText: 'VR FLIGHT',
            bg: 'rgba(0,0,0,0)',
            color: '#ffffff',
            subColor: 'rgba(255,255,255,0.65)'
        });
        this.titleMesh.position.set(1.55, 1.2, 0.15);
        this.root.add(this.titleMesh);

        this.subtitleMesh = this.createTextPlane({
            width: 1.75,
            height: 0.4,
            fontSize: 35,
            text: 'Press trigger on START',
            bg: 'rgba(0,0,0,0)',
            color: 'rgba(255,255,255,0.82)'
        });
        this.subtitleMesh.position.set(1.55, 0.55, 0.1);
        this.root.add(this.subtitleMesh);

        this.startButton = this.createButtonPlane({
            width: 1.75,
            height: 0.52,
            text: 'START',
            bg: '#ffffff',
            color: '#11141a',
            border: 'rgba(255,255,255,0.18)'
        });
        this.startButton.position.set(1.55, 0.15, 0.08);
        this.root.add(this.startButton);
    }

    createDronePreview() {
        this.previewRoot = new THREE.Group();
        this.previewRoot.position.set(-2.2, 0.1, 0.35);
        this.root.add(this.previewRoot);

        const floorGeometry = new THREE.CircleGeometry(0.95, 64);
        const floorMaterial = new THREE.MeshBasicMaterial({
            color: 0x10141b,
            transparent: true,
            opacity: 0.95,
            side: THREE.DoubleSide
        });

        this.previewFloor = new THREE.Mesh(floorGeometry, floorMaterial);
        this.previewFloor.rotation.x = -Math.PI / 2;
        this.previewFloor.position.set(0, -1.6, 0.4);
        this.previewRoot.add(this.previewFloor);

        this.previewModelRoot = new THREE.Group();
        this.previewRoot.add(this.previewModelRoot);

        this.previewModel = this.gltf.scene.clone(true);
        this.previewModel.scale.set(1, 1, 1);
        this.previewModel.rotation.y = Math.PI * 1.75;
        this.previewModel.position.set(0, -0.4, 0.4);
        this.previewModelRoot.add(this.previewModel);

        this.previewMixer = new THREE.AnimationMixer(this.previewModel);

        const fuselageAnimation = this.gltf.animations.find(
            (clip) => clip.name.toLowerCase() === 'fuselage'
        );

        if (fuselageAnimation) {
            const action = this.previewMixer.clipAction(fuselageAnimation);
            action.play();
        }
    }

    update(deltaTime) {
        if (this.previewMixer) {
            this.previewMixer.update(deltaTime);
        }

        this.updateButtonInteraction();
    }

    updateButtonInteraction() {
        if (!this.renderer.xr.isPresenting) {
            this.setButtonHover(false);
            return;
        }

        const session = this.renderer.xr.getSession();
        if (!session) {
            this.setButtonHover(false);
            return;
        }

        let isHovered = false;

        for (const source of session.inputSources) {
            if (!source.gamepad) continue;

            const controllerIndex = source.handedness === CONTROLLER_NAME.LEFT ? 0 : 1;
            const controller = this.renderer.xr.getController(controllerIndex);
            if (!controller) continue;

            controller.updateMatrixWorld(true);

            this.tempMatrix.identity().extractRotation(controller.matrixWorld);
            this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
            this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tempMatrix).normalize();

            const intersections = this.raycaster.intersectObject(this.startButton, false);

            const triggerPressed = !!source.gamepad.buttons[0]?.pressed;
            const wasPressed = this.triggerPressedLastFrame[source.handedness] ?? false;

            if (intersections.length > 0) {
                isHovered = true;

                if (triggerPressed && !wasPressed) {
                    this.onStart?.();
                }
            }

            this.triggerPressedLastFrame[source.handedness] = triggerPressed;
        }

        this.setButtonHover(isHovered);
    }

    setButtonHover(isHovered) {
        if (this.startButton.userData.isHovered === isHovered) return;

        this.startButton.userData.isHovered = isHovered;

        const canvas = this.startButton.userData.canvas;
        const ctx = this.startButton.userData.ctx;
        const texture = this.startButton.userData.texture;

        this.drawButton({
            ctx,
            canvas,
            text: 'START',
            bg: isHovered ? '#d6dce8' : '#ffffff',
            color: '#11141a',
            border: isHovered ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.18)'
        });

        texture.needsUpdate = true;
    }

    resize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
    }

    render(renderer) {
        renderer.render(this.scene, this.camera);
    }

    createPanel({ width, height, x, y, z, color, borderColor }) {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');

        this.drawRoundedRect(ctx, 24, 24, 976, 976, 56, color);
        this.drawRoundedRect(ctx, 28, 28, 968, 968, 52, borderColor, true);

        const texture = new THREE.CanvasTexture(canvas);
        const material = this.createCanvasMaterial(texture);

        const mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(width, height),
            material
        );
        mesh.position.set(x, y, z);
        mesh.renderOrder = 10;

        return mesh;
    }

    createTextPlane({ width, height, text, subText = '', fontSize = 40, bg = 'rgba(0,0,0,0)', color = '#fff', subColor = '#aaa' }) {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (bg !== 'rgba(0,0,0,0)') {
            this.drawRoundedRect(ctx, 0, 0, canvas.width, canvas.height, 24, bg);
        }

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillStyle = color;
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.fillText(text, canvas.width / 2, subText ? 92 : 128);

        if (subText) {
            ctx.fillStyle = subColor;
            ctx.font = '28px Arial';
            ctx.fillText(subText, canvas.width / 2, 168);
        }

        const texture = new THREE.CanvasTexture(canvas);
        const material = this.createCanvasMaterial(texture);

        const mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(width, height),
            material
        );
        mesh.renderOrder =20;

        return mesh;
    }

    createButtonPlane({ width, height, text, bg, color, border }) {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 384;
        const ctx = canvas.getContext('2d');

        this.drawButton({ ctx, canvas, text, bg, color, border });

        const texture = new THREE.CanvasTexture(canvas);
        const material = this.createCanvasMaterial(texture);

        const mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(width, height),
            material
        );

        mesh.userData.canvas = canvas;
        mesh.userData.ctx = ctx;
        mesh.userData.texture = texture;
        mesh.userData.isHovered = false;
        mesh.renderOrder = 30;

        return mesh;
    }

    drawButton({ ctx, canvas, text, bg, color, border }) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        this.drawRoundedRect(ctx, 24, 24, canvas.width - 48, canvas.height - 48, 50, bg);
        this.drawRoundedRect(ctx, 28, 28, canvas.width - 56, canvas.height - 56, 46, border, true);

        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 96px Arial';
        ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 6);
    }

    drawRoundedRect(ctx, x, y, width, height, radius, fillStyle, stroke = false) {
        ctx.save();

        if (!stroke) {
            ctx.fillStyle = fillStyle;
        } else {
            ctx.strokeStyle = fillStyle;
            ctx.lineWidth = 4;
        }

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

        if (stroke) {
            ctx.stroke();
        } else {
            ctx.fill();
        }

        ctx.restore();
    }

    createCanvasMaterial(texture) {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.generateMipmaps = false;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.needsUpdate = true;

        return new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthTest: false,
            depthWrite: false,
            side: THREE.DoubleSide
        });
    }

    dispose() {
        if (this.previewMixer) {
            this.previewMixer.stopAllAction();
            this.previewMixer.uncacheRoot(this.previewModel);
        }

        this.scene.traverse((obj) => {
            if (obj.geometry) obj.geometry.dispose();

            if (obj.material) {
                if (Array.isArray(obj.material)) {
                    obj.material.forEach((mat) => mat.dispose());
                } else {
                    obj.material.dispose();
                }
            }
        });
    }
}