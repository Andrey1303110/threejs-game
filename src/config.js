import * as THREE from 'three';

export const DEFAULT_SPEED = 10;
export const MAX_SPEED = 50;

export const FLIGHT_CONFIG = {
    // чувствительность стиков
    horizontalDeadZone: 0.15,
    verticalDeadZone: 0.1,

    // скорости движения
    lateralMoveSpeed: 10,
    verticalMoveSpeed: {
        up: 7,
        down: 11
    },

    // наклоны
    maxTilt: Math.PI / 4,   // крен (влево/вправо)
    maxYaw: Math.PI / 6,    // поворот корпуса
    maxPitch: 0.15,         // вверх/вниз

    // инерция крена
    tiltAcceleration: 3,
    tiltDamping: 25,

    // инерция поворота
    yawAcceleration: 1.15,
    yawDamping: 25
};

export const BULLET_CONFIG = {
    radius: 0.25,

    initialSpeed: 120,
    drag: 0.4,

    gravity: new THREE.Vector3(0, -9.8, 0),

    lifetime: 3,
    reloadTime: 0.25,

    muzzleOffset: 2.5,
    hitDistance: 3
};

export const CITY_CONFIG = {
    depth: 3000,
    width: 378,

    buildingsX: 8,
    buildingSize: 20,
    baseHeight: 40,

    spacingX: 38,
    spacingZ: 52,

    textureRepeatX: 2,

    initialRowsBehind: 3,
    initialRowsAhead: 10,

    rowsBehind: 2,
    rowsAhead: 10,
    minRowsAhead: 5,

    buildingSpawnChance: 0.8
};

export const ENEMY_CONFIG = {
    minSpawnDelay: 1.0,
    maxSpawnDelay: 2.6,

    enemiesCount: 50,
    startPositionOffset: 240,

    minDistanceBetweenWaves: 100,
    maxDistanceBetweenWaves: 180,

    cameraOffset: 30,
    minHeight: 60,
    maxHeight: 100,
    moveSpeed: DEFAULT_SPEED,

    waveTypes: ['single', 'pair', 'triple', 'vertical'],
    verticalOffset: 8,
    longitudinalOffset: 12
};