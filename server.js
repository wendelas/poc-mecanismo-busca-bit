const express = require('express');
const { MongoClient } = require('mongodb');
const natural = require('natural');
const stopword = require('stopword');
const tokenizer = new natural.WordTokenizer();
const stemmer = natural.PorterStemmer;

const MONGODB_URI = 'mongodb://localhost:27017/botCrawler';
const DATABASE_NAME = 'botCrawler';
const PORT = 3000;

const app = express();

app.use(express.static('public')); // Servir arquivos estáticos da pasta 'public'

async function searchOne(query) {
    const client = new MongoClient(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

    try {
        await client.connect();
        const database = client.db(DATABASE_NAME);
        const indexCollection = database.collection('inverted_index');

        const tokens = tokenizer.tokenize(query.toLowerCase());
        const filteredTokens = stopword.removeStopwords(tokens).map(token => stemmer.stem(token));

        const wordDocs = {};

        for (const token of filteredTokens) {
            const entry = await indexCollection.findOne({ word: token });
            if (entry) {
                wordDocs[token] = entry.documents;
            }
        }

        if (Object.keys(wordDocs).length === 0) {
            return [];
        }

        const docScores = {};
        
        for (const [word, docs] of Object.entries(wordDocs)) {
            for (const doc of docs) {
                if (!docScores[doc.url]) {
                    docScores[doc.url] = { score: 0, positions: {} };
                }
                docScores[doc.url].score += doc.positions.length;
                docScores[doc.url].positions[word] = doc.positions;
            }
        }

        const results = [];
        for (const [url, data] of Object.entries(docScores)) {
            if (filteredTokens.every(token => data.positions[token])) {
                let phraseExists = true;
                for (let i = 0; i < filteredTokens.length - 1; i++) {
                    const currentWordPositions = data.positions[filteredTokens[i]];
                    const nextWordPositions = data.positions[filteredTokens[i + 1]];

                    let foundSequence = false;
                    for (const pos of currentWordPositions) {
                        if (nextWordPositions.includes(pos + 1)) {
                            foundSequence = true;
                            break;
                        }
                    }

                    if (!foundSequence) {
                        phraseExists = false;
                        break;
                    }
                }

                if (phraseExists) {
                    results.push({ url, score: data.score });
                }
            }
        }

        return results.sort((a, b) => b.score - a.score);
    } catch (error) {
        console.error(`Erro na busca: ${error.message}`);
        return [];
    } finally {
        await client.close();
    }
}

app.get('/searchOne', async (req, res) => {
    const { q } = req.query;
    if (!q) {
        return res.status(400).send({ error: 'Parâmetro de busca "q" é necessário.' });
    }

    try {
        const results = await searchOne(q);
        res.send(results);
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

app.get('/search', async (req, res) => {
    const { q, author, fromDate, toDate } = req.query;
    if (!q) {
        return res.status(400).send({ error: 'Parâmetro de busca "q" é necessário.' });
    }

    try {
        const results = await search(q, author, fromDate, toDate);
        res.send(results);
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});


async function search(query, author, fromDate, toDate) {
    const client = new MongoClient(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

    try {
        await client.connect();
        const database = client.db(DATABASE_NAME);
        const indexCollection = database.collection('inverted_index');

        const tokens = tokenizer.tokenize(query.toLowerCase());
        const filteredTokens = stopword.removeStopwords(tokens).map(token => stemmer.stem(token));

        // Verifica se a consulta é uma frase (contém mais de uma palavra)
        const isPhrase = filteredTokens.length > 1;

        if (isPhrase) {
            console.log("isfrase");
            // Busca por frase no índice invertido
            const results = await indexCollection.aggregate([
                { $match: { word: { $in: filteredTokens } } },
                { $unwind: '$documents' },
                { $match: { 'documents.url': { $exists: true } } },
                
                // Implemente a lógica para verificar a ordem das palavras na frase
                // e buscar documentos que correspondam à ordem correta das palavras
                { $group: {
                    _id: '$_id',
                    word: { $first: '$word' },
                    documents: { $push: '$documents' }
                }}
            ]).toArray();

            return results;

        } else {
            // Busca por palavras individuais no índice invertido
            const results = await indexCollection.aggregate([
                { $match: { word: { $in: filteredTokens } } },
                { $unwind: '$documents' },
                { $match: { 'documents.url': { $exists: true } } }
            ]).toArray();

            return results;
        }

    } catch (error) {
        console.error(`Erro na busca: ${error.message}`);
        return [];
    } finally {
        await client.close();
    }
}

app.get('/searchPhraseOne', async (req, res) => {
    const { q, author, fromDate, toDate } = req.query;
    if (!q) {
        return res.status(400).send({ error: 'Parâmetro de busca "q" é necessário.' });
    }

    try {
        const results = await searchPhraseOn(q, author, fromDate, toDate);
        res.send(results);
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

async function searchPhraseOn(phrase) {
    const client = new MongoClient(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

    try {
        await client.connect();
        const database = client.db(DATABASE_NAME);
        const indexCollection = database.collection('inverted_index');

        const tokens = tokenizer.tokenize(phrase.toLowerCase());
        const filteredTokens = stopword.removeStopwords(tokens).map(token => stemmer.stem(token));

        // Verifica se a consulta é uma frase (contém mais de uma palavra)
        if (filteredTokens.length > 1) {
            // Encontra documentos que contêm todas as palavras na ordem correta
            const results = await indexCollection.aggregate([
                { $match: { word: { $in: filteredTokens } } },
                { $unwind: '$documents' },
                { $match: { 'documents.url': { $exists: true } } }
            ]).toArray();

            // Filtra os resultados para garantir a ordem correta das palavras
            const filteredResults = results.filter(result => {
                const positions = result.documents.positions;
                const foundIndexes = [];
                for (let i = 0; i < filteredTokens.length; i++) {
                    const token = filteredTokens[i];
                    const foundIndex = positions.findIndex(pos => pos === i);
                    if (foundIndex !== -1 && !foundIndexes.includes(foundIndex)) {
                        foundIndexes.push(foundIndex);
                    } else {
                        return false; // Palavras não estão na ordem correta
                    }
                }
                return true;
            });

            return filteredResults;

        } else {
            // Busca por palavras individuais no índice invertido
            const results = await indexCollection.aggregate([
                { $match: { word: { $in: filteredTokens } } },
                { $unwind: '$documents' },
                { $match: { 'documents.url': { $exists: true } } }
            ]).toArray();

            return results;
        }

    } catch (error) {
        console.error(`Erro na busca: ${error.message}`);
        return [];
    } finally {
        await client.close();
    }
}

app.get('/searchPhrase', async (req, res) => {
    const { q, author, fromDate, toDate } = req.query;
    if (!q) {
        return res.status(400).send({ error: 'Parâmetro de busca "q" é necessário.' });
    }

    try {
        const results = await searchPhrase(q, author, fromDate, toDate);
        res.send(results);
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

async function searchPhrase(phrase) {
    const client = new MongoClient(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

    try {
        await client.connect();
        const database = client.db(DATABASE_NAME);
        const indexCollection = database.collection('inverted_index');

        const tokens = tokenizer.tokenize(phrase.toLowerCase());
        const filteredTokens = stopword.removeStopwords(tokens).map(token => stemmer.stem(token));

        // Verifica se a consulta é uma frase (contém mais de uma palavra)
        if (filteredTokens.length > 1) {
            // Encontra documentos que contêm todas as palavras na ordem correta
            const results = await indexCollection.aggregate([
                { $match: { word: { $in: filteredTokens } } },
                { $unwind: '$documents' },
                { $match: { 'documents.url': { $exists: true } } }
            ]).toArray();

            // Filtra os resultados para garantir a ordem correta das palavras
            const filteredResults = results.filter(result => {
                const positions = result.documents.positions;
                const foundIndexes = [];
                for (let i = 0; i < filteredTokens.length; i++) {
                    const token = filteredTokens[i];
                    const foundIndex = positions.findIndex(pos => pos === i);
                    if (foundIndex !== -1 && !foundIndexes.includes(foundIndex)) {
                        foundIndexes.push(foundIndex);
                    } else {
                        return false; // Palavras não estão na ordem correta
                    }
                }
                return true;
            });

            // Prepara o resultado para retornar
            const phraseResults = filteredResults.map(result => {
                const { _id, word, documents } = result;
                const phraseInfo = {
                    phrase: phrase,
                    words: [],
                    occurrences: filteredResults.length
                };

                for (let i = 0; i < filteredTokens.length; i++) {
                    const token = filteredTokens[i];
                    const position = documents.positions[i];
                    phraseInfo.words.push({ word: token, position: position });
                }

                return phraseInfo;
            });

            return phraseResults;

        } else {
            // Busca por palavras individuais no índice invertido
            const results = await indexCollection.aggregate([
                { $match: { word: { $in: filteredTokens } } },
                { $unwind: '$documents' },
                { $match: { 'documents.url': { $exists: true } } }
            ]).toArray();

            return results;
        }

    } catch (error) {
        console.error(`Erro na busca: ${error.message}`);
        return [];
    } finally {
        await client.close();
    }
}

app.get('/searchPhraseDois', async (req, res) => {
    const { q, author, fromDate, toDate } = req.query;
    if (!q) {
        return res.status(400).send({ error: 'Parâmetro de busca "q" é necessário.' });
    }

    try {
        const results = await searchPhraseD(q, author, fromDate, toDate);
        res.send(results);
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

async function searchPhraseD(phrase) {
    const client = new MongoClient(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

    try {
        await client.connect();
        const database = client.db(DATABASE_NAME);
        const indexCollection = database.collection('inverted_index');

        const tokens = phrase.split('+');
        const filteredTokens = tokens.map(token => stemmer.stem(token));
        console.log("searchPhraseD");
        // Encontra todos os documentos que contêm pelo menos uma das palavras
        const results = await indexCollection.aggregate([
            { $match: { word: { $in: filteredTokens } } },
            { $unwind: '$documents' },
            { $match: { 'documents.url': { $exists: true } } }
        ]).toArray();

        // Agrupa os documentos por URL e verifica se as palavras estão na ordem correta
        const groupedResults = results.reduce((acc, curr) => {
            const { word, documents } = curr;
            const positions = documents.positions;

            // Cria um índice de ocorrências para cada documento
            const documentIndex = acc.findIndex(item => item.url === documents.url);
            if (documentIndex === -1) {
                acc.push({
                    url: documents.url,
                    words: [{ word, positions }],
                    count: 1
                });
            } else {
                acc[documentIndex].words.push({ word, positions });
                acc[documentIndex].count++;
            }

            return acc;
        }, []);

        // Filtra os resultados para encontrar frases e palavras soltas
        const formattedResults = [];

        groupedResults.forEach(item => {
            const { words, count } = item;

            // Verifica se todas as palavras estão na ordem correta
            for (let i = 0; i <= words.length - tokens.length; i++) {
                const phraseWords = words.slice(i, i + tokens.length);
                const foundPhrase = phraseWords.every((word, index) => word.word === filteredTokens[index]);

                if (foundPhrase) {
                    const phraseInfo = {
                        phrase: tokens.join(' '),
                        positions: phraseWords.map(word => word.positions[0]),
                        words: phraseWords.map(word => ({ word: word.word, position: word.positions[0] }))
                    };
                    formattedResults.push(phraseInfo);
                }
            }

            // Adiciona as palavras soltas que não formam uma frase completa
            words.forEach(word => {
                if (!tokens.includes(word.word)) {
                    formattedResults.push({
                        _id: word._id,
                        word: word.word,
                        documents: [{ url: item.url, positions: word.positions, frequency: word.positions.length }]
                    });
                }
            });
        });

        return formattedResults;

    } catch (error) {
        console.error(`Erro na busca: ${error.message}`);
        return [];
    } finally {
        await client.close();
    }
}







app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});

//https://localhost:3000/search?q=sua+frase+de+busca



