export class HandTracker {
    constructor() {
        this.simulatedMode = true; // 🚧 开启模拟调试模式
        this.lastTriggerTime = 0;
    }

    async init() {
        console.log("🖐️ HandTracker (LuckyDog Edition) Initialized");
        // 如果是真实项目，这里初始化 MediaPipe Hands 实例
        return Promise.resolve();
    }

    detect() {
        // --- 模拟逻辑 Start ---
        if (this.simulatedMode) {
            const now = Date.now();
            // 每 3000ms 自动触发一次挥手
            if (now - this.lastTriggerTime > 3000) {
                this.lastTriggerTime = now;
                console.log("🤖 模拟触发: 挥手 (WAVE)");
                return { type: 'WAVE' };
            }
            return { type: 'NONE' };
        }
        // --- 模拟逻辑 End ---

        // TODO: 接入真实的 MediaPipe 坐标判断逻辑
        // const isWaving = checkWaveGesture(landmarks);
        // return isWaving ? { type: 'WAVE' } : { type: 'NONE' };
        
        return { type: 'NONE' };
    }
}