// Place any global data in this file.
// You can import this data from anywhere in your site by using the `import` keyword.

// Site timezone offset in hours (UTC+8 for China Standard Time).
// Used to render dates consistently regardless of build environment timezone.
export const SITE_TZ_OFFSET = 8;

export const USER_NAME = 'W-Mai';
export const NICK_NAME = 'B3n1gn X';
export const AVATAR_URL = `https://avatars.githubusercontent.com/${USER_NAME}`;
export const SITE_TITLE = 'B3n1gn X';
export const SITE_TITLE_FULL = `${SITE_TITLE} — 个人博客 & 技术分享`;
export const SITE_DESCRIPTION = 'B3n1gn X (Benign X) 的个人博客 — 分享编程、图形学、嵌入式开发和开源项目的技术文章与想法';
export const SITE_URL = 'https://benign.host';
export const SITE_DOMAIN = new URL(SITE_URL).hostname;
export const SITE_LANG = 'zh-CN';
export const FAVICON_URL = `https://github.com/${USER_NAME.toLowerCase()}.png`;

// Name variants for SEO — search engines associate these with the site
export const NICK_ALIASES = ['Benign X', 'BenignX', 'Benign'];
export const SEO_KEYWORDS = [NICK_NAME, ...NICK_ALIASES, USER_NAME, SITE_DOMAIN, '个人博客', 'tech blog'];
export const COPYRIGHT = `${NICK_ALIASES[0]}. All rights reserved.`;

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
