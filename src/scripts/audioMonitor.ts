import { log } from './logger';
import { UI } from './ui';

let guiSource: AudioBufferSourceNode | null = null;
let guiGainNode: GainNode | null = null;
let guiStartTime = 0;
let guiPausedAt = 0;
let guiIsPlaying = false;
let guiBuffer: AudioBuffer | null = null;
const guiCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 44100 });

export function setupGuiMonitor(signal: Float32Array, sampleRate: number) {
    guiBuffer = guiCtx.createBuffer(1, signal.length, sampleRate);
    guiBuffer.copyToChannel(signal, 0);

    const totalS = Math.floor(guiBuffer.duration);

    if (UI.player.timeTotal) UI.player.timeTotal.textContent = `00:${totalS.toString().padStart(2, '0')}`;
    if (UI.player.timeCurrent) UI.player.timeCurrent.textContent = `00:00`;
    if (UI.player.seekBar) UI.player.seekBar.value = "0";
    if (UI.player.playBtn) UI.player.playBtn.textContent = '▶';

    guiIsPlaying = false;
    if (guiSource) { guiSource.stop(); guiSource = null; }
    guiPausedAt = 0;
}

export function togglePlayback() {
    if (guiIsPlaying) {
        guiPausedAt = guiCtx.currentTime - guiStartTime;
        guiSource?.stop();
        guiSource = null;
        guiIsPlaying = false;
        if (UI.player.playBtn) UI.player.playBtn.textContent = '▶';
    } else {
        if (!guiBuffer) return;
        guiSource = guiCtx.createBufferSource();
        guiSource.buffer = guiBuffer;

        guiGainNode = guiCtx.createGain();
        const volInput = UI.player.volume;
        const vol = volInput ? volInput.value : "0.8";
        guiGainNode.gain.value = parseFloat(vol);

        guiSource.connect(guiGainNode);
        guiGainNode.connect(guiCtx.destination);

        const offset = guiPausedAt % guiBuffer.duration;
        guiSource.start(0, offset);
        guiStartTime = guiCtx.currentTime - offset;
        guiIsPlaying = true;
        if (UI.player.playBtn) UI.player.playBtn.textContent = '⏸';

        requestAnimationFrame(updateGuiProgress);
    }
}

function updateGuiProgress() {
    if (!guiIsPlaying || !guiBuffer) return;
    const elapsed = guiCtx.currentTime - guiStartTime;
    const progress = (elapsed / guiBuffer.duration) * 100;

    if (UI.player.seekBar) UI.player.seekBar.value = progress.toString();
    if (UI.player.timeCurrent) {
        const sec = Math.floor(elapsed % 60);
        UI.player.timeCurrent.textContent = `00:${sec.toString().padStart(2, '0')}`;
    }

    if (elapsed < guiBuffer.duration) {
        requestAnimationFrame(updateGuiProgress);
    } else {
        guiIsPlaying = false;
        if (UI.player.playBtn) UI.player.playBtn.textContent = '▶';
        guiPausedAt = 0;
    }
}

export function setVolume(val: string) {
    if (guiGainNode) guiGainNode.gain.value = parseFloat(val);
}

export function seekTo(pct: number) {
    if (guiBuffer) {
        guiPausedAt = (pct / 100) * guiBuffer.duration;
        if (guiIsPlaying) {
            guiSource?.stop();
            guiIsPlaying = false;
            // Immediate restart to seek
            togglePlayback();
        }
    }
}
