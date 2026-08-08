export interface OutreachContext {
  businessName: string;
  category: string;
  demoUrl: string;
  senderName: string;
  senderCompany: string;
  city?: string;
  phone?: string;
  email?: string;
  /** Link to the client's portal (manage site, request changes) */
  portalUrl?: string;
}

const CATEGORY_HOOK: Record<string, string> = {
  medspa: "med spa clients in your area often can't find a price or book online — they go to whoever has the cleanest website",
  "real-estate-agent": "most home buyers pick the agent whose site actually shows the listings well",
  "real-estate-developer": "developers close more units when buyers can tour the project online first",
  "boutique-hospitality": "guests compare three properties before booking — the one that looks best wins the night",
  "guesthouse-lodge": "travelers browse several lodges before choosing; the first impressive site usually gets the booking",
};

export interface EmailMessage {
  subject: string;
  body: string;
  to: string;
}

export function buildEmailTemplates(ctx: OutreachContext): {
  first: EmailMessage;
  followUps: EmailMessage[];
  breakup: EmailMessage;
} {
  const hook = CATEGORY_HOOK[ctx.category] ?? CATEGORY_HOOK["boutique-hospitality"];
  const cityLine = ctx.city ? ` in ${ctx.city}` : "";
  const portalLine = ctx.portalUrl ? `\n\nYou can also manage your site and request changes anytime here:\n${ctx.portalUrl}\n` : "";

  const first: EmailMessage = {
    subject: `${ctx.businessName}`,
    to: ctx.email ?? "",
    body: `Hi,

I noticed ${ctx.businessName}${cityLine} doesn't have a website yet — and ${hook}.

So I went ahead and built a quick demo for you. You can see it live here:

${ctx.demoUrl}

It's a modern site with your real info, a cinematic homepage, and a booking section ready to go. Nothing to download, no strings attached.${portalLine}
Would it be useful if we made this yours? Happy to explain what's included.

— ${ctx.senderName}
${ctx.senderCompany}`,
  };

  const followUps: EmailMessage[] = [
    {
      subject: `your demo site`,
      to: ctx.email ?? "",
      body: `Hi,

Not sure if you got a chance to look at the demo I sent for ${ctx.businessName}:

${ctx.demoUrl}

It's already live and includes your services${ctx.phone ? `, phone (${ctx.phone})` : ""}, and reviews. If it's not quite right, I can change anything.${ctx.portalUrl ? `\n\nYou can request changes directly here:\n${ctx.portalUrl}\n` : ""}

Would it be helpful to walk you through it? Takes two minutes.

— ${ctx.senderName}`,
    },
    {
      subject: `quick question`,
      to: ctx.email ?? "",
      body: `Hey,

One quick question — did the demo I built for ${ctx.businessName} make sense? It's still live here:

${ctx.demoUrl}

I put it together so you could see what a modern site for your business looks like. If you're not interested, no problem — just say the word and I won't bother you again.

— ${ctx.senderName}`,
    },
  ];

  const breakup: EmailMessage = {
    subject: `closing the loop`,
    to: ctx.email ?? "",
    body: `Hi,

I'll keep this short. I built a demo site for ${ctx.businessName} a few weeks back and I haven't heard from you:

${ctx.demoUrl}

If you ever want a modern website for your business, it's here and ready. I'll leave it live for now and won't email again.

Best,
${ctx.senderName}
${ctx.senderCompany}`,
  };

  return { first, followUps, breakup };
}
