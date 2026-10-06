/*
 * SPDX-FileCopyrightText: Happyfeet01 and FediKey contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import * as assert from 'assert';
import { beforeAll, describe, test } from 'vitest';
import type { Repository } from 'typeorm';
import type * as misskey from 'misskey-js';
import { MiNote } from '@/models/Note.js';
import { MiPoll } from '@/models/Poll.js';
import { api, castAsError, initTestDb, post, signup, uploadFile } from '../utils.js';

describe('Note editing', () => {
	let Notes: Repository<MiNote>;
	let Polls: Repository<MiPoll>;
	let alice: misskey.entities.SignupResponse;
	let bob: misskey.entities.SignupResponse;

	beforeAll(async () => {
		const connection = await initTestDb(true);
		Notes = connection.getRepository(MiNote);
		Polls = connection.getRepository(MiPoll);
		alice = await signup({ username: 'note-edit-alice' });
		bob = await signup({ username: 'note-edit-bob' });
	}, 1000 * 60 * 2);

	test('edits text in place and records the previous revision', async () => {
		const original = await post(alice, {
			text: 'before edit',
			cw: 'before cw',
			visibility: 'home',
			localOnly: true,
		});

		const edit = await api('notes/edit', {
			editId: original.id,
			text: 'after edit',
			cw: 'after cw',
		}, alice);

		assert.strictEqual(edit.status, 200);
		assert.strictEqual(edit.body.createdNote.id, original.id);
		assert.strictEqual(edit.body.createdNote.text, 'after edit');
		assert.strictEqual(edit.body.createdNote.cw, 'after cw');
		assert.strictEqual(edit.body.createdNote.visibility, 'home');
		assert.strictEqual(edit.body.createdNote.localOnly, true);
		assert.ok((edit.body.createdNote as misskey.entities.Note & { updatedAt?: string | null }).updatedAt);

		const versions = await api('notes/versions', { noteId: original.id }, alice);
		assert.strictEqual(versions.status, 200);
		assert.strictEqual(versions.body.length, 1);
		assert.strictEqual(versions.body[0].text, 'before edit');
		assert.strictEqual(versions.body[0].cw, 'before cw');
		assert.ok(versions.body[0].oldDate);
		assert.ok(versions.body[0].updatedAt);
	});

	test('does not create a history entry for a no-op edit', async () => {
		const original = await post(alice, { text: 'unchanged' });

		const edit = await api('notes/edit', {
			editId: original.id,
			text: 'unchanged',
		}, alice);

		assert.strictEqual(edit.status, 200);

		const versions = await api('notes/versions', { noteId: original.id }, alice);
		assert.strictEqual(versions.status, 200);
		assert.deepStrictEqual(versions.body, []);
	});

	test('rejects editing another users note', async () => {
		const original = await post(alice, { text: 'alice only' });

		const edit = await api('notes/edit', {
			editId: original.id,
			text: 'bob was here',
		}, bob);

		assert.strictEqual(edit.status, 400);
		assert.strictEqual(castAsError(edit.body).error.code, 'NO_SUCH_NOTE');

		const stored = await Notes.findOneByOrFail({ id: original.id });
		assert.strictEqual(stored.text, 'alice only');
	});

	test('adds and removes attachments without changing the note id', async () => {
		const original = await post(alice, { text: 'attachment test' });
		const file = await uploadFile(alice);
		assert.strictEqual(file.status, 200);

		const withFile = await api('notes/edit', {
			editId: original.id,
			text: 'attachment test',
			fileIds: [file.body!.id],
		}, alice);

		assert.strictEqual(withFile.status, 200);
		assert.strictEqual(withFile.body.createdNote.id, original.id);
		assert.deepStrictEqual(withFile.body.createdNote.fileIds, [file.body!.id]);

		const withoutFile = await api('notes/edit', {
			editId: original.id,
			text: 'attachment test',
			fileIds: [],
		}, alice);

		assert.strictEqual(withoutFile.status, 200);
		assert.strictEqual(withoutFile.body.createdNote.id, original.id);
		assert.deepStrictEqual(withoutFile.body.createdNote.fileIds, []);
	});

	test('preserves poll votes for unrelated edits and resets them when poll data changes', async () => {
		const original = await post(alice, {
			text: 'poll test',
			poll: {
				choices: ['one', 'two'],
			},
		});

		const vote = await api('notes/polls/vote', {
			noteId: original.id,
			choice: 0,
		}, bob);
		assert.strictEqual(vote.status, 204);

		const beforeEdit = await Polls.findOneByOrFail({ noteId: original.id });
		assert.deepStrictEqual(beforeEdit.votes, [1, 0]);

		const textEdit = await api('notes/edit', {
			editId: original.id,
			text: 'poll test edited',
		}, alice);
		assert.strictEqual(textEdit.status, 200);

		const afterTextEdit = await Polls.findOneByOrFail({ noteId: original.id });
		assert.deepStrictEqual(afterTextEdit.votes, [1, 0]);

		const pollEdit = await api('notes/edit', {
			editId: original.id,
			text: 'poll test edited',
			poll: {
				choices: ['one', 'two', 'three'],
				multiple: false,
			},
		}, alice);
		assert.strictEqual(pollEdit.status, 200);

		const afterPollEdit = await Polls.findOneByOrFail({ noteId: original.id });
		assert.deepStrictEqual(afterPollEdit.choices, ['one', 'two', 'three']);
		assert.deepStrictEqual(afterPollEdit.votes, [0, 0, 0]);

		const voteAfterPollChange = await api('notes/polls/vote', {
			noteId: original.id,
			choice: 2,
		}, bob);
		assert.strictEqual(voteAfterPollChange.status, 204);
	});


	test('rejects an already expired poll when editing', async () => {
		const original = await post(alice, { text: 'poll expiry validation' });

		const edit = await api('notes/edit', {
			editId: original.id,
			text: 'poll expiry validation',
			poll: {
				choices: ['one', 'two'],
				expiresAt: Date.now() - 1000,
			},
		}, alice);

		assert.strictEqual(edit.status, 400);
		assert.strictEqual(castAsError(edit.body).error.code, 'CANNOT_CREATE_ALREADY_EXPIRED_POLL');
	});


	test('keeps replies and reactions attached to the same note', async () => {
		const original = await post(alice, { text: 'stable identity' });
		const reply = await post(bob, {
			text: 'reply',
			replyId: original.id,
		});
		assert.strictEqual(reply.replyId, original.id);

		const reaction = await api('notes/reactions/create', {
			noteId: original.id,
			reaction: '❤',
		}, bob);
		assert.strictEqual(reaction.status, 204);

		const beforeEdit = await Notes.findOneByOrFail({ id: original.id });
		const beforeReplies = beforeEdit.repliesCount;
		const beforeReactions = { ...beforeEdit.reactions };

		const edit = await api('notes/edit', {
			editId: original.id,
			text: 'stable identity edited',
		}, alice);
		assert.strictEqual(edit.status, 200);

		const afterEdit = await Notes.findOneByOrFail({ id: original.id });
		assert.strictEqual(afterEdit.id, original.id);
		assert.strictEqual(afterEdit.repliesCount, beforeReplies);
		assert.deepStrictEqual(afterEdit.reactions, beforeReactions);
	});

	test('does not expose edit history for an invisible note', async () => {
		const original = await post(alice, {
			text: 'followers only',
			visibility: 'followers',
		});
		await api('notes/edit', {
			editId: original.id,
			text: 'followers only edited',
		}, alice);

		const versions = await api('notes/versions', { noteId: original.id }, bob);
		assert.strictEqual(versions.status, 400);
		assert.strictEqual(castAsError(versions.body).error.code, 'NO_SUCH_NOTE');
	});
});
