/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/** Open the existing timestamp link, preserving its navigation behavior. */
export function openNoteFromEvent(ev: MouseEvent | KeyboardEvent): void {
	if (ev.defaultPrevented || (ev instanceof MouseEvent && ev.button !== 0)) return;
	if (window.getSelection()?.toString()) return;
	if (!(ev.currentTarget instanceof HTMLElement) || !(ev.target instanceof Element)) return;

	// Only the note surface is a shortcut. Its controls keep their own actions.
	let target: Element | null = ev.target;
	while (target && target !== ev.currentTarget) {
		if (target.matches('a, button, input, textarea, select, label, summary, details, audio, video, iframe, img, [alt], [role], [tabindex], [contenteditable], ._button, [data-note-interactive]')) return;
		target = target.parentElement;
	}

	const link = ev.currentTarget.querySelector<HTMLAnchorElement>('a[data-note-link]');
	if (!link) return;

	ev.preventDefault();
	ev.stopPropagation();
	link.dispatchEvent(new MouseEvent('click', {
		bubbles: true,
		cancelable: true,
		ctrlKey: ev.ctrlKey,
		metaKey: ev.metaKey,
		shiftKey: ev.shiftKey,
		altKey: ev.altKey,
	}));
}
