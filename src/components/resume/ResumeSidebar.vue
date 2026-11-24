<script setup lang="ts">
import { computed } from 'vue'
import { plainText, textHtml } from '../../utils/richText'
import type { Resume } from '../../types/resume'
const props = defineProps<{ profile: Resume['profile'] }>()
const contacts = computed(() => props.profile.contacts.filter(contact => plainText(contact.value).trim()))
const preferences = computed(() => props.profile.preferences.filter(field => plainText(field.value).trim()))
</script>

<template>
  <aside class="resume-sidebar" aria-label="Контакты и условия работы">
    <section v-if="contacts.length" class="sidebar-section">
      <h2>Контакты</h2>
      <div v-for="contact in contacts" :key="contact.label" class="contact">
        <span class="contact-label rich-text" v-html="textHtml(contact.label)"></span>
        <a v-if="contact.href" :href="contact.href" class="rich-text" v-html="textHtml(contact.value)"></a>
        <span v-else class="contact-value rich-text" v-html="textHtml(contact.value)"></span>
      </div>
    </section>
    <section v-for="field in preferences" :key="field.label" class="sidebar-section">
      <h2 class="rich-text" v-html="textHtml(field.label)"></h2>
      <p><a v-if="field.href" :href="field.href" class="rich-text" v-html="textHtml(field.value)"></a><span v-else class="rich-text" v-html="textHtml(field.value)"></span></p>
    </section>
    <section v-if="profile.tags.length" class="sidebar-section">
      <h2>Основной стек</h2>
      <ul class="skill-tags"><li v-for="tag in profile.tags" :key="tag" class="rich-text" v-html="textHtml(tag)"></li></ul>
    </section>
  </aside>
</template>
