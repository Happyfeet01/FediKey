/*
 * SPDX-FileCopyrightText: Happyfeet01 and FediKey contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as mfm from 'mfm-js';
import { In } from 'typeorm';
import { Inject, Injectable } from '@nestjs/common';
import { extractMentions } from '@/misc/extract-mentions.js';
import { extractCustomEmojisFromMfm } from '@/misc/extract-custom-emojis-from-mfm.js';
import { extractHashtags } from '@/misc/extract-hashtags.js';
import type { IMentionedRemoteUsers } from '@/models/Note.js';
import { MiNote } from '@/models/Note.js';
import { NoteEdit } from '@/models/NoteEdit.js';
import type { NoteEditsRepository, NotesRepository, UserProfilesRepository, UsersRepository } from '@/models/_.js';
import type { MiDriveFile } from '@/models/DriveFile.js';
import type { MiUser, MiRemoteUser } from '@/models/User.js';
import { DI } from '@/di-symbols.js';
import { IdService } from '@/core/IdService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { SearchService } from '@/core/SearchService.js';
import { UtilityService } from '@/core/UtilityService.js';
import { RoleService } from '@/core/RoleService.js';
import { RemoteUserResolveService } from '@/core/RemoteUserResolveService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { ApRendererService } from '@/core/activitypub/ApRendererService.js';
import { ApDeliverManagerService } from '@/core/activitypub/ApDeliverManagerService.js';
import { RelayService } from '@/core/RelayService.js';
import { trackPromise } from '@/misc/promise-tracker.js';
import { bindThis } from '@/decorators.js';
import { DB_MAX_NOTE_TEXT_LENGTH } from '@/const.js';
import { IdentifiableError } from '@/misc/identifiable-error.js';

type MinimumUser = {
	id: MiUser['id'];
	host: MiUser['host'];
	username: MiUser['username'];
	uri: MiUser['uri'];
};

export type NoteEditOptions = {
	text?: string | null;
	cw?: string | null;
	files?: MiDriveFile[] | null;
	apMentions?: MinimumUser[] | null;
	apMentionRawCount?: number | null;
	apHashtags?: string[] | null;
	apEmojis?: string[] | null;
	updatedAt?: Date | null;
};

@Injectable()
export class NoteEditService {
	constructor(
		@Inject(DI.db)
		private db: any,

		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,

		@Inject(DI.noteEditsRepository)
		private noteEditsRepository: NoteEditsRepository,

		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,

		private idService: IdService,
		private globalEventService: GlobalEventService,
		private searchService: SearchService,
		private utilityService: UtilityService,
		private roleService: RoleService,
		private remoteUserResolveService: RemoteUserResolveService,
		private userEntityService: UserEntityService,
		private apRendererService: ApRendererService,
		private apDeliverManagerService: ApDeliverManagerService,
		private relayService: RelayService,
	) {
	}

	@bindThis
	public async edit(user: MiUser, noteId: MiNote['id'], data: NoteEditOptions): Promise<MiNote> {
		const oldNote = await this.notesRepository.findOneBy({ id: noteId });
		if (oldNote == null || oldNote.userId !== user.id) {
			throw new IdentifiableError('eef6c173-3010-4a23-8674-7c4fcaeba719', 'No such editable note');
		}

		let text = data.text === undefined ? oldNote.text : data.text;
		let cw = data.cw === undefined ? oldNote.cw : data.cw;

		if (text != null) {
			if (text.length > DB_MAX_NOTE_TEXT_LENGTH) {
				throw new IdentifiableError('3ac74a84-8fd5-4bb0-870f-01804f82ce16', 'Note is too long');
			}
			text = text.trim();
			if (text === '') text = null;
		}

		if (cw != null) {
			if (cw.length > 512) {
				throw new IdentifiableError('7004c478-bda3-4b4f-acb2-4316398c9d52', 'Content warning is too long');
			}
			cw = cw.trim();
			if (cw === '') cw = null;
		}

		const fileIds = data.files === undefined
			? oldNote.fileIds
			: (data.files ?? []).map(file => file.id);
		const attachedFileTypes = data.files === undefined
			? oldNote.attachedFileTypes
			: (data.files ?? []).map(file => file.type);

		if (text == null && fileIds.length === 0 && !oldNote.hasPoll && oldNote.renoteId == null) {
			throw new IdentifiableError('6f57ef33-2fc5-4a47-9079-060c6c8f7a5f', 'Edited note would be empty');
		}

		if (oldNote.visibility === 'public') {
			const sensitiveWords = (await import('@/config.js')).default;
			void sensitiveWords;
		}

		const hasProhibitedWords = this.isProhibited({
			cw,
			text,
		});
		if (hasProhibitedWords) {
			throw new IdentifiableError('689ee33f-f97c-479a-ac49-1b9f8140af99', 'Note contains prohibited words');
		}

		const tokens = text ? mfm.parse(text) : [];
		const cwTokens = cw ? mfm.parse(cw) : [];
		const combinedTokens = tokens.concat(cwTokens);

		const tags = (data.apHashtags ?? extractHashtags(combinedTokens))
			.filter(tag => Array.from(tag).length <= 128)
			.splice(0, 32);
		const emojis = data.apEmojis ?? extractCustomEmojisFromMfm(combinedTokens);
		const mentionedUsers = data.apMentions ?? await this.extractMentionedUsers(user, combinedTokens);

		if (oldNote.visibility === 'specified' && oldNote.visibleUserIds.length > 0) {
			const visibleUsers = await this.usersRepository.findBy({ id: In(oldNote.visibleUserIds) });
			for (const visibleUser of visibleUsers) {
				if (!mentionedUsers.some(u => u.id === visibleUser.id)) {
					mentionedUsers.push(visibleUser);
				}
			}
		}

		const effectiveMentionCount = Math.max(mentionedUsers.length, data.apMentionRawCount ?? 0);
		if (effectiveMentionCount > 0 && effectiveMentionCount > (await this.roleService.getUserPolicies(user.id)).mentionLimit) {
			throw new IdentifiableError('9f466dab-c856-48cd-9e65-ff90ff750580', 'Note contains too many mentions');
		}

		const profiles = mentionedUsers.length > 0
			? await this.userProfilesRepository.findBy({ userId: In(mentionedUsers.map(u => u.id)) })
			: [];
		const mentionedRemoteUsers = JSON.stringify(mentionedUsers
			.filter((u): u is MiRemoteUser => this.userEntityService.isRemoteUser(u) && u.uri != null)
			.map(u => {
				const profile = profiles.find(p => p.userId === u.id);
				return {
					uri: u.uri,
					url: profile?.url ?? undefined,
					username: u.username,
					host: u.host,
				} as IMentionedRemoteUsers[0];
			}));

		const normalizedTags = tags.map(tag => this.utilityService.toArray(tag).join(''));
		const filesChanged = !this.sameArray(oldNote.fileIds, fileIds);
		const changed =
			oldNote.text !== text ||
			oldNote.cw !== cw ||
			filesChanged ||
			!this.sameArray(oldNote.tags, normalizedTags) ||
			!this.sameArray(oldNote.emojis, emojis) ||
			!this.sameArray(oldNote.mentions, mentionedUsers.map(u => u.id));

		if (!changed) return oldNote;

		const updatedAt = data.updatedAt ?? new Date();
		const previousEdit = await this.noteEditsRepository.findOne({
			where: { noteId: oldNote.id },
			order: { id: 'DESC' },
		});

		const editHistory = new NoteEdit();
		editHistory.id = this.idService.gen();
		editHistory.noteId = oldNote.id;
		editHistory.userId = oldNote.userId;
		editHistory.renoteId = oldNote.renoteId;
		editHistory.replyId = oldNote.replyId;
		editHistory.visibility = oldNote.visibility;
		editHistory.text = oldNote.text;
		editHistory.newText = text;
		editHistory.cw = oldNote.cw;
		editHistory.newCw = cw;
		editHistory.fileIds = oldNote.fileIds;
		editHistory.oldDate = previousEdit != null ? oldNote.updatedAt : this.idService.parse(oldNote.id).date;
		editHistory.updatedAt = updatedAt;
		editHistory.hasPoll = oldNote.hasPoll;

		await this.db.transaction(async (transactionalEntityManager: any) => {
			await transactionalEntityManager.insert(NoteEdit, editHistory);
			await transactionalEntityManager.update(MiNote, oldNote.id, {
				updatedAt,
				text,
				cw,
				fileIds,
				attachedFileTypes,
				tags: normalizedTags,
				emojis,
				mentions: mentionedUsers.map(u => u.id),
				mentionedRemoteUsers,
			});
		});

		const edited = await this.notesRepository.findOneByOrFail({ id: oldNote.id });

		await this.searchService.unindexNote(oldNote);
		if (edited.text != null || edited.cw != null) {
			await this.searchService.indexNote(edited);
		}

		this.globalEventService.publishNoteStream(edited, 'updated', {
			cw: edited.cw,
			text: edited.text ?? '',
		});

		if (!edited.localOnly && this.userEntityService.isLocalUser(user)) {
			const activity = await this.apRendererService.renderNoteOrRenoteActivity(edited, user);
			const deliverManager = this.apDeliverManagerService.createDeliverManager(user, activity);

			const recipientIds = new Set<string>([
				...edited.mentions,
				...edited.visibleUserIds,
				...(edited.replyUserId ? [edited.replyUserId] : []),
				...(edited.renoteUserId ? [edited.renoteUserId] : []),
			]);
			recipientIds.delete(user.id);

			if (recipientIds.size > 0) {
				const recipients = await this.usersRepository.findBy({ id: In([...recipientIds]) });
				for (const recipient of recipients) {
					if (this.userEntityService.isRemoteUser(recipient)) {
						deliverManager.addDirectRecipe(recipient);
					}
				}
			}

			if (['public', 'home', 'followers'].includes(edited.visibility)) {
				deliverManager.addFollowersRecipe();
			}

			trackPromise(deliverManager.execute());
			if (edited.visibility === 'public' && activity != null) {
				trackPromise(this.relayService.deliverToRelays(user, activity));
			}
		}

		return edited;
	}

	private isProhibited(content: { cw: string | null; text: string | null }): boolean {
		return this.utilityService.isKeyWordIncluded(
			this.utilityService.concatNoteContentsForKeyWordCheck(content),
			[],
		);
	}

	@bindThis
	private async extractMentionedUsers(user: { host: MiUser['host'] }, tokens: mfm.MfmNode[]): Promise<MiUser[]> {
		const mentions = extractMentions(tokens);
		let mentionedUsers = (await Promise.all(mentions.map(mention =>
			this.remoteUserResolveService.resolveUser(mention.username, mention.host ?? user.host).catch(() => null),
		))).filter((u): u is MiUser => u != null);

		mentionedUsers = mentionedUsers.filter((u, index, self) =>
			index === self.findIndex(other => other.id === u.id),
		);
		return mentionedUsers;
	}

	private sameArray<T>(a: readonly T[], b: readonly T[]): boolean {
		return a.length === b.length && a.every((value, index) => value === b[index]);
	}
}
