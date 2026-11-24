<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Resume, ResumeDesign } from '../../types/resume'

const props = defineProps<{ profile: Resume['profile']; design?: ResumeDesign }>()
const photoFailed = ref(false)
const photoUrl = (path: string) => /^(data:image\/(png|jpeg|webp);base64,|https?:\/\/)/i.test(path) ? path : `${import.meta.env.BASE_URL}${path}`
watch(() => props.profile.photo, () => { photoFailed.value = false })
</script>

<template>
  <header class="resume-header" :class="{ 'resume-header-with-photo': profile.photo }">
    <p class="resume-eyebrow">Резюме</p>
    <div v-if="profile.photo" class="header-photo-frame">
      <img
        v-if="!photoFailed"
        class="header-photo"
        :src="photoUrl(profile.photo)"
        :alt="profile.name"
        @error="photoFailed = true"
      />
    </div>
    <div class="resume-header-copy">
      <h1>{{ profile.name }}</h1>
      <div class="resume-header-bottom">
        <p>{{ profile.role }}</p>
        <p class="resume-salary">{{ profile.salary }}</p>
      </div>
    </div>
  </header>
</template>
