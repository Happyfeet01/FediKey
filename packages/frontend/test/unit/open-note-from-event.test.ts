/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import { openNoteFromEvent } from '../../src/utility/open-note-from-event.js';

function surface(content = '<span>Note text</span>') {
	const root = document.createElement('article');
	root.innerHTML = `<a data-note-link href="/notes/123">Time</a>${content}`;
	document.body.append(root);
	const navigate = vi.fn((ev: Event) => ev.preventDefault());
	root.querySelector('a')!.addEventListener('click', navigate);
	root.addEventListener('click', openNoteFromEvent);
	root.addEventListener('keydown', ev => {
		if (ev.key === 'Enter' && ev.target === root) openNoteFromEvent(ev);
	});
	return { root, navigate };
}

function click(target: Element, options: MouseEventInit = {}) {
	target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ...options }));
}

afterEach(() => {
	window.getSelection()?.removeAllRanges();
	document.body.replaceChildren();
});

describe('note surface navigation', () => {
	test('opens the timestamp link once from text and whitespace', () => {
		const { root, navigate } = surface();
		click(root.querySelector('span')!);
		expect(navigate).toHaveBeenCalledTimes(1);
		click(root);
		expect(navigate).toHaveBeenCalledTimes(2);
	});

	test.each([
		'<a href="/users/abc"><span>Profile</span></a>',
		'<button><span>Reply</span></button>',
		'<summary><span>Files</span></summary>',
		'<div role="button"><span>React</span></div>',
		'<div data-note-interactive><span>Media</span></div>',
		'<div contenteditable="true"><span>Editor</span></div>',
		'<div tabindex="0"><span>Control</span></div>',
		'<span alt="emoji">Emoji</span>',
		'<video></video>',
		'<img src="" alt="emoji">',
	])('preserves nested controls: %s', content => {
		const { root, navigate } = surface(content);
		click(root.lastElementChild!.querySelector('span') ?? root.lastElementChild!);
		expect(navigate).not.toHaveBeenCalled();
	});

	test('keeps the original timestamp link working without recursion', () => {
		const { root, navigate } = surface();
		click(root.querySelector('a')!);
		expect(navigate).toHaveBeenCalledTimes(1);
	});

	test('does not navigate while selecting text', () => {
		const { root, navigate } = surface();
		const range = document.createRange();
		range.selectNodeContents(root.querySelector('span')!);
		window.getSelection()!.addRange(range);
		click(root.querySelector('span')!);
		expect(navigate).not.toHaveBeenCalled();
	});

	test('preserves link modifier keys', () => {
		const { root, navigate } = surface();
		click(root, { ctrlKey: true, metaKey: true, shiftKey: true, altKey: true });
		expect(navigate.mock.calls[0][0]).toMatchObject({ ctrlKey: true, metaKey: true, shiftKey: true, altKey: true });
	});

	test('ignores non-primary and prevented clicks', () => {
		const { root, navigate } = surface();
		click(root, { button: 1 });
		const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
		ev.preventDefault();
		root.dispatchEvent(ev);
		expect(navigate).not.toHaveBeenCalled();
	});

	test('opens with Enter on the surface, not on a nested control', () => {
		const { root, navigate } = surface('<button>Reply</button>');
		root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
		expect(navigate).toHaveBeenCalledTimes(1);
		root.querySelector('button')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		expect(navigate).toHaveBeenCalledTimes(1);
	});

	test('does nothing in mock mode without a timestamp link', () => {
		const { root, navigate } = surface();
		root.querySelector('a')!.remove();
		click(root);
		expect(navigate).not.toHaveBeenCalled();
	});

	test('opens a nested note without also opening the outer note', () => {
		const parent = surface();
		const child = surface();
		parent.root.append(child.root);
		click(child.root.querySelector('span')!);
		expect(child.navigate).toHaveBeenCalledTimes(1);
		expect(parent.navigate).not.toHaveBeenCalled();
	});
});
