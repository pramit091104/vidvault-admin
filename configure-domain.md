# Configure previu.online as Primary Domain

## Steps to configure previu.online in Vercel:

1. **Go to Vercel Dashboard**
   - Visit https://vercel.com/dashboard
   - Select your "previu" project

2. **Add Custom Domain**
   - Go to Settings → Domains
   - Click "Add Domain"
   - Enter: `previu.online`
   - Click "Add"

3. **Configure DNS (if needed)**
   - If you control the DNS, add these records:
     - Type: A, Name: @, Value: 76.76.19.61
     - Type: CNAME, Name: www, Value: cname.vercel-dns.com

4. **Set as Primary Domain**
   - Once added, click the three dots next to `previu.online`
   - Select "Set as Primary Domain"

5. **Remove www.previu.online (optional)**
   - If you want to remove the www version, click the three dots next to `www.previu.online`
   - Select "Remove Domain"

## Verify Configuration

After configuration, test:
- https://previu.online should load your app
- https://previu.online/api/signed-url should return 405 Method Not Allowed (correct for GET)

## Alternative: Use Vercel CLI

You can also add the domain via CLI:
```bash
vercel domains add previu.online
vercel domains set-primary previu.online
```