import { log } from './logger';
import { results, updateConsensus } from './consensus';
import { UI } from './ui';

export async function runRealtimeBPMFromSignal(signal: Float32Array, sampleRate: number) {
    log('🚀 Motor B (RealtimeBPM): Iniciando...');
    try {
        const mod: any = await import('realtime-bpm-analyzer');
        const analyzeFullBuffer = mod.analyzeFullBuffer || mod.default?.analyzeFullBuffer;

        if (!analyzeFullBuffer) {
            throw new Error('No se pudo cargar analyzeFullBuffer de RealtimeBPM.');
        }

        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate });
        const miniBuffer = audioCtx.createBuffer(1, signal.length, sampleRate);
        miniBuffer.copyToChannel(signal, 0);

        const bpmData = await analyzeFullBuffer(miniBuffer);

        if (bpmData && bpmData.length > 0) {
            const result = Math.round(bpmData[0].tempo);
            results.bpmB = result;

            if (UI.engines.B.bpm) UI.engines.B.bpm.textContent = result.toString();
            UI.setStatus(UI.engines.B.status, '✅ OK', 'success');

            log(`🎯 Motor B finalizó: ${result} BPM (Confianza: ${Math.round(bpmData[0].count || 0)})`);
            updateConsensus();
        } else {
            log('⚠️ Motor B no pudo determinar el ritmo en esta sección.', 'warn');
            UI.setStatus(UI.engines.B.status, '❓ Nulo', 'info');
        }
    } catch (e: any) {
        log(`❌ Error en Motor B: ${e.message}`, 'error');
        UI.setStatus(UI.engines.B.status, '❌ Error', 'error');
    }
}

export async function runEssentia(signal: Float32Array, sampleRate: number) {
    log('🚀 Motor A (Essentia): Iniciando...');
    try {
        const Essentia = (window as any).Essentia;
        const Factory = (window as any).EssentiaWasm || (window as any).EssentiaWASM || (window as any).Module;

        if (!Factory) throw new Error("No se encontró EssentiaWasm.");

        let backend = typeof Factory === 'function' ? await Factory() : (Factory.EssentiaWASM || Factory);
        const essentia = new Essentia(backend);
        const vector = essentia.arrayToVector(signal);

        let bpm = 0;
        let key = 'Unknown';
        let scale = '';

        const algorithms = essentia.algorithmNames;

        // BPM
        if (algorithms.includes('PercivalBPM')) {
            bpm = Math.round(essentia.PercivalBPM(vector).bpm);
        } else if (algorithms.includes('RhythmExtractor2013')) {
            bpm = Math.round(essentia.RhythmExtractor2013(vector).bpm);
        }

        // Key
        if (algorithms.includes('KeyExtractor')) {
            const res = essentia.KeyExtractor(vector);
            key = res.key;
            scale = res.scale;
        }

        results.bpmA = bpm;

        if (UI.engines.A.bpm) UI.engines.A.bpm.textContent = bpm > 0 ? bpm.toString() : '--';
        if (UI.engines.A.key) UI.engines.A.key.textContent = `Key: ${key} ${scale}`;

        const statusMsg = bpm > 0 ? '✅ OK' : '❓ Nulo';
        const statusType = bpm > 0 ? 'success' : 'info';
        UI.setStatus(UI.engines.A.status, statusMsg, statusType);

        log(`🎯 Motor A finalizó: ${bpm} BPM | Key: ${key} ${scale}`);
        updateConsensus();
    } catch (e: any) {
        log(`❌ Fallo Motor A: ${e.message}`, 'error');
        UI.setStatus(UI.engines.A.status, '❌ Error', 'error');
    }
}

// --- Helper: Resampler JS (Fallback) ---
function resampleLinear(input: Float32Array, oldRate: number, newRate: number) {
    if (oldRate === newRate) return input;
    const ratio = oldRate / newRate;
    const newLength = Math.round(input.length / ratio);
    const output = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
        const originalPos = i * ratio;
        const idx = Math.floor(originalPos);
        const frac = originalPos - idx;
        const a = input[idx] || 0;
        const b = input[idx + 1] || 0;
        output[i] = a + (b - a) * frac;
    }
    return output;
}

