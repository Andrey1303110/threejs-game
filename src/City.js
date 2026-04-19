import * as THREE from 'three';
import { getRandomInRange } from './utils/math.js';
import { CITY_CONFIG } from './config.js';

export class City {
    constructor(scene) {
        this.scene = scene;

        this.buildings = [];
        this.laneCenters = [];

        this.textureLoader = new THREE.TextureLoader();

        this.generatedRows = new Set();
        this.rowToBuildings = new Map();
        this.rowToRoads = new Map();

        this.buildingPool = [];
        this.roadPool = [];

        this.rowStep = CITY_CONFIG.buildingSize + CITY_CONFIG.spacingZ;

        this.buildingTextures = this.loadBuildingTextures();
        this.roadTexture = this.textureLoader.load('./assets/textures/road_texture.jpg');

        this.roofMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            roughness: 0.6
        });

        this.createLaneCenters();

        this.initialized = false;
        this.maxGeneratedRow = 0;
    }

    loadBuildingTextures() {
        return [
            this.textureLoader.load('./assets/textures/build_texture_1.jpg'),
            this.textureLoader.load('./assets/textures/build_texture_2.jpg'),
            this.textureLoader.load('./assets/textures/build_texture_3.jpg'),
            this.textureLoader.load('./assets/textures/build_texture_4.jpg')
        ];
    }

    createLaneCenters() {
        const {
            buildingLines,
            buildingSize,
            spacingX,
            width: cityWidth
        } = CITY_CONFIG;

        this.laneCenters = [];

        for (let i = 0; i < buildingLines - 1; i++) {
            const buildingCenterX =
                i * (buildingSize + spacingX) - cityWidth * 0.5;

            const laneCenterX =
                buildingCenterX + buildingSize * 0.5 + spacingX * 0.5;

            this.laneCenters.push(laneCenterX);
        }
    }

    initializeAroundPlayer(playerZ) {
        if (this.initialized) return;

        const {
            initialRowsBehind,
            initialRowsAhead
        } = CITY_CONFIG;

        const playerRow = this.getPlayerRow(playerZ);
        const minRow = playerRow - initialRowsAhead;
        const maxRow = playerRow + initialRowsBehind;

        for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex++) {
            this.generateRow(rowIndex);
        }

        this.maxGeneratedRow = maxRow;
        this.initialized = true;
    }

    // fully reset city state
    reset() {
        // remove all generated rows
        for (const rowIndex of [...this.generatedRows]) {
            this.removeRow(rowIndex);
        }

        // clear pools
        this.buildingPool.length = 0;
        this.roadPool.length = 0;

        this.generatedRows.clear();
        this.rowToBuildings.clear();
        this.rowToRoads.clear();
        this.initialized = false;
        this.maxGeneratedRow = 0;
    }

    update(playerZ) {
        if (!this.initialized) return;

        const {
            rowsAhead,
            rowsBehind,
            minRowsAhead
        } = CITY_CONFIG;

        const playerRow = this.getPlayerRow(playerZ);

        const farthestNeededRow = playerRow + rowsAhead;
        const currentlyAhead = this.maxGeneratedRow - playerRow;

        if (currentlyAhead < minRowsAhead) {
            while (this.maxGeneratedRow < farthestNeededRow) {
                this.maxGeneratedRow += 1;
                this.generateRow(this.maxGeneratedRow);
            }
        }

        const minAllowedRow = playerRow - rowsBehind;

        for (const rowIndex of [...this.generatedRows]) {
            if (rowIndex < minAllowedRow) {
                this.removeRow(rowIndex);
            }
        }
    }

    getPlayerRow(playerZ) {
        return Math.floor((-playerZ) / this.rowStep);
    }

    getRowZ(rowIndex) {
        return -rowIndex * this.rowStep;
    }

    generateRow(rowIndex) {
        if (this.generatedRows.has(rowIndex)) {
            return;
        }

        const {
            buildingLines: buildingLines,
            buildingSize,
            spacingX,
            width: cityWidth,
            baseHeight,
            buildingSpawnChance
        } = CITY_CONFIG;

        const z = this.getRowZ(rowIndex);
        const rowBuildings = [];
        const rowRoads = [];

        // Дороги для этого ряда
        for (const laneCenterX of this.laneCenters) {
            const road = this.acquireRoad();
            this.setupRoad(road, laneCenterX, z);

            this.scene.add(road);
            rowRoads.push(road);
        }

        // Дома для этого ряда
        for (let i = 0; i < buildingLines; i++) {
            if (Math.random() > buildingSpawnChance) {
                continue;
            }

            const x = i * (buildingSize + spacingX) - cityWidth * 0.5;

            const building = this.acquireBuilding();
            this.setupBuilding(building, x, z, baseHeight, buildingSize);

            building.userData.rowIndex = rowIndex;

            this.scene.add(building);
            this.buildings.push(building);
            rowBuildings.push(building);
        }

        this.generatedRows.add(rowIndex);
        this.rowToBuildings.set(rowIndex, rowBuildings);
        this.rowToRoads.set(rowIndex, rowRoads);
    }

    acquireBuilding() {
        const pooled = this.buildingPool.pop();
        if (pooled) {
            pooled.visible = true;
            return pooled;
        }

        const geometry = new THREE.BoxGeometry(1, 1, 1);

        const placeholderWall = new THREE.MeshStandardMaterial({ color: 0xffffff });
        const materials = [
            placeholderWall.clone(),
            placeholderWall.clone(),
            this.roofMaterial,
            placeholderWall.clone(),
            placeholderWall.clone(),
            placeholderWall.clone()
        ];

        const building = new THREE.Mesh(geometry, materials);
        building.collisionBox = new THREE.Box3();

        return building;
    }

    setupBuilding(building, x, z, baseHeight, buildingSize) {
        const sourceTexture =
            this.buildingTextures[getRandomInRange(0, this.buildingTextures.length - 1)];

        const height = getRandomInRange(
            baseHeight,
            Math.floor(baseHeight * 2)
        );
        const buildingWidth = getRandomInRange(
            buildingSize,
            Math.floor(buildingSize * 1.25)
        );

        const currentTexture = sourceTexture.clone();
        currentTexture.needsUpdate = true;
        currentTexture.wrapS = THREE.RepeatWrapping;
        currentTexture.wrapT = THREE.RepeatWrapping;
        currentTexture.repeat.set(CITY_CONFIG.textureRepeatX, height / 33);

        const wallMaterialIndices = [0, 1, 3, 4, 5];

        wallMaterialIndices.forEach((index) => {
            const material = building.material[index];

            if (material.map) {
                material.map.dispose();
            }

            material.map = currentTexture;
            material.needsUpdate = true;
        });

        building.scale.set(buildingWidth, height, buildingWidth);

        const y = height * 0.5;
        building.position.set(x, y, z);
        building.updateMatrixWorld(true);

        building.collisionBox.setFromCenterAndSize(
            new THREE.Vector3(x, y, z),
            new THREE.Vector3(buildingWidth, height, buildingWidth)
        );
    }

    acquireRoad() {
        const pooled = this.roadPool.pop();
        if (pooled) {
            pooled.visible = true;
            return pooled;
        }

        const roadWidth = 28;
        const roadLength = this.rowStep;

        const roadGeometry = new THREE.PlaneGeometry(roadWidth, roadLength);
        const roadMaterial = new THREE.MeshStandardMaterial({
            map: this.roadTexture,
            side: THREE.DoubleSide
        });

        const road = new THREE.Mesh(roadGeometry, roadMaterial);
        road.rotation.x = -Math.PI / 2;

        return road;
    }

    setupRoad(road, centerX, z) {
        road.position.set(centerX, 0, z);
        road.visible = true;
    }

    removeRow(rowIndex) {
        const rowBuildings = this.rowToBuildings.get(rowIndex);
        const rowRoads = this.rowToRoads.get(rowIndex);

        if (rowBuildings) {
            for (const building of rowBuildings) {
                this.scene.remove(building);

                const index = this.buildings.indexOf(building);
                if (index !== -1) {
                    this.buildings.splice(index, 1);
                }

                building.visible = false;
                this.buildingPool.push(building);
            }

            this.rowToBuildings.delete(rowIndex);
        }

        if (rowRoads) {
            for (const road of rowRoads) {
                this.scene.remove(road);
                road.visible = false;
                this.roadPool.push(road);
            }

            this.rowToRoads.delete(rowIndex);
        }

        this.generatedRows.delete(rowIndex);
    }

    dispose() {
        for (const rowIndex of [...this.generatedRows]) {
            this.removeRow(rowIndex);
        }

        for (const building of this.buildingPool) {
            if (building.geometry) {
                building.geometry.dispose();
            }

            if (building.material) {
                if (Array.isArray(building.material)) {
                    building.material.forEach((material, index) => {
                        if (index !== 2 && material.map) {
                            material.map.dispose();
                        }
                        material.dispose();
                    });
                } else {
                    if (building.material.map) {
                        building.material.map.dispose();
                    }
                    building.material.dispose();
                }
            }
        }

        for (const road of this.roadPool) {
            if (road.geometry) {
                road.geometry.dispose();
            }

            if (road.material) {
                if (road.material.map) {
                    road.material.map.dispose();
                }
                road.material.dispose();
            }
        }

        this.buildingPool = [];
        this.roadPool = [];
    }
}