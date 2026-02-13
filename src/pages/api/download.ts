import type { APIRoute } from 'astro';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const execAsync = promisify(exec);

export const POST: APIRoute = async ({ request }) => {
    let cookieFile: string | null = null;
    try {
        const body = await request.json().catch(() => ({}));
        const url = body?.url;
        const cookies = body?.cookies;

        console.log('Requested URL:', url);

        if (!url) {
            return new Response(JSON.stringify({ error: 'URL is required' }), { status: 400 });
        }

        // Detectar si estamos en Windows o Linux (Render)
        const isWindows = process.platform === 'win32';
        const downloadsDir = path.resolve('./downloads');

        if (!fs.existsSync(downloadsDir)) {
            fs.mkdirSync(downloadsDir, { recursive: true });
        }

        // En local (Windows) usamos el .exe, en Render usamos el comando global 'yt-dlp'
        const ytdlpCommand = isWindows
            ? `"${path.resolve('./yt-dlp.exe')}"`
            : 'yt-dlp';

        // Manejo de Cookies
        let cookiesParam = '';
        if (cookies && cookies.trim().length > 0) {
            const tempId = Math.random().toString(36).substring(7);
            cookieFile = path.join(os.tmpdir(), `cookies_${tempId}.txt`);
            fs.writeFileSync(cookieFile, cookies);
            cookiesParam = `--cookies "${cookieFile}"`;
            console.log('Using provided cookies file:', cookieFile);
        }

        // Comando para descargar mp3
        // Añadido --force-ipv4 para evitar bloqueos en la nube
        const command = `${ytdlpCommand} ${cookiesParam} --force-ipv4 --extract-audio --audio-format mp3 --audio-quality 0 --output "${downloadsDir}/%(title)s.%(ext)s" "${url}"`;

        console.log('Executing:', command);

        const { stdout, stderr } = await execAsync(command);

        if (stderr && !stdout) {
            console.error('yt-dlp error:', stderr);
            return new Response(JSON.stringify({ error: 'Error processing download', details: stderr }), { status: 500 });
        }

        // Find the most recently created file in downloads folder to report back
        const files = fs.readdirSync(downloadsDir);
        const lastFile = files
            .map(f => ({ name: f, time: fs.statSync(path.join(downloadsDir, f)).mtime.getTime() }))
            .sort((a, b) => b.time - a.time)[0];

        return new Response(JSON.stringify({
            message: 'Success',
            filename: lastFile ? lastFile.name : 'Unknown',
            path: downloadsDir
        }), { status: 200 });

    } catch (error: any) {
        console.error('Server error:', error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    } finally {
        // Limpieza de archivo de cookies temporal
        if (cookieFile && fs.existsSync(cookieFile)) {
            try {
                fs.unlinkSync(cookieFile);
                console.log('Cleaned up cookie file');
            } catch (e) {
                console.error('Failed to clean up cookie file:', e);
            }
        }
    }
};
