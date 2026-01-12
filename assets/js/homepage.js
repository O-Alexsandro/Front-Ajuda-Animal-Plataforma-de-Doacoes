const sampleData = [];

const cardsContainer = document.getElementById('cards-container');
const searchInput = document.querySelector('.search-input');

function createCard(item) {
  const card = document.createElement('article');
  card.className = 'card';

  // Image carousel container
  const media = document.createElement('div');
  media.className = 'card-media';

  const imgEl = document.createElement('img');
  imgEl.alt = escapeHtml(item.title);
  imgEl.className = 'card-img';
  media.appendChild(imgEl);

  const images = (item.images && item.images.length) ? item.images : ['https://via.placeholder.com/900x600?text=No+Image'];
  let index = 0;

  // carousel counter (declare before updateImage)
  const counter = document.createElement('div');
  counter.className = 'carousel-counter';
  counter.textContent = '';

  function updateImage() { imgEl.src = images[index]; counter.textContent = `${index + 1}/${images.length}`; }
  updateImage();

  // carousel controls
  const prevBtn = document.createElement('button');
  prevBtn.className = 'carousel-btn prev';
  prevBtn.setAttribute('aria-label', 'Previous image');
  prevBtn.innerHTML = '&#10094;';
  prevBtn.onclick = (e) => { e.stopPropagation(); index = (index - 1 + images.length) % images.length; updateImage(); };

  const nextBtn = document.createElement('button');
  nextBtn.className = 'carousel-btn next';
  nextBtn.setAttribute('aria-label', 'Next image');
  nextBtn.innerHTML = '&#10095;';
  nextBtn.onclick = (e) => { e.stopPropagation(); index = (index + 1) % images.length; updateImage(); };

  media.appendChild(prevBtn);
  media.appendChild(nextBtn);
  media.appendChild(counter);

  // hide controls when only one image
  if (images.length <= 1) {
    prevBtn.style.display = 'none';
    nextBtn.style.display = 'none';
    counter.style.display = 'none';
  }

  const body = document.createElement('div');
  body.className = 'card-body';

  const tagsRow = document.createElement('div');
  tagsRow.className = 'card-tags';

  const title = document.createElement('div');
  title.innerHTML = `<div style="display:flex;align-items:center;gap:10px"><h3 class='card-title'>${escapeHtml(item.title)}</h3><span class='tag'>${escapeHtml(item.tag)}</span></div>`;

  const desc = document.createElement('div');
  desc.className = 'card-desc';
  desc.textContent = item.description;

  // sanitize owner and location (remove bullet/degree-like symbols and leading punctuation)
  const cleanOwner = String(item.owner || '').replace(/[°º\u00B0\u25CB\u25E6\u25CF\u2022\u2219•◦]/g, '').replace(/^[^\p{L}\p{N}]+/u, '').trim();
  const cleanLocation = String(item.location || '').replace(/[°º\u00B0\u25CB\u25E6\u25CF\u2022\u2219•◦]/g, '').replace(/^[^\p{L}\p{N}]+/u, '').trim();

  const meta = document.createElement('div');
  meta.className = 'card-meta';
  meta.innerHTML = `${cleanOwner ? `<span style="display:flex;align-items:center;gap:8px"><svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z\" stroke=\"#777\" stroke-width=\"1.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>${escapeHtml(cleanOwner)}</span>` : ''}${cleanLocation ? `<span style="display:flex;align-items:center;gap:8px"><svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M21 10c0 6-9 13-9 13S3 16 3 10a9 9 0 1118 0z\" stroke=\"#777\" stroke-width=\"1.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>${escapeHtml(cleanLocation)}</span>` : '' }`;

  const condition = document.createElement('div');
  condition.className = 'condition-pill';
  condition.textContent = item.estadoConservacao || item.condition || '' ;

  const ctaWrap = document.createElement('div');
  ctaWrap.className = 'card-cta';
  const btn = document.createElement('button');
  btn.className = 'btn-ghost';
  btn.textContent = 'Ver detalhes';
  btn.onclick = () => { openDetails(item); };

  tagsRow.appendChild(title);
  tagsRow.appendChild(condition);

  body.appendChild(tagsRow);
  body.appendChild(desc);
  body.appendChild(meta);
  ctaWrap.appendChild(btn);
  body.appendChild(ctaWrap);

  card.appendChild(media);
  card.appendChild(body);

  return card;
}

function renderCards(data) {
  cardsContainer.innerHTML = '';
  if (!data || !data.length) {
    cardsContainer.innerHTML = '<p>Nenhum item encontrado.</p>';
    return;
  }
  const fragment = document.createDocumentFragment();
  data.forEach(item => fragment.appendChild(createCard(item)));
  cardsContainer.appendChild(fragment);
}

