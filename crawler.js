const axios = require('axios');
const cheerio = require('cheerio');

async function fetchPageData(url) {
try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    const title = $('title').text();
    const description = $('meta[name="description"]').attr('content');
    const descricao = $('meta[name="descricao"]').attr('content');
    const keywords = $('meta[name="keywords"]').attr('content');
    const links = [];

    $('a').each((index, element) => {
    const link = $(element).attr('href');
    if (link && !link.startsWith('#') && !link.startsWith('javascript:')) {
        links.push(link);
    }
    });

    return {
    title,
    description,
    descricao,
    keywords,
    links
    };
} catch (error) {
    console.error(`Erro ao buscar dados da página: ${error.message}`);
    return {};
}
}

   // Exemplo de uso
   const testUrl = 'http://bitconecta.com';
   fetchPageData(testUrl).then(data => {
   console.log(data);
   });