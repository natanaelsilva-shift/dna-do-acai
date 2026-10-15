// Carregado SOMENTE pelo subprocesso isolado do teste de integração.
// Não faz parte do app nem do build de produção.
import fs from 'node:fs';
if (process.env.DNA_TEST_CLOCK_FILE && process.env.NODE_ENV !== 'production') {
  const RealDate = Date;
  let value = { now: RealDate.now(), realTime: RealDate.now() };
  const clock = () => {
    try { value = JSON.parse(fs.readFileSync(process.env.DNA_TEST_CLOCK_FILE, 'utf8')); } catch {}
    return value.now + RealDate.now() - value.realTime;
  };
  global.Date = class extends RealDate {
    constructor(...args) { super(...(args.length ? args : [clock()])); }
    static now() { return clock(); }
    static parse(value) { return RealDate.parse(value); }
    static UTC(...args) { return RealDate.UTC(...args); }
  };
}
