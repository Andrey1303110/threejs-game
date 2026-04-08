import { GLTFLoader } from '../loaders/GLTFLoader.js';
import { DRACOLoader } from '../loaders/DRACOLoader.js';

export class LoaderFactory {
    createPlayerLoader() {
        const loader = new GLTFLoader();
        const dracoLoader = new DRACOLoader();

        loader.setDRACOLoader(dracoLoader);

        return loader;
    }
}