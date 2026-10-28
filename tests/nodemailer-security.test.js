const {test} = require('node:test');
const assert = require('node:assert/strict');
const nodemailer = require('nodemailer');
const addressparser = require('nodemailer/lib/addressparser');

// Use the real MIME/envelope builder, never a network transport. Addresses are
// reserved test domains; these cases protect the three 10.1.4 security fixes.
const cases = [
  ['GHSA-8c8m-p3m8-cjg8', 'Recipient (x(y) <other@other.test>) <recipient@intended.test>', 'recipient@intended.test'],
  ['GHSA-m943-m63m-w62w', 'Group: (a; <other@other.test>) <recipient@intended.test>;', 'recipient@intended.test'],
  ['GHSA-85x2-q946-cp5h', '<"a@other.test>"@intended.test>', '"a@other.test>"@intended.test'],
];

for (const [advisory, to, expected] of cases) {
  test(`${advisory}: envelope preserves the intended recipient without delivery`, async () => {
    const transport = nodemailer.createTransport({streamTransport:true, buffer:true});
    const result = await transport.sendMail({from:'sender@local.test', to, subject:'Local parser regression', text:'No external delivery'});
    assert.deepEqual(addressparser(to, {flatten:true}).map(entry => entry.address), [expected]);
    // MIME envelope serialization sanitizes special local-part characters;
    // the security boundary is that it must preserve the recipient domain.
    assert.equal(result.envelope.to.length, 1);
    assert.ok(result.envelope.to[0].endsWith('@intended.test'));
    assert.ok(Buffer.isBuffer(result.message));
    assert.equal(result.accepted, undefined);
  });
}
