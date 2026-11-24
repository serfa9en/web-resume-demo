import { plainText, sliceText } from './richText'
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
        ? measure({ ...following, text: sliceText(following.text, 0, plainText(following.text).match(/^(?:\s*\S+){1,12}/)?.[0].length ?? 1), href: undefined }, first)
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
    const plain = plainText(block.text)
    let boundaries = Array.from(plain.matchAll(/\S+\s*|\s+/g), match => match.index + match[0].length)
      .filter(offset => offset < plain.length)
    function fittingBoundary() {
      let low = 0
      let high = boundaries.length - 1
      let fit = 0
      while (low <= high) {
        const mid = (low + high) >>> 1
        const end = boundaries[mid]!
        if (measure({ ...block, text: sliceText(block.text, 0, end), href: undefined }, first) <= available) {
          fit = end
          low = mid + 1
        } else high = mid - 1
      }
      return fit
    }
    let fit = fittingBoundary()
    if (!fit) {
      let offset = 0
      boundaries = Array.from(plain, character => (offset += character.length)).slice(0, -1)
      fit = fittingBoundary()
    }
    if (!fit) throw new Error('Блок не помещается на лист A4. Проверьте размер шрифта.')
    const head = { ...block, id: `${block.id}-part-${splitId++}`, text: sliceText(block.text, 0, fit), href: undefined, keepWithNext: false }
    const tail = { ...block, text: sliceText(block.text, fit), label: undefined }
    page.blocks.push(head)
    queue[index] = tail
    newPage()
  }
  return pages
}
