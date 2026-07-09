// slack/slackClient.js
// Posts via chat.postMessage with a Bot Token — required for real Block Kit table blocks,
// which a Slack Workflow Builder webhook cannot carry (it only accepts plain-text variable
// substitution). The bot's only scope is chat:write and it only ever posts to the one
// pre-configured #reports channel — it never reads messages, joins channels on its own, or
// replies to anything, so "sender, not a chatbot" still holds even with a real bot token.
import { fetchWithRetry } from "../utils/retry.js";

/**
 * @param {object[]} blocks - Block Kit blocks array
 * @param {string} fallbackText - shown in notifications/accessibility contexts that don't render blocks
 * @param {{SLACK_BOT_TOKEN: string, SLACK_CHANNEL_ID: string}} env
 */
export async function postReport(blocks, fallbackText, env) {
  const res = await fetchWithRetry(
    "https://slack.com/api/chat.postMessage",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${env.SLACK_BOT_TOKEN}`,
      },
      body: JSON.stringify({
        channel: env.SLACK_CHANNEL_ID,
        text: fallbackText,
        blocks,
      }),
    },
    { attempts: 3, baseDelayMs: 750, timeoutMs: 10000 }
  );
  const data = await res.json();
  // Slack's Web API returns HTTP 200 even on failure — the real signal is the "ok" field.
  if (!res.ok || !data.ok) {
    throw new Error(`slack chat.postMessage failed: ${data.error || res.status}`);
  }
}
