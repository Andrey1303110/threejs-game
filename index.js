import * as THREE from 'three';

import { LoadingBar } from './src/LoadingBar.js';
import { City } from './src/City.js';
import { PlayerController } from './src/PlayerController.js';
import { BulletSystem } from './src/BulletSystem.js';
import { EnemySystem } from './src/EnemySystem.js';

import { SceneFactory } from './src/factories/SceneFactory.js';
import { RendererFactory } from './src/factories/RendererFactory.js';
import { XRFactory } from './src/factories/XRFactory.js';
import { PlayerRigFactory } from './src/factories/PlayerRigFactory.js';
import { LoaderFactory } from './src/factories/LoaderFactory.js';

import { GameState } from './src/game/GameState.js';
import { VRHud } from './src/ui/VRHud.js';
import { StartScreenScene } from './src/start-screen/StartScreenScene.js';

class App {
    constructor() {
        this.clock = new THREE.Clock();

        this.sceneFactory = new SceneFactory();
        this.rendererFactory = new RendererFactory();
        this.xrFactory = new XRFactory();
        this.playerRigFactory = new PlayerRigFactory();
        this.loaderFactory = new LoaderFactory();

        this.container = this.createContainer();
        this.renderer = this.rendererFactory.create(this.container);

        this.mode = 'loading';
        this.wasRestartTriggerPressed = false;

        this.startScreen = null;

        this.initGameWorld();
        this.initGameSystems();
        this.bindEvents();
        this.loadPlayerModel();

        window.app = this;
    }

    createContainer() {
        const container = document.createElement('div');
        document.body.appendChild(container);
        return container;
    }

    initGameWorld() {
        const { scene, camera } = this.sceneFactory.create();
        this.scene = scene;
        this.camera = camera;

        const { controller1, controller2 } = this.xrFactory.create(
            this.renderer,
            this.scene
        );
        this.controller1 = controller1;
        this.controller2 = controller2;

        const { playerRig, cameraPivot } = this.playerRigFactory.create(
            this.camera,
            this.scene
        );
        this.playerRig = playerRig;
        this.cameraPivot = cameraPivot;

        this.city = new City(this.scene);
        this.loadingBar = new LoadingBar();
    }

    initGameSystems() {
        this.gameState = new GameState();

        this.vrHud = new VRHud(this.camera);
        this.vrHud.root.visible = false;

        this.playerController = null;
        this.enemySystem = new EnemySystem(this.scene, this.city);
        this.bulletSystem = new BulletSystem(
            this.scene,
            this.renderer,
            this.gameState
        );

        this.loader = this.loaderFactory.createPlayerLoader();
    }

    bindEvents() {
        this.handleResize = this.resize.bind(this);
        this.handleBeforeUnload = this.dispose.bind(this);

        window.addEventListener('resize', this.handleResize);
        window.addEventListener('beforeunload', this.handleBeforeUnload);
    }

    loadPlayerModel() {
        this.loader.setPath('./assets/shahed-131_special_edition_white/');

        this.loader.load(
            'scene.gltf',
            (gltf) => this.setupPlayer(gltf),
            (xhr) => {
                if (xhr.total) {
                    this.loadingBar.progress = xhr.loaded / xhr.total;
                }
            },
            (err) => {
                console.error(err);
            }
        );
    }

    setupPlayer(gltf) {
        this.originalGLTF = gltf;

        this.playerController = new PlayerController({
            playerRig: this.playerRig,
            camera: this.camera,
            renderer: this.renderer,
            gltf
        });

        this.enemySystem.setSource(
            gltf,
            this.playerController.animations
        );

        this.startScreen = new StartScreenScene({
            renderer: this.renderer,
            gltf,
            onStart: () => this.startGame()
        });

        this.loadingBar.visible = false;
        this.mode = 'start';

        this.renderer.setAnimationLoop(this.render.bind(this));
    }

    startGame() {
        this.mode = 'game';
        this.vrHud.root.visible = true;
        this.restart();
    }

    resize() {
        if (this.camera) {
            this.camera.aspect =
                window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
        }

        if (this.startScreen) {
            this.startScreen.resize();
        }

        this.renderer.setSize(
            window.innerWidth,
            window.innerHeight
        );
    }

    render() {
        const deltaTime = this.clock.getDelta();
        const elapsedTime = this.clock.elapsedTime;

        if (!this.playerController) {
            this.renderer.render(this.scene, this.camera);
            return;
        }

        // 👉 СТАРТОВАЯ СЦЕНА
        if (this.mode === 'start') {
            this.startScreen.update(deltaTime);
            this.startScreen.render(this.renderer);
            return;
        }

        // 👉 ИГРА
        if (!this.gameState.isGameOver) {
            this.playerController.update(deltaTime);

            this.enemySystem.update(
                deltaTime,
                this.playerRig.position.z,
                elapsedTime
            );

            this.bulletSystem.update(
                deltaTime,
                this.enemySystem.enemies,
                this.playerController,
                elapsedTime
            );

            const hasCollision =
                this.playerController.updateCollisions(
                    this.city.buildings,
                    this.enemySystem.enemies
                );

            if (hasCollision) {
                this.gameState.setGameOver(true);
            }
        } else {
            this.handleRestartInput();
        }

        this.vrHud.render({
            ...this.gameState.getSnapshot(),
            speed: this.playerController
                ? this.playerController.currentSpeed
                : 0,
            altitude: this.playerRig
                ? this.playerRig.position.y
                : 0
        });

        this.playerController.updateCamera();
        this.renderer.render(this.scene, this.camera);
    }

    handleRestartInput() {
        if (!this.renderer.xr.isPresenting) return;

        const session = this.renderer.xr.getSession();
        if (!session) return;

        let triggerPressed = false;

        for (const source of session.inputSources) {
            if (!source.gamepad) continue;

            if (source.gamepad.buttons[0]?.pressed) {
                triggerPressed = true;
                break;
            }
        }

        if (triggerPressed && !this.wasRestartTriggerPressed) {
            this.restart();
        }

        this.wasRestartTriggerPressed = triggerPressed;
    }

    restart() {
        if (!this.playerController) return;

        this.clock.stop();
        this.clock.elapsedTime = 0;
        this.clock.start();

        this.enemySystem.reset();
        this.bulletSystem.reset();
        this.playerController.reset();
        this.gameState.reset();

        this.wasRestartTriggerPressed = false;
    }

    dispose() {
        window.removeEventListener('resize', this.handleResize);
        window.removeEventListener(
            'beforeunload',
            this.handleBeforeUnload
        );

        if (this.startScreen) {
            this.startScreen.dispose();
        }

        if (this.vrHud) {
            this.vrHud.dispose();
        }

        if (this.renderer) {
            this.renderer.setAnimationLoop(null);
        }

        if (this.playerController) {
            this.playerController.dispose();
        }

        if (this.bulletSystem) {
            this.bulletSystem.dispose();
        }

        if (this.enemySystem) {
            this.enemySystem.dispose();
        }

        if (this.scene) {
            this.scene.traverse((object) => {
                if (object.geometry) {
                    object.geometry.dispose();
                }

                if (object.material) {
                    if (Array.isArray(object.material)) {
                        object.material.forEach((material) =>
                            material.dispose()
                        );
                    } else {
                        object.material.dispose();
                    }
                }
            });
        }

        if (this.renderer) {
            this.renderer.dispose();
        }

        console.log('App disposed');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new App();
});