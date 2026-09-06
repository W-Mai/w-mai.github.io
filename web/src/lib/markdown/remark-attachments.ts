import type { Link, Paragraph, Parent, PhrasingContent, Root, RootContent } from 'mdast';
import type { Processor } from 'unified';
import type { VFile } from 'vfile';
import { visit } from 'unist-util-visit';
import { resolveAttachment } from '../attachments/files';
import { formatAttachmentSize } from '../attachments/paths';
import type { AttachmentInfo, AttachmentOptions } from '../attachments/paths';
import { loadAttachmentPreview } from '../attachments/preview';
import type { AttachmentPreview, AttachmentPreviewKind } from '../attachments/preview';
import { normalizeAttachmentSyntax, remarkAttachmentSyntax } from '../attachments/syntax';
import { attachmentActionIconPaths } from '../attachments/action-icons';
import type { AttachmentActionIcon } from '../attachments/action-icons';

export interface RemarkAttachmentOptions extends AttachmentOptions {
  /** Use the configured public site for exported documents. */
  absoluteUrls?: boolean;
  /** Interactive site cards or portable links for external editors. */
  output?: 'site' | 'portable';
}

type ElementProperties = Record<string, string | number | boolean | string[]>;

function element(
  tagName: string,
  className: string | undefined,
  children: RootContent[] = [],
  properties: ElementProperties = {},
): Paragraph {
  return {
    type: 'paragraph',
    children: children as PhrasingContent[],
    data: {
      hName: tagName,
      hProperties: {
        ...(className ? { className: className.split(' ') } : {}),
        ...properties,
      },
    },
  };
}

function text(value: string): RootContent {
  return { type: 'text', value };
}

function actionIcon(icon: AttachmentActionIcon): RootContent {
  return element('svg', 'attachment-card__icon', attachmentActionIconPaths[icon].map((d) => (
    element('path', undefined, [], { d })
  )), {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
    focusable: 'false',
  });
}

function iconFor(kind: AttachmentPreviewKind): string {
  switch (kind) {
    case 'image': return '图片';
    case 'json': return 'JSON';
    case 'table': return '表格';
    case 'pdf': return 'PDF';
    case 'audio': return '音频';
    case 'video': return '视频';
    case 'text': return '文本';
    default: return '文件';
  }
}

function downloadLink(attachment: AttachmentInfo, url: string, compact = false): Link {
  return {
    type: 'link',
    url,
    title: `下载 ${attachment.name}`,
    children: [compact
      ? actionIcon('download') as PhrasingContent
      : text(attachment.name) as PhrasingContent],
    data: {
      hProperties: {
        className: compact
          ? ['attachment-card__button', 'attachment-card__download']
          : ['attachment-inline'],
        download: attachment.name,
        type: attachment.mediaType,
        'aria-label': `下载 ${attachment.name}`,
        'data-attachment': attachment.id,
      },
    },
  };
}

function previewContent(attachment: AttachmentInfo, preview: AttachmentPreview, url: string): RootContent {
  if (preview.kind === 'image') {
    return {
      type: 'image',
      url,
      alt: attachment.name,
      title: attachment.name,
      data: { hProperties: { loading: 'lazy', decoding: 'async' } },
    };
  }
  if (preview.kind === 'pdf') {
    return element('attachment-pdf-preview', 'attachment-card__pdf', [
      element('div', 'attachment-card__placeholder', [
        element('strong', undefined, [text('PDF')]),
        element('span', undefined, [text('进入可视区域后加载预览')]),
      ]),
    ], {
      role: 'region',
      'aria-label': `${attachment.name} — PDF 预览`,
      'data-attachment-pdf-src': url,
      'data-attachment-pdf-name': attachment.name,
      'data-attachment-pdf-size': attachment.size,
    });
  }
  if (preview.kind === 'audio' || preview.kind === 'video') {
    return element(preview.kind, `attachment-card__${preview.kind}`, [
      element('a', undefined, [text(`下载 ${attachment.name}`)], { href: url, download: attachment.name }),
    ], {
      src: url, controls: true, preload: 'metadata',
      'aria-label': `${attachment.name} — ${iconFor(preview.kind)}预览`,
      ...(preview.kind === 'video' ? { playsInline: true } : {}),
    });
  }
  if (preview.kind === 'table' && preview.rows?.length) {
    const [head, ...body] = preview.rows;
    return element('table', 'attachment-card__table', [
      element('thead', undefined, [
        element('tr', undefined, head.map((cell) => element('th', undefined, [text(cell)], { scope: 'col' }))),
      ]),
      element('tbody', undefined, body.map((row) => element('tr', undefined,
        row.map((cell) => element('td', undefined, [text(cell)])),
      ))),
    ], { 'aria-label': `${attachment.name} — 数据预览` });
  }
  if ((preview.kind === 'text' || preview.kind === 'json') && preview.text !== undefined) {
    return element('pre', 'attachment-card__text', [
      element('code', preview.language ? `language-${preview.language}` : undefined, [text(preview.text)]),
    ]);
  }
  return element('div', 'attachment-card__placeholder', [
    element('strong', undefined, [text(iconFor(preview.kind))]),
    element('span', undefined, [text(preview.kind === 'table'
      ? '文件没有可预览的数据' : '此文件类型不提供站内内容预览')]),
  ]);
}

