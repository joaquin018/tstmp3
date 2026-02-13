export const UI = {
    // Terminal & Logs
    terminal: {
        get container() { return document.getElementById('terminal') as HTMLElement; },
        get logs() { return document.getElementById('logContainer') as HTMLElement; },
        get status() { return document.getElementById('terminalStatus') as HTMLElement; },
    },

    // Analysis Engines
    engines: {
        A: {
            get card() { return document.getElementById('cardA') as HTMLElement; },
            get bpm() { return document.getElementById('bpmA') as HTMLElement; },
            get key() { return document.getElementById('keyA') as HTMLElement; },
        },
        B: {
            get card() { return document.getElementById('cardB') as HTMLElement; },
            get bpm() { return document.getElementById('bpmB') as HTMLElement; },
        },
        C: {
            get card() { return document.getElementById('cardC') as HTMLElement; },
            get bpm() { return document.getElementById('bpmC') as HTMLElement; },
        }
    },

    // Audio Monitor / Player
    player: {
        get container() { return document.getElementById('guiPlayerContainer') as HTMLElement; },
        get playBtn() { return document.getElementById('guiPlayBtn') as HTMLElement; },
        get seekBar() { return document.getElementById('guiSeekBar') as HTMLInputElement; },
        get volume() { return document.getElementById('guiVolume') as HTMLInputElement; },
        get timeCurrent() { return document.getElementById('guiTimeCurrent') as HTMLElement; },
        get timeTotal() { return document.getElementById('guiTimeTotal') as HTMLElement; },
    },

    // Drop Overlay
    dropOverlay: {
        get element() { return document.getElementById('dropOverlay') as HTMLElement; },
    },

    // Forms
    form: {
        get urlInput() { return document.getElementById('url') as HTMLInputElement; },
        get downloadBtn() { return document.getElementById('downloadBtn') as HTMLButtonElement; },
        get status() { return document.getElementById('status') as HTMLElement; },
    },

    // Sections
    sections: {
        get analysis() { return document.querySelector('#analysisSection') as HTMLElement; },
    },

    // Utility Methods
    setStatus(element: HTMLElement | null, text: string, type: 'info' | 'success' | 'error' = 'info') {
        if (!element) return;
        element.innerHTML = text;
        element.className = `status-${type}`;
    }
};
