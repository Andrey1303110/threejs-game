import * as THREE from 'three';
import { getRandomInRange } from './index.js';

export class City {
    constructor(scene) {
        this.scene = scene;
        this.buildings = [];
        this.linesBetweenBuilding = [];

        this.createCity();
    }

    addRoad(x) {
        const textureLoader = new THREE.TextureLoader();
        const roadTexture = textureLoader.load('./assets/textures/road_texture.jpg');
        const roadWidth = 28;  // Ширина дороги
        const roadHeight = 3000; // Длина дороги

        const roadGeometry = new THREE.PlaneGeometry(roadWidth, roadHeight);
        const roadMaterial = new THREE.MeshStandardMaterial({ 
            map: roadTexture, 
            side: THREE.DoubleSide 
        });

        const road = new THREE.Mesh(roadGeometry, roadMaterial);
        road.rotation.x = -Math.PI / 2; // Разворачиваем, чтобы лежала горизонтально
        road.position.y = 0;  // На уровне земли
        road.position.x = x + 27;

        this.scene.add(road);
    }

    createCity() {
        const textureLoader = new THREE.TextureLoader();
        const textures = [
            textureLoader.load('./assets/textures/build_texture_1.jpg'),
            textureLoader.load('./assets/textures/build_texture_2.jpg')
        ];
        const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6 });

        const startPositionZ = 120;
        const cityWidth = 378;
        const cityDepth = 3000;
        const numBuildingsX = 8; // Количество зданий по X
        const numBuildingsZ = 26; // Количество зданий по Z
        // const buildingSize = 16; // Ширина и глубина каждого здания
        const buildingSize = 16; // Ширина и глубина каждого здания
        const buildHeight = 55;
        const spacing = 38; // Равномерный отступ между зданиями

        for (let i = 0; i < numBuildingsX; i++) {
            for (let j = 0; j < numBuildingsZ; j++) {
                const currentIndex = getRandomInRange(0, textures.length-1);
                const currentTexture = textures[currentIndex];

                const materials = [
                    new THREE.MeshStandardMaterial({ map: currentTexture }), // Левая
                    new THREE.MeshStandardMaterial({ map: currentTexture }), // Правая
                    roofMaterial, // Верхняя (крыша)
                    new THREE.MeshStandardMaterial({ map: currentTexture }), // Нижняя (не видна, можно оставить)
                    new THREE.MeshStandardMaterial({ map: currentTexture }), // Передняя
                    new THREE.MeshStandardMaterial({ map: currentTexture })  // Задняя
                ];
                const height = Math.random() * 50 + buildHeight; // Разная высота зданий
                // const width = Math.random() * buildingSize/2 + buildingSize;
                const width = buildingSize * 1.5; 
                const geometry = new THREE.BoxGeometry(width, height, width);
                currentTexture.wrapS = THREE.RepeatWrapping;
                currentTexture.wrapT = THREE.RepeatWrapping;
                currentTexture.repeat.set(2, height / 33); // Повторяем текстуру по высоте

                // const material = new THREE.MeshStandardMaterial({ 
                //     map: buildingTexture,
                //     roughness: 0.7 
                // });

                const building = new THREE.Mesh(geometry, materials);
                // const building = new THREE.Mesh(geometry, material);

                // Расположение здания по сетке
                const x = i * (buildingSize + spacing) - cityWidth / 2;
                const z = (j * (buildingSize + spacing) - cityDepth / 2) + startPositionZ;
                const y = height / 2;

                building.position.set(x, y, z);

                this.scene.add(building);
                this.buildings.push(building);

                if (i !== numBuildingsX - 1) {
                    const linePositionX = x + buildingSize * 0.5 + spacing * 0.5;

                    if (!this.linesBetweenBuilding.includes(linePositionX)) {
                        this.linesBetweenBuilding.push(linePositionX);
                        this.addRoad(x);
                    }
                }                
            }
        }
    }
}
