const input = document.getElementById("game-search");
const datalist = document.getElementById("game-list");
const langSelect = document.getElementById("language-filter");
const rankSelect = document.getElementById("rank-select");
const resetBtn = document.getElementById("reset-btn");
const treemapEl = document.getElementById("treemap");

let allLanguageData = {};
let currentLang = "all";
let lastRenderedData = [];

const STORAGE_KEYS = {
  LANG: "currentLang",
  GAME: "gameSearch",
  RANK: "rankRange"
};

function savePref(key, value) {
  localStorage.setItem(key, value);
}

function loadPref(key, fallback = "") {
  return localStorage.getItem(key) || fallback;
}

async function loadAllStreamsJson() {
  try {
    const res = await fetch("data.json");
    allLanguageData = await res.json();
  } catch (err) {
    console.error("データの読み込み失敗", err);
  }
}

function getCurrentLanguageData() {
  return currentLang === "all"
    ? Object.values(allLanguageData).flat()
    : allLanguageData[currentLang] || [];
}

function setupLanguageDropdown() {
  const langs = Object.keys(allLanguageData);
  langSelect.innerHTML = `<option value="all">all</option>` +
    langs.map(lang => `<option value="${lang}">${lang}</option>`).join("");

  langSelect.value = currentLang;

  langSelect.onchange = () => {
    currentLang = langSelect.value;
    savePref(STORAGE_KEYS.LANG, currentLang);
    setupGameSearch(getCurrentLanguageData());
    filterAndRender();
  };
}

function setupRankSelect() {
  const saved = loadPref(STORAGE_KEYS.RANK, "1-20");
  rankSelect.value = saved;

  rankSelect.onchange = () => {
    savePref(STORAGE_KEYS.RANK, rankSelect.value);
    filterAndRender();
  };
}

function setupGameSearch(data) {
  if (data.length === 0) {
    datalist.innerHTML = "<option value='No data'>";
    return;
  }

  const uniqueGames = [...new Set(data.map(d => d.game_name))].sort();
  datalist.innerHTML = uniqueGames.map(name => `<option value="${name}">`).join("");

  input.oninput = () => {
    savePref(STORAGE_KEYS.GAME, input.value.trim());
    filterAndRender();
  };
}

function filterAndRender() {
  const list = getCurrentLanguageData().sort((a, b) => b.viewer_count - a.viewer_count);
  const gameInput = input.value.trim().toLowerCase();
  const filtered = gameInput ? list.filter(d => d.game_name.toLowerCase().includes(gameInput)) : list;

  const [start, end] = (rankSelect.value || "1-20").split("-").map(Number);
  if (isNaN(start) || isNaN(end)) return;

  const rangeData = filtered.slice(start - 1, end);

  const isSame = rangeData.length === lastRenderedData.length &&
    rangeData.every((d, i) => {
      const prev = lastRenderedData[i];
      return prev &&
        d.user_login === prev.user_login &&
        d.viewer_count === prev.viewer_count &&
        d.game_name === prev.game_name;
    });

  if (isSame) return;

  lastRenderedData = [...rangeData];

  if (rangeData.length === 0) {
    treemapEl.innerHTML = "<p>No data available</p>";
  } else {
    renderTreemap(rangeData, start);
  }
}

function renderTreemap(data, rankOffset = 1) {
  const container = d3.select(treemapEl);
  container.selectAll("*").remove();

  const width = treemapEl.clientWidth;
  const height = treemapEl.clientHeight || 500;

  const root = d3.hierarchy({ children: data }).sum(d => d.viewer_count);
  d3.treemap().size([width, height]).padding(2)(root);

  const nodes = container.selectAll(".tile")
    .data(root.leaves())
    .enter()
    .append("a")
    .attr("href", d => `https://www.twitch.tv/${d.data.user_login}`)
    .attr("target", "_blank")
    .attr("rel", "noopener noreferrer")
    .attr("class", "tile")
    .attr("aria-label", d => `${d.data.user_name}（${d.data.viewer_count} viewers）`)
    .style("left", d => `${d.x0}px`)
    .style("top", d => `${d.y0}px`)
    .style("width", d => `${d.x1 - d.x0}px`)
    .style("height", d => `${d.y1 - d.y0}px`);

  nodes.filter((_, i) => i + rankOffset <= 500)
    .append("img")
    .attr("loading", "lazy")
    .attr("src", d => `https://static-cdn.jtvnw.net/previews-ttv/live_user_${d.data.user_login}.jpg`)
    .attr("alt", d => d.data.user_name);

  nodes.append("div")
    .attr("class", "label")
    .attr("title", d => `${d.data.user_name}｜${d.data.game_name}`)
    .text((d, i) => `#${i + rankOffset} ${d.data.user_name} (${d.data.viewer_count})`)
    .style("pointer-events", "none");
}

function resetAllFilters() {
  localStorage.removeItem(STORAGE_KEYS.LANG);
  localStorage.removeItem(STORAGE_KEYS.GAME);
  localStorage.removeItem(STORAGE_KEYS.RANK);

  currentLang = "all";
  langSelect.value = "all";
  rankSelect.value = "1-20";
  input.value = "";

  setupGameSearch(getCurrentLanguageData());
  filterAndRender();
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadAllStreamsJson();

  const storedLang = loadPref(STORAGE_KEYS.LANG);
  if (storedLang && Object.keys(allLanguageData).includes(storedLang)) {
    currentLang = storedLang;
  }

  setupLanguageDropdown();

  input.value = loadPref(STORAGE_KEYS.GAME);
  setupGameSearch(getCurrentLanguageData());

  setupRankSelect();
  filterAndRender();

  const observer = new ResizeObserver(debounce(() => {
    filterAndRender();
  }, 200));
  observer.observe(treemapEl);

  window.addEventListener("beforeunload", () => observer.disconnect());
});

resetBtn.addEventListener("click", resetAllFilters);

function debounce(fn, delay = 200) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
