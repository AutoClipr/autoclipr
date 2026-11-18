import { baseLayout, h1, p, ctaButton, infoTable, highlight } from './base';

export interface PostPublishedVars {
  userName: string;
  caption: string;
  platform: string;
  publishedAt: string;
  postUrl: string | null;
  appUrl: string;
  supportEmail: string;
}

export interface PostFailedVars {
  userName: string;
  caption: string;
  platform: string;
  reason: string;
  appUrl: string;
  supportEmail: string;
}

function finish(html: string, vars: { appUrl: string; supportEmail: string }): string {
  return html.replace(/\{\{appUrl\}\}/g, vars.appUrl).replace(/\{\{supportEmail\}\}/g, vars.supportEmail);
}

function short(text: string): string {
  const t = text.trim() || '(no caption)';
  return t.length > 120 ? `${t.slice(0, 117)}…` : t;
}

function escape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function postPublishedTemplate(vars: PostPublishedVars) {
  const subject = 'Your AutoClipr Post Was Published!';
  const html = finish(
    baseLayout(
      `
    ${h1(`Your post is live, ${highlight(vars.userName)}`)}
    ${p(`Your scheduled post was published to ${highlight(vars.platform)}.`)}
    ${infoTable([
      ['Post', escape(short(vars.caption))],
      ['Platform', vars.platform],
      ['Published', vars.publishedAt],
    ])}
    ${vars.postUrl ? ctaButton('View post →', vars.postUrl) : ctaButton('Open scheduler →', `${vars.appUrl}/scheduler`)}
    `,
      `Your post is live on ${vars.platform}.`,
    ),
    vars,
  );
  const text = `Hi ${vars.userName},

Your scheduled post was published to ${vars.platform}.

Post: ${short(vars.caption)}
Published: ${vars.publishedAt}
${vars.postUrl ? `View it: ${vars.postUrl}` : `Scheduler: ${vars.appUrl}/scheduler`}

— AutoClipr Team`;
  return { subject, html, text };
}

export function postFailedTemplate(vars: PostFailedVars) {
  const subject = 'Your AutoClipr Post Could Not Be Published';
  const html = finish(
    baseLayout(
      `
    ${h1(`We couldn't publish your post, ${highlight(vars.userName)}`)}
    ${p(`Your scheduled post could not be published to ${highlight(vars.platform)}.`)}
    ${infoTable([
      ['Post', escape(short(vars.caption))],
      ['Platform', vars.platform],
      ['Reason', escape(vars.reason)],
    ])}
    ${p('Fix the issue (for example, reconnect the account in Settings → Platforms), then retry from the scheduler. Other platforms on this post are not affected.')}
    ${ctaButton('Open scheduler →', `${vars.appUrl}/scheduler`)}
    `,
      `Your post could not be published to ${vars.platform}.`,
    ),
    vars,
  );
  const text = `Hi ${vars.userName},

Your scheduled post could not be published to ${vars.platform}.

Post: ${short(vars.caption)}
Reason: ${vars.reason}

Fix the issue, then retry from the scheduler: ${vars.appUrl}/scheduler

— AutoClipr Team`;
  return { subject, html, text };
}
