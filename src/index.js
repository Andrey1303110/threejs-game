import * as THREE from 'three';
import { LoadingBar } from './LoadingBar.js';
import { City } from './City.js';
import { GLTFLoader } from './loaders/GLTFLoader.js';
import { DRACOLoader } from './loaders/DRACOLoader.js';

// const DEFAULT_SPEED = 0;
const DEFAULT_SPEED = 10;
const MAX_SPEED = 25;

class App{
	constructor(){
		const container = document.createElement('div');
		document.body.appendChild(container);

        this.clock = new THREE.Clock();
        
		this.camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 1, 500);
        this.camera.position.set(0, 125, 0);
        
		this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xefd1b5);
        
		const ambient = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 0.5);
		this.scene.add(ambient);
        
        const light = new THREE.DirectionalLight(0xFFFFFF, 4);
        light.position.set(0, 1, 1);
        this.scene.add(light);
			
		this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
		this.renderer.setPixelRatio(window.devicePixelRatio);
		this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.outputEncoding = THREE.SRGBColorSpace;
        this.renderer.physicallyCorrectLights = true;
        container.appendChild(this.renderer.domElement);

		this.city = new City(this.scene);
    
        this.loadingBar = new LoadingBar();        

        this.loadGLTF();

        this.bullets = [];
        this.enemies = [];
        this.lastShootTime = 0;
        this.lastEnemyIndex = 0;
        this.tiltAngle = 0;
        this.enemyCount = 0;

		this.scene.fog = new THREE.FogExp2(0xefd1b5, 0.01);

		// let grid = new THREE.GridHelper(1000, 20, 0x000000, 0x0e0e0e);
		// grid.position.y = 0;
		// grid.material.opacity = 0.2;
		// grid.material.transparent = true;
		// this.scene.add(grid);
        
        window.addEventListener('resize', this.resize.bind(this));
        window.addEventListener('beforeunload', () => this.dispose());

        this.setupKeyControls();
        window.test = this;
	}
    
    loadGLTF() {
        const loader = new GLTFLoader();
        loader.setPath('./assets/shahed-131_special_edition_white/');

        const dracoLoader = new DRACOLoader();
        // dracoLoader.setDecoderPath('./libs/three/examples/jsm/libs/draco/');

        loader.setDRACOLoader(dracoLoader);

        loader.load(
            'scene.gltf',
            gltf => {
                this.originalGLTF = gltf; // Сохраняем оригинальную модель
                this.addPlayer(gltf);
                // this.addEnemies();
            },
            xhr => {
                this.loadingBar.progress = (xhr.loaded / xhr.total);
            },
            err => {
                console.error(err);
            }
        );
    }

    addPlayer(gltf) {
        const geometry = new THREE.BoxGeometry(2.5, 0.75, 2.25);
        const material = new THREE.MeshBasicMaterial({ color: 0xff00ff, visible: false }); // remove visble for debug
        const mesh = new THREE.Mesh(geometry, material);
        this.player = gltf.scene;
        this.player.rotation.y = Math.PI/2;
        this.player.position.y = 80;
        this.player.currentSpeed = DEFAULT_SPEED;
        this.player.scale.set(2.25, 2.25, 2.25);
        this.player.add(mesh);
        this.player.mesh = this.player.children[1];
        this.player.direction = new THREE.Vector3(0, 0, -1);

        this.mixer = new THREE.AnimationMixer(this.player);
        this.animations = {};

        const names = [];

        gltf.animations.forEach(clip => {
            const name = clip.name.toLowerCase();
            names.push(name);
            this.animations[name] = clip;
        })

        console.log(`animations: ${names.join(',')}`);
        
        this.action = 'fuselage';

        this.scene.add(this.player);
        
        this.loadingBar.visible = false;
        
        this.renderer.setAnimationLoop(this.render.bind(this));
    }

    addEnemies() {
        const enemiesCount = 40; // todo add calculating nums of enemies by distance offset

        if (!this.originalGLTF) {
            console.error("GLTF-модель ещё не загружена!");
            return;
        }

        for (let i = 0; i < enemiesCount; i++) {
            this.addEnemy(this.originalGLTF);
        }
    }

    addEnemy(gltf) {
        if (!this.originalGLTF) {
            return;
        }

        gltf = this.originalGLTF;
        const addEnemyDelay = 4;
        const enemiesCount = 40;

        if (this.enemyCount > enemiesCount) {
            return;
        }

        if (this.clock.elapsedTime <= this.lastEnemyAddedTime + addEnemyDelay) {
            return;
        }

        const lines = this.city.linesBetweenBuilding;
        const enemy = gltf.scene.clone();
        enemy.rotation.y = Math.PI * 1.5;
        
        // const xIndex = getRandomInRange(0, lines.length-1);
        const xIndex = 3;
        const x = lines[xIndex];
        const y = getRandomInRange(60, 90);
        const startPositionOffset = 180;
        const offsetBetweenEnemies = 120;
        const zPosition = (this.enemyCount + 1) * offsetBetweenEnemies + startPositionOffset;
        
        enemy.position.set(x, y, -zPosition);
        this.enemies.push(enemy);

        enemy.mixer = new THREE.AnimationMixer(enemy);

        const fuselageAnimation = this.animations?.['fuselage'];
        if (fuselageAnimation) {
            const action = enemy.mixer.clipAction(fuselageAnimation);
            action.play();
        }

        this.scene.add(enemy);

        this.lastEnemyAddedTime = this.clock.elapsedTime;
        this.enemyCount++;
    }

    updateEnemies(deltaTime) {
        if (this.enemies) {;
            const cameraOffset = 30;
            for (let i = this.enemies.length - 1; i >= 0; i--) {
                const enemy = this.enemies[i];
                
                if (enemy.position.z >= this.player.position.z + cameraOffset) {
                    this.scene.remove(enemy);
                    return this.enemies.splice(i, 1);
                }

                enemy.position.z += DEFAULT_SPEED * deltaTime;
                enemy.mixer.update(deltaTime);
            }
            
        }
    }

    set action(name){
		if (this.actionName == name.toLowerCase()) return;
				
		const clip = this.animations[name.toLowerCase()];

		if (clip!==undefined){
			const action = this.mixer.clipAction(clip);
			action.reset();
			this.actionName = name.toLowerCase();
			action.play();
            if (this.curAction) {
                this.curAction.crossFadeTo(action, 0.5);
            }
			this.curAction = action;
		}
	}

    setupKeyControls() {
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            shoot: false,
            acceleration: false
        };

        const keyMap = {
            ArrowUp: 'forward', KeyW: 'forward',
            ArrowDown: 'backward', KeyS: 'backward',
            ArrowLeft: 'left', KeyA: 'left',
            ArrowRight: 'right', KeyD: 'right',
            Space: 'shoot',
            ShiftLeft: 'acceleration'
        };

        const updateKey = (event, value) => {
            if (keyMap[event.code] !== undefined) {
                this.keys[keyMap[event.code]] = value;
            }
        };

        window.addEventListener('keydown', (event) => updateKey(event, true));
        window.addEventListener('keyup', (event) => updateKey(event, false));
    }

    updateCamera(deltaTime) {
        if (!this.player || !this.player.position) {
            console.error("Player или его позиция не определены!");
            return;
        }

        const offset = new THREE.Vector3(0, 3, 8); // Смещение камеры
        const elasticity = 2; // Параметр эластичности

        const targetPosition = new THREE.Vector3().copy(this.player.position).add(offset);

        this.camera.position.lerp(targetPosition, deltaTime * elasticity);

        // Камера смотрит на игрока
        this.camera.lookAt(this.player.position);
    }

    updateMovement(deltaTime) {
        const maxTilt = Math.PI / 2 * 0.65; // максимальный угол наклона (треть от 180)
        const tiltSpeed = 0.75; // скорость наклона

        // Двигаем объект в зависимости от нажатых клавиш
        if (this.keys.forward) {
            this.player.position.y += this.player.currentSpeed * deltaTime; // Вверх
        }
        if (this.keys.backward) {
            this.player.position.y -= this.player.currentSpeed * deltaTime; // Вниз
        }

        // Управляем наклоном
        if (this.keys.left) {
            this.turn(-1, tiltSpeed, deltaTime, maxTilt);
        }
        if (this.keys.right) {
            this.turn(1, tiltSpeed, deltaTime, maxTilt);
        }

        // Если клавиши влево/вправо не нажаты, плавно возвращаем угол к 0
        if (!this.keys.left && !this.keys.right) {
            if (this.tiltAngle > 0) {
                this.tiltAngle = Math.max(this.tiltAngle - tiltSpeed * deltaTime, 0);
            } else if (this.tiltAngle < 0) {
                this.tiltAngle = Math.min(this.tiltAngle + tiltSpeed * deltaTime, 0);
            }
        }

        if (this.keys.acceleration) {
            this.accelerate();
        }

        if (!this.keys.acceleration) {
            this.deAccelerate();
        }

        // Устанавливаем начальный поворот по оси Z (90 градусов)
        const initialRotationZ = Math.PI * 0.5; // Поворот на 90 градусов

        // Создаем вектор оси для наклона по локальной оси Y (влево-вправо)
        const tiltAxis = new THREE.Vector3(1, 0, 0); // Ось Y для наклона

        // Устанавливаем поворот объекта, комбинируя начальный поворот и наклон
        this.player.rotation.set(0, initialRotationZ, 0); // Начальный поворот по Z
        this.player.rotateOnAxis(tiltAxis, this.tiltAngle); // Наклоняем объект относительно Y
    }

    turn(direction, tiltSpeed, deltaTime, maxTilt) {
        // Если наклон не равен 0, сначала возвращаем его к 0
        if ((direction < 0 && this.tiltAngle > 0) || (direction > 0 && this.tiltAngle < 0)) {
            this.tiltAngle = THREE.MathUtils.clamp(
                this.tiltAngle - Math.sign(this.tiltAngle) * tiltSpeed * 2 * deltaTime, 
                -maxTilt, 
                maxTilt
            );
        } else {
            // Теперь наклоняем модель в нужную сторону
            this.tiltAngle = THREE.MathUtils.clamp(
                this.tiltAngle + direction * tiltSpeed * deltaTime, 
                -maxTilt, 
                maxTilt
            );

            // Двигаем объект по оси X только если угол уже вернулся к 0 или начал наклоняться в нужную сторону
            if (Math.abs(this.tiltAngle) < 0.01 || Math.sign(this.tiltAngle) === direction) {
                this.player.position.x += direction * this.player.currentSpeed * 2 * deltaTime;
            }
        }
    }

    accelerate() {
        const increment = 0.25;
        const newSpeed = this.player.currentSpeed + increment;

        this.player.currentSpeed = Math.min(newSpeed, MAX_SPEED);
    }

    deAccelerate() {
        const decrement = 0.75;
        const newSpeed = this.player.currentSpeed - decrement;

        this.player.currentSpeed = Math.max(newSpeed, DEFAULT_SPEED);
    }

    shoot() {
        if (!this.keys.shoot) {
            return;
        }

        const reloadTime = 0.4;
        if (this.clock.elapsedTime <= this.lastShootTime + reloadTime) {
            return;
        }

        // Создаём пулю
        const bulletGeometry = new THREE.SphereGeometry(0.25, 8, 8);
        const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);

        // Позиционируем пулю перед объектом
        bullet.position.set(this.player.position.x, this.player.position.y, this.player.position.z - 0.5);
        bullet.velocity = new THREE.Vector3(0, 0, -MAX_SPEED * 3); // Скорость движения
        bullet.lifetime = 2; // Время жизни в секундах

        this.scene.add(bullet);
        this.bullets.push(bullet);
        this.lastShootTime = this.clock.elapsedTime;
    }

    // Обновление пуль в рендере
    updateBullets(deltaTime) {
        if (!this.bullets.length) {
            return;
        }

        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];

            // Обновляем позицию пули
            bullet.position.addScaledVector(bullet.velocity, deltaTime);

            // Уменьшаем время жизни
            bullet.lifetime -= deltaTime;

            // Проверяем столкновение с врагами
            for (let j = this.enemies.length - 1; j >= 0; j--) {
                const enemy = this.enemies[j];
                const distance = bullet.position.distanceTo(enemy.position);
                if (distance < 3) { // Если пуля попала во врага
                    this.scene.remove(bullet);
                    this.scene.remove(enemy);
                    this.bullets.splice(i, 1);
                    this.enemies.splice(j, 1);
                    return;
                }
            }

            // Удаляем пулю, если она прожила дольше, чем lifetime
            if (bullet.lifetime <= 0) {
                this.scene.remove(bullet);
                this.bullets.splice(i, 1);
            }
        }
    }

    
    resize(){
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);  
    }

    dispose() {
        // Удаляем обработчики событий
        window.removeEventListener('resize', this.resize);
        
        // Очищаем рендерер
        this.renderer.dispose();
        
        // Очищаем сцену от объектов
        this.scene.traverse((object) => {
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach(material => material.dispose());
                } else {
                    object.material.dispose();
                }
            }
            if (object.texture) object.texture.dispose();
        });

        // Очищаем анимации
        if (this.mixer) {
            this.mixer.stopAllAction();
            this.mixer.uncacheRoot(this.player);
        }

        // Очищаем массивы врагов и пуль
        this.enemies.forEach(enemy => {
            enemy.mixer.stopAllAction();
            enemy.mixer.uncacheRoot(enemy);
        });
        this.enemies = [];
        this.bullets = [];

        // Очищаем анимационный цикл
        this.renderer.setAnimationLoop(null);

        console.log("App disposed");
    }

    updatePlayer(deltaTime) {
        if (!this.player) {
            return;
        }

        if (!this.city) {
            return;
        }

        if (!this.city.buildings.length) {
            return;
        }

        // Обновляем позицию пули
        this.player.position.add(this.player.direction.clone().multiplyScalar(this.player.currentSpeed * deltaTime));
        this.player.mesh.updateMatrixWorld();
        if (!this.player.boundingBox) {
            this.player.boundingBox = new THREE.Box3().setFromObject(this.player.mesh);
        } else {
            this.player.boundingBox.copy(this.player.mesh.geometry.boundingBox).applyMatrix4(this.player.mesh.matrixWorld);
        }

        this.playerToCityCollisions();
        this.playerToEnemyCollisions();
    }

    playerToCityCollisions() {
        this.city.buildings.forEach(build => {
            // Обновляем матрицу и boundingBox врага
            build.updateMatrixWorld();

            build.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    if (!child.boundingBox) {
                        child.boundingBox = new THREE.Box3().setFromObject(child);
                    }
        
                    // Обновляем boundingBox врага
                    child.boundingBox.copy(child.geometry.boundingBox).applyMatrix4(child.matrixWorld);

                    // Проверяем пересечение boundingBox пули и врага
                    if (this.player.boundingBox.intersectsBox(child.boundingBox)) {
                        console.log('player to city collision detected');
                        // this.scene.remove(this.player);
                    }
                }
            });
        });
    }

    playerToEnemyCollisions() {
        this.enemies.forEach(enemy => {
            // Обновляем матрицу и boundingBox врага
            enemy.updateMatrixWorld();

            enemy.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    if (!child.boundingBox) {
                        child.boundingBox = new THREE.Box3().setFromObject(child);
                    }
        
                    // Обновляем boundingBox врага
                    child.boundingBox.copy(child.geometry.boundingBox).applyMatrix4(child.matrixWorld);

                    // Проверяем пересечение boundingBox пули и врага
                    if (this.player.boundingBox.intersectsBox(child.boundingBox)) {
                        console.log('player to enemy collision detected');
                        // this.scene.remove(this.player);
                    }
                }
            });
        });
    }

	render() {
        const deltaTime = this.clock.getDelta();

        this.addEnemy();
        this.updateMovement(deltaTime);
        this.updateCamera(deltaTime);
        this.updateBullets(deltaTime); // Обновление полета пуль
        this.updateEnemies(deltaTime);
        this.updatePlayer(deltaTime);
    
        if (this.mixer) this.mixer.update(deltaTime);
        if (this.keys.shoot) this.shoot(); // Проверяем, нужно ли стрелять
 
        this.renderer.render(this.scene, this.camera);
    }
}

export function getRandomInRange(min, max) {
    return Math.floor(min + Math.random() * (max + 1 - min));
}

document.addEventListener("DOMContentLoaded", function(){
    const app = new App();
    window.app = app;
});
