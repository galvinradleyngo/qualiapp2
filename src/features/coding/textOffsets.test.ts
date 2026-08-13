import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { getSelectionOffsets } from './textOffsets';

describe('getSelectionOffsets', () => {
  let container: HTMLDivElement;
  let nextSibling: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.textContent = 'Time constraints were a barrier.';
    nextSibling = document.createElement('div');
    nextSibling.textContent = 'sidebar content';
    const wrapper = document.createElement('div');
    wrapper.append(container, nextSibling);
    document.body.append(wrapper);
  });

  afterEach(() => {
    container.parentElement?.remove();
    window.getSelection()?.removeAllRanges();
  });

  it('computes offsets for a selection fully inside the container', () => {
    const range = document.createRange();
    range.setStart(container.firstChild!, 0);
    range.setEnd(container.firstChild!, 4);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);

    const result = getSelectionOffsets(container);
    expect(result).toEqual({ start: 0, end: 4, text: 'Time' });
  });

  it('clamps a selection whose end boundary spills into the next sibling (triple-click paragraph select)', () => {
    const range = document.createRange();
    range.setStart(container.firstChild!, 0);
    range.setEnd(nextSibling, 0); // what Chromium produces on a triple-click before a following block
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);

    const result = getSelectionOffsets(container);
    expect(result).toEqual({ start: 0, end: container.textContent!.length, text: container.textContent });
  });

  it('returns null when the selection does not touch the container at all', () => {
    const range = document.createRange();
    range.setStart(nextSibling.firstChild!, 0);
    range.setEnd(nextSibling.firstChild!, 3);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);

    expect(getSelectionOffsets(container)).toBeNull();
  });

  it('returns null for a collapsed selection', () => {
    const range = document.createRange();
    range.setStart(container.firstChild!, 2);
    range.setEnd(container.firstChild!, 2);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);

    expect(getSelectionOffsets(container)).toBeNull();
  });
});
