const express = require('express');
const { MongoClient } = require('mongodb');
const puppeteer = require('puppeteer');
const urlModule = require('url');
const axios = require('axios');

const MONGODB_URI = 'mongodb://localhost:27017/botCrawler';
const DATABASE_NAME = 'botCrawler';
const PORT = 3000;

const app = express();

// Função para completar links relativos
function completeUrl(base, relative) {
    return urlModule.resolve(base, relative);
}

// Função para normalizar URLs removendo âncoras e barras finais duplicadas
function normalizeUrl(url) {
    let normalized = url.split('#')[0]; // Remove âncoras
    normalized = normalized.endsWith('/') ? normalized.slice(0, -1) : normalized; // Remove barra final se existir
    return normalized;
}

// Função para gerar o sitemap para uma URL
async function generateSitemapForUrl(url, depth = 0, maxDepth = 3) {
    const client = new MongoClient(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

    try {
        await client.connect();
        const database = client.db(DATABASE_NAME);
        const sitemapCollection = database.collection('sitemap');

        const visitedUrls = new Set();
        const urlsToVisit = [{ url, depth }];

        while (urlsToVisit.length > 0) {
            const { url: currentUrl, depth: currentDepth } = urlsToVisit.shift();
            if (currentDepth > maxDepth || visitedUrls.has(currentUrl)) continue;

            const fullUrl = completeUrl(url, currentUrl);
            const normalizedUrl = normalizeUrl(fullUrl);
            visitedUrls.add(normalizedUrl);

            try {
                // Valida o link
                const response = await axios.head(normalizedUrl);

                // Salva o link no sitemap
                await sitemapCollection.updateOne(
                    { url: normalizedUrl },
                    {
                        $set: {
                            url: normalizedUrl,
                            level: currentDepth,
                            status: response.status,
                            contentType: response.headers['content-type'] || 'unknown',
                            lastModified: response.headers['last-modified'] || null
                        }
                    },
                    { upsert: true }
                );

                // Se ainda não chegou no máximo de profundidade, busca links internos
                if (currentDepth < maxDepth) {
                    const browser = await puppeteer.launch();
                    const page = await browser.newPage();
                    await page.goto(normalizedUrl, { waitUntil: 'networkidle2' });

                    const internalLinks = await page.evaluate(() => {
                        return Array.from(document.querySelectorAll('a'))
                            .map(a => a.href)
                            .filter(href => href && !href.startsWith('#') && !href.startsWith('javascript:'));
                    });

                    await browser.close();

                    // Adiciona links internos à lista de URLs a visitar
                    for (const link of internalLinks) {
                        const fullInternalLink = completeUrl(normalizedUrl, link);
                        const normalizedInternalLink = normalizeUrl(fullInternalLink);
                        if (!visitedUrls.has(normalizedInternalLink)) {
                            urlsToVisit.push({ url: link, depth: currentDepth + 1 });
                        }
                    }
                }
            } catch (error) {
                console.error(`Erro ao processar URL ${currentUrl}: ${error.message}`);
            }
        }

        console.log('Sitemap gerado com sucesso.');
    } catch (error) {
        console.error(`Erro ao gerar o sitemap: ${error.message}`);
    } finally {
        await client.close();
    }
}

// Função para processar URLs da coleção e gerar sitemaps
async function generateSitemapsFromCollection() {
    const client = new MongoClient(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

    try {
        await client.connect();
        const database = client.db(DATABASE_NAME);
        const urlsCollection = database.collection('ENGINE_LIST_URL_INDEX');

        const urls = await urlsCollection.find().toArray();
        for (const { url } of urls) {
            await generateSitemapForUrl(url);
        }

        console.log('Sitemaps gerados para todas as URLs.');
    } catch (error) {
        console.error(`Erro ao gerar sitemaps para a coleção: ${error.message}`);
    } finally {
        await client.close();
    }
}

// Função para processar URLs da coleção e gerar sitemaps internos
async function generateInternalSitemapsFromCollection() {
    const client = new MongoClient(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

    try {
        await client.connect();
        const database = client.db(DATABASE_NAME);
        const urlsCollection = database.collection('ENGINE_LIST_URL_INDEX');

        const urls = await urlsCollection.find().toArray();
        for (const { url } of urls) {
            await generateInternalSitemapForUrl(url);
        }

        console.log('Sitemaps internos gerados para todas as URLs.');
    } catch (error) {
        console.error(`Erro ao gerar sitemaps internos para a coleção: ${error.message}`);
    } finally {
        await client.close();
    }
}

// Função para gerar o sitemap interno para uma URL dentro do mesmo domínio
async function generateInternalSitemapForUrl(url, depth = 0, maxDepth = 3) {
    const client = new MongoClient(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const baseDomain = urlModule.parse(url).hostname;

    try {
        await client.connect();
        const database = client.db(DATABASE_NAME);
        const sitemapCollection = database.collection('sitemap');

        const visitedUrls = new Set();
        const urlsToVisit = [{ url, depth }];

        while (urlsToVisit.length > 0) {
            const { url: currentUrl, depth: currentDepth } = urlsToVisit.shift();
            if (currentDepth > maxDepth || visitedUrls.has(currentUrl)) continue;

            const fullUrl = completeUrl(url, currentUrl);
            const normalizedUrl = normalizeUrl(fullUrl);
            const linkDomain = urlModule.parse(normalizedUrl).hostname;

            if (linkDomain === baseDomain) {
                visitedUrls.add(normalizedUrl);

                try {
                    // Valida o link
                    const response = await axios.head(normalizedUrl);

                    // Salva o link no sitemap
                    await sitemapCollection.updateOne(
                        { url: normalizedUrl },
                        {
                            $set: {
                                url: normalizedUrl,
                                level: currentDepth,
                                status: response.status,
                                contentType: response.headers['content-type'] || 'unknown',
                                lastModified: response.headers['last-modified'] || null
                            }
                        },
                        { upsert: true }
                    );

                    // Se ainda não chegou no máximo de profundidade, busca links internos
                    if (currentDepth < maxDepth) {
                        const browser = await puppeteer.launch();
                        const page = await browser.newPage();
                        await page.goto(normalizedUrl, { waitUntil: 'networkidle2' });

                        const internalLinks = await page.evaluate(() => {
                            return Array.from(document.querySelectorAll('a'))
                                .map(a => a.href)
                                .filter(href => href && !href.startsWith('#') && !href.startsWith('javascript:'));
                        });

                        await browser.close();

                        // Adiciona links internos à lista de URLs a visitar
                        for (const link of internalLinks) {
                            const fullInternalLink = completeUrl(normalizedUrl, link);
                            const normalizedInternalLink = normalizeUrl(fullInternalLink);
                            if (!visitedUrls.has(normalizedInternalLink)) {
                                urlsToVisit.push({ url: link, depth: currentDepth + 1 });
                            }
                        }
                    }
                } catch (error) {
                    console.error(`Erro ao processar URL ${currentUrl}: ${error.message}`);
                }
            }
        }

        console.log('Sitemap interno gerado com sucesso.');
    } catch (error) {
        console.error(`Erro ao gerar o sitemap interno: ${error.message}`);
    } finally {
        await client.close();
    }
}

// Rota para iniciar a geração de sitemaps
app.get('/generate-sitemaps', async (req, res) => {
    try {
        await generateSitemapsFromCollection();
        res.send('Sitemaps gerados para todas as URLs.');
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

// Rota para iniciar a geração de sitemaps internos
app.get('/generate-internal-sitemaps', async (req, res) => {
    try {
        await generateInternalSitemapsFromCollection();
        res.send('Sitemaps internos gerados para todas as URLs.');
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

// Inicia o servidor Express na porta definida
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
