/*
 * SPDX-FileCopyrightText: Happyfeet01 and FediKey contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import bcrypt from 'bcryptjs';
import { verify as verifyArgon2 } from '@node-rs/argon2';

/**
 * Verify existing Misskey bcrypt and imported Sharkey Argon2id hashes.
 * Verification never changes a stored hash or bypasses two-factor checks.
 */
export async function verifyPassword(password: string, hash: string | null | undefined): Promise<boolean> {
	if (!hash) return false;

	try {
		if (hash.startsWith('$argon2id$')) {
			return await verifyArgon2(hash, password);
		}
		if (/^\$2[aby]\$/.test(hash)) {
			return await bcrypt.compare(password, hash);
		}
	} catch {
		// Invalid or unsupported stored hashes must fail authentication.
	}
	return false;
}

