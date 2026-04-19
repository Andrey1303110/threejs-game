import * as THREE from 'three';
import { ENEMY_CONFIG } from './config.js';
import { getRandomInRange } from './utils/math.js';

export class EnemySystem {
    constructor(scene, city, audioManager, playerRig) {
        this.scene = scene;
        this.city = city;
        this.audioManager = audioManager;
        this.playerRig = playerRig;

        this.enemies = [];
        this.enemyCount = 0;
        this.lastEnemyAddedTime = 0;

        this.nextSpawnDelay = this.getRandomSpawnDelay();
        this.nextWaveDistance = this.getRandomWaveDistance();
        this.nextSpawnZ = ENEMY_CONFIG.startPositionOffset;

        this.originalGLTF = null;
        this.animations = null;
    }

    setSource(gltf, animations) {
        this.originalGLTF = gltf;
        this.animations = animations;
    }

    update(deltaTime, playerPositionZ, elapsedTime) {
        this.tryAddWave(elapsedTime);
        this.updateEnemies(deltaTime, playerPositionZ);
    }

    tryAddWave(elapsedTime) {
        if (!this.originalGLTF) return;
        if (!this.city.laneCenters?.length) return;
        if (this.enemyCount >= ENEMY_CONFIG.enemiesCount) return;
        if (elapsedTime <= this.lastEnemyAddedTime + this.nextSpawnDelay) return;

        const waveType = this.getRandomWaveType();
        const waveEnemies = this.createWave(waveType);

        waveEnemies.forEach((enemy) => {
            if (this.enemyCount >= ENEMY_CONFIG.enemiesCount) return;

            this.scene.add(enemy);
            this.enemies.push(enemy);
            this.enemyCount++;
        });

        this.lastEnemyAddedTime = elapsedTime;
        this.nextSpawnDelay = this.getRandomSpawnDelay();
        this.nextWaveDistance = this.getRandomWaveDistance();
        this.nextSpawnZ += this.nextWaveDistance;
    }

    createWave(waveType) {
        const x = this.getRandomSpawnLine();
        const y = getRandomInRange(ENEMY_CONFIG.minHeight, ENEMY_CONFIG.maxHeight);
        const z = -this.nextSpawnZ;

        switch (waveType) {
            case 'pair-vertical':
                return [
                    this.createEnemy(x, y - ENEMY_CONFIG.verticalOffset, z),
                    this.createEnemy(x, y, z)
                ];

            case 'pair-horizontal':
                return [
                    this.createEnemy(x, y, z),
                    this.createEnemy(x, y, z + ENEMY_CONFIG.longitudinalOffset)
                ];

            case 'triple-horizontal':
                return [
                    this.createEnemy(x, y, z - ENEMY_CONFIG.longitudinalOffset),
                    this.createEnemy(x, y, z),
                    this.createEnemy(x, y, z + ENEMY_CONFIG.longitudinalOffset)
                ];

            case 'triple-vertical':
                return [
                    this.createEnemy(x, y - ENEMY_CONFIG.verticalOffset, z - ENEMY_CONFIG.longitudinalOffset),
                    this.createEnemy(x, y, z),
                    this.createEnemy(x, y + ENEMY_CONFIG.verticalOffset, z + ENEMY_CONFIG.longitudinalOffset)
                ];

            case 'single':
            default:
                return [this.createEnemy(x, y, z)];
        }
    }

    createEnemy(x, y, z) {
        const enemy = this.originalGLTF.scene.clone(true);
        enemy.rotation.y = Math.PI * 1.5;
        enemy.position.set(x, y, z);

        enemy.mixer = new THREE.AnimationMixer(enemy);

        const fuselageAnimation = this.animations?.['fuselage'];
        if (fuselageAnimation) {
            const action = enemy.mixer.clipAction(fuselageAnimation);
            action.play();
        }

        enemy.userData.speed = ENEMY_CONFIG.moveSpeed;
        enemy.userData.engineAudio = this.audioManager?.createEnemyEngineAudio(enemy);

        if (enemy.userData.engineAudio && !enemy.userData.engineAudio.isPlaying) {
            enemy.userData.engineAudio.play();
        }

        return enemy;
    }

    getRandomSpawnLine() {
        const lanes = this.city.laneCenters;
        const randomIndex = getRandomInRange(0, lanes.length - 1);
        return lanes[randomIndex];
    }

    getRandomWaveType() {
        const { waveTypes } = ENEMY_CONFIG;
        return waveTypes[getRandomInRange(0, waveTypes.length - 1)];
    }

    getRandomSpawnDelay() {
        return randomFloat(
            ENEMY_CONFIG.minSpawnDelay,
            ENEMY_CONFIG.maxSpawnDelay
        );
    }

    getRandomWaveDistance() {
        return getRandomInRange(
            ENEMY_CONFIG.minDistanceBetweenWaves,
            ENEMY_CONFIG.maxDistanceBetweenWaves
        );
    }

    updateEnemies(deltaTime, playerPositionZ) {
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];

            if (enemy.position.z >= playerPositionZ + ENEMY_CONFIG.cameraOffset) {
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
                this.enemies.splice(i, 1);
                continue;
            }

            enemy.position.z += ENEMY_CONFIG.moveSpeed * deltaTime;

            if (enemy.mixer) {
                enemy.mixer.update(deltaTime);
            }

            const distanceToPlayer = enemy.position.distanceTo(this.playerRig.position);

            if (this.audioManager && enemy.userData.engineAudio) {
                this.audioManager.updateEnemyEngine(
                    enemy.userData.engineAudio,
                    enemy.userData.speed ?? ENEMY_CONFIG.moveSpeed,
                    5,
                    50,
                    distanceToPlayer
                );
            }
        }
    }

    reset() {
        this.enemies.forEach((enemy) => {
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
        });

        this.enemies = [];
        this.enemyCount = 0;
        this.lastEnemyAddedTime = 0;
        this.nextSpawnDelay = this.getRandomSpawnDelay();
        this.nextWaveDistance = this.getRandomWaveDistance();
        this.nextSpawnZ = ENEMY_CONFIG.startPositionOffset;
    }

    dispose() {
        this.reset();
    }
}

function randomFloat(min, max) {
    return min + Math.random() * (max - min);
}