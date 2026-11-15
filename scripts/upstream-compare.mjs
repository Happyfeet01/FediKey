/*
 * SPDX-FileCopyrightText: Happyfeet01 and FediKey contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// @ts-check
/**
 * Wöchentlicher Upstream-Abgleich: vergleicht den aktuellen FediKey-Branch mit
 * misskey-dev/misskey und erzeugt einen Markdown-Bericht.
 *
 * Nutzung:
 *   node scripts/upstream-compare.mjs
 *   node scripts/upstream-compare.mjs --baseline 2026.10.1 --target 2026.11.0
 *   node scripts/upstream-compare.mjs --out bericht.md
 *   node scripts/upstream-compare.mjs --no-fetch
 *
 * Baseline ist standardmäßig die Version aus package.json (FediKey übernimmt
 * das Versionsschema von Misskey), Ziel das neueste Release-Tag von upstream.
 * Ablauf und Regeln: docs/upstream-weekly-sync.md
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const __dirname = import.meta.dirname;
const repoRoot = path.resolve(__dirname, '..');

const UPSTREAM_URL = 'https://github.com/misskey-dev/misskey.git';
const DEVELOP_REF = 'upstream/develop';

/** Pfade mit FediKey-eigenen Funktionen; beim Upstream-Abgleich nie überschreiben. */
const PROTECTED_PATTERNS = [
	/noteedit/i,
	/notes\/edit\.ts$/,
	/notes\/versions\.ts$/,
	/NoteEditing\.js$/,
	/ApNoteService\.ts$/,
	/ApInboxService\.ts$/,
	/NoteEntityService\.ts$/,
	/src\/models\/Note\.ts$/,
	/json-schema\/note\.ts$/,
	/MkNote/,
	/MkPostForm/,
	/types\/post-form\.ts$/,
	/composables\/use-note\.ts$/,
	/get-note-menu\.ts$/,
];

function git(args) {
	return execFileSync('git', ['-C', repoRoot, ...args], {
		encoding: 'utf8',
		maxBuffer: 64 * 1024 * 1024,
	}).trim();
}

function gitLines(args) {
	const out = git(args);
	return out === '' ? [] : out.split('\n');
}

function parseArgs(argv) {
	const opts = { baseline: null, target: null, out: null, fetch: true };
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === '--baseline') opts.baseline = argv[++i];
		else if (arg === '--target') opts.target = argv[++i];
		else if (arg === '--out') opts.out = argv[++i];
		else if (arg === '--no-fetch') opts.fetch = false;
		else if (arg === '--help' || arg === '-h') {
			console.log('Usage: node scripts/upstream-compare.mjs [--baseline REV] [--target REV] [--out FILE] [--no-fetch]');
			process.exit(0);
		} else {
			console.error(`Unbekanntes Argument: ${arg}`);
			process.exit(2);
		}
	}
	return opts;
}

function ensureUpstreamRemote() {
	const remotes = gitLines(['remote']);
	if (!remotes.includes('upstream')) {
		git(['remote', 'add', 'upstream', UPSTREAM_URL]);
		console.error('Remote "upstream" angelegt: ' + UPSTREAM_URL);
	}
}

function fetchUpstream() {
	try {
		git(['fetch', '--quiet', 'upstream', '--filter=blob:none']);
	} catch {
		git(['fetch', '--quiet', 'upstream']);
	}
}

function resolveBaseline(override) {
	if (override) return override;
	const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
	const tag = String(pkg.version);
	git(['rev-parse', '-q', '--verify', `refs/tags/${tag}`]);
	return tag;
}

function latestReleaseTag() {
	const finals = gitLines(['tag', '--list'])
		.filter((t) => /^\d{4}\.\d+\.\d+$/.test(t))
		.sort((a, b) => {
			const pa = a.split('.').map(Number);
			const pb = b.split('.').map(Number);
			for (let i = 0; i < 3; i++) {
				if (pa[i] !== pb[i]) return pa[i] - pb[i];
			}
			return 0;
		});
	return finals[finals.length - 1];
}

