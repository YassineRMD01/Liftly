import { memberQrPayload, parseMemberQr } from './qr';

describe('member QR codes', () => {
  it('round-trips a member id', () => {
    expect(parseMemberQr(memberQrPayload('u-k6'))).toBe('u-k6');
  });
  it('ignores surrounding whitespace', () => {
    expect(parseMemberQr(`  ${memberQrPayload('u-k1')}\n`)).toBe('u-k1');
  });
  it('rejects tampered or foreign codes', () => {
    const [tag, , sig] = memberQrPayload('u-k1').split('|');
    expect(parseMemberQr(`${tag}|u-k2|${sig}`)).toBeNull();
    expect(parseMemberQr('https://example.com')).toBeNull();
    expect(parseMemberQr('')).toBeNull();
  });
});
