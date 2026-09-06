/**
 * Major domain whitelist for URL liveness checks.
 * Domains here are always considered alive and skipped during dead-link probing.
 * Extracted from app.js — pure data.
 */

export const ALIVE_DOMAIN_WHITELIST = new Set([
  // Google
  'google.com','mail.google.com','accounts.google.com','drive.google.com','docs.google.com',
  'sheets.google.com','slides.google.com','photos.google.com','calendar.google.com',
  'contacts.google.com','maps.google.com','meet.google.com','chat.google.com',
  'play.google.com','cloud.google.com','firebase.google.com','analytics.google.com',
  'adsense.google.com','adwords.google.com','search.google.com','translate.google.com',
  'news.google.com','store.google.com','one.google.com','myaccount.google.com',
  // YouTube
  'youtube.com','www.youtube.com','studio.youtube.com','music.youtube.com',
  // Apple
  'apple.com','www.apple.com','icloud.com','www.icloud.com','appleid.apple.com',
  'iforgot.apple.com','account.apple.com','support.apple.com','developer.apple.com',
  'store.apple.com','music.apple.com','tv.apple.com','books.apple.com',
  // Microsoft
  'microsoft.com','www.microsoft.com','login.microsoftonline.com','outlook.live.com',
  'outlook.com','live.com','office.com','onedrive.live.com','teams.microsoft.com',
  'azure.microsoft.com','portal.azure.com','github.com','www.github.com',
  'linkedin.com','www.linkedin.com',
  // Amazon
  'amazon.com','www.amazon.com','amazon.co.jp','amazon.co.uk','amazon.de',
  'amazon.fr','amazon.es','amazon.it','amazon.ca','amazon.com.au',
  'amazon.in','amazon.com.br','amazon.sg','aws.amazon.com','console.aws.amazon.com',
  'signin.aws.amazon.com','prime.amazon.com',
  // Meta / Facebook
  'facebook.com','www.facebook.com','m.facebook.com','messenger.com',
  'instagram.com','www.instagram.com','whatsapp.com','web.whatsapp.com',
  'threads.net','www.threads.net','meta.com','about.meta.com',
  // Twitter / X
  'twitter.com','www.twitter.com','x.com','www.x.com',
  // Netflix / Disney / Streaming
  'netflix.com','www.netflix.com','disneyplus.com','www.disneyplus.com',
  'hulu.com','www.hulu.com','hbomax.com','max.com','peacocktv.com',
  'paramountplus.com','crunchyroll.com','spotify.com','open.spotify.com',
  'account.spotify.com','soundcloud.com','www.soundcloud.com',
  'twitch.tv','www.twitch.tv','bilibili.com','www.bilibili.com',
  // Adobe
  'adobe.com','www.adobe.com','account.adobe.com','creativecloud.adobe.com',
  'behance.net','www.behance.net',
  // Payment / Finance
  'paypal.com','www.paypal.com','stripe.com','dashboard.stripe.com',
  'wise.com','revolut.com','coinbase.com','binance.com','www.binance.com',
  'kraken.com','blockchain.com',
  // Cloud / DevOps
  'netlify.com','app.netlify.com','heroku.com','dashboard.heroku.com',
  'digitalocean.com','cloud.digitalocean.com','linode.com','vultr.com',
  'cloudflare.com','dash.cloudflare.com','workers.dev',
  'supabase.com','app.supabase.com','railway.app','render.com','fly.io',
  // Dev tools
  'stackoverflow.com','gitlab.com','bitbucket.org','npmjs.com','www.npmjs.com',
  'pypi.org','hub.docker.com','figma.com','www.figma.com','notion.so','www.notion.so',
  'slack.com','app.slack.com','discord.com','discord.gg','trello.com',
  'atlassian.com','jira.atlassian.com','confluence.atlassian.com',
  'codepen.io','replit.com','codesandbox.io',
  // China majors
  'baidu.com','www.baidu.com','pan.baidu.com','tieba.baidu.com',
  'taobao.com','www.taobao.com','tmall.com','www.tmall.com',
  'alipay.com','www.alipay.com','aliexpress.com','login.aliexpress.com',
  'jd.com','www.jd.com','pinduoduo.com','meituan.com',
  'weibo.com','www.weibo.com','weixin.qq.com','wx.qq.com',
  'qq.com','mail.qq.com','im.qq.com','cloud.tencent.com',
  'douyin.com','www.douyin.com','tiktok.com','www.tiktok.com',
  'zhihu.com','www.zhihu.com','douban.com','www.douban.com',
  'xiaohongshu.com','www.xiaohongshu.com',
  '163.com','mail.163.com','126.com','mail.126.com',
  'sohu.com','www.sohu.com','sina.com','www.sina.com',
  'ctrip.com','www.ctrip.com','booking.com','www.booking.com',
  'dianping.com','www.dianping.com',
  // E-commerce / Shopping
  'ebay.com','www.ebay.com','etsy.com','www.etsy.com',
  'shopify.com','walmart.com','www.walmart.com','target.com','www.target.com',
  'bestbuy.com','www.bestbuy.com','costco.com','www.costco.com',
  'ikea.com','www.ikea.com','wish.com','www.wish.com',
  // Social / Community
  'reddit.com','www.reddit.com','old.reddit.com','tumblr.com','www.tumblr.com',
  'pinterest.com','www.pinterest.com','quora.com','www.quora.com',
  'medium.com','dev.to','hackernews.com','news.ycombinator.com',
  'telegram.org','web.telegram.org','signal.org',
  // Email
  'protonmail.com','mail.proton.me','zoho.com','mail.zoho.com',
  'tutanota.com','fastmail.com',
  // Education / Reference
  'wikipedia.org','en.wikipedia.org','zh.wikipedia.org',
  'coursera.org','www.coursera.org','udemy.com','www.udemy.com',
  'edx.org','www.edx.org','khanacademy.org',
  // VPS / Hosting
  'dmit.io','bandwagonhost.com','hostinger.com','namecheap.com',
  'godaddy.com','bluehost.com','siteground.com','ovh.com','hetzner.com',
  // Gaming
  'steam.com','store.steampowered.com','steampowered.com',
  'epicgames.com','www.epicgames.com','blizzard.com','battle.net',
  'playstation.com','xbox.com','nintendo.com',
  // Other major
  'dropbox.com','www.dropbox.com','box.com','app.box.com',
  'zoom.us','evernote.com','1password.com','bitwarden.com',
  'lastpass.com','dashlane.com','nordvpn.com','expressvpn.com',
  'canva.com','www.canva.com','grammarly.com','openai.com','chat.openai.com',
  'anthropic.com','claude.ai','deepseek.com',
]);

/** Check if a domain or any of its parent domains is in the whitelist */
export function isDomainWhitelisted(domain) {
  if (ALIVE_DOMAIN_WHITELIST.has(domain)) return true;
  const parts = domain.split('.');
  for (let i = 1; i < parts.length - 1; i++) {
    if (ALIVE_DOMAIN_WHITELIST.has(parts.slice(i).join('.'))) return true;
  }
  return false;
}
