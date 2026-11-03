import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { DEFAULT_POLICY, POLICY_FIELDS, loadPolicyDraft, normalizePolicy, policyToYaml, savePolicyDraft, validatePolicy } from './policy.mjs';

const memory = initial => ({ value: initial, getItem() { return this.value ?? null; }, setItem(key, value) { assert.equal(key, 'ac-policy'); this.value = value; } });

test('the policy file has the agreed flat fields and numeric amounts', () => {
  const policy = normalizePolicy();
  assert.deepEqual(Object.keys(policy), POLICY_FIELDS);
  assert.deepEqual(validatePolicy(policy), []);
  const yaml = policyToYaml(policy);
  assert.match(yaml, /^policies:\n  - id: "P-001"\n/);
  assert.match(yaml, /    target_count: 3\n/);
  assert.match(yaml, /    support_per_target_hkd: 6000000\n/);
  assert.match(yaml, /    eligibility: \["FS-01", "FS-02", "FS-03"\]\n/);
});

test('the competition page shows the exact default policy exported by the studio', () => {
  const page = readFileSync(new URL('../../agentic-city.html', import.meta.url), 'utf8');
  const sample = page.match(/<pre><code>([\s\S]*?)<\/code><\/pre>/)[1].replace(/<[^>]+>/g, '');
  assert.equal(sample + '\n', policyToYaml(normalizePolicy()));
});

test('quotes, multiline text and array items retain their exact values', () => {
  const policy = normalizePolicy({ ...DEFAULT_POLICY, name: 'A "quoted": policy #1', description: 'First line\nSecond "line"\n- not a new policy', eligibility: ['FS-01, FS-02', 'Age: 35+', 'A "quoted" target'], areas: ['San Tin\nNorth', 'The Loop'] });
  const yaml = policyToYaml(policy);
  const values = Object.fromEntries(yaml.trimEnd().split('\n').slice(1).map(line => {
    const [, key, value] = line.match(/^  (?:- |  )(\w+): (.*)$/);
    return [key, JSON.parse(value)];
  }));
  assert.deepEqual(values, policy);
  assert.equal(yaml.trimEnd().split('\n').length, POLICY_FIELDS.length + 1);
});

test('save and reopen retain the latest edited draft', () => {
  const storage = memory();
  const policy = normalizePolicy({ ...DEFAULT_POLICY, name: 'Updated readiness', target_count: '4', areas: 'NP-025\nNP-081\nNP-168\nNP-169' });
  assert.equal(savePolicyDraft(storage, policy), true);
  assert.deepEqual(loadPolicyDraft(storage), policy);
  assert.match(policyToYaml(loadPolicyDraft(storage)), /name: "Updated readiness"/);
});

test('the original seven-field saved drafts migrate without discarding their values', () => {
  const storage = memory(JSON.stringify(['Skills and employment access', 'Improve access', 'Eligible residents', '1,000 unique eligible participants', 'HK$ 5,000 · milestone-based payment', 'Planning area · 2030–2035', 'Training\nand jobs']));
  const policy = loadPolicyDraft(storage);
  assert.equal(policy.name, 'Skills and employment access');
  assert.equal(policy.target_count, 1000);
  assert.equal(policy.counting_basis, 'unique eligible participants');
  assert.equal(policy.support_per_target_hkd, 5000);
  assert.equal(policy.payment_method, 'milestone-based payment');
  assert.deepEqual(policy.eligibility, ['Eligible residents']);
  assert.deepEqual(policy.areas, ['Planning area']);
  assert.equal(policy.period, '2030–2035');
  assert.equal(policy.description, 'Training\nand jobs');
  assert.deepEqual(validatePolicy(policy), []);
  savePolicyDraft(storage, policy);
  assert.deepEqual(loadPolicyDraft(storage), policy);
});

test('corrupt or unavailable storage preserves a usable local workspace', () => {
  assert.deepEqual(loadPolicyDraft(memory('{broken')), normalizePolicy());
  const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } };
  assert.deepEqual(loadPolicyDraft(blocked), normalizePolicy());
  assert.equal(savePolicyDraft(blocked, normalizePolicy()), false);
});

test('invalid numeric values and empty arrays cannot become a malformed export', () => {
  for (const patch of [{ target_count: '' }, { target_count: 1.5 }, { target_count: -1 }, { support_per_target_hkd: 'wrong' }, { areas: [] }, { eligibility: [] }]) {
    const policy = normalizePolicy({ ...DEFAULT_POLICY, ...patch });
    assert.ok(validatePolicy(policy).length);
    assert.throws(() => policyToYaml(policy), TypeError);
  }
  assert.equal(normalizePolicy({ ...DEFAULT_POLICY, support_per_target_hkd: '0' }).support_per_target_hkd, 0);
});
