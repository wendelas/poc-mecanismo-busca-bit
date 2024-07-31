
Para testar a POC vamos usar 3 arquivos, bot-crawler.js, createCollections.js, createInvertedIndex.js e server.js

1) Primeiro certifique-se de ter o node e o mongo instalado
2) Crie um novo banco de dados chamado botcrawlerindex
3) roda primeiro o createCollections.js, ele ira criar
   - ENGINE_LIST_URL_INDEX, collection com a lista de sites que temos que mapear e indexar
   - ENGINE_SEARCH_CRAWLER_DATASET, collection onde iremos armazenar o resultado do crawler, a url, os links internos, faz varredura recursiva nos links internos também para podermos indexar todo o site, também 
     armazena todas as palavras que foram encontradas no header, body e footer, e essa collection que queremos indexar
   - ENGINE_SEARCH_INVERTED_INDEX - collection onde iremos criar nossa estrutura de index invertido.
        Exemplo da estrutura do index invertido:
            {
              "_id" : ObjectId("66995e782d1a64cf1f90e74e"),
              "word" : "home",
              "documents" : [
                  {
                      "url" : "https://quietudedinamica.com.br",
                      "positions" : [
                          0
                      ],
                      "frequency" : 1
                  },
                 {
                      "url" : "https://uol.com.br",
                      "positions" : [
                          0,
                         25
                      ],
                      "frequency" : 2
                  }
              ]
        
          }
4) Agora execute o bot-crawler.js, ele ira acessar a collection ENGINE_LIST_URL_INDEX, PEGAR URL POR URL e mapear o title, description do header, todo o texto no body e também no footer, remove o html, está preparando uma base para ser indexada em ENGINE_SEARCH_CRAWLER_DATASET.
   - //Para varrer os links internos de um site específico com limite:
   - //https://localhost:3000/scan-internal-links?url=http://quietudedinamica.com.br&limit=10
   - //Para varrer todos os links internos de todos os sites com limite
   - //https://localhost:3000/scan-internal-links?limit=10
   - //Para varrer todos os links internos de todos os sites sem limite
   - //https://localhost:3000/scan-internal-links
   - 
6) Agora execute o createInvertedIndex.js, ele ira acessar o ENGINE_SEARCH_CRAWLER_DATASET e iniciar a indexação na collection ENGINE_SEARCH_INVERTED_INDEX
7) Agora que já temos nosso index invertido iremos testar nosso mecanismo de busca executando nosso server.js 
   
