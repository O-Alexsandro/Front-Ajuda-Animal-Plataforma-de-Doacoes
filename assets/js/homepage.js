// Sample dynamic cards renderer
// Replace sampleData with API fetch later: fetch('/api/donations').then(r=>r.json()).then(renderCards)
const sampleData = [
  {
    id: 1,
    title: 'aaaaaaa',
    description: 'dwasdasdwasdwasdsa',
    images: [
      'https://via.placeholder.com/900x600?text=Item+1+-+Image+1',
      'https://via.placeholder.com/900x600?text=Item+1+-+Image+2'
    ],
    tag: 'medicine',
    owner: 'ong',
    location: 'SÃO PAULO',
    condition: 'like new'
  },
  {
    id: 2,
    title: 'Bicycle',
    description: 'A nice bike to move around town',
    images: [
      '/assets/img/logo.avif',
      '/assets/img/background_login.png',
      'https://via.placeholder.com/900x600?text=Bicycle+3'
    ],
    tag: 'transport',
    owner: 'user123',
    location: 'RIO DE JANEIRO',
    condition: 'good'
  },
  {
    id: 3,
    title: 'Books (3)',
    description: 'Collection of literature books',
    images: [
      'https://via.placeholder.com/900x600?text=Books+1'
    ],
    tag: 'education',
    owner: 'bookdrive',
    location: 'SÃO PAULO',
    condition: 'used'
  }
];

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

  const meta = document.createElement('div');
  meta.className = 'card-meta';
  meta.innerHTML = `<span style="display:flex;align-items:center;gap:8px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z" stroke="#777" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>${escapeHtml(item.owner)}</span><span style="display:flex;align-items:center;gap:8px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 10c0 6-9 13-9 13S3 16 3 10a9 9 0 1118 0z" stroke="#777" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>${escapeHtml(item.location)}</span>`;

  const condition = document.createElement('div');
  condition.className = 'condition-pill';
  condition.textContent = item.condition;

  const ctaWrap = document.createElement('div');
  ctaWrap.className = 'card-cta';
  const btn = document.createElement('button');
  btn.className = 'btn-ghost';
  btn.textContent = 'View Details';
  btn.onclick = () => {
    // placeholder for action - the app should route to details page
    alert('Open details for: ' + item.title);
  };

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

// Init
renderCards(sampleData);
searchInput.addEventListener('input', filterAndRender);

// Export render function for future use
window.renderCards = renderCards;