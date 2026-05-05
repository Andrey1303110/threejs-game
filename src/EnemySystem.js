import * as THREE from 'three';
import { ENEMY_CONFIG, RADAR_CONFIG, PLAYER_CONFIG } from './config.js';
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
        // nextSpawnZ stores a positive distance ahead of the world origin; initialize relative to the player's START position
        // ensure first spawn is at least at the radar edge so enemies don't appear too close
        const spawnStart = Math.max(ENEMY_CONFIG.startPositionOffset, RADAR_CONFIG.range);
        this.nextSpawnZ = -PLAYER_CONFIG.position.z + spawnStart;

        this.originalGLTF = null;
        this.animations = null;
        this.pool = [];
    }

    setSource(gltf, animations) {
        this.originalGLTF = gltf;
        this.animations = animations;
        // Pre-fill a pool of cloned enemies to avoid cloning during gameplay
        this._ensurePool();
    }

    _ensurePool() {
        const { poolSize } = ENEMY_CONFIG;
        if (!this.originalGLTF) return;

        while (this.pool.length < poolSize) {
            const enemy = this._createPooledEnemy();
            this.pool.push(enemy);
        }
    }

    _createPooledEnemy() {
        // shallow clone of the model for reuse; keep mixer and audio null until used
        const enemy = this.originalGLTF.scene.clone(true);
        enemy.userData._pooled = true;
        // do not create mixer/audio here to save cost until the enemy is spawned
        enemy.mixer = null;
        enemy.userData.engineAudio = null;
        return enemy;
    }

    update(deltaTime, playerPositionZ, elapsedTime) {
        this.tryAddWave(playerPositionZ);
        this.updateEnemies(deltaTime, playerPositionZ);
    }

    tryAddWave(playerPositionZ) {
        if (!this.originalGLTF) return;
        if (!this.city.laneCenters?.length) return;

        const spawnAhead = ENEMY_CONFIG.spawnAhead;

        // spawn while nextSpawnZ is within spawnAhead distance from the player
        while (this.nextSpawnZ <= -playerPositionZ + spawnAhead) {
            const waveType = this.getRandomWaveType();
            const waveEnemies = this.createWave(waveType);

            waveEnemies.forEach((enemy) => {
                this.scene.add(enemy);
                this.enemies.push(enemy);
                this.enemyCount++;
            });

            this.nextWaveDistance = this.getRandomWaveDistance();
            this.nextSpawnZ += this.nextWaveDistance;
        }
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
        // Try to reuse from pool first
        const enemy = (this.pool && this.pool.length) ? this.pool.pop() : this._createPooledEnemy();

        enemy.rotation.y = Math.PI * 1.5;
        enemy.position.set(x, y, z);

        // initialize dynamic subsystems lazily
        if (!enemy.mixer) {
            enemy.mixer = new THREE.AnimationMixer(enemy);
            const fuselageAnimation = this.animations?.['fuselage'];
            if (fuselageAnimation) {
                const action = enemy.mixer.clipAction(fuselageAnimation);
                action.play();
            }
        }

        enemy.userData.speed = ENEMY_CONFIG.moveSpeed;

        // don't create engine audio until player is close — we'll create lazily in update
        enemy.userData.engineAudio = null;

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

            // distance-based LOD: only update mixers and audio when reasonably close
            const distanceToPlayer = enemy.position.distanceTo(this.playerRig.position);

            if (distanceToPlayer <= ENEMY_CONFIG.animationDistance) {
                if (enemy.mixer) {
                    enemy.mixer.update(deltaTime);
                }
            }

            if (this.audioManager) {
                // lazily create engine audio when player is within audioDistance
                if (!enemy.userData.engineAudio && distanceToPlayer <= ENEMY_CONFIG.audioDistance) {
                    enemy.userData.engineAudio = this.audioManager.createEnemyEngineAudio(enemy);
                    if (enemy.userData.engineAudio && !enemy.userData.engineAudio.isPlaying) {
                        enemy.userData.engineAudio.play();
                    }
                }

                if (enemy.userData.engineAudio) {
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

            // return to pool for reuse
            if (this.pool && this.pool.length < ENEMY_CONFIG.poolSize) {
                this.pool.push(enemy);
            }
        });

        this.enemies = [];
        this.enemyCount = 0;
        this.lastEnemyAddedTime = 0;
        this.nextSpawnDelay = this.getRandomSpawnDelay();
        this.nextWaveDistance = this.getRandomWaveDistance();
        const spawnStart = Math.max(ENEMY_CONFIG.startPositionOffset, RADAR_CONFIG.range);
        this.nextSpawnZ = -PLAYER_CONFIG.position.z + spawnStart;
    }

    dispose() {
        this.reset();
    }
}

function randomFloat(min, max) {
    return min + Math.random() * (max - min);
}