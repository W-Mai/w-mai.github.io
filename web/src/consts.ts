// Place any global data in this file.
// You can import this data from anywhere in your site by using the `import` keyword.

// Site timezone offset in hours (UTC+8 for China Standard Time).
// Used to render dates consistently regardless of build environment timezone.
export const SITE_TZ_OFFSET = 8;

export const USER_NAME = 'W-Mai';
export const NICK_NAME = 'B3n1gn X';
export const SITE_TITLE = 'B3n1gn X';
export const SITE_DESCRIPTION = 'B3n1gn X | Personal Website';
export const SITE_URL = 'https://benign.host';

// Pinned projects displayed as featured cards on homepage
// Format: 'owner/repo' or just 'repo' (defaults to USER_NAME as owner)
export const PINNED_PROJECTS = [
    'icu',
    'vegravis',
    'uinspy',
    'filmr',
    'xSticker',
    'git_rnd_name',
    'BuZhiYin',
    'macmemana',
];

// Google Analytics 4 Measurement ID (replace with your actual ID)
export const GA4_MEASUREMENT_ID = 'G-J49CNGTJGN';

// Giscus discussion comment system
export const GISCUS_REPO = 'W-Mai/w-mai.github.io' as const;
export const GISCUS_REPO_ID = 'R_kgDOPiz_Tg';
export const GISCUS_BLOG_CATEGORY = 'Blog Comments';
export const GISCUS_BLOG_CATEGORY_ID = 'DIC_kwDOPiz_Ts4C3_Qs';
export const GISCUS_THOUGHT_CATEGORY = 'Thought Comments';
export const GISCUS_THOUGHT_CATEGORY_ID = 'DIC_kwDOPiz_Ts4C5BnR';

export const SOCIALS = [
    {
        name: 'GitHub',
        url: 'https://github.com/w-mai',
        description: 'GitHub Homepage',
        icon: '/social/github.svg',
    },
    {
        name: 'Twitter',
        url: 'https://twitter.com/_w_mai_',
        description: 'Twitter Homepage',
        icon: '/social/twitter.svg'
    },
    {
        name: 'LinkedIn',
        url: 'https://www.linkedin.com/in/b3n1gnx/',
        description: 'LinkedIn Homepage',
        icon: '/social/linkedin.svg'
    },
];
