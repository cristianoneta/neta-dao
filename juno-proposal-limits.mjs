// The shared workshop counts Unicode characters; native text is budgeted in
// UTF-8 bytes. These are distinct from serialized transaction size and gas.
export const REVIEW_LIMITS = Object.freeze({
  title: 100,
  summary: 300,
  body: 10000,
  actions_json: 20000
});
export const NATIVE_TEXT_BYTES = 10000;
export function assertReviewLimits(values) {
  for (const [field, max] of Object.entries(REVIEW_LIMITS)) {
    if (typeof values[field] !== 'string' || [...values[field].trim()].length > max)
      throw Error(`${field.toUpperCase()} EXCEEDS THE SHARED REVIEW LIMIT OF ${max} CHARACTERS`);
  }
}
export function assertNativeText(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > NATIVE_TEXT_BYTES)
    throw Error(
      'On-chain proposal text exceeds 10,000 bytes. Shorten the text or prepare a smaller frozen comparison; do not remove its data.'
    );
}

export function reviewSizeReport(values) {
  const fields = Object.entries(REVIEW_LIMITS).map(([field, limit]) => {
    const text = typeof values?.[field] === 'string' ? values[field].trim() : '';
    const used = [...text].length;
    return {
      field,
      used,
      limit,
      remaining: limit - used,
      state: used > limit ? 'blocked' : used >= limit * 0.8 ? 'near-limit' : 'ready'
    };
  });
  const state = fields.some((f) => f.state === 'blocked')
    ? 'blocked'
    : fields.some((f) => f.state === 'near-limit')
      ? 'near-limit'
      : 'ready';
  return { fields, state };
}
export function reviewSizeText(values) {
  const report = reviewSizeReport(values);
  const count = (n) => n.toLocaleString('en-US');
  const body = report.fields.find((f) => f.field === 'body'),
    actions = report.fields.find((f) => f.field === 'actions_json');
  return (
    `Review storage: text ${count(body.used)} / ${count(body.limit)} characters; actions ${count(actions.used)} / ${count(actions.limit)}.` +
    (report.state === 'blocked'
      ? ' Too large to publish; all evidence has been retained.'
      : report.state === 'near-limit'
        ? ' Limited room for additional evidence.'
        : ' Within the current review limits.') +
    ' Native transaction size and gas are checked separately before signing.'
  );
}
