/** @type {import('tailwindcss').Config} */
export default {
    content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
    theme: {
        extend: {
            colors: {
                'accent-board': {
                    DEFAULT: '#0d9488',
                    light: '#ccfbf1',
                    dark: '#0f766e',
                },
            },
        },
    },
    plugins: [],
}
