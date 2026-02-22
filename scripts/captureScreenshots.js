import { chromium } from 'playwright';
import path from 'path';

async function captureScreenshots() {
    console.log('Starting screenshot generation...');
    const browser = await chromium.launch();

    // Set accurate viewport size for wide screenshot (1400px width)
    const context = await browser.newContext({
        viewport: { width: 1400, height: 900 },
        deviceScaleFactor: 1,
    });

    const page = await context.newPage();

    // Assuming the dev server is running on localhost:5173
    const url = 'http://localhost:5173';

    try {
        await page.goto(url, { waitUntil: 'networkidle' });
        console.log(`Successfully navigated to ${url}`);

        // Wait for the UI to be fully rendered
        await page.waitForTimeout(1500);

        // Toggle Light Mode
        console.log('Toggling Light Mode...');
        const btnLight = await page.$('button[title="Light theme"]');
        if (btnLight) {
            await btnLight.click();
            await page.waitForTimeout(1000); // Wait for transition
        } else {
            console.log("Fallback: Forcing light mode via document dataset");
            await page.evaluate(() => {
                document.documentElement.dataset.themeMode = 'light';
            });
            await page.waitForTimeout(500); // Wait for transition
        }

        console.log('Capturing Light Mode Desktop Screenshot (1400px)...');
        await page.screenshot({ path: path.join(process.cwd(), 'screenshot_light_1400.png') });

    } catch (error) {
        console.error('Error during screenshot generation:', error);
        console.log('\n*** Please ensure your Vite development server is running (npm run dev) at http://localhost:5173 ***\n');
    } finally {
        await browser.close();
        console.log('Screenshot generation complete.');
    }
}

captureScreenshots();
