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
