import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

(async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext({
        viewport: { width: 1200, height: 630 },
        colorScheme: 'dark'
    });
    const page = await context.newPage();
    console.log('Navigating to https://mstr-mnd.vercel.app/ ...');
    await page.goto('https://mstr-mnd.vercel.app/', { waitUntil: 'networkidle' });

    // Wait a bit for any initial animations to finish
    await page.waitForTimeout(3000);

    const publicImagesDir = path.resolve('public/images');
    if (!fs.existsSync(publicImagesDir)) {
        fs.mkdirSync(publicImagesDir, { recursive: true });
    }

    const imagePath = path.join(publicImagesDir, 'og-image.jpg');
    console.log(`Saving screenshot to ${imagePath}...`);
    await page.screenshot({ path: imagePath, type: 'jpeg', quality: 90 });

    await browser.close();
    console.log('OG image successfully generated.');
})().catch(err => {
    console.error(err);
    process.exit(1);
});
