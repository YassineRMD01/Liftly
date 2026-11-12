import { toCsv } from './csv';

describe('toCsv', () => {
  it('joins rows with CRLF and leaves simple cells alone', () => {
    expect(toCsv(['a', 'b'], [[1, 'x']])).toBe('a,b\r\n1,x');
  });
  it('quotes cells with separators, quotes or line breaks', () => {
    expect(toCsv(['n'], [['Smith, John'], ['say "hi"'], ['two\nlines']])).toBe('n\r\n"Smith, John"\r\n"say ""hi"""\r\n"two\nlines"');
  });
  it('writes empty cells for null and undefined', () => {
    expect(toCsv(['a', 'b', 'c'], [[null, undefined, false]])).toBe('a,b,c\r\n,,false');
  });
});
