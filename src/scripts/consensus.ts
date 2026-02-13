import { log } from './logger';

export interface AnalysisResults {
    bpmA: number | null;
    bpmB: number | null;
    bpmC: number | null;
}

export let results: AnalysisResults = {
    bpmA: null,
    bpmB: null,
    bpmC: null
};

export function resetResults() {
    results.bpmA = null;
    results.bpmB = null;
    results.bpmC = null;
}

export function updateConsensus() {
    const valid = [results.bpmA, results.bpmB, results.bpmC].filter(b => b !== null) as number[];
    if (valid.length === 0) return;

    let bestBpm = valid[0];

    // Normalizamos a 60-140 para comparación
    const normalized = valid.map(b => {
        let n = b;
        while (n > 150) n /= 2;
        while (n < 60) n *= 2;
        return n;
    });

    if (normalized.length >= 2) {
        normalized.sort((a, b) => a - b);
        if (Math.abs(normalized[1] - normalized[0]) < normalized[0] * 0.05) {
            bestBpm = Math.round((normalized[0] + normalized[1]) / 2);
        } else if (normalized.length === 3 && Math.abs(normalized[2] - normalized[1]) < normalized[1] * 0.05) {
            bestBpm = Math.round((normalized[1] + normalized[2]) / 2);
        } else {
            bestBpm = normalized[valid.indexOf(results.bpmB!)] || normalized[0];
        }
    } else {
        bestBpm = normalized[0];
    }

    log(`🏆 Consenso actual: ~${bestBpm} BPM`, 'info');

    const consensusBpm = document.querySelector('#bpmConsensus');
    if (consensusBpm) consensusBpm.textContent = 'BPM: ' + bestBpm.toString();

    const keyA = document.querySelector('#keyA')?.textContent || '';
    const keyConsensus = document.querySelector('#keyConsensus');
    if (keyConsensus && keyA.includes('Key:')) {
        keyConsensus.textContent = keyA.replace('Key:', 'Acuerdo:');
    }
}
