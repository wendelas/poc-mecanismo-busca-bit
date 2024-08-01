## Roteiro para Execução da Prova de Conceito (POC)

### Pré-requisitos

1. Certifique-se de que as seguintes ferramentas estão instaladas:
   - [Node.js](https://nodejs.org/) - Versão recomendada: LTS
   - [MongoDB](https://www.mongodb.com/try/download/community) - Versão recomendada: 5.x ou superior

2. Crie um banco de dados no MongoDB:
   - Nome: `botcrawlerindex`

### Passos para Configuração e Execução

1. Configuração das Coleções no MongoDB

   - Arquivo: `createCollections.js`
   - Objetivo: Configurar as coleções necessárias no banco de dados MongoDB.
   - Coleções Criadas:
     - `ENGINE_LIST_URL_INDEX`: Contém a lista de URLs a serem mapeadas e indexadas.
     - `ENGINE_SEARCH_CRAWLER_DATASET`: Armazena os resultados do crawler, incluindo URLs, links internos, e palavras encontradas.
     - `ENGINE_SEARCH_INVERTED_INDEX`: Estrutura o índice invertido para busca eficiente.

   node createCollections.js

2. Execução do Crawler

   - Arquivo: `bot-crawler.js`
   - Objetivo: Mapear e indexar as URLs da coleção `ENGINE_LIST_URL_INDEX`. O crawler extrai o título, descrição, e texto dos headers, body e footer de cada URL. Em seguida, armazena essas informações na coleção `ENGINE_SEARCH_CRAWLER_DATASET`.
   
   - Endpoints para Varredura de Links Internos:
     - Varredura de links internos de um site específico com limite:
       
       https://localhost:3000/scan-internal-links?url=http://example.com&limit=10
       
     - Varredura de links internos de todos os sites com limite:
       
       https://localhost:3000/scan-internal-links?limit=10
       
     - Varredura de links internos de todos os sites sem limite:
       
       https://localhost:3000/scan-internal-links
       
   node bot-crawler.js

3. Criação do Índice Invertido

   - Arquivo: `createInvertedIndex.js`
   - Objetivo: Ler os dados da coleção `ENGINE_SEARCH_CRAWLER_DATASET` e criar o índice invertido na coleção `ENGINE_SEARCH_INVERTED_INDEX` para permitir buscas eficientes.

   node createInvertedIndex.js
   
4. Execução do Servidor de Busca

   - Arquivo: `server.js`
   - Objetivo: Iniciar o servidor e permitir a execução de buscas utilizando o índice invertido criado.
   - Endpoint de Busca:
     - Teste a busca com o seguinte endpoint:
       
       https://localhost:3000/search?q=sua+frase+de+busca
         
   node server.js
   
### Notas Adicionais

- Verifique o Log: Ao executar cada script, verifique o log do console para garantir que não houve erros durante a execução.
- Testes e Validações: Após a execução dos scripts, valide os dados nas coleções MongoDB e faça buscas para assegurar que o índice invertido está funcionando conforme esperado.
