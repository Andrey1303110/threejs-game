import * as THREE from 'three';

export class AudioManager {
    constructor(camera) {
        this.camera = camera;
        this.listener = new THREE.AudioListener();
        this.camera.add(this.listener);

        this.loader = new THREE.AudioLoader();

        this.buffers = new Map();

        this.masterVolume = 1;
        this.sfxVolume = 0.9;
        this.playerEngineVolume = 0.35;
        this.enemyEngineVolume = 0.5;

        this.playerEngine = null;
    }

    async loadAll() {
        const entries = await Promise.all([
            this.loadBuffer('shot', './assets/audio/shot.mp3'),
            this.loadBuffer('player_boom', './assets/audio/player_boom.mp3'),
            this.loadBuffer('enemy_boom', './assets/audio/enemy_boom.mp3'),
            this.loadBuffer('engine_player', './assets/audio/engine.mp3'),
            this.loadBuffer('engine_enemy', './assets/audio/engine.mp3')
        ]);

        entries.forEach(([key, buffer]) => {
            this.buffers.set(key, buffer);
        });
    }

    loadBuffer(key, url) {
        return new Promise((resolve, reject) => {
            this.loader.load(
                url,
                (buffer) => resolve([key, buffer]),
                undefined,
                (err) => reject(err)
            );
        });
    }

    getBuffer(key) {
        return this.buffers.get(key);
    }

    unlock() {
        const context = this.listener.context;
        if (context.state === 'suspended') {
            context.resume();
        }
    }

    createPlayerEngineAudio(parent) {
        const buffer = this.getBuffer('engine_player');
        if (!buffer) return null;

        const audio = new THREE.Audio(this.listener);
        audio.setBuffer(buffer);
        audio.setLoop(true);
        audio.setVolume(this.playerEngineVolume * this.masterVolume);

        parent.add(audio);
        this.playerEngine = audio;

        return audio;
    }

    createEnemyEngineAudio(parent) {
        return;
        // todo check sound issue
        // create positional engine audio for enemies
        // const buffer = this.getBuffer('engine_enemy');
        // if (!buffer) return null;

        // const audio = new THREE.PositionalAudio(this.listener);
        // audio.setBuffer(buffer);
        // audio.setLoop(true);
        // audio.setVolume(this.enemyEngineVolume * this.masterVolume);

        // audio.setRefDistance(12);
        // audio.setMaxDistance(180);
        // audio.setRolloffFactor(1.5);
        // audio.setDistanceModel('inverse');
        // audio.setDirectionalCone(180, 260, 0.15);

        // parent.add(audio);

        // return audio;
    }

    playPlayerBoom(volume = 1) {
        const buffer = this.getBuffer('player_boom');
        if (!buffer) return null;

        const audio = new THREE.Audio(this.listener);
        audio.setBuffer(buffer);
        audio.setLoop(false);
        audio.setVolume(volume * this.sfxVolume * this.masterVolume);

        // attach to camera so it's heard reliably
        if (this.camera) {
            this.camera.add(audio);
        }

        audio.play();

        if (audio.source) {
            audio.source.onended = () => {
                if (this.camera) {
                    this.camera.remove(audio);
                }
                audio.disconnect();
            };
        }

        return audio;
    }

    playEnemyBoom(parent, volume = 1) {
        return;
        // todo check sound issue
        // const buffer = this.getBuffer('enemy_boom');
        // if (!buffer) return null;

        // const audio = new THREE.PositionalAudio(this.listener);
        // audio.setBuffer(buffer);
        // audio.setLoop(false);
        // audio.setVolume(volume * this.sfxVolume * this.masterVolume);

        // audio.setRefDistance(8);
        // audio.setMaxDistance(180);
        // audio.setRolloffFactor(1.2);
        // audio.setDistanceModel('inverse');

        // parent.add(audio);
        // audio.play();

        // if (audio.source) {
        //     audio.source.onended = () => {
        //         parent.remove(audio);
        //         audio.disconnect();
        //     };
        // }

        // return audio;
    }

    playShot(parent, volume = 0.5) {
        const buffer = this.getBuffer('shot');
        if (!buffer) return null;

        const audio = new THREE.PositionalAudio(this.listener);
        audio.setBuffer(buffer);
        audio.setLoop(false);
        audio.setVolume(volume * this.sfxVolume * this.masterVolume);

        audio.setRefDistance(10);
        audio.setMaxDistance(120);
        audio.setRolloffFactor(1.2);
        audio.setDistanceModel('inverse');

        parent.add(audio);
        audio.play();

        audio.source.onended = () => {
            parent.remove(audio);
            audio.disconnect();
        };

        return audio;
    }

    startPlayerEngine() {
        if (!this.playerEngine) return;
        if (!this.playerEngine.isPlaying) {
            this.playerEngine.play();
        }
    }

    stopPlayerEngine() {
        if (!this.playerEngine) return;
        if (this.playerEngine.isPlaying) {
            this.playerEngine.stop();
        }
    }

    updatePlayerEngine(speed, minSpeed, maxSpeed) {
        if (!this.playerEngine) return;

        const t = THREE.MathUtils.clamp(
            (speed - minSpeed) / (maxSpeed - minSpeed),
            0,
            1
        );

        const volume = THREE.MathUtils.lerp(0.18, 0.6, t) * this.masterVolume;
        const playbackRate = THREE.MathUtils.lerp(0.85, 1.35, t);

        this.playerEngine.setVolume(volume);

        if (this.playerEngine.source?.playbackRate) {
            this.playerEngine.source.playbackRate.value = playbackRate;
        }
    }

    updateEnemyEngine(audio, speed, minSpeed, maxSpeed, distanceToPlayer = 0) {
        if (!audio) return;

        const t = THREE.MathUtils.clamp(
            (speed - minSpeed) / (maxSpeed - minSpeed),
            0,
            1
        );

        const baseVolume = THREE.MathUtils.lerp(0.15, 0.45, t);
        const attenuation = THREE.MathUtils.clamp(1 - distanceToPlayer / 220, 0.15, 1);

        audio.setVolume(baseVolume * attenuation * this.masterVolume);

        if (audio.source?.playbackRate) {
            audio.source.playbackRate.value = THREE.MathUtils.lerp(0.9, 1.2, t);
        }
    }

    setMasterVolume(value) {
        this.masterVolume = THREE.MathUtils.clamp(value, 0, 1);
    }

    dispose() {
        this.stopPlayerEngine();

        if (this.playerEngine) {
            this.playerEngine.disconnect();
            this.playerEngine = null;
        }

        this.buffers.clear();
    }
}