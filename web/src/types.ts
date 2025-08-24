import type { MarkdownHeading } from 'astro'
import type { BundledShikiTheme } from 'astro-expressive-code'
import type { CollectionEntry, DataEntryMap } from 'astro:content'

export type WeekdayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 // 0 = Sunday, 1 = Monday etc.

export type GitHubActivityDay = {
    date: string
    count: number
    level: 0 | 1 | 2 | 3 | 4
}

export type GitHubActivityWeek = Array<GitHubActivityDay | undefined>

export type GitHubActivityApiResponse = {
    total: {
        [year: number]: number
        [year: string]: number // 'lastYear;
    }
    contributions: Array<GitHubActivityDay>
    error?: string
}

export type GitHubActivityMonthLabel = {
    weekIndex: number
    label: string
}
