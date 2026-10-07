export function normalizedComment(comment, index) {
  const item = {
    ...comment,
    id: comment.id ?? index + 1,
    parent_id: comment.parent_id ?? null,
    title: comment.title || null
  };
  if (
    item.parent_id !== null &&
    (!Number.isSafeInteger(item.parent_id) || item.parent_id < 1 || item.parent_id >= item.id)
  )
    item.parent_id = null;
  let match;
  if (item.moderation?.hidden) {
    item.body =
      'COMMENT HIDDEN BY MODERATION' +
      (item.moderation.reason ? ` · ${item.moderation.reason}` : '');
    item.title = 'MODERATED COMMENT';
    return item;
  }
  if (!item.title && (match = item.body.match(/^\[\[NETA_THREAD:(.*?)\]\]\n?/))) {
    try {
      item.title = decodeURIComponent(match[1]);
      item.body = item.body.slice(match[0].length);
    } catch {
      /* Malformed public markers stay literal text. */
    }
  } else if (item.parent_id === null && (match = item.body.match(/^\[\[NETA_REPLY:(\d+)\]\]\n?/))) {
    item.parent_id = Number(match[1]);
    item.body = item.body.slice(match[0].length);
  }
  if (
    item.parent_id !== null &&
    (!Number.isSafeInteger(item.parent_id) || item.parent_id < 1 || item.parent_id >= item.id)
  )
    item.parent_id = null;
  return item;
}
