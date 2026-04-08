import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/Addons.js';

export class RendererFactory {
    create(container) {
        const renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true
        });

        renderer.xr.enabled = true;
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.outputEncoding = THREE.SRGBColorSpace;
        renderer.physicallyCorrectLights = true;

        container.appendChild(renderer.domElement);
        document.body.appendChild(VRButton.createButton(renderer));

        return renderer;
    }
}