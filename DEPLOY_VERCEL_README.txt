# Huong dan deploy Vercel

Upload TOAN BO noi dung trong folder UPLOAD_GITHUB_VERCEL_READY len GitHub repo.

Khong upload cac folder/file sau:
- node_modules
- .next
- .env.local
- gen-lang-client-*.json
- KHONG_TAI_LEN_GITHUB

Cau hinh Vercel:
- Framework Preset: Next.js
- Root Directory: de trong
- Install Command: de trong hoac npm install
- Neu Vercel npm bi loi, vercel.json da ep dung: npm install --no-package-lock --no-audit --no-fund --legacy-peer-deps
- Build Command: de trong hoac npm run build
- Output Directory: de trong

Neu dashboard can doc Google Sheet, them bien moi truong trong Vercel Project Settings > Environment Variables.

Neu GOOGLE_PRIVATE_KEY bi loi DECODER routines::unsupported:
- Upload lai file lib/google-sheets.ts moi nhat.
- Trong Vercel them GOOGLE_SERVICE_ACCOUNT_JSON_BASE64.
- Gia tri copy tu file local: G:\CODEX\DASHBOARD CHUOI\KHONG_TAI_LEN_GITHUB\VERCEL_GOOGLE_BASE64_COPY.txt
- Code se uu tien bien base64 nay de tranh loi xuong dong private key.
