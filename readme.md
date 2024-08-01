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

### Sobre o uso do natural, stemmer e stopwords no projeto

Para melhorar a eficácia e eficiência de um mecanismo de busca ou de um índice invertido, a normalização de texto é uma etapa crucial. Isso inclui técnicas como stemming (redução da palavra à sua raiz ou base), remoção de stopwords (palavras comuns que não adicionam muito significado ao texto, como "e", "o", "a", entre outras), e outras técnicas de pré-processamento. Vamos explorar como você pode implementar essas etapas:

### 1. Stemming (Normalização das Palavras)

O processo de stemming reduz as palavras a sua raiz, permitindo que variantes de uma palavra sejam associadas à mesma busca. No contexto do Node.js, você pode utilizar bibliotecas como o `natural` para realizar stemming. Por exemplo:

javascript
const natural = require('natural');
const stemmer = natural.PorterStemmerPt; // Para português. Use natural.PorterStemmer para inglês.

let words = ["correr", "corrida", "correndo"];
let stemmedWords = words.map(word => stemmer.stem(word));

console.log(stemmedWords); // Saída: ["corr", "corr", "corr"]

### 2. Remoção de Stopwords

Stopwords são palavras comuns que geralmente são removidas antes do processamento de linguagem natural, pois elas ocorrem frequentemente e não contribuem muito para o significado do texto. Para remover stopwords, você pode usar a biblioteca `stopword`:

javascript
const sw = require('stopword');
const originalWords = ['eu', 'amo', 'correr', 'nos', 'parques', 'da', 'cidade'];
const newWords = sw.removeStopwords(originalWords, sw.pt); // Para português. Use sw.en para inglês.

console.log(newWords); // Saída: ["amo", "correr", "parques", "cidade"]

### 3. Atualizando o Índice para Grandes Volumes de Dados

Para lidar com grandes volumes de dados e manter o índice atualizado de forma eficiente, considere as seguintes estratégias:

- Atualização Incremental: Em vez de reconstruir o índice do zero, atualize-o incrementando apenas com novos dados ou modificando os existentes. Isso pode ser feito rastreando a última data de atualização dos documentos e processando apenas os que foram alterados desde a última indexação.
  
- Paralelismo: Utilize o poder de processamento paralelo para indexar documentos em simultâneo. Isso pode ser conseguido usando threads ou processos em paralelo, dependendo da capacidade do seu sistema.
  
- Sharding: Divida o índice em partes menores que podem ser processadas e pesquisadas independentemente. O MongoDB suporta sharding nativamente, o que pode ser usado para distribuir o índice entre múltiplas máquinas ou instâncias.
  
- Caching: Use Redis para cachear resultados de buscas frequentes ou partes do índice que são acessadas frequentemente. Isso pode reduzir significativamente o tempo de resposta para consultas comuns.

Ao implementar essas técnicas, é crucial testar e monitorar o desempenho do sistema para garantir que as otimizações estejam tendo o efeito desejado e não estejam introduzindo gargalos em outros lugares. A eficiência na atualização do índice é fundamental para manter a relevância e a rapidez das respostas em um sistema de busca, especialmente quando lidando com grandes conjuntos de dados que estão constantemente mudando.
