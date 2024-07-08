const natural = require('natural');
const stopword = require('stopword');
const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb://localhost:27017/botCrawler';
const DATABASE_NAME = 'botCrawler';

const tokenizer = new natural.WordTokenizer();
const stemmer = natural.PorterStemmer;

async function createInvertedIndex() {
    const client = new MongoClient(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

    try {
        await client.connect();
        const database = client.db(DATABASE_NAME);
        const indexCollection = database.collection('inverted_index');
        const sitesCollection = database.collection('results');

        // Busca todos os documentos
        const sites = await sitesCollection.find().toArray();

        // Limpa a coleção de índice invertido
        await indexCollection.deleteMany({});

        // Mapeia palavras para documentos e suas posições
        const wordPositions = {};

        for (const site of sites) {
            const tokens = tokenizer.tokenize(site.content.toLowerCase());
            const filteredTokens = stopword.removeStopwords(tokens).map(token => stemmer.stem(token));

            // Contagem de frequência das palavras no documento
            const wordFrequency = {};
            filteredTokens.forEach(token => {
                if (wordFrequency[token]) {
                    wordFrequency[token]++;
                } else {
                    wordFrequency[token] = 1;
                }
            });

            // Armazena as posições e frequência das palavras
            filteredTokens.forEach((token, index) => {
                if (!wordPositions[token]) {
                    wordPositions[token] = [];
                }
                wordPositions[token].push({
                    url: site.url,
                    positions: [index],
                    frequency: wordFrequency[token],
                    title: site.title,
                    createdAt: site.firstScraped, // Exemplo de metadata
                    // Adicione outras informações de metadata aqui conforme necessário
                });
            });
        }

        // Insere as palavras no índice invertido
        for (const [word, positions] of Object.entries(wordPositions)) {
            await indexCollection.insertOne({ word, documents: positions });
        }

        console.log('Índice invertido criado com sucesso.');

    } catch (error) {
        console.error('Erro ao criar o índice invertido:', error.message);
    } finally {
        await client.close();
    }
}

createInvertedIndex();
