import * as THREE from 'three';
import { DEFAULT_SPEED, MAX_SPEED, FLIGHT_CONFIG } from './config.js';
import { applyDeadZone } from './utils/math.js';
import { CONTROLLER_NAME } from './constants.js';

export class PlayerController {
    constructor({ playerRig, camera, renderer, gltf, audioManager }) {
        this.playerRig = playerRig;
        this.camera = camera;
        this.renderer = renderer;
        this.audioManager = audioManager;

        this.currentSpeed = DEFAULT_SPEED;

        this.tiltVelocity = 0;
        this.yawVelocity = 0;
        this.tiltAngle = 0;
        this.yawAngle = 0;

        this._forward = new THREE.Vector3();
        this._right = new THREE.Vector3();
        this._dronePosition = new THREE.Vector3();
        this._quaternion = new THREE.Quaternion();

        this.engineAudio = null;

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

        if (this.audioManager) {
            this.engineAudio = this.audioManager.createPlayerEngineAudio(this.player);
            if (this.engineAudio) {
                this.audioManager.startPlayerEngine();
                this.audioManager.updatePlayerEngine(this.currentSpeed, DEFAULT_SPEED, MAX_SPEED);
            }
        }
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

        if (input.accelerate) {
            this.accelerate(deltaTime);
        }

        if (input.brake) {
            this.brake(deltaTime);
        }

        if (!input.accelerate && !input.brake) {
            this.idleBrake(deltaTime);
        }

        this.currentSpeed = THREE.MathUtils.clamp(this.currentSpeed, DEFAULT_SPEED, MAX_SPEED);

        if (this.audioManager) {
            this.audioManager.updatePlayerEngine(this.currentSpeed, DEFAULT_SPEED, MAX_SPEED);
        }

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

            if (source.handedness === CONTROLLER_NAME.RIGHT) {
                accelerate = (source.gamepad.buttons[1]?.value ?? 0) > 0;
            }

            if (source.handedness === CONTROLLER_NAME.LEFT) {
                brake = (source.gamepad.buttons[1]?.value ?? 0) > 0;
            }
        }

        return { horizontal, vertical, accelerate, brake };
    }

    updateManualMovement(input, deltaTime) {
        const { up, down } = FLIGHT_CONFIG.verticalMoveSpeed;

        this._right.set(1, 0, 0);
        this._right.applyQuaternion(this.playerRig.quaternion);

        this.playerRig.position.addScaledVector(
            this._right,
            input.horizontal * FLIGHT_CONFIG.lateralMoveSpeed * deltaTime
        );

        let position = 0;

        if (input.vertical > 0) {
            position = -input.vertical * down * deltaTime;
        } else if (input.vertical < 0) {
            position = -input.vertical * up * deltaTime;
        }

        this.playerRig.position.y += position;
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

        return this.checkBuildingCollisions(buildings) || this.checkEnemyCollisions(enemies);
    }

    checkBuildingCollisions(buildings) {
        for (const build of buildings) {
            build.updateMatrixWorld(true);

            let collided = false;

            build.traverse((child) => {
                if (!(child instanceof THREE.Mesh) || collided) return;

                if (!child.geometry.boundingBox) {
                    child.geometry.computeBoundingBox();
                }

                if (!child.boundingBox) {
                    child.boundingBox = new THREE.Box3();
                }

                child.boundingBox.copy(child.geometry.boundingBox).applyMatrix4(child.matrixWorld);

                if (this.boundingBox.intersectsBox(child.boundingBox)) {
                    collided = true;
                }
            });

            if (collided) {
                return true;
            }
        }

        return false;
    }

    checkEnemyCollisions(enemies) {
        for (const enemy of enemies) {
            enemy.updateMatrixWorld(true);

            let collided = false;

            enemy.traverse((child) => {
                if (!(child instanceof THREE.Mesh) || collided) return;

                if (!child.geometry.boundingBox) {
                    child.geometry.computeBoundingBox();
                }

                if (!child.boundingBox) {
                    child.boundingBox = new THREE.Box3();
                }

                child.boundingBox.copy(child.geometry.boundingBox).applyMatrix4(child.matrixWorld);

                if (this.boundingBox.intersectsBox(child.boundingBox)) {
                    collided = true;
                }
            });

            if (collided) {
                return true;
            }
        }

        return false;
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

    accelerate(deltaTime) {
        const minAccel = 0.1;   // минимальное ускорение у верхней границы
        const maxAccel = 2.25;   // ускорение на низкой скорости

        const speedRatio = THREE.MathUtils.clamp(
            (this.currentSpeed - DEFAULT_SPEED) / (MAX_SPEED - DEFAULT_SPEED),
            0,
            1
        );

        // параболическое затухание ускорения
        const accelFactor = 1 - speedRatio * speedRatio;
        const acceleration = minAccel + (maxAccel - minAccel) * accelFactor;
        this.currentSpeed += acceleration * deltaTime;
    }

    brake(deltaTime) {
        const minBrake = 3;   // у нижней границы
        const maxBrake = 6;   // на высокой скорости

        const speedRatio = THREE.MathUtils.clamp(
            (this.currentSpeed - DEFAULT_SPEED) / (MAX_SPEED - DEFAULT_SPEED),
            0,
            1
        );

        // чем выше скорость, тем сильнее торможение
        const deceleration = minBrake + (maxBrake - minBrake) * (speedRatio * speedRatio);

        this.currentSpeed -= deceleration * deltaTime;
    }

    idleBrake(deltaTime) {
        const minBrake = 0.35;   // почти нет торможения у дефолтной
        const maxBrake = 3;   // заметное торможение на высокой скорости

        const speedRatio = THREE.MathUtils.clamp(
            (this.currentSpeed - DEFAULT_SPEED) / (MAX_SPEED - DEFAULT_SPEED),
            0,
            1
        );

        // возле DEFAULT_SPEED торможение почти исчезает
        const deceleration = minBrake + (maxBrake - minBrake) * (speedRatio * speedRatio);

        this.currentSpeed -= deceleration * deltaTime;
    }

    reset() {
        this.playerRig.position.set(0, 80, 0);
        this.playerRig.rotation.set(0, 0, 0);

        this.currentSpeed = DEFAULT_SPEED;

        this.tiltVelocity = 0;
        this.yawVelocity = 0;
        this.tiltAngle = 0;
        this.yawAngle = 0;

        this.yawGroup.rotation.set(0, 0, 0);
        this.tiltGroup.rotation.set(0, 0, 0);

        if (this.audioManager) {
            this.audioManager.updatePlayerEngine(this.currentSpeed, DEFAULT_SPEED, MAX_SPEED);
        }
    }

    dispose() {
        if (this.engineAudio && this.engineAudio.isPlaying) {
            this.engineAudio.stop();
        }

        if (this.mixer) {
            this.mixer.stopAllAction();
            this.mixer.uncacheRoot(this.model);
        }
    }
}