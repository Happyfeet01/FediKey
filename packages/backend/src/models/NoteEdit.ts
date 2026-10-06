/*
 * SPDX-FileCopyrightText: marie and other Sharkey contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { id } from './util/id.js';
import { MiNote } from './Note.js';
import type { MiDriveFile } from './DriveFile.js';
import { MiUser } from '@/models/User.js';
import { noteVisibilities } from '@/types.js';

@Entity()
export class NoteEdit {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column({
		...id(),
		comment: 'The ID of note.',
	})
	public noteId: MiNote['id'];

	@ManyToOne(() => MiNote, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public note: MiNote | null;

	@Column({
		...id(),
		comment: 'The ID of author.',
	})
	public userId: MiUser['id'];

	@ManyToOne(() => MiUser, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public user: MiUser | null;

	@Column({
		...id(),
		nullable: true,
		comment: 'The ID of renote target.',
	})
	public renoteId: MiNote['id'] | null;

	@ManyToOne(() => MiNote, {
		createForeignKeyConstraints: false,
	})
	@JoinColumn()
	public renote: MiNote | null;

	@Column({
		...id(),
		nullable: true,
		comment: 'The ID of reply target.',
	})
	public replyId: MiNote['id'] | null;

	@ManyToOne(() => MiNote, {
		createForeignKeyConstraints: false,
	})
	@JoinColumn()
	public reply: MiNote | null;

	@Column('enum', { enum: noteVisibilities })
	public visibility: typeof noteVisibilities[number];

	@Column('text', { nullable: true })
	public newText: string | null;

	@Column('text', { nullable: true })
	public cw: string | null;

	@Column('text', { nullable: true })
	public newCw: string | null;

	@Column({
		...id(),
		array: true,
		default: '{}',
	})
	public fileIds: MiDriveFile['id'][];

	@Column('timestamp with time zone', {
		comment: 'The updated date of the Note.',
	})
	public updatedAt: Date;

	@Column('text', { nullable: true })
	public text: string | null;

	@Column('timestamp with time zone', {
		comment: 'The old date from before the edit.',
		nullable: true,
	})
	public oldDate: Date | null;

	@Column('boolean', {
		default: false,
		comment: 'Whether this revision had a poll.',
	})
	public hasPoll: boolean;
}
