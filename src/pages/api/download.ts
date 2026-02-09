import type { APIRoute } from 'astro';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';

const execAsync = promisify(exec);

export const POST: APIRoute = async ({ request }) => {
    try {
        const contentType = request.headers.get('content-type');
        console.log('Request received. Content-Type:', contentType);

        let url = '';

        if (contentType?.includes('application/json')) {
            const body = await request.json().catch(() => null);
            url = body?.url;
        } else if (contentType?.includes('multipart/form-data') || contentType?.includes('application/x-www-form-urlencoded')) {
            const formData = await request.formData().catch(() => null);
            url = formData?.get('url') as string;
        } else {
            // Fallback: try reading as text or search for url in body if type is unknown
            const text = await request.clone().text().catch(() => '');
            console.log('Unknown Content-Type, fallback text length:', text.length);
            // If it's a simple string, we might find the URL here if it was sent raw
            if (text.startsWith('http')) {
                url = text;
            } else {
                try {
                    const body = JSON.parse(text);
                    url = body.url;
                } catch (e) { }
            }
        }

        console.log('Requested URL:', url);

        if (!url) {
            return new Response(JSON.stringify({ error: 'URL is required or body was empty' }), { status: 400 });
        }

        // Create downloads folder if it doesn't exist
        const downloadsDir = path.resolve('./downloads');
        if (!fs.existsSync(downloadsDir)) {
            fs.mkdirSync(downloadsDir, { recursive: true });
        }

        // Path to yt-dlp.exe (assuming it's in the project root)
        const ytdlpPath = path.resolve('./yt-dlp.exe');

        // Command to download mp3
        // --extract-audio: Extract audio track
        // --audio-format mp3: Convert to mp3
        // --output: specify path and name template
        // --ffmpeg-location: ensures it finds ffmpeg
        const command = `"${ytdlpPath}" --extract-audio --audio-format mp3 --audio-quality 0 --output "${downloadsDir}/%(title)s.%(ext)s" "${url}"`;

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
    }
};
