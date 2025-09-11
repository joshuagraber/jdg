import { parse } from 'node-html-parser'
import { z } from 'zod'

const ogSchema = z.object({
	title: z.string().optional(),
	description: z.string().optional(),
	image: z.string().url().optional(),
	site_name: z.string().optional(),
	type: z.string().optional(),
	url: z.string().url().optional(),
	'image:alt': z.string().optional(), // If you want to capture image alt text
})

export type OpenGraphData = z.infer<typeof ogSchema>

const fetchWithTimeout = async (url: string, timeout = 5000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; LinkPreviewBot/1.0)',
            },
            signal: controller.signal,
            redirect: 'follow', // explicitly follow redirects
        });

        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
};

export async function getOpenGraphData(url: string): Promise<OpenGraphData> {
	try {
        let html: string

        if (url.startsWith('data:')) {
            // Handle data URLs
            const base64Data = url.split(',')[1]
            if (!base64Data) {
                throw new Error('Invalid data URL')
            }
            html = Buffer.from(base64Data, 'base64').toString('utf-8')
        } else {
            try {
                const response = await fetchWithTimeout(url);

                if (!response.ok) {
                    console.error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
                    return {};
                }

                // Enforce a read timeout for slow bodies to avoid upstream 503s
                const READ_TIMEOUT_MS = 4000;
                const readTimeout = new Promise<string>((_, reject) =>
                    setTimeout(() => reject(new Error('Response body read timeout')), READ_TIMEOUT_MS),
                );
                html = await Promise.race([response.text(), readTimeout]) as string;
            } catch (error) {
                console.error(`Error fetching ${url}:`, error);
                return {};
            }
        }

        const root = parse(html)
        const ogData: Record<string, string> = {}

        // Process OG tags and other metadata as before
        root.querySelectorAll('meta[property^="og:"]').forEach((meta) => {
            try {
                const property = meta.getAttribute('property')?.replace('og:', '')
                const content = meta.getAttribute('content')
                if (property && content) {
                    ogData[property] = content
                }
            } catch (e) {
                console.error('Error processing meta tag:', e)
            }
        })

        // Safely try to get each fallback
        try {
            if (!ogData.title) {
                ogData.title =
                    root.querySelector('meta[name="title"]')?.getAttribute('content') ||
                    root.querySelector('title')?.textContent ||
                    ''
            }
        } catch (e) {
            console.error('Error getting title:', e)
        }

        try {
            if (!ogData.description) {
                ogData.description =
                    root.querySelector('meta[name="description"]')?.getAttribute('content') || ''
            }
        } catch (e) {
            console.error('Error getting description:', e)
        }

        try {
            if (!ogData.image) {
                ogData.image =
                    root.querySelector('meta[name="twitter:image"]')?.getAttribute('content') ||
                    root.querySelector('img[src^="http"]')?.getAttribute('src') ||
                    ''
            }
        } catch (e) {
            console.error('Error getting image:', e)
        }

        try {
            if (!ogData.site_name) {
                ogData.site_name =
                    root.querySelector('meta[name="application-name"]')?.getAttribute('content') ||
                    root.querySelector('meta[name="site_name"]')?.getAttribute('content') ||
                    new URL(url).hostname
            }
        } catch (e) {
            console.error('Error getting site name:', e)
        }

        return ogSchema.parse(ogData)
    } catch (e) {
        console.error('Error in getOpenGraphData:', e)
        return {}
    }
}
