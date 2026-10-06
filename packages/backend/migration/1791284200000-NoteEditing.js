/*
 * SPDX-FileCopyrightText: Happyfeet01 and FediKey contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class NoteEditing1791284200000 {
	name = 'NoteEditing1791284200000';

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "note" ADD "updatedAt" TIMESTAMP WITH TIME ZONE`);
		await queryRunner.query(`COMMENT ON COLUMN "note"."updatedAt" IS 'The updated date of the Note.'`);

		await queryRunner.query(`
			CREATE TABLE "note_edit" (
				"id" character varying(32) NOT NULL,
				"noteId" character varying(32) NOT NULL,
				"userId" character varying(32) NOT NULL,
				"renoteId" character varying(32),
				"replyId" character varying(32),
				"visibility" "note_visibility_enum" NOT NULL,
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
		await queryRunner.query(`CREATE INDEX "IDX_fedikey_note_edit_note_id" ON "note_edit" ("noteId")`);
		await queryRunner.query(`
			ALTER TABLE "note_edit"
			ADD CONSTRAINT "FK_fedikey_note_edit_note"
			FOREIGN KEY ("noteId") REFERENCES "note"("id")
			ON DELETE CASCADE ON UPDATE NO ACTION
		`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "note_edit" DROP CONSTRAINT "FK_fedikey_note_edit_note"`);
		await queryRunner.query(`DROP INDEX "IDX_fedikey_note_edit_note_id"`);
		await queryRunner.query(`DROP TABLE "note_edit"`);
		await queryRunner.query(`ALTER TABLE "note" DROP COLUMN "updatedAt"`);
	}
}