function card(
  attachment: AttachmentInfo,
  preview: AttachmentPreview,
  url: string,
  metadata: string,
): RootContent {
  const status = preview.truncated
    ? '预览已截断，下载可查看完整文件'
    : preview.kind === 'binary'
      ? '文件保持原始字节，可直接下载'
      : '';
  const children: RootContent[] = [
    element('header', 'attachment-card__header', [
      element('div', 'attachment-card__identity', [
        element('strong', 'attachment-card__name', [text(attachment.name)], { title: attachment.name }),
        element('div', 'attachment-card__meta', [text(metadata)]),
      ]),
      element('div', 'attachment-card__actions', [
        downloadLink(attachment, url, true),
        element('button', 'attachment-card__button', [actionIcon('fullscreen')], {
          type: 'button',
          hidden: true,
          'data-attachment-fullscreen': '',
          'aria-label': `全屏预览 ${attachment.name}`,
          'aria-haspopup': 'dialog',
        }),
      ]),
    ]),
    element('div', `attachment-card__preview attachment-card__preview--${preview.kind}`, [
      previewContent(attachment, preview, url),
    ], ['text', 'json', 'table'].includes(preview.kind) ? {
      tabIndex: 0, role: 'region', 'aria-label': `${attachment.name} — 内容预览`,
    } : {}),
  ];
  if (status) children.push(element('figcaption', 'attachment-card__status', [text(status)]));
  return element('figure', 'attachment-card not-prose', children, {
    'aria-label': `${attachment.name} — 附件预览`,
    'data-attachment-card': '',
    'data-attachment': attachment.id,
    'data-attachment-name': attachment.name,
    'data-attachment-media': attachment.mediaType,
  }) as RootContent;
}

function legacyError(file: VFile, node: { position?: Link['position'] }): never {
  file.fail(
    'Legacy attachment links are not supported. Use :attachment[id]: or ::attachment[id]::.',
    node.position,
    'attachment-syntax:legacy-link',
  );
}

/** Resolve the shared attachment DSL through the publication catalog. */
export default function remarkAttachments(this: Processor, options: RemarkAttachmentOptions) {
  this.use(remarkAttachmentSyntax);
  return async (tree: Root, file: VFile) => {
    normalizeAttachmentSyntax(tree, file);

    const definitions = new Map<string, string>();
    visit(tree, 'definition', (node) => {
      if (!definitions.has(node.identifier.toUpperCase())) {
        definitions.set(node.identifier.toUpperCase(), node.url);
      }
    });
    visit(tree, 'linkReference', (node) => {
      if (definitions.get(node.identifier.toUpperCase())?.startsWith('attachment:')) legacyError(file, node);
    });
    visit(tree, 'imageReference', (node) => {
      if (definitions.get(node.identifier.toUpperCase())?.startsWith('attachment:')) legacyError(file, node);
    });
    visit(tree, 'image', (node) => {
      if (node.url.startsWith('attachment:')) legacyError(file, node);
    });
    visit(tree, 'link', (node) => {
      if (node.url.startsWith('attachment:') && !node.data?.attachmentDisplay) legacyError(file, node);
    });

    const inline: Link[] = [];
    const blocks: Array<{ node: Link; index: number; parent: Parent }> = [];
    const blockLinks = new Set<Link>();
    visit(tree, 'paragraph', (paragraph, index, parent) => {
      if (!parent || index == null) return;
      const link = paragraph.children.find((child): child is Link =>
        child.type === 'link' && child.data?.attachmentDisplay === 'block',
      );
      if (link) {
        blocks.push({ node: link, index, parent });
        blockLinks.add(link);
      }
    });
    visit(tree, 'link', (node) => {
      if (node.data?.attachmentDisplay === 'inline' && !blockLinks.has(node)) inline.push(node);
    });

    const resolved = new Map<string, Promise<AttachmentInfo>>();
    const resolve = (reference: string) => {
      let pending = resolved.get(reference);
      if (!pending) {
        pending = resolveAttachment(reference, options);
        resolved.set(reference, pending);
      }
      return pending;
    };
    const urlFor = (attachment: AttachmentInfo) => {
      if (options.absoluteUrls && !options.site) {
        throw new Error('A public site URL is required to export attachments.');
      }
      return options.absoluteUrls ? new URL(attachment.url, options.site).href : attachment.url;
    };

    for (const node of inline) {
      const reference = node.url;
      try {
        const attachment = await resolve(reference);
        const url = urlFor(attachment);
        const metadata = `${attachment.mediaType} · ${formatAttachmentSize(attachment.size)}`;
        node.url = url;
        node.title = `${attachment.name} · ${metadata}`;
        node.children = [text(`${attachment.name} · ${metadata}`) as PhrasingContent];
        node.data = {
          ...node.data,
          hProperties: {
            className: options.output === 'portable' ? ['attachment-portable'] : ['attachment-inline'],
            download: attachment.name,
            type: attachment.mediaType,
            'data-attachment': attachment.id,
          },
        };
      } catch (error) {
        file.fail(`Cannot resolve ${reference}: ${error instanceof Error ? error.message : String(error)}`, node);
      }
    }

    for (const occurrence of blocks) {
      const reference = occurrence.node.url;
      try {
        const attachment = await resolve(reference);
        const url = urlFor(attachment);
        const metadata = `${attachment.mediaType} · ${formatAttachmentSize(attachment.size)}`;
        if (options.output === 'portable') {
          occurrence.node.url = url;
          occurrence.node.title = `${attachment.name} · ${metadata}`;
          occurrence.node.children = [text(`${attachment.name} · ${metadata}`) as PhrasingContent];
          occurrence.node.data = {
            ...occurrence.node.data,
            hProperties: {
              className: ['attachment-portable'],
              download: attachment.name,
              type: attachment.mediaType,
              'data-attachment': attachment.id,
            },
          };
        } else {
          const preview = await loadAttachmentPreview(attachment, options);
          occurrence.parent.children[occurrence.index] = card(attachment, preview, url, metadata);
        }
      } catch (error) {
        file.fail(`Cannot resolve ${reference}: ${error instanceof Error ? error.message : String(error)}`, occurrence.node);
      }
    }
  };
}
