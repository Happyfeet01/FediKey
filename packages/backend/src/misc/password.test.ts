/*
 * SPDX-FileCopyrightText: Happyfeet01 and FediKey contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { verifyPassword } from './password.js';

// Independent fixture generated with Node crypto Argon2id (OpenSSL), not
// the verifier's library. Encodes the original memory/time/parallelism.
const argon2Hash = '$argon2id$v=19$m=65536,t=3,p=4$ZmVkaWtleS1hcmdvbjItdGVzdA$XrDfGVSWTt2PMS4Q7NKXlMOHMqNt5ThiRwRxuwP/iPE';
const argon2Password = 'Sharkey-Testpässwort🔑';
const bcryptHash = '$2b$04$abcdefghijklmnopqrstuuMpJ9FZ6iEuTBN1gZR.VTRrhnTP6O6kC';

describe('verifyPassword', () => {
	test('accepts an imported Argon2id password with Unicode', async () => {
		await expect(verifyPassword(argon2Password, argon2Hash)).resolves.toBe(true);
	});

	test('rejects a wrong Argon2id password', async () => {
		await expect(verifyPassword('wrong', argon2Hash)).resolves.toBe(false);
	});

	test.each(['2a', '2b', '2y'])('accepts existing bcrypt %s passwords', async (prefix) => {
		const hash = bcryptHash.replace('$2b$', `$${prefix}$`);
		await expect(verifyPassword('Misskey-Test', hash)).resolves.toBe(true);
		await expect(verifyPassword('wrong', hash)).resolves.toBe(false);
	});

	test.each([null, undefined, '', 'plaintext', '$scrypt$unsupported',
		'$argon2id$invalid', '$argon2id$v=19$m=65536,t=3,p=4$invalid$invalid',
		'$2b$invalid'])('fails closed for missing or invalid hashes (%s)', async (hash) => {
		await expect(verifyPassword('test', hash)).resolves.toBe(false);
	});
});
