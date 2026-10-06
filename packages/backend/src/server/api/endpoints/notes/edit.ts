/*
 * SPDX-FileCopyrightText: Happyfeet01 and FediKey contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import type { DriveFilesRepository } from '@/models/_.js';
import type { MiDriveFile } from '@/models/DriveFile.js';
import { DI } from '@/di-symbols.js';
import { MAX_NOTE_TEXT_LENGTH } from '@/const.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { NoteEditService } from '@/core/NoteEditService.js';
import { IdentifiableError } from '@/misc/identifiable-error.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['notes'],

	requireCredential: true,

	prohibitMoved: true,

	limit: {
		duration: 1000 * 60 * 60,
		max: 300,
		minInterval: 500,
	},

	kind: 'write:notes',

	res: {
		type: 'object',
		optional: false, nullable: false,
		properties: {
			createdNote: {
				type: 'object',
				optional: false, nullable: false,
				ref: 'Note',
			},
		},
	},

	errors: {
		noSuchNote: {
			message: 'No such editable note.',
			code: 'NO_SUCH_NOTE',
			id: 'eef6c173-3010-4a23-8674-7c4fcaeba719',
		},
		noSuchFile: {
			message: 'Some files are not found.',
			code: 'NO_SUCH_FILE',
			id: 'b6992544-63e7-67f0-fa7f-32444b1b5306',
		},
		maxLength: {
			message: 'You tried posting a note which is too long.',
			code: 'MAX_LENGTH',
			id: '3ac74a84-8fd5-4bb0-870f-01804f82ce16',
		},
		maxCwLength: {
			message: 'You tried posting a content warning which is too long.',
			code: 'MAX_CW_LENGTH',
			id: '7004c478-bda3-4b4f-acb2-4316398c9d52',
		},
		containsProhibitedWords: {
			message: 'Cannot post because it contains prohibited words.',
			code: 'CONTAINS_PROHIBITED_WORDS',
			id: 'aa6e01d3-a85c-669d-758a-76aab43af334',
		},
		containsTooManyMentions: {
			message: 'Cannot post because it exceeds the allowed number of mentions.',
			code: 'CONTAINS_TOO_MANY_MENTIONS',
			id: '4de0363a-3046-481b-9b0f-feff3e211025',
		},
		emptyNote: {
			message: 'The edited note would be empty.',
			code: 'EMPTY_NOTE',
			id: '6f57ef33-2fc5-4a47-9079-060c6c8f7a5f',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		editId: { type: 'string', format: 'misskey:id' },
		text: {
			type: 'string',
			maxLength: MAX_NOTE_TEXT_LENGTH,
			nullable: true,
		},
		cw: {
			type: 'string',
			maxLength: 100,
			nullable: true,
		},
		fileIds: {
			type: 'array',
			uniqueItems: true,
			maxItems: 16,
			items: { type: 'string', format: 'misskey:id' },
		},
		mediaIds: {
			type: 'array',
			uniqueItems: true,
			maxItems: 16,
			items: { type: 'string', format: 'misskey:id' },
		},
		reactionAcceptance: { type: 'string', nullable: true, enum: [null, 'likeOnly', 'likeOnlyForRemote', 'nonSensitiveOnly', 'nonSensitiveOnlyForLocalLikeOnlyForRemote'] },
		poll: {
			type: 'object',
			nullable: true,
			properties: {
				choices: {
					type: 'array',
					uniqueItems: true,
					minItems: 2,
					maxItems: 10,
					items: { type: 'string', minLength: 1, maxLength: 50 },
				},
				multiple: { type: 'boolean' },
				expiresAt: { type: 'integer', nullable: true },
				expiredAfter: { type: 'integer', nullable: true, minimum: 1 },
			},
			required: ['choices'],
		},
		noExtractMentions: { type: 'boolean', default: false },
		noExtractHashtags: { type: 'boolean', default: false },
		noExtractEmojis: { type: 'boolean', default: false },
	},
	required: ['editId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.driveFilesRepository)
		private driveFilesRepository: DriveFilesRepository,

		private noteEntityService: NoteEntityService,
		private noteEditService: NoteEditService,
	) {
		super(meta, paramDef, async (ps, me) => {
			let files: MiDriveFile[] | undefined;
			const fileIds = ps.fileIds ?? ps.mediaIds;
			if (fileIds !== undefined) {
				files = fileIds.length === 0
					? []
					: await this.driveFilesRepository.createQueryBuilder('file')
						.where('file.userId = :userId AND file.id IN (:...fileIds)', {
							userId: me.id,
							fileIds,
						})
						.orderBy('array_position(ARRAY[:...fileIds], "id"::text)')
						.setParameters({ fileIds })
						.getMany();

				if (files.length !== fileIds.length) {
					throw new ApiError(meta.errors.noSuchFile);
				}
			}

			try {
				const note = await this.noteEditService.edit(me, ps.editId, {
					text: ps.text,
					cw: ps.cw,
					files,
					reactionAcceptance: ps.reactionAcceptance,
					poll: ps.poll === undefined ? undefined : ps.poll == null ? null : {
						choices: ps.poll.choices,
						multiple: ps.poll.multiple ?? false,
						expiresAt: ps.poll.expiredAfter
							? new Date(Date.now() + ps.poll.expiredAfter)
							: ps.poll.expiresAt
								? new Date(ps.poll.expiresAt)
								: null,
					},
					apMentions: ps.noExtractMentions ? [] : undefined,
					apHashtags: ps.noExtractHashtags ? [] : undefined,
					apEmojis: ps.noExtractEmojis ? [] : undefined,
				});

				return {
					createdNote: await this.noteEntityService.pack(note, me),
				};
			} catch (err) {
				if (err instanceof IdentifiableError) {
					switch (err.id) {
						case 'eef6c173-3010-4a23-8674-7c4fcaeba719':
							throw new ApiError(meta.errors.noSuchNote);
						case '3ac74a84-8fd5-4bb0-870f-01804f82ce16':
							throw new ApiError(meta.errors.maxLength);
						case '7004c478-bda3-4b4f-acb2-4316398c9d52':
							throw new ApiError(meta.errors.maxCwLength);
						case '689ee33f-f97c-479a-ac49-1b9f8140af99':
							throw new ApiError(meta.errors.containsProhibitedWords);
						case '9f466dab-c856-48cd-9e65-ff90ff750580':
							throw new ApiError(meta.errors.containsTooManyMentions);
						case '6f57ef33-2fc5-4a47-9079-060c6c8f7a5f':
							throw new ApiError(meta.errors.emptyNote);
					}
				}
				throw err;
			}
		});
	}
}
