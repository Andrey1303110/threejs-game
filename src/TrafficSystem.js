import * as THREE from 'three';
import { FLIGHT_CONFIG, TRAFFIC_CONFIG } from './config.js';
import { GLTFLoader } from './loaders/GLTFLoader.js';

function randomFloat(min, max) {
    return min + Math.random() * (max - min);
}

export class TrafficSystem {
    constructor(scene, city) {
        this.scene = scene;
        this.city = city;

        this.vehicles = [];

    this.spawnTimer = 0;
    this.nextSpawn = randomFloat(TRAFFIC_CONFIG.spawnIntervalMin, TRAFFIC_CONFIG.spawnIntervalMax);

    this.maxVehicles = TRAFFIC_CONFIG.maxVehicles;
        // lane layout: 4 lanes per road (2 per direction). Offsets are meters from road center.
        this.laneOffsets = [-10, -3, 3, 10];
        // directions per lane: -1 means moving towards -z, +1 means moving towards +z
        this.laneDirections = [-1, -1, 1, 1];
        this.lanes = []; // { x, dir }
        this.laneVehicles = []; // vehicles grouped per lane index

        this.buildLanes();

        this.vehicleTemplate = null; // loaded GLTF scene for vehicles
        this._loadVehicleModel();
    }

    _loadVehicleModel() {
        try {
            const loader = new GLTFLoader();
            loader.setDRACOLoader?.(null);
            loader.setPath('./assets/3d_models/blue_bus/');
            loader.load(
                'scene.gltf',
                (gltf) => {
                    // store a trimmed, scaled template
                    const root = gltf.scene || gltf.scenes?.[0];
                    if (!root) return;
                    // make a shallow clone to use as template
                    this.vehicleTemplate = root.clone(true);
                    // ensure correct orientation and scale
                    this.vehicleTemplate.scale.setScalar(1.0);
                    this.vehicleTemplate.traverse((o) => {
                        if (o.isMesh) {
                            o.castShadow = false;
                            o.receiveShadow = false;
                        }
                    });
                    console.log('TrafficSystem: loaded vehicle GLTF template');
                },
                undefined,
                (err) => {
                    console.warn('TrafficSystem: failed to load vehicle model', err);
                }
            );
        } catch (e) {
            console.warn('TrafficSystem: GLTFLoader not available', e);
        }
    }

    buildLanes() {
        this.lanes.length = 0;
        this.laneVehicles.length = 0;
        const centers = (this.city && this.city.laneCenters) ? this.city.laneCenters : [];
        for (const cx of centers) {
            for (let i = 0; i < this.laneOffsets.length; i++) {
                const x = cx + this.laneOffsets[i];
                const dir = this.laneDirections[i] || 1;
                this.lanes.push({ x, dir });
                this.laneVehicles.push([]);
            }
        }
    }

    update(deltaTime, playerZ) {
        // rebuild lanes if city changed
        if ((!this.lanes || !this.lanes.length) && this.city && this.city.laneCenters && this.city.laneCenters.length) {
            this.buildLanes();
        }

        // spawn logic
        this.spawnTimer += deltaTime;
        if (this.spawnTimer >= this.nextSpawn && this.vehicles.length < this.maxVehicles) {
            this.spawnTimer = 0;
            this.nextSpawn = randomFloat(TRAFFIC_CONFIG.spawnIntervalMin, TRAFFIC_CONFIG.spawnIntervalMax);
            this.trySpawn(playerZ);
        }

        // group vehicles into lanes
        for (let li = 0; li < this.laneVehicles.length; li++) this.laneVehicles[li] = [];
        for (const v of this.vehicles) {
            if (typeof v.laneIndex === 'number' && this.laneVehicles[v.laneIndex]) {
                this.laneVehicles[v.laneIndex].push(v);
            }
        }

        // update per-lane to enforce no-overtake and right-side driving
        for (let li = 0; li < this.lanes.length; li++) {
            const lane = this.lanes[li];
            const list = this.laneVehicles[li];
            if (!list || !list.length) continue;

            // for deterministic behavior, sort by position along movement direction
            list.sort((a, b) => (a.position.z - b.position.z) * lane.dir);

            // update from front to back so each vehicle can see one ahead
            for (let vi = 0; vi < list.length; vi++) {
                const v = list[vi];

                // handle stopped timers
                if (v.stopped) {
                    v.stopTimer -= deltaTime;
                    if (v.stopTimer <= 0) {
                        v.stopped = false;
                        v.speed = v.baseSpeed * lane.dir;
                    }
                    continue;
                }

                // scheduled stop check (relative to lane direction)
                if (!v.stoppingScheduled && v.nextStopZ !== undefined) {
                    const dz = (v.nextStopZ - v.position.z) * lane.dir;
                    if (dz < 2.5 && dz > -2.5) {
                        v.stopped = true;
                        v.stopTimer = v.stopDuration || randomFloat(1.2, 3.0);
                        v.speed = 0;
                        v.stoppingScheduled = true;
                        continue;
                    }
                }

                // detect vehicle ahead in same lane (the one with lower index is ahead because sorted)
                let ahead = null;
                if (vi > 0) ahead = list[vi - 1];

                const desiredSpeed = v.baseSpeed * lane.dir;
                const safeDist = TRAFFIC_CONFIG.safeDistance; // meters

                if (ahead) {
                    const aheadDist = (ahead.position.z - v.position.z) * lane.dir;
                    if (aheadDist < safeDist) {
                        // match or reduce speed to avoid overtaking
                        const aheadAbs = Math.abs(ahead.speed || 0);
                        v.speed = Math.sign(lane.dir) * Math.min(Math.abs(desiredSpeed), aheadAbs);
                        if (aheadAbs < 0.01) {
                            v.stopped = true;
                            v.speed = 0;
                        }
                    } else {
                        v.speed = desiredSpeed;
                    }
                } else {
                    v.speed = desiredSpeed;
                }

                // move
                v.position.z += v.speed * deltaTime;

                // remove when out of range beyond player
                if ((v.position.z - playerZ) * lane.dir > 80) {
                    // will be removed in cleanup pass
                    // mark for removal
                    v._remove = true;
                }
            }
        }

        // cleanup removed vehicles
        for (let i = this.vehicles.length - 1; i >= 0; i--) {
            const v = this.vehicles[i];
            if (v._remove) {
                this.scene.remove(v);
                this.vehicles.splice(i, 1);
            }
        }
    }

