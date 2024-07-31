const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb://localhost:27017/botCrawlerIndex';

async function createCollections() {
    const client = new MongoClient(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

    try {
        await client.connect();
        const database = client.db('botCrawlerIndex');

        // Criação das coleções
        await database.createCollection('ENGINE_LIST_URL_INDEX');//lista de urls para indexacao
        await database.createCollection('ENGINE_SEARCH_CRAWLER_DATASET');//resultado do crawler, dados armazenados: url com link internos e todas as palavras encontradas dentro do header, body e footer

        // Inserção de documentos de exemplo na coleção 'urls'
        const urlsCollection = database.collection('ENGINE_LIST_URL_INDEX');
        await urlsCollection.insertMany([
            { url: 'https://bitconecta.com.br' }
        ]);

        console.log('Coleções criadas e dados de exemplo inseridos com sucesso.');
    } catch (error) {
        console.error(`Erro ao criar coleções: ${error.message}`);
    } finally {
        await client.close();
    }
}

createCollections().catch(console.error);
