import type { DocumentBlock, ResumePage } from '../types/resume'

type Measure = (block: DocumentBlock, firstPage: boolean) => number

/** Dimensions come from the same DOM/CSS as the displayed document, in unscaled pixels. */
export function paginate(
  blocks: DocumentBlock[], capacity: (firstPage: boolean) => number, measure: Measure,
): ResumePage[] {
  const pages: ResumePage[] = [{ blocks: [] }]
  const queue = [...blocks]
  let used = 0
  let index = 0
  let splitId = 0
  const newPage = () => { pages.push({ blocks: [] }); used = 0 }

  while (index < queue.length) {
    const block = queue[index]!
    const first = pages.length === 1
    const available = capacity(first)
    const height = measure(block, first)
    let groupHeight = height
    // Keep a chain of headings with at least the first actual line of content.
    for (let next = index; queue[next]?.keepWithNext && queue[next + 1]; next++) {
      const following = queue[next + 1]!
      const followingHeight = measure(following, first)
      groupHeight += followingHeight > available && !following.keepWithNext
        ? measure({ ...following, text: following.text.split(/\s+/).slice(0, 12).join(' '), href: undefined }, first)
        : followingHeight
    }
    const page = pages.at(-1)!
    if (used > 0 && used + groupHeight > available && groupHeight <= available) {
      newPage()
      continue
    }
    if (used + height <= available) {
      page.blocks.push(block)
      used += height
      index++
      continue
    }
    if (used > 0) { newPage(); continue }

    // Even one unusually long paragraph can exceed a whole sheet. Split by words,
    // measuring each candidate, so no text is clipped or silently discarded.
    const words = block.text.split(/\s+/)
    let low = 1
    let high = words.length - 1
    let fit = 0
    while (low <= high) {
      const mid = Math.floor((low + high) / 2)
      if (measure({ ...block, text: words.slice(0, mid).join(' '), href: undefined }, first) <= available) {
        fit = mid; low = mid + 1
      } else high = mid - 1
    }
    if (!fit) throw new Error('Блок не помещается на лист A4. Проверьте размер шрифта и длину слова.')
    const head = { ...block, id: `${block.id}-part-${splitId++}`, text: words.slice(0, fit).join(' '), href: undefined, keepWithNext: false }
    const tail = { ...block, text: words.slice(fit).join(' '), label: undefined }
    page.blocks.push(head)
    queue[index] = tail
    newPage()
  }
  return pages
}
