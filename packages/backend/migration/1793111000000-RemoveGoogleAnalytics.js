/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class RemoveGoogleAnalytics1793111000000 {
    name = 'RemoveGoogleAnalytics1793111000000'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN IF EXISTS "googleAnalyticsMeasurementId"`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "meta" ADD COLUMN IF NOT EXISTS "googleAnalyticsMeasurementId" character varying(64)`);
    }
}
