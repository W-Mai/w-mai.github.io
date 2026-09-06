export type AttachmentActionIcon = 'close' | 'download' | 'fullscreen';

/** Shared SVG paths for attachment action controls rendered on the server and in the browser. */
export const attachmentActionIconPaths: Readonly<Record<AttachmentActionIcon, readonly string[]>> = {
  close: [
    'M18 6 6 18',
    'M6 6l12 12',
  ],
  download: [
    'M12 3v12',
    'm7 10 5 5 5-5',
    'M5 15v4h14v-4',
  ],
  fullscreen: [
    'M8 3H3v5',
    'M16 3h5v5',
    'M8 21H3v-5',
    'M16 21h5v-5',
  ],
};
