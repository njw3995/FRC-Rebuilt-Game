const AUDIO_SOURCES = {
    autoStart: './src/assets/audio/auto-start.wav',
    teleopStart: './src/assets/audio/teleop-start.wav',
    shiftChange: './src/assets/audio/shift-change.wav',
    endgameStart: './src/assets/audio/endgame-start.wav',
    end: './src/assets/audio/end.wav'
};

const SOUND_PROFILES = {
    autoStart: [
        { frequency: 660, duration: 0.08 },
        { frequency: 880, duration: 0.12, offset: 0.09 }
    ],

    teleopStart: [
        { frequency: 520, duration: 0.07 },
        { frequency: 660, duration: 0.07, offset: 0.08 },
        { frequency: 880, duration: 0.12, offset: 0.16 }
    ],

    shiftChange: [
        { frequency: 980, duration: 0.06 },
        { frequency: 740, duration: 0.08, offset: 0.07 }
    ],

    endgameStart: [
        { frequency: 440, duration: 0.1 },
        { frequency: 660, duration: 0.1, offset: 0.11 },
        { frequency: 880, duration: 0.16, offset: 0.22 }
    ],

    end: [
        { frequency: 330, duration: 0.18 },
        { frequency: 220, duration: 0.24, offset: 0.18 }
    ]
};

const audioCache = new Map();
let audioContext = null;

function getAudio(key) {
    const source = AUDIO_SOURCES[key];
    if (!source) return null;

    if (!audioCache.has(key)) {
        const audio = new Audio(source);
        audio.preload = 'auto';
        audio.load();
        audioCache.set(key, audio);
    }

    return audioCache.get(key);
}

function getAudioContext() {
    if (!audioContext) {
        audioContext = new AudioContext();
    }

    return audioContext;
}

function playTone(context, frequency, startTime, duration) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = 'square';
    oscillator.frequency.value = frequency;

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(0.08, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.02);
}

function playFallbackTone(key) {
    const profile = SOUND_PROFILES[key];
    if (!profile) return;

    const context = getAudioContext();
    const now = context.currentTime;

    for (const tone of profile) {
        playTone(
            context,
            tone.frequency,
            now + (tone.offset || 0),
            tone.duration
        );
    }
}

export function playSound(key) {
    try {
        const audio = getAudio(key);

        if (audio) {
            audio.currentTime = 0;
            audio.play().catch(() => playFallbackTone(key));
            return;
        }

        playFallbackTone(key);
    } catch {
        // Audio is noncritical and can be blocked by browser autoplay rules.
    }
}
