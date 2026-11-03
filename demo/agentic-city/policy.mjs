export const POLICY_STORAGE_KEY = 'ac-policy';
export const POLICY_FIELDS = [
  'id', 'name', 'description', 'objectives', 'target_type', 'eligibility',
  'target_count', 'counting_basis', 'support_per_target_hkd',
  'payment_method', 'areas', 'period'
];
export const DEFAULT_POLICY = Object.freeze({
  id: 'P-001',
  name: 'Fire service readiness',
  description: 'Staff and equip the three planned stations.',
  objectives: 'Improve emergency access',
  target_type: 'fire_station',
  eligibility: Object.freeze(['FS-01', 'FS-02', 'FS-03']),
  target_count: 3,
  counting_basis: 'unique_station',
  support_per_target_hkd: 6000000,
  payment_method: 'implementation_milestones',
  areas: Object.freeze(['NP-025', 'NP-081', 'NP-168']),
  period: '2030-2035'
});

const text = value => String(value ?? '').trim();
const lines = value => (Array.isArray(value) ? value : String(value ?? '').split(/\r?\n/)).map(text).filter(Boolean);
const amount = value => typeof value === 'number' ? value : text(value) === '' ? NaN : Number(value);

// The original workspace saved seven combined form fields as an array.
function migrateLegacy(values) {
  const [name, objectives, eligibility, count = '', support = '', area = '', description] = values;
  const countMatch = String(count).match(/([\d,]+(?:\.\d+)?)/);
  const supportMatch = String(support).match(/([\d,]+(?:\.\d+)?)/);
  const areaParts = String(area).split(/\s*·\s*/);
  return {
    ...DEFAULT_POLICY, name, objectives, description,
    target_type: 'resident', eligibility: [text(eligibility)],
    target_count: countMatch ? Number(countMatch[1].replaceAll(',', '')) : NaN,
    counting_basis: countMatch ? text(String(count).replace(countMatch[0], '')) || 'unique_target' : text(count),
    support_per_target_hkd: supportMatch ? Number(supportMatch[1].replaceAll(',', '')) : NaN,
    payment_method: text(String(support).split(/\s*·\s*/).slice(1).join(' · ')) || 'direct_payment',
    areas: [text(areaParts[0])], period: areaParts.slice(1).join(' · ') || DEFAULT_POLICY.period
  };
}

export function normalizePolicy(input = DEFAULT_POLICY) {
  let source = input?.policy ?? input?.policies?.[0] ?? input;
  if (Array.isArray(source)) source = migrateLegacy(source);
  if (!source || typeof source !== 'object') source = DEFAULT_POLICY;
  const merged = { ...DEFAULT_POLICY, ...source };
  return Object.fromEntries(POLICY_FIELDS.map(key => [key,
    key === 'eligibility' || key === 'areas' ? lines(merged[key]) :
    key === 'target_count' || key === 'support_per_target_hkd' ? amount(merged[key]) : text(merged[key])
  ]));
}

export function validatePolicy(policy) {
  const errors = [];
  if (typeof policy.description !== 'string') errors.push('description: enter text.');
  for (const key of ['id', 'name', 'objectives', 'target_type', 'counting_basis', 'payment_method', 'period']) {
    if (typeof policy[key] !== 'string' || !policy[key].trim()) errors.push(`${key}: enter a value.`);
  }
  for (const key of ['eligibility', 'areas']) {
    if (!Array.isArray(policy[key]) || !policy[key].length || policy[key].some(value => typeof value !== 'string' || !value.trim())) {
      errors.push(`${key}: enter at least one item, one per line.`);
    }
  }
  if (!Number.isSafeInteger(policy.target_count) || policy.target_count < 0) errors.push('target_count: enter a whole number of zero or more.');
  if (!Number.isFinite(policy.support_per_target_hkd) || policy.support_per_target_hkd < 0) errors.push('support_per_target_hkd: enter an amount of zero or more.');
  return errors;
}

export function loadPolicyDraft(storage) {
  try {
    const saved = storage?.getItem(POLICY_STORAGE_KEY);
    return saved ? normalizePolicy(JSON.parse(saved)) : normalizePolicy();
  } catch {
    return normalizePolicy();
  }
}

export function savePolicyDraft(storage, policy) {
  const errors = validatePolicy(policy);
  if (errors.length) throw new TypeError(errors.join('\n'));
  try {
    storage?.setItem(POLICY_STORAGE_KEY, JSON.stringify({ version: 1, policy }));
    return Boolean(storage);
  } catch {
    return false;
  }
}

export function policyToYaml(policy) {
  const errors = validatePolicy(policy);
  if (errors.length) throw new TypeError(errors.join('\n'));
  const scalar = value => Array.isArray(value) ? `[${value.map(item => JSON.stringify(item)).join(', ')}]` : JSON.stringify(value);
  return 'policies:\n' + POLICY_FIELDS.map((key, index) => `${index === 0 ? '  - ' : '    '}${key}: ${scalar(policy[key])}`).join('\n') + '\n';
}
