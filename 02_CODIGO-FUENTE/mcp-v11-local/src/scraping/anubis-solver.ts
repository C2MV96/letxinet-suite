import { createHash } from 'crypto';

export function isAnubisChallenge(html: string): boolean {
    return html.includes('anubis_challenge') || html.includes('techaro.lol-anubis') || html.includes('id="anubis_challenge"');
}

export async function solveAnubisChallenge(targetUrl: string, html: string): Promise<string | null> {
    try {
        const jsonScripts = html.matchAll(/<script id="([^"]+)" type="application\/json">([\s\S]*?)<\/script>/g);
        let challengeData: any = {};
        for (const match of jsonScripts) {
            try { challengeData[match[1]] = JSON.parse(match[2].trim()); } catch (e) { }
        }

        const data = challengeData['anubis_challenge'];
        if (!data) return null;

        const salt = data.challenge?.randomData;
        const difficulty = data.rules?.difficulty || data.challenge?.difficulty;
        const challengeId = data.challenge?.id;

        if (!salt || !difficulty || !challengeId) return null;

        const prefix = '0'.repeat(difficulty);
        console.log(`[ANUBIS] Solving difficulty ${difficulty} for ${challengeId}...`);

        let nonce = 0;
        let digest = '';
        const startTime = Date.now();

        while (true) {
            const input = salt + nonce;
            digest = createHash('sha256').update(input).digest('hex');
            if (digest.startsWith(prefix)) break;
            nonce++;
            if (nonce > 2000000) return null;
        }

        const elapsed = Date.now() - startTime;
        console.log(`[ANUBIS] Solved in ${elapsed}ms. Nonce: ${nonce}`);

        const urlParts = new URL(targetUrl);
        const solutionUrl = `${urlParts.protocol}//${urlParts.host}/.within.website/x/cmd/anubis/api/pass-challenge?id=${challengeId}&response=${digest}&nonce=${nonce}&redir=${encodeURIComponent(targetUrl)}&elapsedTime=${Math.max(elapsed, 1500)}`;

        const solveRes = await fetch(solutionUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Referer': targetUrl
            },
            redirect: 'manual'
        });

        const setCookie = solveRes.headers.get('set-cookie');
        if (setCookie) {
            const authCookie = setCookie.split(';')[0];
            console.log(`[ANUBIS] Got auth cookie for ${urlParts.host}`);
            return authCookie;
        }

        return null;
    } catch (e: any) {
        console.error(`[ANUBIS] Solver error: ${e.message}`);
        return null;
    }
}
