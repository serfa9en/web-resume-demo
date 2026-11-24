const prefix = 'resume:rich:v1:'
export type Mark = 'b' | 'i' | 'u'
export interface Run { text: string; marks?: Mark[] }

export function textRuns(value: string): Run[] {
  if (value.startsWith(prefix)) {
    try {
      const runs: unknown = JSON.parse(value.slice(prefix.length))
      if (Array.isArray(runs) && runs.every(run => run && typeof run.text === 'string' &&
        Array.isArray(run.marks) && run.marks.every((mark: unknown) => mark === 'b' || mark === 'i' || mark === 'u'))) return runs
    } catch { /* Read malformed content as text. */ }
  }
  return [{ text: value }]
}

export function packText(runs: Run[]): string {
  const merged: { text: string; marks: Mark[] }[] = []
  for (const run of runs) {
    if (!run.text) continue
    const marks = (['b', 'i', 'u'] as const).filter(mark => run.marks?.includes(mark))
    const last = merged.at(-1)
    if (last && last.marks.join() === marks.join()) last.text += run.text
    else merged.push({ text: run.text, marks })
  }
  const plain = merged.map(run => run.text).join('')
  return merged.some(run => run.marks.length) || plain.startsWith(prefix) ? prefix + JSON.stringify(merged) : plain
}

export function plainText(value: string): string {
  return textRuns(value).map(run => run.text).join('')
}

export function joinText(values: string[], separator = ''): string {
  return packText(values.flatMap((value, index) => [
    ...(index ? [{ text: separator }] : []), ...textRuns(value),
  ]))
}

export function sliceText(value: string, start: number, end = Infinity): string {
  let offset = 0
  return packText(textRuns(value).flatMap(run => {
    const length = run.text.length
    const from = Math.max(start - offset, 0)
    const to = Math.min(end - offset, length)
    offset += length
    return to > from ? [{ ...run, text: run.text.slice(from, to) }] : []
  }))
}

export function textHtml(value: string): string {
  return textRuns(value).map(run => {
    let html = run.text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    for (const mark of ['b', 'i', 'u'] as const) {
      if (run.marks?.includes(mark)) html = '<' + mark + '>' + html + '</' + mark + '>'
    }
    return html
  }).join('')
}
