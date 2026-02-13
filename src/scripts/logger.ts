export interface LogEntry {
    time: string;
    msg: string;
    type: 'info' | 'warn' | 'error';
    data: any;
    timestamp: number;
}

const fullLogs: LogEntry[] = [];

export function log(msg: string, type: 'info' | 'warn' | 'error' = 'info', data: any = null) {
    const time = new Date().toLocaleTimeString();
    fullLogs.push({ time, msg, type, data, timestamp: Date.now() });

    const logContainer = document.querySelector('#logContainer');
    if (logContainer) {
        const entry = document.createElement('div');
        entry.className = `log-entry log-${type}`;

        let html = `<span class="log-time">[${time}]</span> ${msg}`;

        if (data) {
            const dataStr = typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data);
            html += ` <span class="log-toggle" onclick="this.nextElementSibling.classList.toggle('visible')">🔍</span>`;
            html += `<pre class="log-data">${dataStr}</pre>`;
        }

        entry.innerHTML = html;
        logContainer.appendChild(entry);
        logContainer.scrollTo(0, logContainer.scrollHeight);
    }

    if (type === 'error') console.error(`[LOG ERROR] ${msg}`, data);
    else console.log(`[LOG ${type.toUpperCase()}] ${msg}`, data);
}

export function clearLogs() {
    const logContainer = document.querySelector('#logContainer');
    if (logContainer) logContainer.innerHTML = '';
    fullLogs.length = 0;
    log('Logs limpiados.');
}

export function getFullLogs() {
    return fullLogs;
}

export function downloadLogs() {
    const blob = new Blob([JSON.stringify(fullLogs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analysis_log_${new Date().toISOString()}.json`;
    a.click();
}
