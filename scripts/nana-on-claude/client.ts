// What the Nana on Claude page takes from the app's own code, bundled into the page by build.ts: the article search and picking, the
// link check, the reply tags and the copy-file check. Changing any of these in lib/ changes the page at its next build.
export { pickArticles, knowledgeBlock, knownPaths } from "../../lib/nana-prompt";
export { sanitizeLinks, searchArticles, queryWords, countMatches, articlePath } from "../../lib/kb";
export { parseReply, NANA_USER_MAX, NANA_HISTORY_MAX } from "../../lib/nana";
export { readCopy, copyGaps, copyHashes, COPY_BYTES_MAX } from "../../lib/nana-claude";
