const {
    MongoClient
} = require('mongodb');
const natural = require('natural');
const stopword = require('stopword');
const tokenizer = new natural.WordTokenizer();
const stemmer = natural.PorterStemmer;

const MONGODB_URI = 'mongodb://localhost:27017/botCrawler';
const DATABASE_NAME = 'botCrawler';

async function createInvertedIndex() {
    const client = new MongoClient(MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });

    try {
        await client.connect();
        const database = client.db(DATABASE_NAME);
        const resultsCollection = database.collection('results');
        const indexCollection = database.collection('inverted_index');

        const cursor = resultsCollection.find();
        await indexCollection.deleteMany({}); // Limpa o índice invertido antes de reconstruí-lo

        while (await cursor.hasNext()) {
            const doc = await cursor.next();
            const content = doc.content || '';
            const tokens = tokenizer.tokenize(content.toLowerCase());

            const filteredTokens = stopword.removeStopwords(tokens)
                .filter(token => isNaN(token))
                .map(token => stemmer.stem(token));

            const wordPositions = {};
            filteredTokens.forEach((token, index) => {
                if (!wordPositions[token]) {
                    wordPositions[token] = [];
                }
                wordPositions[token].push(index);
            });

            // Modificação para incluir frequência das palavras
            for (const [word, positions] of Object.entries(wordPositions)) {
                const frequency = positions.length; // Frequência da palavra no documento
                await indexCollection.updateOne({
                    word
                }, {
                    $push: {
                        documents: {
                            url: doc.url,
                            positions,
                            frequency
                        }
                    }
                }, {
                    upsert: true
                });
            }
        }

        console.log('Índice invertido criado com sucesso.');
    } catch (error) {
        console.error(`Erro ao criar o índice invertido: ${error.message}`);
    } finally {
        await client.close();
    }
}

createInvertedIndex();