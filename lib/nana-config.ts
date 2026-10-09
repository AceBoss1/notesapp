// Is Nana AI switched on? It needs an Anthropic API key in ANTHROPIC_API_KEY. The chat button only appears when it is set.
export const nanaConfigured = () => !!(process.env.ANTHROPIC_API_KEY || "").trim();
