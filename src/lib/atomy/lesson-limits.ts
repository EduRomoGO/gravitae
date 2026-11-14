// How much of the lesson the endpoints that call the model accept: the
// chat's snapshot (chat-request.ts) and the reasoning's correction
// (correction-request.ts) send a section with these limits, and the page
// cuts what it sends to them (components/learn/atomy/chat-snapshot.ts).

/** The longest text and title of a section the model reads. */
export const MAX_SECTION_TEXT_CHARS = 6000;
export const MAX_SECTION_TITLE_CHARS = 200;
/** The longest question of the experiment the chat was opened from. */
export const MAX_EXPERIMENT_CHARS = 400;
