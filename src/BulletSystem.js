import * as THREE from 'three';
import { BULLET_CONFIG } from './config.js';

export class BulletSystem {
    constructor(scene, renderer) {
        this.scene = scene;
        this.renderer = renderer;

        this.bullets = [];
        this.lastShootTime = 0;

        this.wasTriggerPressed = {
            left: false,
            right: false
        };

        this.bulletGeometry = new THREE.SphereGeometry(BULLET_CONFIG.radius, 8, 8);
        this.bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    }

    update(deltaTime, enemies, playerController, elapsedTime) {
        this.handleXRShot(playerController, elapsedTime);
        this.updateBullets(deltaTime, enemies);
    }

    handleXRShot(playerController, elapsedTime) {
        if (!this.renderer.xr.isPresenting) return;

        const session = this.renderer.xr.getSession();
        if (!session) return;

        for (const source of session.inputSources) {
            if (!source.gamepad) continue;

            const handedness = source.handedness || 'unknown';
            if (handedness !== 'left' && handedness !== 'right') continue;

            const triggerPressed = !!source.gamepad.buttons[0]?.pressed;
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
    }

    updateBullets(deltaTime, enemies) {
        if (!this.bullets.length) return;

        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];

            bullet.velocity.addScaledVector(bullet.gravity, deltaTime);

            const dragFactor = Math.max(0, 1 - bullet.drag * deltaTime);
            bullet.velocity.multiplyScalar(dragFactor);

            bullet.position.addScaledVector(bullet.velocity, deltaTime);
            bullet.lifetime -= deltaTime;

            let bulletRemoved = false;

            for (let j = enemies.length - 1; j >= 0; j--) {
                const enemy = enemies[j];
                const distance = bullet.position.distanceTo(enemy.position);

                if (distance < BULLET_CONFIG.hitDistance) {
                    this.scene.remove(bullet);
                    this.scene.remove(enemy);

                    this.bullets.splice(i, 1);
                    enemies.splice(j, 1);

                    bulletRemoved = true;
                    break;
                }
            }

            if (bulletRemoved) continue;

            if (bullet.lifetime <= 0 || bullet.position.y < 0) {
                this.scene.remove(bullet);
                this.bullets.splice(i, 1);
            }
        }
    }

    dispose() {
        this.bullets.forEach((bullet) => this.scene.remove(bullet));
        this.bullets = [];

        this.bulletGeometry.dispose();
        this.bulletMaterial.dispose();
    }
}