// src/lib/trollbox/blocklist.ts – the words the room does not take, checked at the write.
//
// Copied from caper's trollbox (`caper/src/domains/trollbox/moderation.ts`). It
// filters slurs and sexual abuse, and nothing else: insults, profanity and
// calling a project a rug are a trollbox working as intended. A blocked line is
// never stored, so there is nothing to take down afterwards. It defeats the
// casual dodge (capitals, accents, leetspeak, characters between the letters)
// and not a determined one, which is what flags and the admin's delete are for.

// Written plainly rather than obfuscated: the list is only useful if the next
// person can read it and see what is and is not on it.
const BANNED = [
  // Racial and ethnic slurs
  'nigger', 'nigga', 'chink', 'gook', 'spic', 'wetback', 'kike', 'yid',
  'paki', 'raghead', 'towelhead', 'beaner', 'coon', 'darkie', 'jigaboo',
  'wog', 'abo', 'pikey', 'half-breed',
  // Sexuality and gender slurs
  'faggot', 'fag', 'dyke', 'tranny', 'shemale',
  // Disability slurs
  'retard', 'retarded', 'mongoloid', 'spastic',
  // Misogynistic slurs
  'cunt', 'whore', 'slut',
  // Sexual abuse and exploitation
  'rape', 'raping', 'rapist', 'molest', 'pedo', 'pedophile', 'paedophile',
  'childporn', 'lolicon', 'jailbait',
  // Targeted violence
  'kys', 'kill yourself', 'gas chamber',
] as const;

// Folds the substitutions that happen inside a letter: case, accents and
// leetspeak. What happens between letters is the matcher's job: stripping
// separators here would turn "a mass" into "amass" and take every word boundary with it.
function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[4@]/g, 'a')
    .replace(/3/g, 'e')
    .replace(/[1!|]/g, 'i')
    .replace(/0/g, 'o')
    .replace(/[5$]/g, 's')
    .replace(/7/g, 't');
}

// One matcher per term: its letters in order, up to two non-letters allowed
// between any two of them, an optional plural, and a letter boundary at each
// end. The boundaries are why this is a regex and not a substring scan:
// Scunthorpe, classic, raccoon, spice, Pakistan, grape and therapist are all
// words the list would otherwise eat.
const MATCHERS = BANNED.map(term => new RegExp(
  `(?<!\\p{L})${term.replace(/[^a-z]/g, '').split('').join('[^\\p{L}]{0,2}')}[sz]?(?!\\p{L})`,
  'u',
));

/** The one refusal, so every caller words it the same. */
export const BLOCKED = 'The room filters that word.';

/** False when the text carries something the room does not take. */
export function isPostable(text: string): boolean {
  const folded = fold(text);
  return !MATCHERS.some(m => m.test(folded));
}
