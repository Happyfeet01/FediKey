/*
 * SPDX-FileCopyrightText: Happyfeet01 and FediKey contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class NoteEditing1791284200000 {
	name = 'NoteEditing1791284200000';

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "note" ADD "updatedAt" TIMESTAMP WITH TIME ZONE`);
		await queryRunner.query(`COMMENT ON COLUMN "note"."updatedAt" IS 'The updated date of the Note.'`);

		await queryRunner.query(`CREATE TYPE "note_edit_visibility_enum" AS ENUM('public', 'home', 'followers', 'specified')`);
		await queryRunner.query(`
			CREATE TABLE "note_edit" (
				"id" character varying(32) NOT NULL,
				"noteId" character varying(32) NOT NULL,
				"userId" character varying(32) NOT NULL,
				"renoteId" character varying(32),
				"replyId" character varying(32),
				"visibility" "note_edit_visibility_enum" NOT NULL,
				"newText" text,
				"cw" text,
				"newCw" text,
				"fileIds" character varying(32) array NOT NULL DEFAULT '{}',
				"updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
				"text" text,
				"oldDate" TIMESTAMP WITH TIME ZONE,
				"hasPoll" boolean NOT NULL DEFAULT false,
				CONSTRAINT "PK_fedikey_note_edit" PRIMARY KEY ("id")
			)
		`);
		await queryRunner.query(`COMMENT ON COLUMN "note_edit"."noteId" IS 'The ID of note.'`);
		await queryRunner.query(`COMMENT ON COLUMN "note_edit"."userId" IS 'The ID of author.'`);
		await queryRunner.query(`COMMENT ON COLUMN "note_edit"."renoteId" IS 'The ID of renote target.'`);
		await queryRunner.query(`COMMENT ON COLUMN "note_edit"."replyId" IS 'The ID of reply target.'`);
		await queryRunner.query(`COMMENT ON COLUMN "note_edit"."updatedAt" IS 'The updated date of the Note.'`);
		await queryRunner.query(`COMMENT ON COLUMN "note_edit"."oldDate" IS 'The old date from before the edit.'`);
		await queryRunner.query(`COMMENT ON COLUMN "note_edit"."hasPoll" IS 'Whether this revision had a poll.'`);

		await queryRunner.query(`CREATE INDEX "IDX_702ad5ae993a672e4fbffbcd38" ON "note_edit" ("noteId")`);

		await queryRunner.query(`
			ALTER TABLE "note_edit"
			ADD CONSTRAINT "FK_702ad5ae993a672e4fbffbcd38c"
			FOREIGN KEY ("noteId") REFERENCES "note"("id")
			ON DELETE CASCADE ON UPDATE NO ACTION
		`);
		await queryRunner.query(`
			ALTER TABLE "note_edit"
			ADD CONSTRAINT "FK_7f1ded0f6e8a5bef701b7e698ab"
			FOREIGN KEY ("userId") REFERENCES "user"("id")
			ON DELETE CASCADE ON UPDATE NO ACTION
		`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "note_edit" DROP CONSTRAINT "FK_7f1ded0f6e8a5bef701b7e698ab"`);
		await queryRunner.query(`ALTER TABLE "note_edit" DROP CONSTRAINT "FK_702ad5ae993a672e4fbffbcd38c"`);
		await queryRunner.query(`DROP INDEX "IDX_702ad5ae993a672e4fbffbcd38"`);
		await queryRunner.query(`DROP TABLE "note_edit"`);
		await queryRunner.query(`DROP TYPE "note_edit_visibility_enum"`);
		await queryRunner.query(`ALTER TABLE "note" DROP COLUMN "updatedAt"`);
	}
}
