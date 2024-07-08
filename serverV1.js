const express = require('express');
const { MongoClient } = require('mongodb');
const puppeteer = require('puppeteer');

const MONGODB_URI = 'mongodb://localhost:27017/botCrawler';
const DATABASE_NAME = 'botCrawler';
const PORT = 3000;

const app = express();

async function fetchPageData(url) {
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
            const content = document.documentElement.outerHTML; // Captura o HTML completo da página

            return {
                title,
                description,
                keywords,
                links,
                content
            };
        });

        await browser.close();
        return { url, ...data };
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
        const urlsCollection = database.collection('urls');
        const resultsCollection = database.collection('results');

        const sites = await urlsCollection.find().toArray();

        for (const site of sites) {
            const data = await fetchPageData(site.url);
            const hasChanged = data.title !== site.title || data.description !== site.description || data.keywords !== site.keywords;

            await resultsCollection.updateOne(
                { url: site.url },
                {
                    $set: {
                        title: data.title || null,
                        description: data.description || null,
                        keywords: data.keywords || null,
                        links: data.links || [],
                        content: data.content || null, // Armazena o HTML completo da página
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

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
