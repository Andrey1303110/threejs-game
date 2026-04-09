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
    buildingsZ: 26,

    buildingSize: 16,
    baseHeight: 55,

    spacingX: 38,
    spacingZ: 52,

    textureRepeatX: 2,

    districts: [
        {
            name: 'downtown',
            zStart: 0.0,
            zEnd: 0.3,
            minHeight: 80,
            maxHeight: 150,
            minWidthMultiplier: 1.2,
            maxWidthMultiplier: 1.9,
            emptyLotChance: 0.04
        },
        {
            name: 'midtown',
            zStart: 0.3,
            zEnd: 0.7,
            minHeight: 55,
            maxHeight: 110,
            minWidthMultiplier: 1.1,
            maxWidthMultiplier: 1.7,
            emptyLotChance: 0.1
        },
        {
            name: 'suburb',
            zStart: 0.7,
            zEnd: 1.0,
            minHeight: 25,
            maxHeight: 65,
            minWidthMultiplier: 1.0,
            maxWidthMultiplier: 1.4,
            emptyLotChance: 0.2
        }
    ]
};

export const ENEMY_CONFIG = {
    minSpawnDelay: 1.0,
    maxSpawnDelay: 2.6,

    enemiesCount: 60,
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