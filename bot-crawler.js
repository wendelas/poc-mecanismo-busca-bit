const express = require('express');
const { MongoClient } = require('mongodb');
const puppeteer = require('puppeteer');
const urlModule = require('url');

const MONGODB_URI = 'mongodb://localhost:27017/botCrawlerIndex';
const DATABASE_NAME = 'botCrawlerIndex';
const PORT = 3000;
 const urlsCollection = database.collection('ENGINE_LIST_URL_INDEX');
const resultsCollection = database.collection('ENGINE_SEARCH_CRAWLER_DATASET');

const app = express();

async function fetchPageData(url, baseDomain) {
    try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'networkidle2' });

        const data = await page.evaluate(() => {
            const title = document.querySelector('title')?.innerText || null;
            const description = document.querySelector('meta[name="description"]')?.getAttribute('content') || null;
            const keywords = document.querySelector('meta[name="keywords"]')?.getAttribute('content') || null;
            const links = Array.from(document.querySelectorAll('a'))
                .map(a => a.href)
                .filter(href => href && !href.startsWith('#') && !href.startsWith('javascript:'));

            const content = document.body.innerText;

            return {
                title,
                description,
                keywords,
                links,
                content
            };
        });

        await browser.close();

        // Filtra links que pertencem ao mesmo domínio
        const internalLinks = data.links.filter(link => {
            const linkDomain = urlModule.parse(link).hostname;
            return linkDomain && linkDomain.includes(baseDomain);
        });

        return { url, ...data, internalLinks };
    } catch (error) {
        console.error(`Erro ao buscar dados da página: ${error.message}`);
        return { url };
    }
}

async function updateSites() {
    const client = new MongoClient(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

    try {
        await client.connect();
        const database = client.db(DATABASE_NAME);
        const urlsCollection = database.collection('ENGINE_LIST_URL_INDEX');
        const resultsCollection = database.collection('ENGINE_SEARCH_CRAWLER_DATASET');

        const sites = await urlsCollection.find().toArray();

        for (const site of sites) {
            const baseDomain = urlModule.parse(site.url).hostname;
            const data = await fetchPageData(site.url, baseDomain);
            const hasChanged = data.title !== site.title || data.description !== site.description || data.keywords !== site.keywords;

            await resultsCollection.updateOne(
                { url: site.url },
                {
                    $set: {
                        title: data.title || null,
                        description: data.description || null,
                        keywords: data.keywords || null,
                        links: data.links || [],
                        content: data.content || null,
                        internalLinks: [],
                        lastScraped: new Date(),
                        hasChanged
                    },
                    $setOnInsert: {
                        firstScraped: new Date()
                    }
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

app.get('/scan', async (req, res) => {
    try {
        await updateSites();
        res.send('Varredura e salvamento concluídos.');
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

async function fetchInternalLinks(urls, baseDomain, limit = 0) {
    const internalLinksData = [];
    for (let i = 0; i < urls.length; i++) {
        if (limit > 0 && i >= limit) break;
        const link = urls[i];
        const linkData = await fetchPageData(link, baseDomain);
        internalLinksData.push({ url: link, ...linkData });
    }
    return internalLinksData;
}

async function updateInternalLinksForAllSites(limit = 0) {
    const client = new MongoClient(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

    try {
        await client.connect();
        const database = client.db(DATABASE_NAME);
        const resultsCollection = database.collection('ENGINE_SEARCH_CRAWLER_DATASET');

        const sites = await resultsCollection.find().toArray();

        for (const site of sites) {
            if (site.links && site.links.length > 0) {
                const baseDomain = urlModule.parse(site.url).hostname;
                const internalLinksData = await fetchInternalLinks(site.links, baseDomain, limit);

                for (const internalLink of internalLinksData) {
                    const internalBaseDomain = urlModule.parse(internalLink.url).hostname;
                    const nestedInternalLinksData = await fetchInternalLinks(internalLink.internalLinks, internalBaseDomain, limit);

                    internalLink.internalLinks = nestedInternalLinksData;
                }

                await resultsCollection.updateOne(
                    { url: site.url },
                    {
                        $set: {
                            internalLinks: internalLinksData,
                            lastInternalLinksScraped: new Date()
                        }
                    }
                );
            }
        }

        console.log('Atualização dos links internos de todos os sites concluída.');
    } catch (error) {
        console.error(`Erro ao atualizar os links internos de todos os sites: ${error.message}`);
    } finally {
        await client.close();
    }
}

async function updateInternalLinksForSpecificSite(siteUrl, limit = 0) {
    const client = new MongoClient(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

    try {
        await client.connect();
        const database = client.db(DATABASE_NAME);
        const resultsCollection = database.collection('ENGINE_SEARCH_CRAWLER_DATASET');

        const site = await resultsCollection.findOne({ url: siteUrl });

        if (site && site.links) {
            const baseDomain = urlModule.parse(site.url).hostname;
            const internalLinksData = await fetchInternalLinks(site.links, baseDomain, limit);

            await resultsCollection.updateOne(
                { url: site.url },
                {
                    $set: {
                        internalLinks: internalLinksData,
                        lastInternalLinksScraped: new Date()
                    }
                }
            );

            console.log(`Atualização dos links internos para ${siteUrl} concluída.`);
        } else {
            console.log(`Nenhum link encontrado para ${siteUrl}.`);
        }
    } catch (error) {
        console.error(`Erro ao atualizar os links internos: ${error.message}`);
    } finally {
        await client.close();
    }
}



app.get('/scan-internal-links', async (req, res) => {
    const { url, limit } = req.query;
    const linkLimit = parseInt(limit, 10) || 0;

    try {
        if (url) {
            await updateInternalLinksForSpecificSite(url, linkLimit);
            res.send('Varredura dos links internos para o site específico concluída.');
        } else {
            await updateInternalLinksForAllSites(linkLimit);
            res.send('Varredura dos links internos de todos os sites concluída.');
        }
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});

//Para varrer os links internos de um site específico com limite:
//https://localhost:3000/scan-internal-links?url=http://quietudedinamica.com.br&limit=10
//Para varrer todos os links internos de todos os sites com limite
//https://localhost:3000/scan-internal-links?limit=10
//Para varrer todos os links internos de todos os sites sem limite
//https://localhost:3000/scan-internal-links
