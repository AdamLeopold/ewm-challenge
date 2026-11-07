const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');

function element(dataset = {}) {
  const attributes = {};
  return { dataset, attributes, hidden: false,
    setAttribute(name, value) { attributes[name] = value; },
    removeAttribute(name) { delete attributes[name]; if (name === 'href') delete this.href; },
    querySelectorAll() { return []; } };
}

function setup(formUrl) {
  const entry = element({ link: 'registerUrl' });
  const form = element();
  const ready = element();
  const pending = element();
  const selectors = {
    '[data-link]': [entry], '[data-registration-link]': [form],
    '[data-registration-ready]': [ready], '[data-registration-pending]': [pending]
  };
  const context = {
    window: {}, document: { querySelectorAll: s => selectors[s] || [], addEventListener() {} }
  };
  vm.createContext(context);
  for (const name of ['config.js', 'pages.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, 'assets/js', name), 'utf8'), context);
  }
  const config = context.window.SW_CONFIG;
  config.registrationFormUrl = formUrl;
  const refresh = () => context.window.SW_refresh();
  refresh();
  return { entry, form, ready, pending, config, refresh };
}

test('the fixed registration entry works while an unconfigured form stays closed', () => {
  const state = setup('');
  assert.equal(state.entry.href, 'register.html');
  assert.equal(state.config.contactEmail, 'YLU063@e.ntu.edu.sg');
  assert.equal(state.form.href, undefined);
  assert.equal(state.form.attributes['aria-disabled'], 'true');
  assert.equal(state.form.attributes.tabindex, '-1');
  assert.equal(state.ready.hidden, true);
  assert.equal(state.pending.hidden, false);
});

test('a configured Microsoft Forms response link opens collection and survives rerendering', () => {
  for (const url of [
    'https://forms.office.com/r/example',
    'https://forms.office.com/Pages/ResponsePage.aspx?id=example',
    'https://forms.cloud.microsoft/r/example',
    'https://forms.microsoft.com/r/example'
  ]) {
    const state = setup(url);
    state.refresh();
    assert.equal(state.form.href, url);
    assert.equal(state.form.attributes['aria-disabled'], undefined);
    assert.equal(state.form.attributes.tabindex, undefined);
    assert.equal(state.ready.hidden, false);
    assert.equal(state.pending.hidden, true);
    assert.equal(state.entry.href, 'register.html');
  }
});

test('removing the response link removes the working form action', () => {
  const state = setup('https://forms.office.com/r/example');
  state.config.registrationFormUrl = '';
  state.refresh();
  assert.equal(state.form.href, undefined);
  assert.equal(state.form.attributes['aria-disabled'], 'true');
  assert.equal(state.ready.hidden, true);
  assert.equal(state.pending.hidden, false);
});

test('malformed or non-Microsoft URLs do not enable a registration action', () => {
  for (const url of [
    'javascript:alert(1)', 'http://forms.office.com/r/example',
    'https://forms.office.com.example.org/r/example',
    'https://forms.office.com@example.org/r/example',
    'https://example.org/form'
  ]) {
    const state = setup(url);
    assert.equal(state.form.href, undefined, url);
    assert.equal(state.ready.hidden, true, url);
  }
});

test('all public competition pages lead to the same registration page', () => {
  for (const name of ['index.html', 'holobit.html', 'agentic-city.html', 'tracks.html']) {
    const html = fs.readFileSync(path.join(root, name), 'utf8');
    assert.match(html, /href="register\.html" data-link="registerUrl"/, name);
  }
  const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(home, /src="assets\/registration\/ewm-registration-qr\.svg"/);
  const registration = fs.readFileSync(path.join(root, 'register.html'), 'utf8');
  assert.match(registration, /https:\/\/adamleopold\.github\.io\/ewm-challenge\/register\.html/);
  assert.doesNotMatch(registration, /<form\b/i);
});
