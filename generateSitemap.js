const { MongoClient } = require('mongodb');
const puppeteer = require('puppeteer');
const urlModule = require('url');

const MONGODB_URI = 'mongodb://localhost:27017/botCrawler';
const DATABASE_NAME = 'botCrawler';

// Função para completar links relativos com a URL base
function completeUrl(baseUrl, relativeUrl) {
    return urlModule.resolve(baseUrl, relativeUrl);
}

// Função para extrair e processar dados da página
async function fetchPageLinks(url, baseDomain) {
    try {
        // Lança uma nova instância do navegador usando Puppeteer
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'networkidle2' });
        
        // Avalia a página para extrair links
        const links = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a'))
                .map(a => a.href)
                .filter(href => href && !href.startsWith('#') && !href.startsWith('javascript:'));
        });

        await browser.close();

        // Filtra links internos e remove duplicatas
        const internalLinks = new Set(links.filter(link => {
            const linkDomain = urlModule.parse(link).hostname;
            return linkDomain && linkDomain.includes(baseDomain);
        }));

        return Array.from(internalLinks);
    } catch (error) {
        console.error(`Erro ao buscar links da página: ${error.message}`);
        return [];
    }
}

// Função para gerar o sitemap
async function generateSitemap(rootUrl) {
    const client = new MongoClient(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const visitedUrls = new Set();
    const urlQueue = [{ url: rootUrl, depth: 0 }];

    try {
        await client.connect();
        const database = client.db(DATABASE_NAME);
        const sitemapCollection = database.collection('ENGINE_SITEMAP');

        while (urlQueue.length > 0) {
            const { url, depth } = urlQueue.shift();
            if (visitedUrls.has(url)) continue;

            visitedUrls.add(url);

            // Completa a URL se necessário
            const baseDomain = urlModule.parse(rootUrl).hostname;
            const links = await fetchPageLinks(url, baseDomain);
            
            // Salva a URL no sitemap
            await sitemapCollection.updateOne(
                { url: url },
                { $set: { url: url, depth: depth } },
                { upsert: true }
            );

            // Adiciona novos links à fila para processamento
            links.forEach(link => {
                if (!visitedUrls.has(link)) {
                    urlQueue.push({ url: link, depth: depth + 1 });
                }
            });
        }

        console.log('Geração do sitemap concluída.');
    } catch (error) {
        console.error(`Erro ao gerar o sitemap: ${error.message}`);
    } finally {
        await client.close();
    }
}

// Exemplo de uso
generateSitemap('https://uol.com.br');
