import * as THREE from 'three';

export class PlayerRigFactory {
    create(camera, scene) {
        const playerRig = new THREE.Group();
        playerRig.position.set(0, 80, 0);

        const cameraPivot = new THREE.Group();
        cameraPivot.position.set(0, 1.5, 1);

        cameraPivot.add(camera);
        playerRig.add(cameraPivot);
        scene.add(playerRig);

        return { playerRig, cameraPivot };
    }
}