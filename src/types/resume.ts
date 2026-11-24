export interface Contact {
  label: string
  value: string
  href: string
}

export interface Field {
  label: string
  value: string
  href?: string
}

export interface ResumeItem {
  text: string
  depth?: number
  achievement?: boolean
  href?: string
}

export interface ResumeEntry {
  id: string
  title?: string
  subtitle?: string
  fields?: Field[]
  paragraphs?: string[]
  items?: ResumeItem[]
}

export interface ResumeSection {
  id: string
  title: string
  entries: ResumeEntry[]
}

export interface Resume {
  profile: {
    name: string
    role: string
    salary: string
    photo: string
    birthDate: string
    contacts: Contact[]
    preferences: Field[]
    tags: string[]
  }
  sections: ResumeSection[]
}

/** Small semantic blocks allow pagination between individual duties and paragraphs. */
export interface DocumentBlock {
  id: string
  kind: 'section' | 'entry' | 'subtitle' | 'field' | 'paragraph' | 'bullet'
  text: string
  label?: string
  href?: string
  depth?: number
  achievement?: boolean
  keepWithNext?: boolean
}

export interface ResumePage {
  blocks: DocumentBlock[]
}
