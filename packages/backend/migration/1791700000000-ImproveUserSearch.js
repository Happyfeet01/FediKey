/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * Trigram indexes support fast typo-tolerant matching of known accounts.
 * This migration only touches the user table, not the note index.
 * Building indexes can briefly lock writes to the user table; test first.
 */
export class ImproveUserSearch1791700000000 {
	name = 'ImproveUserSearch1791700000000';

	async up(queryRunner) {
		await queryRunner.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
		await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_user_name_trgm" ON "user" USING gin (lower("name") gin_trgm_ops)');
		await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_user_usernameLower_trgm" ON "user" USING gin ("usernameLower" gin_trgm_ops)');
	}

	async down(queryRunner) {
		await queryRunner.query('DROP INDEX IF EXISTS "IDX_user_usernameLower_trgm"');
		await queryRunner.query('DROP INDEX IF EXISTS "IDX_user_name_trgm"');
		// Keep pg_trgm: other applications or indexes may depend on the extension.
	}
}
