import { getBrandLogoUrl } from "@/lib/site";

export function baseLayout(params: {
  preheader: string;
  body: string;
  footerExtra?: string;
}): string {
  const year = new Date().getFullYear();
  const logoUrl = getBrandLogoUrl();
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>NyumbaSearch</title>
<style>
  body { margin:0; padding:0; background:#f1f5f2; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; }
  .wrapper { max-width:600px; margin:32px auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08); }
  .header { background:#0A5C47; padding:24px 40px; }
  .logo-img { display:block; height:48px; width:48px; object-fit:contain; }
  .body { padding:36px 40px; }
  .footer { background:#f8faf9; padding:24px 40px; font-size:12px; color:#8ab5a0; border-top:1px solid #e2ece8; }
  .btn { display:inline-block; padding:14px 28px; background:#1EB88A; color:#ffffff !important; text-decoration:none; border-radius:10px; font-weight:600; font-size:15px; }
  h1 { color:#1a2e25; font-size:24px; margin:0 0 12px; }
  p { color:#334155; font-size:15px; line-height:1.7; margin:0 0 16px; }
  .highlight { background:#e8f5f0; border-left:4px solid #1EB88A; padding:16px 20px; border-radius:0 8px 8px 0; margin:20px 0; }
  .stat { display:inline-block; background:#0A5C47; color:#fff; padding:8px 16px; border-radius:8px; font-size:22px; font-weight:700; margin:4px; }
  a { color:#1EB88A; }
</style>
</head>
<body>
<div style="display:none;max-height:0;overflow:hidden;">${params.preheader}</div>
<div class="wrapper">
  <div class="header"><div style="display:inline-block;background:#ffffff;padding:6px 10px;border-radius:10px;"><img class="logo-img" src="${logoUrl}" alt="NyumbaSearch" width="48" height="48" /></div></div>
  <div class="body">${params.body}</div>
  <div class="footer">
    <p style="margin:0">© ${year} NyumbaSearch · Nairobi, Kenya</p>
    ${params.footerExtra ?? ""}
  </div>
</div>
</body>
</html>`;
}
