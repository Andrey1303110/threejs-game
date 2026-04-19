import * as THREE from 'three';
import { FLIGHT_CONFIG, PLAYER_CONFIG } from './config.js';
import { applyDeadZone } from './utils/math.js';
import { BUTTONS_LEFT, BUTTONS_RIGHT, CONTROLLER_NAME } from './constants.js';

export class PlayerController {
    constructor({ playerRig, camera, renderer, gltf, audioManager }) {
        this.playerRig = playerRig;
        this.camera = camera;
        this.renderer = renderer;
        this.audioManager = audioManager;

        this.currentSpeed = FLIGHT_CONFIG.speed.idle;

        this.tiltVelocity = 0;
        this.yawVelocity = 0;
        this.pitchVelocity = 0; // smooth pitch like tilt/yaw
        this.tiltAngle = 0;
        this.yawAngle = 0;
        this.pitchAngle = 0;

        // speed hold -> falling
        this.minSpeedHoldTimer = 0;
        this.isFalling = false;
        this.fallVelocity = 0;
        this.touchedGround = false;
    this.currentFallSpinRate = 0;

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

        this.model.scale.copy(PLAYER_CONFIG.modelScale);
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
                this.audioManager.updatePlayerEngine(this.currentSpeed, FLIGHT_CONFIG.speed.idle, FLIGHT_CONFIG.speed.max);
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

        // if falling, ignore player input for movement/rotation
        if (!this.isFalling) {
            this.updateManualMovement(input, deltaTime);
            this.updateRotation(input, deltaTime);
        } else {
            // while falling: reduce speed, apply spin and nose-down
            // reduce forward speed toward min
            const loss = FLIGHT_CONFIG.fallSpeedLossRate * deltaTime;
            this.currentSpeed = Math.max(FLIGHT_CONFIG.speed.min, this.currentSpeed - loss);

            // spin yaw
            const spin = this.currentFallSpinRate * deltaTime;
            this.yawGroup.rotation.y += spin;

            // force nose down pitch toward a bigger target
            const targetPitch = FLIGHT_CONFIG.maxPitch * FLIGHT_CONFIG.fallPitchTargetMultiplier;
            const pitchForce = -targetPitch - this.pitchAngle; // negative because nose down is negative pitch in controls
            this.pitchVelocity += pitchForce * FLIGHT_CONFIG.tiltAcceleration * deltaTime;
            this.pitchVelocity *= Math.max(0, 1 - FLIGHT_CONFIG.tiltDamping * deltaTime);
            this.pitchAngle += this.pitchVelocity;
            this.pitchAngle = THREE.MathUtils.clamp(this.pitchAngle, -targetPitch, targetPitch);

            this.tiltGroup.rotation.x = this.pitchAngle;
            this.tiltGroup.rotation.z = this.tiltAngle;
        }

        this.updateForwardMovement(deltaTime);

        if (input.accelerate) {
            this.accelerate(deltaTime);
        }

        if (input.brake) {
            this.brake(deltaTime);
        }

        if (!input.accelerate && !input.brake) {
            // if player isn't giving input, try to slowly recover to idle speed
            const target = FLIGHT_CONFIG.speed.idle;
            const diff = target - this.currentSpeed;
            const step = Math.sign(diff) * Math.min(Math.abs(diff), FLIGHT_CONFIG.autoAcceleration.rate * deltaTime);
            this.currentSpeed += step;
            this.idleBrake(deltaTime);
        }

        // clamp between min and max
        this.currentSpeed = THREE.MathUtils.clamp(this.currentSpeed, FLIGHT_CONFIG.speed.min, FLIGHT_CONFIG.speed.max);

        // min-speed hold handling -> start falling if held for too long
        if (this.currentSpeed <= FLIGHT_CONFIG.speed.min + 1e-6) {
            this.minSpeedHoldTimer += deltaTime;
        } else {
            this.minSpeedHoldTimer = 0;
        }

        if (this.minSpeedHoldTimer >= FLIGHT_CONFIG.minSpeedHoldToFall && !this.isFalling) {
            this.isFalling = true;
            // initialize spin rate when fall starts
            this.currentFallSpinRate = FLIGHT_CONFIG.fallSpinBase || 0;
        }

        if (this.isFalling) {
            // increase fall velocity
            this.fallVelocity += FLIGHT_CONFIG.fallAcceleration * deltaTime;
            this.playerRig.position.y -= this.fallVelocity * deltaTime;

            // grow spin rate over time
            this.currentFallSpinRate += (FLIGHT_CONFIG.fallSpinAccel || 0) * deltaTime;
        }

        if (this.audioManager) {
            this.audioManager.updatePlayerEngine(this.currentSpeed, FLIGHT_CONFIG.speed.idle, FLIGHT_CONFIG.speed.max);
        }

        if (this.mixer) {
            this.mixer.update(deltaTime);
        }

        // ground contact check
        if (this.playerRig.position.y <= 0 && !this.touchedGround) {
            this.touchedGround = true;
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

            const yAxis = source.gamepad.axes[3];
            const xAxis = source.gamepad.axes[2];

            horizontal = applyDeadZone(xAxis ?? 0, FLIGHT_CONFIG.horizontalDeadZone);
            vertical = applyDeadZone(yAxis ?? 0, FLIGHT_CONFIG.verticalDeadZone);

            if (source.handedness === CONTROLLER_NAME.RIGHT) {
                accelerate = (source.gamepad.buttons[BUTTONS_RIGHT.GRIP]?.value ?? 0) > 0;
            }

            if (source.handedness === CONTROLLER_NAME.LEFT) {
                brake = (source.gamepad.buttons[BUTTONS_LEFT.GRIP]?.value ?? 0) > 0;
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

        // smooth pitch like other axes
        const pitchForce = targetPitch - this.pitchAngle;
        this.pitchVelocity += pitchForce * FLIGHT_CONFIG.tiltAcceleration * deltaTime; // reuse tilt accel/damp for pitch feel
        this.pitchVelocity *= Math.max(0, 1 - FLIGHT_CONFIG.tiltDamping * deltaTime);
        this.pitchAngle += this.pitchVelocity;
        this.pitchAngle = THREE.MathUtils.clamp(this.pitchAngle, -FLIGHT_CONFIG.maxPitch, FLIGHT_CONFIG.maxPitch);

        this.tiltGroup.rotation.x = this.pitchAngle;
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
        const minAccel = FLIGHT_CONFIG.speedAcceleration.min;   // минимальное ускорение у верхней границы
        const maxAccel = FLIGHT_CONFIG.speedAcceleration.max;   // ускорение на низкой скорости

        const speedRatio = THREE.MathUtils.clamp(
            (this.currentSpeed - FLIGHT_CONFIG.speed.idle) / (FLIGHT_CONFIG.speed.max - FLIGHT_CONFIG.speed.idle),
            0,
            1
        );

        // параболическое затухание ускорения
        const accelFactor = 1 - speedRatio * speedRatio;
        const acceleration = minAccel + (maxAccel - minAccel) * accelFactor;
        this.currentSpeed += acceleration * deltaTime;
    }

    brake(deltaTime) {
        const minBrake = FLIGHT_CONFIG.braking.min;   // у нижней границы
        const maxBrake = FLIGHT_CONFIG.braking.max;   // на высокой скорости

        const speedRatio = THREE.MathUtils.clamp(
            (this.currentSpeed - FLIGHT_CONFIG.speed.idle) / (FLIGHT_CONFIG.speed.max - FLIGHT_CONFIG.speed.idle),
            0,
            1
        );

        // чем выше скорость, тем сильнее торможение
        const deceleration = minBrake + (maxBrake - minBrake) * (speedRatio * speedRatio);

        this.currentSpeed -= deceleration * deltaTime;
    }

    idleBrake(deltaTime) {
        const minBrake = FLIGHT_CONFIG.idleBraking.min;   // почти нет торможения у дефолтной
        const maxBrake = FLIGHT_CONFIG.idleBraking.max;   // заметное торможение на высокой скорости

        const speedRatio = THREE.MathUtils.clamp(
            (this.currentSpeed - FLIGHT_CONFIG.speed.idle) / (FLIGHT_CONFIG.speed.max - FLIGHT_CONFIG.speed.idle),
            0,
            1
        );

        // возле FLIGHT_CONFIG.speed.idle торможение почти исчезает
        const deceleration = minBrake + (maxBrake - minBrake) * (speedRatio * speedRatio);

        this.currentSpeed -= deceleration * deltaTime;
    }

    reset() {
        this.playerRig.position.copy(PLAYER_CONFIG.position);
        this.playerRig.rotation.copy(PLAYER_CONFIG.rotation);

        this.currentSpeed = FLIGHT_CONFIG.speed.idle;

        this.tiltVelocity = 0;
        this.yawVelocity = 0;
        this.tiltAngle = 0;
        this.yawAngle = 0;

        // clear falling state
        this.pitchVelocity = 0;
        this.pitchAngle = 0;
        this.minSpeedHoldTimer = 0;
        this.isFalling = false;
        this.fallVelocity = 0;
        this.touchedGround = false;
        this.currentFallSpinRate = 0;

        this.yawGroup.rotation.copy(PLAYER_CONFIG.rotation);
        this.tiltGroup.rotation.copy(PLAYER_CONFIG.rotation);

        if (this.audioManager) {
            this.audioManager.updatePlayerEngine(this.currentSpeed, FLIGHT_CONFIG.speed.idle, FLIGHT_CONFIG.speed.max);
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