import { log } from './logger';
import { runEssentia, runRealtimeBPMFromSignal, runEssentiaAI } from './bpmEngines';
import { setupGuiMonitor } from './audioMonitor';
import { UI } from './ui';

export interface AudioState {
    signal: Float32Array;
    sampleRate: number;
    totalDuration: number;
    lufsRanks: any[];
    currentStart: number;
}

let currentAudioState: AudioState | null = null;

export function setAudioState(state: AudioState) {
    currentAudioState = state;
}

export function getAudioState() {
    return currentAudioState;
}

export async function runAnalysisFlow() {
    if (!currentAudioState) return;

    // Reset UI via centralized module
    ['A', 'B', 'C'].forEach(id => {
        const engineId = id as 'A' | 'B' | 'C';
        const bpmEl = UI.engines[engineId].bpm;
        const statusEl = UI.engines[engineId].status;
        if (bpmEl) bpmEl.textContent = '...';
        if (statusEl) statusEl.textContent = 'Analizando...';
    });

    const bestCandidate = currentAudioState.lufsRanks[0];
    const { signal, sampleRate } = currentAudioState;
    const sliceStart = bestCandidate.start;
    const sliceDuration = bestCandidate.duration;
    currentAudioState.currentStart = sliceStart;

    log(`🔍 Iniciando análisis @ ${sliceStart}s (Fragmento de 30s más fuerte)`);

    const startSample = Math.floor(sliceStart * sampleRate);
    const endSample = Math.floor((sliceStart + sliceDuration) * sampleRate);
    const analysisSignal = signal.subarray(startSample, endSample);

    setupGuiMonitor(analysisSignal, sampleRate);

    runEssentia(analysisSignal, sampleRate);
    runRealtimeBPMFromSignal(analysisSignal, sampleRate);
    runEssentiaAI(analysisSignal, sampleRate);
}

export async function runStructuralMapping(signal: Float32Array, sampleRate: number) {
    const a1 = -1.99004745483398;
    const a2 = 0.99007225036621;
    const b0 = 1.0;
    const b1 = -2.0;
    const b2 = 1.0;
    let z1 = 0, z2 = 0;

    const blockSize = sampleRate;
    const subFrameSize = Math.floor(sampleRate * 0.05);
    const lufsProfile: number[] = [];
    const energyProfile: number[] = [];
    const rhythmDensity: number[] = [];

    for (let i = 0; i < signal.length; i += blockSize) {
        let blockSumRaw = 0;
        let blockSumW = 0;
        const blockEnd = Math.min(i + blockSize, signal.length);
        let blockHits = 0;
        let lastSubRms = 0;

        for (let j = i; j < blockEnd; j++) {
            const x = signal[j];
            blockSumRaw += x * x;
            const filtered = b0 * x + z1;
            z1 = b1 * x - a1 * filtered + z2;
            z2 = b2 * x - a2 * filtered;
            blockSumW += filtered * filtered;

            if (j % subFrameSize === 0) {
                const subRms = Math.sqrt(blockSumRaw / (j - i + 1));
                if (subRms > lastSubRms * 1.5) blockHits++;
                lastSubRms = subRms;
            }
        }

        energyProfile.push(20 * Math.log10(Math.sqrt(blockSumRaw / (blockEnd - i)) + 1e-9));
        lufsProfile.push(20 * Math.log10(Math.sqrt(blockSumW / (blockEnd - i)) + 1e-9));
        rhythmDensity.push(blockHits);
    }

    const boundaries: number[] = [0];
    for (let i = 1; i < lufsProfile.length; i++) {
        if (Math.abs(lufsProfile[i] - lufsProfile[i - 1]) > 4.0) {
            if (i - boundaries[boundaries.length - 1] > 15) {
                boundaries.push(i);
            }
        }
    }
    const totalDurS = Math.round(signal.length / sampleRate);
    if (totalDurS - boundaries[boundaries.length - 1] > 15) boundaries.push(totalDurS);

    const allSlices: any[] = [];
    for (let i = 0; i < boundaries.length - 1; i++) {
        const start = boundaries[i];
        const end = boundaries[i + 1];
        const dur = end - start;
        if (dur < 15) continue;

        const sliceLufs = lufsProfile.slice(start, end).reduce((a, b) => a + b, 0) / dur;
        const sliceEnergy = energyProfile.slice(start, end).reduce((a, b) => a + b, 0) / dur;
        const sliceRhythm = rhythmDensity.slice(start, end).reduce((a, b) => a + b, 0) / dur;

        let bestStart = Math.min(start + 3, totalDurS - 30);
        if (totalDurS <= 45) bestStart = 0;

        allSlices.push({
            start: Math.max(0, bestStart),
            duration: totalDurS > 45 ? 30 : totalDurS,
            lufs: sliceLufs,
            rhythm: sliceEnergy + (sliceRhythm * 2.5)
        });
    }

    return {
        lufsRanks: [...allSlices].sort((a, b) => b.lufs - a.lufs)
    };
}
