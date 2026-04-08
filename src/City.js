import * as THREE from 'three';
import { getRandomInRange } from './utils/math.js';
import { CITY_CONFIG } from './config.js';

export class City {
    constructor(scene) {
        this.scene = scene;
        this.buildings = [];
        this.laneCenters = [];
        this.textureLoader = new THREE.TextureLoader();

        this.createCity();
    }

    createCity() {
        const textures = this.loadBuildingTextures();
        this.createLaneCenters();
        this.createRoads();
        this.createBuildings(textures);
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
            buildingsX,
            buildingSize,
            spacingX,
            width
        } = CITY_CONFIG;

        this.laneCenters = [];

        for (let i = 0; i < buildingsX - 1; i++) {
            const buildingCenterX =
                i * (buildingSize + spacingX) - width * 0.5;

            const laneCenterX =
                buildingCenterX + buildingSize * 0.5 + spacingX * 0.5;

            this.laneCenters.push(laneCenterX);
        }
    }

    createRoads() {
        this.laneCenters.forEach((laneCenterX) => {
            this.addRoad(laneCenterX);
        });
    }

    createBuildings(textures) {
        const roofMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            roughness: 0.6
        });

        const {
            buildingsX,
            buildingsZ,
            buildingSize,
            spacingX,
            spacingZ,
            width,
            depth,
            baseHeight
        } = CITY_CONFIG;

        for (let i = 0; i < buildingsX; i++) {
            for (let j = 0; j < buildingsZ; j++) {
                const currentTexture = textures[getRandomInRange(0, textures.length - 1)];

                const height = Math.random() * 50 + baseHeight;
                const currentWidth = buildingSize * 1.5;

                currentTexture.wrapS = THREE.RepeatWrapping;
                currentTexture.wrapT = THREE.RepeatWrapping;
                currentTexture.repeat.set(2, height / 33);

                const wallMaterial = new THREE.MeshStandardMaterial({
                    map: currentTexture
                });

                const materials = [
                    wallMaterial,
                    wallMaterial,
                    roofMaterial,
                    wallMaterial,
                    wallMaterial,
                    wallMaterial
                ];

                const geometry = new THREE.BoxGeometry(currentWidth, height, currentWidth);
                const building = new THREE.Mesh(geometry, materials);

                const x = i * (buildingSize + spacingX) - width * 0.5;
                const z = j * (buildingSize + spacingZ) - depth * 0.5 + 120;
                const y = height * 0.5;

                building.position.set(x, y, z);
                building.updateMatrixWorld(true);
                building.boundingBox = new THREE.Box3().setFromObject(building);

                this.scene.add(building);
                this.buildings.push(building);
            }
        }
    }

    addRoad(centerX) {
        const roadTexture = this.textureLoader.load('./assets/textures/road_texture.jpg');

        const roadWidth = 28;
        const roadLength = CITY_CONFIG.depth;

        const roadGeometry = new THREE.PlaneGeometry(roadWidth, roadLength);
        const roadMaterial = new THREE.MeshStandardMaterial({
            map: roadTexture,
            side: THREE.DoubleSide
        });

        const road = new THREE.Mesh(roadGeometry, roadMaterial);
        road.position.set(centerX, 0, roadLength * -0.5);
        road.rotation.x = -Math.PI / 2;

        this.scene.add(road);
    }
}