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
import { AudioManager } from './src/audio/AudioManager.js';
import { BUTTONS_LEFT, CONTROLLER_NAME } from './src/constants.js';

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
        this.wasMenuButtonPressed = false;

        this.startScreen = null;

        this.initGameWorld();
        this.initGameSystems();
        this.bindEvents();
        this.loadAssets();

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

        this.audioManager = new AudioManager(this.camera);

        this.playerController = null;
        this.enemySystem = null;
        this.bulletSystem = null;

        this.loader = this.loaderFactory.createPlayerLoader();
    }

    bindEvents() {
        this.handleResize = this.resize.bind(this);
        this.handleBeforeUnload = this.dispose.bind(this);
        this.handlePointerUnlockAudio = this.unlockAudio.bind(this);

        window.addEventListener('resize', this.handleResize);
        window.addEventListener('beforeunload', this.handleBeforeUnload);

        window.addEventListener('pointerdown', this.handlePointerUnlockAudio, { once: true });
        window.addEventListener('keydown', this.handlePointerUnlockAudio, { once: true });
    }

    async loadAssets() {
        try {
            await this.audioManager.loadAll();
            this.loadPlayerModel();
        } catch (error) {
            console.error('Audio loading failed:', error);
            this.loadPlayerModel();
        }
    }

    unlockAudio() {
        this.audioManager.unlock();
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
            gltf,
            audioManager: this.audioManager
        });

        this.enemySystem = new EnemySystem(
            this.scene,
            this.city,
            this.audioManager,
            this.playerRig
        );

        this.enemySystem.setSource(
            gltf,
            this.playerController.animations
        );

        this.bulletSystem = new BulletSystem(
            this.scene,
            this.renderer,
            this.gameState,
            this.audioManager
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
        this.audioManager.unlock();
        this.audioManager.startPlayerEngine?.();

        this.mode = 'game';
        this.vrHud.root.visible = true;
        this.restart();
    }

    resize() {
        if (this.camera) {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
        }

        if (this.startScreen) {
            this.startScreen.resize();
        }

        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    render() {
        const deltaTime = this.clock.getDelta();
        const elapsedTime = this.clock.elapsedTime;

        if (!this.playerController) {
            this.renderer.render(this.scene, this.camera);
            return;
        }

        if (this.mode === 'start') {
            this.startScreen.update(deltaTime);
            this.startScreen.render(this.renderer);
            return;
        }

        this.handleMainMenuInput();

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

            const hasCollision = this.playerController.updateCollisions(
                this.city.buildings,
                this.enemySystem.enemies
            );

            if (hasCollision) {
                this.gameState.setGameOver(true);
            }
        } else {
            this.handleRestartInput();
        }

        this.playerController.updateCamera();

        this.vrHud.render({
            ...this.gameState.getSnapshot(),
            speed: this.playerController ? this.playerController.currentSpeed : 0,
            altitude: this.playerRig ? this.playerRig.position.y : 0
        });

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

    handleMainMenuInput() {
        if (!this.renderer.xr.isPresenting) {
            this.wasMenuButtonPressed = false;
            return;
        }

        const session = this.renderer.xr.getSession();
        if (!session) {
            this.wasMenuButtonPressed = false;
            return;
        }

        let menuPressed = false;

        for (const source of session.inputSources) {
            if (!source.gamepad) continue;
            if (source.handedness !== CONTROLLER_NAME.LEFT) continue;

            if (this.isLeftMenuPressed(source)) {
                menuPressed = true;
                break;
            }
        }

        if (menuPressed && !this.wasMenuButtonPressed) {
            this.returnToMainMenu();
        }

        this.wasMenuButtonPressed = menuPressed;
    }

    isLeftMenuPressed(source) {
        const buttons = source.gamepad.buttons;
        if (!buttons || !buttons.length) return false;

        return buttons[BUTTONS_LEFT.Y]?.pressed;
    }

    returnToMainMenu() {
        if (!this.playerController) return;

        this.enemySystem.reset();
        this.bulletSystem.reset();
        this.playerController.reset();
        this.gameState.reset();

        this.audioManager.stopPlayerEngine?.();

        this.vrHud.root.visible = false;
        this.mode = 'start';

        this.wasMenuButtonPressed = false;
        this.wasRestartTriggerPressed = false;
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

        this.audioManager.startPlayerEngine?.();

        this.wasRestartTriggerPressed = false;
        this.wasMenuButtonPressed = false;
    }

    dispose() {
        window.removeEventListener('resize', this.handleResize);
        window.removeEventListener('beforeunload', this.handleBeforeUnload);

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

        if (this.audioManager) {
            this.audioManager.dispose();
        }

        if (this.scene) {
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