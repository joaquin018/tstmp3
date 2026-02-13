import { log } from './logger';

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
    const timeTotal = document.querySelector('#guiTimeTotal');
    const timeCurrent = document.querySelector('#guiTimeCurrent');
    const seekBar = document.querySelector('#guiSeekBar') as HTMLInputElement;
    const playBtn = document.querySelector('#guiPlayBtn');

    if (timeTotal) timeTotal.textContent = `00:${totalS.toString().padStart(2, '0')}`;
    if (timeCurrent) timeCurrent.textContent = `00:00`;
    if (seekBar) seekBar.value = "0";
    if (playBtn) playBtn.textContent = '▶';

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
        const playBtn = document.querySelector('#guiPlayBtn');
        if (playBtn) playBtn.textContent = '▶';
    } else {
        if (!guiBuffer) return;
        guiSource = guiCtx.createBufferSource();
        guiSource.buffer = guiBuffer;

        guiGainNode = guiCtx.createGain();
        const volInput = document.querySelector('#guiVolume') as HTMLInputElement;
        const vol = volInput ? volInput.value : "0.8";
        guiGainNode.gain.value = parseFloat(vol);

        guiSource.connect(guiGainNode);
        guiGainNode.connect(guiCtx.destination);

        const offset = guiPausedAt % guiBuffer.duration;
        guiSource.start(0, offset);
        guiStartTime = guiCtx.currentTime - offset;
        guiIsPlaying = true;
        const playBtn = document.querySelector('#guiPlayBtn');
        if (playBtn) playBtn.textContent = '⏸';

        requestAnimationFrame(updateGuiProgress);
    }
}

function updateGuiProgress() {
    if (!guiIsPlaying || !guiBuffer) return;
    const elapsed = guiCtx.currentTime - guiStartTime;
    const progress = (elapsed / guiBuffer.duration) * 100;

    const seekBar = document.querySelector('#guiSeekBar') as HTMLInputElement;
    const timeCurrent = document.querySelector('#guiTimeCurrent');

    if (seekBar) seekBar.value = progress.toString();
    if (timeCurrent) {
        const sec = Math.floor(elapsed % 60);
        timeCurrent.textContent = `00:${sec.toString().padStart(2, '0')}`;
    }

    if (elapsed < guiBuffer.duration) {
        requestAnimationFrame(updateGuiProgress);
    } else {
        guiIsPlaying = false;
        const playBtn = document.querySelector('#guiPlayBtn');
        if (playBtn) playBtn.textContent = '▶';
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
            togglePlayback();
        }
    }
}
