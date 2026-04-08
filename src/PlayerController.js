import * as THREE from 'three';
import { DEFAULT_SPEED, MAX_SPEED, FLIGHT_CONFIG } from './config.js';
import { applyDeadZone } from './utils/utilityFunctions.js';

export class PlayerController {
    constructor({ playerRig, camera, renderer, gltf }) {
        this.playerRig = playerRig;
        this.camera = camera;
        this.renderer = renderer;

        this.currentSpeed = DEFAULT_SPEED;

        this.tiltVelocity = 0;
        this.yawVelocity = 0;
        this.tiltAngle = 0;
        this.yawAngle = 0;

        this._forward = new THREE.Vector3();
        this._right = new THREE.Vector3();
        this._dronePosition = new THREE.Vector3();
        this._quaternion = new THREE.Quaternion();

        this.createPlayer(gltf);
    }

    createPlayer(gltf) {
        const debugGeometry = new THREE.BoxGeometry(2.5, 0.75, 2.25);
        const debugMaterial = new THREE.MeshBasicMaterial({
            color: 0xff00ff,
            visible: false
        });
        const debugMesh = new THREE.Mesh(debugGeometry, debugMaterial);

        this.player = new THREE.Group();
        this.yawGroup = new THREE.Group();
        this.tiltGroup = new THREE.Group();
        this.modelRoot = new THREE.Group();
        this.model = gltf.scene;

        this.model.scale.set(2.25, 2.25, 2.25);
        this.modelRoot.rotation.y = Math.PI / 2;

        this.model.add(debugMesh);
        this.mesh = debugMesh;

        this.modelRoot.add(this.model);
        this.tiltGroup.add(this.modelRoot);
        this.yawGroup.add(this.tiltGroup);
        this.player.add(this.yawGroup);
        this.playerRig.add(this.player);

        this.mixer = new THREE.AnimationMixer(this.model);
        this.animations = {};

        gltf.animations.forEach((clip) => {
            this.animations[clip.name.toLowerCase()] = clip;
        });

        this.playAnimation('fuselage');
    }

    playAnimation(name) {
        const clip = this.animations[name?.toLowerCase()];
        if (!clip) return;

        const action = this.mixer.clipAction(clip);
        action.reset();
        action.play();

        if (this.currentAction) {
            this.currentAction.crossFadeTo(action, 0.5, false);
        }

        this.currentAction = action;
    }

    update(deltaTime) {
        const input = this.readXRInput();

        this.updateManualMovement(input, deltaTime);
        this.updateRotation(input, deltaTime);
        this.updateForwardMovement(deltaTime);

        if (input.accelerate) this.accelerate();
        if (input.brake) this.brake();

        this.currentSpeed = THREE.MathUtils.clamp(this.currentSpeed, 5, MAX_SPEED);

        if (this.mixer) {
            this.mixer.update(deltaTime);
        }
    }

    readXRInput() {
        let horizontal = 0;
        let vertical = 0;
        let accelerate = false;
        let brake = false;

        if (!this.renderer.xr.isPresenting) {
            return { horizontal, vertical, accelerate, brake };
        }

        const session = this.renderer.xr.getSession();
        if (!session) {
            return { horizontal, vertical, accelerate, brake };
        }

        for (const source of session.inputSources) {
            if (!source.gamepad) continue;

            const axes = source.gamepad.axes;
            horizontal = applyDeadZone(axes[2] ?? 0, FLIGHT_CONFIG.horizontalDeadZone);
            vertical = applyDeadZone(axes[3] ?? 0, FLIGHT_CONFIG.verticalDeadZone);

            if (source.handedness === 'right') {
                accelerate = (source.gamepad.buttons[1]?.value ?? 0) > 0;
            }

            if (source.handedness === 'left') {
                brake = (source.gamepad.buttons[1]?.value ?? 0) > 0;
            }
        }

        return { horizontal, vertical, accelerate, brake };
    }

    updateManualMovement(input, deltaTime) {
        this._right.set(1, 0, 0);
        this._right.applyQuaternion(this.playerRig.quaternion);

        this.playerRig.position.addScaledVector(
            this._right,
            input.horizontal * FLIGHT_CONFIG.lateralMoveSpeed * deltaTime
        );

        this.playerRig.position.y += -input.vertical * FLIGHT_CONFIG.verticalMoveSpeed * deltaTime;
    }