function filterAndRender() {
  const q = (searchInput.value || '').toLowerCase().trim();
  const filtered = sampleData.filter(it => {
    return it.title.toLowerCase().includes(q) || it.description.toLowerCase().includes(q) || it.tag.toLowerCase().includes(q);
  });
  renderCards(filtered);
}

// simple HTML escape
function escapeHtml(s) { return String(s).replace(/[&"'<>]/g, c => ({'&':'&amp;','"':'&quot;',"'":"&#39;","<":"&lt;",">":"&gt;"}[c])); }

// Convert a base64 image payload (from API) into a data URL that can be set as img.src
function base64ToDataUrl(b64) {
  if (!b64) return '';
  // already a data URL
  if (/^data:/i.test(b64)) return b64;
  // detect common image signatures
  const start = b64.slice(0, 5);
  if (/^iVBOR/.test(b64)) return 'data:image/png;base64,' + b64;         // PNG
  if (b64.startsWith('/9j/')) return 'data:image/jpeg;base64,' + b64;      // JPEG
  if (/^R0lGOD/.test(b64)) return 'data:image/gif;base64,' + b64;         // GIF
  // fallback: assume PNG
  return 'data:image/png;base64,' + b64;
}

// Local store for currently loaded items
window.loadedData = sampleData.slice(); // fallback

// Fetch donations from backend and render (falls back to sampleData)
async function fetchDonations() {
  try {
    const res = await fetch('http://localhost:8080/doacoes');
    if (!res.ok) throw new Error('Network response not ok: ' + res.status);
    const data = await res.json();

    // Normalize API response to fields used by the renderer
    const items = (data || []).map(d => ({
      id: d.id ?? d._id ?? d.codigo,
      title: d.titulo || d.title || d.nome || d.name || 'Sem título',
      description: d.descricao || d.description || d.desc || '',
      images: (function(){
        if (Array.isArray(d.imagens) && d.imagens.length) return d.imagens.map(base64ToDataUrl);
        if (Array.isArray(d.images) && d.images.length) return d.images.map(base64ToDataUrl);
        if (d.imagem) return [base64ToDataUrl(d.imagem)];
        if (d.image) return [base64ToDataUrl(d.image)];
        return [];
      })(),
      tag: d.categoria || d.tag || 'outros',
      owner: d.proprietario || d.owner || d.ong || '',
      location: d.localizacao || d.location || d.cidade || d.city || '',
      condition: d.condicao || d.condition || d.estado || '',
      estadoConservacao: d.estadoConservacao || d.estadoConservação || d.estado || d.estado_conservacao || ''
    }));

    window.loadedData = items;
    renderCards(items);
  } catch (err) {
    console.error('Failed to fetch donations from backend, using sample data. Error:', err);
    window.loadedData = sampleData.slice();
    renderCards(window.loadedData);
  }
}

// View details: delegate to the dedicated actions module (if present)
async function openDetails(item) {
  if (window.openDonationDetails) {
    try {
      await window.openDonationDetails(item);
      return;
    } catch (err) {
      console.warn('openDonationDetails failed, falling back to navigation', err);
    }
  }

  // fallback: navigate with id (details page will attempt to fetch if needed)
  window.location.href = `/doacao-detalhes.html?id=${encodeURIComponent(item.id)}`;
}

// wire search to use loadedData
function normalizeText(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }

// references to selects
const categorySelect = document.getElementById('category-select');
const conditionSelect = document.getElementById('condition-select');

function filterAndRender() {
  const q = (searchInput.value || '').toLowerCase().trim();
  const source = window.loadedData || sampleData;

  const selCat = (categorySelect && categorySelect.value) ? normalizeText(categorySelect.value) : '';
  const selCond = (conditionSelect && conditionSelect.value) ? normalizeText(conditionSelect.value) : '';

  const filtered = source.filter(it => {
    const title = normalizeText(it.title || '');
    const description = normalizeText(it.description || '');
    const category = normalizeText(it.tag || '');
    const condition = normalizeText(it.condition || '');
    const estado = normalizeText(it.estadoConservacao || '');

    // text query match (title/category/condition/estado/description)
    const qMatch = !q || title.includes(q) || description.includes(q) || category.includes(q) || condition.includes(q) || estado.includes(q);

    // category filter
    const catMatch = !selCat || category.includes(selCat) || selCat.includes(category) || estado.includes(selCat);

    // condition filter
    const condMatch = !selCond || condition.includes(selCond) || estado.includes(selCond) || (it.estadoConservacao && normalizeText(it.estadoConservacao).includes(selCond));

    return qMatch && catMatch && condMatch;
  });

  renderCards(filtered);
}

// Attach handlers and init
searchInput.addEventListener('input', filterAndRender);
if (categorySelect) categorySelect.addEventListener('change', filterAndRender);
if (conditionSelect) conditionSelect.addEventListener('change', filterAndRender);
fetchDonations();

// Export render function for future use
window.renderCards = renderCards;
window.openDetails = openDetails;