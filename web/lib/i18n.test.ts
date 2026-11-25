// Run: npm test. Every language needs every key, and every lesson needs every language.
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { en, hi, kn } from './dicts.ts'

for (const [name, d] of Object.entries({ hi, kn })) {
  const missing = Object.keys(en).filter((k) => !(k in d))
  const extra = Object.keys(d).filter((k) => !(k in en))
  assert.deepEqual([missing, extra], [[], []], `${name}: missing ${missing} extra ${extra}`)
  for (const k of Object.keys(en)) assert.equal(typeof d[k], typeof en[k], `${name}.${k} string/function mismatch`)
}
const dir = new URL('../lessons/', import.meta.url)
for (const f of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  const l = JSON.parse(readFileSync(new URL(f, dir), 'utf8'))
  for (const lang of ['hi', 'kn']) {
    assert.equal(l[lang].steps.length, l.en.steps.length, `${f} ${lang} steps`)
    assert.equal(l[lang].quiz.length, l.en.quiz.length, `${f} ${lang} quiz`)
    l[lang].quiz.forEach((q: any, i: number) => {
      assert.equal(q.options.length, l.en.quiz[i].options.length, `${f} ${lang} q${i} options`)
      assert.equal(q.answer, l.en.quiz[i].answer, `${f} ${lang} q${i} answer`)
    })
  }
}
console.log('ok i18n: en/hi/kn dictionaries and lessons are complete')
