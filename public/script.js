async function performSearch() {
    const query = document.getElementById('searchQuery').value;
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = ''; // Limpa resultados anteriores

    if (query.trim() === '') {
        alert('Please enter a search query.');
        return;
    }

    try {
        const response = await fetch(`/search?q=${encodeURIComponent(query)}`);
        const results = await response.json();

        if (results.length === 0) {
            resultsDiv.innerHTML = '<p>No results found.</p>';
            return;
        }

        results.forEach(result => {
            const item = document.createElement('div');
            item.classList.add('result-item');

            const url = document.createElement('a');
            url.classList.add('result-url');
            url.href = result.url;
            url.textContent = result.url;
            url.target = '_blank';

            const score = document.createElement('p');
            score.textContent = `Relevance Score: ${result.score}`;

            item.appendChild(url);
            item.appendChild(score);
            resultsDiv.appendChild(item);
        });
    } catch (error) {
        resultsDiv.innerHTML = `<p>Error: ${error.message}</p>`;
    }
}
