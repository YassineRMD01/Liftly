import { parseCsv, toCsv } from './csv';

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

describe('parseCsv', () => {
  it('detects ; separators and handles quotes and line breaks', () => {
    expect(parseCsv('\uFEFFPrénom;Nom\r\n"Lopez; Sara";"a ""b"""\n\nTom;"two\nlines"')).toEqual([['Prénom', 'Nom'], ['Lopez; Sara', 'a "b"'], ['Tom', 'two\nlines']]);
  });
  it('round-trips with toCsv', () => {
    const rows = [['a', 'b, c'], ['d "e"', '']];
    expect(parseCsv(toCsv(rows[0], [rows[1]]))).toEqual(rows);
  });
});
