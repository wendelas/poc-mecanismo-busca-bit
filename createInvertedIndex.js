const {
    MongoClient
} = require('mongodb');
const natural = require('natural');
const stopword = require('stopwords-pt');
const tokenizer = new natural.WordTokenizer();
const stemmer = natural.PorterStemmer;

const MONGODB_URI = 'mongodb://localhost:27017/botCrawlerIndex';
const DATABASE_NAME = 'botCrawlerIndex';

async function createInvertedIndex() {
    const client = new MongoClient(MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });

    try {
        await client.connect();
        const database = client.db(DATABASE_NAME);
        const resultsCollection = database.collection('ENGINE_SEARCH_CRAWLER_DATASET');
        const indexCollection = database.collection('ENGINE_SEARCH_INVERTED_INDEX');

        const cursor = resultsCollection.find();
        await indexCollection.deleteMany({}); // Limpa o índice invertido antes de reconstruí-lo

        while (await cursor.hasNext()) { //while continua enquanto houver documentos no cursor e no cursor.hasNext() verifica se há mais documentos.
            const doc = await cursor.next(); //obtém o próximo documento..
            const content = doc.content || ''; //é definido como o conteúdo do documento ou uma string vazia se doc.content for undefined.
            const tokens = tokenizer.tokenize(content.toLowerCase()); //converte o conteúdo em tokens (palavras) em minúsculas., podemos melhorar e tambem retirar os acentos

            const filteredTokens = stopword.removeStopwords(tokens) //remove palavras comuns (stopwords) que não são úteis para análise.
                .filter(token => isNaN(token)) //filtra os tokens, removendo aqueles que são números. Aqui, isNaN(token) retorna true se o token não puder ser convertido para um número, ou seja, se não for um número.
                .map(token => stemmer.stem(token)); //aplica um algoritmo de stemming para reduzir as palavras às suas raízes.

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