    trySpawn(playerZ) {
        if (!this.lanes || !this.lanes.length) return;

        // pick random lane
        const li = Math.floor(Math.random() * this.lanes.length);
        const lane = this.lanes[li];

        // spawn ahead of the player (in front) so vehicles are visible regardless of direction
        const ahead = randomFloat(TRAFFIC_CONFIG.spawnAheadMin, TRAFFIC_CONFIG.spawnAheadMax);
        const spawnZ = playerZ - ahead;

        const vehicle = this.createVehicle(lane, spawnZ);
        vehicle.laneIndex = li;
        vehicle.dir = lane.dir;
        vehicle.baseSpeed = randomFloat(FLIGHT_CONFIG.speed.min * 0.4, FLIGHT_CONFIG.speed.min * 1);
        vehicle.speed = vehicle.baseSpeed * lane.dir;

        // schedule a stop somewhere between spawn and player (independent of direction)
        const stopOffset = randomFloat(20, Math.max(50, Math.max(10, ahead - 10)));
        vehicle.nextStopZ = playerZ - stopOffset;
        vehicle.stopDuration = randomFloat(1.0, 4.0);

        this.scene.add(vehicle);
        this.vehicles.push(vehicle);
        if (!this.laneVehicles[li]) this.laneVehicles[li] = [];
        this.laneVehicles[li].push(vehicle);
        console.log('TrafficSystem: spawned vehicle on lane', li, 'at', lane.x, spawnZ, 'dir', lane.dir);
    }

    createVehicle(lane, z) {
        // if GLTF template is loaded, clone it
        if (this.vehicleTemplate) {
            const obj = this.vehicleTemplate.clone(true);
            obj.position.set(lane.x, 1.35, z);
            obj.rotation.y = lane.dir === 1 ? 0 : Math.PI;
            obj.scale.setScalar(9);
            obj.traverse((o) => {
                if (o.isMesh) {
                    o.castShadow = false;
                    o.receiveShadow = false;
                }
            });
            obj.baseSpeed = randomFloat(FLIGHT_CONFIG.speed.min * 0.8, FLIGHT_CONFIG.speed.idle * 1.2);
            obj.speed = obj.baseSpeed;
            obj.stopped = false;
            obj.stoppingScheduled = false;
            return obj;
        }

    // fallback box car
    const geometry = new THREE.BoxGeometry(5, 2, 3.5);
    const material = new THREE.MeshStandardMaterial({ color: new THREE.Color(`hsl(${Math.floor(Math.random()*360)},70%,50%)`), emissive: 0x111111 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(lane.x, 0.6, z);
    mesh.rotation.y = lane.dir === 1 ? 0 : Math.PI;
    mesh.castShadow = false;
    mesh.receiveShadow = false;

    mesh.baseSpeed = randomFloat(FLIGHT_CONFIG.speed.min * 0.8, FLIGHT_CONFIG.speed.idle * 1.2);
    mesh.speed = mesh.baseSpeed;
    mesh.stopped = false;
    mesh.stoppingScheduled = false;

    return mesh;
    }

    reset() {
        for (const v of this.vehicles) {
            this.scene.remove(v);
            if (v.geometry) v.geometry.dispose();
            if (v.material) v.material.dispose();
        }
        this.vehicles = [];
        this.spawnTimer = 0;
        this.nextSpawn = randomFloat(0.5, 1.5);
        this.lanes = [];
        this.laneVehicles = [];
        this.buildLanes();
    }

    dispose() {
        this.reset();
    }
}
