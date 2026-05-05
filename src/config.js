import * as THREE from 'three';

export const GAME_CONFIG = {
    targetFPS: 90,
    maxFrameDelta: 1 / 25
}

export const PLAYER_CONFIG = {
    position: new THREE.Vector3(11, 100, 0),
    rotation: new THREE.Euler(0, 0, 0),
    camera: {
        fov: 45,
        near: 0.7,
        far: 250
    },
    cameraOffset: new THREE.Vector3(0, 2.25, 1.2),
    modelScale: new THREE.Vector3(2.25, 2.25, 2.25)
}

export const FLIGHT_CONFIG = {
    speed: {
        min: 12,
        idle: 20,
        max: 70
    },

    speedMultiplier: 5,

    speedAcceleration: {
        min: 0.0000000001,
        max: 2.25
    },

    braking: {
        min: 3,
        max: 6
    },

    idleBraking: {
        min: 0.2,
        max: 2.5
    },

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
    maxPitch: 0.375,         // вверх/вниз

    // инерция крена
    tiltAcceleration: 3,
    tiltDamping: 25,

    // инерция поворота
    yawAcceleration: 1.15,
    yawDamping: 25
    ,

    // auto recovery to idle speed when not braking
    autoAcceleration: {
        rate: 0.75
    },

    // when speed stays at minimum for too long, drone starts falling
    minSpeedHoldToFall: 3, // seconds
    fallAcceleration: 9.8, // m/s^2 applied as increase in fall velocity

    // altitude (meters) below which HUD shows a warning
    lowAltitudeWarning: 50,

    // stall / spin tuning
    // base angular speed when stall begins
    fallSpinBase: Math.PI * 0.01, // radians per second
    // angular acceleration while falling (rad/s^2) - causes spin rate to grow over time
    fallSpinAccel: Math.PI * 0.5,
    fallSpeedLossRate: 4, // speed units lost per second while stalling
    fallPitchTargetMultiplier: 1.5 // how much more nose-down compared to normal maxPitch
};

export const BULLET_CONFIG = {
    radius: 0.25,

    initialSpeed: 150,
    drag: 0.25,

    gravity: new THREE.Vector3(0, -9.8, 0),

    lifetime: 3,
    reloadTime: 0.25,

    muzzleOffset: 2.5,
    hitDistance: 3
};

export const CITY_CONFIG = {
    depth: 3000,
    width: 378,

    buildingLines: 8,
    buildingSize: 30,
    baseHeight: 80,

    spacingX: 50,
    spacingZ: 80,

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

    minDistanceBetweenWaves: 250,
    maxDistanceBetweenWaves: 500,

    cameraOffset: 30,
    minHeight: 70,
    maxHeight: 130,
    moveSpeed: FLIGHT_CONFIG.speed.idle,

    waveTypes: ['single', 'pair-vertical', 'pair-horizontal', 'triple-vertical', 'triple-horizontal'],
    verticalOffset: 12,
    longitudinalOffset: 25,
    // optimization helpers
    // keep a pool of this many enemy objects ready to reuse (avoid expensive cloning at runtime)
    poolSize: 12,
    // distance (meters) under which enemy mixers will be updated (animations)
    animationDistance: 120,
    // distance under which engine audio will be created/updated
    audioDistance: 80
};

// how far ahead of the player enemies should be spawned (meters)
ENEMY_CONFIG.spawnAhead = 800;

export const RADAR_CONFIG = {
    range: 600, // meters the radar can show
    // fraction of HUD width used by radar (0..1) - e.g. 0.5 = half of HUD width
    displayFraction: 0.25,
    // padding (in pixels on HUD canvas) to avoid drawing on the radar decorative rim
    padding: 28,
    // enemy dot sizes (pixels)
    dotMin: 4,
    dotMax: 8,
    // player dot size (pixels)
    playerDotSize: 14
};

export const TRAFFIC_CONFIG = {
    // how far ahead of the player vehicles should spawn (meters)
    // set these beyond typical camera far-plane to ensure they appear off-screen
    spawnAheadMin: 220,
    spawnAheadMax: 700,

    // maximum vehicles allowed concurrently
    maxVehicles: 60,

    // safe distance between vehicles on same lane (meters)
    safeDistance: 20,

    // spawn interval range (seconds)
    spawnIntervalMin: 0.1,
    spawnIntervalMax: 3
};


