import { beforeEach, describe, expect, it } from 'vitest';
import {
  SUPPORT_EMAIL,
  addSuggestion,
  buildSuggestionMailto,
  clearSuggestions,
  formatSuggestionSummary,
  loadSuggestions,
  removeSuggestion,
} from './suggestions';

describe('usulan kafe baru', () => {
  beforeEach(() => {
    clearSuggestions();
  });

  it('menyimpan, memformat, membuat tautan email support@nongki.me, dan menghapus usulan', () => {
    const saved = addSuggestion({
      name: 'Kopi Senja Kemang',
      city: 'Jakarta',
      area: 'Kemang Raya',
      link: 'https://maps.app.goo.gl/contoh',
      notes: 'Banyak colokan dan buka malam',
    });

    const list = loadSuggestions();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(saved.id);

    const summary = formatSuggestionSummary(saved);
    expect(summary).toContain('Kopi Senja Kemang');
    expect(summary).toContain('Jakarta');
    expect(summary).toContain('Kemang Raya');

    const mailto = buildSuggestionMailto(saved);
    expect(mailto.startsWith(`mailto:${SUPPORT_EMAIL}?subject=`)).toBe(true);
    expect(mailto).toContain(encodeURIComponent('Kopi Senja Kemang'));

    const remaining = removeSuggestion(saved.id);
    expect(remaining).toHaveLength(0);
  });

  it('menolak usulan tanpa nama kafe atau kota', () => {
    expect(() => addSuggestion({ name: '   ', city: 'Bogor' })).toThrow();
    expect(() => addSuggestion({ name: 'Kafe Hujan', city: '' })).toThrow();
  });
});
