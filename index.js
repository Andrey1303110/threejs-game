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

class App {
    constructor() {
        this.clock = new THREE.Clock();

        this.sceneFactory = new SceneFactory();
        this.rendererFactory = new RendererFactory();
        this.xrFactory = new XRFactory();
        this.playerRigFactory = new PlayerRigFactory();
        this.loaderFactory = new LoaderFactory();

        this.container = this.createContainer();

        const { scene, camera } = this.sceneFactory.create();
        this.scene = scene;
        this.camera = camera;

        this.renderer = this.rendererFactory.create(this.container);

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

        this.gameState = new GameState();
        this.vrHud = new VRHud(this.camera);
        this.unsubscribeGameState = this.gameState.subscribe((state) => {
            this.vrHud.render(state);
        });

        this.playerController = null;
        this.enemySystem = new EnemySystem(this.scene, this.city);
        this.bulletSystem = new BulletSystem(this.scene, this.renderer, this.gameState);

        this.loader = this.loaderFactory.createPlayerLoader();

        this.wasRestartTriggerPressed = false;

        this.bindEvents();
        this.loadPlayerModel();

        window.app = this;
    }

    createContainer() {
        const container = document.createElement('div');
        document.body.appendChild(container);
        return container;
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
        window.removeEventListener('beforeunload', this.handleBeforeUnload);

        if (this.unsubscribeGameState) {
            this.unsubscribeGameState();
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