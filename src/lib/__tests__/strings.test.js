import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import S from '../../i18n/strings';

function files(dir) {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return name === '__tests__' ? [] : files(path);
        return /\.(jsx?|tsx?)$/.test(name) ? [path] : [];
    });
}

describe('strings', () => {
    it('every S.* the UI uses exists', () => {
        const missing = [];
        for (const file of files(join(dirname(fileURLToPath(import.meta.url)), '../..'))) {
            const source = readFileSync(file, 'utf8');
            for (const match of source.matchAll(/\bS((?:\.[a-zA-Z_]\w*)+)/g)) {
                let node = S;
                for (const key of match[1].slice(1).split('.')) {
                    if (node === undefined) break;
                    node = typeof node === 'function' ? undefined : node[key];
                }
                if (node === undefined) missing.push(`${file.split('/src/')[1]}: S${match[1]}`);
            }
        }
        expect(missing).toEqual([]);
    });
});
