const puppeteer = require('puppeteer');

async function fetchPageData(url) {
    try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'networkidle2' });

        const data = await page.evaluate(() => {
            const title = document.querySelector('title').innerText;
            const description = document.querySelector('meta[name="description"]')?.getAttribute('content');
            const descricao = document.querySelector('meta[name="descricao"]')?.getAttribute('content');
            const keywords = document.querySelector('meta[name="keywords"]')?.getAttribute('content');
            const links = Array.from(document.querySelectorAll('a'))
                .map(a => a.href)
                .filter(href => href && !href.startsWith('#') && !href.startsWith('javascript:'));

            return {
                title,
                description,
                descricao,
                keywords,
                links
            };
        });

        await browser.close();
        return data;
    } catch (error) {
        console.error(`Erro ao buscar dados da página: ${error.message}`);
        return {};
    }
}

// Exemplo de uso
const testUrl = 'https://bitconecta.com';
fetchPageData(testUrl).then(data => {
    console.log(data);
});
