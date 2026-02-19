const pool: Record<string, HTMLAudioElement[]> = {};

export function loadSounds() {
    ['swoosh', 'click'].forEach(name => {
        pool[name] = Array.from({ length: 5 }, () => {
            const a = new Audio(`/sounds/${name}.wav`);
            a.volume = name === 'swoosh' ? 0.4 : 0.6;
            return a;
        });
    });
}

export function playSound(name: string) {
    const sounds = pool[name];
    if (!sounds) return;
    const audio = sounds.find(a => a.paused || a.ended) ?? sounds[0];
    audio.currentTime = 0;
    audio.play().catch(() => { });
}