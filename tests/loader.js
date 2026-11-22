// Loads the game's browser scripts into one Node vm context so they can be tested without a browser.
// Scripts are classic <script> files that share globals, so they are run in order in a single context.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WWW = path.join(__dirname, '..', 'www');

// Fake localStorage so Save works in Node
function fakeStorage() {
  const m = {};
  return {
    getItem: k => (k in m ? m[k] : null),
    setItem: (k, v) => { m[k] = String(v); },
    removeItem: k => { delete m[k]; },
    _m: m
  };
}

// files: paths relative to www/. exportsExpr: a JS object literal listing the globals to hand back.
function load(files, exportsExpr, extraGlobals) {
  const sandbox = Object.assign({ console, Math, Date, JSON, window: { localStorage: fakeStorage() } }, extraGlobals || {});
  sandbox.window.window = sandbox.window;
  const ctx = vm.createContext(sandbox);
  let src = '';
  for (const f of files) {
    src += '\n;/* ' + f + ' */\n' + fs.readFileSync(path.join(WWW, f), 'utf8') + '\n';
  }
  src += '\n;(' + exportsExpr + ');';
  return vm.runInContext(src, ctx, { filename: 'taguan-bundle.js' });
}

// Tiny test runner
const results = { pass: 0, fail: 0, failures: [] };
function test(name, fn) {
  try { fn(); results.pass++; console.log('  ok   ' + name); }
  catch (e) { results.fail++; results.failures.push(name + ': ' + e.message); console.log('  FAIL ' + name + '\n       ' + (e.stack || e.message).split('\n').slice(0, 4).join('\n       ')); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function eq(a, b, msg) { if (a !== b) throw new Error((msg || 'not equal') + ': got ' + JSON.stringify(a) + ', expected ' + JSON.stringify(b)); }
function summary() {
  console.log('\n' + results.pass + ' passed, ' + results.fail + ' failed');
  if (results.fail) { console.log(results.failures.join('\n')); process.exitCode = 1; }
}

module.exports = { load, test, assert, eq, summary, WWW, fakeStorage };
