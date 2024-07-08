const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb://localhost:27017/botCrawler';

async function createCollections() {
    const client = new MongoClient(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

    try {
        await client.connect();
        const database = client.db('botCrawler');

        // Criação das coleções
        await database.createCollection('urls');
        await database.createCollection('results');

        // Inserção de documentos de exemplo na coleção 'urls'
        const urlsCollection = database.collection('urls');
        await urlsCollection.insertMany([
            { url: 'http://bitconecta.com' },
            { url: 'http://example.com' },
            { url: 'http://another-example.com' }
        ]);

        console.log('Coleções criadas e dados de exemplo inseridos com sucesso.');
    } catch (error) {
        console.error(`Erro ao criar coleções: ${error.message}`);
    } finally {
        await client.close();
    }
}

createCollections().catch(console.error);
