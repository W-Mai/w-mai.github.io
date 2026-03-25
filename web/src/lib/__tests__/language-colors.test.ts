import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { LANGUAGE_COLORS, getLanguageColor } from '../editor/language-colors'

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{3,8}$/
const DEFAULT_COLOR = '#8b8b8b'
const knownLanguages = Object.keys(LANGUAGE_COLORS)

// Arbitrary: pick a known language name from the LANGUAGE_COLORS map
const arbKnownLanguage = fc.constantFrom(...knownLanguages)

// Arbitrary: generate a random string that is NOT a known language name
const arbUnknownLanguage = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter((s) => !(s in LANGUAGE_COLORS))

describe('Language Color Mapping - Property Tests', () => {
  // Feature: modern-blog-github-showcase, Property 6: Language color mapping consistency
  // Validates: Requirements 2.6
  describe('Property 6: Language color mapping consistency', () => {
    it('known languages return a valid hex color', () => {
      fc.assert(
        fc.property(arbKnownLanguage, (language) => {
          const color = getLanguageColor(language)
          expect(color).toMatch(HEX_COLOR_REGEX)
        }),
        { numRuns: 100 },
      )
    })

    it('unknown languages return the default gray color', () => {
      fc.assert(
        fc.property(arbUnknownLanguage, (language) => {
          const color = getLanguageColor(language)
          expect(color).toBe(DEFAULT_COLOR)
        }),
        { numRuns: 100 },
      )
    })

    it('null input returns the default gray color', () => {
      const color = getLanguageColor(null)
      expect(color).toBe(DEFAULT_COLOR)
    })

    it('all entries in LANGUAGE_COLORS are valid hex colors', () => {
      fc.assert(
        fc.property(arbKnownLanguage, (language) => {
          const color = LANGUAGE_COLORS[language]
          expect(color).toMatch(HEX_COLOR_REGEX)
        }),
        { numRuns: 100 },
      )
    })
  })
})
