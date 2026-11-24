import type { Resume, ResumeEntry, ResumeSource } from '../types/resume'

export const MAIN_RESUME_ID = 'main'
export const defaultSources: ResumeSource[] = [
  { id: MAIN_RESUME_ID, title: 'Основное резюме' },
  { id: 'template-2', title: 'Резюме 2' },
  { id: 'template-3', title: 'Резюме 3' },
]

export function blankJob(id: string): ResumeEntry {
  return { id, title: '', position: '', period: '', description: '' }
}

function fields(labels: string[]) {
  return labels.map(label => ({ label, value: '' }))
}

export function blankResume(): Resume {
  return {
    profile: {
      name: '', role: '', salary: '', photo: '', birthDate: '',
      contacts: ['Телефон', 'Почта', 'Telegram', 'GitHub'].map(label => ({ label, value: '', href: '' })),
      preferences: fields(['Тип занятости', 'Формат работы', 'Командировки', 'Переезд', 'Английский язык']),
      tags: [],
    },
    sections: [
      { id: 'personal', title: 'Личная информация', entries: [
        { id: 'personal-info', fields: fields(['Гражданство', 'Место проживания', 'Образование', 'Дата рождения', 'Пол']) },
      ] },
      { id: 'experience', title: 'Опыт работы', entries: [blankJob('job-1')] },
      { id: 'education', title: 'Образование', entries: [
        { id: 'education-1', title: '', fields: fields(['Год окончания', 'Факультет', 'Специальность', 'Форма обучения']) },
      ] },
      { id: 'section-3', title: 'Hard Skills', entries: [], text: '' },
      { id: 'section-4', title: 'Soft Skills', entries: [], text: '' },
      { id: 'section-5', title: 'Курсы и тренинги', entries: [] },
      { id: 'section-6', title: 'О себе', entries: [], text: '' },
    ],
  }
}
