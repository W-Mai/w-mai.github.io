import type { Definition, Link, Root } from 'mdast';
import type { VFile } from 'vfile';
import { visit } from 'unist-util-visit';
import { resolveAttachment } from '../attachments/files';
import { formatAttachmentSize, parseAttachmentReference } from '../attachments/paths';
import type { AttachmentInfo, AttachmentOptions } from '../attachments/paths';

export interface RemarkAttachmentOptions extends AttachmentOptions {
  /** Use the configured public site for exported documents. */
  absoluteUrls?: boolean;
}

/** Resolve Markdown attachment links through the same catalog used for publication. */
export default function remarkAttachments(options: RemarkAttachmentOptions) {
  return async (tree: Root, file: VFile) => {
    const definitions = new Map<string, Definition>();
    visit(tree, 'definition', (node) => {
      const key = node.identifier.toUpperCase();
      if (!definitions.has(key)) definitions.set(key, node);
    });

    // Convert reference-style links before applying the shared link transformation.
    visit(tree, 'linkReference', (node, index, parent) => {
      const definition = definitions.get(node.identifier.toUpperCase());
      if (!definition?.url.startsWith('attachment:') || !parent || index == null) return;
      parent.children[index] = {
        type: 'link',
        url: definition.url,
        title: definition.title,
        children: node.children,
        position: node.position,
        data: node.data,
      } as Link;
    });

    const links: Link[] = [];
    visit(tree, 'link', (node) => {
      if (node.url.startsWith('attachment:')) links.push(node);
    });
    visit(tree, 'image', (node) => {
      if (node.url.startsWith('attachment:')) {
        file.fail('Attachments require a Markdown link, not image syntax.', node);
      }
    });
    visit(tree, 'imageReference', (node) => {
      if (definitions.get(node.identifier.toUpperCase())?.url.startsWith('attachment:')) {
        file.fail('Attachments require a Markdown link, not image syntax.', node);
      }
    });

    const resolved = new Map<string, Promise<AttachmentInfo>>();
    for (const node of links) {
      const reference = node.url;
      try {
        parseAttachmentReference(reference);
        let pending = resolved.get(reference);
        if (!pending) {
          pending = resolveAttachment(reference, options);
          resolved.set(reference, pending);
        }
        const attachment = await pending;
        if (options.absoluteUrls && !options.site) {
          throw new Error('A public site URL is required to export attachments.');
        }
        node.url = options.absoluteUrls
          ? new URL(attachment.url, options.site).href
          : attachment.url;
        const metadata = `${attachment.name} · ${attachment.mediaType} · ${formatAttachmentSize(attachment.size)}`;
        node.title = node.title ? `${node.title} — ${metadata}` : metadata;
        node.data = {
          ...node.data,
          hProperties: {
            ...node.data?.hProperties,
            download: attachment.name,
            'data-attachment': attachment.id,
            type: attachment.mediaType,
          },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        file.fail(`Cannot resolve ${reference}: ${message}`, node);
      }
    }
  };
}
