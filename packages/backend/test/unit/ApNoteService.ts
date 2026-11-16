/*
 * SPDX-FileCopyrightText: Happyfeet01 and FediKey contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as assert from 'assert';
import { beforeAll, describe, test, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { CoreModule } from '@/core/CoreModule.js';
import { GlobalModule } from '@/GlobalModule.js';
import { NoteEditService } from '@/core/NoteEditService.js';
import { ApNoteService } from '@/core/activitypub/models/ApNoteService.js';
import type { Resolver } from '@/core/activitypub/ApResolverService.js';
import type { IPost } from '@/core/activitypub/type.js';
import { MiNote } from '@/models/Note.js';
import type { MiRemoteUser } from '@/models/User.js';

describe('ApNoteService remote edits', () => {
	let apNoteService: ApNoteService;
	let noteEditService: NoteEditService;

	beforeAll(async () => {
		const app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
		}).compile();
		apNoteService = app.get(ApNoteService);
		noteEditService = app.get(NoteEditService);
	});

	test.each(['quoteUrl', '_misskey_quote'] as const)('preserves hashtags and removes the inline quote fallback for %s', async (quoteField) => {
		const actor = { id: 'remote-user', host: 'remote.example', uri: 'https://remote.example/users/alice' } as MiRemoteUser;
		const oldNote = new MiNote({ id: 'remote-note', userId: actor.id });
		const note: IPost = {
			id: 'https://remote.example/notes/edited',
			type: 'Note',
			attributedTo: actor.uri,
			content: '<p class="quote-inline">RE: <a href="https://remote.example/notes/quoted">https://remote.example/notes/quoted</a></p><p>Edited <a href="https://remote.example/tags/a">#a</a></p>',
			tag: [{ type: 'Hashtag', name: '#a', href: 'https://remote.example/tags/a' }],
			[quoteField]: 'https://remote.example/notes/quoted',
		};
		const resolver = { resolve: async () => note } as unknown as Resolver;
		vi.spyOn(apNoteService, 'fetchNote').mockResolvedValue(oldNote);
		vi.spyOn(apNoteService, 'extractEmojis').mockResolvedValue([]);
		vi.spyOn(noteEditService, 'edit').mockImplementation(async (_user, _id, data) => new MiNote({ text: data.text }));

		const edited = await apNoteService.updateNote(note, actor, resolver);

		assert.strictEqual(edited.text, 'Edited #a');
	});
});
