import * as THREE from 'three';
import { LoadingBar } from './LoadingBar.js';
import { City } from './City.js';
import { GLTFLoader } from './loaders/GLTFLoader.js';
import { DRACOLoader } from './loaders/DRACOLoader.js';
import { VRButton } from 'three/examples/jsm/Addons.js';

import { PlayerController } from './PlayerController.js';
import { BulletSystem } from './BulletSystem.js';
import { EnemySystem } from './EnemySystem.js';

class App {
    constructor() {
        this.initDom();
        this.initCore();
        this.initScene();
        this.initRenderer();
        this.initXRControllers();
        this.initPlayerRig();
        this.initSystems();
        this.bindEvents();

        this.loadPlayerModel();
        window.app = this;
    }

    initDom() {
        this.container = document.createElement('div');
        document.body.appendChild(this.container);
    }

    initCore() {
        this.clock = new THREE.Clock();
    }

    initScene() {
        this.camera = new THREE.PerspectiveCamera(
            50,
            window.innerWidth / window.innerHeight,
            1,
            500
        );

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xefd1b5);
        this.scene.fog = new THREE.FogExp2(0xefd1b5, 0.01);

        const ambient = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 0.5);
        this.scene.add(ambient);

        const light = new THREE.DirectionalLight(0xffffff, 4);
        light.position.set(0, 1, 1);
        this.scene.add(light);

        this.city = new City(this.scene);
        this.loadingBar = new LoadingBar();
    }

    initRenderer() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.xr.enabled = true;
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.outputEncoding = THREE.SRGBColorSpace;
        this.renderer.physicallyCorrectLights = true;

        this.container.appendChild(this.renderer.domElement);
        document.body.appendChild(VRButton.createButton(this.renderer));
    }

    initXRControllers() {
        this.controller1 = this.renderer.xr.getController(0);
        this.controller2 = this.renderer.xr.getController(1);

        const geometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, -1)
        ]);

        const line = new THREE.Line(geometry);
        line.scale.z = 5;

        this.controller1.add(line);

        this.scene.add(this.controller1);
        this.scene.add(this.controller2);
    }

    initPlayerRig() {
        this.playerRig = new THREE.Group();
        this.playerRig.position.set(0, 80, 0);

        this.cameraPivot = new THREE.Group();
        this.cameraPivot.position.set(0, 1.5, 1);

        this.cameraPivot.add(this.camera);
        this.playerRig.add(this.cameraPivot);
        this.scene.add(this.playerRig);
    }

    initSystems() {
        this.playerController = null;
        this.bulletSystem = new BulletSystem(this.scene, this.renderer);
        this.enemySystem = new EnemySystem(this.scene, this.city);
    }

    bindEvents() {
        this.handleResize = this.resize.bind(this);
        window.addEventListener('resize', this.handleResize);
        window.addEventListener('beforeunload', () => this.dispose());
    }

    loadPlayerModel() {
        const loader = new GLTFLoader();
        loader.setPath('./assets/shahed-131_special_edition_white/');

        const dracoLoader = new DRACOLoader();
        loader.setDRACOLoader(dracoLoader);

        loader.load(
            'scene.gltf',
            (gltf) => this.setupPlayer(gltf),
            (xhr) => {
                this.loadingBar.progress = xhr.loaded / xhr.total;
            },
            (err) => {
                console.error(err);
            }
        );
    }

    setupPlayer(gltf) {
        this.playerController = new PlayerController({
            playerRig: this.playerRig,
            camera: this.camera,
            renderer: this.renderer,
            gltf
        });

        this.enemySystem.setSource(gltf, this.playerController.animations);

        this.loadingBar.visible = false;
        this.renderer.setAnimationLoop(this.render.bind(this));
    }

    resize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    render() {
        const deltaTime = this.clock.getDelta();
        const elapsedTime = this.clock.elapsedTime;

        if (!this.playerController) {
            this.renderer.render(this.scene, this.camera);
            return;
        }

        this.playerController.update(deltaTime);
        this.enemySystem.update(deltaTime, this.playerRig.position.z, elapsedTime);
        this.bulletSystem.update(
            deltaTime,
            this.enemySystem.enemies,
            this.playerController,
            elapsedTime
        );
        this.playerController.updateCollisions(this.city.buildings, this.enemySystem.enemies);
        this.playerController.updateCamera();

        this.renderer.render(this.scene, this.camera);
    }

    dispose() {
        window.removeEventListener('resize', this.handleResize);
        this.renderer.setAnimationLoop(null);

        if (this.playerController) {
            this.playerController.dispose();
        }

        this.bulletSystem.dispose();
        this.enemySystem.dispose();

        this.scene.traverse((object) => {
            if (object.geometry) {
                object.geometry.dispose();
            }

            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach((material) => material.dispose());
                } else {
                    object.material.dispose();
                }
            }
        });

        this.renderer.dispose();
        console.log('App disposed');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new App();
});