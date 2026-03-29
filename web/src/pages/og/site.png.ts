import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { NICK_NAME, SITE_DESCRIPTION, SITE_DOMAIN, USER_NAME, PINNED_PROJECTS } from '~/consts';
import { fetchFeaturedProjects } from '~/lib/github';
import { renderToPng, pngResponse } from '~/lib/og-utils';

export const prerender = true;

function nameHue(name: string): number {
  return name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
}

export const GET: APIRoute = async () => {
  const posts = (await getCollection('blog'))
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf())
    .slice(0, 3);

  const featured = await fetchFeaturedProjects(PINNED_PROJECTS.slice(0, 4));

  const projectCard = (proj: typeof featured[number]) => {
    const h = nameHue(proj.name);
    const fallbackBg = `linear-gradient(135deg, hsl(${h},60%,88%), hsl(${(h + 40) % 360},50%,82%))`;
    return {
      type: 'div', props: {
        style: {
          display: 'flex', flexDirection: 'column', width: '195px',
          borderRadius: '21px', overflow: 'hidden',
          boxShadow: '4px 4px 9px rgb(163 177 198 / 0.5), -4px -4px 9px rgb(255 255 255 / 0.4)',
          background: '#e0e5ec',
        },
        children: [
          proj.bannerUrl
            ? { type: 'img', props: { src: proj.bannerUrl, width: 195, height: 78, style: { objectFit: 'cover', display: 'block' } } }
            : { type: 'div', props: { style: { height: '78px', background: fallbackBg, display: 'flex', alignItems: 'center', justifyContent: 'center' },
                children: proj.logoUrl
                  ? [{ type: 'img', props: { src: proj.logoUrl, width: 42, height: 42, style: { borderRadius: '9px' } } }]
                  : [{ type: 'span', props: { style: { fontSize: '36px', color: `hsl(${h},40%,50%)`, opacity: 0.6 }, children: '📦' } }],
              } },
          { type: 'div', props: {
            style: { padding: '9px 15px', fontSize: '20px', fontWeight: 700, color: '#4a5568', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
            children: proj.name,
          } },
        ],
      },
    };
  };

  const element = {
    type: 'div',
    props: {
      style: {
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        fontFamily: 'ArkPixel', position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(145deg, #e3e8ef, #dde2e9)',
      },
      children: [
        // Decorative circles
        { type: 'div', props: { style: { position: 'absolute', top: '-90px', right: '-90px', width: '360px', height: '360px', borderRadius: '50%', background: 'rgb(163 177 198 / 0.2)' } } },
        { type: 'div', props: { style: { position: 'absolute', bottom: '150px', left: '-45px', width: '210px', height: '210px', borderRadius: '50%', background: 'rgb(255 255 255 / 0.25)' } } },

        // Top: Avatar + name
        {
          type: 'div', props: {
            style: { display: 'flex', alignItems: 'center', gap: '30px', padding: '36px 60px 0' },
            children: [
              { type: 'img', props: { src: `https://github.com/${USER_NAME.toLowerCase()}.png`, width: 108, height: 108, style: { borderRadius: '50%', boxShadow: '6px 6px 12px rgb(163 177 198 / 0.6), -6px -6px 12px rgb(255 255 255 / 0.5)' } } },
              {
                type: 'div', props: {
                  style: { display: 'flex', flexDirection: 'column', gap: '3px' },
                  children: [
                    { type: 'span', props: { style: { fontSize: '60px', fontWeight: 700, color: '#2d3748' }, children: NICK_NAME } },
                    { type: 'span', props: { style: { fontSize: '26px', color: '#718096' }, children: `@${USER_NAME} · ${SITE_DOMAIN}` } },
                  ],
                },
              },
            ],
          },
        },
        // Description
        { type: 'div', props: { style: { fontSize: '28px', color: '#4a5568', lineHeight: 1.5, padding: '18px 60px 0' }, children: SITE_DESCRIPTION } },

        // Bottom: stacked — posts then projects
        {
          type: 'div', props: {
            style: { flex: 1, display: 'flex', flexDirection: 'column', padding: '24px 60px 36px', justifyContent: 'flex-end', gap: '20px' },
            children: [
              // Recent posts
              {
                type: 'div', props: {
                  style: { display: 'flex', flexDirection: 'column', gap: '7px' },
                  children: [
                    { type: 'span', props: { style: { fontSize: '22px', color: '#a0aec0', fontWeight: 700, marginBottom: '3px' }, children: '✍️ 近期文章' } },
                    ...posts.map(p => ({
                      type: 'div', props: {
                        style: { display: 'flex', alignItems: 'center', gap: '12px' },
                        children: [
                          { type: 'span', props: { style: { fontSize: '20px', color: '#a0aec0' }, children: '›' } },
                          { type: 'span', props: { style: { fontSize: '24px', color: '#4a5568' }, children: p.data.title } },
                        ],
                      },
                    })),
                  ],
                },
              },
              // Pinned projects
              {
                type: 'div', props: {
                  style: { display: 'flex', flexDirection: 'column', gap: '10px' },
                  children: [
                    { type: 'span', props: { style: { fontSize: '22px', color: '#a0aec0', fontWeight: 700 }, children: '📌 置顶项目' } },
                    {
                      type: 'div', props: {
                        style: { display: 'flex', alignItems: 'center', gap: '18px' },
                        children: featured.map(proj => projectCard(proj)),
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  };

  const png = await renderToPng(element);
  return pngResponse(png);
};