function categorize(subject) {
	if (/security/i.test(subject)) return 'security';
	if (/^fix(\(|:)/.test(subject)) return 'fix';
	if (/^(feat|enhance)(\(|:)/.test(subject)) return 'feature';
	if (/^perf(\(|:)/.test(subject)) return 'perf';
	if (/^(Release:|Bump version|Update CHANGELOG|\[skip ci\])/.test(subject)) return 'release';
	return 'other';
}

function commitsBetween(from, to) {
	return gitLines(['log', '--format=%h%x09%s', `${from}..${to}`])
		.map((line) => {
			const tab = line.indexOf('\t');
			return { hash: line.slice(0, tab), subject: line.slice(tab + 1) };
		})
		.reverse();
}

function main() {
	const opts = parseArgs(process.argv.slice(2));
	ensureUpstreamRemote();
	if (opts.fetch) fetchUpstream();

	const baseline = resolveBaseline(opts.baseline);
	const target = opts.target ?? latestReleaseTag();
	const baselineCommit = git(['rev-parse', baseline]);
	const targetCommit = git(['rev-parse', target]);
	const headBranch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
	const headCommit = git(['rev-parse', 'HEAD']);
	let baselineIsAncestor = false;
	try {
		git(['merge-base', '--is-ancestor', baseline, 'HEAD']);
		baselineIsAncestor = true;
	} catch {
		baselineIsAncestor = false;
	}

	const releaseCommits = commitsBetween(baseline, target);
	let postReleaseCommits = [];
	let developCommit = null;
	try {
		developCommit = git(['rev-parse', DEVELOP_REF]);
		postReleaseCommits = commitsBetween(target, DEVELOP_REF);
	} catch {
		developCommit = null;
	}

	const upstreamFiles = gitLines(['diff', '--name-only', baseline, target]).sort();
	const migrations = upstreamFiles.filter((f) => /^packages\/backend\/migration\/.+\.js$/.test(f) && !/\/js\//.test(f));
	const apiFiles = upstreamFiles.filter((f) => f.startsWith('packages/misskey-js/'));

	const fedikeyFiles = new Set(gitLines(['diff', '--name-only', baseline, 'HEAD']));
	const overlap = upstreamFiles.filter((f) => fedikeyFiles.has(f));
	const overlapDetails = overlap.map((file) => ({
		file,
		protected: PROTECTED_PATTERNS.some((p) => p.test(file)),
		commits: gitLines(['log', '--format=%h %s', `${baseline}..${target}`, '--', file]),
	}));

	const groups = { security: [], fix: [], feature: [], perf: [], release: [], other: [] };
	for (const c of releaseCommits) groups[categorize(c.subject)].push(c);

	const now = new Date().toISOString();
	const lines = [];
	lines.push(`# Upstream-Abgleich: FediKey \`${headBranch}\` vs Misskey \`${target}\``);
	lines.push('');
	lines.push(`- Generiert: ${now}`);
	lines.push(`- Baseline: \`${baseline}\` (${baselineCommit.slice(0, 12)}) — Version aus package.json bzw. zuletzt integrierter Upstream-Stand`);
	lines.push(`- Ziel: \`${target}\` (${targetCommit.slice(0, 12)})`);
	if (developCommit) {
		lines.push(`- Upstream develop: ${developCommit.slice(0, 12)} (${postReleaseCommits.length} Commits nach dem Release)`);
	}
	lines.push(`- FediKey HEAD: \`${headBranch}\` ${headCommit.slice(0, 12)}`);
	lines.push(`- Hinweis: Baseline ist ${baselineIsAncestor === false ? '**kein** Vorfahre von HEAD (Integration erfolgte per Backport, nicht per Merge)' : 'Vorfahre von HEAD'}`);
	lines.push('');
	lines.push('## 1. Neue Upstream-Commits seit Baseline');
	lines.push('');
	lines.push(`**${releaseCommits.length} Commits** in \`${baseline}..${target}\``);
	lines.push('');
	const groupTitles = {
		security: '### Security / dependency security',
		fix: '### Fixes',
		feature: '### Features / Enhancements',
		perf: '### Performance',
		release: '### Release-/Versions-Artefakte (erst beim Versionssprung relevant)',
		other: '### Sonstiges (chore/docs/refactor/test/ci)',
	};
	for (const key of ['security', 'fix', 'feature', 'perf', 'release', 'other']) {
		if (groups[key].length === 0) continue;
		lines.push(groupTitles[key]);
		lines.push('');
		for (const c of groups[key]) lines.push(`- \`${c.hash}\` ${c.subject}`);
		lines.push('');
	}
	if (postReleaseCommits.length > 0) {
		lines.push(`## 2. Commits auf upstream/develop nach \`${target}\` (${postReleaseCommits.length})`);
		lines.push('');
		for (const c of postReleaseCommits) lines.push(`- \`${c.hash}\` ${c.subject}`);
		lines.push('');
	}
	lines.push(`## ${postReleaseCommits.length > 0 ? '3' : '2'}. Neue Datenbank-Migrationen (${migrations.length})`);
	lines.push('');
	if (migrations.length === 0) {
		lines.push('Keine neuen Migrationen.');
	} else {
		for (const m of migrations) lines.push(`- \`${m}\``);
	}
	lines.push('');
	const apiSection = postReleaseCommits.length > 0 ? '4' : '3';
	lines.push(`## ${apiSection}. API-/SDK-Änderungen (${apiFiles.length} Dateien in packages/misskey-js)`);
	lines.push('');
	if (apiFiles.length === 0) {
		lines.push('Keine.');
	} else {
		for (const f of apiFiles) lines.push(`- \`${f}\``);
		lines.push('');
		lines.push('Nach Übernahme: `pnpm build-misskey-js-with-types` ausführen und die autogen-Dateien committen.');
	}
	lines.push('');
	const conflictSection = postReleaseCommits.length > 0 ? '5' : '4';
	lines.push(`## ${conflictSection}. Überschneidungen mit eigenen FediKey-Änderungen (${overlapDetails.length} Dateien)`);
	lines.push('');
	lines.push('Diese Dateien wurden sowohl upstream (seit Baseline) als auch in FediKey (gegenüber Baseline) geändert. Beim Übernehmen Konflikte einzeln lösen; markierte Dateien enthalten FediKey-Features und dürfen nicht vom Upstream überschrieben werden.');
	lines.push('');
	if (overlapDetails.length === 0) {
		lines.push('Keine Überschneidungen.');
	} else {
		lines.push('| Datei | Upstream-Commits | FediKey-Bereich |');
		lines.push('| --- | --- | --- |');
		for (const d of overlapDetails) {
			const commits = d.commits.slice(0, 3).map((c) => `\`${c.split(' ')[0]}\``).join(', ') + (d.commits.length > 3 ? ', …' : '');
			lines.push(`| \`${d.file}\` | ${commits || '–'} | ${d.protected ? '**geschützt (FediKey-Feature)**' : 'Überschneidung'} |`);
		}
	}
	lines.push('');
	const nextSection = postReleaseCommits.length > 0 ? '6' : '5';
	lines.push(`## ${nextSection}. Nächste Schritte`);
	lines.push('');
	lines.push('1. Bericht lesen und Security-/Fix-Commits priorisieren; Migrationen und API-Änderungen notieren.');
	lines.push('2. Übernahme auf einem Feature-Branch (z. B. `upstream/2026.11.0`), nie direkt auf `main`. Details: [docs/upstream-weekly-sync.md](upstream-weekly-sync.md).');
	lines.push('3. Konflikte in geschützten Dateien manuell zugunsten der FediKey-Implementierung lösen.');
	lines.push('4. Validieren: `pnpm lint`, betroffene Tests, `pnpm --filter backend check-migrations`, `node scripts/check-spdx.mjs`, Locale-Safety.');
	lines.push('5. Beim Versionssprung die Version in package.json auf das Upstream-Release anheben; dadurch wird das Release automatisch die Baseline des nächsten Abgleichs.');
	lines.push('');

	const report = lines.join('\n');
	console.log(report);
	if (opts.out) {
		fs.writeFileSync(path.resolve(repoRoot, opts.out), report);
		console.error(`Bericht geschrieben: ${opts.out}`);
	}
}

main();
