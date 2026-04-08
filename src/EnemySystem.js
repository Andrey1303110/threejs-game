import * as THREE from 'three';
import { ENEMY_CONFIG } from './config.js';
import { getRandomInRange } from './utils/utilityFunctions.js';

export class EnemySystem {
    constructor(scene, city) {
        this.scene = scene;
        this.city = city;

        this.enemies = [];
        this.enemyCount = 0;
        this.lastEnemyAddedTime = 0;

        this.originalGLTF = null;
        this.animations = null;
    }

    setSource(gltf, animations) {
        this.originalGLTF = gltf;
        this.animations = animations;
    }

    update(deltaTime, playerPositionZ, elapsedTime) {
        this.tryAddEnemy(elapsedTime);
        this.updateEnemies(deltaTime, playerPositionZ);
    }

    tryAddEnemy(elapsedTime) {
        if (!this.originalGLTF) return;
        if (this.enemyCount >= ENEMY_CONFIG.enemiesCount) return;
        if (elapsedTime <= this.lastEnemyAddedTime + ENEMY_CONFIG.addEnemyDelay) return;

        const lines = this.city.linesBetweenBuilding;
        if (!lines.length) return;

        const enemy = this.originalGLTF.scene.clone();
        enemy.rotation.y = Math.PI * 1.5;

        const xIndex = Math.min(3, lines.length - 1);
        const x = lines[xIndex];
        const y = getRandomInRange(ENEMY_CONFIG.minHeight, ENEMY_CONFIG.maxHeight);
        const zPosition =
            (this.enemyCount + 1) * ENEMY_CONFIG.offsetBetweenEnemies +
            ENEMY_CONFIG.startPositionOffset;

        enemy.position.set(x, y, -zPosition);

        enemy.mixer = new THREE.AnimationMixer(enemy);

        const fuselageAnimation = this.animations?.['fuselage'];
        if (fuselageAnimation) {
            const action = enemy.mixer.clipAction(fuselageAnimation);
            action.play();
        }

        this.scene.add(enemy);
        this.enemies.push(enemy);

        this.lastEnemyAddedTime = elapsedTime;
        this.enemyCount++;
    }

    updateEnemies(deltaTime, playerPositionZ) {
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];

            if (enemy.position.z >= playerPositionZ + ENEMY_CONFIG.cameraOffset) {
                this.scene.remove(enemy);
                this.enemies.splice(i, 1);
                continue;
            }

            enemy.position.z += ENEMY_CONFIG.moveSpeed * deltaTime;

            if (enemy.mixer) {
                enemy.mixer.update(deltaTime);
            }
        }
    }

    dispose() {
        this.enemies.forEach((enemy) => {
            if (enemy.mixer) {
                enemy.mixer.stopAllAction();
                enemy.mixer.uncacheRoot(enemy);
            }
            this.scene.remove(enemy);
        });

        this.enemies = [];
    }
}