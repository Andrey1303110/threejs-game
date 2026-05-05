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
import { TrafficSystem } from './src/TrafficSystem.js';
import { BUTTONS_LEFT, BUTTONS_RIGHT, CONTROLLER_NAME, GAME_MODE } from './src/constants.js';
import { GAME_CONFIG } from './src/config.js';

class App {
    constructor() {
        this.clock = new THREE.Clock();
        // accumulator for fixed-timestep updates (helps make controls frame-rate independent)
        this._accumulator = 0;
        // target physics/update rate (use 90Hz to match initial VR framerate feel)
        this._fixedDelta = GAME_CONFIG.targetFPS;
        // clamp large frame deltas (prevents spiral of death when tab was backgrounded)
        this._maxFrameDelta = GAME_CONFIG.maxFrameDelta;

        this.sceneFactory = new SceneFactory();
        this.rendererFactory = new RendererFactory();
        this.xrFactory = new XRFactory();
        this.playerRigFactory = new PlayerRigFactory();
        this.loaderFactory = new LoaderFactory();

        this.container = this.createContainer();
        this.renderer = this.rendererFactory.create(this.container);

        this.mode = GAME_MODE.LOADING;
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

        this.trafficSystem = new TrafficSystem(this.scene, this.city);

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
        this.loader.setPath('./assets/3d_models/shahed_131_white/');

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

        this.city.initializeAroundPlayer(this.playerRig.position.z);

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
            audioManager: this.audioManager,
            onStart: () => this.startGame()
        });

        this.loadingBar.visible = false;
        this.mode = GAME_MODE.START;

        this.renderer.setAnimationLoop(this.render.bind(this));
    }

    startGame() {
        this.audioManager.unlock();
        this.audioManager.startPlayerEngine?.();

        this.mode = GAME_MODE.GAME;
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
        // frameDelta is clamped to avoid huge jumps when tab/window was inactive
        const frameDeltaRaw = this.clock.getDelta();
        const frameDelta = Math.min(frameDeltaRaw, this._maxFrameDelta);
        const elapsedTime = this.clock.elapsedTime;

        // if player isn't ready yet, just render a frame
        if (!this.playerController) {
            this.renderer.render(this.scene, this.camera);
            return;
        }

        // START mode uses the frame delta for the preview UI (no physics sensitivity)
        if (this.mode === GAME_MODE.START) {
            this.startScreen.update(frameDelta);
            this.startScreen.render(this.renderer);
            return;
        }

        this.handleMainMenuInput();

        // accumulate time and step the game systems at a fixed rate so controls and physics
        // remain stable regardless of rendering FPS
        this._accumulator += frameDelta;

        const fixedDt = this._fixedDelta;

        if (!this.gameState.isGameOver) {
            // step systems in fixed increments
            while (this._accumulator >= fixedDt) {
                this.playerController.update(fixedDt);

                if (this.trafficSystem) this.trafficSystem.update(fixedDt, this.playerRig.position.z);

                // city.update is based on player position, doesn't need dt param
                this.city.update(this.playerRig.position.z);

                this.enemySystem.update(
                    fixedDt,
                    this.playerRig.position.z
                );

                this.bulletSystem.update(
                    fixedDt,
                    this.enemySystem.enemies,
                    this.city.buildings,
                    this.playerController,
                    elapsedTime
                );

                this._accumulator -= fixedDt;
            }

            // collisions and game-over checks after stepping
            const hasCollision = this.playerController.updateCollisions(
                this.city.buildings,
                this.enemySystem.enemies
            );

            if (hasCollision || this.playerController.touchedGround) {
                if (!this.gameState.isGameOver) {
                    this.audioManager?.playPlayerBoom?.(1);
                    this.gameState.setGameOver(true);
                }
            }
        } else {
            this.handleRestartInput();
        }

        this.playerController.updateCamera();

        if (this.vrHud) {
            // HUD can use the per-frame (clamped) delta for smoother display
            this.vrHud.render({
                ...this.gameState.getSnapshot(),
                speed: this.playerController ? this.playerController.currentSpeed : 0,
                altitude: this.playerRig ? this.playerRig.position.y : 0,
                enemies: this.enemySystem ? this.enemySystem.enemies : [],
                playerPosition: this.playerRig ? this.playerRig.position : null,
                deltaTime: frameDelta,
            });
        }

        this.renderer.render(this.scene, this.camera);
    }

    handleRestartInput() {
        if (!this.renderer.xr.isPresenting) return;

        const session = this.renderer.xr.getSession();
        if (!session) return;

        let triggerPressed = false;

        for (const source of session.inputSources) {
            if (!source.gamepad) continue;

            if (source.gamepad.buttons[BUTTONS_LEFT.TRIGGER]?.pressed || source.gamepad.buttons[BUTTONS_RIGHT.TRIGGER]?.pressed) {
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
        this.city.reset();
        this.city.initializeAroundPlayer(this.playerRig.position.z);
        this.trafficSystem.reset();

        this.audioManager.stopPlayerEngine?.();

        this.vrHud.root.visible = false;
        this.mode = GAME_MODE.START;

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
        this.city.reset();
        this.city.initializeAroundPlayer(this.playerRig.position.z);
        this.trafficSystem.reset();

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

        if (this.trafficSystem) {
            this.trafficSystem.dispose();
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