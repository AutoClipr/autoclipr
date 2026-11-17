import { baseLayout, h1, p, ctaButton, divider, infoTable, highlight } from './base';

export interface SubscriptionCancelledVars {
  userName: string;
  planName: string;
  cancellationDate: string;
  accessUntil: string;
  appUrl: string;
  supportEmail: string;
}

export interface SubscriptionEndedVars {
  userName: string;
  planName: string;
  endedAt: string;
  appUrl: string;
  supportEmail: string;
}

export interface CancellationFailedVars {
  userName: string;
  planName: string;
  appUrl: string;
  supportEmail: string;
}

function finish(html: string, vars: { appUrl: string; supportEmail: string }): string {
  return html.replace(/\{\{appUrl\}\}/g, vars.appUrl).replace(/\{\{supportEmail\}\}/g, vars.supportEmail);
}

/** Sent once Dodo confirms the cancellation is scheduled for period end. */
export function subscriptionCancelledTemplate(vars: SubscriptionCancelledVars) {
  const subject = 'Your AutoClipr Subscription Has Been Cancelled';
  const html = finish(
    baseLayout(
      `
    ${h1(`Hi ${highlight(vars.userName)},`)}
    ${p('Your AutoClipr subscription cancellation has been successfully scheduled.')}
    ${infoTable([
      ['Plan', vars.planName],
      ['Cancellation date', vars.cancellationDate],
      ['Current access until', vars.accessUntil],
      ['Next billing date', 'No further recurring payment is scheduled.'],
    ])}
    ${p('You can continue enjoying your premium AutoClipr features until your current billing period expires.')}
    ${ctaButton('Manage subscription →', `${vars.appUrl}/subscription`)}
    ${divider()}
    ${p('Thank you for being part of AutoClipr!<br/><br/>Best regards,<br/>AutoClipr Team<br/><a href="https://autoclipr.com" style="color:#10b981;">https://autoclipr.com</a>', true)}
    `,
      `Your ${vars.planName} plan stays active until ${vars.accessUntil}.`,
    ),
    vars,
  );
  const text = `Hi ${vars.userName},

Your AutoClipr subscription cancellation has been successfully scheduled.

Here are your subscription details:

- Plan: ${vars.planName}
- Cancellation Date: ${vars.cancellationDate}
- Current Access Until: ${vars.accessUntil}
- Next Billing Date: No further recurring payment is scheduled.

You can continue enjoying your premium AutoClipr features until your current billing period expires.

Thank you for being part of AutoClipr!

Best regards,
AutoClipr Team
https://autoclipr.com`;
  return { subject, html, text };
}

/** Sent when the paid period is actually over. */
export function subscriptionEndedTemplate(vars: SubscriptionEndedVars) {
  const subject = 'Your AutoClipr Subscription Has Ended';
  const html = finish(
    baseLayout(
      `
    ${h1(`Hi ${highlight(vars.userName)},`)}
    ${p(`Your ${highlight(vars.planName)} subscription ended on ${vars.endedAt}. Your account is now on the free Starter plan.`)}
    ${p('Whenever you are ready, you can pick a new plan and pick up right where you left off.')}
    ${ctaButton('Choose a plan →', `${vars.appUrl}/pricing`)}
    ${divider()}
    ${p('Thank you for being part of AutoClipr!<br/><br/>Best regards,<br/>AutoClipr Team', true)}
    `,
      `Your ${vars.planName} subscription has ended.`,
    ),
    vars,
  );
  const text = `Hi ${vars.userName},

Your ${vars.planName} subscription ended on ${vars.endedAt}. Your account is now on the free Starter plan.

Whenever you are ready, you can choose a new plan: ${vars.appUrl}/pricing

Best regards,
AutoClipr Team`;
  return { subject, html, text };
}

/** Sent when Dodo rejected the cancellation request. */
export function cancellationFailedTemplate(vars: CancellationFailedVars) {
  const subject = 'We Could Not Cancel Your AutoClipr Subscription';
  const html = finish(
    baseLayout(
      `
    ${h1(`Hi ${highlight(vars.userName)},`)}
    ${p(`Your request to cancel your ${highlight(vars.planName)} subscription was unsuccessful, so your subscription may still be active and renew as usual.`)}
    ${p('Please try again from your subscription page. If it keeps failing, email <a href="mailto:{{supportEmail}}" style="color:#10b981;">{{supportEmail}}</a> and we will cancel it for you.')}
    ${ctaButton('Try again →', `${vars.appUrl}/subscription`)}
    `,
      'Your cancellation request did not go through.',
    ),
    vars,
  );
  const text = `Hi ${vars.userName},

Your request to cancel your ${vars.planName} subscription was unsuccessful, so your subscription may still be active and renew as usual.

Please try again: ${vars.appUrl}/subscription
If it keeps failing, email ${vars.supportEmail} and we will cancel it for you.

— AutoClipr Team`;
  return { subject, html, text };
}
