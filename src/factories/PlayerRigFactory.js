import * as THREE from 'three';
import { PLAYER_CONFIG } from '../config';

export class PlayerRigFactory {
    create(camera, scene) {
        const playerRig = new THREE.Group();
        playerRig.position.copy(PLAYER_CONFIG.position);

        const cameraPivot = new THREE.Group();
        cameraPivot.position.copy(PLAYER_CONFIG.cameraOffset);

        cameraPivot.add(camera);
        playerRig.add(cameraPivot);
        scene.add(playerRig);

        return { playerRig, cameraPivot };
    }
}