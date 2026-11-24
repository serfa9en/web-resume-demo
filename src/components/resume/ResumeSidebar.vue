<script setup lang="ts">
import { ref } from 'vue'
import type { Resume } from '../../types/resume'
defineProps<{ profile: Resume['profile'] }>()
const photoFailed = ref(false)
const photoUrl = (path: string) => `${import.meta.env.BASE_URL}${path}`
</script>

<template>
  <aside class="resume-sidebar" aria-label="Контакты и условия работы">
    <img v-if="!photoFailed && profile.photo" class="resume-photo" :src="photoUrl(profile.photo)"
      :alt="profile.name" width="170" height="190" @error="photoFailed = true" />
    <div v-else class="photo-placeholder" aria-hidden="true">МБ</div>
    <section class="sidebar-section">
      <h2>Контакты</h2>
      <div v-for="contact in profile.contacts" :key="contact.label" class="contact">
        <span class="contact-label">{{ contact.label }}</span>
        <a :href="contact.href">{{ contact.value }}</a>
      </div>
    </section>
    <section v-for="field in profile.preferences" :key="field.label" class="sidebar-section">
      <h2>{{ field.label }}</h2>
      <p>{{ field.value }}</p>
    </section>
    <section class="sidebar-section">
      <h2>Основной стек</h2>
      <ul class="skill-tags"><li v-for="tag in profile.tags" :key="tag">{{ tag }}</li></ul>
    </section>
  </aside>
</template>