export async function runEssentiaAI(signal: Float32Array, _sampleRate: number) {
    log('🧠 Inicializando Unidad Neural (TempoCNN)...');
    UI.setStatus(UI.engines.C.status, '<span class="loader"></span> IA...', 'info');

    try {
        const tf = (window as any).tf;
        const w = window as any;

        if (typeof tf === 'undefined' || !w.EssentiaModel || !w.Essentia) {
            throw new Error('Librerías IA no detectadas.');
        }

        const EssentiaModel = w.EssentiaModel;
        const Factory = w.EssentiaWasm || w.EssentiaWASM || w.Module;
        if (!Factory) throw new Error("WASM Engine no encontrado.");

        log('🧬 Iniciando Motor C (Neural)...', 'info');
        let wasmInstance = typeof Factory === 'function' ? await Factory() : (Factory.EssentiaWASM || Factory);
        const essentia = new w.Essentia(wasmInstance);

        // Clase TempoCNN custom
        if (!EssentiaModel.TempoCNN) {
            EssentiaModel.TempoCNN = class extends EssentiaModel.EssentiaTensorflowJSModel {
                constructor(tfjs: any, modelUrl: string) { super(tfjs, modelUrl); }

                // 🐛 FIXED: Override de método de librería para corregir cálculo de padding
                arrayToTensorAsBatches(inputfeatureArray: any, inputShape: number[], patchSize: number, zeroPadding: boolean) {
                    const tf = (this as any).tf;
                    const frames = inputShape[0];
                    const bands = inputShape[1];

                    let featureTensor = tf.tensor(inputfeatureArray, inputShape, 'float32');

                    if (!zeroPadding) {
                        return featureTensor.as3D(1, patchSize, bands);
                    }

                    let finalTensor = featureTensor;
                    const remainder = frames % patchSize;

                    // Solo pad si no es múltiplo exacto
                    if (remainder !== 0) {
                        const paddingFrames = patchSize - remainder;
                        const zeroPadTensor = tf.zeros([paddingFrames, bands], 'float32');
                        finalTensor = featureTensor.concat(zeroPadTensor);

                        // Cleanup original
                        zeroPadTensor.dispose();
                        featureTensor.dispose();
                    } else {
                        // Si es exacto, no hacemos nada extra, solo usamos finalTensor
                        // pero featureTensor es igual a finalTensor
                    }

                    // Reshape final en batches
                    const newTotalFrames = finalTensor.shape[0];
                    const batchSize = newTotalFrames / patchSize;

                    return finalTensor.as3D(batchSize, patchSize, bands);
                }

                async predict(inputFeature: any, zeroPadding = false) {
                    const tf = (this as any).tf;
                    const featureTensorBatch = this.arrayToTensorAsBatches(
                        inputFeature.melSpectrum,
                        [inputFeature.frameSize, inputFeature.melBandsSize],
                        inputFeature.patchSize,
                        zeroPadding
                    );

                    // shape actual: [Batch, Time=256, Bands=40]
                    // target shape: [Batch, Bands=40, Time=256, Channel=1]

                    // 1. Transpose: [Batch, 40, 256]
                    const transposed = featureTensorBatch.transpose([0, 2, 1]);

                    // 2. Expand Dims: [Batch, 40, 256, 1]
                    const featureTensor = transposed.expandDims(-1);

                    // Cleanup intermediate
                    featureTensorBatch.dispose();
                    transposed.dispose();

                    const modelInputs = this.disambiguateExtraInputs();
                    modelInputs.push(featureTensor);

                    const results = this.model.execute(modelInputs);

                    // Cleanup final input
                    featureTensor.dispose();

                    const resultsArray = await results.array();
                    results.dispose();
                    return resultsArray;
                }
            };
        }

        log('📡 Cargando red neuronal...');
        const model = new EssentiaModel.TempoCNN(tf, '/lib/models/tempo/model.json');
        await model.initialize();

        // 1. Resample a 11025Hz
        let processedSignal = signal;
        if (_sampleRate !== 11025) {
            log('🔄 Ajustando frecuencia (11025Hz)...');
            let resampledViaWasm = false;

            // Intento A: WASM
            if (essentia.Resample) {
                try {
                    const vector = essentia.arrayToVector(signal);
                    const res = essentia.Resample(vector, _sampleRate, 11025);
                    processedSignal = essentia.vectorToArray(res.output);
                    vector.delete();
                    res.output.delete();
                    // res.delete(); // Functional output object usually does not need delete if it's not a vector, but 'res' is { output: Vector }. 
                    // 'res' itself is a JS object.
                    resampledViaWasm = true;
                } catch (e) { /* Fallback */ }
            }

            // Intento B: JS Pure
            if (!resampledViaWasm) {
                log('⚠️ WASM Resample falló. Usando algoritmo JS (Linear)...', 'warn');
                processedSignal = resampleLinear(signal, _sampleRate, 11025);
            }
        }

        // 2. Extracción de Features
        log('📊 Extrayendo espectrograma...');
        let algoName: string | null = null;

        if (essentia.algorithmNames) {
            if (Array.isArray(essentia.algorithmNames)) {
                algoName = essentia.algorithmNames.find((n: string) => n.toLowerCase() === 'tensorflowinputtempocnn') || null;
            } else if (typeof essentia.algorithmNames.size === 'function') {
                for (let i = 0; i < essentia.algorithmNames.size(); i++) {
                    const n = essentia.algorithmNames.get(i);
                    if (n.toLowerCase() === 'tensorflowinputtempocnn') {
                        algoName = n;
                        break;
                    }
                }
            }
        }

        const melSpectrogram: any[] = [];
        let numFrames = 0;

        if (algoName) {
            // Pipeline A: Optimizado
            const frames = essentia.FrameGenerator(processedSignal, 1024, 256);
            numFrames = frames.size();
            for (let i = 0; i < numFrames; i++) {
                const frame = frames.get(i);
                const res = essentia[algoName](frame);
                melSpectrogram.push(essentia.vectorToArray(res.bands));
                res.bands.delete();
                frame.delete();
            }
            frames.delete();
        } else {
            // Pipeline B: Manual (Funcional API)
            log('🛠️ Usando pipeline manual (Essentia Core)...', 'info');

            const frames = essentia.FrameGenerator(processedSignal, 1024, 256);
            numFrames = frames.size();

            // Parametros MelBands
            // spectrum, highFreq, inputSize, log, lowFreq, normalize, nBands, sRate, type, warping, weighting
            // defaults: high=22050, size=1025...
            // Nosotros: high=5512.5, size=513, nBands=40, sRate=11025, type='magnitude'

            for (let i = 0; i < numFrames; i++) {
                const frame = frames.get(i);

                // 1. Windowing (Hann, 1024)
                // Windowing(frame, normalized=true, size=1024, type='hann', zeroPadding=0, zeroPhase=true)
                const winOut = essentia.Windowing(frame, true, 1024, 'hann', 0, true);

                // 2. Spectrum (Magnitude, Size 1024)
                // Spectrum(frame, size=2048) -> We use 1024
                const specOut = essentia.Spectrum(winOut.frame, 1024);

                // 3. MelBands (40 bands, 11025Hz, Power)
                // MelBands(spectrum, high, size, log, low, norm, bands, sRate, type, warp, weight)
                const melOut = essentia.MelBands(
                    specOut.spectrum,   // input
                    5512.5,             // highBound
                    513,                // inputSize (1024/2 + 1)
                    false,              // log (We do it manually)
                    0,                  // lowBound
                    'unit_sum',         // normalize
                    40,                 // numberBands
                    11025,              // sampleRate
                    'power',            // type (Changed to POWER)
                    'htkMel',           // warping
                    'warping'           // weighting
                );

                const bands = essentia.vectorToArray(melOut.bands);

                // Manual Log-Scaling (dB)
                for (let j = 0; j < bands.length; j++) {
                    bands[j] = 10 * Math.log10(bands[j] + 1e-6);
                }

                melSpectrogram.push(bands);

                // Cleanup
                frame.delete();
                winOut.frame.delete();
                specOut.spectrum.delete();
                melOut.bands.delete();
            }
            frames.delete();
        }

        const flatMel = new Float32Array(numFrames * 40);
        melSpectrogram.forEach((m, i) => flatMel.set(m, i * 40));

        // 🔍 DEBUG: Inspección de señal y features
        log(`🔍 Stats Señal: Min=${Math.min(...processedSignal.slice(0, 1000))} Max=${Math.max(...processedSignal.slice(0, 1000))}`);
        log(`🔍 MelSpec: ${numFrames} frames. Sample[0]: [${flatMel.slice(0, 5).join(', ')}...]`);

        const inputFeature = {
            melSpectrum: flatMel,
            frameSize: numFrames,
            melBandsSize: 40,
            patchSize: 256
        };

        log(`⚡ Inferencia con ${numFrames} frames...`);
        const predictions = await model.predict(inputFeature, true);

        const resultsArray = predictions[0];

        // 🔍 DEBUG: Inspección de salida cruda
        log(`🔍 Raw Preds (Top 5): ${resultsArray.slice(0, 5).join(', ')} ...`);

        let maxVal = -1, maxIdx = -1;
        for (let i = 0; i < resultsArray.length; i++) {
            if (resultsArray[i] > maxVal) {
                maxVal = resultsArray[i];
                maxIdx = i;
            }
        }

        const bpm = maxIdx + 30;
        results.bpmC = bpm;

        if (UI.engines.C.bpm) UI.engines.C.bpm.textContent = bpm.toString();
        UI.setStatus(UI.engines.C.status, '✅ OK', 'success');

        log(`🎯 Motor C finalizó: ${bpm} BPM`, 'info');
        updateConsensus();

        model.dispose();
        essentia.delete();

    } catch (e: any) {
        const errorMsg = e?.message || e?.toString() || 'Error desconocido';
        log(`❌ Error Motor C: ${errorMsg}`, 'error');

        // Reporte de diagnóstico si falla
        const w = window as any;
        if (w.Essentia) {
            try {
                const Factory = w.EssentiaWasm || w.EssentiaWASM || w.Module;
                const wasm = typeof Factory === 'function' ? await Factory() : (Factory.EssentiaWASM || Factory);
                const ess = new w.Essentia(wasm);
                const allAlgos = (ess.algorithmNames || []).slice(0, 15).join(', ');
                log(`🔍 Reporte Sistema: [${allAlgos}...]`, 'info');
                ess.delete();
            } catch (diagErr) { /* ignore */ }
        }

        UI.setStatus(UI.engines.C.status, '❌ Error', 'error');
    }
}
