export class GameState {
    constructor() {
        this.kills = 0;
        this.isGameOver = false;
        this.listeners = new Set();
    }

    subscribe(listener) {
        this.listeners.add(listener);
        listener(this.getSnapshot());

        return () => {
            this.listeners.delete(listener);
        };
    }

    emit() {
        const snapshot = this.getSnapshot();
        this.listeners.forEach((listener) => listener(snapshot));
    }

    getSnapshot() {
        return {
            kills: this.kills,
            isGameOver: this.isGameOver
        };
    }

    addKill() {
        this.kills += 1;
        this.emit();
    }

    setGameOver(value) {
        if (this.isGameOver === value) return;
        this.isGameOver = value;
        this.emit();
    }

    reset() {
        this.kills = 0;
        this.isGameOver = false;
        this.emit();
    }
}