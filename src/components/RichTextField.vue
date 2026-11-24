<script setup lang="ts">
import { onMounted, ref, useId, watch } from 'vue'
import { packText, textHtml, type Mark, type Run } from '../utils/richText'

const model = defineModel<string>({ default: '' })
const props = defineProps<{ label: string; multiline?: boolean; disabled?: boolean }>()
const editor = ref<HTMLElement>()
const id = useId()
let selectionRange: Range | undefined
const buttons = [
  { command: 'bold', mark: 'b', title: 'Жирный', glyph: 'Ж' },
  { command: 'italic', mark: 'i', title: 'Курсив', glyph: 'К' },
  { command: 'underline', mark: 'u', title: 'Подчёркнутый', glyph: 'П' },
] as const

function readEditor() {
  if (!editor.value) return
  const runs: Run[] = []
  function append(text: string, marks: Mark[] = []) {
    runs.push({ text, marks })
  }

  function visit(node: Node, marks: Mark[]) {
    if (node.nodeType === Node.TEXT_NODE) {
      append((node.nodeValue ?? '').replaceAll('\u00a0', ' '), marks)
      return
    }
    if (!(node instanceof HTMLElement)) return
    if (node.tagName === 'BR') {
      if (node.nextSibling) append('\n', marks)
      return
    }
    const block = node.tagName === 'DIV' || node.tagName === 'P'
    if (block && node.previousSibling && !(node.previousSibling instanceof HTMLBRElement)) append('\n')
    const mark: Mark | undefined = ({
      B: 'b', STRONG: 'b', I: 'i', EM: 'i', U: 'u',
    } as const)[node.tagName as 'B']
    for (const child of node.childNodes) visit(child, mark ? [...marks, mark] : marks)
    if (block && node.nextSibling && !(node.nextSibling instanceof HTMLElement && ['DIV', 'P'].includes(node.nextSibling.tagName))) append('\n')
  }

  for (const node of editor.value.childNodes) visit(node, [])
  model.value = packText(runs)
}

function sync() {
  if (editor.value && document.activeElement !== editor.value) {
    editor.value.innerHTML = textHtml(model.value)
  }
}

function rememberSelection() {
  const selection = window.getSelection()
  if (selection?.rangeCount && editor.value?.contains(selection.getRangeAt(0).commonAncestorContainer)) {
    selectionRange = selection.getRangeAt(0).cloneRange()
  }
}

function focusEditor() {
  if (document.activeElement === editor.value) return
  editor.value?.focus()
  if (selectionRange && editor.value?.contains(selectionRange.commonAncestorContainer)) {
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(selectionRange)
  }
}

function format(command: string) {
  if (props.disabled) return
  focusEditor()
  document.execCommand('styleWithCSS', false, 'false')
  document.execCommand(command)
  readEditor()
}

function indent() {
  if (props.disabled) return
  focusEditor()
  const selection = window.getSelection()
  selection?.collapseToStart()
  document.execCommand('insertText', false, '    ')
  readEditor()
}

function paste(event: ClipboardEvent) {
  const text = event.clipboardData?.getData('text/plain') ?? ''
  document.execCommand('insertText', false, props.multiline ? text : text.replace(/\r?\n/g, ' '))
  readEditor()
}

onMounted(sync)
watch(model, sync)
</script>

<template>
  <div class="rich-field">
    <span :id="id">{{ label }}</span>
    <div class="rich-toolbar" role="group" :aria-label="'Форматирование: ' + label">
      <button
        v-for="button in buttons" :key="button.command" type="button" :disabled="disabled"
        :class="'rich-mark-' + button.mark" :aria-label="button.title" :title="button.title"
        @mousedown.prevent @click="format(button.command)"
      >{{ button.glyph }}</button>
      <button type="button" :disabled="disabled" @mousedown.prevent @click="indent">Отступ</button>
    </div>
    <div
      ref="editor" class="rich-input rich-text" :class="{ 'rich-input-multiline': multiline }"
      role="textbox" :aria-labelledby="id" :aria-multiline="!!multiline" :aria-disabled="!!disabled"
      :contenteditable="!disabled" spellcheck="true" @input="readEditor" @keyup="rememberSelection" @mouseup="rememberSelection" @blur="rememberSelection" @paste.prevent="paste" @drop.prevent
      @keydown.enter="!multiline && $event.preventDefault()"
    ></div>
  </div>
</template>
