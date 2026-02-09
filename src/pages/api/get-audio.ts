import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';

export const GET: APIRoute = async ({ url }) => {
    const filename = url.searchParams.get('filename');

    if (!filename) {
        return new Response('Filename is required', { status: 400 });
    }

    const filePath = path.resolve('./downloads', filename);

    if (!fs.existsSync(filePath)) {
        return new Response('File not found', { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);

    return new Response(fileBuffer, {
        headers: {
            'Content-Type': 'audio/mpeg',
            'Content-Length': fileBuffer.length.toString()
        }
    });
};
