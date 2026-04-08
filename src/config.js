import * as THREE from 'three';

export const DEFAULT_SPEED = 10;
export const MAX_SPEED = 50;

export const FLIGHT_CONFIG = {
    maxTilt: Math.PI / 3,
    maxYaw: Math.PI / 6,
    maxPitch: 0.15,

    tiltAcceleration: 3,
    tiltDamping: 10,

    yawAcceleration: 3,
    yawDamping: 20,

    horizontalDeadZone: 0.15,
    verticalDeadZone: 0.1,

    verticalMoveSpeed: 10,
    lateralMoveSpeed: 10
};

export const BULLET_CONFIG = {
    reloadTime: 0.4,
    radius: 0.25,
    initialSpeed: MAX_SPEED * 3,
    gravity: new THREE.Vector3(0, -14, 0),
    drag: 0.25,
    lifetime: 5,
    muzzleOffset: 3,
    hitDistance: 3
};

export const ENEMY_CONFIG = {
    addEnemyDelay: 4,
    enemiesCount: 40,
    startPositionOffset: 180,
    offsetBetweenEnemies: 120,
    cameraOffset: 30,
    minHeight: 60,
    maxHeight: 90,
    moveSpeed: DEFAULT_SPEED
};