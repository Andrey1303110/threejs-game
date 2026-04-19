import * as THREE from 'three';
import { PLAYER_CONFIG } from '../config';

export class SceneFactory {
    createCamera() {
        const { fov, near, far } = PLAYER_CONFIG.camera;
        const aspect = window.innerWidth / window.innerHeight;

        return new THREE.PerspectiveCamera(fov, aspect, near, far);
    }

    createScene() {
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xefd1b5);
        scene.fog = new THREE.FogExp2(0xefd1b5, 0.01);

        const ambient = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 0.5);
        scene.add(ambient);

        const light = new THREE.DirectionalLight(0xffffff, 4);
        light.position.set(0, 1, 1);
        scene.add(light);

        return scene;
    }

    create() {
        const camera = this.createCamera();
        const scene = this.createScene();

        return { camera, scene };
    }
}