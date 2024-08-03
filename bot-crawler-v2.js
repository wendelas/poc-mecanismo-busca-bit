const express = require('express');
const { MongoClient } = require('mongodb');
const puppeteer = require('puppeteer');
const urlModule = require('url');

const MONGODB_URI = 'mongodb://localhost:27017/botCrawler';
const DATABASE_NAME = 'botCrawler';
const PORT = 3000;

const app = express();

// Função para extrair e processar dados da página
async function fetchPageData(url, baseDomain, depth = 0, maxDepth = 3) {
    try {
        // Lança uma nova instância do navegador usando Puppeteer
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'networkidle2' });
        console.log("fetchpagedata");
        // Avalia a página para extrair informações
        const data = await page.evaluate(() => {
            const title = document.querySelector('title')?.innerText || null;
            const description = document.querySelector('meta[name="description"]')?.getAttribute('content') || null;
            const keywords = document.querySelector('meta[name="keywords"]')?.getAttribute('content') || null;
            const links = Array.from(document.querySelectorAll('a'))
                .map(a => a.href)
                .filter(href => href && !href.startsWith('#') && !href.startsWith('javascript:'));
            const images = Array.from(document.querySelectorAll('img')).map(img => img.src);
            const videos = Array.from(document.querySelectorAll('video')).map(video => video.src);
            const content = document.body.innerText;

            return { title, description, keywords, links, images, videos, content };
        });

        await browser.close();

        // Filtra links internos e remove duplicatas
        const internalLinks = new Set(data.links.filter(link => {
            const linkDomain = urlModule.parse(link).hostname;
            return linkDomain && linkDomain.includes(baseDomain);
        }));

        return { url, ...data, internalLinks: Array.from(internalLinks), depth };
    } catch (error) {
        console.error(`Erro ao buscar dados da página: ${error.message}`);
        return { url };
    }
}

// Função para atualizar os sites com controle de profundidade
async function updateSitesWithDepth() {
    const client = new MongoClient(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

    try {
        await client.connect();
        const database = client.db(DATABASE_NAME);
        const urlsCollection = database.collection('ENGINE_LIST_URL_INDEX');
        const resultsCollection = database.collection('ENGINE_SEARCH_CRAWLER_DATASET');
      
        const sites = await urlsCollection.find().toArray();
        
        const visitedUrls = new Set();

        for (const site of sites) {
            const baseDomain = urlModule.parse(site.url).hostname;
            const data = await fetchPageData(site.url, baseDomain);
            console.log("site p67 " + site.url);

            // Adiciona URL visitada ao conjunto
            visitedUrls.add(site.url);

            await resultsCollection.updateOne(
                { url: site.url },
                {
                    $set: {
                        title: data.title || null,
                        description: data.description || null,
                        keywords: data.keywords || null,
                        links: data.links || [],
                        images: data.images || [],
                        videos: data.videos || [],
                        content: data.content || null,
                        internalLinks: data.internalLinks || [],
                        depth: data.depth || 0,
                        lastScraped: new Date(),
                        hasChanged: true
                    },
                    $setOnInsert: { firstScraped: new Date() }
                },
                { upsert: true }
            );
        }

        console.log('Atualização dos sites concluída.');
    } catch (error) {
        console.error(`Erro ao atualizar os sites: ${error.message}`);
    } finally {
        await client.close();
    }
}

// Função para atualizar links internos e controlar profundidade
async function updateInternalLinksWithDepth(urls, baseDomain, depth, maxDepth) {
    const client = new MongoClient(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

    try {
        await client.connect();
        const database = client.db(DATABASE_NAME);
        const resultsCollection = database.collection('ENGINE_SEARCH_CRAWLER_DATASET');

        for (const url of urls) {
            if (depth >= maxDepth) break; // Limita a profundidade

            const linkData = await fetchPageData(url, baseDomain, depth, maxDepth);

            await resultsCollection.updateOne(
                { url: url },
                {
                    $set: {
                        internalLinks: linkData.internalLinks,
                        lastInternalLinksScraped: new Date(),
                        depth: linkData.depth
                    }
                }
            );

            const nestedLinksData = await updateInternalLinksWithDepth(linkData.internalLinks, baseDomain, depth + 1, maxDepth);
        }

        console.log('Atualização dos links internos concluída.');
    } catch (error) {
        console.error(`Erro ao atualizar os links internos: ${error.message}`);
    } finally {
        await client.close();
    }
}

// Rota para iniciar a varredura e salvar os dados dos sites
app.get('/scan', async (req, res) => {
    try {
        await updateSitesWithDepth();
        res.send('Varredura e salvamento concluídos.');
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

// Rota para iniciar a varredura dos links internos
app.get('/scan-internal-links', async (req, res) => {
    const { url, limit, depth } = req.query;
    const linkLimit = parseInt(limit, 10) || 0;
    const maxDepth = parseInt(depth, 10) || 3;

    try {
        if (url) {
            await updateInternalLinksWithDepth([url], urlModule.parse(url).hostname, 0, maxDepth);
            res.send('Varredura dos links internos para o site específico concluída.');
        } else {
            const sites = await (await MongoClient.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true }))
                .db(DATABASE_NAME)
                .collection('ENGINE_SEARCH_CRAWLER_DATASET')
                .find()
                .toArray();
            for (const site of sites) {
                await updateInternalLinksWithDepth(site.links, urlModule.parse(site.url).hostname, 0, maxDepth);
            }
            res.send('Varredura dos links internos de todos os sites concluída.');
        }
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

// Inicia o servidor Express na porta definida
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