    updateRotation(input, deltaTime) {
        const inputCurve = input.horizontal * Math.abs(input.horizontal);

        const targetTilt = -inputCurve * FLIGHT_CONFIG.maxTilt;
        const targetYaw = -inputCurve * FLIGHT_CONFIG.maxYaw;
        const targetPitch = -input.vertical * FLIGHT_CONFIG.maxPitch;

        const tiltForce = targetTilt - this.tiltAngle;
        this.tiltVelocity += tiltForce * FLIGHT_CONFIG.tiltAcceleration * deltaTime;
        this.tiltVelocity *= Math.max(0, 1 - FLIGHT_CONFIG.tiltDamping * deltaTime);
        this.tiltAngle += this.tiltVelocity;
        this.tiltAngle = THREE.MathUtils.clamp(
            this.tiltAngle,
            -FLIGHT_CONFIG.maxTilt,
            FLIGHT_CONFIG.maxTilt
        );

        const yawForce = targetYaw - this.yawAngle;
        this.yawVelocity += yawForce * FLIGHT_CONFIG.yawAcceleration * deltaTime;
        this.yawVelocity *= Math.max(0, 1 - FLIGHT_CONFIG.yawDamping * deltaTime);
        this.yawAngle += this.yawVelocity;
        this.yawAngle = THREE.MathUtils.clamp(
            this.yawAngle,
            -FLIGHT_CONFIG.maxYaw,
            FLIGHT_CONFIG.maxYaw
        );

        this.yawGroup.rotation.y = this.yawAngle;
        this.tiltGroup.rotation.x = targetPitch;
        this.tiltGroup.rotation.z = this.tiltAngle;
    }

    updateForwardMovement(deltaTime) {
        this._forward.set(0, 0, -1);
        this.yawGroup.getWorldQuaternion(this._quaternion);
        this._forward.applyQuaternion(this._quaternion);

        this.playerRig.position.addScaledVector(
            this._forward,
            this.currentSpeed * deltaTime
        );
    }

    updateCamera() {
        this.player.getWorldPosition(this._dronePosition);
        this.camera.lookAt(this._dronePosition);
    }

    updateCollisions(buildings, enemies) {
        this.mesh.updateMatrixWorld(true);

        if (!this.boundingBox) {
            this.boundingBox = new THREE.Box3().setFromObject(this.mesh);
        } else {
            this.boundingBox.copy(this.mesh.geometry.boundingBox).applyMatrix4(this.mesh.matrixWorld);
        }

        this.checkBuildingCollisions(buildings);
        this.checkEnemyCollisions(enemies);
    }

    checkBuildingCollisions(buildings) {
        buildings.forEach((build) => {
            build.updateMatrixWorld(true);

            build.traverse((child) => {
                if (!(child instanceof THREE.Mesh)) return;

                if (!child.geometry.boundingBox) {
                    child.geometry.computeBoundingBox();
                }

                if (!child.boundingBox) {
                    child.boundingBox = new THREE.Box3();
                }

                child.boundingBox.copy(child.geometry.boundingBox).applyMatrix4(child.matrixWorld);

                if (this.boundingBox.intersectsBox(child.boundingBox)) {
                    console.log('player to city collision detected');
                }
            });
        });
    }

    checkEnemyCollisions(enemies) {
        enemies.forEach((enemy) => {
            enemy.updateMatrixWorld(true);

            enemy.traverse((child) => {
                if (!(child instanceof THREE.Mesh)) return;

                if (!child.geometry.boundingBox) {
                    child.geometry.computeBoundingBox();
                }

                if (!child.boundingBox) {
                    child.boundingBox = new THREE.Box3();
                }

                child.boundingBox.copy(child.geometry.boundingBox).applyMatrix4(child.matrixWorld);

                if (this.boundingBox.intersectsBox(child.boundingBox)) {
                    console.log('player to enemy collision detected');
                }
            });
        });
    }

    getShootTransform() {
        this.player.updateMatrixWorld(true);

        const spawnPosition = new THREE.Vector3();
        const direction = new THREE.Vector3(0, 0, -1);
        const worldQuaternion = new THREE.Quaternion();

        this.player.getWorldPosition(spawnPosition);
        this.tiltGroup.getWorldQuaternion(worldQuaternion);
        direction.applyQuaternion(worldQuaternion).normalize();

        return { spawnPosition, direction };
    }

    accelerate() {
        this.currentSpeed = Math.min(this.currentSpeed + 0.15, MAX_SPEED);
    }

    brake() {
        this.currentSpeed = Math.max(this.currentSpeed - 0.5, DEFAULT_SPEED);
    }

    dispose() {
        if (this.mixer) {
            this.mixer.stopAllAction();
            this.mixer.uncacheRoot(this.model);
        }
    }
}