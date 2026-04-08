import * as THREE from 'three';

export class XRFactory {
    create(renderer, scene) {
        const controller1 = renderer.xr.getController(0);
        const controller2 = renderer.xr.getController(1);

        const geometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, -1)
        ]);

        const line = new THREE.Line(geometry);
        line.scale.z = 5;

        controller1.add(line);

        scene.add(controller1);
        scene.add(controller2);

        return { controller1, controller2 };
    }
}