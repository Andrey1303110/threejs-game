import * as THREE from 'three';
import { BULLET_CONFIG } from './config.js';
import { BUTTONS_RIGHT, CONTROLLER_NAME } from './constants.js';

export class BulletSystem {
    constructor(scene, renderer, gameState, audioManager) {
        this.scene = scene;
        this.renderer = renderer;
        this.gameState = gameState;
        this.audioManager = audioManager;

        this.bullets = [];
        this.lastShootTime = 0;

        this.wasTriggerPressed = {
            left: false,
            right: false
        };

        this._expandedBox = new THREE.Box3();
        this._bulletSphere = new THREE.Sphere();

        this.bulletGeometry = new THREE.SphereGeometry(BULLET_CONFIG.radius, 8, 8);
        this.bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    }

    update(deltaTime, enemies, buildings, playerController, elapsedTime) {
        if (!this.gameState.isGameOver) {
            this.handleXRShot(playerController, elapsedTime);
        }

        this.updateBullets(deltaTime, enemies, buildings);
    }

    handleXRShot(playerController, elapsedTime) {
        if (!this.renderer.xr.isPresenting) return;

        const session = this.renderer.xr.getSession();
        if (!session) return;

        for (const source of session.inputSources) {
            if (!source.gamepad) continue;

            const handedness = source.handedness || 'unknown';
            if (handedness !== CONTROLLER_NAME.RIGHT) continue;

            const triggerPressed = !!source.gamepad.buttons[BUTTONS_RIGHT.TRIGGER]?.pressed;
            const wasPressed = this.wasTriggerPressed[handedness];

            if (triggerPressed && !wasPressed) {
                this.shoot(playerController, elapsedTime);
            }

            this.wasTriggerPressed[handedness] = triggerPressed;
        }
    }

    shoot(playerController, elapsedTime) {
        if (elapsedTime <= this.lastShootTime + BULLET_CONFIG.reloadTime) {
            return;
        }

        const bullet = new THREE.Mesh(this.bulletGeometry, this.bulletMaterial);

        const { spawnPosition, direction } = playerController.getShootTransform();
        spawnPosition.addScaledVector(direction, BULLET_CONFIG.muzzleOffset);

        bullet.position.copy(spawnPosition);
        bullet.velocity = direction.clone().multiplyScalar(BULLET_CONFIG.initialSpeed);
        bullet.gravity = BULLET_CONFIG.gravity.clone();
        bullet.drag = BULLET_CONFIG.drag;
        bullet.lifetime = BULLET_CONFIG.lifetime;

        this.scene.add(bullet);
        this.bullets.push(bullet);
        this.lastShootTime = elapsedTime;

        if (this.audioManager) {
            this.audioManager.playShot(playerController.player, 1);
        }
    }

    updateBullets(deltaTime, enemies, buildings) {
        if (!this.bullets.length) return;

        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];

            bullet.velocity.addScaledVector(bullet.gravity, deltaTime);

            const dragFactor = Math.max(0, 1 - bullet.drag * deltaTime);
            bullet.velocity.multiplyScalar(dragFactor);

            bullet.position.addScaledVector(bullet.velocity, deltaTime);
            bullet.lifetime -= deltaTime;

            let bulletRemoved = false;

            // =========================
            // Попадание во врагов
            // =========================
            for (let j = enemies.length - 1; j >= 0; j--) {
                const enemy = enemies[j];
                const distance = bullet.position.distanceTo(enemy.position);

                if (distance < BULLET_CONFIG.hitDistance) {
                    this.removeEnemy(enemy);
                    this.removeBulletByIndex(i);
                    enemies.splice(j, 1);

                    this.gameState.addKill();

                    bulletRemoved = true;
                    break;
                }
            }

            if (bulletRemoved) continue;

            // =========================
            // Попадание в здания
            // =========================
            for (let j = 0; j < buildings.length; j++) {
                const building = buildings[j];

                if (!building.collisionBox) continue;

                this._expandedBox
                    .copy(building.collisionBox)
                    .expandByScalar(BULLET_CONFIG.radius);

                this._bulletSphere.center.copy(bullet.position);
                this._bulletSphere.radius = BULLET_CONFIG.radius;

                if (this._expandedBox.intersectsSphere(this._bulletSphere)) {
                    this.removeBulletByIndex(i);
                    bulletRemoved = true;
                    break;
                }
            }

            if (bulletRemoved) continue;

            // =========================
            // Удаление по времени жизни
            // =========================
            if (bullet.lifetime <= 0 || bullet.position.y < 0) {
                this.removeBulletByIndex(i);
            }
        }
    }

    removeEnemy(enemy) {
        if (enemy.userData.engineAudio) {
            if (enemy.userData.engineAudio.isPlaying) {
                enemy.userData.engineAudio.stop();
            }
            enemy.userData.engineAudio.disconnect();
        }

        if (enemy.mixer) {
            enemy.mixer.stopAllAction();
            enemy.mixer.uncacheRoot(enemy);
        }

        this.scene.remove(enemy);
    }

    removeBulletByIndex(index) {
        const bullet = this.bullets[index];
        if (!bullet) return;

        this.scene.remove(bullet);
        this.bullets.splice(index, 1);
    }

    reset() {
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            this.scene.remove(this.bullets[i]);
        }

        this.bullets = [];
        this.lastShootTime = 0;

        this.wasTriggerPressed.left = false;
        this.wasTriggerPressed.right = false;
    }

    dispose() {
        this.reset();
        this.bulletGeometry.dispose();
        this.bulletMaterial.dispose();
    }
}