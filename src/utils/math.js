export function getRandomInRange(min, max) {
    return Math.floor(min + Math.random() * (max + 1 - min));
}

export function applyDeadZone(value, threshold) {
    return Math.abs(value) > threshold ? value : 0;
}